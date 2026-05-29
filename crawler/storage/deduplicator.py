"""Two-level URL deduplication: in-memory set + database check with stale re-fetch."""
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from .repository import PropertyRepository


class Deduplicator:
    """Manages deduplication of detail page URLs during a crawl run."""

    def __init__(self, stale_hours: int = 24):
        self._seen: set[str] = set()
        self._relisted: list[dict] = []  # URLs that reappeared after being marked ended
        self._stale_hours = stale_hours

    def add(self, url: str) -> None:
        self._seen.add(url)

    def has(self, url: str) -> bool:
        return url in self._seen

    @property
    def count(self) -> int:
        return len(self._seen)

    @property
    def relisted_count(self) -> int:
        return len(self._relisted)

    def clear(self) -> None:
        self._seen.clear()
        self._relisted.clear()

    async def should_fetch(
        self, db: AsyncSession, url: str, force_refresh: bool = False
    ) -> tuple[bool, str]:
        """Determine whether a detail URL needs to be fetched.

        Returns: (should_fetch: bool, reason: str)
          - "new": never seen before
          - "duplicate_in_memory": already seen in this run
          - "duplicate_in_db": already exists in DB and is fresh (skip)
          - "stale_refresh": exists in DB but stale, re-fetch for updates
          - "relisted": was marked ended but reappeared in listings
          - "force_refresh": exists but force_refresh is True
        """
        if self.has(url):
            return False, "duplicate_in_memory"

        self.add(url)

        record = await PropertyRepository.get_by_url(db, url)
        if not record:
            return True, "new"

        existing_id, status, updated_at = record

        if force_refresh:
            return True, "force_refresh"

        # Re-listing detection: property was marked ended but reappeared
        if status in ("已结束", "已成交", "中止", "撤回"):
            self._relisted.append({"id": existing_id, "source_url": url, "old_status": status})
            logger.info(f"Re-listed property detected: id={existing_id}, was '{status}', url={url[:80]}")
            return True, "relisted"

        # Stale re-fetch: record hasn't been updated in stale_hours
        if updated_at and self._stale_hours > 0:
            age = datetime.now() - updated_at
            if age > timedelta(hours=self._stale_hours):
                logger.debug(f"Stale record id={existing_id}, age={age}, re-fetching")
                return True, "stale_refresh"

        return False, "duplicate_in_db"
