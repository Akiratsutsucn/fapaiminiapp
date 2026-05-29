"""抗封堵框架：智能重试 + 代理池 + 风控感知降级。

核心 API：
    from crawler.anti_block import http_get_with_retry, ProxyPool

    text = await http_get_with_retry(url, headers=...)  # 自动重试 + 切代理 + 检测风控

环境变量：
    PROXY_POOL=http://user:pass@host:port,socks5://host:port
        多个代理用逗号分隔。空字符串=不用代理。

设计：
- 默认 3 次重试，指数退避 (2/4/8s)
- HTTP 5xx → 重试；HTTP 429/403 → 当作风控，切代理 + 长退避
- 网络错误（超时/连接错误）→ 重试
- 检测到 captcha/punish/login_redirect 文本 → 当作风控
"""
from __future__ import annotations
import asyncio
import os
import random
import time
from typing import Optional, Callable
from urllib.parse import urlparse

import httpx
from loguru import logger

from .anti_crawl import random_ua


# === UA 池（增强版，覆盖 PC + 移动）===
UA_POOL_DESKTOP = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
]

UA_POOL_MOBILE = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
]


def random_ua_with_type(mobile: bool = False) -> str:
    return random.choice(UA_POOL_MOBILE if mobile else UA_POOL_DESKTOP)


# === 风控关键词检测 ===
RISK_KEYWORDS = [
    "captcha",  # 通用验证码
    "punish",   # 阿里
    "deny_pc",  # 阿里
    "请登录",   # 通用
    "verify",
    "blocked",
    "frequency limit",
    "频率",
    "异常访问",
    "访问太频繁",
    "/login",
]


def is_risk_response(url: str, status: int, text: str) -> tuple[bool, str]:
    """检测响应是否被风控。返回 (是否风控, 原因)"""
    if status in (403, 429):
        return True, f"HTTP {status}"
    if status >= 500:
        return False, ""  # 5xx 是服务端问题，不算风控

    # 重定向到登录/captcha
    final_url = url.lower()
    for kw in RISK_KEYWORDS:
        if kw in final_url:
            return True, f"redirect-to-{kw}"

    # 响应正文有 captcha/login 提示
    text_lower = (text or "")[:5000].lower()
    if "captcha" in text_lower or "请登录" in text or "请输入验证码" in text:
        return True, "captcha-in-body"

    return False, ""


# === 代理池 ===
class ProxyPool:
    """代理池：支持轮换 + 失败标记 + 健康检查。

    .env 配置：
        PROXY_POOL=http://user:pass@1.2.3.4:8080,socks5://5.6.7.8:1080
    """

    def __init__(self, proxies: Optional[list[str]] = None):
        if proxies is None:
            proxies_env = os.getenv("PROXY_POOL", "").strip()
            proxies = [p.strip() for p in proxies_env.split(",") if p.strip()]
        self.proxies = proxies
        # 每个代理的最近失败时间。15 分钟内不再使用
        self.bad: dict[str, float] = {}
        self.idx = 0

    def has_proxies(self) -> bool:
        return bool(self.proxies)

    def get(self) -> Optional[str]:
        """返回下一个可用代理，全坏则返回 None。"""
        if not self.proxies:
            return None
        now = time.time()
        for _ in range(len(self.proxies)):
            p = self.proxies[self.idx % len(self.proxies)]
            self.idx += 1
            bad_at = self.bad.get(p, 0)
            if now - bad_at > 900:  # 15 分钟冷却
                return p
        return None

    def mark_bad(self, proxy: Optional[str], reason: str = ""):
        if proxy:
            self.bad[proxy] = time.time()
            logger.warning(f"[anti] proxy 标记失效 (15min): {proxy} reason={reason}")


# 全局单例
_proxy_pool = ProxyPool()


def get_proxy_pool() -> ProxyPool:
    return _proxy_pool


