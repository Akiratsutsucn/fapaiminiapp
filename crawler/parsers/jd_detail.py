"""JD Auction detail page parser — extracts fields from paimai.jd.com detail HTML."""
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


class JDDetailParser(AbstractParser):
    """Parse a JD auction (paimai.jd.com) detail page HTML into an AuctionItem."""

    platform = "京东拍卖"

    async def parse(self, html: str, source_url: str, city_id: int,
                    extra: dict | None = None) -> AuctionItem:
        soup = BeautifulSoup(html, "lxml")
        text = soup.get_text()
        text = re.sub(r'\s+', ' ', text)
        extra = extra or {}

        item = AuctionItem(
            source_url=source_url,
            auction_platform=Platform.JD.value,
            city_id=city_id,
            province_city=city_name_by_id(city_id) or "上海",
        )

        item.title = self._extract_title(soup, text, extra)
        item.image_urls = self._extract_images(soup)
        self._extract_prices(text, item, extra)
        self._extract_property_details(soup, text, item, extra)
        self._extract_auction_info(text, item)
        self._extract_court_info(soup, text, item)
        self._extract_stats(text, item)
        self._extract_location(text, item, city_id, extra)
        self._extract_dates(text, item)
        self._extract_description(text, item)
        self._compute_derived_fields(item)

        # 关键字段补全：调 paimai 公开 API 拿 startTime/endTime（HTML 渲染拿不到）
        await self._fill_from_api(item, source_url)

        return item

    async def _fill_from_api(self, item, source_url: str) -> None:
        """从 https://api.m.jd.com 调 getProductBasicInfo 补结构化字段。"""
        # 解析 paimaiId
        m = re.search(r"paimai\.jd\.com/(\d+)", source_url) or re.search(r"orderId=(\d+)", source_url)
        if not m:
            return
        paimai_id = m.group(1)
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.m.jd.com/api",
                    params={
                        "appid": "paimai",
                        "functionId": "getProductBasicInfo",
                        "body": '{"paimaiId":' + paimai_id + '}',
                        "loginType": "3",
                    },
                )
                d = resp.json().get("data", {}) or {}
        except Exception as e:
            logger.debug(f"[JD] api fill failed for {paimai_id}: {e}")
            return

        # startTime / endTime 是 unix timestamp ms
        if not item.auction_start_time:
            ts = d.get("startTime")
            if ts:
                try:
                    item.auction_start_time = datetime.fromtimestamp(int(ts) / 1000)
                except (ValueError, TypeError):
                    pass
        if not item.auction_end_time:
            ts = d.get("endTime")
            if ts:
                try:
                    item.auction_end_time = datetime.fromtimestamp(int(ts) / 1000)
                except (ValueError, TypeError):
                    pass

        # 顺便补保证金（如果 HTML 没解析到）
        if not item.deposit:
            ep = d.get("ensurePrice")
            if ep:
                try:
                    item.deposit = int(float(ep))
                except (ValueError, TypeError):
                    pass

        # 补经纬度（如果 extendInfoMap 含）— 减少后续 geocoding 调用
        if not item.lat or not item.lng:
            ext = d.get("extendInfoMap")
            if ext and isinstance(ext, str):
                try:
                    import json as _json
                    extm = _json.loads(ext)
                    lat_v = extm.get("lat")
                    lng_v = extm.get("lng")
                    if lat_v:
                        item.lat = float(lat_v)
                    if lng_v:
                        item.lng = float(lng_v)
                except Exception:
                    pass

    # ============================================================
    # Title
    # ============================================================

    def _extract_title(self, soup: BeautifulSoup, text: str, extra: dict) -> str:
        # Pattern: 【变卖】<title text>
        title_match = re.search(r'【(?:一拍|二拍|变卖)】(.{5,120}?)(?:当前价|变卖|起拍价|标的物|$)', text)
        if title_match:
            return title_match.group(1).strip()[:120]

        # Try h1 or heading selectors
        for sel in ['h1', '.auction-title', '.pm-title', '[class*="detail-title"]',
                      '.item-title', '.lot-title', '.product-title']:
            el = soup.select_one(sel)
            if el and len(el.get_text(strip=True)) > 5:
                return clean_text(el.get_text())[:120]

        # Fallback to list-level title
        fallback = extra.get("title", "")
        if fallback:
            fallback = re.sub(r'^【[^】]*】', '', fallback).strip()
            return fallback[:120]

        # Last resort: extract from source_url
        id_match = re.search(r'paimai\.jd\.com/(\d+)', source_url)
        if id_match:
            return f"JD-{id_match.group(1)}"
        return ""

    # ============================================================
    # Images
    # ============================================================

    def _extract_images(self, soup: BeautifulSoup) -> list[str]:
        urls: list[str] = []
        for img in soup.select(
            ".pic img, .gallery img, .detail-img img, .swiper-slide img, "
            "img[src*='paimai'], img[src*='360buyimg'], img[src*='jd.com'], "
            "img[src*='jfs'], img[src*='jdpay'], .carousel img, .img-container img"
        ):
            # Prefer high-res attributes over src (JD often lazy-loads full-res images)
            src = (img.get("data-zoom-src") or
                   img.get("data-big") or
                   img.get("data-original") or
                   img.get("data-large") or
                   img.get("data-src") or
                   img.get("src") or "")
            if src.startswith("//"):
                src = "https:" + src
            if src.startswith("http") and src not in urls:
                urls.append(src)
        return urls

    # ============================================================
    # Prices
    # ============================================================

    def _extract_prices(self, text: str, item: AuctionItem, extra: dict) -> None:
        # Starting price: try multiple labels
        start = self._extract_price_by_labels(text, [
            r'当前价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
            r'变卖预缴款[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
            r'变卖价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
            r'起拍价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
            r'拍卖保留价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?',
        ])
        if not start:
            start = extra.get("starting_price_text", "")
            if start:
                start_match = re.search(r'([\d,.]+)\s*(万|亿|元)?', start)
                start = start_match.group(0) if start_match else ""
        item.starting_price = parse_price_to_yuan(start) if start else 0

        # Appraisal price
        appr = self._extract_by_label(text, r'评估价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.appraisal_price = parse_price_to_yuan(appr) if appr else 0

        # Market price
        mkt = self._extract_by_label(text, r'市场价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.market_deal_price = parse_price_to_yuan(mkt) if mkt else item.appraisal_price
        # Cap unreasonable market prices
        if item.starting_price > 0 and item.market_deal_price > item.starting_price * 100:
            item.market_deal_price = int(item.starting_price * 1.5)

        # Deposit
        dep = self._extract_by_label(text, r'保证金[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        if not dep:
            dep = self._extract_by_label(text, r'变卖预缴款[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.deposit = parse_price_to_yuan(dep) if dep else 0

        # Increment
        inc = self._extract_by_label(text, r'加价幅度[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        item.increment_amount = parse_price_to_yuan(inc) if inc else 0

        # Listing min price
        listing = self._extract_by_label(text, r'挂牌价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
        if not listing:
            listing = self._extract_by_label(text, r'参考价[：:]\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?')
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

    def _extract_property_details(self, soup: BeautifulSoup, text: str,
                                    item: AuctionItem, extra: dict) -> None:
        # Property type
        ptype = self._extract_by_label(text, r'(?:物业|房屋|标的|拍卖)类型[：:]\s*(.{2,20}?)(?:\s|$)')
        if not ptype:
            ptype = self._find_row_value(soup, "房屋类型") or self._find_row_value(soup, "物业类型")
        if not ptype:
            ptype = self._find_row_value(soup, "规划用途")
        if ptype:
            item.property_type = ptype
        elif "住宅" in text:
            item.property_type = "住宅"
        elif "商业" in text:
            item.property_type = "商业"

        # Area
        area_str = self._extract_by_label(text, r'建筑面积[：:]\s*([\d,.]+)\s*(?:㎡|平方米|m2)?')
        if not area_str:
            area_str = self._find_row_value(soup, "建筑面积")
        if not area_str:
            area_match = re.search(r'(\d+\.?\d*)\s*(?:㎡|平方米|m2)', text)
            if area_match:
                area_str = area_match.group(1)
        if not area_str:
            area_str = extra.get("area_text", "")
            if area_str:
                area_match = re.search(r'([\d.]+)', area_str)
                area_str = area_match.group(1) if area_match else ""
        item.area = parse_area_sqm(area_str) if area_str else 0.0

        # Layout
        layout = self._extract_by_label(text, r'(?:户型|房型|室厅|房屋结构)[：:]\s*(.{2,20}?)(?:\s|$)')
        if not layout:
            layout = self._find_row_value(soup, "户型") or self._find_row_value(soup, "房型")
        item.layout = layout or None

        # Floor + total floors from combined pattern
        floor = self._extract_by_label(text, r'(?:所在楼层|楼层)[：:]\s*(.{2,20}?)(?:\s|$)')
        if not floor:
            floor = self._find_row_value(soup, "所在楼层") or self._find_row_value(soup, "楼层")
        item.floor_info = floor or None

        # Total floors from floor_info pattern or label
        if item.floor_info:
            tf_match = re.search(r'(?:共|/)\s*(\d+)\s*(?:层)?', item.floor_info)
            if tf_match:
                item.total_floors = int(tf_match.group(1))
        if not item.total_floors:
            total = self._extract_by_label(text, r'总楼层[：:]\s*(\d+)')
            if total and total.isdigit():
                item.total_floors = int(total)

        # Orientation
        orient = self._extract_by_label(text, r'朝向[：:]\s*(.{2,10}?)(?:\s|$)')
        item.orientation = orient or None

        # Decoration
        deco = self._extract_by_label(text, r'装修[：:]\s*(.{2,20}?)(?:\s|$)')
        item.decoration = deco or None

        # Build year
        year_str = self._extract_by_label(text, r'(?:建筑年代|建成时间|竣工)[：:]\s*(\d{4})')
        if year_str and year_str.isdigit() and len(year_str) == 4:
            item.build_year = int(year_str)

        # Elevator — try table row first (JD table format: "电梯 | 无"), then text regex
        elev = self._find_row_value(soup, "电梯")
        if not elev:
            elev = self._extract_by_label(text, r'电梯[：:\s]*(.{2,10}?)(?:\s|$)')
        if elev:
            item.has_elevator = "有" in elev and "无" not in elev

        # Sub district (板块)
        sub = self._extract_by_label(text, r'板块[：:]\s*(.{2,15}?)(?:\s|$)')
        if not sub:
            sub = self._find_row_value(soup, "板块")
        item.sub_district = sub or None

        # Ring road (环线)
        ring = self._extract_by_label(text, r'环线[：:]\s*(.{2,20}?)(?:\s|$)')
        if not ring:
            ring = self._find_row_value(soup, "环线")
        item.ring_road = ring or None

        # Has attachments
        if soup.select_one("a[href*='attachment'], a[href*='file'], .attachment, .file-list"):
            item.has_attachments = True
        if "附件" in text:
            item.has_attachments = True

    # ============================================================
    # Auction info
    # ============================================================

    def _extract_auction_info(self, text: str, item: AuctionItem) -> None:
        # Auction round
        round_match = re.search(r'【(一拍|二拍|变卖)】', text)
        if round_match:
            item.auction_round = round_match.group(1)
        else:
            for key in ["一拍", "二拍", "变卖"]:
                if key in text:
                    item.auction_round = key
                    break

        # Auction status
        status_map = {
            "正在进行": "进行中", "竞价中": "进行中", "进行中": "进行中",
            "即将开拍": "即将开拍", "即将开始": "即将开拍",
            "已结束": "已结束", "已成交": "已成交",
            "已撤回": "已撤回", "中止": "已撤回",
        }
        for key, val in status_map.items():
            if key in text:
                item.auction_status = val
                break

        # Start time
        start_match = re.search(
            r'(?:开(?:拍|始)时间|拍卖时间)[：:]\s*'
            r'(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*\d{1,2}:\d{2})',
            text
        )
        if start_match:
            try:
                ds = start_match.group(1).replace("/", "-").replace(".", "-")
                item.auction_start_time = datetime.strptime(ds, "%Y-%m-%d %H:%M")
            except ValueError:
                pass

        # End time
        end_match = re.search(
            r'(?:结(?:束|拍)时间|预计结束)[：:]\s*'
            r'(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*\d{1,2}:\d{2})',
            text
        )
        if end_match:
            try:
                ds = end_match.group(1).replace("/", "-").replace(".", "-")
                item.auction_end_time = datetime.strptime(ds, "%Y-%m-%d %H:%M")
            except ValueError:
                pass

    # ============================================================
    # Court info
    # ============================================================

    def _extract_court_info(self, soup: BeautifulSoup, text: str,
                             item: AuctionItem) -> None:
        court = self._extract_by_label(
            text,
            r'(?:处置机构|处置法院|执行法院|处置单位|委托法院)[：:]\s*(.{2,40}?)(?:咨询|联系|电话|\s|$)'
        )
        if not court:
            court = self._extract_by_label(text, r'([一-鿿]{2,10}?(?:人民法院|法院|仲裁委))')
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

    def _extract_stats(self, text: str, item: AuctionItem) -> None:
        view_nums = [int(m.group(1)) for m in re.finditer(r'(\d+)\s*人?(?:围观|次围观)', text)]
        if view_nums:
            item.view_count = max(view_nums)

        part_nums = [int(m.group(1)) for m in re.finditer(r'(\d+)\s*人?(?:报名|出价)', text)]
        if part_nums:
            item.participant_count = max(part_nums)

        if "贷款" in text or "按揭" in text or "一键贷款" in text:
            item.loan_support = True

    # ============================================================
    # Location
    # ============================================================

    @staticmethod
    def _extract_city_from_text(source_text: str) -> str | None:
        """Extract province_city from a text (address or title)."""
        if not source_text:
            return None

        # Find all "市" positions and their preceding char candidates
        candidates = []
        for m in re.finditer(r'市', source_text):
            pos = m.start()
            # Try 3-char city name (e.g. 连云港市, 秦皇岛市)
            if pos >= 3:
                cand3 = source_text[pos - 3:pos]
                if re.match(r'^[一-鿿]+$', cand3) and not any(
                    w in cand3 for w in ("省", "区", "县", "镇")
                ):
                    candidates.append((pos, cand3))
            # Try 2-char city name
            if pos >= 2:
                cand2 = source_text[pos - 2:pos]
                if re.match(r'^[一-鿿]+$', cand2) and not any(
                    w in cand2 for w in ("省", "区", "县", "镇")
                ):
                    candidates.append((pos, cand2))

        # Prefer candidate right before a district (区/县)
        for pos, cand in candidates:
            after = source_text[pos + 1:pos + 8]
            if re.search(r'^[一-鿿]{1,4}(?:新区|[区县])', after):
                return cand + "市"
        if candidates:
            return candidates[0][1] + "市"

        # Direct province abbreviation like "北京" or "天津"
        for prov in ["北京", "上海", "天津", "重庆"]:
            if source_text.startswith(prov):
                return prov

        # "XX省" or "XX市" at start
        province_match = re.match(
            r'([一-鿿]{2,3})(?:市|省|自治区|地区|州)', source_text
        )
        if province_match:
            return province_match.group(1) + "市"
        return None

    def _extract_location(self, text: str, item: AuctionItem, city_id: int,
                          extra: dict | None = None) -> None:
        extra = extra or {}
        # Address
        addr = self._extract_by_label(text, r'标的物所在地[：:]\s*(.{5,150}?)(?:查看地图|\s|$)')
        if not addr:
            addr = self._extract_by_label(text, r'(?:坐落|地址|位置)[：:]\s*(.{5,150}?)(?:\s|$)')
        # Fallback: extract address from title if label-based extraction failed
        if not addr and item.title:
            addr_match = re.search(
                r'([一-鿿]{2,6}(?:市|省|区).{5,80}'
                r'(?:号|室|楼|层|幢|栋|地块|厂房|商铺|车位|单元|房产|建筑物|构筑物|土地|在建工程|不动产|大厦|新村))',
                item.title
            )
            if addr_match:
                addr = addr_match.group(1)
        # Last resort: address from extra (list-item level)
        if not addr:
            addr = extra.get("address", "")
        item.address = addr or ""

        # Province/city: try address first, then title as fallback
        extracted_city = self._extract_city_from_text(item.address)
        if not extracted_city:
            extracted_city = self._extract_city_from_text(item.title)
        if not extracted_city:
            # Try full page text as last resort
            extracted_city = self._extract_city_from_text(text)
        if extracted_city:
            item.province_city = extracted_city

        # Community name —— 只从当前标的的 title / address 提取，
        # 不从整页 text 搜索（页面含推荐位等其它房源，会抓错小区名）
        community = extract_community_from_title(item.title or "")
        if not community and item.address:
            community = extract_community_from_title(item.address)
        item.community_name = community or ""

        # District: from label, then from address using generic extraction
        district = self._extract_by_label(text, r'(?:所在)?区域[：:]\s*(.{2,15}?)(?:\s|$)')
        if not district:
            district = extract_district(item.address or item.title, city_id)
        item.district = district or ""

    # ============================================================
    # Dates
    # ============================================================

    def _extract_dates(self, text: str, item: AuctionItem) -> None:
        item.publish_date = datetime.now()
        item.source_updated_at = datetime.now()

    # ============================================================
    # Description
    # ============================================================

    def _extract_description(self, text: str, item: AuctionItem) -> None:
        desc_parts = []
        desc_match = re.search(
            r'标的物详情描述(.{50,2000}?)(?:竞买公告|竞买须知|出价记录)',
            text, re.DOTALL
        )
        if desc_match:
            desc_parts.append(desc_match.group(1).strip()[:2000])

        item.description = "\n".join(desc_parts)

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
