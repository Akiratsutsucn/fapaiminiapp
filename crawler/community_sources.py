"""小区详情「多源补充」框架 —— 贝壳之外的备援数据源。

【背景】客户要求：当房源缺小区详情时，用贝壳/中原地产/中呈地产等普通地产
公司的小区数据做补充。贝壳走 community_scraper.py 主路径（sug API + /xiaoqu/
详情页，详情页常被验证码拦截），本模块负责贝壳「拿不到 / 字段不全」时，
依次尝试其它来源，把缺失字段补齐。

【设计】每个源 = 一个 CommunitySource 子类，实现 async fetch(name, city_id)，
返回统一的字段 dict（键与 CommunityInfo 列对齐，缺失项不含）。调度器
`supplement_fields()` 按优先级顺序逐个尝试，只回填「当前还缺」的字段，
绝不覆盖贝壳已抓到的值，也绝不破坏现有贝壳逻辑。

统一返回字段（全部可选）：
    avg_price, build_year_start, build_year_end, property_type,
    total_buildings, total_units, developer, plot_ratio, green_rate,
    property_company, property_fee, address_full, on_sale_count,
    source_url  (该源的小区页链接，存 remark / 供溯源)

【各源可用性 · 2026-06-08 实测，详见模块末尾 NOTES】
- 贝壳   beike    主源，已在 community_scraper.py 实现，本框架不重复。
- 中原   centanet 站点真实存在（sh/hz/zj/nb.centanet.com），但整站套了
                  瑞数(Riverdate)动态 JS 反爬：httpx 直接 GET 返回 HTTP 202 +
                  空 body（仅 probe.js），必须用真实浏览器(Playwright)执行 JS
                  才能拿到内容。故实现为 Playwright 源，默认关闭，需配代理实测。
- 中呈   —        未找到任何可公开访问的「中呈地产」小区数据站点（搜索仅命中
                  无关的「中诚地产」开发商官网）。判定为不可行，不实现抓取，
                  仅在文档/日志中如实说明。
"""
from __future__ import annotations

import re
from typing import Optional

from loguru import logger

# 与 community_scraper 共用的城市映射（英文缩写）
CITY_EN = {
    310000: "sh",   # 上海
    330200: "nb",   # 宁波
    330100: "hz",   # 杭州 → 中原用 hz / zj 两种子域，下面按源各自处理
}

# 统一字段白名单：补充源只允许回填这些 CommunityInfo 列
SUPPLEMENT_FIELDS = (
    "avg_price", "build_year_start", "build_year_end", "property_type",
    "total_buildings", "total_units", "developer", "plot_ratio", "green_rate",
    "property_company", "property_fee", "address_full", "on_sale_count",
)


def _safe_int(text: str) -> Optional[int]:
    if not text:
        return None
    m = re.search(r"(\d+)", text.replace(",", ""))
    return int(m.group(1)) if m else None


def _safe_float(text: str) -> Optional[float]:
    if not text:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)", text.replace(",", ""))
    return float(m.group(1)) if m else None


def _normalize_property_type(value: str) -> Optional[str]:
    for pt in ("板楼", "塔楼", "板塔结合", "住宅", "商业", "办公", "别墅", "商住"):
        if pt in value:
            return pt
    return None


# ============================================================
# 源基类
# ============================================================
class CommunitySource:
    """补充源基类。子类实现 async fetch()，返回统一字段 dict（缺失项不含）。"""

    #: 源标识（写入 CommunityInfo.source / 日志）
    key: str = "base"
    #: 是否已通过配置启用
    enabled: bool = False

    async def fetch(self, name: str, city_id: int) -> dict:
        """按小区名抓该源数据。返回字段 dict（键 ∈ SUPPLEMENT_FIELDS，外加可选
        source_url）；找不到 / 抓取失败一律返回 {}，绝不抛异常给调度层。"""
        raise NotImplementedError


