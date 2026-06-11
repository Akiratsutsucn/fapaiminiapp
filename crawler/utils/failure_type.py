"""爬虫失败原因分类。

把爬虫失败的异常文本/日志归类成结构化类型，方便后台区分：
- ①登录 cookie 失效
- ②IP 被封 / 限流
- ③解析 / 代码逻辑问题

用法：
    from crawler.utils.failure_type import classify_error, LOGIN_COOKIE

    ftype = classify_error("HTTP 429 frequency limit")  # -> IP_BLOCKED
"""
from __future__ import annotations

# === 失败类型常量 ===
LOGIN_COOKIE = "LOGIN_COOKIE"   # 登录墙 / cookie 失效
IP_BLOCKED = "IP_BLOCKED"       # IP 被封 / 限流 / 风控
PARSE_LOGIC = "PARSE_LOGIC"     # 解析 / 代码逻辑错误
UNKNOWN = "UNKNOWN"             # 无法判断（空文本等）

# 关键词命中即归类。全部小写匹配（中文不区分大小写无影响）。
# 顺序：先判 IP 风控、再判登录墙——避免登录跳转页里出现 "请登录" 但本质是 429 被误判。
_IP_BLOCKED_KEYWORDS = (
    "403", "429", "420",
    "risk", "风控", "captcha", "验证码",
    "频率", "frequency", "rate limit", "ratelimit", "too many",
    "限流", "访问太频繁", "异常访问", "访问频繁",
    "punish", "deny_pc", "blocked", "封禁", "blacklist",
)

_LOGIN_COOKIE_KEYWORDS = (
    "登录墙", "login wall", "login_wall",
    "请登录", "请先登录", "请登录后", "您还没有登录", "亲，请登录",
    "未登录", "登录失效", "登录过期", "cookie", "未授权",
    "login", "signin", "sign in", "unauthorized", "401", "not logged in",
)


def classify_error(exc_or_msg) -> str:
    """按关键词把异常文本/消息归类为失败类型常量。

    参数可以是 Exception 实例或字符串。无文本返回 UNKNOWN，
    其余未命中关键词的统一归为 PARSE_LOGIC（解析/逻辑错误）。
    """
    if exc_or_msg is None:
        return UNKNOWN

    text = str(exc_or_msg).strip()
    if not text:
        return UNKNOWN

    lowered = text.lower()

    # 先判 IP 风控/限流（403/429/420/captcha/频率等）
    for kw in _IP_BLOCKED_KEYWORDS:
        if kw in lowered:
            return IP_BLOCKED

    # 再判登录墙 / cookie 失效
    for kw in _LOGIN_COOKIE_KEYWORDS:
        if kw in lowered:
            return LOGIN_COOKIE

    # 其余视为解析/逻辑错误
    return PARSE_LOGIC
