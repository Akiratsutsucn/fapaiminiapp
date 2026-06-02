"""Taobao SF detail page parser — extracts all ~45 fields.

新版淘宝拍卖详情页（pages-fast.m.taobao.com/.../dzc-detail）是 CSR 页面，
房源数据放在 `window.__ICE_SUSPENSE_LOADER__.set('dzc-detail-ssr', {initData:{...}})`
的结构化 JSON 里。优先从该 JSON 提取（可靠）；解析不到时回退旧版 HTML 选择器。
"""
import json
import re
from datetime import datetime
from bs4 import BeautifulSoup
from loguru import logger

from .base import AbstractParser
from ..models.item import AuctionItem, Platform
from ..cleaners.price import parse_price_to_yuan, parse_area_sqm
from ..cleaners.text import clean_text, extract_district
from ..cleaners.city import city_name_by_id
from ..cleaners.status import normalize_status as _normalize_status


# catId → 物业类型（与 url_registry 分类映射一致）
CAT_ID_PROPERTY_TYPE = {
    "50025969": "住宅",
    "200782003": "商业",
    "200788003": "工业",
    "200798003": "其他",
    "50025970": "土地",
}


class TaobaoDetailParser(AbstractParser):
    """Parse a Taobao SF detail page into an AuctionItem."""

    platform = "阿里拍卖"

    async def parse(self, html: str, source_url: str, city_id: int) -> AuctionItem:
        item = AuctionItem(
            source_url=source_url,
            auction_platform=Platform.ALI.value,
            city_id=city_id,
        )

        # 优先：从新版页面的 initData JSON 提取
        init_data = self._extract_init_data(html)
        if init_data:
            try:
                self._parse_from_init_data(init_data, item, city_id, html)
            except Exception as e:
                logger.warning(f"[TaobaoDetail] initData 解析异常，回退 HTML：{e}")
                init_data = None

        # 回退：旧版 HTML 选择器（initData 缺失或解析失败时）
        if not init_data or not item.title or item.title.startswith("Ai"):
            self._parse_from_html(html, item, city_id)

        self._compute_derived_fields(item)

        # 状态归一：与其它平台 / 后端读取层同一口径——按 start/end + 当前时间重算时序态，
        # 保留结果态（已成交/已撤回等）。initData 路径已按时间推断，此处再统一确认一次。
        item.auction_status = _normalize_status(
            item.auction_status, item.auction_start_time, item.auction_end_time
        )
        return item

    # ============================================================
    # 新版：initData JSON 提取
    # ============================================================

    def _extract_init_data(self, html: str) -> dict | None:
        """从 window.__ICE_SUSPENSE_LOADER__.set('dzc-detail-ssr', {...}) 提取 initData。

        用括号配平截取完整 JSON（贪婪正则不可靠）。
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
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"[TaobaoDetail] initData JSON 解析失败：{e}")
            return None
        return obj.get("initData") or None

    def _parse_from_init_data(self, d: dict, item: AuctionItem, city_id: int, html: str = "") -> None:
        """从 initData 结构化数据填充 AuctionItem（主路径）。"""
        # --- 标题 ---
        item.title = d.get("title") or d.get("realTitle") or ""

        # --- 图片（真实房源照片）---
        imgs = d.get("imageList") or (d.get("headMedia") or {}).get("imageList") or []
        urls = []
        for u in imgs:
            if not u:
                continue
            if u.startswith("//"):
                u = "https:" + u
            elif not u.startswith("http"):
                continue
            urls.append(u)
        if not urls and d.get("pictUrl"):
            pu = d["pictUrl"]
            urls.append("https:" + pu if pu.startswith("//") else pu)
        item.image_urls = urls

        # --- 价格（initData 价格单位为「分」，需 ÷100 转元）---
        item.starting_price = self._fen_to_yuan(d.get("startPrice"))
        item.appraisal_price = self._fen_to_yuan(d.get("consultPrice"))
        item.deposit = self._fen_to_yuan(d.get("foregiftPrice"))
        item.increment_amount = self._fen_to_yuan(d.get("incrementPrice"))
        # 市场参考：评估价兜底
        item.market_deal_price = item.appraisal_price

        # --- 起拍单价（otherPrice.bidCoreFields，单位万/㎡）---
        for f in (d.get("otherPrice") or {}).get("bidCoreFields", []):
            if f.get("key") == "SINGLE_METER_START_PRICE" and f.get("value"):
                try:
                    val = float(str(f["value"]).replace(",", "").strip())
                    item.starting_unit_price = round(val * 10000, 2)  # 万/㎡ → 元/㎡
                except ValueError:
                    pass

        # --- 地址 / 小区 ---
        item.address = d.get("auctionAddress") or ""

        # --- 位置：location="上海 上海市 普陀区" + divisions ---
        item.province_city = city_name_by_id(city_id)
        for div in d.get("divisions", []):
            name = div.get("divisionName", "")
            if name.endswith("区") or name.endswith("县"):
                item.district = name
        if not item.district:
            item.district = extract_district(item.title, city_id) or ""

        # --- 坐标 latlong=["lng","lat"] ---
        latlong = d.get("latlong") or []
        if len(latlong) == 2:
            try:
                item.lng = float(latlong[0])
                item.lat = float(latlong[1])
            except (ValueError, TypeError):
                pass

        # --- 物业类型（catId）---
        cat_id = str(d.get("catId", ""))
        if cat_id in CAT_ID_PROPERTY_TYPE:
            item.property_type = CAT_ID_PROPERTY_TYPE[cat_id]

        # --- 轮次（titleTag.preTags）---
        for tag in (d.get("titleTag") or {}).get("preTags", []):
            v = tag.get("value", "")
            if v in ("一拍", "二拍", "变卖", "重新拍卖"):
                item.auction_round = "变卖" if v == "变卖" else v
                break

        # --- 时间 ---
        item.auction_start_time = self._parse_dt(d.get("startTime"))
        item.auction_end_time = self._parse_dt(d.get("endTime"))

        # --- 状态：依据时间 + bidStatus 推断 ---
        item.auction_status = self._infer_status(d)

        # --- 法院 ---
        org = (d.get("associatedUnit") or {}).get("orgName")
        item.court_name = org or None

        # --- 公告 URL ---
        notice = d.get("noticeUrl") or d.get("gongGaoUrl")
        if notice:
            item.announcement_url = ("https:" + notice) if notice.startswith("//") else notice

        # --- 统计 ---
        item.view_count = self._to_int(d.get("notifyNum"))
        item.participant_count = self._to_int(d.get("applyNum"))

        # --- 贷款 / 标签 ---
        item.loan_support = bool(d.get("applyLoan") or d.get("loan"))

        # --- 面积 / 户型 / 楼层：从 description 文本里抠（initData 无独立字段）---
        self._fill_building_from_text(d, item, html)

        # --- 描述 + 标签摘要 ---
        tags = [t.get("value", "") for t in (d.get("benefit") or {}).get("itemTags", []) if t.get("value")]
        desc_parts = []
        if tags:
            desc_parts.append("标签：" + "、".join(tags))
        if d.get("bidLimitRule"):
            desc_parts.append(d["bidLimitRule"])
        item.description = "\n".join(desc_parts) if desc_parts else None

        item.publish_date = item.publish_date or datetime.now()
        item.source_updated_at = datetime.now()

    def _fill_building_from_text(self, d: dict, item: AuctionItem, html: str = "") -> None:
        """从 initData 文本字段 + 详情页渲染的 HTML 文本里提取面积、房屋类型等
        （这些明细 initData 无结构化字段，散落在标的物介绍文本里）。"""
        # 拼接可能含建筑信息的文本：标题、地址、+ 详情页 body 纯文本
        parts = [str(d.get(k, "")) for k in ["title", "auctionAddress"]]
        if html:
            try:
                body_text = BeautifulSoup(html, "lxml").get_text(" ")
                parts.append(body_text)
            except Exception:
                pass
        blob = " ".join(parts)

        # 建筑面积
        if not item.area:
            m = re.search(r"建筑面积[：:]*\s*([\d,.]+)\s*(?:平方米|㎡|m²)", blob)
            if m:
                item.area = parse_area_sqm(m.group(1))
        # 房屋类型（仅当未由 catId 确定时）
        m = re.search(r"房屋类型[：:]*\s*([^\s；;，,。、]+)", blob)
        if m:
            item.property_type = item.property_type or m.group(1)
        # 总层数
        if not item.total_floors:
            m = re.search(r"总层数[：:]*\s*(\d+)", blob)
            if m:
                item.total_floors = int(m.group(1))
        # 建筑年代
        if not item.build_year:
            m = re.search(r"(?:建筑年代|竣工(?:日期|时间)?)[：:]*\s*(\d{4})", blob)
            if m:
                item.build_year = int(m.group(1))

    def _infer_status(self, d: dict) -> str:
        """依据开拍/结束时间推断拍卖状态。"""
        now = datetime.now()
        st = self._parse_dt(d.get("startTime"))
        et = self._parse_dt(d.get("endTime"))
        if st and now < st:
            return "即将开拍"
        if st and et and st <= now <= et:
            return "进行中"
        if et and now > et:
            return "已结束"
        return "即将开拍"

    # ============================================================
    # 小工具
    # ============================================================

    @staticmethod
    def _to_int(v) -> int:
        if v is None:
            return 0
        try:
            return int(float(str(v).replace(",", "").strip()))
        except (ValueError, TypeError):
            return 0

    @staticmethod
    def _fen_to_yuan(v) -> int:
        """initData 中价格字段单位为「分」，转为「元」。"""
        if v is None:
            return 0
        try:
            return int(round(float(str(v).replace(",", "").strip()) / 100))
        except (ValueError, TypeError):
            return 0

    @staticmethod
    def _parse_dt(s) -> datetime | None:
        if not s:
            return None
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                return datetime.strptime(str(s).strip(), fmt)
            except ValueError:
                continue
        return None

    # ============================================================
    # 旧版 HTML 解析（回退路径）
    # ============================================================

    def _parse_from_html(self, html: str, item: AuctionItem, city_id: int) -> None:
        soup = BeautifulSoup(html, "lxml")
        if not item.title or item.title.startswith("Ai"):
            item.title = self._extract_title(soup)
        if not item.image_urls:
            item.image_urls = self._extract_images(soup)
        if not item.starting_price:
            self._extract_prices(soup, item)
        self._extract_property_details(soup, item)
        self._extract_auction_info(soup, item)
        self._extract_court_info(soup, item)
        self._extract_stats(soup, item)
        if not item.district or not item.address:
            self._extract_location(soup, item, city_id)
        self._extract_dates(soup, item)
        if not item.description:
            self._extract_description(soup, item)

    # ============================================================
    # Extraction helpers
    # ============================================================

    def _safe_extract(self, soup: BeautifulSoup, selectors: list[str]) -> str:
        """Try multiple CSS selectors, return text of first match."""
        for sel in selectors:
            el = soup.select_one(sel)
            if el:
                return clean_text(el.get_text())
        return ""

    def _find_row_value(self, soup: BeautifulSoup, label: str) -> str:
        """Find a value in a table row by label text (e.g., '建筑面积' -> '120.5㎡')."""
        # Look for <th> or <td> containing the label, then get the next <td>
        rows = soup.find_all("tr")
        for row in rows:
            cells = row.find_all(["th", "td"])
            for i, cell in enumerate(cells):
                if label in cell.get_text():
                    if i + 1 < len(cells):
                        return clean_text(cells[i + 1].get_text())
        return ""

    # ============================================================
    # Field extraction methods
    # ============================================================

    def _extract_title(self, soup: BeautifulSoup) -> str:
        selectors = [
            "h1", ".item-title", ".detail-title", ".sf-item-title",
            "[class*='title']", ".main-title",
        ]
        return self._safe_extract(soup, selectors)

    def _extract_images(self, soup: BeautifulSoup) -> list[str]:
        """Extract image URLs from the detail page gallery."""
        urls: list[str] = []
        # Try common gallery selectors
        for img in soup.select(
            ".item-gallery img, .sf-gallery img, .img-container img, "
            ".swiper-slide img, .carousel img, [class*='gallery'] img"
        ):
            src = img.get("src") or img.get("data-src") or ""
            if src and not src.endswith(".webp"):
                # Normalize to https
                if src.startswith("//"):
                    src = "https:" + src
                elif not src.startswith("http"):
                    continue
                urls.append(src)

        return urls

    def _extract_prices(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        """Extract all price fields."""
        text = soup.get_text()

        # Starting price (起拍价)
        starting_text = self._safe_extract(soup, [
            ".starting-price .price, .start-price, [class*='starting-price'] .value, "
            ".price-start .num, .current-price .num",
        ])
        if not starting_text:
            starting_text = self._extract_by_label_regex(text, r'起拍价[：:]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.starting_price = parse_price_to_yuan(starting_text) if starting_text else 0

        # Appraisal price (评估价)
        appraisal_text = self._extract_by_label_regex(text, r'评估价[：:]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.appraisal_price = parse_price_to_yuan(appraisal_text) if appraisal_text else 0

        # Market deal price (市场成交价) — may use appraisal as fallback
        market_text = self._extract_by_label_regex(text, r'市场(?:成交)?价[：:]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.market_deal_price = parse_price_to_yuan(market_text) if market_text else item.appraisal_price

        # Deposit (保证金)
        deposit_text = self._extract_by_label_regex(text, r'保证金[：:]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.deposit = parse_price_to_yuan(deposit_text) if deposit_text else 0

        # Increment (加价幅度)
        inc_text = self._extract_by_label_regex(text, r'加价幅度[：:]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.increment_amount = parse_price_to_yuan(inc_text) if inc_text else 0

        # Listing min price (挂牌最低价)
        listing_text = self._extract_by_label_regex(text, r'挂牌(?:最低)?价[：:]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.listing_min_price = parse_price_to_yuan(listing_text) if listing_text else 0

        # Latest deal (最新成交) — try to find from page
        latest_text = self._extract_by_label_regex(text, r'最新成交(?:总)?价[：:]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.latest_total_price = parse_price_to_yuan(latest_text) if latest_text else 0

    def _extract_property_details(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        """Extract building information from the detail table."""
        text = soup.get_text()

        # Property type (物业类型)
        ptype = self._extract_by_label_regex(text, r'物业类型[：:]?\s*(.+)')
        if ptype:
            item.property_type = ptype
        else:
            # Also check from the title or category
            pt = self._find_row_value(soup, "物业类型") or self._find_row_value(soup, "房屋类型")
            if pt:
                item.property_type = pt

        # Area (建筑面积)
        area_str = self._extract_by_label_regex(text, r'建筑面积[：:]?\s*([\d,.]+)\s*(㎡|平方米)?')
        if not area_str:
            area_str = self._find_row_value(soup, "建筑面积") or self._find_row_value(soup, "面积")
        item.area = parse_area_sqm(area_str) if area_str else 0.0

        # Layout (户型)
        layout = self._extract_by_label_regex(text, r'户型[：:]?\s*(.+)')
        if not layout:
            layout = self._find_row_value(soup, "户型") or self._find_row_value(soup, "房型")
        item.layout = layout or None

        # Floor info (所在楼层 / 总楼层)
        floor = self._extract_by_label_regex(text, r'所在楼层[：:]?\s*(.+)')
        if not floor:
            floor = self._find_row_value(soup, "所在楼层") or self._find_row_value(soup, "楼层")
        item.floor_info = floor or None

        total = self._extract_by_label_regex(text, r'总楼层[：:]?\s*(\d+)')
        if not total:
            total = self._find_row_value(soup, "总楼层")
        if total and total.isdigit():
            item.total_floors = int(total)

        # Elevator (有无电梯)
        elevator_text = self._extract_by_label_regex(text, r'电梯[：:]?\s*(.+)')
        if elevator_text:
            item.has_elevator = "有" in elevator_text and "无" not in elevator_text

        # Orientation (朝向)
        orient = self._extract_by_label_regex(text, r'朝向[：:]?\s*(.+)')
        if not orient:
            orient = self._find_row_value(soup, "朝向")
        item.orientation = orient or None

        # Decoration (装修)
        deco = self._extract_by_label_regex(text, r'装修[：:]?\s*(.+)')
        if not deco:
            deco = self._find_row_value(soup, "装修")
        item.decoration = deco or None

        # Build year (建筑年代)
        year_str = self._extract_by_label_regex(text, r'建筑年代[：:]?\s*(\d{4})')
        if not year_str:
            year_str = self._find_row_value(soup, "建筑年代")
        if year_str and year_str.isdigit() and len(year_str) == 4:
            item.build_year = int(year_str)

        # Ring road (环线)
        ring = self._extract_by_label_regex(text, r'环线[：:]?\s*(.+)')
        item.ring_road = ring or None

        # Sub district (板块)
        sub = self._extract_by_label_regex(text, r'板块[：:]?\s*(.+)')
        item.sub_district = sub or None

    def _extract_auction_info(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        """Extract auction round, status, start/end times."""
        text = soup.get_text()

        # Auction round (拍卖阶段)
        round_map = {"一拍": "一拍", "二拍": "二拍", "变卖": "变卖"}
        for key, val in round_map.items():
            if key in text:
                item.auction_round = val
                break

        # Auction status
        status_map = {
            "即将开拍": "即将开拍", "进行中": "进行中", "已结束": "已结束",
            "已成交": "已成交", "已撤回": "已撤回", "竞价中": "进行中",
            "预告中": "即将开拍",
        }
        for key, val in status_map.items():
            if key in text:
                item.auction_status = val
                break

        # Auction start time
        start_match = re.search(
            r'开(?:拍|始)时间[：:]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s*\d{1,2}:\d{2})', text
        )
        if start_match:
            try:
                item.auction_start_time = datetime.strptime(
                    start_match.group(1).replace("/", "-"), "%Y-%m-%d %H:%M"
                )
            except ValueError:
                pass

        # Auction end time
        end_match = re.search(
            r'结(?:束|拍)时间[：:]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s*\d{1,2}:\d{2})', text
        )
        if end_match:
            try:
                item.auction_end_time = datetime.strptime(
                    end_match.group(1).replace("/", "-"), "%Y-%m-%d %H:%M"
                )
            except ValueError:
                pass

    def _extract_court_info(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        """Extract court name, case number, announcement URL."""
        text = soup.get_text()

        # Court name
        court = self._extract_by_label_regex(text, r'处置单位[：:]?\s*(.+)')
        if not court:
            court = self._extract_by_label_regex(text, r'(?:执行|处置)?法院[：:]?\s*(.+)')
        item.court_name = court or None

        # Case number
        case = re.search(r'(?:案号|案件编号)[：:]?\s*(\(?\d{4}\)?[一-龥\d\-\s号]+)', text)
        if case:
            item.case_number = case.group(1).strip()

        # Announcement URL
        ann_link = soup.find("a", string=re.compile(r"公告|竞买"))
        if ann_link:
            item.announcement_url = ann_link.get("href")

    def _extract_stats(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        """Extract view count, participant count, loan support."""
        text = soup.get_text()

        # View count (围观人数)
        view_match = re.search(r'(\d+)\s*人?(?:围观|次围观)', text)
        if view_match:
            item.view_count = int(view_match.group(1))

        # Participant count (参拍/报名人数)
        participant_match = re.search(r'(\d+)\s*人?(?:报名|参拍|出价)', text)
        if participant_match:
            item.participant_count = int(participant_match.group(1))

        # Loan support
        if "贷款" in text or "按揭" in text:
            item.loan_support = True

        # Attachments
        if "附件" in text and soup.find("a", string=re.compile(r"附件")):
            item.has_attachments = True

    def _extract_location(self, soup: BeautifulSoup, item: AuctionItem, city_id: int) -> None:
        """Extract and normalize location fields."""
        text = soup.get_text()

        # Province/city
        item.province_city = city_name_by_id(city_id)

        # District (区)
        district = self._extract_by_label_regex(text, r'(?:所在|标的)?区域[：:]?\s*(.+)')
        if not district:
            # Try to extract from title (e.g., "上海市浦东新区...")
            district = extract_district(item.title, city_id)
        item.district = district or ""

        # Address
        addr = self._extract_by_label_regex(text, r'(?:标的)?地址[：:]?\s*(.+)')
        if not addr:
            addr = self._find_row_value(soup, "地址")
        item.address = addr or ""

        # Community name (小区名)
        community = self._extract_by_label_regex(text, r'小区[：:]?\s*(.+)')
        if not community:
            community = self._find_row_value(soup, "小区")
        item.community_name = community or ""

    def _extract_dates(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        """Extract publish date and source update time."""
        text = soup.get_text()

        pub_match = re.search(
            r'(?:发布|挂牌)时间[：:]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})', text
        )
        if pub_match:
            try:
                item.publish_date = datetime.strptime(
                    pub_match.group(1).replace("/", "-"), "%Y-%m-%d"
                )
            except ValueError:
                pass
        else:
            item.publish_date = datetime.now()

        # Source updated at
        item.source_updated_at = datetime.now()

    def _extract_description(self, soup: BeautifulSoup, item: AuctionItem) -> None:
        """Extract the property description."""
        desc_selectors = [
            ".item-description", ".detail-desc", ".description-content",
            ".sf-desc", "[class*='description']", ".intro-content",
        ]
        desc = None
        for sel in desc_selectors:
            el = soup.select_one(sel)
            if el:
                desc = el.get_text(strip=True)[:5000]
                break

        parts = []
        if desc:
            parts.append(desc)
        item.description = "\n".join(parts)

    # ============================================================
    # Computed fields
    # ============================================================

    def _compute_derived_fields(self, item: AuctionItem) -> None:
        """Compute derived pricing fields from extracted raw values."""
        # Unit prices
        if item.area > 0:
            if item.starting_price > 0:
                item.starting_unit_price = round(item.starting_price / item.area, 2)
            if item.market_deal_price > 0:
                item.market_deal_unit_price = round(item.market_deal_price / item.area, 2)
            if item.appraisal_price > 0:
                item.market_deal_price = item.market_deal_price or item.appraisal_price
                item.market_deal_unit_price = item.market_deal_unit_price or round(item.appraisal_price / item.area, 2)

        # Discount rates
        if item.appraisal_price > 0:
            item.court_discount_rate = round(item.starting_price / item.appraisal_price, 4)
            if item.market_deal_price > 0:
                item.market_discount_rate = round(item.market_deal_price / item.appraisal_price, 4)

        # Bargain potential (捡漏空间) = appraisal - starting
        if item.appraisal_price > 0 and item.starting_price > 0:
            item.bargain_potential = item.appraisal_price - item.starting_price

        # Latest deal price defaults
        if item.latest_total_price == 0:
            item.latest_total_price = item.starting_price
        if item.latest_deal_unit_price == 0 and item.area > 0:
            item.latest_deal_unit_price = round(item.latest_total_price / item.area, 2)

    # ============================================================
    # Utility
    # ============================================================

    @staticmethod
    def _extract_by_label_regex(text: str, pattern: str) -> str:
        """Extract a value using a label regex pattern."""
        match = re.search(pattern, text)
        return match.group(1).strip() if match else ""
