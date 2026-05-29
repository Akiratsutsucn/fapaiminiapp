"""Async retry decorator with exponential backoff and jitter."""
import asyncio
import functools
import random
from typing import TypeVar, Callable
from loguru import logger

T = TypeVar("T")


def retry_on_failure(
    max_retries: int = 3,
    backoff_factor: float = 2.0,
    base_delay: float = 1.0,
    exceptions: tuple = (Exception,),
):
    """Async retry decorator with exponential backoff and ±25% jitter."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt < max_retries:
                        delay = base_delay * (backoff_factor ** (attempt - 1))
                        delay *= random.uniform(0.75, 1.25)
                        logger.warning(
                            f"{func.__name__} attempt {attempt}/{max_retries} failed: {e}. "
                            f"Retrying in {delay:.1f}s..."
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"{func.__name__} failed after {max_retries} attempts: {e}"
                        )
            raise last_exc  # type: ignore[misc]

        return wrapper

    return decorator
