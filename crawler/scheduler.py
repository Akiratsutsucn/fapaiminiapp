"""APScheduler setup for daily automatic crawl execution."""
import asyncio
import sys
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

from .config import settings

# Ensure backend is importable for DB access
BACKEND_ROOT = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

scheduler = AsyncIOScheduler()


async def daily_crawl_job() -> None:
    """The daily scheduled crawl job — runs all platforms for both cities."""
    from .engine import CrawlEngine

    logger.info("=== Scheduled daily crawl starting ===")
    engine = CrawlEngine()
    try:
        await engine.run()
    except Exception as e:
        logger.error(f"Scheduled crawl failed: {e}")
    logger.info("=== Scheduled daily crawl finished ===")


def setup_scheduler(cron_expr: str | None = None) -> None:
    """Configure the APScheduler with the daily crawl job."""
    cron = cron_expr or settings.DAILY_CRON

    scheduler.add_job(
        daily_crawl_job,
        CronTrigger.from_crontab(cron),
        id="daily_crawl",
        name="Daily full crawl (all platforms, both cities)",
        replace_existing=True,
    )

    # Also schedule per-task cron jobs from DB
    scheduler.add_job(
        _sync_tasks_from_db,
        CronTrigger.from_crontab("0 */6 * * *"),  # every 6 hours
        id="sync_tasks",
        name="Sync crawl tasks from DB",
    )

    logger.info(f"Scheduler configured: daily crawl at '{cron}'")


def start_scheduler() -> None:
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")


async def trigger_manual_run(
    platform: str | None = None, city: str | None = None, task_id: int | None = None
) -> None:
    """Trigger an immediate crawl run (called from admin backend)."""
    from .engine import CrawlEngine

    engine = CrawlEngine(task_id=task_id)
    await engine.run(platform=platform, city=city)


async def _sync_tasks_from_db() -> None:
    """Periodically sync crawl tasks from DB to scheduler."""
    from .storage.db import get_session  # noqa: F811
    from .storage.repository import CrawlTaskRepository

    logger.debug("Syncing crawl tasks from DB...")
    try:
        db = await get_session()
        try:
            tasks = await CrawlTaskRepository.get_active_tasks(db)
        finally:
            await db.close()

        existing_jobs = {job.id for job in scheduler.get_jobs()}

        for task in tasks:
            job_id = f"task_{task.id}"
            if job_id in existing_jobs:
                continue

            if task.cron_expression:
                scheduler.add_job(
                    _run_db_task,
                    CronTrigger.from_crontab(task.cron_expression),
                    args=[task.id],
                    id=job_id,
                    name=f"Crawl task #{task.id}: {task.name or ''}",
                    replace_existing=True,
                )
                logger.info(f"Added scheduled job '{job_id}' from DB task: {task.cron_expression}")

        # Remove jobs for tasks no longer active
        active_ids = {f"task_{t.id}" for t in tasks}
        for job_id in existing_jobs:
            if job_id.startswith("task_") and job_id not in active_ids:
                scheduler.remove_job(job_id)
                logger.info(f"Removed stale job '{job_id}'")

    except Exception as e:
        logger.error(f"Failed to sync tasks from DB: {e}")


async def _run_db_task(task_id: int) -> None:
    """Execute a crawl task defined in the database."""
    from .engine import CrawlEngine

    logger.info(f"Running DB-scheduled crawl task #{task_id}")
    engine = CrawlEngine(task_id=task_id)
    try:
        await engine.run()
    except Exception as e:
        logger.error(f"DB task #{task_id} failed: {e}")
