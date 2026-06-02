"""拍卖状态单一事实源（canonical source of truth）。

问题背景：各平台爬虫把 auction_status 当成「抓取那一刻的页面文本快照」存库
（如 jd_detail / gpai_detail 用关键词匹配）。一旦抓取时刻的状态文本与真实时间窗
脱节（例如抓到「已结束」但其实开拍时间未到、或结束时间还没到），存库后状态就永远错，
导致 C 端按「即将开拍/进行中」筛选时，本该可参拍的房源被过滤消失。

解决思路：不信任「时间可推导」的存储状态，统一按 auction_start_time /
auction_end_time + 当前时间实时计算：
  - now < start                → 即将开拍
  - start <= now <= end        → 进行中
  - now > end                  → 已结束
只有「时间推不出的结果态」（已成交/已撤回/中止/流拍）保留爬虫抓到的原值——因为
时间到了之后到底是成交、流拍还是撤回，只能靠平台告知，无法由时钟推断。

本模块提供两种用法，保持口径一致：
  - effective_status(...)      纯 Python 计算（单条记录 / 脚本 / 解析器）
  - effective_status_sql(...)  SQLAlchemy case() 表达式（WHERE / COUNT / GROUP BY / ORDER BY）
"""
from datetime import datetime, timedelta

# 注意：本模块顶部刻意不 import SQLAlchemy 的 case / ORM Property，
# 以便 crawler 解析器等场景能零副作用地 import 纯函数 effective_status。
# effective_status_sql() 用到的 case()/Property 在该函数内部按需 import。

# ── 状态常量 ──────────────────────────────────────────────────────────────

# 时间无法推导的「结果态」：到点之后究竟成交/流拍/撤回，只能由平台告知，予以保留。
RESULT_STATES = ("已成交", "已撤回", "中止", "流拍")

# 时间可推导的「时序态」：一律按时间窗重算，不信任存储值。
TIME_DERIVED_STATES = ("即将开拍", "进行中", "已结束")

# 小程序端优先展示的可参拍状态。
MOBILE_VISIBLE_STATUSES = ("即将开拍", "进行中")
# 兜底状态：某城市/筛选下无可参拍房源时，改展示已成交（成交参考价值），避免首页空白。
MOBILE_FALLBACK_STATUSES = ("已成交",)
# 详情/分析/地图可访问 = 可参拍 + 兜底（保证被列出的房源都能点开）。
MOBILE_DETAIL_STATUSES = MOBILE_VISIBLE_STATUSES + MOBILE_FALLBACK_STATUSES

# 即将开拍但开拍时间已过、又缺结束时间时，超过该天数判定为已结束，避免永久卡在「进行中」。
DEFAULT_STALE_DAYS = 3


# ── 纯 Python 计算 ────────────────────────────────────────────────────────

def effective_status(
    stored_status: str | None,
    start_time: datetime | None,
    end_time: datetime | None,
    now: datetime | None = None,
    stale_days: int = DEFAULT_STALE_DAYS,
) -> str:
    """按时间窗 + 当前时间计算房源的真实拍卖状态。

    结果态（已成交/已撤回/中止/流拍）原样保留；其余一律按时间重算。
    缺少时间信息时回退到存储值（再兜底「即将开拍」）。
    """
    stored = (stored_status or "").strip()
    if stored in RESULT_STATES:
        return stored

    now = now or datetime.now()

    if start_time and now < start_time:
        return "即将开拍"
    if start_time and end_time and start_time <= now <= end_time:
        return "进行中"
    if end_time and now > end_time:
        return "已结束"
    # 有开拍时间、已过开拍，但缺结束时间：短期内算进行中，超过 stale_days 判已结束。
    if start_time and now >= start_time:
        if now - start_time > timedelta(days=stale_days):
            return "已结束"
        return "进行中"

    # 完全没有时间信息：保留存储值，兜底即将开拍。
    return stored or "即将开拍"


# ── SQLAlchemy 表达式 ─────────────────────────────────────────────────────

def effective_status_sql(now: datetime | None = None, stale_days: int = DEFAULT_STALE_DAYS):
    """返回与 effective_status() 等价的 SQLAlchemy case() 表达式。

    可直接用于 .where() / func.count() / group_by() / order_by()，
    确保分页、计数、排序都在 DB 层按真实状态进行。
    """
    from sqlalchemy import case, and_
    from ..models.property import Property

    now = now or datetime.now()
    stale_cutoff = now - timedelta(days=stale_days)
    s = Property.auction_status
    st = Property.auction_start_time
    et = Property.auction_end_time

    return case(
        # 1. 结果态保留原值
        (s.in_(RESULT_STATES), s),
        # 2. now < start → 即将开拍
        (and_(st.isnot(None), st > now), "即将开拍"),
        # 3. start <= now <= end → 进行中
        (and_(st.isnot(None), et.isnot(None), st <= now, et >= now), "进行中"),
        # 4. now > end → 已结束
        (and_(et.isnot(None), et < now), "已结束"),
        # 5. 已过开拍但缺结束时间：超过 stale_days → 已结束
        (and_(st.isnot(None), et.is_(None), st <= now, st < stale_cutoff), "已结束"),
        # 6. 已过开拍但缺结束时间且在 stale 期内 → 进行中
        (and_(st.isnot(None), et.is_(None), st <= now, st >= stale_cutoff), "进行中"),
        # 7. 兜底：保留存储值
        else_=s,
    )
