"""数据审核「修复」脚本（效果3）—— 全局回填缺失字段 + 恢复被误隐藏的房源图。

设计目标
========
审核服务（app/services/data_audit_service.py）对缺起拍价/保证金/加价幅度/面积的
房源只能 flag（标记），其内置 _try_auto_fix 会把缺失字段填 0（掩盖、污染数据，且因
规则 auto_fix=False 实际是死代码）。本脚本提供「真修复」：

  A. 全局修复照片不显示：把之前被垃圾图过滤器**误判为垃圾**而 hidden=1 的正常房源照
     恢复显示（hidden=0）。用最新的 detect_junk 重判，现在判为「正常」(None) 的才恢复。

  B. 全局回填缺失的 starting_price / deposit / increment_amount / area：从该房源的
     description（竞买公告正文，库里已落地的 Text 字段）用正则重新提取。
     **提取不到就跳过，绝不填 0** —— 这是与审核服务 _try_auto_fix 的根本区别。

关键约束（与任务要求一致）
========================
- 不改 audit 的删除规则，不动任何 flag 规则；本脚本是审核之外的独立修复步骤。
- 「修复」≠「填 0」：价格/面积只在 description 里能正则提取到合理值时才回填。
- 默认 dry-run（只报告不写库），必须显式 --commit 才落库。
- 将来在「爬虫 + 审核」之后运行（爬虫已填好 description，审核已标出缺字段房源）。

正则复用说明
============
- 价格提取复用 crawler/parsers/gpai_detail.py 中 _extract_prices 的标签正则
  （起拍价/变卖价/拍卖保留价、保证金、加价幅度），与 parse_price_to_yuan 单位换算。
- 面积提取复用 gpai_detail._extract_property_details 的「建筑面积...㎡/平方米」正则
  （强制带单位、负向排除「地下建筑面积」、5~5000 ㎡ 合理区间兜底），与 parse_area_sqm。
- 图片恢复复用 crawler/pipelines/junk_image_filter.detect_junk + 本地文件路径换算
  （与 crawler/reclassify_hidden_images.py 一致），仅对可恢复类别（logo/solid）重判，
  banner/qrcode 判据可靠不动（沿用 crawler/recheck_hidden_images.py 的保守口径）。

用法
====
    cd /opt/fapai && sudo -u www-data /opt/fapai/venv/bin/python -m backend.scripts.audit_backfill_fix

    （默认 dry-run，仅报告）
    --commit          实际写库（不加则只统计、不修改）
    --limit N         只处理前 N 条房源（价格/面积回填用），0=不限
    --status STATUS   价格/面积回填的房源范围：
                        visible（默认：即将开拍/进行中/中止/撤回/已撤回）| all | 具体状态
    --skip-prices     跳过价格/面积回填，只做图片恢复
    --skip-images     跳过图片恢复，只做价格/面积回填
    --images-via-http 图片重判改用 HTTP 拉取（默认读本地 IMAGE_STORAGE_PATH 文件，更快）
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

# --- 路径引导：让脚本在 backend/scripts/ 下也能 import app.* 与 crawler.* ---
ROOT = Path(__file__).resolve().parent.parent.parent   # 项目根
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from loguru import logger  # noqa: E402
from sqlalchemy import select, update  # noqa: E402

from app.models.property import Property, PropertyImage  # noqa: E402
from crawler.storage.db import get_session  # noqa: E402
from crawler.config import settings  # noqa: E402
from crawler.cleaners.price import parse_price_to_yuan, parse_area_sqm  # noqa: E402


# ====================================================================
# A. 价格 / 面积：从 description 正文回填（复用 gpai_detail 的标签正则）
# ====================================================================

# 起拍价：与 gpai_detail._extract_prices 同款多标签（起拍价/变卖价/拍卖保留价）。
# 注意：这里只信「明确带标签」的值，不做「当前价」兜底——当前价在已结束房源里
# 可能是成交价，回填到 starting_price 会失真，宁缺毋滥。
_START_PRICE_PATTERNS = [
    r'起拍价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
    r'变卖价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
    r'拍卖保留价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
]
_DEPOSIT_PATTERN = r'保证金[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?'
_INCREMENT_PATTERN = r'加价幅度[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?'

# 面积：复用 gpai_detail 的「建筑面积...㎡」主正则（负向排除「地下建筑面积」、强制单位）。
_AREA_LABELLED = re.compile(
    r'(?<!地下)建筑面积[为约是：:]?\s*(\d+(?:\.\d+)?)\s*(?:㎡|平方米|平米|m2|m²)'
)
# 兜底：任意「<数字> ㎡」，强制带单位，取落在 5~5000 ㎡ 合理住宅区间的首个值。
_AREA_FALLBACK = re.compile(r'(\d+(?:\.\d+)?)\s*(?:㎡|平方米|平米|m2|m²)')


def _match_price(text: str, pattern: str) -> int:
    """对正文按单个标签正则提取价格，返回元(int)；无匹配返回 0。"""
    m = re.search(pattern, text)
    if not m:
        return 0
    # group(1)=数字，group(2)=单位（可能为 None）。拼回带单位串交给 parse_price_to_yuan。
    raw = m.group(1)
    unit = m.group(2) if m.lastindex and m.lastindex >= 2 else ""
    return parse_price_to_yuan(f"{raw}{unit or ''}")


def extract_starting_price(text: str) -> int:
    for pat in _START_PRICE_PATTERNS:
        val = _match_price(text, pat)
        if val > 0:
            return val
    return 0


def extract_deposit(text: str) -> int:
    return _match_price(text, _DEPOSIT_PATTERN)


def extract_increment(text: str) -> int:
    return _match_price(text, _INCREMENT_PATTERN)


def extract_area(text: str) -> float:
    """从正文提取建筑面积(㎡)，提取不到返回 0.0。"""
    m = _AREA_LABELLED.search(text)
    if m:
        return parse_area_sqm(m.group(1))
    # 兜底：第一处带单位且落在合理区间的面积
    for cand in _AREA_FALLBACK.findall(text):
        try:
            v = float(cand)
        except ValueError:
            continue
        if 5 <= v <= 5000:
            return parse_area_sqm(cand)
    return 0.0


def compute_price_area_fix(p: Property) -> dict:
    """对一个房源，仅针对「当前缺失」的价格/面积字段尝试从 description 回填。

    返回 dict（字段名 -> 新值），只含真正提取到合理值的字段；无可填项返回 {}。
    缺失判定与审核 _check_required_fields 一致：None / "" / 0 视为缺失。
    """
    desc = p.description or ""
    if not desc.strip():
        return {}                       # 无正文，无源可提取
    # 折叠空白，提升标签正则命中率（与 parser 内一致）
    text = re.sub(r'\s+', ' ', desc)

    updates: dict = {}

    # starting_price：BigInteger，缺失=0
    if not p.starting_price:
        v = extract_starting_price(text)
        if v > 0:
            updates["starting_price"] = v

    # deposit
    if not p.deposit:
        v = extract_deposit(text)
        if v > 0:
            updates["deposit"] = v

    # increment_amount（加价幅度）
    if not p.increment_amount:
        v = extract_increment(text)
        if v > 0:
            updates["increment_amount"] = v

    # area：Float，缺失=0.0
    if not p.area or p.area == 0.0:
        v = extract_area(text)
        if v > 0:
            updates["area"] = v

    return updates


async def run_price_area_backfill(db, args) -> None:
    """B. 全局回填缺失的 起拍价/保证金/加价幅度/面积（从 description 提取，提不到则跳过）。"""
    q = select(Property)
    if args.status == "visible":
        q = q.where(Property.auction_status.in_(
            ["即将开拍", "进行中", "中止", "撤回", "已撤回"]
        ))
    elif args.status != "all":
        q = q.where(Property.auction_status == args.status)
    if args.limit > 0:
        q = q.limit(args.limit)

    rows = (await db.execute(q)).scalars().all()
    total = len(rows)
    logger.info(f"[价格/面积回填] 扫描 {total} 个房源  commit={args.commit}")

    # 统计：各字段成功回填数 / 缺该字段但 description 无源可提取的房源数
    field_filled: dict[str, int] = {}
    no_source = 0           # 缺字段但 description 为空
    extract_miss = 0        # 有正文但正则没提到任何缺失字段
    updated = 0

    for p in rows:
        # 该房源是否本来就缺至少一个目标字段？
        missing_any = (
            not p.starting_price or not p.deposit
            or not p.increment_amount or not p.area
        )
        if not missing_any:
            continue

        updates = compute_price_area_fix(p)
        if not updates:
            if not (p.description or "").strip():
                no_source += 1
            else:
                extract_miss += 1
            continue

        for k in updates:
            field_filled[k] = field_filled.get(k, 0) + 1
        updated += 1

        if args.commit:
            for k, v in updates.items():
                setattr(p, k, v)
        else:
            logger.debug(f"[dry] P#{p.id} {(p.title or '')[:28]}: {updates}")

    if args.commit:
        await db.commit()

    logger.info("--- 价格/面积回填结果 ---")
    logger.info(f"  扫描 {total}，成功回填 {updated} 套")
    for k, v in sorted(field_filled.items(), key=lambda x: -x[1]):
        logger.info(f"    {k:18s} 回填 {v} 套")
    logger.info(f"  缺字段但 description 为空（无源，保持现状）：{no_source} 套")
    logger.info(f"  有正文但未提取到缺失字段（保持现状）：{extract_miss} 套")
    if not args.commit:
        logger.warning("  ** dry-run：未写库，加 --commit 落库 **")


# ====================================================================
# C. 图片：恢复被误隐藏的房源照片（复用 junk_image_filter.detect_junk）
# ====================================================================

def _url_to_local_path(url: str) -> Path:
    """图片 URL → 本地文件路径（与 crawler/reclassify_hidden_images.py 一致）。"""
    rel = url.split("/images/properties/")[-1]
    return Path(settings.IMAGE_STORAGE_PATH) / "properties" / rel


async def run_image_recovery(db, args) -> None:
    """A. 恢复被误判为垃圾图而隐藏的正常房源照。

    只复检「可能误杀」的类别（logo / solid）；banner / qrcode 判据可靠，不动
    （沿用 crawler/recheck_hidden_images.py 的保守口径）。用最新 detect_junk 重判，
    现在判为正常(None) 的才恢复 hidden=0 / hide_reason=None。
    """
    from crawler.pipelines.junk_image_filter import detect_junk

    rows = (await db.execute(
        select(PropertyImage.id, PropertyImage.image_url, PropertyImage.hide_reason)
        .where(
            PropertyImage.hidden == 1,
            PropertyImage.hide_reason.in_(["logo", "solid"]),
        )
    )).all()
    logger.info(f"[图片恢复] 待复检(logo/solid) {len(rows)} 张  commit={args.commit}  "
                f"via={'http' if args.images_via_http else 'local-file'}")

    unhide_ids: list[int] = []
    missing = 0     # 本地文件缺失 / HTTP 拉取失败
    still = 0       # 仍判为垃圾

    if args.images_via_http:
        import httpx
        sem = asyncio.Semaphore(24)

        async def fetch(url: str) -> bytes | None:
            async with sem:
                try:
                    async with httpx.AsyncClient(timeout=20, verify=False) as c:
                        r = await c.get(url)
                        return r.content if r.status_code == 200 else None
                except Exception:
                    return None

        for iid, url, _reason in rows:
            data = await fetch(url)
            if data is None:
                missing += 1
                continue
            try:
                if detect_junk(data) is None:
                    unhide_ids.append(iid)
                else:
                    still += 1
            except Exception:
                missing += 1
    else:
        # 默认：读本地挂载文件（cosfs），无网络开销
        for iid, url, _reason in rows:
            p = _url_to_local_path(url)
            if not p.exists():
                missing += 1
                continue
            try:
                if detect_junk(p.read_bytes()) is None:
                    unhide_ids.append(iid)
                else:
                    still += 1
            except Exception:
                missing += 1

    logger.info(f"  现判为正常照片(可恢复显示)：{len(unhide_ids)} 张  "
                f"仍判垃圾：{still}  缺失/拉取失败：{missing}")

    if args.commit and unhide_ids:
        B = 500
        for i in range(0, len(unhide_ids), B):
            chunk = unhide_ids[i:i + B]
            await db.execute(
                update(PropertyImage)
                .where(PropertyImage.id.in_(chunk))
                .values(hidden=0, hide_reason=None)
            )
        await db.commit()
        logger.info(f"  已恢复 {len(unhide_ids)} 张图片显示")
    elif not args.commit:
        logger.warning("  ** dry-run：未写库，加 --commit 落库 **")


# ====================================================================
# 入口
# ====================================================================

async def main():
    ap = argparse.ArgumentParser(description="数据审核修复：回填缺失字段 + 恢复误隐藏图片")
    ap.add_argument("--commit", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--limit", type=int, default=0, help="价格/面积回填只处理前 N 条，0=不限")
    ap.add_argument("--status", default="visible",
                    help="价格/面积回填范围：visible(默认)|all|具体状态")
    ap.add_argument("--skip-prices", action="store_true", help="跳过价格/面积回填")
    ap.add_argument("--skip-images", action="store_true", help="跳过图片恢复")
    ap.add_argument("--images-via-http", action="store_true",
                    help="图片重判改用 HTTP 拉取（默认读本地文件）")
    args = ap.parse_args()

    db = await get_session()
    try:
        if not args.skip_prices:
            await run_price_area_backfill(db, args)
        if not args.skip_images:
            await run_image_recovery(db, args)
        logger.info("修复脚本执行完毕。" + ("" if args.commit else "（dry-run，未写库）"))
    finally:
        await db.close()


if __name__ == "__main__":
    try:
        from crawler.utils.logger import setup_logger
        setup_logger("INFO")
    except Exception:
        pass
    asyncio.run(main())
