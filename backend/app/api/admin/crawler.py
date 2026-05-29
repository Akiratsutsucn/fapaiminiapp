"""Admin crawler management routes."""
import asyncio
import os
import subprocess
import sys
import threading
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from ...core.database import get_session
from ...core.security import get_admin_user
from ...models.crawl import CrawlTask

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent


def _get_venv_python() -> str:
    """Find the venv python path (same venv as the running backend)."""
    venv_dir = Path(sys.executable).parent
    python_exe = venv_dir / "python"
    if python_exe.exists():
        return str(python_exe)
    return sys.executable


def _run_crawl_task_sync(task_id: int, platform: str | None, city: str | None) -> None:
    """Run crawler as a subprocess (blocking, called from background thread)."""
    cmd = [
        _get_venv_python(), "-m", "crawler.main",
        "--task-id", str(task_id),
        "--max-pages", "5",
    ]
    if platform:
        platform_map = {"阿里拍卖": "taobao", "京东拍卖": "jd", "公拍网": "gpai"}
        cmd += ["--source", platform_map.get(platform, platform)]
    if city:
        cmd += ["--city", city]

    logger.info(f"Starting crawl subprocess (task #{task_id}): {' '.join(cmd)}")
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            timeout=1800,  # 30 min max
        )
        if proc.returncode != 0:
            stderr_text = proc.stderr.decode(errors="replace")
            # Log first 2000 chars (actual error), not just tail (cleanup noise)
            logger.error(f"Crawl task #{task_id} failed (rc={proc.returncode}): {stderr_text[:2000]}")
        else:
            logger.info(f"Crawl task #{task_id} completed successfully")
    except subprocess.TimeoutExpired:
        logger.error(f"Crawl task #{task_id} timed out after 30 minutes")
    except Exception as e:
        logger.error(f"Crawl task #{task_id} exception: {e}")


@router.get("/tasks")
async def list_tasks(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    rows = (await db.execute(
        select(CrawlTask).order_by(CrawlTask.created_at.desc()).limit(50)
    )).scalars().all()
    return [{
        "id": t.id, "platform": t.platform, "city": t.city,
        "status": t.status, "total_count": t.total_count,
        "success_count": t.success_count, "error_message": t.error_message,
        "new_count": t.new_count, "updated_count": t.updated_count,
        "stats_summary": t.stats_summary,
        "cron_expression": t.cron_expression,
        "last_run_at": str(t.last_run_at) if t.last_run_at else None,
        "created_at": str(t.created_at),
    } for t in rows]


@router.post("/trigger")
async def trigger_crawl(
    body: dict | None = None,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    platform = body.get("platform") if body else None
    city = body.get("city") if body else None

    task = CrawlTask(
        platform=platform, city=city, status="pending",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # Launch crawler in background thread (detached from request lifecycle)
    thread = threading.Thread(
        target=_run_crawl_task_sync,
        args=(task.id, platform, city),
        daemon=True,
    )
    thread.start()

    return {"message": "爬取任务已创建", "task_id": task.id}


@router.get("/status")
async def crawler_status(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    latest = (await db.execute(
        select(CrawlTask).order_by(CrawlTask.created_at.desc()).limit(1)
    )).scalar_one_or_none()

    running = (await db.execute(
        select(func.count(CrawlTask.id)).where(CrawlTask.status == "running")
    )).scalar() or 0

    return {
        "last_run_at": str(latest.last_run_at) if latest and latest.last_run_at else None,
        "last_status": latest.status if latest else "unknown",
        "is_running": running > 0,
    }
