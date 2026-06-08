"""AI助手工具函数 - 提供数据查询和分析能力。"""
import re
from datetime import datetime, timedelta
from typing import Any
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from ...models.property import Property
from ...models.user import User
from ...models.demand import Demand
from ...models.article import Article
from ...core.auction_status import effective_status_sql


async def query_database(db: AsyncSession, sql: str, read_only: bool = True) -> dict[str, Any]:
    """执行数据库查询（仅支持SELECT语句）。

    Args:
        db: 数据库会话
        sql: SQL查询语句
        read_only: 是否只读模式（默认True，只允许SELECT）

    Returns:
        包含查询结果的字典
    """
    try:
        # 安全检查：只允许SELECT语句
        sql_upper = sql.strip().upper()
        if read_only:
            # 移除前导注释和空白
            clean_sql = re.sub(r'^\s*(--[^\n]*\n|\s)*', '', sql_upper)
            if not clean_sql.startswith('SELECT'):
                return {
                    "success": False,
                    "error": "只允许执行SELECT查询语句",
                }

        # 检查危险操作
        dangerous_keywords = ['DROP', 'DELETE', 'TRUNCATE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE']
        if any(kw in sql_upper for kw in dangerous_keywords):
            return {
                "success": False,
                "error": f"禁止执行包含以下关键词的语句: {', '.join(dangerous_keywords)}",
            }

        # 执行查询
        result = await db.execute(text(sql))

        # 获取列名和数据
        if result.returns_rows:
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]

            return {
                "success": True,
                "columns": columns,
                "rows": rows,
                "count": len(rows),
            }
        else:
            return {
                "success": True,
                "message": "查询执行成功，但没有返回数据",
            }

    except Exception as e:
        logger.error(f"SQL查询执行失败: {e}")
        return {
            "success": False,
            "error": str(e),
        }


async def get_crawler_status(db: AsyncSession) -> dict[str, Any]:
    """获取爬虫最近运行状态。

    Returns:
        包含爬虫状态信息的字典
    """
    try:
        # 查询最近24小时内创建的房源数量
        yesterday = datetime.now() - timedelta(days=1)
        week_ago = datetime.now() - timedelta(days=7)

        # 今日新增
        today_count = (await db.execute(
            select(func.count(Property.id)).where(
                func.date(Property.created_at) == datetime.now().date()
            )
        )).scalar() or 0

        # 昨日新增
        yesterday_count = (await db.execute(
            select(func.count(Property.id)).where(
                func.date(Property.created_at) == (datetime.now() - timedelta(days=1)).date()
            )
        )).scalar() or 0

        # 最近7天新增
        week_count = (await db.execute(
            select(func.count(Property.id)).where(
                Property.created_at >= week_ago
            )
        )).scalar() or 0

        # 按平台统计
        platform_stats = await db.execute(
            select(
                Property.auction_platform,
                func.count(Property.id).label('count'),
                func.max(Property.created_at).label('last_update')
            ).group_by(Property.auction_platform)
        )
        platform_data = [
            {
                "platform": row[0],
                "total_count": row[1],
                "last_update": row[2].isoformat() if row[2] else None,
            }
            for row in platform_stats.fetchall()
        ]

        # 按城市统计最近更新
        city_stats = await db.execute(
            select(
                Property.city_id,
                func.count(Property.id).label('count'),
                func.max(Property.created_at).label('last_update')
            ).where(
                Property.created_at >= week_ago
            ).group_by(Property.city_id)
        )

        city_map = {310000: "上海", 330200: "宁波", 330100: "杭州"}
        city_data = [
            {
                "city_id": row[0],
                "city_name": city_map.get(row[0], f"未知({row[0]})"),
                "week_count": row[1],
                "last_update": row[2].isoformat() if row[2] else None,
            }
            for row in city_stats.fetchall()
        ]

        return {
            "success": True,
            "today_new": today_count,
            "yesterday_new": yesterday_count,
            "week_new": week_count,
            "by_platform": platform_data,
            "by_city": city_data,
        }

    except Exception as e:
        logger.error(f"获取爬虫状态失败: {e}")
        return {
            "success": False,
            "error": str(e),
        }


