"""GPai (公拍网) crawler — 适应公拍网新架构（搜索 endpoint 已下线）。

策略：
1. 抓 https://www.gpai.net/sf/ 主页所有 item2.do 链接
2. 从已知最大 ID 起递增扫描 ID（默认扫 200 个）发现新房源
3. 每个详情页通过 city_id 过滤
"""
import asyncio
import re
from urllib.parse import urlparse, parse_qs

from playwright.async_api import Page, TimeoutError as PlaywrightTimeout
from loguru import logger

from .base import AbstractBrokerCrawler, ListItem
from ..browser import browser_manager
from ..anti_crawl import random_sleep
from ..config import settings
from ..utils.retry import retry_on_failure

# Pattern to extract Web_Item_ID
_ITEM_ID_RE = re.compile(r"Web_Item_ID=(\d+)")

# 当前已知最大 ID（每次爬取后会更新）
DEFAULT_START_SCAN_ID = 52772
SCAN_RANGE = 200  # 从 max_id+1 起扫这么多个新 ID


class GPaiCrawler(AbstractBrokerCrawler):
    """Crawler for 公拍网 — 适配新架构。"""

    platform = "公拍网"
    BASE_URL = "https://www.gpai.net"

    def __init__(self):
        self._page: Page | None = None
        self._cookies_injected = False
        self._login_wall_detected = False

    async def _get_page(self) -> Page:
        if not self._page:
            self._page = await browser_manager.new_page()
        return self._page

    async def close(self) -> None:
        if self._page:
            await self._page.close()
            self._page = None

    async def _inject_cookies(self, page: Page) -> None:
        """如果 GPAI_COOKIE 已配置，注入登录态 cookie。"""
        if self._cookies_injected:
            return
        cookie_str = (settings.GPAI_COOKIE or "").strip()
        if not cookie_str:
            self._cookies_injected = True
            return  # 不需要 cookie，公拍网默认 anonymous 可访问

        cookies = []
        for pair in cookie_str.split(";"):
            pair = pair.strip()
            if "=" in pair:
                name, value = pair.split("=", 1)
                cookies.append({
                    "name": name.strip(),
                    "value": value.strip(),
                    "domain": ".gpai.net",
                    "path": "/",
                })
        if cookies:
            await page.context.add_cookies(cookies)
            logger.info(f"[GPai] Injected {len(cookies)} cookies")
        self._cookies_injected = True

    async def _detect_login_wall(self, page: Page) -> bool:
        """检测当前页面是否变成了登录墙/登录提示。"""
        try:
            detected = await page.evaluate("""
            () => {
                const text = (document.body.textContent || '');
                if (text.includes('请先登录') || text.includes('请登录后') ||
                    text.includes('您还没有登录')) {
                    return true;
                }
                if (window.location.href.includes('/login') || window.location.href.includes('/Login')) {
                    return true;
                }
                if (document.querySelector('input[type=password]')) {
                    return true;
                }
                return false;
            }
            """)
        except Exception:
            return False
        if detected and not self._login_wall_detected:
            self._login_wall_detected = True
            logger.error(
                "[GPai] LOGIN WALL DETECTED — 公拍网开始要求登录才能访问。"
                " 请运行 python update_gpai_cookie.py 提取本地 Chrome cookie 后再启动爬虫。"
            )
        return detected

    @retry_on_failure(max_retries=2, backoff_factor=2.0)
    async def collect_list_items(
        self, source_url: str, city: str, max_pages: int = 50
    ) -> list[ListItem]:
        """收集 item2.do 链接：主页 + ID 扫描。

        source_url 现在仅作为 city 标识（参数兼容老配置）。
        实际抓取从 www.gpai.net/sf/ 主页 + ID 扫描，详情解析在 fetch_detail 中。
        """
        page = await self._get_page()
        items: list[ListItem] = []
        seen_ids: set[str] = set()

        # 0. 注入 cookie（如已配置）
        await self._inject_cookies(page)

        # 1. 抓主页所有 item2.do 链接
        try:
            await page.goto(f"{self.BASE_URL}/sf/", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)

            # 登录墙检测：若公拍网开始要求登录则直接返回空
            if await self._detect_login_wall(page):
                return []

            home_links = await page.evaluate("""
            () => {
                const result = [];
                const seen = new Set();
                document.querySelectorAll('a[href*="item2.do"]').forEach(a => {
                    const href = a.href || '';
                    const m = href.match(/Web_Item_ID=(\\d+)/);
                    if (m && !seen.has(m[1])) {
                        seen.add(m[1]);
                        result.push({
                            id: m[1],
                            href: href,
                            text: (a.textContent || '').trim().substring(0, 200)
                        });
                    }
                });
                return result;
            }
            """)
            logger.info(f"[GPai] 首页发现 {len(home_links)} 个房源链接")
            for link in home_links:
                if link["id"] not in seen_ids:
                    seen_ids.add(link["id"])
                    items.append(ListItem(
                        source_url=f"{self.BASE_URL}/sf/item2.do?Web_Item_ID={link['id']}",
                        title=link.get("text", "")[:200],
                    ))
        except Exception as e:
            logger.warning(f"[GPai] 抓主页失败: {e}")

        # 2. 从最大 ID 开始递增扫描发现新房源
        try:
            from ..storage.db import get_session
            from sqlalchemy import select
            # 用 raw SQL 查 max(Web_Item_ID) 避开 ORM 路径问题
            from sqlalchemy import text
            db = await get_session()
            try:
                result = await db.execute(text(
                    "SELECT source_url FROM properties WHERE auction_platform='公拍网' "
                    "AND source_url LIKE '%Web_Item_ID=%' ORDER BY id DESC LIMIT 100"
                ))
                rows = [r[0] for r in result.fetchall()]
                max_id = DEFAULT_START_SCAN_ID
                for url in rows:
                    m = _ITEM_ID_RE.search(url or "")
                    if m:
                        max_id = max(max_id, int(m.group(1)))
            finally:
                await db.close()
        except Exception as e:
            logger.warning(f"[GPai] 查询 max_id 失败，使用默认值 {DEFAULT_START_SCAN_ID}: {e}")
            max_id = DEFAULT_START_SCAN_ID

        logger.info(f"[GPai] 从 ID {max_id+1} 起扫描 {SCAN_RANGE} 个 ID 发现新房源")
        scan_start = max_id + 1
        scan_end = scan_start + SCAN_RANGE

        for new_id in range(scan_start, scan_end):
            sid = str(new_id)
            if sid in seen_ids:
                continue
            seen_ids.add(sid)
            items.append(ListItem(
                source_url=f"{self.BASE_URL}/sf/item2.do?Web_Item_ID={sid}",
                title="",  # 详情页解析时再填
            ))

        logger.info(f"[GPai] 共收集 {len(items)} 个待爬房源（首页 + ID 扫描）")
        return items

    @retry_on_failure(max_retries=4, backoff_factor=2.0)
    async def fetch_detail(self, detail_url: str) -> str:
        """抓取详情页 HTML。"""
        page = await self._get_page()
        # 注入 cookie（首次会真注入，后续直接 return）
        await self._inject_cookies(page)

        if detail_url.startswith("//"):
            detail_url = "https:" + detail_url
        # 老 URL 用 s.gpai.net，迁移到 www.gpai.net
        detail_url = detail_url.replace("https://s.gpai.net/", "https://www.gpai.net/")

        logger.debug(f"[GPai] Fetching detail: {detail_url[:120]}")
        # 提到 60s（详情页常因加载图片/广告慢）；用 domcontentloaded（不必等所有资源）
        try:
            await page.goto(detail_url, wait_until="domcontentloaded", timeout=60000)
        except PlaywrightTimeout:
            logger.warning(f"[GPai] Detail page slow (>60s): {detail_url[:120]}")
            # 即使超时也试着拿当前已加载内容（部分 HTML 即可解析）
            try:
                content = await page.content()
                if content and "<title" in content.lower():
                    return content
            except Exception:
                pass
            raise  # 触发 retry_on_failure 的下一次重试

        await asyncio.sleep(2)
        # 详情页登录墙检测：若已检测到不再重复检测
        if not self._login_wall_detected:
            await self._detect_login_wall(page)

        await random_sleep(0.3, 1.0)
        return await page.content()
