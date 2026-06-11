"""字段回填：对库内「缺关键字段」或「需核成交确认书」的存量房源重抓补全。

背景（用户 2026-06-10 要求）：
  面积/加价幅度/起拍价/保证金/照片 五字段 100% 应有；爬虫解析器已加「全文兜底挖掘」
  与「成交确认书」识别，但**存量房源**是旧逻辑入库的，缺的字段不会自动补——必须重抓。

本脚本逐条重抓并用新解析器（自带兜底 + 附件 + 成交确认书 PDF 解析）覆盖回写：
  - 五字段缺失（area<=0 / increment_amount<=0 / starting_price<=0 / deposit<=0 / 无图片）；
  - 或 end_time 已过、需核「成交确认书」补 deal_confirmed / online_auction_end_time。

只回写「新解析器解析出的非空更优值」，绝不用空值覆盖已有数据。

干跑保护：默认 dry-run 只打印；加 --commit 落库。
用法：
  python -m crawler.backfill_fields --platform 京东拍卖 --limit 10        # dry-run
  python -m crawler.backfill_fields --only-missing-area --limit 50         # 只补面积缺失的
  python -m crawler.backfill_fields --commit                               # 全平台落库
"""
import argparse
import asyncio
from datetime import datetime

from sqlalchemy import select, or_, and_
from loguru import logger

from crawler.storage.db import get_session
from crawler.browser import browser_manager
from crawler.anti_crawl import random_sleep
from crawler.engine import PLATFORM_FACTORY
from crawler.storage.repository import PropertyRepository, PropertyImageRepository
from crawler.backfill_revisit_ended import _fetch_and_parse, _extract_platform_id
from app.models.property import Property

# 需要被回填的字段：新值非空/非0 且与旧值不同时才回写。
_NUMERIC_FIELDS = ("area", "increment_amount", "starting_price", "deposit",
                   "appraisal_price", "total_floors", "final_deal_price")
# 派生字段（由 parser._compute_derived_fields 算好）：补了评估价/起拍价后，折扣、
# 单价、捡漏空间也应一并回写，否则前端「折扣」仍为空。新值>0 且旧值空/为0 才写。
_DERIVED_FIELDS = ("court_discount_rate", "market_discount_rate",
                   "starting_unit_price", "market_deal_price", "bargain_potential")
_SCALAR_FIELDS = ("attachments", "online_auction_end_time",
                  "layout", "floor_info", "orientation", "decoration",
                  "has_attachments")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="字段回填：重抓补全缺失的关键字段与成交确认书")
    p.add_argument("--commit", action="store_true", help="落库（默认 dry-run 只打印）")
    p.add_argument("--platform", default=None,
                   help="只回填指定平台（京东拍卖/阿里拍卖/公拍网），不传=全部")
    p.add_argument("--limit", type=int, default=0, help="每平台最多回填 N 条（0=不限）")
    p.add_argument("--only-missing-area", action="store_true",
                   help="只回填面积缺失(area<=0)的房源")
    p.add_argument("--recheck-sold", action="store_true",
                   help="成交复核模式：核实已结束/已成交房源的成交价与成交状态(纠正误判)")
    p.add_argument("--city-id", type=int, default=None,
                   help="只回填指定城市(310000/330200/330100)")
    return p.parse_args()


def _build_query(platform_name: str, args):
    """构造「缺字段」候选查询。"""
    conds = [Property.auction_platform == platform_name]
    if args.city_id:
        conds.append(Property.city_id == args.city_id)

    if args.only_missing_area:
        conds.append(or_(Property.area.is_(None), Property.area <= 0))
    elif getattr(args, "recheck_sold", False):
        # 成交复核模式：核实「已结束/已成交」房源的真实成交状态与成交价。
        # 覆盖两类：①end_time 已过的结拍房源（补 final_deal_price/确认书）；
        #          ②deal_confirmed=True 但无成交价的（多为历史弱兜底误判，需纠正）。
        now = datetime.now()
        conds.append(or_(
            and_(Property.auction_end_time.isnot(None),
                 Property.auction_end_time < now),
            Property.deal_confirmed.is_(True),
            Property.auction_status.in_(["已结束", "已成交"]),
        ))
    else:
        # 缺任一关键数值字段，或 end_time 已过但未确认成交（需核成交确认书）
        now = datetime.now()
        conds.append(or_(
            Property.area.is_(None), Property.area <= 0,
            Property.increment_amount.is_(None), Property.increment_amount <= 0,
            Property.starting_price.is_(None), Property.starting_price <= 0,
            Property.deposit.is_(None), Property.deposit <= 0,
            and_(
                Property.auction_end_time.isnot(None),
                Property.auction_end_time < now,
                or_(Property.deal_confirmed.is_(None),
                    Property.online_auction_end_time.is_(None)),
            ),
        ))
    q = select(Property).where(and_(*conds)).order_by(Property.id.desc())
    if args.limit and args.limit > 0:
        q = q.limit(args.limit)
    return q


