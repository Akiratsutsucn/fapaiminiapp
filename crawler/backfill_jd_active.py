"""一次性回填：京东「活跃」房源缺失的 起拍价/评估价/保证金/增价幅度/面积。

背景：早期爬虫用长 id（productId, 10034...）构建 source_url，而 getProductBasicInfo
接口只认短 id（paimaiId, 3104...），导致这些记录补全失败、字段留空。

本脚本：
  1. 重跑京东列表采集（已修复为抓短 id），从 _row_cache 建「长 id → 短 id」映射；
  2. 对每条活跃长 id 记录：
     - 若库内已有对应短 id 记录（孪生重复）→ 删除该长 id 记录；
     - 否则 → 改 source_url 为短 id，重新 fetch_detail_api（含渲染面积），原地更新字段。
  只处理活跃（即将开拍/进行中）记录；已结束的长 id 房源不在列表里、拿不到短 id，跳过。

用法：python -m crawler.backfill_jd_active [--commit]
"""
import sys
import asyncio
import re
from datetime import datetime

from sqlalchemy import select, and_, or_
from loguru import logger

from crawler.storage.db import get_session
from crawler.browser import browser_manager
from crawler.platforms.jd import JDAuctionCrawler
from crawler.parsers.jd_detail import JDDetailParser
from crawler.utils.url_registry import get_configs
from app.models.property import Property

COMMIT = "--commit" in sys.argv
CITIES = ["上海", "宁波", "杭州"]


def _id_in_url(url: str) -> str:
    m = re.search(r"/(\d+)", url or "")
    return m.group(1) if m else ""


def _is_short(idnum: str) -> bool:
    return len(idnum) <= 9 and idnum.startswith("3")


# 占位：后续追加 build_map / backfill / main


async def build_long_to_short_map(crawler) -> dict:
    """重跑列表采集，建「长 id(productId) → 短 id(paimaiId/id)」映射。

    关键：必须用生产同款的「带省/市筛选」源 URL（get_configs），
    否则用全国默认 URL 会被外省房源淹没，目标三市极稀疏（实测仅 6 条）。
    采集后 crawler._row_cache 的 key 已是短 id（jd.py 修复后），每行含 productId。
    """
    long2short = {}
    configs = get_configs(platform="京东拍卖")
    for cfg in configs:
        try:
            await crawler.collect_list_items(cfg.source_url, cfg.city, 50)
            logger.info(f"[backfill] 采集 {cfg.label}: 累计 row_cache={len(crawler._row_cache)}")
        except Exception as e:
            logger.warning(f"[backfill] 采集 {cfg.label} 失败: {e}")
        await asyncio.sleep(8)  # 城市间冷却，避免京东限流
    for short_id, row in crawler._row_cache.items():
        long_id = str(row.get("productId") or "")
        if long_id:
            long2short[long_id] = str(short_id)
    logger.info(f"[backfill] 长→短映射: {len(long2short)} 条")
    return long2short


async def backfill():
    crawler = JDAuctionCrawler()
    parser = JDDetailParser()
    await browser_manager.start()
    db = await get_session()
    stats = {"updated": 0, "deleted_dup": 0, "no_short": 0, "api_empty": 0}
    try:
        long2short = await build_long_to_short_map(crawler)

        now = datetime.now()
        active = or_(Property.auction_start_time > now,
                     and_(Property.auction_start_time <= now,
                          Property.auction_end_time > now))
        rows = (await db.execute(
            select(Property).where(
                Property.auction_platform == "京东拍卖", active
            )
        )).scalars().all()

        # 已存在的短 id 集合（用于判定孪生重复）
        existing_short = set()
        for p in rows:
            idn = _id_in_url(p.source_url)
            if _is_short(idn):
                existing_short.add(idn)

        for p in rows:
            idn = _id_in_url(p.source_url)
            if _is_short(idn):
                continue  # 已是短 id，无需处理
            short_id = long2short.get(idn)
            if not short_id:
                stats["no_short"] += 1
                logger.info(f"  [skip] id={p.id} 长id={idn} 列表中无对应短id（可能刚结束）")
                continue
            # 孪生重复：已有短 id 记录 → 删除这条长 id 冗余
            if short_id in existing_short:
                stats["deleted_dup"] += 1
                logger.info(f"  [dup] id={p.id} 长id={idn} 已有短id={short_id} → 删除冗余")
                if COMMIT:
                    await db.delete(p)
                continue
            # 重抓：用短 id 调接口（含渲染面积）+ 解析 + 原地更新
            api = await crawler.fetch_detail_api(short_id)
            if not api:
                stats["api_empty"] += 1
                continue
            new_url = f"https://paimai.jd.com/{short_id}?itemId={short_id}"
            item = await parser.parse(api, new_url, p.city_id or 310000, extra={})
            p.source_url = new_url
            if item.starting_price:
                p.starting_price = item.starting_price
            if item.appraisal_price:
                p.appraisal_price = item.appraisal_price
            if item.deposit:
                p.deposit = item.deposit
            if item.increment_amount:
                p.increment_amount = item.increment_amount
            if item.area:
                p.area = item.area
            if item.starting_unit_price:
                p.starting_unit_price = item.starting_unit_price
            if item.court_discount_rate:
                p.court_discount_rate = item.court_discount_rate
            existing_short.add(short_id)
            stats["updated"] += 1
            logger.info(f"  [fix] id={p.id} → 短id={short_id} area={item.area} "
                        f"inc={item.increment_amount} start={item.starting_price}")

        if COMMIT:
            await db.commit()
            logger.info(f"[backfill] 已提交 {stats}")
        else:
            logger.info(f"[backfill] (dry-run) {stats}")
    finally:
        await db.close()
        await crawler.close()


asyncio.run(backfill())

