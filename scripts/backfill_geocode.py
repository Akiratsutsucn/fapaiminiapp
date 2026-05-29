"""一次性脚本：给所有缺 lat/lng 但有 address 的房源批量补全坐标。

用法：
    cd /opt/fapai && /opt/fapai/venv/bin/python -m scripts.backfill_geocode \
        [--limit 1500] [--batch 30] [--dry-run] [--qps 4]

注意：
- 高德个人免费 key 限 5000 次/天，QPS 限 4-5（个人）/ 50（企业）
- 默认每批 30 条，每条间隔 0.25s（≈ 4 QPS）
- 失败的不会重复——下次再跑会跳过已成功的
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

# 让脚本能从 /opt/fapai 启动时正确加载 backend 和 crawler 模块
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# 让 crawler.pipelines 模块导入到位
os.environ.setdefault("BACKFILL_MODE", "1")

from sqlalchemy import select, or_, update  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402
from loguru import logger  # noqa: E402

from app.core.database import async_session  # noqa: E402
from app.models.property import Property  # noqa: E402
from crawler.pipelines.geocoder import geocode_property  # noqa: E402


async def backfill(limit: int, batch_size: int, qps: float, dry_run: bool):
    delay = max(0.05, 1.0 / qps) if qps > 0 else 0.25
    logger.info(f"[backfill] start limit={limit} batch={batch_size} delay={delay:.3f}s dry_run={dry_run}")

    async with async_session() as db:  # type: AsyncSession
        # 取所有缺坐标但有地址的房源
        result = await db.execute(
            select(Property.id, Property.address, Property.city_id, Property.province_city)
            .where(
                or_(Property.lat.is_(None), Property.lng.is_(None)),
                Property.address.isnot(None),
                Property.address != "",
            )
            .limit(limit)
        )
        rows = result.all()

    total = len(rows)
    logger.info(f"[backfill] candidates: {total}")

    if total == 0:
        logger.info("[backfill] nothing to do")
        return

    success = 0
    skipped = 0
    failed = 0

    # 分批处理，每批共用一个 db session
    for batch_start in range(0, total, batch_size):
        batch = rows[batch_start: batch_start + batch_size]
        async with async_session() as db:
            for row in batch:
                addr = (row.address or "").strip()
                if not addr or len(addr) < 5:
                    skipped += 1
                    continue
                geo = await geocode_property(row.id, addr, row.city_id or 310000, row.province_city or "")
                if not geo:
                    failed += 1
                    await asyncio.sleep(delay)
                    continue
                lat, lng = geo
                if not dry_run:
                    await db.execute(
                        update(Property).where(Property.id == row.id).values(lat=lat, lng=lng)
                    )
                success += 1
                await asyncio.sleep(delay)
            if not dry_run:
                await db.commit()
        logger.info(f"[backfill] batch {batch_start}..{batch_start+len(batch)}: success={success} failed={failed} skipped={skipped}")

    logger.info(f"[backfill] done success={success} failed={failed} skipped={skipped} total={total}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=1500)
    p.add_argument("--batch", type=int, default=30)
    p.add_argument("--qps", type=float, default=4.0)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    asyncio.run(backfill(args.limit, args.batch, args.qps, args.dry_run))


if __name__ == "__main__":
    main()
