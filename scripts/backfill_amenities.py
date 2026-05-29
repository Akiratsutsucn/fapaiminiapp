"""为所有上线 + 有经纬度 + 没缓存（或缓存过期）的房源批量预拉 POI。

用法：
    cd /opt/fapai && sudo -u www-data /opt/fapai/venv/bin/python -m scripts.backfill_amenities

    --status visible/all/即将开拍
    --limit N
    --dry-run
    --force        即使有缓存也重新查
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from loguru import logger  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.models.property import Property  # noqa: E402
from crawler.storage.db import get_session  # noqa: E402

AMAP_KEY = os.getenv("AMAP_API_KEY", "")

AMAP_CATEGORIES = {
    "school": ("学校", "141200|141201|141202|141203|141204"),
    "hospital": ("医院", "090100|090101|090102|090200|090300"),
    "transit": ("交通", "150500|150501"),
    "shopping": ("购物", "060100|060101|060102|060103|060400|060401|060402|060403"),
    "food": ("餐饮", "050000|050100|050101"),
    "bank": ("银行", "160100|160101|160102|160103|160104"),
}


async def fetch_amenities(client, lat: float, lng: float) -> dict:
    """对一个坐标查所有类别。"""
    out = {}
    for key, (name, types) in AMAP_CATEGORIES.items():
        try:
            resp = await client.get(
                "https://restapi.amap.com/v3/place/around",
                params={
                    "key": AMAP_KEY,
                    "location": f"{lng},{lat}",
                    "radius": 2000,
                    "types": types,
                    "offset": 10,
                    "page": 1,
                    "extensions": "base",
                },
                timeout=10,
            )
            data = resp.json()
            if data.get("status") == "1" and data.get("pois"):
                out[key] = [
                    {
                        "name": p.get("name", ""),
                        "address": p.get("address", ""),
                        "distance": int(p.get("distance", 0)),
                        "type": p.get("type", ""),
                    }
                    for p in data["pois"]
                ]
        except Exception as e:
            logger.warning(f"Amap POI {key} 失败: {e}")
        await asyncio.sleep(0.3)  # 限速
    return out


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--status", default="visible")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not AMAP_KEY:
        logger.error("环境变量 AMAP_API_KEY 未配置")
        return

    db = await get_session()
    try:
        q = select(Property).where(Property.lat.isnot(None), Property.lng.isnot(None))
        if args.status == "visible":
            q = q.where(Property.auction_status.in_(
                ["即将开拍", "进行中", "中止", "撤回", "已撤回"]
            ))
        elif args.status != "all":
            q = q.where(Property.auction_status == args.status)

        if not args.force:
            cutoff = datetime.now() - timedelta(days=30)
            q = q.where(
                (Property.amenities_cache.is_(None))
                | (Property.amenities_updated_at.is_(None))
                | (Property.amenities_updated_at < cutoff)
            )

        if args.limit > 0:
            q = q.limit(args.limit)

        rows = (await db.execute(q)).scalars().all()
        logger.info(f"待处理: {len(rows)} 套")

        if args.dry_run:
            for p in rows[:5]:
                logger.info(f"[dry] P#{p.id} ({p.lat}, {p.lng})")
            return

        import httpx
        async with httpx.AsyncClient() as client:
            done = 0
            for p in rows:
                try:
                    amen = await fetch_amenities(client, p.lat, p.lng)
                    p.amenities_cache = amen
                    p.amenities_updated_at = datetime.now()
                    await db.commit()
                    done += 1
                    cats = ", ".join([f"{k}={len(v)}" for k, v in amen.items()])
                    logger.info(f"P#{p.id} → {cats}")
                except Exception as e:
                    logger.error(f"P#{p.id} 失败: {e}")
                # 每个房源 6 次 POI 查询，~ 2 秒；额外间隔 0.5 秒
                await asyncio.sleep(0.5)

        logger.info(f"\n=== 完成: {done}/{len(rows)} ===")
    finally:
        await db.close()


if __name__ == "__main__":
    from crawler.utils.logger import setup_logger
    setup_logger("INFO")
    asyncio.run(main())
