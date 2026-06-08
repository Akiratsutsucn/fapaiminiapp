"""Admin dashboard routes."""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.security import get_admin_user, check_module_permission
from ...core.auction_status import (
    effective_status_sql, BARGAIN_DISCOUNT_MIN, BARGAIN_DISCOUNT_MAX,
    MOBILE_VISIBLE_STATUSES,
)
from ...models.property import Property
from ...models.user import User
from ...models.demand import Demand
from ...models.article import Article

router = APIRouter()


@router.get("")
async def get_dashboard(
    city_id: Optional[int] = Query(None, description="筛选城市：310000=上海, 330200=宁波, 330100=杭州, 不传=全部"),
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("dashboard")),
):
    today = date.today()
    yesterday = today - timedelta(days=1)

    def with_city(stmt):
        """对 Property 查询加 city_id 过滤。"""
        if city_id is not None:
            return stmt.where(Property.city_id == city_id)
        return stmt

    total_properties = (await db.execute(with_city(select(func.count(Property.id))))).scalar() or 0
    today_new = (await db.execute(
        with_city(select(func.count(Property.id)).where(
            func.date(Property.created_at) == today
        ))
    )).scalar() or 0
    upcoming = (await db.execute(
        with_city(select(func.count(Property.id)).where(effective_status_sql() == "即将开拍"))
    )).scalar() or 0
    sold = (await db.execute(
        with_city(select(func.count(Property.id)).where(effective_status_sql() == "已成交"))
    )).scalar() or 0

    bargain_count = (await db.execute(
        with_city(select(func.count(Property.id)).where(
            effective_status_sql().in_(MOBILE_VISIBLE_STATUSES),
            Property.court_discount_rate >= BARGAIN_DISCOUNT_MIN,
            Property.court_discount_rate <= BARGAIN_DISCOUNT_MAX,
        ))
    )).scalar() or 0
    yesterday_listed = (await db.execute(
        with_city(select(func.count(Property.id)).where(
            func.date(func.coalesce(Property.publish_date, Property.created_at)) == yesterday
        ))
    )).scalar() or 0
    yesterday_sold = (await db.execute(
        with_city(select(func.count(Property.id)).where(
            effective_status_sql().in_(["已成交", "已结束"]),
            func.date(func.coalesce(Property.auction_end_time, Property.updated_at)) == yesterday,
        ))
    )).scalar() or 0

    # 用户、需求、文章不按城市过滤（无 city 字段）
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    agent_count = (await db.execute(
        select(func.count(User.id)).where(User.role == "agent")
    )).scalar() or 0

    pending_demands = (await db.execute(
        select(func.count(Demand.id)).where(Demand.status == "待处理")
    )).scalar() or 0
    pending_messages = (await db.execute(
        select(func.count(Demand.id)).where(
            Demand.status == "待处理", Demand.source == "message"
        )
    )).scalar() or 0

    total_articles = (await db.execute(select(func.count(Article.id)))).scalar() or 0

    # 三城分项数据
    CITIES = {"shanghai": 310000, "ningbo": 330200, "hangzhou": 330100}

    async def _city_breakdown(base_conditions):
        """计算城市分项数据"""
        result = {}
        for city_key, city_code in CITIES.items():
            city_conditions = base_conditions + [Property.city_id == city_code]
            count = (await db.execute(
                select(func.count(Property.id)).where(*city_conditions)
            )).scalar() or 0
            result[city_key] = count
        return result

    # 房源相关指标的城市分项
    total_by_city = await _city_breakdown([])
    today_new_by_city = await _city_breakdown([func.date(Property.created_at) == today])
    upcoming_by_city = await _city_breakdown([effective_status_sql() == "即将开拍"])
    sold_by_city = await _city_breakdown([effective_status_sql() == "已成交"])
    bargain_by_city = await _city_breakdown([
        effective_status_sql().in_(MOBILE_VISIBLE_STATUSES),
        Property.court_discount_rate >= BARGAIN_DISCOUNT_MIN,
        Property.court_discount_rate <= BARGAIN_DISCOUNT_MAX,
    ])
    yesterday_listed_by_city = await _city_breakdown([
        func.date(func.coalesce(Property.publish_date, Property.created_at)) == yesterday
    ])
    yesterday_sold_by_city = await _city_breakdown([
        effective_status_sql().in_(["已成交", "已结束"]),
        func.date(func.coalesce(Property.auction_end_time, Property.updated_at)) == yesterday,
    ])

    return {
        # 总览指标（带城市分项）
        "total_properties": {
            "total": total_properties,
            "by_city": total_by_city,
        },
        "today_new": {
            "total": today_new,
            "by_city": today_new_by_city,
        },
        "upcoming": {
            "total": upcoming,
            "by_city": upcoming_by_city,
        },
        "sold": {
            "total": sold,
            "by_city": sold_by_city,
        },
        # 用户、需求、文章（无城市分项）
        "total_users": total_users,
        "agent_count": agent_count,
        "pending_demands": pending_demands,
        "pending_messages": pending_messages,
        "total_articles": total_articles,
        # 与小程序首页 market-stats 对齐的市场指标（带城市分项）
        "bargain_count": {
            "total": bargain_count,
            "by_city": bargain_by_city,
        },
        "yesterday_listed": {
            "total": yesterday_listed,
            "by_city": yesterday_listed_by_city,
        },
        "yesterday_sold": {
            "total": yesterday_sold,
            "by_city": yesterday_sold_by_city,
        },
        # 当前过滤
        "city_id": city_id,
    }
