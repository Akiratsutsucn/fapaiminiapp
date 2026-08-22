"""回填已成交房源的真实成交时间 deal_date（用户 2026-08-04 要求）。

口径：
- deal_date = 真实成交时间，区别于 auction_end_time（拍卖前预估结束日，到期不一定成交）。
- 京东：直接用 online_auction_end_time（成交确认书 PDF 内的"网拍结束时间"，真成交后才有，
  即真实成交时刻）回填，覆盖 2080 条，无需重抓。
- 公拍网/阿里：成交确认书时间未存，需按本脚本 --refetch 重抓详情解析（公拍网正文
  「成交日期：…」、阿里 initData 成交时间字段）。凭据恢复后执行。

用法：
  python -m crawler.backfill_deal_date            # 仅京东直接回填（安全，纯SQL）
  python -m crawler.backfill_deal_date --commit   # 真正写库（默认 dry-run 只统计）
"""
import asyncio
import sys

from sqlalchemy import select, update

from crawler.storage.db import get_session
from app.models.property import Property

COMMIT = "--commit" in sys.argv


async def backfill_jd() -> None:
    """京东：online_auction_end_time → deal_date（真成交确认书时间）。"""
    db = await get_session()
    try:
        q = select(Property.id).where(
            Property.is_deleted == 0,
            Property.auction_status == "已成交",
            Property.deal_date.is_(None),
            Property.online_auction_end_time.isnot(None),
        )
        ids = [r[0] for r in (await db.execute(q)).all()]
        print(f"[京东等] 可用成交确认书时间回填 deal_date 的房源: {len(ids)} 条 commit={COMMIT}", flush=True)
        if COMMIT and ids:
            await db.execute(
                update(Property)
                .where(Property.id.in_(ids))
                .values(deal_date=Property.online_auction_end_time)
            )
            await db.commit()
            print(f"[回填完成] 已写入 deal_date {len(ids)} 条", flush=True)
    finally:
        await db.close()


async def main() -> None:
    await backfill_jd()


if __name__ == "__main__":
    asyncio.run(main())
