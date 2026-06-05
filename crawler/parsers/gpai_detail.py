"""GPai detail page parser — extracts all fields from s.gpai.net detail HTML."""
import re
from datetime import datetime
from bs4 import BeautifulSoup
from loguru import logger

from .base import AbstractParser
from ..models.item import AuctionItem, Platform
from ..cleaners.price import parse_price_to_yuan, parse_area_sqm
from ..cleaners.text import clean_text, extract_district
from ..cleaners.text_extractor import extract_community_from_title
from ..cleaners.city import city_name_by_id
from ..cleaners.status import normalize_status as _normalize_status


# ====================================================================
# 法院公告落款日期提取（= 房源真实上架日 publish_date）
# ====================================================================
_CN_NUM = {"〇": 0, "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
           "六": 6, "七": 7, "八": 8, "九": 9}
_COURT = r"([一-龥]{2,12}?人民法院)"
_RE_SIGN_AR = re.compile(_COURT + r"(20\d{2})年(\d{1,2})月(\d{1,2})日")
_RE_SIGN_CN = re.compile(
    _COURT + r"([〇零一二三四五六七八九]{4})年"
    r"([〇零一二三四五六七八九十]{1,3})月([〇零一二三四五六七八九十]{1,3})日"
)


def _cn_year(s: str) -> int:
    """二〇二六 → 2026。"""
    return int("".join(str(_CN_NUM[c]) for c in s))


def _cn_md(s: str) -> int:
    """中文月/日：四 / 十 / 十一 / 三十 / 三十一 → int。"""
    if s == "十":
        return 10
    if s in _CN_NUM:
        return _CN_NUM[s]
    if s.startswith("十"):          # 十一..十九
        return 10 + _CN_NUM[s[1]]
    if "十" in s:                   # 二十 / 三十 / 二十一 / 三十一
        tens, _, ones = s.partition("十")
        return _CN_NUM[tens] * 10 + (_CN_NUM[ones] if ones else 0)
    return _CN_NUM[s]


def extract_court_announce_date(text: str):
    """从公拍网详情页正文提取「法院公告落款日期」。

    返回 datetime（落款日，取最早的一个，对应公告发布日），无法提取时返回 None。
    兼容阿拉伯数字(2026年5月21日)与中文数字(二〇二六年五月十一日)两种落款写法。
    """
    if not text:
        return None
    flat = re.sub(r"\s+", "", text)
    dates = []
    for m in _RE_SIGN_AR.finditer(flat):
        try:
            dates.append(datetime(int(m.group(2)), int(m.group(3)), int(m.group(4))))
        except ValueError:
            pass
    for m in _RE_SIGN_CN.finditer(flat):
        try:
            dates.append(datetime(_cn_year(m.group(2)), _cn_md(m.group(3)), _cn_md(m.group(4))))
        except (ValueError, KeyError):
            pass
    if not dates:
        return None
    # 同一页常出现两处落款（竞买公告+竞买须知），日期一致；取最早，避免误取正文里更晚的杂项日期。
    return min(dates)


