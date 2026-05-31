"""Common routes — banners, market-stats, cities, settings."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...models.banner import Banner
from ...models.property import Property
from ...models.system_setting import SystemSetting
from ...schemas import BannerOut, MarketStatsOut, CityOut

router = APIRouter()

CITIES = [
    {"city_id": 310000, "city_name": "上海", "is_active": True},
    {"city_id": 330200, "city_name": "宁波", "is_active": True},
    {"city_id": 330100, "city_name": "杭州", "is_active": True},
]


@router.get("/banners", response_model=list[BannerOut])
async def list_banners(
    db: AsyncSession = Depends(get_session),
    city_id: int | None = Query(None),
):
    conditions = [Banner.is_active == True]
    if city_id:
        conditions.append(Banner.city_id == city_id)
    q = select(Banner).where(and_(*conditions)).order_by(Banner.sort_order.asc())
    rows = (await db.execute(q)).scalars().all()
    return [BannerOut.model_validate(r) for r in rows]


@router.get("/market-stats", response_model=MarketStatsOut)
async def market_stats(
    db: AsyncSession = Depends(get_session),
    city_id: int | None = Query(None),
):
    conditions = []
    if city_id:
        conditions.append(Property.city_id == city_id)

    def _apply(q):
        return q.where(and_(*conditions)) if conditions else q

    upcoming = (await db.execute(
        _apply(select(func.count(Property.id))).where(Property.auction_status == "即将开拍")
    )).scalar() or 0

    bargain = (await db.execute(
        _apply(select(func.count(Property.id))).where(Property.bargain_potential > 0)
    )).scalar() or 0

    yesterday = date.today() - timedelta(days=1)
    yesterday_listed = (await db.execute(
        _apply(select(func.count(Property.id))).where(
            func.date(Property.created_at) == yesterday
        )
    )).scalar() or 0

    yesterday_sold = (await db.execute(
        _apply(select(func.count(Property.id))).where(
            Property.auction_status.in_(["已成交", "已结束"]),
            func.date(Property.updated_at) == yesterday,
        )
    )).scalar() or 0

    return MarketStatsOut(
        bargain_count=bargain,
        upcoming_count=upcoming,
        yesterday_listed=yesterday_listed,
        yesterday_sold=yesterday_sold,
    )


@router.get("/cities", response_model=list[CityOut])
async def list_cities():
    return [CityOut(**c) for c in CITIES]


@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_session)):
    rows = (await db.execute(select(SystemSetting))).scalars().all()
    return {r.key: r.value for r in rows}
