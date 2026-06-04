"""JD Auction (jd.com) crawler — 数据 API 驱动（取代脆弱的 DOM 滚动抓取）。

京东拍卖搜索页 pmsearch.jd.com 是 React SPA，列表数据来自带 h5st 签名的接口
`paimai_unifiedSearch`（签名由页面 JS 生成，无法离线伪造），故用 Playwright 加载页面
并拦截该接口的 JSON 响应；翻页通过点击「下一页」让页面重新签名请求。

详情/多图通过 `getProductBasicInfo` 接口获取——该接口无需 h5st 签名，可用 httpx 直连，
因此彻底绕开了 SSR 详情页的反爬（net::ERR_EMPTY_RESPONSE）。

按返回数据里的 province/city 字段过滤目标城市（上海/宁波/杭州），不依赖 JD 的 cityId 编码。
"""
import asyncio
import json
import re
import urllib.parse

from playwright.async_api import Page, TimeoutError as PlaywrightTimeout
from loguru import logger

from .base import AbstractBrokerCrawler, ListItem
from ..browser import browser_manager
from ..anti_crawl import random_sleep
from ..config import settings
from ..utils.retry import retry_on_failure

# Pattern for valid auction detail URLs: //paimai.jd.com/<digits>
_AUCTION_URL_RE = re.compile(r"paimai\.jd\.com/(\d+)")

# 京东图片 CDN 前缀（imagePath 形如 jfs/t1/.../xxx.jpg）
JD_IMG_PREFIX = "https://img10.360buyimg.com/n0/"

# 目标城市：返回数据的 city 字段值 → city_id
JD_CITY_MAP = {
    "上海": 310000, "上海市": 310000,
    "宁波市": 330200, "宁波": 330200,
    "杭州市": 330100, "杭州": 330100,
}


def _is_auction_detail_url(href: str) -> bool:
    """Check if an href is a JD auction detail link (not notice/help/nav)."""
    if not href:
        return False
    return bool(_AUCTION_URL_RE.search(href))


