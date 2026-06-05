"""Common routes — banners, market-stats, cities, settings."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.auction_status import (
    effective_status_sql, BARGAIN_DISCOUNT_MIN, BARGAIN_DISCOUNT_MAX,
    MOBILE_VISIBLE_STATUSES,
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

    def _apply(q):
        return q.where(and_(*conditions)) if conditions else q

    upcoming = (await db.execute(
        _apply(select(func.count(Property.id))).where(effective_status_sql() == "即将开拍")
    )).scalar() or 0

    # 捡漏：可参拍（即将开拍/进行中）且折扣 1折~6.5折
    bargain = (await db.execute(
        _apply(select(func.count(Property.id))).where(
            effective_status_sql().in_(MOBILE_VISIBLE_STATUSES),
            Property.court_discount_rate >= BARGAIN_DISCOUNT_MIN,
            Property.court_discount_rate <= BARGAIN_DISCOUNT_MAX,
        )
    )).scalar() or 0

    yesterday = date.today() - timedelta(days=1)
    # 昨日上架：用平台真实上架日期 publish_date，缺失时回退入库时间 created_at
    listed_date = func.coalesce(Property.publish_date, Property.created_at)
    yesterday_listed = (await db.execute(
        _apply(select(func.count(Property.id))).where(
            func.date(listed_date) == yesterday
        )
    )).scalar() or 0

    # 昨日成交：仅「已成交」状态，用平台真实结束时间 auction_end_time（拍卖结束=成交时点），
    # 缺失时回退 updated_at。口径须与 properties.py 的 sold_day 列表入口完全一致，
    # 保证首页数字 == 列表「共xxx套」。
    sold_date = func.coalesce(Property.auction_end_time, Property.updated_at)
    yesterday_sold = (await db.execute(
        _apply(select(func.count(Property.id))).where(
            effective_status_sql() == "已成交",
            func.date(sold_date) == yesterday,
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
    visible = and_(effective_status_sql().in_(["即将开拍", "进行中"]), in_cities)

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
