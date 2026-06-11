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

from bs4 import BeautifulSoup
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

# 列表级动产粗筛（用户 2026-06-10）：京东搜索改全类目(publishSource=7)后会混入大量
# 动产标的(玉石/首饰/车辆/机械/股权…)，逐个渲染详情再判「非房产」极慢(ID61 因此空转
# 20 小时)。故在列表阶段先按标题排除明显动产，不进入详情渲染。
# 策略：标题含房产地址要素 → 一定保留；否则若含动产特征词 → 丢弃；都不含 → 保留(交详情判)。
_JD_REALTY_FEATURE = re.compile(
    r"室|号楼|幢|栋|弄|座|路\d+|街道|[一-鿿]镇|[一-鿿]乡|[一-鿿]村|小区|花园|花苑|"
    r"公寓|别墅|商铺|店铺|厂房|车位|车库|储藏室|土地|地块|房产|房地产|不动产|宗地|"
    r"楼盘|商业用房|工业用房|名苑|嘉园|新村|公馆|广场|家园|号房|地下室|商住|住宅|"
    r"公租房|安置房|经济适用房|银座|大厦|商厦|写字楼"
)
_JD_MOVABLE_KEYWORD = re.compile(
    r"玉石|首饰|钻石|黄金|铂金|翡翠|珠宝|手表|腕表|名表|包包|箱包|奢侈品|"
    r"车辆|汽车|轿车|客车|货车|机动车|摩托|电动车|挖掘机|装载机|叉车|机械|"
    r"设备|机床|钻床|加工中心|生产线|流水线|股权|股份|债权|应收|存货|库存|"
    r"原料|材料|钢材|酒|茅台|红酒|字画|古董|文玩|手机|电脑|空调|家电|船舶|"
    r"游艇|商标|专利|线缆|电缆|纺织|服装"
)


def _jd_is_likely_movable(title: str) -> bool:
    """标题粗判是否为动产(非不动产)：含房产要素→否；否则含动产词→是。"""
    if not title:
        return False
    if _JD_REALTY_FEATURE.search(title):
        return False
    return bool(_JD_MOVABLE_KEYWORD.search(title))


def _is_auction_detail_url(href: str) -> bool:
    """Check if an href is a JD auction detail link (not notice/help/nav)."""
    if not href:
        return False
    return bool(_AUCTION_URL_RE.search(href))


