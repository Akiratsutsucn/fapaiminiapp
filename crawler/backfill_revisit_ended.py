"""成交回访：回访「库内仍标为活跃(即将开拍/进行中)、但拍卖结束时间已过」的房源，
核实它们在平台上的真实终态(已成交/已撤回/中止/流拍)并回写。

背景（见 backend/app/core/auction_status.sold_on_sql 的「已知局限」注释）：
  「昨日成交」口径只认 effective_status=='已成交' 的房源。但库内某房源结拍后，
  若爬虫当轮没抓到平台的成交标记，它会停在按时间推算的「已结束」(甚至因状态文本
  滞后停在「进行中」)，从而不计入成交统计——成交召回偏低。
  本脚本对「end_time 已过但状态仍活跃」的房源做定向回访，补齐这些遗漏的终态。

逐条流程：
  1. 按 auction_platform 分组，从 PLATFORM_FACTORY 取 (crawler_cls, parser_cls)；
  2. 从 source_url 提取平台 id；
  3. API 平台(京东/阿里)走 fetch_detail_api，HTML 平台(公拍网)走 fetch_detail；
  4. parser.parse(...) → 取归一后的 item.auction_status；
  5. 解析出结果态(已成交/已撤回/中止/流拍) → 写入该终态；
     解析失败 / 仍判活跃 / 判为「已结束」 → 保守 mark_as_ended（不比现状差，
     因为这些房源 end_time 早已过，标「已结束」至少不会错误地继续算作可参拍）。

干跑保护：默认 dry-run，只打印不写库；加 --commit 才落库。
  --platform 公拍网   只回访指定平台（不传=全部三平台）
  --limit 20          每平台最多回访 N 条（便于分平台、小批量测试）

用法示例（dry-run，安全）：
  python -m crawler.backfill_revisit_ended --platform 京东拍卖 --limit 5
  python -m crawler.backfill_revisit_ended                       # 全平台 dry-run
  python -m crawler.backfill_revisit_ended --commit              # 确认枚举无误后落库
"""
import argparse
import asyncio
import re
from datetime import datetime, timedelta

from sqlalchemy import select, and_
from loguru import logger

from crawler.storage.db import get_session
from crawler.browser import browser_manager
from crawler.anti_crawl import random_sleep
from crawler.engine import PLATFORM_FACTORY
from crawler.storage.repository import PropertyRepository
from app.models.property import Property

# 时间推不出的结果态：到点后究竟成交/流拍/撤回只能由平台告知（与后端单一事实源同口径）。
try:
    from app.core.auction_status import RESULT_STATES
except Exception:  # 独立环境兜底
    RESULT_STATES = ("已成交", "已撤回", "中止", "流拍")

# 库内被视为「活跃」的状态：开拍时间窗内/未到，正常情况下不该 end_time 已过。
ACTIVE_STATES = ("即将开拍", "进行中")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="成交回访：核实 end_time 已过的活跃房源的真实终态")
    p.add_argument("--commit", action="store_true", help="落库（默认 dry-run 只打印）")
    p.add_argument("--platform", default=None,
                   help="只回访指定平台（京东拍卖/阿里拍卖/公拍网），不传=全部")
    p.add_argument("--recent-ended-days", type=int, default=0,
                   help="额外复核近N天内已被标为『已结束』的房源（向平台核实是否其实成交）")
    p.add_argument("--limit", type=int, default=0,
                   help="每平台最多回访 N 条（0=不限）")
    return p.parse_args()


def _extract_platform_id(url: str) -> str:
    """从 source_url 提取平台标的 id（京东/阿里都带 itemId=；京东亦可从路径取）。"""
    if not url:
        return ""
    m = re.search(r"itemId=(\d+)", url)
    if m:
        return m.group(1)
    m = re.search(r"paimai\.jd\.com/(\d+)", url)
    if m:
        return m.group(1)
    return ""


def _raw_status_repr(detail) -> str:
    """构造「平台原始状态值」日志片段，供人工核对枚举映射。

    API 平台(dict)：打印 displayStatus / bidStatus 原始值（京东枚举为推断，尤需核对）。
    HTML 平台：内容由文本关键词解析，无单一原始状态码，标注为文本解析。
    """
    if isinstance(detail, dict):
        d = detail.get("data", detail)
        if isinstance(d, dict) and "data" in d and isinstance(d["data"], dict):
            d = d["data"]
        return f"displayStatus={d.get('displayStatus')!r} bidStatus={d.get('bidStatus')!r}"
    return "(HTML文本解析, 无原始状态码)"


# 占位：后续追加 revisit_platform / backfill / main


async def _fetch_and_parse(crawler, parser, p: Property):
    """抓取 + 解析单条房源，返回 (auction_item, raw_detail)。

    raw_detail 用于打印平台原始状态值；任一步失败抛异常由调用方兜底。
    API 驱动平台(京东/阿里, 有 fetch_detail_api)用接口直取；HTML 平台(公拍网)渲染详情页。
    """
    city_id = p.city_id or 310000
    if hasattr(crawler, "fetch_detail_api"):
        item_id = _extract_platform_id(p.source_url)
        if not item_id:
            raise ValueError(f"无法从 source_url 提取 id: {p.source_url}")
        # MTOP/京东接口对高频敏感，逐条间隔
        await random_sleep(2.0, 4.0)
        api_data = await crawler.fetch_detail_api(item_id)
        if not api_data:
            raise ValueError(f"fetch_detail_api 返回空: {item_id}")
        item = await parser.parse(api_data, p.source_url, city_id, extra={})
        return item, api_data
    # HTML 平台（公拍网）
    html = await crawler.fetch_detail(p.source_url)
    await random_sleep(0.5, 2.0)
    item = await parser.parse(html, p.source_url, city_id, extra={})
    return item, None


