"""FastAPI application entry point."""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .core.config import settings
from .core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    # 启动数据审核调度器（后台任务）
    audit_task = None
    if settings.ENABLE_AUDIT_SCHEDULER:
        from .services.audit_scheduler import start_audit_scheduler
        audit_task = asyncio.create_task(start_audit_scheduler())
        logger.info("数据审核调度器已启动")

    yield

    # 关闭调度器
    if audit_task:
        audit_task.cancel()
        try:
            await audit_task
        except asyncio.CancelledError:
            logger.info("数据审核调度器已停止")


app = FastAPI(
    title=settings.APP_NAME,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from .api.v1 import router as v1_router  # noqa: E402
from .api.admin import router as admin_router  # noqa: E402

app.include_router(v1_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/admin")


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
