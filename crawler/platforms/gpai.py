"""GPai (公拍网) crawler — 适应公拍网新架构（搜索 endpoint 已下线）。

策略：
1. 抓 https://www.gpai.net/sf/ 主页所有 item2.do 链接
2. 从已知最大 ID 起递增扫描 ID（默认扫 200 个）发现新房源
3. 每个详情页通过 city_id 过滤
"""
import asyncio
import re
from urllib.parse import urlparse, parse_qs

import httpx
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

# 城市 → 公拍网 cityNum（s.gpai.net 城市精确搜索参数）
CITY_NUM_MAP = {"上海": "31", "宁波": "3302", "杭州": "3301"}
# 资产类型 at 参数：376/381 覆盖住宅+商业等不动产类型
GPAI_ASSET_TYPES = ["376", "381"]


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

    async def _fetch_city_search_ids(self, city: str) -> list[ListItem]:
        """用住宅代理 + cookie 握手，从 s.gpai.net 城市精确搜索抓房源 ID。

        s.gpai.net 封服务器 IP（403），需住宅代理。流程：先访问 www.gpai.net/sf/
        种 cookie，再带 cookie 请求 s.gpai.net/sf/search.do?at=&cityNum=。
        仅抓列表（流量小），详情页仍走服务器直连。GPAI_PROXY 未配置则跳过。
        """
        proxy = (settings.GPAI_PROXY or "").strip()
        city_num = CITY_NUM_MAP.get(city)
        if not proxy or not city_num:
            return []

        ua = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        items: list[ListItem] = []
        seen: set[str] = set()
        try:
            async with httpx.AsyncClient(
                proxy=proxy, timeout=40, follow_redirects=True,
                headers={"User-Agent": ua},
            ) as client:
                # 1. 访问主站种 cookie
                await client.get("https://www.gpai.net/sf/")
                # 2. 每个资产类型分别搜索
                for at in GPAI_ASSET_TYPES:
                    url = f"https://s.gpai.net/sf/search.do?at={at}&cityNum={city_num}"
                    try:
                        resp = await client.get(url, headers={"Referer": "https://www.gpai.net/sf/"})
                    except Exception as e:
                        logger.warning(f"[GPai] 城市搜索请求失败 city={city} at={at}: {e}")
                        continue
                    if resp.status_code != 200:
                        logger.warning(f"[GPai] 城市搜索 HTTP {resp.status_code} city={city} at={at}")
                        continue
                    for m in _ITEM_ID_RE.finditer(resp.text):
                        sid = m.group(1)
                        if sid not in seen:
                            seen.add(sid)
                            items.append(ListItem(
                                source_url=f"{self.BASE_URL}/sf/item2.do?Web_Item_ID={sid}",
                                title="",
                            ))
                    await asyncio.sleep(1.5)
            logger.info(f"[GPai] 住宅代理城市搜索 city={city}: 发现 {len(items)} 个房源")
        except Exception as e:
            logger.warning(f"[GPai] 城市搜索整体失败 city={city}: {e}")
        return items

    @retry_on_failure(max_retries=2, backoff_factor=2.0)
    async def collect_list_items(
        self, source_url: str, city: str, max_pages: int = 50
    ) -> list[ListItem]:
        """收集 item2.do 链接：城市精确搜索（住宅代理）+ 主页 + ID 扫描。

        source_url 现在仅作为 city 标识（参数兼容老配置）。
        实际抓取从 www.gpai.net/sf/ 主页 + ID 扫描，详情解析在 fetch_detail 中。
        """
        page = await self._get_page()
        items: list[ListItem] = []
        seen_ids: set[str] = set()

        # 0. 注入 cookie（如已配置）
        await self._inject_cookies(page)

        # 0.5 城市精确搜索（住宅代理）—— 优先，确保抓到目标城市（尤其杭州/宁波）
        try:
            city_items = await self._fetch_city_search_ids(city)
            for it in city_items:
                m = _ITEM_ID_RE.search(it.source_url)
                sid = m.group(1) if m else None
                if sid and sid not in seen_ids:
                    seen_ids.add(sid)
                    items.append(it)
        except Exception as e:
            logger.warning(f"[GPai] 城市搜索阶段异常: {e}")

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

        # 2. ID 递增扫描（仅兜底）：城市精确搜索已能拿到目标城市真实房源，
        #    盲扫大量连续 ID 会触发 www.gpai.net 风控（403冷却）。仅当城市搜索+主页
        #    几乎没拿到房源时，才小范围扫描兜底。
        proxy_configured = bool((settings.GPAI_PROXY or "").strip())
        do_scan = (len(items) < 5) or (not proxy_configured)
        scan_range = SCAN_RANGE if not proxy_configured else 30
        if do_scan:
            try:
                from ..storage.db import get_session
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

            logger.info(f"[GPai] 兜底扫描：从 ID {max_id+1} 起扫 {scan_range} 个 ID")
            for new_id in range(max_id + 1, max_id + 1 + scan_range):
                sid = str(new_id)
                if sid in seen_ids:
                    continue
                seen_ids.add(sid)
                items.append(ListItem(
                    source_url=f"{self.BASE_URL}/sf/item2.do?Web_Item_ID={sid}",
                    title="",  # 详情页解析时再填
                ))
        else:
            logger.info(f"[GPai] 城市搜索已获 {len(items)} 个房源，跳过 ID 扫描（避免风控）")

        logger.info(f"[GPai] 共收集 {len(items)} 个待爬房源")
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
