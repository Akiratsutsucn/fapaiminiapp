"""Taobao PaiMai (pages-fast.m.taobao.com) crawler — MTOP API for list + detail.

The old sf.taobao.com is IP-blocked for data-center servers. The replacement is the
PaiMai mobile-first platform at pages-fast.m.taobao.com, which uses the MTOP API
(h5api.m.taobao.com) with MD5-signed requests.

List API:  mtop.taobao.datafront.invoke.auctionwalle/1.0/
Detail API: mtop.taobao.govauctionmtopdetailservice.queryhttpsitemdetail/3.0/

Key filter for judicial auction (诉讼资产): zcBizTypes: ["6"]
"""
import asyncio
import hashlib
import json
import re
import time
from urllib.parse import urlencode, quote

import httpx
from loguru import logger
from playwright.async_api import TimeoutError as PlaywrightTimeout

from .base import AbstractBrokerCrawler, ListItem
from ..browser import browser_manager
from ..config import settings
from ..utils.retry import retry_on_failure
from ..cleaners.text import clean_text


MTOP_BASE = "https://h5api.m.taobao.com/h5/mtop.taobao.datafront.invoke.auctionwalle/1.0/"
DETAIL_API = "https://h5api.m.taobao.com/h5/mtop.taobao.govauctionmtopdetailservice.queryhttpsitemdetail/3.0/"
# 公告正文 API：拍卖须知(itemId即可)、标的物介绍(需projectId)
NOTICE_API = "https://h5api.m.taobao.com/h5/mtop.com.taobao.auction.notice.content.get/1.0/"
PROJECT_API = "https://h5api.m.taobao.com/h5/mtop.com.taobao.auction.project.content.get/1.0/"
APP_KEY = "12574478"

DETAIL_URL_TEMPLATE = (
    "https://pages-fast.m.taobao.com/wow/z/app/pm/dzc-ice/dzc-detail"
    "?x-ssr=true&disableNav=YES&x-preload=true&forceThemis=true&skeleton=true"
    "&itemId={item_id}"
)

USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)


def compute_mtop_sign(token: str, t: str, app_key: str, data: str) -> str:
    return hashlib.md5(f"{token}&{t}&{app_key}&{data}".encode()).hexdigest()


def _extract_token(cookie_str: str) -> str:
    """从 cookie 提取 _m_h5_tk token。

    扫码登录拿到的 cookie 通常不含 _m_h5_tk —— 该 token 是首次访问 MTOP
    H5 接口（h5api.m.taobao.com）时由 Set-Cookie 下发的。此时返回空串，
    由 collect_list_items 的首次请求触发 _refresh_token_from_response 自动获取。
    """
    m = re.search(r"_m_h5_tk=([^_;]+)", cookie_str)
    if not m:
        logger.warning("[TaobaoPaiMai] cookie 暂无 _m_h5_tk，将在首次 MTOP 请求时自动获取")
        return ""
    return m.group(1).split("_")[0]


def _build_scene_config(scene_key: str, zc_biz_types: list[str], sid: str, keyword: str = "") -> dict:
    inner_obj = {
        "disableNav": "YES",
        "x-ssr": "true",
        "zcBizTypes": zc_biz_types,
        "keywordSourceInfo": {},
        "appendMap": {"sid": sid, "enableQueryCorrect": True},
    }
    # 城市筛选：auctionwalle 搜索仅 keyword 生效（appendMap 的省市/divisionId 均无效），
    # 故宁波/杭州用城市名作为关键词筛选；上海默认列表即上海，无需 keyword。
    if keyword:
        inner_obj["keyword"] = keyword
    inner = json.dumps(inner_obj, separators=(",", ":"), ensure_ascii=False)

    context = {
        "userInfo": "{}",
        "appendMap": json.dumps({"isAutoSelect": True}, separators=(",", ":"), ensure_ascii=False),
        f"_c_{scene_key}": inner,
    }

    if scene_key == "searchlist-items":
        context["_c_searchlist-subscribeKeys"] = "{}"
        page_spmcs = "searchlist-items,searchlist-subscribeKeys,searchlist-searchListConfig"
    else:
        page_spmcs = scene_key

    df_vars = json.dumps(
        {"pageSpmb": "search-ssr", "context": context, "pageSpmcs": page_spmcs, "page": 1, "userInfo": {}},
        separators=(",", ":"),
        ensure_ascii=False,
    )

    return {
        "dfApp": "auctionwalle",
        "dfApiName": "auctionwalle.page.getScenes",
        "dfVariables": df_vars,
        "dfUniqueId": f"search-ssr_{page_spmcs}",
        "dfVariablesRecover": "{}",
    }


