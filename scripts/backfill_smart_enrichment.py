"""一次性扫描 properties，生成 tags + bargain_tagline。

用法：
    cd /opt/fapai && sudo -u www-data /opt/fapai/venv/bin/python -m scripts.backfill_smart_enrichment
    --status visible/all/即将开拍
    --dry-run
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
from sqlalchemy import select  # noqa: E402

from app.models.property import Property  # noqa: E402
from crawler.storage.db import get_session  # noqa: E402
from crawler.cleaners.smart_enrich import enrich_smart_fields  # noqa: E402


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--status", default="visible")
    args = parser.parse_args()

    db = await get_session()
    try:
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
        logger.info(f"扫描 {total} 个房源...")

        tagged = 0
        line = 0
        sample_tags = {}

        for p in rows:
            updates = enrich_smart_fields(p)
            if "tags" in updates:
                tagged += 1
                for t in updates["tags"]:
                    sample_tags[t] = sample_tags.get(t, 0) + 1
            if "bargain_tagline" in updates:
                line += 1

            if args.dry_run:
                if updates.get("tags") or updates.get("bargain_tagline"):
                    logger.debug(
                        f"[dry] P#{p.id} {(p.title or '')[:30]}: "
                        f"tags={updates.get('tags')} | line={updates.get('bargain_tagline')}"
                    )
            else:
                for k, v in updates.items():
                    setattr(p, k, v)

        if not args.dry_run:
            await db.commit()

        logger.info(f"\n=== 结果 ===")
        logger.info(f"  扫描 {total}")
        logger.info(f"  生成 tags: {tagged}")
        logger.info(f"  生成爆款文案: {line}")
        logger.info(f"\n标签 TOP 20：")
        for t, c in sorted(sample_tags.items(), key=lambda x: -x[1])[:20]:
            logger.info(f"  {t:16s} {c}")

        if args.dry_run:
            logger.warning("** dry-run 模式，未实际写库 **")
    finally:
        await db.close()


if __name__ == "__main__":
    from crawler.utils.logger import setup_logger
    setup_logger("INFO")
    asyncio.run(main())
