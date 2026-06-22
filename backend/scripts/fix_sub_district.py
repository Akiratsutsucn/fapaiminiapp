"""商圈板块数据治理脚本:
  A. 清洗存量脏板块值(剔除「市/区/县」行政前缀,如「市松江区泗泾镇」→「泗泾镇」;
     无法清洗成有效板块名的垃圾值如「宁波市镇」→ 置空)。
  B. 对缺板块的房源,从 title 重新提取板块名(用修正后的 extract_sub_district)。

默认 dry-run(只报告不写库),加 --commit 落库。
用法:
    cd /opt/fapai && /opt/fapai/venv/bin/python -m backend.scripts.fix_sub_district          # dry-run
    cd /opt/fapai && /opt/fapai/venv/bin/python -m backend.scripts.fix_sub_district --commit  # 落库
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
from crawler.storage.db import get_session  # noqa: E402
from crawler.cleaners.text_extractor import clean_sub_district, extract_sub_district  # noqa: E402


async def main():
    ap = argparse.ArgumentParser(description="商圈板块数据治理:清洗脏值 + 重提取")
    ap.add_argument("--commit", action="store_true", help="实际写库(默认 dry-run)")
    args = ap.parse_args()

    db = await get_session()
    cleaned = 0      # 清洗脏值(改成更干净的板块名)
    nulled = 0       # 垃圾值置空
    extracted = 0    # 缺板块的重新提取补上
    try:
        rows = (await db.execute(
            select(Property).where(Property.is_deleted == 0)
        )).scalars().all()
        logger.info(f"扫描 {len(rows)} 条未删除房源")

        for p in rows:
            old = (p.sub_district or "").strip()
            if old:
                # A. 已有值 → 清洗
                new = clean_sub_district(old)
                if new != old:
                    if new is None:
                        p.sub_district = None
                        nulled += 1
                        logger.info(f"[置空] id={p.id} {old!r} → None")
                    else:
                        p.sub_district = new
                        cleaned += 1
                        logger.info(f"[清洗] id={p.id} {old!r} → {new!r}")
            else:
                # B. 缺值 → 从 title 重新提取
                sd = extract_sub_district(p.title or "")
                if sd:
                    p.sub_district = sd
                    extracted += 1
                    logger.info(f"[补全] id={p.id} 从标题提取 → {sd!r}")

        logger.info(f"清洗 {cleaned} 条 / 置空 {nulled} 条 / 补全 {extracted} 条")
        if args.commit:
            await db.commit()
            logger.success("已写库")
        else:
            logger.warning("** dry-run:未写库,加 --commit 落库 **")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
