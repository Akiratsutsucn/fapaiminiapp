"""端到端验证 72h 窗口的 SQL 条件（用 SQLite 内存库）。

无需外部 DB，可直接运行：
    PYTHONPATH=backend python -m tests.test_recent_window_e2e
"""
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession  # noqa: E402

from app.core.database import Base  # noqa: E402
from app.models.property import Property  # noqa: E402
from app.core.auction_status import mobile_listable_sql  # noqa: E402

_NOW = datetime(2026, 6, 11, 12, 0)
_H = timedelta(hours=1)


async def _run():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    rows = [
        # (title, status, start, end, 期望进入列表?)
        ("即将开拍", "即将开拍", _NOW + 2 * _H, _NOW + 5 * _H, True),
        ("进行中", "进行中", _NOW - 2 * _H, _NOW + 2 * _H, True),
        ("71h前成交", "已成交", _NOW - 71 * _H, _NOW - 71 * _H, True),
        ("50h前流拍", "流拍", _NOW - 50 * _H, _NOW - 50 * _H, True),
        ("73h前成交", "已成交", _NOW - 73 * _H, _NOW - 73 * _H, False),
        ("成交缺end", "已成交", None, None, False),
    ]
    async with AsyncSession(engine) as db:
        for i, (title, st, s, e, _) in enumerate(rows, 1):
            db.add(Property(
                id=i, title=title, city_id=310000, auction_status=st,
                auction_start_time=s, auction_end_time=e,
                source_url=f"https://example.com/p/{i}",  # unique，nullable=False 必填
            ))
        await db.commit()

        q = select(Property.title).where(mobile_listable_sql(now=_NOW))
        visible = {r[0] for r in (await db.execute(q)).all()}

    await engine.dispose()

    expected = {title for (title, *_rest, ok) in rows if ok}
    assert visible == expected, f"窗口结果不符：得到 {visible}，期望 {expected}"
    print(f"72h窗口端到端验证通过：列表可见 {sorted(visible)}")


def test_recent_window_e2e():
    asyncio.run(_run())


if __name__ == "__main__":
    test_recent_window_e2e()