class GPaiDetailParser(AbstractParser):
    """Parse a GPai (s.gpai.net) detail page HTML into an AuctionItem."""

    platform = "公拍网"

    async def parse(self, html: str, source_url: str, city_id: int,
                    extra: dict | None = None) -> AuctionItem:
        soup = BeautifulSoup(html, "lxml")
        extra = extra or {}

        # 守卫 1：检测页面是否被重定向到公拍网首页/登录页（非详情页）
        page_title_tag = soup.find("title")
        page_title = (page_title_tag.get_text() if page_title_tag else "").strip()
        if (
            "公拍网 - 智慧拍卖" in page_title
            or "我的公拍网" in page_title
            or "登录" in page_title
            or "403 Forbidden" in page_title
            or "404" in page_title
        ):
            raise ValueError(f"详情页无效（标题: {page_title[:30]}），可能 ID 不存在或被重定向")

        # 守卫 2：HTML 必须含有标的关键标识
        if "item2.do" not in html and "标的物" not in html and "竞买公告" not in html:
            raise ValueError("HTML 不含拍卖标的内容，可能页面无效")


        item = AuctionItem(
            source_url=source_url,
            auction_platform=Platform.GPAI.value,
            city_id=city_id,
            province_city=city_name_by_id(city_id) or "上海",
        )

        item.title = self._extract_title(soup, extra)
        item.auction_status = self._extract_status(soup, extra)
        item.image_urls = self._extract_images(soup)
        self._extract_prices(soup, extra, item)
        self._extract_property_details(soup, item, extra)
        self._extract_auction_info(soup, item)
        self._extract_court_info(soup, item)
        self._extract_stats(soup, item)
        self._extract_location(soup, item, city_id, extra)
        self._extract_dates(soup, item)
        self._extract_description(soup, item)
        self._compute_derived_fields(item)

        # 状态归一：抽完开拍/结束时间后，按时间窗 + 当前时间重算时序态，保留结果态。
        # 与后端读取层 / 引擎自校正同一口径，避免存入抓取时刻的过期状态文本。
        item.auction_status = _normalize_status(
            item.auction_status, item.auction_start_time, item.auction_end_time
        )

        return item

    # ============================================================
    # Title
    # ============================================================

    @staticmethod
    def _strip_gpai_suffix(text: str) -> str:
        """Strip ' - 拍品详情 - 公拍网' and similar suffixes from title."""
        for sep in ['-', '–', '—', '|', '·']:
            text = re.sub(r'\s*' + re.escape(sep) + r'\s*拍品详情.*$', '', text)
            text = re.sub(r'\s*' + re.escape(sep) + r'\s*公拍网.*$', '', text)
        text = re.sub(r'[\s\-–—|·]+拍品详情.*$', '', text)
        text = re.sub(r'[\s\-–—|·]+公拍网[\s\-–—|·]*拍品详情.*$', '', text)
        return text.strip()

    def _extract_title(self, soup: BeautifulSoup, extra: dict) -> str:
        # Try many heading selectors known to appear on GPai detail pages
        for sel in [
            "h1", "h2", ".main-info h2", ".detail-header h1", ".detail-head h1",
            ".item-detail h1", ".auction-title", ".title", "[class*='detail'] h1",
            "[class*='detail'] h2", ".pm-title", ".sf-title",
            ".main-info .title", ".detail-title h1",
        ]:
            el = soup.select_one(sel)
            if el:
                text = clean_text(el.get_text())
                if len(text) > 5:
                    return self._strip_gpai_suffix(text)[:200]

        # Try meta title
        meta = soup.select_one("meta[property='og:title']") or soup.select_one("title")
        if meta:
            text = clean_text(meta.get("content", "") or meta.get_text())
            if len(text) > 5:
                return self._strip_gpai_suffix(text)[:200]

        # Fallback to list-level title (trim common prefix artifacts)
        fallback = extra.get("title", "")
        if fallback:
            fallback = re.sub(r'^【[^】]*】', '', fallback).strip()
            return self._strip_gpai_suffix(fallback)[:200]
        return ""

    # ============================================================
    # Status
    # ============================================================

    def _extract_status(self, soup: BeautifulSoup, extra: dict) -> str:
        text = soup.get_text()
        status_map = {
            "竞价中": "进行中", "进行中": "进行中", "正在拍卖": "进行中",
            "即将开拍": "即将开拍", "即将开始": "即将开拍",
            "已结束": "已结束", "已成交": "已成交",
            "已撤回": "已撤回", "中止": "已撤回", "流拍": "已结束",
        }
        for key, val in status_map.items():
            if key in text:
                return val

        # Fallback to list-level status
        list_status = extra.get("auction_status", "")
        for key, val in status_map.items():
            if key in list_status:
                return val
        return "即将开拍"

    # ============================================================
    # Images
    # ============================================================

    def _extract_images(self, soup: BeautifulSoup) -> list[str]:
        urls: list[str] = []

        # Priority 1: main gallery images — prefer high-res attributes
        for img in soup.select(
            ".detail-img img, .pic-list img, .gallery img, "
            "img[src*='gpai'], .carousel img, .swiper-slide img, "
            ".main-pic img, img[src*='sf/gpai']"
        ):
            src = (img.get("data-zoom-src") or
                   img.get("data-big") or
                   img.get("data-original") or
                   img.get("data-large") or
                   img.get("data-src") or
                   img.get("src") or "")
            if src.startswith("//"):
                src = "https:" + src
            elif src.startswith("/"):
                src = "https://s.gpai.net" + src
            if src.startswith("http") and src not in urls:
                urls.append(src)

        # Priority 2: thumbnails (lower quality, only as fallback)
        for img in soup.select(".thumb img"):
            src = (img.get("data-zoom-src") or
                   img.get("data-big") or
                   img.get("data-original") or
                   img.get("data-large") or
                   img.get("data-src") or
                   img.get("src") or "")
            if src.startswith("//"):
                src = "https:" + src
            elif src.startswith("/"):
                src = "https://s.gpai.net" + src
            if src.startswith("http") and src not in urls:
                urls.append(src)

        return urls

    # ============================================================
    # Prices
    # ============================================================

    def _extract_prices(self, soup: BeautifulSoup, extra: dict, item: AuctionItem) -> None:
        text = soup.get_text()
        # Collapse whitespace for reliable regex matching
        text = re.sub(r'\s+', ' ', text)

        # Starting price: try multiple label patterns
        start = self._extract_price_by_labels(text, [
            r'起拍价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
            r'变卖价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
            r'当前价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
            r'拍卖保留价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
        ])
        if not start:
            # Try table row lookup
            start = self._find_row_value(soup, "起拍价") or self._find_row_value(soup, "变卖价")
        if not start:
            # Fallback to list-level price
            start = extra.get("starting_price_text", "")
            if start:
                start_match = re.search(r'([\d,.]+)\s*(万|亿|元)?', start)
                start = start_match.group(0) if start_match else ""
        item.starting_price = parse_price_to_yuan(start) if start else 0

        # Appraisal price — require explicit label to avoid false matches
        appr = self._extract_by_label(text, r'评估价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        if not appr:
            appr = self._find_row_value(soup, "评估价")
        item.appraisal_price = parse_price_to_yuan(appr) if appr else 0

        # Market price
        mkt = self._extract_by_label(text, r'市场价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        if not mkt:
            mkt = self._find_row_value(soup, "市场价")
        item.market_deal_price = parse_price_to_yuan(mkt) if mkt else item.appraisal_price
        # Cap unreasonable market prices: if market > 100x starting and starting > 0, use starting * 1.5
        if item.starting_price > 0 and item.market_deal_price > item.starting_price * 100:
            item.market_deal_price = int(item.starting_price * 1.5)

        # Deposit
        dep = self._extract_by_label(text, r'保证金[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        if not dep:
            dep = self._find_row_value(soup, "保证金")
        item.deposit = parse_price_to_yuan(dep) if dep else 0

        # Increment
        inc = self._extract_by_label(text, r'加价幅度[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        if not inc:
            inc = self._find_row_value(soup, "加价幅度")
        item.increment_amount = parse_price_to_yuan(inc) if inc else 0

        # Listing min price (挂牌价) — often not on GPai pages
        listing = self._extract_by_label(text, r'挂牌价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        if listing:
            item.listing_min_price = parse_price_to_yuan(listing)

    def _extract_price_by_labels(self, text: str, patterns: list[str]) -> str:
        for pat in patterns:
            result = self._extract_by_label(text, pat)
            if result:
                return result
        return ""

    # ============================================================
    # Property details
    # ============================================================

    def _extract_property_details(self, soup: BeautifulSoup, item: AuctionItem,
                                   extra: dict) -> None:
        text = soup.get_text()
        text = re.sub(r'\s+', ' ', text)

        ptype = self._extract_by_label(text, r'(?:物业|房屋|标的|拍卖)类型[：:]\s*(.{2,20}?)(?:\s|$)')
        if not ptype:
            ptype = self._find_row_value(soup, "房屋类型") or self._find_row_value(soup, "标的类型") or self._find_row_value(soup, "房屋用途")
        if ptype:
            # Normalize GPai types: 店铺/商铺→商业, 公寓/住宅→住宅
            if any(w in ptype for w in ("店铺", "商铺", "商业", "办公")):
                item.property_type = "商业"
            elif any(w in ptype for w in ("住宅", "公寓", "别墅")):
                item.property_type = "住宅"
            else:
                item.property_type = ptype
        elif "住宅" in text:
            item.property_type = "住宅"
        elif "商业" in text or "商铺" in text or "店铺" in text:
            item.property_type = "商业"

        # Area —— 公拍网正文常写「房屋建筑面积为338.53平方米」或「建筑面积：112.09平方米」，
        # 分隔符可能是「为/：/:」甚至无分隔，且必须带单位（㎡/平方米/m2）才算数。
        # 关键：强制要求单位，否则会误抓「评估价1768万」「宗地面积134991」等无关数字。
        # 负向先行排除「地下建筑面积」（那是地下部分，不是套内/总建面）。
        area_str = ""
        m = re.search(
            r'(?<!地下)建筑面积[为约是：:]?\s*(\d+(?:\.\d+)?)\s*(?:㎡|平方米|平米|m2|m²)',
            text,
        )
        if m:
            area_str = m.group(1)
        if not area_str:
            area_str = self._find_row_value(soup, "建筑面积")
        # 任意「<数字> 平方米」兜底（同样强制单位），优先取合理住宅范围内的值
        if not area_str:
            for cand in re.findall(r'(\d+(?:\.\d+)?)\s*(?:㎡|平方米|平米|m2|m²)', text):
                try:
                    v = float(cand)
                except ValueError:
                    continue
                if 5 <= v <= 5000:  # 合理单户建面区间，排除宗地/使用权等超大地块面积
                    area_str = cand
                    break
        # 列表页带来的 area_text 兜底
        if not area_str:
            area_text = extra.get("area_text", "")
            if area_text:
                am = re.search(r'(\d+(?:\.\d+)?)', area_text)
                area_str = am.group(1) if am else ""
        item.area = parse_area_sqm(area_str) if area_str else 0.0

        # Layout
        layout = self._extract_by_label(text, r'(?:户型|房型)[：:]\s*(.{2,20}?)(?:\s|$)')
        if not layout:
            layout = self._find_row_value(soup, "户型") or self._find_row_value(soup, "房型")
        item.layout = layout or None

        # Floor info + total floors
        floor = self._extract_by_label(text, r'(?:所在楼层|楼层)[：:]\s*(.{2,30}?)(?:\s|$)')
        if not floor:
            floor = self._find_row_value(soup, "所在楼层") or self._find_row_value(soup, "楼层")
        item.floor_info = floor or None

        # Extract total_floors from floor_info patterns like "3/6层" or "共6层"
        if item.floor_info:
            # Pattern: "第3层/共6层" or "3/6"
            tf_match = re.search(r'(?:共|/)\s*(\d+)\s*(?:层)?', item.floor_info)
            if tf_match:
                item.total_floors = int(tf_match.group(1))
        if not item.total_floors:
            total = self._extract_by_label(text, r'(?:总楼层|总层数)[：:]\s*(\d+)')
            if total and total.isdigit():
                item.total_floors = int(total)

        # Orientation
        orient = self._extract_by_label(text, r'朝向[：:]\s*(.{2,10}?)(?:\s|$)')
        if not orient:
            orient = self._find_row_value(soup, "朝向")
        item.orientation = orient or None

        # Decoration
        deco = self._extract_by_label(text, r'装修[：:]\s*(.{2,20}?)(?:\s|$)')
        if not deco:
            deco = self._find_row_value(soup, "装修")
        item.decoration = deco or None

        # Build year
        year_str = self._extract_by_label(text, r'(?:建筑年代|建成时间|竣工日期|竣工|建成年份)[：:]\s*(\d{4})')
        if not year_str:
            year_str = self._find_row_value(soup, "建筑年代") or self._find_row_value(soup, "建成时间") or self._find_row_value(soup, "竣工日期")
        if not year_str:
            # Try "竣工日期：2016年" without colon delimiter
            year_match = re.search(r'竣工日期[：:\s]*(\d{4})\s*年', text)
            if year_match:
                year_str = year_match.group(1)
        if year_str:
            year_match = re.search(r'(\d{4})', str(year_str))
            if year_match:
                item.build_year = int(year_match.group(1))

        # Sub district
        sub = self._extract_by_label(text, r'板块[：:]\s*(.{2,15}?)(?:\s|$)')
        if not sub:
            sub = self._find_row_value(soup, "板块")
        item.sub_district = sub or None

        # Ring road
        ring = self._extract_by_label(text, r'环线[：:]\s*(.{2,20}?)(?:\s|$)')
        item.ring_road = ring or None

        # Elevator
        elev = self._extract_by_label(text, r'电梯[：:]\s*(.{2,10}?)(?:\s|$)')
        if elev:
            item.has_elevator = "有" in elev and "无" not in elev

        # Has attachments
        if soup.select_one("a[href*='attachment'], a[href*='file'], .attachment, .file-list"):
            item.has_attachments = True
        if "附件" in text:
            item.has_attachments = True

    # ============================================================
    # Auction info
    # ============================================================

    def _extract_auction_info(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        text = soup.get_text()
        text = re.sub(r'\s+', ' ', text)

        # Auction round
        round_match = re.search(r'【(一拍|二拍|变卖)】', text)
        if round_match:
            item.auction_round = round_match.group(1)
        else:
            # GPai format: "拍卖次数：第二次拍卖" → 二拍
            if "第二次" in text or "二拍" in text:
                item.auction_round = "二拍"
            elif "第一次" in text or "一拍" in text:
                item.auction_round = "一拍"
            elif "变卖" in text:
                item.auction_round = "变卖"

        # Auction times — try multiple date formats
        # Format 1: "拍卖时间：2026年5月22日10时至2026年5月25日10时止"
        cn_range_match = re.search(
            r'拍卖时间[：:]\s*'
            r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(\d{1,2})\s*时\s*(?:至|—|到)\s*'
            r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(\d{1,2})\s*时',
            text
        )
        if cn_range_match:
            try:
                item.auction_start_time = datetime(
                    int(cn_range_match.group(1)), int(cn_range_match.group(2)),
                    int(cn_range_match.group(3)), int(cn_range_match.group(4))
                )
                item.auction_end_time = datetime(
                    int(cn_range_match.group(5)), int(cn_range_match.group(6)),
                    int(cn_range_match.group(7)), int(cn_range_match.group(8))
                )
            except ValueError:
                pass

        # Format 2: "开拍时间：2026-05-22 10:00"
        if not item.auction_start_time:
            start_match = re.search(
                r'(?:开(?:拍|始)时间|拍卖(?:开始)?时间)[：:]\s*'
                r'(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*\d{1,2}:\d{2})',
                text
            )
            if start_match:
                try:
                    ds = start_match.group(1).replace("/", "-").replace(".", "-")
                    item.auction_start_time = datetime.strptime(ds, "%Y-%m-%d %H:%M")
                except ValueError:
                    pass

        if not item.auction_end_time:
            end_match = re.search(
                r'(?:结(?:束|拍)时间|拍卖(?:结束)?时间|预计结束)[：:]\s*'
                r'(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*\d{1,2}:\d{2})',
                text
            )
            if end_match:
                try:
                    ds = end_match.group(1).replace("/", "-").replace(".", "-")
                    item.auction_end_time = datetime.strptime(ds, "%Y-%m-%d %H:%M")
                except ValueError:
                    pass

        # Try ISO format dates (sometimes in script tags)
        if not item.auction_start_time:
            iso_match = re.search(
                r'(?:startTime|beginTime)["\s:=]+(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})',
                text
            )
            if iso_match:
                try:
                    item.auction_start_time = datetime.strptime(
                        iso_match.group(1)[:19].replace("T", " "), "%Y-%m-%d %H:%M:%S"
                    )
                except ValueError:
                    pass

        if not item.auction_end_time:
            iso_match = re.search(
                r'(?:endTime)["\s:=]+(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})',
                text
            )
            if iso_match:
                try:
                    item.auction_end_time = datetime.strptime(
                        iso_match.group(1)[:19].replace("T", " "), "%Y-%m-%d %H:%M:%S"
                    )
                except ValueError:
                    pass

    # ============================================================
    # Court info
    # ============================================================

    def _extract_court_info(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        text = soup.get_text()
        text = re.sub(r'\s+', ' ', text)

        court = self._extract_by_label(text, r'处置单位[：:]\s*(.{2,40}?)(?:咨询|联系|电话|\s|$)')
        if not court:
            court = self._extract_by_label(text, r'(?:执行|委托)?法院[：:]\s*(.{2,40}?)(?:咨询|联系|电话|\s|$)')
        if not court:
            court = self._find_row_value(soup, "处置法院") or self._find_row_value(soup, "法院")
        item.court_name = court or None

        # Case number
        case = re.search(r'(?:案号|执行案号|案件编号)[：:]\s*(.{5,60}?)(?:拍卖|执行|标的|$)', text)
        if case:
            item.case_number = case.group(1).strip()

        # Announcement URL
        for a in soup.select("a[href]"):
            href = a.get("href", "")
            txt = a.get_text(strip=True)
            if ("公告" in txt or "竞买" in txt or "须知" in txt) and href.startswith("http"):
                item.announcement_url = href
                break
        if not item.announcement_url:
            gonggao = soup.select_one("a[href*='gg'], a[href*='notice'], a[href*='announce']")
            if gonggao:
                item.announcement_url = gonggao.get("href", "")

    # ============================================================
    # Stats
    # ============================================================

    def _extract_stats(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        text = soup.get_text()

        view_match = re.search(r'(\d+)\s*人?(?:围观|次围观|关注)', text)
        if view_match:
            item.view_count = int(view_match.group(1))

        part_match = re.search(r'(\d+)\s*人?(?:报名|参拍|出价)', text)
        if part_match:
            item.participant_count = int(part_match.group(1))

        if "贷款" in text or "按揭" in text:
            item.loan_support = True

    # ============================================================
    # Location
    # ============================================================

    def _extract_location(self, soup: BeautifulSoup, item: AuctionItem,
                          city_id: int, extra: dict | None = None) -> None:
        extra = extra or {}
        text = soup.get_text()
        text = re.sub(r'\s+', ' ', text)

        # Address — prefer property address over contact/office addresses
        # Property address sources: 拍品名称 table row, title, 坐落 label
        addr = ""
        # Try "拍品名称" row first (property name = address in GPai format)
        addr = self._find_row_value(soup, "拍品名称")
        if not addr:
            addr = self._extract_by_label(text, r'(?:标的|坐落|拍卖)?地址[：:]\s*(.{5,200}?)(?:查看地图|\s|$)')
        if not addr:
            addr = self._find_row_value(soup, "坐落")
        # Filter out contact addresses (contain phone numbers or 联系/举报)
        if addr and ("举报" in addr or "联系" in addr or re.search(r'\d{8,}', addr)):
            addr = ""
        # Clean trailing parenthetical info from address
        if addr:
            addr = re.sub(r'[（(]\s*(?:建筑)?面积[：:][^)]*[)）]$', '', addr).strip()
            addr = re.sub(r'[（(][^)）]*[）)]$', '', addr).strip()
        # Fallback: extract from title (GPai titles include the property address)
        if not addr and item.title:
            # Match residential and non-residential property address suffixes
            addr_match = re.search(
                r'([一-鿿]{2,6}(?:市|区|县).{5,80}'
                r'(?:室|号|楼|层|幢|栋|地块|厂房|商铺|车位|单元|房产|建筑物|构筑物|土地|在建工程|不动产|大厦|新村))',
                item.title
            )
            if addr_match:
                addr = addr_match.group(1)
        # Last resort: address from extra (list-item level)
        if not addr:
            addr = extra.get("address", "")
        # 防止超长地址（数据库 address 字段限 256）
        item.address = (addr or "")[:240]

        # Community name —— 优先从当前标的 title/address 用专用提取器（最准、不会抓到页面其它房源）
        community = extract_community_from_title(item.title or "")
        if not community and item.address:
            community = extract_community_from_title(item.address)
        # 兜底：原有的标签/正则提取（仅当专用提取器没结果时）
        if not community:
            community = self._extract_by_label(text, r'小区[：:]\s*(.{2,30}?)(?:\s|$)')
        if not community:
            community = self._find_row_value(soup, "小区")
        if not community and item.address:
            # Extract community name ending in typical suffixes
            # Use negative lookahead to avoid matching through city/district/town names
            comm_match = re.search(
                r'((?:(?!市|区|镇|省)[一-鿿\w]){2,12}'
                r'(?:花园|苑|新城|公寓|城(?!区)|湾|庭|园|里|村|嘉园|弄))\s*'
                r'(?:\d|号|幢|栋|楼|室|$)',
                item.address
            )
            if comm_match:
                community = comm_match.group(1)
        if not community and item.title:
            comm_match = re.search(
                r'((?:(?!市|区|镇|省)[一-鿿\w]){2,12}'
                r'(?:花园|苑|新城|公寓|城(?!区)|湾|庭|园|里|村|嘉园|弄))\s*'
                r'(?:\d|号|幢|栋|楼|室|$)',
                item.title
            )
            if comm_match:
                community = comm_match.group(1)
        # Fallback：从 address 抽「X路Y弄」格式作为伪小区名（公拍网很多房源没明确小区名）
        if not community and item.address:
            lane_match = re.search(
                r'((?:(?!市|区|镇)[一-鿿\w]){2,8}路\d+弄)',
                item.address
            )
            if lane_match:
                community = lane_match.group(1)
        # Filter out non-community matches like partial addresses
        # 注意：含「路」的可能是「X路Y弄」伪小区名（fallback），保留；纯路名（不含弄）则过滤
        if community and len(community) > 16:
            community = ""
        if community and "路" in community and "弄" not in community:
            community = ""
        item.community_name = community or ""

        # District: from label, then from address, then from title
        district = self._extract_by_label(text, r'(?:所在)?区域[：:]\s*(.{2,15}?)(?:\s|$)')
        if not district:
            district = self._find_row_value(soup, "区域")
        if not district and item.address:
            district = extract_district(item.address, city_id)
        if not district:
            district = extract_district(item.title, city_id)
        item.district = district or ""

    # ============================================================
    # Dates
    # ============================================================

    def _extract_dates(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        # publish_date 取「法院公告落款日期」= 房源真实上架日（法律意义上的公告发布日）。
        # 公拍网详情页正文里，竞买公告/竞买须知末尾有「XX人民法院 + 落款日期」，
        # 日期可能是阿拉伯数字(2026年5月21日)或中文数字(二〇二六年五月十一日)。
        # 提取不到时回退 datetime.now()（极少数无标准落款的页面）。
        text = soup.get_text("\n", strip=True)
        announce = extract_court_announce_date(text)
        item.publish_date = announce or datetime.now()
        item.source_updated_at = datetime.now()

    # ============================================================
    # Description
    # ============================================================

    def _extract_description(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        parts = []

        # GPai: .details-con 是「竞买公告/竞买须知/标的物介绍/特别提示」完整正文区块
        # （含标的物现状、租赁占用、户口、税费承担等风险信息），优先抓取。
        # 退而求其次再用 .details-main 等中心内容选择器。
        for sel in [
            ".details-con",
            ".details-main", ".detail-desc", ".description",
            ".item-desc", "[class*='desc']", ".auction-detail",
            ".detail-content", ".main-content", ".detail-text", ".sf-content",
            ".block-wrap", ".details-wrap",
        ]:
            el = soup.select_one(sel)
            if el:
                desc = clean_text(el.get_text(separator=" ", strip=True))[:8000]
                if len(desc) > 50:
                    parts.append(desc)
                    break

        if not parts:
            main = soup.select_one(".details-main, .detail-main, main, article")
            if main:
                desc = clean_text(main.get_text(separator=" ", strip=True))[:8000]
                if len(desc) > 50:
                    parts.append(desc)

        item.description = "\n".join(parts)

    # ============================================================
    # Computed fields
    # ============================================================

    def _compute_derived_fields(self, item: AuctionItem) -> None:
        if item.area > 0:
            if item.starting_price > 0:
                item.starting_unit_price = round(item.starting_price / item.area, 2)
            if item.market_deal_price > 0:
                item.market_deal_unit_price = round(item.market_deal_price / item.area, 2)

        if item.appraisal_price > 0:
            item.court_discount_rate = round(item.starting_price / item.appraisal_price, 4) if item.starting_price > 0 else 0
            if item.market_deal_price > 0:
                item.market_discount_rate = round(item.market_deal_price / item.appraisal_price, 4)

        if item.appraisal_price > 0 and item.starting_price > 0:
            item.bargain_potential = item.appraisal_price - item.starting_price

        if item.latest_total_price == 0:
            item.latest_total_price = item.starting_price
        if item.latest_deal_unit_price == 0 and item.area > 0:
            item.latest_deal_unit_price = round(item.latest_total_price / item.area, 2)

    # ============================================================
    # Helpers
    # ============================================================

    def _find_row_value(self, soup: BeautifulSoup, label: str) -> str:
        """Find value in table row by label text."""
        rows = soup.find_all("tr")
        for row in rows:
            cells = row.find_all(["th", "td"])
            for i, cell in enumerate(cells):
                if label in cell.get_text():
                    if i + 1 < len(cells):
                        return clean_text(cells[i + 1].get_text())
        return ""

    @staticmethod
    def _extract_by_label(text: str, pattern: str) -> str:
        match = re.search(pattern, text)
        return match.group(1).strip() if match else ""
