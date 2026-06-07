"""Async SQLAlchemy engine, session factory, and declarative Base for the FastAPI backend."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=False,
    # MySQL 会按 wait_timeout 单方面掐断空闲连接，池中陈旧连接被取用时报
    # 2013 Lost connection，表现为前端「请求失败」随机高发。pre_ping 因 aiomysql
    # ping() 签名不兼容不可用，改用 pool_recycle：连接存活超 1 小时即回收重建。
    pool_recycle=3600,
    pool_timeout=30,
    **(
        {"connect_args": {"check_same_thread": False}} if settings.DB_TYPE == "sqlite" else {}
    ),
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncSession:
    """FastAPI dependency: yield an async session per request."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables if they don't exist, then seed default admin user."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default admin user
    async with async_session() as session:
        from .security import pwd_context
        from ..models.user import User  # noqa: F811
        result = await session.execute(select(User).where(User.nickname == "admin"))
        if not result.scalar_one_or_none():
            session.add(User(
                openid="admin_seed",
                nickname="admin",
                role="admin",
                password_hash=pwd_context.hash("admin123"),
            ))
            await session.commit()
