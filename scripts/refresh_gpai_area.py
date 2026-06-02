"""重抓公拍网 area 异常的房源，修正面积（及顺带刷新 title/价格等整条字段）。

背景：gpai_detail 旧的面积正则要求「建筑面积：」带冒号，但公拍网正文多写
「房屋建筑面积为338.53平方米」，导致面积漏抓（=0）或误抓评估价万数（如 1768）。
解析器已修复（要求带单位、支持「为/：」分隔、排除地下/宗地面积）。本脚本对库里
area 异常的公拍网记录重抓详情页、重解析、整条 upsert 刷新。

异常判定：area=0 或 area≈评估价万数 或 area≈起拍价万数（典型误抓特征）。

用法（生产）：
    cd /opt/fapai
    # 先预览（只抓不写库）
    sudo -u www-data ./venv/bin/python -m scripts.refresh_gpai_area --status visible --dry-run
    # 实际刷新可参拍(即将开拍/进行中)，最稳：先小批
    sudo -u www-data ./venv/bin/python -m scripts.refresh_gpai_area --status visible
    # 全部异常记录
    sudo -u www-data ./venv/bin/python -m scripts.refresh_gpai_area --status all --limit 200
"""
import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from loguru import logger  # noqa: E402
from sqlalchemy import select, or_, and_  # noqa: E402

from app.models.property import Property  # noqa: E402
from crawler.storage.db import get_session  # noqa: E402
from crawler.platforms.gpai import GPaiCrawler  # noqa: E402
from crawler.parsers.gpai_detail import GPaiDetailParser  # noqa: E402
from crawler.storage.repository import PropertyRepository  # noqa: E402
from crawler.browser import browser_manager  # noqa: E402
from crawler.anti_crawl import random_sleep  # noqa: E402

CITY_ID_DEFAULT = 310000


def _anomaly_filter():
    """area 异常：=0/NULL，或约等于评估价/起拍价的万数（误抓特征）。"""
    return and_(
        Property.auction_platform == "公拍网",
        or_(
            Property.area == 0,
            Property.area.is_(None),
            and_(Property.appraisal_price > 0,
                 (Property.area - Property.appraisal_price / 10000).between(-1, 1)),
            and_(Property.starting_price > 0,
                 (Property.area - Property.starting_price / 10000).between(-1, 1)),
        ),
    )


async def run(status: str, limit: int, dry_run: bool) -> None:
    db = await get_session()
    conds = [_anomaly_filter()]
    if status == "visible":
        conds.append(Property.auction_status.in_(["即将开拍", "进行中"]))
    q = select(Property.id, Property.source_url, Property.area, Property.city_id).where(
        and_(*conds)
    ).limit(limit)
    rows = (await db.execute(q)).all()
    await db.close()

    print(f"待重抓：{len(rows)} 条（status={status}{'，dry-run' if dry_run else ''}）")
    if not rows:
        return

    await browser_manager.start()
    crawler = GPaiCrawler()
    parser = GPaiDetailParser()
    fixed = 0
    failed = 0
    try:
        for i, r in enumerate(rows, 1):
            url = r.source_url
            old_area = r.area
            try:
                html = await crawler.fetch_detail(url)
                item = await parser.parse(html, url, r.city_id or CITY_ID_DEFAULT)
                new_area = item.area
                print(f"[{i}/{len(rows)}] id={r.id} area {old_area} -> {new_area} | {item.title[:36]}")
                if not dry_run:
                    task_db = await get_session()
                    try:
                        await PropertyRepository.upsert(task_db, item)
                        await task_db.commit()
                    finally:
                        await task_db.close()
                if new_area and new_area > 0:
                    fixed += 1
            except Exception as e:
                failed += 1
                logger.warning(f"id={r.id} 重抓失败: {e}")
            await random_sleep(1.5, 3.0)  # 限速，避免撞风控
    finally:
        await crawler.close()
        await browser_manager.stop()

    print(f"\n完成：{'(dry-run 未写库) ' if dry_run else ''}成功解析出面积 {fixed} 条，失败 {failed} 条")


def main() -> None:
    ap = argparse.ArgumentParser(description="重抓公拍网 area 异常房源修正面积")
    ap.add_argument("--status", choices=["visible", "all"], default="visible",
                    help="visible=只修可参拍(即将开拍/进行中)，all=全部异常")
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--dry-run", action="store_true", help="只抓取预览，不写库")
    args = ap.parse_args()
    asyncio.run(run(args.status, args.limit, args.dry_run))


if __name__ == "__main__":
    main()