async def revisit_platform(
    db, platform_name: str, commit: bool, limit: int, stats: dict,
    recent_ended_days: int = 0,
) -> None:
    """回访单个平台下「end_time 已过但状态仍活跃」的房源。"""
    crawler_cls, parser_cls = PLATFORM_FACTORY[platform_name]
    crawler = crawler_cls()
    parser = parser_cls()

    now = datetime.now()
    # 候选 = ①状态仍活跃但 end_time 已过（状态滞后）
    #       ②近 recent_ended_days 天内被标「已结束」的（可能其实成交/流拍，需向平台复核终态）
    status_filter = list(ACTIVE_STATES)
    conds = [
        Property.auction_platform == platform_name,
        Property.auction_end_time.isnot(None),
        Property.auction_end_time < now,
    ]
    if recent_ended_days and recent_ended_days > 0:
        status_filter.append("已结束")
        conds.append(
            Property.auction_end_time >= now - timedelta(days=recent_ended_days)
        )
    conds.append(Property.auction_status.in_(status_filter))
    q = select(Property).where(and_(*conds)).order_by(Property.auction_end_time.desc())
    if limit and limit > 0:
        q = q.limit(limit)
    rows = (await db.execute(q)).scalars().all()

    logger.info(
        f"[{platform_name}] 待回访 {len(rows)} 条"
        f"（活跃但已过结束时间 + 近{recent_ended_days}天已结束复核）"
    )
    if not rows:
        await crawler.close()
        return

    try:
        for p in rows:
            old_status = p.auction_status
            try:
                item, raw = await _fetch_and_parse(crawler, parser, p)
            except Exception as e:
                # 抓取/解析失败 → 保守标已结束（这些 end_time 早过，不该再算活跃）
                stats["fetch_failed"] += 1
                logger.warning(
                    f"  [fail→ended] id={p.id} {old_status} 抓取/解析失败: {e} "
                    f"→ 保守标『已结束』 url={p.source_url[:70]}"
                )
                if commit:
                    await PropertyRepository.mark_as_ended(db, p.id)
                    await db.commit()
                stats["ended_conservative"] += 1
                continue

            new_status = (item.auction_status or "").strip()
            raw_repr = _raw_status_repr(raw)

            if new_status in RESULT_STATES:
                # 平台告知了真实终态 → 写入
                stats["result_state"] += 1
                stats[f"to_{new_status}"] = stats.get(f"to_{new_status}", 0) + 1
                logger.info(
                    f"  [回访] id={p.id} {old_status} → {new_status}  "
                    f"[平台原始: {raw_repr}]  url={p.source_url[:70]}"
                )
                if commit:
                    await PropertyRepository.update_auction_status(db, p.id, new_status)
                    await db.commit()
            else:
                # 解析仍判活跃/已结束 → 平台未给终态，保守标已结束（不比现状差）
                stats["ended_conservative"] += 1
                logger.info(
                    f"  [回访] id={p.id} {old_status} → 已结束(保守, 解析得『{new_status}』)  "
                    f"[平台原始: {raw_repr}]  url={p.source_url[:70]}"
                )
                if commit:
                    await PropertyRepository.mark_as_ended(db, p.id)
                    await db.commit()
    finally:
        await crawler.close()


async def backfill() -> None:
    args = _parse_args()
    commit = args.commit
    platforms = [args.platform] if args.platform else list(PLATFORM_FACTORY.keys())
    for pf in platforms:
        if pf not in PLATFORM_FACTORY:
            logger.error(f"未知平台: {pf}（可选: {list(PLATFORM_FACTORY.keys())}）")
            return

    stats = {
        "result_state": 0,        # 回写为平台告知的结果态(成交/撤回/中止/流拍)
        "ended_conservative": 0,  # 保守标已结束(解析失败或平台未给终态)
        "fetch_failed": 0,        # 抓取/解析失败(已并入 ended_conservative 计数动作)
    }

    await browser_manager.start()
    db = await get_session()
    try:
        for pf in platforms:
            await revisit_platform(db, pf, commit, args.limit, stats,
                                    recent_ended_days=args.recent_ended_days)
    finally:
        await db.close()
        await browser_manager.stop()

    mode = "已提交" if commit else "(dry-run 未写库)"
    logger.info("=" * 56)
    logger.info(f"成交回访完成 {mode}")
    logger.info(f"  回写结果态: {stats['result_state']} "
                f"(其中 {', '.join(f'{k[3:]}={v}' for k, v in stats.items() if k.startswith('to_')) or '无'})")
    logger.info(f"  保守标已结束: {stats['ended_conservative']} (含抓取失败 {stats['fetch_failed']})")
    logger.info("=" * 56)


if __name__ == "__main__":
    asyncio.run(backfill())

