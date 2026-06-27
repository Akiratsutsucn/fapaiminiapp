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
from app.models.crawl import CrawlTask, CrawlRecord, CrawlerTaskDetail  # noqa: E402


# 「动态字段」:每次重抓以新值为准(即使新值为空/0也覆盖),反映价格调整/状态流转/下架清零。
DYNAMIC_FIELDS = frozenset({
    "starting_price", "starting_unit_price", "appraisal_price",
    "court_discount_rate", "deposit", "increment_amount",
    "market_deal_price", "market_deal_unit_price",
    "auction_status", "auction_round",
    "auction_start_time", "auction_end_time", "online_auction_end_time",
    "final_deal_price", "deal_confirmed",
    "view_count", "participant_count",
})

# 动态字段中的「关键标识字段」:虽属动态(状态流转需更新),但新值为空时不可覆盖旧值——
# 因为「空」不是有效状态/时间,而是解析失败(如列表API status字段缺失)。空值覆盖会让
# 房源 auction_status 变空、从「在拍」列表消失(2026-06-27 超时被杀曾致1100条status清空)。
_DYNAMIC_KEEP_IF_EMPTY = frozenset({
    "auction_status", "auction_start_time", "auction_end_time", "online_auction_end_time",
})

# 永不参与 update 的字段(主键/创建时间/图片单独处理)。
_UPSERT_EXCLUDE = frozenset({"image_urls", "id", "created_at"})


def build_update_data(item_dict: dict) -> dict:
    """构造 update 字段集:动态字段强刷(含空值覆盖);静态字段仅在新值非空时覆盖。

    静态字段(面积/朝向/户型/地址/坐标等)新值为 None/0/"" 时保留旧值,
    避免某次解析抖动把已抓到的好数据清空。动态字段(价格/状态/时间)无条件以新值为准,
    确保每日重抓能正确反映价格调整、状态流转、下架清零。
    例外:_DYNAMIC_KEEP_IF_EMPTY(状态/拍卖时间)新值为空时保留旧值(空=解析失败,非有效状态)。
    """
    out = {}
    for k, v in item_dict.items():
        if k in _UPSERT_EXCLUDE:
            continue
        if k in _DYNAMIC_KEEP_IF_EMPTY:
            # 关键标识动态字段:仅非空才覆盖(空值=解析失败,保留旧值)
            if v is not None and v != "":
                out[k] = v
        elif k in DYNAMIC_FIELDS:
            out[k] = v  # 动态:无条件覆盖(含 None/0)
        elif v is not None and v != "" and v != 0:
            out[k] = v  # 静态:仅非空覆盖
    return out


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
            # Update existing:动态字段强刷、静态字段保留(见 build_update_data)
            update_data = build_update_data(item.__dict__)
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
    async def update_auction_status(
        db: AsyncSession, property_id: int, status: str
    ) -> None:
        """更新单条房源的拍卖状态（成交回访用：写入平台告知的结果态）。

        与 mark_as_ended 同属仓储层的状态写入方法，区别仅在于 status 由调用方给定
        （已成交/已撤回/中止/流拍 等），避免回访脚本绕过仓储层直接写 SQL。
        """
        await db.execute(
            update(Property)
            .where(Property.id == property_id)
            .values(auction_status=status, updated_at=datetime.now())
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
                hidden=img.get("hidden", 0) if isinstance(img, dict) else 0,
                hide_reason=img.get("hide_reason") if isinstance(img, dict) else None,
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
    async def update_heartbeat(
        db: AsyncSession,
        task_id: int,
        phase: str | None = None,
        progress_done: int | None = None,
        progress_total: int | None = None,
    ) -> None:
        """刷新心跳 + 当前阶段/进度（用于实时可视化 + 看门狗判定卡死）。

        running 任务每处理一批就调用一次。心跳时间戳长时间不更新即视为卡死。
        独立小事务提交，不影响主流程。
        """
        values: dict = {"heartbeat_at": datetime.now()}
        if phase is not None:
            values["phase"] = phase
        if progress_done is not None:
            values["progress_done"] = progress_done
        if progress_total is not None:
            values["progress_total"] = progress_total
        await db.execute(
            update(CrawlTask).where(CrawlTask.id == task_id).values(**values)  # type: ignore[arg-type]
        )

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


class CrawlerTaskDetailRepository:
    """CRUD for crawler_task_details table."""

    @staticmethod
    async def create_or_update(
        db: AsyncSession,
        task_id: int,
        platform: str,
        city: str,
        total_fetched: int = 0,
        new_count: int = 0,
        updated_count: int = 0,
        failed_count: int = 0,
        skipped_count: int = 0,
        error_messages: str | None = None,
        duration_seconds: int | None = None,
        failure_type: str | None = None,
    ) -> CrawlerTaskDetail:
        """创建或更新任务详情记录"""
        # 截断错误信息到1000字符
        if error_messages and len(error_messages) > 1000:
            error_messages = error_messages[:1000] + "..."

        # 查找是否已存在
        result = await db.execute(
            select(CrawlerTaskDetail).where(
                CrawlerTaskDetail.task_id == task_id,
                CrawlerTaskDetail.platform == platform,
                CrawlerTaskDetail.city == city,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # 更新已有记录
            existing.total_fetched = total_fetched
            existing.new_count = new_count
            existing.updated_count = updated_count
            existing.failed_count = failed_count
            existing.skipped_count = skipped_count
            existing.error_messages = error_messages
            existing.duration_seconds = duration_seconds
            if failure_type is not None:
                existing.failure_type = failure_type
            await db.flush()
            return existing
        else:
            # 创建新记录
            detail = CrawlerTaskDetail(
                task_id=task_id,
                platform=platform,
                city=city,
                total_fetched=total_fetched,
                new_count=new_count,
                updated_count=updated_count,
                failed_count=failed_count,
                skipped_count=skipped_count,
                error_messages=error_messages,
                duration_seconds=duration_seconds,
                failure_type=failure_type,
            )
            db.add(detail)
            await db.flush()
            return detail

    @staticmethod
    async def get_by_task_id(db: AsyncSession, task_id: int) -> list[CrawlerTaskDetail]:
        """获取指定任务的所有详情记录"""
        result = await db.execute(
            select(CrawlerTaskDetail).where(
                CrawlerTaskDetail.task_id == task_id
            ).order_by(CrawlerTaskDetail.platform, CrawlerTaskDetail.city)
        )
        return list(result.scalars().all())