def _build_list_url(token: str, data_payload: dict, page: int = 1) -> str:
    df_vars = json.loads(data_payload["dfVariables"])
    df_vars["page"] = page
    data_payload["dfVariables"] = json.dumps(df_vars, separators=(",", ":"), ensure_ascii=False)
    data_str = json.dumps(data_payload, separators=(",", ":"), ensure_ascii=False)

    t = str(int(time.time() * 1000))
    sign = compute_mtop_sign(token, t, APP_KEY, data_str)

    params = {
        "jsv": "2.7.5",
        "appKey": APP_KEY,
        "t": t,
        "sign": sign,
        "api": "mtop.taobao.datafront.invoke.auctionwalle",
        "v": "1.0",
        "requiredParams": "dfApiName,dfUniqueId",
        "type": "jsonp",
        "dataType": "jsonp",
        "data": data_str,
    }
    return f"{MTOP_BASE}?{urlencode(params, quote_via=quote)}"


def _build_detail_url(token: str, item_id: str) -> str:
    data = json.dumps({"itemId": item_id}, separators=(",", ":"))
    t = str(int(time.time() * 1000))
    sign = compute_mtop_sign(token, t, APP_KEY, data)

    params = {
        "jsv": "2.7.4",
        "appKey": APP_KEY,
        "t": t,
        "sign": sign,
        "api": "mtop.taobao.GovauctionMTopDetailService.queryHttpsItemDetail",
        "v": "3.0",
        "value": "SFPM_H5",
        "type": "json",
        "dataType": "json",
        "data": data,
    }
    return f"{DETAIL_API}?{urlencode(params, quote_via=quote)}"


def _parse_jsonp(body: str) -> dict:
    body = re.sub(r"^\s*\w+\(|\)\s*$", "", body)
    return json.loads(body)


def _extract_suspense_init_data(html: str) -> dict | None:
    """从新版详情页 HTML 提取 window.__ICE_SUSPENSE_LOADER__.set(..., {initData:{...}})
    里的 initData 字典。用括号配平截取完整 JSON（贪婪正则不可靠）。

    initData 即结构化房源数据（startPrice/consultPrice 单位为分，imageList、
    divisions、associatedUnit 等），供 TaobaoPaiMaiDetailParser 解析。
    """
    marker = "__ICE_SUSPENSE_LOADER__.set("
    idx = html.find(marker)
    if idx < 0:
        return None
    start = html.find("{", idx)
    if start < 0:
        return None
    depth = 0
    instr = False
    esc = False
    end = -1
    for i in range(start, len(html)):
        ch = html[i]
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            instr = not instr
            continue
        if instr:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end < 0:
        return None
    try:
        obj = json.loads(html[start:end])
    except (json.JSONDecodeError, ValueError):
        return None
    return obj.get("initData") or None


