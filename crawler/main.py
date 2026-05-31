#!/usr/bin/env python3
"""CLI entry point for the judicial auction data crawler.

Usage:
    # Full crawl (all platforms, both cities)
    python -m crawler.main

    # Platform-specific
    python -m crawler.main --source taobao
    python -m crawler.main --source jd
    python -m crawler.main --source gpai

    # City-specific
    python -m crawler.main --city 上海
    python -m crawler.main --city 宁波
    python -m crawler.main --city 杭州

    # Combined
    python -m crawler.main --source taobao --city 上海

    # With task ID (from admin backend trigger)
    python -m crawler.main --task-id 1

    # Limited test run
    python -m crawler.main --source taobao --city 上海 --max-pages 2
    python -m crawler.main --max-items 10

    # Force re-fetch all (skip dedup)
    python -m crawler.main --force-refresh

    # Run scheduler (daily auto-run)
    python -m crawler.main --schedule
"""
import argparse
import asyncio
import sys
from pathlib import Path

# Ensure the backend is importable
BACKEND_ROOT = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from crawler.config import settings
from crawler.engine import CrawlEngine
from crawler.utils.logger import setup_logger
from loguru import logger


PLATFORM_MAP = {
    "taobao": "阿里拍卖",
    "jd": "京东拍卖",
    "gpai": "公拍网",
    "ali": "阿里拍卖",
    "jingdong": "京东拍卖",
    "gongpai": "公拍网",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="法拍房数据爬虫 - Judicial Auction Property Data Crawler",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m crawler.main                                    # Full crawl
  python -m crawler.main --source taobao --city 上海        # Shanghai Taobao only
  python -m crawler.main --source jd --max-pages 5          # JD, max 5 pages
  python -m crawler.main --task-id 1                        # Run as task #1
  python -m crawler.main --schedule                         # Start daily scheduler
        """,
    )
    parser.add_argument(
        "--source", "-s",
        choices=["taobao", "jd", "gpai", "ali", "jingdong", "gongpai"],
        help="Target platform (default: all)",
    )
    parser.add_argument(
        "--city", "-c",
        choices=["上海", "宁波", "杭州"],
        help="Target city (default: all)",
    )
    parser.add_argument(
        "--max-pages", type=int, default=50,
        help="Max list pages per source URL (default: 50)",
    )
    parser.add_argument(
        "--max-items", type=int, default=0,
        help="Max detail items to fetch (0 = unlimited)",
    )
    parser.add_argument(
        "--task-id", type=int, default=None,
        help="CrawlTask ID from admin backend (for triggered runs)",
    )
    parser.add_argument(
        "--force-refresh", action="store_true",
        help="Skip dedup, re-fetch and update all listings",
    )
    parser.add_argument(
        "--no-headless", action="store_true",
        help="Show browser window (disable headless mode)",
    )
    parser.add_argument(
        "--schedule", action="store_true",
        help="Start APScheduler for daily automatic execution",
    )
    parser.add_argument(
        "--log-level", default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Log level (default: INFO)",
    )
    return parser.parse_args()


async def async_main(args: argparse.Namespace) -> None:
    setup_logger(args.log_level)

    if args.no_headless:
        settings.PLAYWRIGHT_HEADLESS = False

    if args.max_items > 0:
        settings.MAX_DETAIL_ITEMS = args.max_items

    if args.schedule:
        await _run_scheduler()
        return

    platform = PLATFORM_MAP.get(args.source) if args.source else None

    # 若是 systemd-timer / 手工命令行触发（无 task_id），自动 create 一条 task 记录
    # 这样管理后台「爬虫管理 → 历史记录」也能看到自动跑的结果
    task_id = args.task_id
    if task_id is None:
        try:
            from crawler.storage.db import get_session
            from crawler.storage.repository import CrawlTaskRepository
            db = await get_session()
            try:
                task = await CrawlTaskRepository.create_auto_task(
                    db, platform=platform, city=args.city
                )
                task_id = task.id
                logger.info(f"自动创建 CrawlTask #{task_id}（systemd-timer）")
            finally:
                await db.close()
        except Exception as e:
            logger.warning(f"自动创建 CrawlTask 失败：{e}（爬虫继续运行，但本次不会有后台记录）")

    engine = CrawlEngine(task_id=task_id)
    await engine.run(
        platform=platform,
        city=args.city,
        max_pages=args.max_pages,
        force_refresh=args.force_refresh,
    )


async def _run_scheduler() -> None:
    """Start the daily scheduler."""
    from crawler.scheduler import setup_scheduler, start_scheduler

    logger = __import__("loguru").logger
    logger.info(f"Starting scheduler with cron: {settings.DAILY_CRON}")
    setup_scheduler()
    start_scheduler()

    # Keep running until interrupted
    try:
        while True:
            await asyncio.sleep(60)
    except KeyboardInterrupt:
        logger.info("Scheduler stopped by user")


def main() -> None:
    args = parse_args()
    asyncio.run(async_main(args))


if __name__ == "__main__":
    main()