class JDAuctionCrawler(AbstractBrokerCrawler):
    """Crawler for JD judicial auction (京东拍卖·司法)。API 驱动。"""

    platform = "京东拍卖"

    BASE_SEARCH_URL = "https://pmsearch.jd.com/?publishSource=7&childrenCateId=12728"

    def __init__(self):
        self._page: Page | None = None
        self._row_cache: dict[str, dict] = {}  # paimaiId → 列表 API 原始行

    async def _get_page(self) -> Page:
        if not self._page:
            self._page = await browser_manager.new_page()
        return self._page

    async def close(self) -> None:
        if self._page:
            await self._page.close()
            self._page = None

    @retry_on_failure(max_retries=2, backoff_factor=2.0)
    async def collect_list_items(
        self, source_url: str | None = None, city: str = "上海", max_pages: int = 50
    ) -> list[ListItem]:
        """通过拦截 paimai_unifiedSearch 接口 JSON 收集列表（取代 DOM 滚动）。

        翻页：点击「下一页」让页面 JS 重新生成带 h5st 签名的请求。
        过滤：按返回数据的 city/province 字段保留目标城市，不依赖 JD cityId 编码。
        """
        url = source_url or self.BASE_SEARCH_URL
        # 每个城市用全新的隔离 context（独立 cookie/storage），避免上一城市抓取累积的
        # 风控状态污染本次接口请求（实测上海抓完后，宁波/杭州的省级接口会被静默拒绝返回0）。
        ctx = await browser_manager.new_isolated_context()
        page = await ctx.new_page()
        logger.info(f"[JD] Starting search: city={city}")

        target_id = JD_CITY_MAP.get(city) or JD_CITY_MAP.get(city + "市")
        rows: dict[str, dict] = {}      # paimaiId → row（去重）
        captured: list[dict] = []       # 本次拦截到的接口响应

        async def on_resp(resp):
            if "paimai_unifiedSearch" not in resp.url:
                return
            try:
                captured.append(await resp.json())
            except Exception:
                pass

        page.on("response", lambda r: asyncio.create_task(on_resp(r)))

        # 首屏加载（带重试）：京东列表接口偶发空响应（反爬限流），重载+加长等待重试。
        async def _load_until_data(max_attempts: int = 3) -> bool:
            for attempt in range(max_attempts):
                try:
                    await page.goto(url, wait_until="domcontentloaded",
                                    timeout=settings.LIST_PAGE_TIMEOUT_MS)
                except PlaywrightTimeout:
                    logger.warning(f"[JD] 列表页加载超时(第{attempt+1}次): {url}")
                # 等接口返回；逐步加长等待
                for _ in range(6 + attempt * 4):
                    await asyncio.sleep(1.5)
                    if captured:
                        return True
                if attempt < max_attempts - 1:
                    # 限流恢复需要时间，重试前冷却递增（15s, 30s）
                    cool = 15 + attempt * 15
                    logger.info(f"[JD] {city} 首屏无数据，冷却 {cool}s 后重载重试({attempt+2}/{max_attempts})")
                    await asyncio.sleep(cool)
            return bool(captured)

        await _load_until_data()

        def _harvest():
            """把已拦截的响应并入 rows，按城市过滤。返回本批新增数。"""
            added = 0
            while captured:
                j = captured.pop(0)
                for it in (j.get("datas") or []):
                    pid = str(it.get("productId") or it.get("id") or "")
                    if not pid or pid in rows:
                        continue
                    # 按城市过滤：命中目标城市才保留
                    cid = self._match_city(it)
                    if target_id and cid != target_id:
                        continue
                    if not target_id and cid is None:
                        continue
                    it["_city_id"] = cid
                    rows[pid] = it
                    added += 1
            return added

        _harvest()
        # 翻页：点击「下一页」直到无新增或达上限
        max_clicks = max(10, max_pages)
        stale = 0
        for _ in range(max_clicks):
            clicked = await page.evaluate("""() => {
                const els = document.querySelectorAll('a, button, span, div, li');
                for (const e of els) {
                    if ((e.textContent || '').trim() === '下一页' && e.offsetParent !== null) {
                        e.click(); return true;
                    }
                }
                return false;
            }""")
            await asyncio.sleep(2.8)
            added = _harvest()
            if not clicked or added == 0:
                stale += 1
                if stale >= 2:
                    break
            else:
                stale = 0

        # 缓存原始行供 fetch_detail_api 使用
        for pid, row in rows.items():
            self._row_cache[pid] = row

        try:
            await page.close()  # 关闭本城市专用页面
            await ctx.close()    # 关闭隔离 context，释放 cookie/监听器
        except Exception:
            pass

        logger.info(f"[JD] {city}: 收集到 {len(rows)} 套（接口直取）")
        return [
            ListItem(
                source_url=f"https://paimai.jd.com/{pid}?itemId={pid}",
                title=row.get("title", ""),
                district=(row.get("city") or "").replace("市", ""),
                address=row.get("productAddress", ""),
            )
            for pid, row in rows.items()
        ]

    @staticmethod
    def _match_city(item: dict) -> int | None:
        """根据接口返回的 province/city 字段判定 city_id（目标三市之一），否则 None。"""
        for key in ("city", "province", "courtCityName"):
            v = (item.get(key) or "").strip()
            if not v:
                continue
            if v in JD_CITY_MAP:
                return JD_CITY_MAP[v]
            # 上海是直辖市，province=上海、city=具体区
            if "上海" in v:
                return 310000
            if "宁波" in v:
                return 330200
            if "杭州" in v:
                return 330100
        return None

    async def fetch_detail_api(self, paimai_id: str) -> dict | None:
        """调 getProductBasicInfo 接口（无需 h5st 签名，httpx 直连）拿详情+多图。

        返回合并后的 dict：列表行 + 详情字段 + 图片列表。供 JDDetailParser.parse 使用。
        """
        paimai_id = str(paimai_id)
        row = dict(self._row_cache.get(paimai_id) or {})
        detail = {}
        try:
            import httpx
            headers = {
                "Referer": "https://paimai.jd.com/",
                "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                               "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
            }
            async with httpx.AsyncClient(timeout=15, headers=headers) as client:
                resp = await client.get(
                    "https://api.m.jd.com/api",
                    params={
                        "appid": "paimai",
                        "functionId": "getProductBasicInfo",
                        "body": json.dumps({"paimaiId": int(paimai_id)}),
                        "loginType": "3",
                    },
                )
                detail = (resp.json() or {}).get("data", {}) or {}
        except Exception as e:
            logger.debug(f"[JD] getProductBasicInfo failed for {paimai_id}: {e}")

        if not row and not detail:
            return None

        # 图片：详情 paimaiImageResultList[].imagePath；缺失时回退列表 productImage
        images = []
        for im in (detail.get("paimaiImageResultList") or []):
            p = (im.get("imagePath") or "").strip()
            if p:
                images.append(JD_IMG_PREFIX + p)
        if not images and row.get("productImage"):
            images.append(JD_IMG_PREFIX + str(row["productImage"]).strip())

        # 合并：详情覆盖列表，但详情的空值不得覆盖列表的有效值
        merged = dict(row)
        for k, v in detail.items():
            if v in (None, "", 0, 0.0) and merged.get(k) not in (None, "", 0, 0.0):
                continue  # 详情为空、列表有值 → 保留列表值
            merged[k] = v
        merged["_images"] = images
        merged["_paimai_id"] = paimai_id
        merged["_city_id"] = row.get("_city_id")
        return merged

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
