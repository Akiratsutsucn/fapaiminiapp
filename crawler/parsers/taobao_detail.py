"""Taobao SF detail page parser — extracts all ~45 fields from rendered HTML."""
import re
from datetime import datetime
from bs4 import BeautifulSoup
from loguru import logger

from .base import AbstractParser
from ..models.item import AuctionItem, Platform
from ..cleaners.price import parse_price_to_yuan, parse_area_sqm
from ..cleaners.text import clean_text, extract_district


class TaobaoDetailParser(AbstractParser):
    """Parse a Taobao SF (sf.taobao.com) detail page HTML into an AuctionItem."""

    platform = "阿里拍卖"

    async def parse(self, html: str, source_url: str, city_id: int) -> AuctionItem:
        soup = BeautifulSoup(html, "lxml")
        item = AuctionItem(
            source_url=source_url,
            auction_platform=Platform.ALI.value,
            city_id=city_id,
        )

        # --- title ---
        item.title = self._extract_title(soup)

        # --- images ---
        item.image_urls = self._extract_images(soup)

        # --- price section ---
        self._extract_prices(soup, item)

        # --- property details table ---
        self._extract_property_details(soup, item)

        # --- auction info ---
        self._extract_auction_info(soup, item)

        # --- court info ---
        self._extract_court_info(soup, item)

        # --- statistics ---
        self._extract_stats(soup, item)

        # --- location ---
        self._extract_location(soup, item, city_id)

        # --- dates ---
        self._extract_dates(soup, item)

        # --- description ---
        self._extract_description(soup, item)

        # --- computed fields ---
        self._compute_derived_fields(item)

        return item

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
        if city_id == 310000:
            item.province_city = "上海"
        elif city_id == 330200:
            item.province_city = "宁波"

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

        # Attach extended data as JSON in description
        extended = {
            "loan_support": item.loan_support,
            "has_attachments": item.has_attachments,
        }

        parts = []
        if desc:
            parts.append(desc)
        parts.append(f"【扩展信息】{extended}")
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