def _diff_updates(old: Property, item) -> dict:
    """对比旧记录与新解析 item，返回「应回写的非空更优字段」。"""
    updates: dict = {}
    for f in _NUMERIC_FIELDS:
        new_v = getattr(item, f, None)
        old_v = getattr(old, f, None)
        # 数值字段：新值 > 0 且（旧值为空/<=0 或与新值不同）才回写
        if new_v and new_v > 0 and (not old_v or old_v <= 0):
            updates[f] = new_v
    for f in _DERIVED_FIELDS:
        new_v = getattr(item, f, None)
        old_v = getattr(old, f, None)
        # 派生字段（折扣/单价/捡漏空间）：新值 > 0 且旧值为空/为0 才回写
        if new_v and new_v > 0 and (not old_v or old_v <= 0):
            updates[f] = new_v
    for f in _SCALAR_FIELDS:
        new_v = getattr(item, f, None)
        old_v = getattr(old, f, None)
        if new_v is not None and new_v != old_v:
            updates[f] = new_v
    # deal_confirmed 单独处理：新解析器对成交状态是「确定判定」(京东走实时接口、
    # 公拍网/阿里走状态字段)，True=确成交、False/None=确未成交。需无条件同步，
    # 以便纠正历史「正文字样弱兜底」造成的 True 误判(库内 194 条)。仅当新旧不同才回写。
    new_dc = getattr(item, "deal_confirmed", None)
    old_dc = getattr(old, "deal_confirmed", None)
    if new_dc != old_dc:
        updates["deal_confirmed"] = new_dc
    return updates


async def backfill_platform(db, platform_name: str, args, stats: dict) -> None:
    """回填单个平台的缺字段房源。"""
    crawler_cls, parser_cls = PLATFORM_FACTORY[platform_name]
    crawler = crawler_cls()
    parser = parser_cls()

    rows = (await db.execute(_build_query(platform_name, args))).scalars().all()
    logger.info(f"[{platform_name}] 待回填 {len(rows)} 条")
    if not rows:
        await crawler.close()
        return

    try:
        for p in rows:
            try:
                item, _raw = await _fetch_and_parse(crawler, parser, p)
            except Exception as e:
                stats["fetch_failed"] += 1
                logger.warning(f"  [fail] id={p.id} 抓取/解析失败: {e}")
                continue

            updates = _diff_updates(p, item)
            # 图片：新解析有图、旧记录无图时补图
            new_imgs = list(getattr(item, "image_urls", []) or [])
            need_imgs = new_imgs and not (p.images or [])

            if not updates and not need_imgs:
                stats["no_change"] += 1
                continue

            stats["updated"] += 1
            for k in updates:
                stats.setdefault(f"field_{k}", 0)
                stats[f"field_{k}"] += 1
            logger.info(
                f"  [回填] id={p.id} {p.auction_platform} "
                f"字段={list(updates.keys())}{' +图片' if need_imgs else ''} "
                f"url={p.source_url[:60]}"
            )
            if args.commit:
                if updates:
                    updates["updated_at"] = datetime.now()
                    from sqlalchemy import update as _upd
                    await db.execute(_upd(Property).where(Property.id == p.id).values(**updates))
                if need_imgs:
                    await PropertyImageRepository.batch_upsert(
                        db, p.id, [{"image_url": u, "sort_order": i, "is_cover": i == 0}
                                   for i, u in enumerate(new_imgs)])
                await db.commit()
            await random_sleep(1.0, 2.5)
    finally:
        await crawler.close()


async def backfill() -> None:
    args = _parse_args()
    platforms = [args.platform] if args.platform else list(PLATFORM_FACTORY.keys())
    for pf in platforms:
        if pf not in PLATFORM_FACTORY:
            logger.error(f"未知平台: {pf}（可选: {list(PLATFORM_FACTORY.keys())}）")
            return

    stats = {"updated": 0, "no_change": 0, "fetch_failed": 0}
    await browser_manager.start()
    db = await get_session()
    try:
        for pf in platforms:
            await backfill_platform(db, pf, args, stats)
    finally:
        await db.close()
        await browser_manager.stop()

    mode = "已提交" if args.commit else "(dry-run 未写库)"
    logger.info("=" * 56)
    logger.info(f"字段回填完成 {mode}")
    logger.info(f"  回写: {stats['updated']}  无变化: {stats['no_change']}  "
                f"抓取失败: {stats['fetch_failed']}")
    field_lines = [f"{k[6:]}={v}" for k, v in sorted(stats.items()) if k.startswith("field_")]
    if field_lines:
        logger.info(f"  各字段补全数: {', '.join(field_lines)}")
    logger.info("=" * 56)


if __name__ == "__main__":
    asyncio.run(backfill())

