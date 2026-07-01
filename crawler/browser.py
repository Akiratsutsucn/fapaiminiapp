"""Playwright browser lifecycle manager — singleton pattern。

抗封堵：
- PROXY_POOL（多代理）支持 — 启动时随机挑一个，失败可调 restart_with_new_proxy() 换
- PROXY_URL（单代理）兼容旧配置
"""
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional
from urllib.parse import urlparse
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from loguru import logger

from .config import settings
from .anti_crawl import random_ua, STEALTH_SCRIPTS


def _parse_proxy_url(url: str) -> Optional[dict]:
    """把 'http://user:pass@host:port' 转成 Playwright 接受的 dict。"""
    if not url:
        return None
    parsed = urlparse(url)
    if not parsed.scheme:
        return None
    out = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port or ''}".rstrip(':')}
    if parsed.username:
        out["username"] = parsed.username
    if parsed.password:
        out["password"] = parsed.password
    return out


class PlaywrightBrowserManager:
    """Singleton manager for Playwright browser lifecycle."""

    def __init__(self):
        self._playwright = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._current_proxy: Optional[str] = None

    def _pick_proxy(self) -> Optional[dict]:
        """优先 快代理隧道(KDL_TUNNEL)，其次 PROXY_POOL，再次 PROXY_URL。"""
        # 快代理 TPS 隧道:每次浏览器会话生成随机「锁IP串」拼进密码,
        # 该会话内固定一个住宅出口IP(够加载SSR页面),重启浏览器换新锁串=换新IP。
        import os
        import random
        import string
        kdl_tunnel = os.getenv("KDL_TUNNEL", "").strip()
        kdl_user = os.getenv("KDL_USER", "").strip()
        kdl_pass = os.getenv("KDL_PASS", "").strip()
        if kdl_tunnel and kdl_user and kdl_pass:
            lock = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
            self._current_proxy = f"kdl:{lock}"
            logger.info(f"[browser] 使用快代理隧道 {kdl_tunnel} 锁IP串={lock}")
            return {
                "server": f"http://{kdl_tunnel}",
                "username": kdl_user,
                "password": f"{kdl_pass}:{lock}",  # 密码后加锁串,该会话固定一个IP
            }

        # 从 anti_block 全局代理池拿一个
        try:
            from .anti_block import get_proxy_pool
            pool = get_proxy_pool()
            if pool.has_proxies():
                p = pool.get()
                if p:
                    self._current_proxy = p
                    logger.info(f"[browser] 使用代理池: {p}")
                    return _parse_proxy_url(p)
        except Exception as e:
            logger.warning(f"[browser] 代理池读取失败: {e}")

        # fallback 到旧 PROXY_URL
        if settings.PROXY_URL:
            self._current_proxy = settings.PROXY_URL
            logger.info(f"[browser] 使用 PROXY_URL: {settings.PROXY_URL}")
            return _parse_proxy_url(settings.PROXY_URL)

        self._current_proxy = None
        return None

    async def start(self) -> None:
        logger.info("Launching Playwright browser...")
        self._playwright = await async_playwright().start()

        launch_kwargs = {
            "headless": settings.PLAYWRIGHT_HEADLESS,
            "slow_mo": settings.PLAYWRIGHT_SLOW_MO_MS,
            # 省内存启动参数:这台服务器内存有限,SSR 并发开多个 page 时易 OOM。
            # 这些参数大幅降低 Chromium 每实例/每页的内存占用。
            "args": [
                "--disable-dev-shm-usage",   # 不用 /dev/shm(常太小),用 /tmp,避免崩溃
                "--disable-gpu",
                "--no-sandbox",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding",
                "--disable-features=site-per-process,TranslateUI",  # 关闭每frame独立进程,省内存
                "--js-flags=--max-old-space-size=256",  # 限制单页JS堆
            ],
        }

        proxy = self._pick_proxy()
        if proxy:
            launch_kwargs["proxy"] = proxy

        browser_type = getattr(self._playwright, settings.PLAYWRIGHT_BROWSER)
        self._browser = await browser_type.launch(**launch_kwargs)

        # Create a persistent context with stealth
        self._context = await self._browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=random_ua(),
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
            geolocation={"latitude": 31.2304, "longitude": 121.4737},  # Shanghai
            permissions=["geolocation"],
        )

        # Inject stealth scripts
        for script in STEALTH_SCRIPTS:
            await self._context.add_init_script(script)

        logger.info("Playwright browser started successfully")

    async def restart_with_new_proxy(self) -> None:
        """换代理重启。被风控时调用此方法。

        隧道代理（TUNNEL_IP_CHANGE_URL 已配）：入口不变，先触发换出口 IP，再重启浏览器
        让新连接走新出口。非隧道：标记当前代理失效，重启时从池里挑下一个。
        """
        import asyncio
        from . import tunnel_proxy
        if tunnel_proxy.is_enabled():
            await asyncio.to_thread(tunnel_proxy.trigger_ip_change, "playwright restart")
            await asyncio.sleep(3)  # 等新 IP 生效
        elif self._current_proxy:
            try:
                from .anti_block import get_proxy_pool
                get_proxy_pool().mark_bad(self._current_proxy, "playwright restart")
            except Exception:
                pass
        await self.stop()
        await self.start()
        logger.info("[browser] 已换代理重启")

    async def stop(self) -> None:
        if self._context:
            try:
                await self._context.close()
            except Exception:
                pass
        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
        self._context = None
        self._browser = None
        self._playwright = None
        logger.info("Playwright browser stopped")

    async def new_page(self, **overrides) -> Page:
        """Create a new page with anti-crawl measures applied."""
        if not self._context:
            raise RuntimeError("Browser not started. Call start() first.")
        page = await self._context.new_page()
        page.set_default_timeout(settings.PLAYWRIGHT_TIMEOUT_MS)
        return page

    async def new_isolated_context(self) -> "BrowserContext":
        """创建全新的隔离 context（独立 cookie/storage），含 stealth 脚本。

        用于京东等会随抓取量累积风控状态的站点：每个城市用独立 context，
        避免上一城市抓取产生的 cookie/risk token 污染后续城市的接口请求。
        调用方负责 close()。
        """
        if not self._browser:
            raise RuntimeError("Browser not started. Call start() first.")
        ctx = await self._browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=random_ua(),
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
            geolocation={"latitude": 31.2304, "longitude": 121.4737},
            permissions=["geolocation"],
        )
        for script in STEALTH_SCRIPTS:
            await ctx.add_init_script(script)
        return ctx

    @property
    def context(self) -> BrowserContext:
        if not self._context:
            raise RuntimeError("Browser not started. Call start() first.")
        return self._context


# Global singleton
browser_manager = PlaywrightBrowserManager()
