"""Common routes — banners, market-stats, cities, settings."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.auction_status import (
    effective_status_sql, BARGAIN_DISCOUNT_MIN, BARGAIN_DISCOUNT_MAX,
    upcoming_cond, bargain_cond, yesterday_listed_cond, yesterday_sold_cond,
)
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
        # 匹配该城市，或 city_id=0 的「全部城市」通用横幅
        conditions.append(or_(Banner.city_id == city_id, Banner.city_id == 0))
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

    def _count(extra_conds):
        # 共用计数条件 + 本接口的城市过滤，保证与数据看板四个同步卡片口径一致。
        return select(func.count(Property.id)).where(and_(*conditions, *extra_conds))

    yesterday = date.today() - timedelta(days=1)

    upcoming = (await db.execute(_count(upcoming_cond()))).scalar() or 0
    bargain = (await db.execute(_count(bargain_cond()))).scalar() or 0
    yesterday_listed = (await db.execute(_count(yesterday_listed_cond(yesterday)))).scalar() or 0
    yesterday_sold = (await db.execute(_count(yesterday_sold_cond(yesterday)))).scalar() or 0

    return MarketStatsOut(
        bargain_count=bargain,
        upcoming_count=upcoming,
        yesterday_listed=yesterday_listed,
        yesterday_sold=yesterday_sold,
    )


@router.get("/cities", response_model=list[CityOut])
async def list_cities():
    return [CityOut(**c) for c in CITIES]


@router.get("/home-summary")
async def home_summary(db: AsyncSession = Depends(get_session)):
    """登录页/首屏用：上海+宁波+杭州三城合计的真实统计（每次查询即时计算，自然每日更新）。

    - on_auction：可参拍房源数（即将开拍 + 进行中，按实时状态计算）
    - bargain：可参拍且折扣 1折~6.5折的捡漏房源数
    - avg_discount：可参拍房源的平均折扣（court_discount_rate 0~1）

    注意：限定三城（库里可能混入河北等其它城市的脏数据），避免登录页数字被污染。
    """
    city_ids = [c["city_id"] for c in CITIES]
    in_cities = Property.city_id.in_(city_ids)
    visible = and_(effective_status_sql().in_(["即将开拍", "进行中"]), in_cities, Property.is_deleted == 0)

    on_auction = (await db.execute(
        select(func.count(Property.id)).where(visible)
    )).scalar() or 0

    bargain = (await db.execute(
        select(func.count(Property.id)).where(
            visible,
            Property.court_discount_rate >= BARGAIN_DISCOUNT_MIN,
            Property.court_discount_rate <= BARGAIN_DISCOUNT_MAX,
        )
    )).scalar() or 0

    avg_discount = (await db.execute(
        select(func.avg(Property.court_discount_rate)).where(
            visible,
            Property.court_discount_rate > 0,
            Property.court_discount_rate < 1,
        )
    )).scalar() or 0

    avg_discount_zhe = round(float(avg_discount) * 10, 1) if avg_discount else 0
    return {
        "on_auction": on_auction,
        "bargain": bargain,
        "avg_discount": avg_discount_zhe,  # 例如 7.2 表示 7.2 折
    }


@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_session)):
    rows = (await db.execute(select(SystemSetting))).scalars().all()
    return {r.key: r.value for r in rows}
