"""存量房产类型修正:用标题强特征把误判为「住宅/其他」的商业房源改判「商业」。
复用 crawler.cleaners.text_extractor.refine_property_type(与爬虫源头同一逻辑)。
默认 dry-run,加 --commit 落库。
    cd /opt/fapai && /opt/fapai/venv/bin/python -m backend.scripts.fix_property_type          # dry-run
    cd /opt/fapai && /opt/fapai/venv/bin/python -m backend.scripts.fix_property_type --commit  # 落库
"""
import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from loguru import logger  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.models.property import Property  # noqa: E402
from crawler.storage.db import get_session, engine  # noqa: E402
from crawler.cleaners.text_extractor import refine_property_type  # noqa: E402


async def main():
    ap = argparse.ArgumentParser(description="存量房产类型修正(误判住宅→商业)")
    ap.add_argument("--commit", action="store_true", help="实际写库(默认 dry-run)")
    args = ap.parse_args()

    db = await get_session()
    fixed = 0
    try:
        rows = (await db.execute(
            select(Property).where(
                Property.is_deleted == 0,
                Property.property_type.in_(["住宅", "其他"]),
            )
        )).scalars().all()
        logger.info(f"扫描 {len(rows)} 条住宅/其他房源")

        for p in rows:
            new = refine_property_type(p.property_type, p.title or "")
            if new != p.property_type:
                logger.info(f"[修正] id={p.id} {p.property_type}→{new} | {(p.title or '')[:32]}")
                p.property_type = new
                fixed += 1

        logger.info(f"将修正 {fixed} 条")
        if args.commit:
            await db.commit()
            logger.success("已写库")
        else:
            logger.warning("** dry-run:未写库,加 --commit 落库 **")
    finally:
        await db.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
