"""Admin dashboard routes."""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.security import get_admin_user
from ...models.property import Property
from ...models.user import User
from ...models.demand import Demand
from ...models.article import Article

router = APIRouter()


@router.get("")
async def get_dashboard(
    city_id: Optional[int] = Query(None, description="筛选城市：310000=上海, 330200=宁波, 不传=全部"),
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
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
        with_city(select(func.count(Property.id)).where(Property.auction_status == "即将开拍"))
    )).scalar() or 0
    sold = (await db.execute(
        with_city(select(func.count(Property.id)).where(Property.auction_status == "已成交"))
    )).scalar() or 0

    bargain_count = (await db.execute(
        with_city(select(func.count(Property.id)).where(Property.bargain_potential > 0))
    )).scalar() or 0
    yesterday_listed = (await db.execute(
        with_city(select(func.count(Property.id)).where(
            func.date(Property.created_at) == yesterday
        ))
    )).scalar() or 0
    yesterday_sold = (await db.execute(
        with_city(select(func.count(Property.id)).where(
            Property.auction_status.in_(["已成交", "已结束"]),
            func.date(Property.updated_at) == yesterday,
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

    return {
        # 总览指标
        "total_properties": total_properties,
        "today_new": today_new,
        "upcoming": upcoming,
        "sold": sold,
        "total_users": total_users,
        "agent_count": agent_count,
        "pending_demands": pending_demands,
        "pending_messages": pending_messages,
        "total_articles": total_articles,
        # 与小程序首页 market-stats 对齐的市场指标
        "bargain_count": bargain_count,
        "yesterday_listed": yesterday_listed,
        "yesterday_sold": yesterday_sold,
        # 当前过滤
        "city_id": city_id,
    }
