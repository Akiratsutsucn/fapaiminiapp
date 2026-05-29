"""Standalone async SQLAlchemy engine + session for the crawler.

Reuses the backend's Base so that all ORM models share a single metadata registry.
"""
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from ..config import settings
from app.core.database import Base  # noqa: E402 — shared Base from backend

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=False,  # disabled: aiomysql ping() signature incompatible with SQLAlchemy
    **(  # type: ignore[arg-type]
        {"connect_args": {"check_same_thread": False}} if settings.DB_TYPE == "sqlite" else {}
    ),
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    """Create a new async session for the crawler (not FastAPI DI)."""
    return async_session()


async def init_db() -> None:
    """Create all tables if they don't exist (idempotent)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