async def analyze_property_stats(
    db: AsyncSession,
    city: str | None = None,
    days: int = 7
) -> dict[str, Any]:
    """分析房源统计数据。

    Args:
        db: 数据库会话
        city: 城市名称（上海/宁波/杭州，不传则全部）
        days: 分析最近N天的数据

    Returns:
        包含统计分析结果的字典
    """
    try:
        # 城市映射
        city_map = {"上海": 310000, "宁波": 330200, "杭州": 330100}

        conditions = []
        if city and city in city_map:
            conditions.append(Property.city_id == city_map[city])

        # 构建基础查询
        from sqlalchemy import and_
        base_q = select(func.count(Property.id))
        if conditions:
            base_q = base_q.where(and_(*conditions))

        # 总房源数
        total = (await db.execute(base_q)).scalar() or 0

        # 可参拍房源数
        available_q = base_q.where(effective_status_sql().in_(["即将开拍", "进行中"]))
        available = (await db.execute(available_q)).scalar() or 0

        # 已成交房源数
        sold_q = base_q.where(effective_status_sql() == "已成交")
        sold = (await db.execute(sold_q)).scalar() or 0

        # 平均折扣率
        avg_discount_q = select(func.avg(Property.court_discount_rate))
        if conditions:
            avg_discount_q = avg_discount_q.where(and_(*conditions))
        avg_discount_q = avg_discount_q.where(
            Property.court_discount_rate > 0,
            Property.court_discount_rate < 1
        )
        avg_discount = (await db.execute(avg_discount_q)).scalar() or 0

        # 平均起拍价
        avg_price_q = select(func.avg(Property.starting_price))
        if conditions:
            avg_price_q = avg_price_q.where(and_(*conditions))
        avg_price_q = avg_price_q.where(Property.starting_price > 0)
        avg_price = (await db.execute(avg_price_q)).scalar() or 0

        # 按物业类型统计
        type_q = select(
            Property.property_type,
            func.count(Property.id)
        )
        if conditions:
            type_q = type_q.where(and_(*conditions))
        type_q = type_q.group_by(Property.property_type)

        type_stats = await db.execute(type_q)
        type_data = {row[0]: row[1] for row in type_stats.fetchall()}

        # 最近N天新增趋势
        cutoff_date = datetime.now() - timedelta(days=days)
        recent_q = select(
            func.date(Property.created_at).label('date'),
            func.count(Property.id).label('count')
        )
        if conditions:
            recent_q = recent_q.where(and_(*conditions))
        recent_q = recent_q.where(
            Property.created_at >= cutoff_date
        ).group_by(func.date(Property.created_at)).order_by(func.date(Property.created_at))

        recent_stats = await db.execute(recent_q)
        daily_data = [
            {"date": str(row[0]), "count": row[1]}
            for row in recent_stats.fetchall()
        ]

        return {
            "success": True,
            "city": city or "全部",
            "analysis_period_days": days,
            "total_properties": total,
            "available_properties": available,
            "sold_properties": sold,
            "avg_discount_rate": round(float(avg_discount), 3) if avg_discount else 0,
            "avg_starting_price": int(avg_price) if avg_price else 0,
            "avg_starting_price_wan": round(float(avg_price) / 10000, 1) if avg_price else 0,
            "by_property_type": type_data,
            "daily_trend": daily_data,
        }

    except Exception as e:
        logger.error(f"分析房源统计失败: {e}")
        return {
            "success": False,
            "error": str(e),
        }


async def get_system_overview(db: AsyncSession) -> dict[str, Any]:
    """获取系统概览数据。

    Returns:
        包含系统整体数据的字典
    """
    try:
        # 房源总数
        total_properties = (await db.execute(
            select(func.count(Property.id))
        )).scalar() or 0

        # 用户总数
        total_users = (await db.execute(
            select(func.count(User.id))
        )).scalar() or 0

        # 需求总数
        total_demands = (await db.execute(
            select(func.count(Demand.id))
        )).scalar() or 0

        # 待处理需求
        pending_demands = (await db.execute(
            select(func.count(Demand.id)).where(Demand.status == "待处理")
        )).scalar() or 0

        # 文章总数
        total_articles = (await db.execute(
            select(func.count(Article.id))
        )).scalar() or 0

        # 可参拍房源
        available_properties = (await db.execute(
            select(func.count(Property.id)).where(
                effective_status_sql().in_(["即将开拍", "进行中"])
            )
        )).scalar() or 0

        return {
            "success": True,
            "total_properties": total_properties,
            "available_properties": available_properties,
            "total_users": total_users,
            "total_demands": total_demands,
            "pending_demands": pending_demands,
            "total_articles": total_articles,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"获取系统概览失败: {e}")
        return {
            "success": False,
            "error": str(e),
        }