class TaobaoPaiMaiCrawler(AbstractBrokerCrawler):
    """Crawler for the new PaiMai platform via MTOP API."""

    platform = "阿里拍卖"

    def __init__(self):
        self._page = None
        self._http_client: httpx.AsyncClient | None = None
        self._token: str | None = None
        self._cookie_str: str = ""
        self._row_cache: dict[str, dict] = {}  # itemId → raw list API row

    # ------------------------------------------------------------------
    # HTTP client
    # ------------------------------------------------------------------

    async def _get_http(self) -> httpx.AsyncClient:
        if not self._http_client:
            self._cookie_str = settings.TAOBAO_COOKIE.strip()
            self._token = _extract_token(self._cookie_str)
            self._http_client = httpx.AsyncClient(
                timeout=30,
                follow_redirects=True,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "*/*",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                    "Referer": "https://pages-fast.m.taobao.com/",
                    "Cookie": self._cookie_str,
                },
            )
            logger.info("[TaobaoPaiMai] HTTP client ready")
        return self._http_client

    async def _get_page(self):
        if not self._page:
            self._page = await browser_manager.new_page()
        return self._page

    async def close(self) -> None:
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
        if self._page:
            await self._page.close()
            self._page = None

    # ------------------------------------------------------------------
    # List collection via MTOP API
    # ------------------------------------------------------------------

    def _refresh_token_from_response(self, resp: httpx.Response) -> bool:
        """从 MTOP 响应的 Set-Cookie 头里提取新 _m_h5_tk，更新 self._token / self._cookie_str。

        MTOP 接口在每次请求时（包括 token 过期被拒绝时）都会通过 Set-Cookie 下发新 token。
        提取到后下次请求即可成功。
        """
        new_token_full = resp.cookies.get("_m_h5_tk", "")
        if not new_token_full:
            return False
        m = re.match(r"([^_]+)", new_token_full)
        if not m:
            return False
        new_token = m.group(1)
        if new_token == self._token:
            return False
        old = self._token
        self._token = new_token
        # 同时更新 cookie 字符串中的 _m_h5_tk
        if self._http_client:
            if "_m_h5_tk=" in self._cookie_str:
                # 已存在 → 替换
                self._cookie_str = re.sub(
                    r"_m_h5_tk=[^;]+",
                    f"_m_h5_tk={new_token_full}",
                    self._cookie_str,
                )
            else:
                # 不存在（扫码登录的 cookie 无 _m_h5_tk）→ 追加，否则服务器报 TOKEN_EMPTY
                sep = "; " if self._cookie_str.strip() else ""
                self._cookie_str = f"{self._cookie_str}{sep}_m_h5_tk={new_token_full}"
            # _m_h5_tk_enc 也一并同步（部分接口校验）
            enc_full = resp.cookies.get("_m_h5_tk_enc", "")
            if enc_full:
                if "_m_h5_tk_enc=" in self._cookie_str:
                    self._cookie_str = re.sub(
                        r"_m_h5_tk_enc=[^;]+",
                        f"_m_h5_tk_enc={enc_full}",
                        self._cookie_str,
                    )
                else:
                    self._cookie_str = f"{self._cookie_str}; _m_h5_tk_enc={enc_full}"
            self._http_client.headers["Cookie"] = self._cookie_str
        logger.info(f"[TaobaoPaiMai] Token refreshed: {old[:8] if old else '(empty)'}... -> {new_token[:8]}...")
        return True

    @retry_on_failure(max_retries=3, backoff_factor=2.0)
    async def collect_list_items(
        self, source_url: str | None = None, city: str = "上海", max_pages: int = 50
    ) -> list[ListItem]:
        """Collect auction items via MTOP list API with pagination."""
        client = await self._get_http()
        items: list[ListItem] = []

        sid = str(int(time.time() * 1000))
        # 城市筛选：auctionwalle 搜索仅 keyword 生效（appendMap 省市参数无效）。
        # 实测默认列表（keyword 空）只返回约 212 条「诉讼资产」精选，远少于实际在拍量；
        # 用城市名作 keyword 可拉到 500+ 条全量（上海/杭州/宁波同理），故所有城市都带 keyword。
        city_keyword = city or ""
        data_payload = _build_scene_config("searchlist-items", ["6"], sid, keyword=city_keyword)

        page = 1
        while page <= max_pages:
            url = _build_list_url(self._token, data_payload, page)
            logger.debug(f"[TaobaoPaiMai] List page {page}")

            resp = await client.get(url)
            # 每次响应都尝试刷新 token（MTOP 行为）
            self._refresh_token_from_response(resp)

            if resp.status_code != 200 or not resp.text:
                logger.error(f"[TaobaoPaiMai] Page {page}: HTTP {resp.status_code}")
                break

            page_items, has_next = self._parse_list_response(resp.text)

            # 如果是 token 过期错误 + 已刷新到新 token + 这是第一页，自动重试一次
            if not page_items and page == 1 and "FAIL_SYS_TOKEN" in resp.text.upper():
                logger.info(f"[TaobaoPaiMai] Token was expired, retrying page 1 with refreshed token...")
                url = _build_list_url(self._token, data_payload, page)
                resp = await client.get(url)
                self._refresh_token_from_response(resp)
                if resp.status_code == 200 and resp.text:
                    page_items, has_next = self._parse_list_response(resp.text)

            if not page_items:
                logger.info(f"[TaobaoPaiMai] No items on page {page}, stopping")
                break

            items.extend(page_items)
            logger.info(f"[TaobaoPaiMai] Page {page}: {len(page_items)} items (total: {len(items)})")

            if not has_next:
                break

            page += 1
            await asyncio.sleep(1.5)

        logger.info(f"[TaobaoPaiMai] Collection done: {len(items)} items from {page} pages")
        return items

    def _parse_list_response(self, body: str) -> tuple[list[ListItem], bool]:
        try:
            data = _parse_jsonp(body)
        except json.JSONDecodeError as e:
            logger.warning(f"[TaobaoPaiMai] JSON decode error: {e}")
            return [], False

        ret = data.get("ret", [])
        ret_str = " ".join(str(r) for r in ret) if ret else ""
        if ret_str and "SUCCESS" not in ret_str:
            logger.error(f"[TaobaoPaiMai] MTOP API error: {ret_str}")

        scenes = data.get("data", {}).get("data", {}).get("scenes", [])
        items: list[ListItem] = []
        has_next = False

        for scene in scenes:
            if scene.get("spmc") != "searchlist-items":
                continue
            for sl in scene.get("schemeList", []):
                has_next = sl.get("hasNextPage", False)
                for row in sl.get("contentList", []):
                    item = self._row_to_list_item(row)
                    if item.source_url:
                        items.append(item)
                        item_id = row.get("itemId", "")
                        if item_id:
                            self._row_cache[item_id] = row

        return items, has_next

    def _row_to_list_item(self, row: dict) -> ListItem:
        item_id = row.get("itemId", "")
        title = row.get("auctionTitle", "")
        price = row.get("price", "")
        price_unit = row.get("priceUnit", "")
        init_price = row.get("displayInitialPrice", "")
        init_price_unit = row.get("displayInitialPriceUnit", "")

        detail_url = row.get("auctionLink", "")
        if not detail_url and item_id:
            detail_url = DETAIL_URL_TEMPLATE.format(item_id=item_id)

        district = ""
        benefits = row.get("auctionBenefits", [])
        if isinstance(benefits, list):
            for b in benefits:
                if isinstance(b, str) and b in (
                    # 上海
                    "黄浦", "徐汇", "长宁", "静安", "普陀", "虹口", "杨浦",
                    "浦东", "闵行", "宝山", "嘉定", "金山", "松江", "青浦",
                    "奉贤", "崇明", "上海",
                    # 宁波（含已撤并的「江东」旧区）
                    "海曙", "江北", "江东", "北仑", "镇海", "鄞州", "奉化",
                    "象山", "宁海", "余姚", "慈溪", "宁波",
                    # 杭州（含已撤并的「下城」「江干」旧区）
                    "上城", "下城", "江干", "拱墅", "西湖", "滨江", "萧山", "余杭",
                    "临平", "钱塘", "富阳", "临安", "桐庐", "淳安", "建德", "杭州",
                ):
                    district = b
                    break

        starting_price_text = ""
        if init_price:
            starting_price_text = f"起拍价:{init_price}{init_price_unit}"
        elif price:
            starting_price_text = f"当前价:{price}{price_unit}"

        status_map = {"ing": "进行中", "end": "已结束", "sold": "已成交", "upcoming": "即将开拍"}
        auction_status = status_map.get(row.get("status", ""), "")

        area_text = ""
        if isinstance(benefits, list):
            for b in benefits:
                if isinstance(b, str) and "m²" in b:
                    area_text = b
                    break

        # Extract address from available fields
        address = ""
        extra_map = row.get("auctionExtraMap", {})
        if isinstance(extra_map, str):
            try:
                extra_map = json.loads(extra_map)
            except json.JSONDecodeError:
                extra_map = {}
        community = extra_map.get("hCellName", "") if isinstance(extra_map, dict) else ""
        if community and district:
            address = f"{district} {community}"
        elif community:
            address = community
        # Look for address-like string in benefits
        if not address and isinstance(benefits, list):
            for b in benefits:
                if isinstance(b, str) and ("路" in b or "街" in b or "号" in b or "小区" in b):
                    if district:
                        address = f"{district} {b}"
                    else:
                        address = b
                    break

        return ListItem(
            source_url=detail_url,
            title=title,
            starting_price_text=starting_price_text,
            auction_status=auction_status,
            district=district,
            area_text=area_text,
            address=address,
        )

    # ------------------------------------------------------------------
    # Detail extraction via Playwright SSR page + list API fallback
    # ------------------------------------------------------------------
    # The MTOP detail API (queryHttpsItemDetail) is blocked by Alibaba CAPTCHA
    # (RGV587). We now use Playwright to load the SSR detail page and extract
    # rendered data from the DOM. If the SSR page shows only skeleton (because
    # its internal MTOP calls also fail), we build a detail dict from the
    # cached list API row data.

    DETAIL_SSR_URL = (
        "https://pages-fast.m.taobao.com/wow/z/app/pm/dzc-ice/dzc-detail"
        "?x-ssr=true&disableNav=YES&x-preload=true&forceThemis=true&skeleton=true"
        "&itemId={item_id}"
    )

    @retry_on_failure(max_retries=2, backoff_factor=3.0, base_delay=3.0)
    async def fetch_detail_api(self, item_id: str) -> dict | None:
        """Fetch detail data: Playwright SSR first, then list API fallback."""
        # Strategy 1: Try Playwright SSR page
        ssr_data = await self._extract_from_ssr(item_id)
        if ssr_data and ssr_data.get("_source") != "skeleton":
            logger.info(f"[TaobaoPaiMai] SSR success for {item_id}")
            await self._enrich_notice(item_id, ssr_data)
            return ssr_data

        # Strategy 2: Build from cached list API row
        row = self._row_cache.get(item_id)
        if row:
            logger.info(f"[TaobaoPaiMai] Using list API data for {item_id}")
            detail = self._build_detail_from_row(row)
            await self._enrich_notice(item_id, detail)
            return detail

        logger.warning(f"[TaobaoPaiMai] No data for {item_id}")
        return None

    # ------------------------------------------------------------------
    # Notice / project content enrichment (公告正文)
    # ------------------------------------------------------------------

    async def _call_mtop_content(self, base: str, api_name: str, payload: dict) -> str:
        """带 token 握手调用 MTOP content API，返回 data.content 文本（失败返回空串）。"""
        try:
            client = await self._get_http()
        except Exception:
            return ""
        body = ""
        for _ in range(3):
            token = self._token or ""
            data = json.dumps(payload, separators=(",", ":"))
            t = str(int(time.time() * 1000))
            sign = compute_mtop_sign(token, t, APP_KEY, data)
            params = {
                "jsv": "2.7.4", "appKey": APP_KEY, "t": t, "sign": sign,
                "api": api_name, "v": "1.0", "type": "json",
                "dataType": "json", "data": data,
            }
            url = f"{base}?{urlencode(params, quote_via=quote)}"
            try:
                resp = await client.get(url)
            except Exception as e:
                logger.debug(f"[TaobaoPaiMai] content API error: {e}")
                return ""
            self._refresh_token_from_response(resp)
            body = resp.text
            if "FAIL_SYS_TOKEN" in body or "令牌为空" in body:
                continue  # 拿到新 token 重试
            break
        try:
            j = json.loads(body)
            content = (j.get("data") or {}).get("content", "")
            if content and content not in ("没有拍卖须知", "没有标的物介绍"):
                return clean_text(content)
        except (json.JSONDecodeError, AttributeError):
            pass
        return ""

    async def _enrich_notice(self, item_id: str, detail: dict) -> None:
        """抓拍卖须知 + 标的物介绍正文，注入 detail['data']['_notice_text']，
        供 parser 合并进 description（含租赁/户口/占用/欠费等风险信息）。"""
        try:
            data = detail.get("data", detail)
            project_id = str(data.get("projectId") or "")
            parts = []
            # 1. 拍卖须知（itemId 即可）
            notice = await self._call_mtop_content(
                NOTICE_API, "mtop.com.taobao.auction.notice.content.get",
                {"itemId": str(item_id)},
            )
            if notice:
                parts.append("【拍卖须知】" + notice)
            # 2. 标的物介绍（需 projectId）
            if project_id:
                proj = await self._call_mtop_content(
                    PROJECT_API, "mtop.com.taobao.auction.project.content.get",
                    {"projectId": project_id},
                )
                if proj:
                    parts.append("【标的物介绍】" + proj)
            if parts:
                data["_notice_text"] = "\n".join(parts)
                logger.info(f"[TaobaoPaiMai] notice enriched {item_id}: {sum(len(x) for x in parts)}字")
        except Exception as e:
            logger.debug(f"[TaobaoPaiMai] enrich notice failed for {item_id}: {e}")

    # ------------------------------------------------------------------
    # SSR page extraction
    # ------------------------------------------------------------------

    async def _extract_from_ssr(self, item_id: str) -> dict | None:
        """Load SSR detail page in Playwright and extract rendered data.

        Returns a dict mimicking the MTOP detail API response, or None.
        Sets _source='skeleton' if only the placeholder rendered.
        """
        page = await self._get_page()
        url = self.DETAIL_SSR_URL.format(item_id=item_id)

        # Add cookies to page context
        cookie_str = settings.TAOBAO_COOKIE.strip()
        if cookie_str:
            cookies = []
            for pair in cookie_str.split(";"):
                pair = pair.strip()
                if "=" in pair:
                    name, value = pair.split("=", 1)
                    cookies.append({
                        "name": name.strip(), "value": value.strip(),
                        "domain": ".taobao.com", "path": "/",
                    })
            if cookies:
                try:
                    await page.context.add_cookies(cookies)
                except Exception:
                    pass

        logger.debug(f"[TaobaoPaiMai] SSR load: item={item_id}")

        for attempt in range(2):
            try:
                # domcontentloaded 比 networkidle 可靠（该页面持续轮询，networkidle 易 45s 超时）
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                logger.warning(f"[TaobaoPaiMai] SSR goto failed (attempt {attempt}): {e}")
                if attempt == 0:
                    continue
                return None

            await asyncio.sleep(3 if attempt == 0 else 5)

            # initData 在 HTML 源码里（不依赖渲染），优先提取
            try:
                full_html = await page.content()
                init_data = _extract_suspense_init_data(full_html)
                if init_data and (init_data.get("title") or init_data.get("realTitle")):
                    logger.debug(f"[TaobaoPaiMai] initData found for {item_id}")
                    return {"data": init_data}
            except Exception as e:
                logger.debug(f"[TaobaoPaiMai] initData attempt {attempt} failed: {e}")

            # Evaluate DOM to check if real data rendered
            result = await page.evaluate("""() => {
                const r = {};
                const body = document.body.innerText || '';
                r.bodyLen = body.length;
                r.isSkeleton = body.includes('\\u6d4b\\u8bd5\\u8bf7\\u4e0d\\u8981\\u62cd');  // 测试请不要拍
                r.hasPrice = /\\\\d/.test(body);

                // Try to find embedded data in scripts
                const scripts = document.querySelectorAll('script');
                for (const s of scripts) {
                    const t = s.textContent || '';
                    if (t.includes('"itemId"') && t.includes('"auctionTitle"') && t.length < 200000) {
                        try {
                            // Try to parse as JSON
                            const m = t.match(/\\{[^}]*"itemId"[^}]*"auctionTitle"[^}]*\\}/);
                            if (m) r.scriptJson = m[0];
                            r.scriptLen = t.length;
                            r.scriptPreview = t.substring(0, 800);
                        } catch(e) {}
                        break;
                    }
                }

                // Check for window data stores
                for (const key of ['__NEXT_DATA__', '__ICE_APP_DATA__', '__ICE_SSR_DATA__',
                                    '__INITIAL_STATE__', '__PRELOADED_STATE__']) {
                    try {
                        if (window[key]) r[key] = JSON.stringify(window[key]).substring(0, 3000);
                    } catch(e) {}
                }

                // Check root element
                const root = document.getElementById('root');
                if (root) {
                    r.rootText = root.innerText ? root.innerText.substring(0, 500) : '';
                }

                return r;
            }""")

            if not result.get("isSkeleton") and result.get("bodyLen", 0) > 100:
                # Page rendered real content — try to parse it
                parsed = await self._parse_ssr_dom(page, item_id)
                if parsed:
                    return parsed

            if attempt == 0:
                logger.debug(f"[TaobaoPaiMai] SSR skeleton on attempt 1, reloading...")

        # Return skeleton marker so caller can fall back
        logger.debug(f"[TaobaoPaiMai] SSR skeleton after all attempts for {item_id}")
        return {"_source": "skeleton"}

    async def _parse_ssr_dom(self, page, item_id: str) -> dict | None:
        """Extract structured auction data from rendered SSR DOM.

        首选：从页面 HTML 的 window.__ICE_SUSPENSE_LOADER__.set('dzc-detail-ssr',
        {initData:{...}}) 提取结构化数据（新版页面的真实数据源）。
        回退：旧版的 script JSON / window 全局 / 可见文本。
        """
        # === 首选：__ICE_SUSPENSE_LOADER__ initData ===
        try:
            full_html = await page.content()
            init_data = _extract_suspense_init_data(full_html)
            if init_data and (init_data.get("title") or init_data.get("realTitle")):
                logger.debug(f"[TaobaoPaiMai] initData extracted for {item_id}")
                # TaobaoPaiMaiDetailParser 解析时会 data = api_data.get('data', api_data)，
                # initData 本身即扁平结构，包一层 data 以兼容。
                return {"data": init_data}
        except Exception as e:
            logger.debug(f"[TaobaoPaiMai] initData extract failed for {item_id}: {e}")

        extracted = await page.evaluate("""() => {
            const r = {};

            // 1. Search all script tags for embedded data
            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
                const t = s.textContent || '';
                // Look for JSON objects that contain key auction fields
                if (t.includes('startPrice') && t.includes('auctionTitle')) {
                    // Try to extract the largest JSON-like structure
                    const jsonMatch = t.match(/(\\{[^}]*\\})/g);
                    if (jsonMatch) {
                        for (const candidate of jsonMatch) {
                            if (candidate.includes('startPrice') && candidate.includes('itemId')) {
                                r.embeddedJson = candidate;
                                break;
                            }
                        }
                    }
                    r.scriptDataFound = true;
                    r.scriptLen = t.length;
                }
            }

            // 2. Check for __ICE_SSR_DATA__ or similar
            for (const key of Object.keys(window)) {
                if (key.includes('DATA') || key.includes('STATE') || key.includes('STORE')) {
                    try {
                        const v = window[key];
                        if (typeof v === 'object' && v !== null) {
                            r[key] = JSON.stringify(v);
                        }
                    } catch(e) {}
                }
            }

            // 3. Parse visible text for key fields
            const body = document.body ? document.body.innerText : '';
            r.fullText = body.substring(0, 3000);

            // 4. Collect all image URLs
            const imgs = document.querySelectorAll('img[src]');
            r.imgUrls = Array.from(imgs).map(i => i.src).filter(u => u.startsWith('http')).slice(0, 30);

            // 5. Collect all links
            const links = document.querySelectorAll('a[href]');
            r.linkUrls = Array.from(links).map(a => a.href).filter(u => u.includes('itemId') || u.includes('detail') || u.includes('gonggao') || u.includes('announce')).slice(0, 10);

            return r;
        }""")

        if not extracted:
            return None

        # Try to parse embedded JSON
        if extracted.get("embeddedJson"):
            try:
                return json.loads(extracted["embeddedJson"])
            except json.JSONDecodeError:
                pass

        # Try window data stores
        for key in ["__ICE_SSR_DATA__", "__ICE_APP_DATA__", "__INITIAL_STATE__"]:
            if key in extracted and isinstance(extracted[key], str):
                try:
                    data = json.loads(extracted[key])
                    if isinstance(data, dict) and "data" in data:
                        return data
                    if isinstance(data, dict) and "itemId" in data:
                        return {"data": data}
                except json.JSONDecodeError:
                    pass

        # If we got any text content, wrap it
        if extracted.get("fullText") and len(extracted["fullText"]) > 50:
            return {
                "_source": "ssr_text",
                "data": {
                    "_raw_text": extracted["fullText"],
                    "_images": extracted.get("imgUrls", []),
                    "_links": extracted.get("linkUrls", []),
                    "itemId": item_id,
                }
            }

        return None

    # ------------------------------------------------------------------
    # List API row → detail dict construction
    # ------------------------------------------------------------------

    def _build_detail_from_row(self, row: dict) -> dict:
        """Build a detail API response dict from a list API row.

        Maps list-level fields into the structure expected by
        TaobaoPaiMaiDetailParser. All monetary values in cents.
        """
        extra = row.get("auctionExtraMap", {})
        if isinstance(extra, str):
            try:
                extra = json.loads(extra)
            except json.JSONDecodeError:
                extra = {}

        benefits = row.get("auctionBenefits", []) or []

        # --- Price conversion helpers ---
        def _price_to_cents(price_str: str, unit: str) -> int:
            """Convert display price+unit to cents."""
            try:
                val = float(price_str)
            except (ValueError, TypeError):
                return 0
            unit_mult = {"万": 10000, "亿": 100000000}.get(unit, 1)
            return int(val * unit_mult * 100)

        display_price = str(row.get("displayInitialPrice", "0") or "0")
        price_unit = str(row.get("displayInitialPriceUnit", "") or "")
        start_price_cents = _price_to_cents(display_price, price_unit)

        current_price = str(row.get("price", "0") or "0")
        current_unit = str(row.get("priceUnit", "元") or "元")
        current_cents = _price_to_cents(current_price, current_unit)

        # Extra map fields (already in cents for bail, incrementnum)
        bail = int(extra.get("bail", 0) or 0)
        increment = int(extra.get("incrementnum", 0) or 0)

        # Area: hArea is in centi-sqm (e.g., 7442 → 74.42m²)
        area_raw = extra.get("hArea", "")
        area_val = 0.0
        area_display = ""
        if area_raw:
            try:
                area_val = float(area_raw) / 100.0
                area_display = f"{area_val}m²"
            except (ValueError, TypeError):
                pass

        # District from benefits
        district = ""
        sh_districts = ("黄浦", "徐汇", "长宁", "静安", "普陀", "虹口", "杨浦",
                        "浦东", "闵行", "宝山", "嘉定", "金山", "松江", "青浦",
                        "奉贤", "崇明", "上海")
        nb_districts = ("海曙", "江北", "江东", "北仑", "镇海", "鄞州", "奉化",
                        "象山", "宁海", "余姚", "慈溪", "宁波")
        hz_districts = ("上城", "下城", "江干", "拱墅", "西湖", "滨江", "萧山", "余杭",
                        "临平", "钱塘", "富阳", "临安", "桐庐", "淳安", "建德", "杭州")
        for b in benefits:
            if isinstance(b, str) and (b in sh_districts or b in nb_districts or b in hz_districts):
                district = b
                break
        # City from benefits
        city_from_benefits = ""
        for b in benefits:
            if isinstance(b, str) and b in ("上海", "上海市", "宁波", "宁波市", "杭州", "杭州市"):
                city_from_benefits = b.rstrip("市")
                break

        # Community from extra
        community = extra.get("hCellName", "")

        # Category mapping
        cat_id = str(extra.get("category", ""))
        cat_map = {"50025969": "住宅", "200782003": "商业", "200788003": "工业",
                    "200798003": "其他", "50025970": "土地"}
        property_type = cat_map.get(cat_id, extra.get("fcatV4ButtomName", ""))

        # Status mapping: list API 'status' → bidStatus
        status_map = {"ing": 3, "end": 4, "sold": 5, "upcoming": 1}
        bid_status = status_map.get(row.get("status", ""), 3)

        # Images: headerPicUrls is pipe-separated
        images = []
        header_pics = extra.get("headerPicUrls", "") or ""
        if header_pics:
            for url in header_pics.split("|"):
                url = url.strip()
                if url:
                    if url.startswith("//"):
                        url = "https:" + url
                    images.append(url)
        # Fallback: pictureUrl, titlePic
        for key in ("pictureUrl", "titlePic"):
            pic = row.get(key, "")
            if pic:
                if pic.startswith("//"):
                    pic = "https:" + pic
                if pic not in images:
                    images.append(pic)

        # City division code for validation
        city_div_code = {"上海": "310000", "宁波": "330200", "杭州": "330100"}.get(
            city_from_benefits, "")

        # Build location string from district + city
        location_str = ""
        if city_from_benefits and district:
            location_str = f"{city_from_benefits} {city_from_benefits}市 {district}"
        elif district:
            location_str = district

        # Build the dict in MTOP detail API format
        detail = {
            "_source": "list_api",
            "data": {
                "itemId": row.get("itemId", ""),
                "realTitle": extra.get("reTitle", "") or row.get("auctionTitle", ""),
                "title": row.get("auctionTitle", ""),
                "startPrice": start_price_cents,
                "marketPrice": 0,
                "foregiftPrice": bail,
                "incrementPrice": increment,
                "currentPriceLong": current_cents,
                "consultPrice": 0,
                "orgLoan": False,
                "supportForegiftLoan": False,
                "titleTag": {"preTags": []},
                "bidStatus": bid_status,
                "startTime": "",
                "endTime": "",
                "sellerNick": row.get("shopName", ""),
                "associatedUnit": {"orgName": ""},
                "caseNumber": "",
                "gongGaoUrl": "",
                "phone": "",
                "connectPeople": "",
                "divisions": [{"divisionCode": city_div_code, "divisionName": city_from_benefits}] if city_div_code else [],
                "location": location_str,
                "locationId": "",
                "auctionAddress": {
                    "fullAddress": "",
                    "communityName": community,
                    "district": district,
                    "subDistrict": "",
                    "ringRoad": "",
                    "lat": None,
                    "lng": None,
                },
                "seer": int(row.get("pv", 0) or 0),
                "applyNum": int(row.get("applyCnt", 0) or 0),
                "attachmentList": [],
                "headMedia": {
                    "imageList": images,
                    "pictUrl": images[0] if images else "",
                },
                "imageList": images,
                "catId": cat_id,
                "auctionHouse": {
                    "buildingArea": area_display,
                    "layout": "",
                    "floorInfo": extra.get("hTMode", ""),
                    "totalFloor": None,
                    "orientation": "",
                    "decoration": "",
                    "buildYear": None,
                    "hasElevator": None,
                },
                "publishTime": "",
                "modifyTime": "",
                "tagFront": {"itemTags": []},
                "aiStructure": {},
                "bidCycle": {},
                "benefit": {},
                # Extra fields for parser fallbacks
                "_list_benefits": benefits,
                "_list_city": city_from_benefits,
                "_list_area_text": area_display,
                "_list_district": district,
                "_list_property_type": property_type,
            }
        }

        return detail

    # ------------------------------------------------------------------
    # Detail page via Playwright (SSR HTML, for property specs)
    # ------------------------------------------------------------------

    @retry_on_failure(max_retries=2, backoff_factor=2.0)
    async def fetch_detail(self, detail_url: str) -> str:
        """Navigate to a PaiMai SSR detail page and return rendered HTML."""
        page = await self._get_page()

        if detail_url.startswith("//"):
            detail_url = "https:" + detail_url

        logger.debug(f"[TaobaoPaiMai] Fetching detail page: {detail_url[:120]}")

        cookie_str = settings.TAOBAO_COOKIE.strip()
        if cookie_str:
            cookies = []
            for pair in cookie_str.split(";"):
                pair = pair.strip()
                if "=" in pair:
                    name, value = pair.split("=", 1)
                    cookies.append({
                        "name": name.strip(), "value": value.strip(),
                        "domain": ".taobao.com", "path": "/",
                    })
            if cookies:
                await page.context.add_cookies(cookies)

        try:
            await page.goto(detail_url, wait_until="domcontentloaded", timeout=settings.DETAIL_PAGE_TIMEOUT_MS)
        except PlaywrightTimeout:
            logger.warning(f"[TaobaoPaiMai] Detail page slow: {detail_url[:120]}")
            await page.goto(detail_url, wait_until="networkidle", timeout=settings.DETAIL_PAGE_TIMEOUT_MS)

        await asyncio.sleep(2)
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(0.5)
        await page.evaluate("window.scrollTo(0, 0)")
        await asyncio.sleep(0.5)

        return await page.content()
