"""Taobao SF (sf.taobao.com) crawler — list pagination + detail page fetching.

NOTE: sf.taobao.com requires Alipay login to browse auction listings.
Set TAOBAO_COOKIE in .env to a valid logged-in cookie string.
"""
import asyncio
from urllib.parse import quote

from playwright.async_api import Page, TimeoutError as PlaywrightTimeout
from loguru import logger

from .base import AbstractBrokerCrawler, ListItem
from ..browser import browser_manager
from ..anti_crawl import random_sleep
from ..config import settings
from ..utils.retry import retry_on_failure


class TaobaoSFCrawler(AbstractBrokerCrawler):
    """Crawler for sf.taobao.com (阿里拍卖·司法)."""

    platform = "阿里拍卖"

    # City GBK encoding used in Taobao SF URLs
    CITY_ENCODINGS = {
        "上海": "%C9%CF%BA%A3",
        "宁波": "%C4%FE%B2%A8",
    }

    CATEGORY_MAP = {
        "50025969": "住宅",
        "200782003": "商业",
        "200788003": "工业",
        "200798003": "其他",
        "50025970": "土地",
    }

    def __init__(self):
        self._page: Page | None = None
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
        """Inject Taobao auth cookies if configured."""
        cookie_str = settings.TAOBAO_COOKIE.strip()
        if not cookie_str:
            logger.info("[Taobao] No TAOBAO_COOKIE configured, proceeding without auth")
            return

        logger.info("[Taobao] Injecting auth cookies...")
        cookies = []
        for pair in cookie_str.split(";"):
            pair = pair.strip()
            if "=" in pair:
                name, value = pair.split("=", 1)
                cookies.append({
                    "name": name.strip(),
                    "value": value.strip(),
                    "domain": ".taobao.com",
                    "path": "/",
                })

        if cookies:
            await page.context.add_cookies(cookies)
            logger.info(f"[Taobao] Injected {len(cookies)} cookies")

    async def _detect_login_wall(self, page: Page) -> bool:
        """Check if the current page is a login wall."""
        detected = await page.evaluate("""
        () => {
            const text = document.body.textContent || '';
            // Taobao login wall indicators
            if (text.includes('亲，请登录') || text.includes('请登录') ||
                text.includes('login') && text.includes('password')) {
                return true;
            }
            // Check for login form
            if (document.querySelector('#login-form, .login-form, .J_Login, #J_Login')) {
                return true;
            }
            // Check URL
            if (window.location.href.includes('login.taobao.com')) {
                return true;
            }
            return false;
        }
        """)
        if detected:
            self._login_wall_detected = True
        return detected

    @retry_on_failure(max_retries=3, backoff_factor=2.0)
    async def collect_list_items(
        self, source_url: str, city: str, max_pages: int = 50
    ) -> list[ListItem]:
        """Paginate through a Taobao SF list page."""
        page = await self._get_page()
        items: list[ListItem] = []
        current_page = 1

        # Inject cookies before first navigation
        await self._inject_cookies(page)

        logger.info(f"[Taobao] Starting list collection: {source_url} (city={city})")

        # Navigate to first page
        try:
            await page.goto(source_url, wait_until="domcontentloaded", timeout=settings.LIST_PAGE_TIMEOUT_MS)
        except PlaywrightTimeout:
            logger.warning("[Taobao] Initial page load timeout")
            await page.goto(source_url, wait_until="networkidle", timeout=settings.LIST_PAGE_TIMEOUT_MS)

        await asyncio.sleep(2)

        # Check for login wall
        if await self._detect_login_wall(page):
            logger.error(
                "[Taobao] ⛔ LOGIN WALL DETECTED — sf.taobao.com requires Alipay login. "
                "Set TAOBAO_COOKIE in .env with a valid logged-in cookie string. "
                "To get a cookie: log into sf.taobao.com in Chrome, open DevTools → "
                "Application → Cookies → copy all cookies as 'name1=value1; name2=value2'"
            )
            return []

        while current_page <= max_pages:
            if current_page > 1:
                page_url = f"{source_url}?page={current_page}"
                logger.debug(f"[Taobao] Loading page {current_page}: {page_url}")
                try:
                    await page.goto(page_url, wait_until="domcontentloaded", timeout=settings.LIST_PAGE_TIMEOUT_MS)
                except PlaywrightTimeout:
                    await page.goto(page_url, wait_until="networkidle", timeout=settings.LIST_PAGE_TIMEOUT_MS)
                await asyncio.sleep(1)

            # Try multiple selector strategies
            try:
                await page.wait_for_selector(
                    "div.sf-content, div.item-list, div.auction-list, div.J_ItemList, "
                    "div[class*='item'], div.list-content",
                    timeout=15000,
                )
            except PlaywrightTimeout:
                logger.warning(f"[Taobao] Item list not found on page {current_page}")
                if current_page == 1:
                    # On first page, check for login wall again
                    if await self._detect_login_wall(page):
                        logger.error("[Taobao] Login wall appeared after initial load")
                    break

            # Scroll for lazy loading
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(1)

            page_items = await self._extract_list_items(page)
            if not page_items:
                logger.info(f"[Taobao] No items on page {current_page}, stopping pagination")
                break

            items.extend(page_items)
            logger.info(f"[Taobao] Page {current_page}: {len(page_items)} items (total: {len(items)})")

            if not await self._has_next_page(page):
                logger.info(f"[Taobao] No more pages after page {current_page}")
                break

            current_page += 1
            await random_sleep(settings.MIN_DELAY_SEC, settings.MAX_DELAY_SEC)

        logger.info(f"[Taobao] Collection complete: {len(items)} items from {current_page} pages")
        return items

    async def _extract_list_items(self, page: Page) -> list[ListItem]:
        """Extract ListItem data from the current list page."""
        raw_items = await page.evaluate("""
        () => {
            const items = [];
            const seen = new Set();

            // Strategy 1: Known Taobao SF selectors
            const cards = document.querySelectorAll(
                'div.sf-content div.item, div.item-list > div, ' +
                'div.auction-list > div.item, div.J_ItemList > div, ' +
                'div[data-spm] a[href*="/item"], div.item, li.item, div.auction-item'
            );

            cards.forEach(card => {
                const link = card.querySelector(
                    'a[href*="sf-item"], a[href*="sf.taobao.com/item"], ' +
                    'a[href*="detail"], a[href*="item.htm"]'
                );
                if (!link || !link.href) return;
                const href = link.href;
                if (seen.has(href)) return;
                seen.add(href);

                const titleEl = card.querySelector('.title, h3, h4, [class*="title"], [class*="name"]');
                const priceEl = card.querySelector('.price, .starting-price, [class*="price"], [class*="Price"]');
                const statusEl = card.querySelector('.status, [class*="status"], [class*="Status"]');
                const districtEl = card.querySelector('.location, .district, [class*="district"], [class*="addr"]');
                const areaEl = card.querySelector('.area, [class*="area"], [class*="Area"]');

                items.push({
                    source_url: href,
                    title: titleEl ? titleEl.textContent.trim().substring(0, 100) : '',
                    starting_price_text: priceEl ? priceEl.textContent.trim() : '',
                    auction_status: statusEl ? statusEl.textContent.trim() : '',
                    district: districtEl ? districtEl.textContent.trim() : '',
                    area_text: areaEl ? areaEl.textContent.trim() : '',
                });
            });

            // Strategy 2: Scan all sf.taobao.com detail links
            if (items.length === 0) {
                document.querySelectorAll('a[href]').forEach(a => {
                    const href = (a.href || '').trim();
                    if (!href || seen.has(href)) return;
                    if (href.includes('sf.taobao.com') || href.includes('sf-item')) {
                        if (href.includes('detail') || href.includes('item') || href.includes('sf-item')) {
                            seen.add(href);
                            items.push({
                                source_url: href,
                                title: (a.textContent || '').trim().substring(0, 100),
                                starting_price_text: '',
                                auction_status: '',
                                district: '',
                                area_text: '',
                            });
                        }
                    }
                });
            }

            return items;
        }
        """)
        return [
            ListItem(
                source_url=item["source_url"],
                title=item.get("title", ""),
                starting_price_text=item.get("starting_price_text", ""),
                auction_status=item.get("auction_status", ""),
                district=item.get("district", ""),
                area_text=item.get("area_text", ""),
            )
            for item in raw_items
        ]

    async def _has_next_page(self, page: Page) -> bool:
        result = await page.evaluate("""
        () => {
            const nextBtn = document.querySelector(
                '.pagination .next:not(.disabled), .page-next:not(.disabled), ' +
                'a.next:not(.disabled), li.next:not(.disabled) a'
            );
            if (nextBtn) return true;
            for (const a of document.querySelectorAll('a')) {
                if (a.textContent.includes('下一页') && !a.classList.contains('disabled')) return true;
            }
            return false;
        }
        """)
        return bool(result)

    @retry_on_failure(max_retries=2, backoff_factor=2.0)
    async def fetch_detail(self, detail_url: str) -> str:
        """Navigate to a Taobao SF detail page and return rendered HTML."""
        page = await self._get_page()

        logger.debug(f"[Taobao] Fetching detail: {detail_url}")
        try:
            await page.goto(detail_url, wait_until="domcontentloaded", timeout=settings.DETAIL_PAGE_TIMEOUT_MS)
        except PlaywrightTimeout:
            logger.warning(f"[Taobao] Detail page slow load: {detail_url}")
            await page.goto(detail_url, wait_until="networkidle", timeout=settings.DETAIL_PAGE_TIMEOUT_MS)

        await asyncio.sleep(1.5)

        # Check login wall
        if await self._detect_login_wall(page):
            logger.error(f"[Taobao] Login wall on detail page — cookie may have expired")
            return ""

        try:
            await page.wait_for_selector(
                "div.sf-item-detail, div.item-detail, div.detail-content, div.main-content, "
                "div[class*='detail'], div[class*='Detail'], table",
                timeout=10000,
            )
        except PlaywrightTimeout:
            logger.warning(f"[Taobao] Detail content not found: {detail_url}")

        await random_sleep(0.5, 1.5)
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(0.5)
        await page.evaluate("window.scrollTo(0, 0)")
        await asyncio.sleep(0.5)

        return await page.content()
