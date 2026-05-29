"""Repository layer for database CRUD operations."""
from datetime import datetime
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.mysql import insert as mysql_insert
from loguru import logger

from ..models.item import AuctionItem

# Reuse the backend's ORM models by importing from the backend package
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.property import Property, PropertyImage  # noqa: E402
from app.models.crawl import CrawlTask, CrawlRecord  # noqa: E402


class PropertyRepository:
    """CRUD for properties table."""

    @staticmethod
    async def exists_by_url(db: AsyncSession, source_url: str) -> int | None:
        """Return property_id if URL exists, else None."""
        result = await db.execute(
            select(Property.id).where(Property.source_url == source_url)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_url(db: AsyncSession, source_url: str) -> tuple[int, str, datetime] | None:
        """Return (id, auction_status, updated_at) for a URL, or None."""
        result = await db.execute(
            select(Property.id, Property.auction_status, Property.updated_at).where(
                Property.source_url == source_url
            )
        )
        row = result.one_or_none()
        return (row.id, row.auction_status, row.updated_at) if row else None

    @staticmethod
    async def get_snapshot(
        db: AsyncSession, platform: str | None = None
    ) -> dict[str, dict]:
        """Get a snapshot of existing URLs with key fields for diff comparison.

        Returns: {source_url: {id, source_updated_at, auction_status, starting_price}}
        """
        q = select(
            Property.id,
            Property.source_url,
            Property.source_updated_at,
            Property.auction_status,
            Property.starting_price,
            Property.appraisal_price,
            Property.auction_round,
        )
        if platform:
            q = q.where(Property.auction_platform == platform)
        result = await db.execute(q)
        rows = result.all()
        return {
            row.source_url: {
                "id": row.id,
                "source_updated_at": row.source_updated_at,
                "auction_status": row.auction_status,
                "starting_price": row.starting_price,
                "appraisal_price": row.appraisal_price,
                "auction_round": row.auction_round,
            }
            for row in rows
            if row.source_url
        }

    @staticmethod
    async def upsert(db: AsyncSession, item: AuctionItem) -> tuple[int, str]:
        """Insert or update a property row by source_url. Returns (property_id, action)."""
        existing_id = await PropertyRepository.exists_by_url(db, item.source_url)

        if existing_id:
            # Update existing
            update_data = {
                k: v
                for k, v in item.__dict__.items()
                if k not in ("image_urls",)
                and v is not None
            }
            update_data["updated_at"] = datetime.now()

            await db.execute(
                update(Property).where(Property.id == existing_id).values(**update_data)
            )
            await db.flush()
            return existing_id, "updated"
        else:
            # Insert new
            prop_data = {
                k: v
                for k, v in item.__dict__.items()
                if k not in ("image_urls",)
            }
            prop = Property(**prop_data)
            db.add(prop)
            await db.flush()
            return prop.id, "created"  # type: ignore[return-value]

    @staticmethod
    async def mark_as_ended(
        db: AsyncSession, property_id: int
    ) -> None:
        """Mark a property auction as ended."""
        await db.execute(
            update(Property)
            .where(Property.id == property_id)
            .values(auction_status="已结束", updated_at=datetime.now())
        )

    @staticmethod
    async def find_stale_urls(
        db: AsyncSession, current_urls: set[str], platform: str
    ) -> list[dict]:
        """Find URLs in DB but not in current crawl results for a platform."""
        result = await db.execute(
            select(Property.id, Property.source_url, Property.auction_status).where(
                Property.auction_platform == platform,
                Property.source_url.notin_(current_urls),
                Property.auction_status.in_(["即将开拍", "进行中"]),
            )
        )
        return [
            {"id": r.id, "source_url": r.source_url, "auction_status": r.auction_status}
            for r in result.all()
        ]


class PropertyImageRepository:
    """CRUD for property_images table."""

    @staticmethod
    async def batch_upsert(
        db: AsyncSession, property_id: int, images: list[dict]
    ) -> None:
        """Replace all images for a property. Each image dict: {image_url, thumb_url?, sort_order?, is_cover?}."""
        if not images:
            return

        # Delete existing images
        await db.execute(
            delete(PropertyImage).where(PropertyImage.property_id == property_id)
        )

        # Insert new images
        for i, img in enumerate(images):
            if isinstance(img, str):
                url, thumb = img, None
            else:
                url = img.get("image_url", "")
                thumb = img.get("thumb_url")

            if not url:
                continue

            db.add(PropertyImage(
                property_id=property_id,
                image_url=url,
                thumb_url=thumb,
                sort_order=img.get("sort_order", i) if isinstance(img, dict) else i,
                is_cover=img.get("is_cover", i == 0) if isinstance(img, dict) else (i == 0),
            ))

        await db.flush()


class CrawlRecordRepository:
    """CRUD for crawl_records table."""

    @staticmethod
    async def create(
        db: AsyncSession,
        task_id: int | None,
        property_id: int | None,
        status: str,
        source_url: str,
        raw_data: dict | None = None,
        error_message: str | None = None,
    ) -> CrawlRecord:
        record = CrawlRecord(
            task_id=task_id,
            property_id=property_id,
            status=status,
            source_url=source_url,
            raw_data=raw_data,
            error_message=error_message,
        )
        db.add(record)
        await db.flush()
        return record


class CrawlTaskRepository:
    """CRUD for crawl_tasks table."""

    @staticmethod
    async def get_by_id(db: AsyncSession, task_id: int) -> CrawlTask | None:
        result = await db.execute(
            select(CrawlTask).where(CrawlTask.id == task_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_status(
        db: AsyncSession,
        task_id: int,
        status: str,
        total_count: int | None = None,
        success_count: int | None = None,
        error_message: str | None = None,
        new_count: int | None = None,
        updated_count: int | None = None,
        stats_summary: dict | None = None,
    ) -> None:
        values = {"status": status, "updated_at": datetime.now()}
        if status == "running":
            values["last_run_at"] = datetime.now()
        if total_count is not None:
            values["total_count"] = total_count
        if success_count is not None:
            values["success_count"] = success_count
        if error_message is not None:
            values["error_message"] = error_message
        if new_count is not None:
            values["new_count"] = new_count
        if updated_count is not None:
            values["updated_count"] = updated_count
        if stats_summary is not None:
            values["stats_summary"] = stats_summary
        await db.execute(
            update(CrawlTask).where(CrawlTask.id == task_id).values(**values)  # type: ignore[arg-type]
        )

    @staticmethod
    async def get_active_tasks(db: AsyncSession) -> list[CrawlTask]:
        """Get all tasks with a cron expression set."""
        result = await db.execute(
            select(CrawlTask).where(
                CrawlTask.cron_expression.isnot(None),
                CrawlTask.cron_expression != "",
                CrawlTask.status != "running",
            )
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_auto_task(
        db: AsyncSession, platform: str | None = None, city: str | None = None
    ) -> CrawlTask:
        """systemd timer 自动跑时，主动 create 一条 task 记录，让管理后台能看到。

        platform / city 都是 None 时表示"全部平台、全部城市"。
        """
        task = CrawlTask(
            platform=platform or "all",
            city=city or "all",
            status="pending",
            cron_expression="systemd-timer",
            last_run_at=datetime.now(),
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return task