# === 平台风控冷却 ===
class PlatformCooldown:
    """某平台触发风控时，冷却 N 分钟不再请求该 host。"""

    def __init__(self):
        self.bad_hosts: dict[str, float] = {}

    def should_skip(self, url: str) -> Optional[str]:
        host = urlparse(url).netloc
        bad_at = self.bad_hosts.get(host)
        if not bad_at:
            return None
        elapsed = time.time() - bad_at
        if elapsed < 1800:  # 30 分钟
            remain = int((1800 - elapsed) / 60)
            return f"host {host} 风控冷却中 (剩 {remain} 分钟)"
        return None

    def mark_bad(self, url: str, reason: str = ""):
        host = urlparse(url).netloc
        self.bad_hosts[host] = time.time()
        logger.warning(f"[anti] host {host} 触发风控冷却 30min: {reason}")


_cooldown = PlatformCooldown()


def get_cooldown() -> PlatformCooldown:
    return _cooldown


# === 主请求函数 ===
async def http_get_with_retry(
    url: str,
    *,
    headers: Optional[dict] = None,
    cookies: Optional[dict] = None,
    cookie_str: Optional[str] = None,
    timeout: float = 20.0,
    max_retries: int = 3,
    use_proxy: bool = True,
    use_mobile_ua: bool = False,
    follow_redirects: bool = True,
) -> Optional[httpx.Response]:
    """带智能重试的 GET。

    返回 Response（成功）或 None（最终失败）。
    """
    # 1. 检查 host 是否在冷却
    skip_reason = _cooldown.should_skip(url)
    if skip_reason:
        logger.warning(f"[anti] 跳过 {url[:80]}: {skip_reason}")
        return None

    pool = _proxy_pool if use_proxy else None
    last_err = None

    for attempt in range(max_retries):
        # 每次重试换 UA
        ua = random_ua_with_type(mobile=use_mobile_ua)
        merged_headers = dict(headers or {})
        merged_headers.setdefault("User-Agent", ua)
        merged_headers.setdefault("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
        merged_headers.setdefault("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        if cookie_str:
            merged_headers["Cookie"] = cookie_str

        # 选代理
        proxy = None
        proxies = None
        if pool and pool.has_proxies():
            proxy = pool.get()
            if proxy:
                proxies = proxy
                logger.debug(f"[anti] attempt {attempt+1} via proxy {proxy}")

        try:
            kwargs = {
                "headers": merged_headers,
                "timeout": timeout,
                "follow_redirects": follow_redirects,
                "cookies": cookies,
            }
            if proxies:
                kwargs["proxy"] = proxies

            async with httpx.AsyncClient(**{k: v for k, v in kwargs.items() if k != "headers" and k != "cookies"}) as client:
                resp = await client.get(url, headers=merged_headers, cookies=cookies)

            # 检测风控
            risk, reason = is_risk_response(str(resp.url), resp.status_code, resp.text)
            if risk:
                logger.warning(f"[anti] 风控触发 {url[:80]}: {reason}")
                if proxy:
                    pool.mark_bad(proxy, reason)
                # 第 3 次还风控 → 标记 host 冷却
                if attempt >= max_retries - 1:
                    _cooldown.mark_bad(url, reason)
                # 等更久再试
                await asyncio.sleep(2 ** attempt + random.uniform(1, 3))
                continue

            # 5xx 重试
            if resp.status_code >= 500:
                logger.warning(f"[anti] HTTP {resp.status_code} {url[:80]}")
                await asyncio.sleep(2 ** attempt)
                continue

            return resp

        except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError) as e:
            last_err = e
            logger.warning(f"[anti] 网络错误 attempt {attempt+1}/{max_retries}: {e}")
            if proxy:
                pool.mark_bad(proxy, f"network: {e}")
            await asyncio.sleep(2 ** attempt + random.uniform(0.5, 1.5))
        except Exception as e:
            last_err = e
            logger.warning(f"[anti] 未知错误 {url[:80]}: {e}")
            await asyncio.sleep(2 ** attempt)

    logger.error(f"[anti] 最终失败 {url[:80]}, 最后错误: {last_err}")
    return None


# === 给 Playwright 用的代理 ===
def get_playwright_proxy() -> Optional[dict]:
    """返回 Playwright 启动时的 proxy 参数（dict 格式），无代理时返回 None。"""
    if not _proxy_pool.has_proxies():
        return None
    proxy = _proxy_pool.get()
    if not proxy:
        return None
    parsed = urlparse(proxy)
    out = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
    if parsed.username:
        out["username"] = parsed.username
    if parsed.password:
        out["password"] = parsed.password
    return out
