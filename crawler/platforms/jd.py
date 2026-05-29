"""JD Auction (jd.com) crawler — DOM extraction with URL pattern matching.

JD's auction search at pmsearch.jd.com renders auction cards with links in the format:
  //paimai.jd.com/<9-digit-paimaiId>

The link text contains: title, location, price, status, bid count, remaining time.
"""
import asyncio
import re

from playwright.async_api import Page, TimeoutError as PlaywrightTimeout
from loguru import logger

from .base import AbstractBrokerCrawler, ListItem
from ..browser import browser_manager
from ..anti_crawl import random_sleep
from ..config import settings
from ..utils.retry import retry_on_failure

# Pattern for valid auction detail URLs: //paimai.jd.com/<digits>
_AUCTION_URL_RE = re.compile(r"paimai\.jd\.com/(\d+)")


def _is_auction_detail_url(href: str) -> bool:
    """Check if an href is a JD auction detail link (not notice/help/nav)."""
    if not href:
        return False
    return bool(_AUCTION_URL_RE.search(href))


class JDAuctionCrawler(AbstractBrokerCrawler):
    """Crawler for JD judicial auction (京东拍卖·司法)."""

    platform = "京东拍卖"

    BASE_SEARCH_URL = "https://pmsearch.jd.com/?publishSource=7&childrenCateId=12728"

    def __init__(self):
        self._page: Page | None = None

    async def _get_page(self) -> Page:
        if not self._page:
            self._page = await browser_manager.new_page()
        return self._page

    async def close(self) -> None:
        if self._page:
            await self._page.close()
            self._page = None

    @retry_on_failure(max_retries=3, backoff_factor=2.0)
    async def collect_list_items(
        self, source_url: str | None = None, city: str = "上海", max_pages: int = 50
    ) -> list[ListItem]:
        """Scroll through JD PM search results (React SPA with infinite scroll)."""
        url = source_url or self.BASE_SEARCH_URL
        page = await self._get_page()
        items: list[ListItem] = []

        logger.info(f"[JD] Starting search: city={city}")
        await page.goto(url, wait_until="domcontentloaded", timeout=settings.LIST_PAGE_TIMEOUT_MS)

        # JD PM search is a React SPA — wait for hydration
        await asyncio.sleep(3)
        try:
            await page.wait_for_selector(
                "a[href*='paimai.jd.com/']",
                timeout=20000,
            )
        except PlaywrightTimeout:
            logger.warning("[JD] Auction links not found via primary wait")

        # Try city filter
        await self._apply_city_filter(page, city)
        await random_sleep(1, 2)

        # Scroll to load items (infinite scroll SPA)
        seen_urls: set[str] = set()
        stale_count = 0
        max_scrolls = max(20, max_pages)

        for scroll_i in range(max_scrolls):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(2.5)

            page_items = await self._extract_auction_items(page)
            new_count = 0
            for it in page_items:
                if it.source_url not in seen_urls:
                    seen_urls.add(it.source_url)
                    items.append(it)
                    new_count += 1

            logger.debug(f"[JD] Scroll {scroll_i + 1}: {len(page_items)} visible, {new_count} new ({len(items)} total)")

            if new_count == 0:
                stale_count += 1
                if stale_count >= 3:
                    logger.info(f"[JD] No new items after 3 scrolls, stopping. Total: {len(items)}")
                    break
            else:
                stale_count = 0

        logger.info(f"[JD] Collection complete: {len(items)} items for {city}")
        return items

    async def _apply_city_filter(self, page: Page, city: str) -> None:
        """Click the city tab on JD PM search page."""
        target = city
        try:
            clicked = await page.evaluate(f"""
            () => {{
                const els = document.querySelectorAll('span, a, div, li, button');
                for (const el of els) {{
                    if (el.textContent.trim() === '{target}' && el.offsetParent !== null) {{
                        el.click();
                        return true;
                    }}
                }}
                return false;
            }}
            """)
            if clicked:
                logger.info(f"[JD] Clicked city filter: {target}")
                await asyncio.sleep(2)  # Wait for React to re-render results
            else:
                logger.info(f"[JD] City filter '{target}' not found, using default results")
        except Exception as e:
            logger.debug(f"[JD] City filter click failed (non-critical): {e}")

    async def _extract_auction_items(self, page: Page) -> list[ListItem]:
        """Extract auction items by finding all paimai.jd.com/<digits> links.

        The link text contains: location, title, prices, status, bid count.
        Example link text:
          "南京市江宁区禄口街道天禄大道1号博恩花园94幢402室不动产
           南京市当前价:¥36.13万市场价:¥64.51万1次出价进行中预计剩余:1小时..."
        """
        raw = await page.evaluate("""
        () => {
            const items = [];
            const seen = new Set();

            // Find ALL links matching //paimai.jd.com/<digits>
            document.querySelectorAll('a[href*="paimai.jd.com/"]').forEach(a => {
                const href = (a.href || '').trim();
                // Match pattern: paimai.jd.com/<digits> (not notice/help/etc.)
                const match = href.match(/paimai\\.jd\\.com\\/(\\d+)/);
                if (!match || match[0].includes('notice')) return;
                if (seen.has(href)) return;
                seen.add(href);

                // Normalize protocol-relative URL
                const fullUrl = href.startsWith('//') ? 'https:' + href : href;

                // Extract structured data from link text
                const text = (a.textContent || '').trim();

                // Extract price: 当前价:¥XX.XX万
                let priceText = '';
                const priceMatch = text.match(/当前价[：:]\\s*[¥￥]?\\s*([\\d,.]+)\\s*(万|亿|元)?/);
                if (priceMatch) priceText = priceMatch[0].substring(0, 30);

                // Extract appraisal/market price
                let appraisalText = '';
                const apprMatch = text.match(/(?:评估价|市场价)[：:]\\s*[¥￥]?\\s*([\\d,.]+)\\s*(万|亿|元)?/);
                if (apprMatch) appraisalText = apprMatch[0].substring(0, 30);

                // Extract status: 进行中/已结束/已成交 etc.
                let status = '';
                const statusMatch = text.match(/(进行中|已结束|已成交|即将开拍|已撤回|中止|流拍)/);
                if (statusMatch) status = statusMatch[1];

                items.push({
                    source_url: fullUrl,
                    title: text.substring(0, 200),
                    starting_price_text: priceText,
                    auction_status: status,
                    district: '',  // parse from detail page
                    area_text: appraisalText,
                });
            });
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
            for item in raw
        ]

    @retry_on_failure(max_retries=2, backoff_factor=2.0)
    async def fetch_detail(self, detail_url: str) -> str:
        """Navigate to a JD auction detail page and return rendered HTML.

        Uses a dedicated page per request to avoid ERR_ABORTED from
        concurrent navigation on a shared page.
        """
        if detail_url.startswith("//"):
            detail_url = "https:" + detail_url

        page = await browser_manager.new_page()
        try:
            logger.debug(f"[JD] Fetching detail: {detail_url}")
            try:
                await page.goto(detail_url, wait_until="domcontentloaded", timeout=settings.DETAIL_PAGE_TIMEOUT_MS)
            except PlaywrightTimeout:
                logger.warning(f"[JD] Detail page slow: {detail_url}")
                await page.goto(detail_url, wait_until="networkidle", timeout=settings.DETAIL_PAGE_TIMEOUT_MS)

            await asyncio.sleep(2)
            try:
                await page.wait_for_selector(
                    "div.detail, div.pm-detail, div.auction-detail, div[class*='detail'], "
                    "table.detail, div.main-content, div[class*='info']",
                    timeout=10000,
                )
            except PlaywrightTimeout:
                logger.warning(f"[JD] Detail content not found: {detail_url}")

            # Scroll for lazy images
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(0.5)
            await page.evaluate("window.scrollTo(0, 0)")
            await asyncio.sleep(0.5)

            return await page.content()
        finally:
            await page.close()
