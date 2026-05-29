"""一次性扫描 properties，从 title/description 中智能补全缺失字段。

用法：
    cd /opt/fapai && sudo -u www-data /opt/fapai/venv/bin/python -m scripts.backfill_extracted_fields

    --dry-run          只报告，不写库
    --limit N          只处理前 N 条
    --status STATUS    只处理某状态（默认所有上线状态）
    --force            即使字段已有值也尝试覆盖（慎用）
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
from crawler.cleaners.text_extractor import enrich_property  # noqa: E402


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="0=不限")
    parser.add_argument(
        "--status",
        default="visible",
        help='visible(默认 即将开拍/进行中/中止/撤回/已撤回) | all | 具体某个状态',
    )
    parser.add_argument("--force", action="store_true")
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

        # 统计每个字段被填充了多少
        field_stats: dict[str, int] = {}
        updated = 0

        for p in rows:
            updates = enrich_property(p)
            if args.force:
                # force 模式不限制原值是否有
                pass
            if not updates:
                continue
            for k in updates:
                field_stats[k] = field_stats.get(k, 0) + 1
            updated += 1
            if args.dry_run:
                logger.debug(f"[dry] P#{p.id} {p.title[:30] if p.title else ''}: {updates}")
            else:
                for k, v in updates.items():
                    setattr(p, k, v)

        if not args.dry_run:
            await db.commit()

        logger.info(f"\n=== 结果 ===")
        logger.info(f"扫描 {total}，更新 {updated} 套房源")
        logger.info(f"\n各字段补全数：")
        for k, v in sorted(field_stats.items(), key=lambda x: -x[1]):
            rate = v * 100 / total if total else 0
            logger.info(f"  {k:20s} {v:>5d}  ({rate:.0f}%)")

        if args.dry_run:
            logger.warning("** 这是 dry-run，未实际写库。加 --no-args 写入。 **")
    finally:
        await db.close()


if __name__ == "__main__":
    from crawler.utils.logger import setup_logger
    setup_logger("INFO")
    asyncio.run(main())
