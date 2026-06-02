"""拍卖状态归一：按 start/end + 当前时间重算时序态，保留结果态。

各平台详情页抓到的状态文本只是「抓取那一刻」的快照，与真实时间窗脱节后会一直错，
导致前台按「即将开拍/进行中」筛选时本该可参拍的房源被过滤掉。解析阶段统一在抽完
开拍/结束时间后调用本函数归一，与后端 app.core.auction_status / 引擎自校正同口径。

优先复用后端的单一事实源 app.core.auction_status.effective_status（运行时 backend
在 sys.path 中）；若该模块不可用（如独立单测环境），回退到等价的本地实现，保证解析器
自包含不崩。
"""
from datetime import datetime, timedelta

# 时间推不出的结果态：到点后究竟成交/流拍/撤回只能由平台告知，予以保留。
_RESULT_STATES = ("已成交", "已撤回", "中止", "流拍")
_DEFAULT_STALE_DAYS = 3


def _fallback_effective(
    stored: str | None,
    start: datetime | None,
    end: datetime | None,
    now: datetime | None = None,
    stale_days: int = _DEFAULT_STALE_DAYS,
) -> str:
    s = (stored or "").strip()
    if s in _RESULT_STATES:
        return s
    now = now or datetime.now()
    if start and now < start:
        return "即将开拍"
    if start and end and start <= now <= end:
        return "进行中"
    if end and now > end:
        return "已结束"
    if start and now >= start:
        return "已结束" if now - start > timedelta(days=stale_days) else "进行中"
    return s or "即将开拍"


def normalize_status(
    stored: str | None,
    start: datetime | None,
    end: datetime | None,
    now: datetime | None = None,
) -> str:
    """归一拍卖状态。优先用后端 effective_status，回退本地等价实现。"""
    try:
        from app.core.auction_status import effective_status
        return effective_status(stored, start, end, now=now)
    except Exception:
        return _fallback_effective(stored, start, end, now=now)