# ============================================================
# 中原地产（centanet.com）—— Playwright 源（默认关闭）
# ============================================================
class CentanetSource(CommunitySource):
    """中原地产小区详情源。

    站点真实存在且小区数据丰富，但整站套瑞数动态反爬（probe.js / HTTP 202），
    httpx 拿不到内容，必须 Playwright 渲染。本类用项目现有 browser_manager。

    URL 结构（实测城市子域，xiaoqu 频道）：
        https://{city}.centanet.com/xiaoqu/          小区列表/搜索入口
        城市子域：上海 sh、宁波 nb、杭州 hz（浙江另有 zj.centanet.com）
    小区详情页路径在不同城市略有差异，故策略为：打开搜索结果页 → 取第一个
    匹配小区的详情链接 → 进详情页解析「小区概况」表格。

    注意：瑞数会对新 IP / 无指纹浏览器持续挑战，没有住宅代理时大概率拿不到
    数据。因此默认 enabled=False，需 CENTANET_ENABLED=true 且配好代理后启用。
    """

    key = "centanet"

    # 城市 → 中原子域。杭州优先用 hz，浙江省站 zj 作为兜底候选。
    _SUBDOMAIN = {
        310000: ["sh"],
        330200: ["nb"],
        330100: ["hz", "zj"],
    }

    def __init__(self):
        from .config import settings
        self.enabled = bool(
            getattr(settings, "COMMUNITY_SUPPLEMENT_ENABLED", False)
            and getattr(settings, "CENTANET_ENABLED", False)
        )

    async def fetch(self, name: str, city_id: int) -> dict:
        if not self.enabled:
            return {}
        subs = self._SUBDOMAIN.get(city_id)
        if not subs:
            logger.debug(f"[centanet] 城市 {city_id} 无对应子域，跳过")
            return {}

        from .browser import browser_manager
        # 复用全局浏览器（engine 已 start；单房源路径下若未 start 则跳过，避免
        # 在补充源里擅自拉起/关闭浏览器影响主流程）。
        try:
            _ = browser_manager.context  # 触发未启动时的 RuntimeError
        except Exception:
            logger.warning("[centanet] 浏览器未启动，跳过中原源（仅在引擎运行期可用）")
            return {}

        for sub in subs:
            try:
                data = await self._fetch_one_subdomain(browser_manager, sub, name)
                if data:
                    return data
            except Exception as e:
                logger.warning(f"[centanet] {sub} 抓取异常 '{name}': {e}")
        return {}

    # 瑞数挑战通过的标志：页面里出现真实业务内容而非仅 probe.js
    _CHALLENGE_HINTS = ("probe.js", "/challenge", "var buid")

    async def _fetch_one_subdomain(self, bm, sub: str, name: str) -> dict:
        from urllib.parse import quote

        base = f"https://{sub}.centanet.com"
        # 中原小区搜索：/xiaoqu/ 频道带关键词查询。不同城市参数名可能不同，
        # 这里用最通用的关键词路径，进站后靠链接文本匹配兜底。
        search_url = f"{base}/xiaoqu/?keyword={quote(name)}"

        page = await bm.new_page()
        try:
            await page.goto(search_url, wait_until="networkidle", timeout=30000)
            # 瑞数挑战：首跳常返回挑战页，等 JS 自动通过后再读内容
            html = await page.content()
            if any(h in html for h in self._CHALLENGE_HINTS) and "xiaoqu" not in (await page.url):
                # 给瑞数 JS 一点时间自动通过，再重试一次取内容
                await page.wait_for_timeout(3500)
                html = await page.content()

            detail_url = await self._extract_first_detail_link(page, name)
            if not detail_url:
                logger.info(f"[centanet] {sub} 未匹配到小区链接：{name}")
                return {}
            if not detail_url.startswith("http"):
                detail_url = base + detail_url

            await page.goto(detail_url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(800)
            detail_html = await page.content()
            fields = self._parse_detail(detail_html)
            if fields:
                fields["source_url"] = detail_url
                logger.info(
                    f"[centanet] {sub} 命中 '{name}' → {len(fields)-1} 字段 "
                    f"{[k for k in fields if k != 'source_url']}"
                )
            return fields
        finally:
            try:
                await page.close()
            except Exception:
                pass

    async def _extract_first_detail_link(self, page, name: str) -> Optional[str]:
        """从搜索结果里找第一个名字相符的小区详情链接。中原详情 href 含 /xiaoqu/。"""
        try:
            anchors = await page.eval_on_selector_all(
                "a",
                "els => els.map(e => ({href: e.getAttribute('href')||'', text: (e.textContent||'').trim()}))",
            )
        except Exception:
            return None
        candidates = []
        for a in anchors or []:
            href = a.get("href") or ""
            text = a.get("text") or ""
            if "/xiaoqu/" not in href:
                continue
            # 详情链接通常形如 /xiaoqu/<数字或拼音id>/，排除频道首页 /xiaoqu/
            if href.rstrip("/").endswith("/xiaoqu"):
                continue
            candidates.append((href, text))
        if not candidates:
            return None
        # 优先文本与小区名互相包含的
        for href, text in candidates:
            if text and (name in text or text in name):
                return href
        return candidates[0][0]

    def _parse_detail(self, html: str) -> dict:
        """解析中原小区详情页「小区概况」字段。中原详情页用「标签：值」式表格，
        不同城市 class 名不稳定，故用「标签关键词 + 紧邻文本」的正则兜底。"""
        out: dict = {}
        # 把标签和其后最近的一段值配对（中原常见：<span>容积率</span><span>1.5</span>）
        text = re.sub(r"<[^>]+>", "\x01", html)  # 标签全换成分隔符，保留文本
        text = re.sub(r"[\x01\s]+", " ", text)

        def grab(label: str) -> str:
            m = re.search(re.escape(label) + r"[：: ]*([^ ]{1,40})", text)
            return m.group(1).strip() if m else ""

        # 均价（元/㎡）
        m = re.search(r"(?:参考均价|挂牌均价|均价)[^\d]{0,6}(\d[\d,]{2,})\s*元", text)
        if m:
            out["avg_price"] = _safe_float(m.group(1))
        by = grab("建成年代") or grab("建筑年代") or grab("竣工时间")
        if by:
            ym = re.search(r"(\d{4})", by)
            if ym:
                out["build_year_start"] = int(ym.group(1))
        pr = grab("容积率")
        if pr:
            v = _safe_float(pr)
            if v:
                out["plot_ratio"] = v
        gr = grab("绿化率")
        if gr:
            v = _safe_float(gr)
            if v:
                out["green_rate"] = round(v / 100, 4) if v > 1 else v
        tb = grab("楼栋总数") or grab("总楼栋")
        if tb:
            n = _safe_int(tb)
            if n:
                out["total_buildings"] = n
        tu = grab("总户数") or grab("房屋总数") or grab("规划户数")
        if tu:
            n = _safe_int(tu)
            if n:
                out["total_units"] = n
        fee = grab("物业费")
        if fee:
            out["property_fee"] = fee[:64]
        pc = grab("物业公司")
        if pc and pc not in ("暂无", "暂无信息", "-"):
            out["property_company"] = pc[:128]
        dev = grab("开发商")
        if dev and dev not in ("暂无", "暂无信息", "-"):
            out["developer"] = dev[:128]
        ptype = grab("建筑类型") or grab("物业类型")
        if ptype:
            nt = _normalize_property_type(ptype)
            if nt:
                out["property_type"] = nt
        return out


# ============================================================
# 中呈地产 —— 占位（不可行，永久关闭）
# ============================================================
class ZhongchengSource(CommunitySource):
    """中呈地产源 —— 占位实现。

    【调研结论 2026-06-08】未找到任何可公开访问的「中呈地产」小区数据网站：
    全网搜索仅命中无关的「中诚地产/中诚房地产开发」开发商官网（无小区库），
    以及各地贝壳/房产超市等其它平台。客户口中的「中呈地产」可能是区域性
    线下中介、已下线站点，或名称记忆有偏差。

    因此本源不实现任何抓取逻辑（强行编造 URL 只会污染数据），永久 enabled=False。
    若日后客户能提供「中呈」确切的官网域名，再在此类补全 fetch() 即可——框架
    已为多源扩展预留好结构。
    """

    key = "zhongcheng"
    enabled = False  # 无可用站点，恒关

    async def fetch(self, name: str, city_id: int) -> dict:
        return {}


# ============================================================
# 调度器：按优先级补齐缺失字段
# ============================================================
def _build_sources() -> list[CommunitySource]:
    """构造启用的补充源列表（贝壳为主源不在此列，本框架只管贝壳之外的备援）。
    顺序即优先级：先中原，再中呈（当前不可用）。"""
    sources: list[CommunitySource] = []
    try:
        centanet = CentanetSource()
        if centanet.enabled:
            sources.append(centanet)
    except Exception as e:
        logger.warning(f"[supplement] 初始化中原源失败：{e}")
    # 中呈恒关，列出仅为表达「框架已预留位」
    zc = ZhongchengSource()
    if zc.enabled:
        sources.append(zc)
    return sources


def _missing_fields(community) -> list[str]:
    """返回 CommunityInfo 实例上当前仍缺（None/空）的可补充字段。"""
    missing = []
    for f in SUPPLEMENT_FIELDS:
        v = getattr(community, f, None)
        if v is None or v == "" or v == 0:
            missing.append(f)
    return missing


async def supplement_fields(community, *, force: bool = False) -> dict:
    """对一条 CommunityInfo 用补充源补齐缺失字段。

    - 只在「总开关开 + 至少一个源启用」时工作，否则直接返回 {}（不影响贝壳逻辑）。
    - 只回填当前仍缺的字段，绝不覆盖贝壳已抓到的值。
    - 返回实际写入的字段 dict（已 setattr 到 community，但不 commit；由调用方提交）。

    参数 force=True 时即使字段齐全也跑一遍（调试用）。
    """
    from .config import settings
    if not getattr(settings, "COMMUNITY_SUPPLEMENT_ENABLED", False):
        return {}

    sources = _build_sources()
    if not sources:
        return {}

    missing = SUPPLEMENT_FIELDS if force else _missing_fields(community)
    if not missing:
        return {}

    city_id = getattr(community, "city_id", None) or 310000
    name = getattr(community, "name", "") or ""
    if not name:
        return {}

    applied: dict = {}
    for src in sources:
        # 还缺什么就找什么；都补齐了就提前结束
        still_missing = [f for f in missing if f not in applied]
        if not still_missing:
            break
        try:
            data = await src.fetch(name, city_id)
        except Exception as e:
            logger.warning(f"[supplement] 源 {src.key} 抓取异常 '{name}': {e}")
            continue
        if not data:
            continue
        for f in still_missing:
            if data.get(f) is not None:
                setattr(community, f, data[f])
                applied[f] = data[f]
        # 记录来源溯源信息
        if applied:
            src_url = data.get("source_url")
            note = f"补充源 {src.key} 回填: {list(applied.keys())}"
            if src_url:
                note += f" | {src_url}"
            existing_remark = getattr(community, "remark", None) or ""
            community.remark = (existing_remark + " || " + note).strip(" |")[:512]
            community.source = f"{getattr(community, 'source', '') or 'beike'}+{src.key}"
            logger.info(f"[supplement] '{name}' 由 {src.key} 补充 {list(applied.keys())}")

    return applied


# ============================================================
# NOTES —— 各源可用性实测记录（2026-06-08）
# ============================================================
# 贝壳 beike：主源，见 community_scraper.py。sug API 稳定，/xiaoqu 详情常被验证码拦。
#
# 中原 centanet（sh/nb/hz/zj.centanet.com）：站点真实、小区数据丰富，但整站瑞数
#   动态反爬——curl/httpx 直连任意页面返回 HTTP 202 + 仅含 probe.js 的空壳 body，
#   zj 站会 302 到 /challenge。必须 Playwright 执行 JS 才能拿到真实内容，且无住宅
#   代理时瑞数会持续挑战。已实现为 Playwright 源，默认关闭（CENTANET_ENABLED），
#   生产配好代理后需先小批量实测命中率再放量。属「存疑可行」。
#
# 中呈 zhongcheng：未找到任何可公开访问的小区数据站点（搜索仅命中无关的「中诚
#   地产」开发商官网）。判定不可行，占位 enabled=False，不抓取、不编造 URL。