class JDAuctionCrawler(AbstractBrokerCrawler):
    """Crawler for JD judicial auction (京东拍卖·司法)。API 驱动。"""

    platform = "京东拍卖"

    # 去掉 childrenCateId（原 12728=住宅用房，会漏掉商业/工业/办公），
    # 只保留 publishSource=7=司法拍卖，返回该城市全部类目的司法标的，
    # 物业类型交由 JDDetailParser._guess_property_type 按标题归类。
    BASE_SEARCH_URL = "https://pmsearch.jd.com/?publishSource=7"

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
                    # 关键：用短 id（字段 `id`，即 paimaiId）作为规范标识。
                    # getProductBasicInfo 接口只认短 id；productId 是长 id（10034...），
                    # 用它构建 source_url 会导致后续详情补全调接口取不到任何字段。
                    pid = str(it.get("id") or it.get("productId") or "")
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

        # 列表级动产粗筛：标题明显是动产的直接剔除，不进入详情渲染（大幅提速）。
        kept = [(pid, row) for pid, row in rows.items()
                if not _jd_is_likely_movable(row.get("title", ""))]
        dropped = len(rows) - len(kept)
        logger.info(
            f"[JD] {city}: 收集到 {len(rows)} 套，剔除疑似动产 {dropped} 套，"
            f"保留 {len(kept)} 套（接口直取）"
        )
        return [
            ListItem(
                source_url=f"https://paimai.jd.com/{pid}?itemId={pid}",
                title=row.get("title", ""),
                district=(row.get("city") or "").replace("市", ""),
                address=row.get("productAddress", ""),
            )
            for pid, row in kept
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
        realtime = {}
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
                # 实时数据接口（无需 h5st，直连）：取成交状态/成交价/成交确认书 URL。
                # 这是京东「成交价 + 成交确认书」的唯一可靠来源（getProductBasicInfo 无此字段）。
                # auctionStatus==2 → 已成交；currentPrice → 成交价；confirmationUrl → 成交确认书 PDF。
                try:
                    rt = await client.get(
                        "https://api.m.jd.com/api",
                        params={
                            "appid": "paimai",
                            "functionId": "getPaimaiRealTimeData",
                            "body": json.dumps({"paimaiId": int(paimai_id)}),
                            "loginType": "3",
                        },
                    )
                    realtime = (rt.json() or {}).get("data", {}) or {}
                except Exception as e:
                    logger.debug(f"[JD] getPaimaiRealTimeData failed for {paimai_id}: {e}")
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
        # 实时成交数据（成交状态/成交价/成交确认书 URL）原样带回供解析器判定。
        merged["_realtime"] = realtime

        # 面积：主接口无此字段，只存在于「标的物详情」tab 正文，需渲染详情页提取。
        # 用户已确认接受京东额外渲染的耗时成本。渲染失败不致命（面积留 0）。
        # 同时把渲染后的「详情页全文」和「附件清单」带回，供解析器做缺字段兜底
        # 与「成交确认书」识别（用户 2026-06-10 要求）。
        try:
            detail_url = f"https://paimai.jd.com/{paimai_id}?itemId={paimai_id}"
            html = await self.fetch_detail(detail_url)
            merged["_area"] = self._extract_area_from_html(html)
            merged["_detail_text"] = self._html_to_text(html)
            merged["_attachments"] = self._extract_attachments_from_html(html)
        except Exception as e:
            logger.debug(f"[JD] area render failed for {paimai_id}: {e}")
            merged["_area"] = 0.0
            merged["_detail_text"] = ""
            merged["_attachments"] = []
        return merged

    @staticmethod
    def _html_to_text(html: str) -> str:
        """渲染后 HTML → 单行纯文本（供解析器全文兜底挖掘五字段）。"""
        if not isinstance(html, str) or not html:
            return ""
        try:
            text = BeautifulSoup(html, "lxml").get_text(separator=" ")
        except Exception:
            text = html
        return re.sub(r"\s+", " ", text)

    @staticmethod
    def _extract_attachments_from_html(html: str) -> list[tuple[str, str]]:
        """从渲染后的京东详情页抓附件 <a> 清单 [(名称, 链接)]。

        京东「标的物详情」里附件多以「附件下载：xxx.pdf」链接呈现；
        识别 .pdf/.doc 等后缀或名称含「确认书/公告/报告」等特征的链接。
        """
        if not isinstance(html, str) or not html:
            return []
        out: list[tuple[str, str]] = []
        seen: set[str] = set()
        try:
            soup = BeautifulSoup(html, "lxml")
        except Exception:
            return []
        for a in soup.select("a[href]"):
            href = (a.get("href") or "").strip()
            name = re.sub(r"\s+", " ", a.get_text() or "").strip()
            if not href:
                continue
            low = href.lower()
            is_file = (low.endswith((".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip"))
                       or "attachment" in low or "/file" in low or "download" in low)
            looks_like_att = any(k in name for k in
                                 ("确认书", "公告", "须知", "报告", "合同", "附件", "评估"))
            if not (is_file or looks_like_att):
                continue
            if href.startswith("//"):
                href = "https:" + href
            if href in seen:
                continue
            seen.add(href)
            out.append((name, href))
        return out

    @staticmethod
    def _extract_area_from_html(html: str) -> float:
        """从渲染后的京东详情页 HTML 提取建筑面积（㎡）。

        面积只存在于「标的物详情」tab 正文，主接口无此字段，必须渲染页面后提取。
        京东详情页有两类模板，都要覆盖：
          (A) 内联文字型：「建筑总面积：123.08平方米」——标签后紧跟数值；
          (B) 执行标的调查情况表（表格型）：「建筑面积（平方米）」是表头列名，数值
              （如 59.33）在下一行单元格，渲染成纯文本后中间隔着 商铺编号/地址/
              房地产权证号 等几十个字符，故标签与数值不相邻，必须用「表头后窗口内
              取首个小数」来定位（楼层 2/28 是整数，不会被误取）。
        正文常把「建筑面积」「47.99」「平方米」拆在多个 <span>，故先取纯文本再正则。
        注意：建筑 与 面积 之间允许「总/物」等 0~2 个汉字，否则「建筑总面积」这类
        （中间多一个「总」字）会整条匹配失败、面积留 0。
        """
        if not isinstance(html, str) or not html:
            return 0.0
        try:
            text = BeautifulSoup(html, "lxml").get_text(separator=" ")
        except Exception:
            text = html
        text = re.sub(r"\s+", " ", text)
        # 负向先行排除「地下建筑面积」（地下部分非套内/总建面）；
        # (?:总)?建筑[一-龥]{0,2}面积 兼容 建筑面积/建筑总面积/总建筑面积/套内建筑面积
        patterns = [
            # (A) 内联型：标签后紧跟数值 + 单位
            r"(?<!地下)(?:总)?建筑[一-龥]{0,2}面积[为约是：:\s]*([\d]+(?:\.\d+)?)\s*(?:平方米|㎡|平米)",
            # (A) 内联型：标签后 8 字内出现数值（含「建筑面积（㎡）123」无空格写法）
            r"(?<!地下)(?:总)?建筑[一-龥]{0,2}面积[^0-9]{0,8}([\d]+(?:\.\d+)?)",
            # (B) 表格型：表头「建筑面积（平方米）」后窗口内取首个小数（值与表头被其它单元格隔开）
            r"(?<!地下)(?:总)?建筑[一-龥]{0,2}面积\s*[（(][^)）]{0,10}[)）].{0,120}?(\d+\.\d+)",
        ]
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                try:
                    v = float(m.group(1))
                except ValueError:
                    continue
                if 5 <= v <= 5000:  # 合理单户建面区间，排除宗地/使用权超大面积
                    return v
        return 0.0

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
