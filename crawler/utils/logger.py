"""Loguru-based logging configuration."""
import sys
from pathlib import Path
from loguru import logger

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"


def setup_logger(level: str = "INFO") -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    logger.remove()

    # console: colored, INFO+
    logger.add(
        sys.stderr,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        ),
        level=level,
        colorize=True,
    )

    # file: all levels, daily rotation, 30 days retention
    logger.add(
        LOG_DIR / "crawler_{time:YYYY-MM-DD}.log",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
        level="DEBUG",
        rotation="00:00",
        retention="30 days",
        encoding="utf-8",
    )

    # error file
    logger.add(
        LOG_DIR / "crawler_error_{time:YYYY-MM-DD}.log",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
        level="ERROR",
        rotation="00:00",
        retention="30 days",
        encoding="utf-8",
    )

    logger.info(f"Logger initialized, logs -> {LOG_DIR}")
