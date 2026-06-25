"""存量保证金/加价/正文补抓:对阿里在拍但 deposit=0 的房源,重抓 SSR 补全
deposit、increment_amount、description、area 等 SSR 才有的深度字段。

根因:SSR 限额导致大量在拍房源走列表兜底入库,而列表数据无保证金(foregiftPrice),
故 deposit=0。SSR 实抓证明这些字段在详情页是有的。本脚本逐条重抓补全。

控速:每条间隔 2-4s + 复用爬虫的熔断/换IP逻辑,避免触发风控。
默认 dry-run,加 --commit 落库。可用 --limit N 限制条数先小批验证。
    cd /opt/fapai && /opt/fapai/venv/bin/python -m backend.scripts.backfill_deposit --limit 20            # dry-run小批
    cd /opt/fapai && /opt/fapai/venv/bin/python -m backend.scripts.backfill_deposit --commit             # 全量落库
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from loguru import logger  # noqa: E402
from sqlalchemy import select, and_, or_  # noqa: E402

from app.models.property import Property  # noqa: E402
from crawler.storage.db import get_session, engine  # noqa: E402
from crawler.browser import browser_manager  # noqa: E402
from crawler.platforms.taobao_paimai import TaobaoPaiMaiCrawler  # noqa: E402
from crawler.parsers.taobao_paimai_detail import TaobaoPaiMaiDetailParser  # noqa: E402

CITY_OF = {"上海市": 310000, "宁波市": 330200, "杭州市": 330100}

def _city_id_of(p: Property) -> int:
    return p.city_id or 310000


async def main():
    ap = argparse.ArgumentParser(description="存量保证金/加价/正文补抓(阿里在拍 deposit=0)")
    ap.add_argument("--commit", action="store_true", help="实际写库(默认 dry-run)")
    ap.add_argument("--limit", type=int, default=0, help="最多处理条数(0=全部),先小批验证用")
    args = ap.parse_args()

    db = await get_session()
    crawler = TaobaoPaiMaiCrawler()
    parser = TaobaoPaiMaiDetailParser()

    scanned = filled = failed = 0
    try:
        await browser_manager.start()

        cond = and_(
            Property.is_deleted == 0,
            Property.auction_platform == "阿里拍卖",
            Property.auction_status.in_(["即将开拍", "进行中"]),
            or_(Property.deposit == 0, Property.deposit.is_(None)),
        )
        q = select(Property).where(cond)
        if args.limit:
            q = q.limit(args.limit)
        rows = (await db.execute(q)).scalars().all()
        logger.info(f"待补抓 {len(rows)} 条(阿里在拍 deposit=0)")

        for p in rows:
            scanned += 1
            m = re.search(r"itemId=(\d+)", p.source_url or "")
            if not m:
                continue
            item_id = m.group(1)
            try:
                api_data = await crawler.fetch_detail_api(item_id)
                if not api_data:
                    failed += 1
                    continue
                extra = {"area_text": "", "district": p.district or "", "address": ""}
                parsed = await parser.parse(api_data, p.source_url, _city_id_of(p), extra=extra)
            except Exception as e:
                failed += 1
                logger.warning(f"[补抓失败] id={p.id} {e}")
                await asyncio.sleep(2.5)
                continue

            # 仅在抓到新值时更新,不覆盖已有
            changed = []
            if parsed and parsed.deposit and parsed.deposit > 0 and not p.deposit:
                p.deposit = parsed.deposit
                changed.append(f"保证金={parsed.deposit}")
            if parsed and parsed.increment_amount and parsed.increment_amount > 0 and not p.increment_amount:
                p.increment_amount = parsed.increment_amount
                changed.append(f"加价={parsed.increment_amount}")
            if parsed and parsed.description and not (p.description or "").strip():
                p.description = parsed.description
                changed.append("正文")
            if parsed and getattr(parsed, "area", 0) and not p.area:
                p.area = parsed.area
                changed.append(f"面积={parsed.area}")

            if changed:
                filled += 1
                logger.info(f"[补全] id={p.id} {','.join(changed)} | {(p.title or '')[:28]}")
                if args.commit and filled % 20 == 0:
                    await db.commit()

            await asyncio.sleep(2.5)  # 控速防风控

        logger.info(f"扫描{scanned} 补全{filled} 失败{failed}")
        if args.commit:
            await db.commit()
            logger.success("已写库")
        else:
            logger.warning("** dry-run:未写库,加 --commit 落库 **")
    finally:
        try:
            await browser_manager.stop()
        except Exception:
            pass
        await db.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
