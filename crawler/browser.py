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
        """优先 PROXY_POOL，其次 PROXY_URL。"""
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

    @property
    def context(self) -> BrowserContext:
        if not self._context:
            raise RuntimeError("Browser not started. Call start() first.")
        return self._context


# Global singleton
browser_manager = PlaywrightBrowserManager()
