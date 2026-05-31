"""PaiMai detail parser — parses MTOP detail API JSON into AuctionItem.

The MTOP detail API (govauctionmtopdetailservice.queryhttpsitemdetail/3.0/)
returns structured JSON with most fields. All money values are in cents (分).

Nested objects of interest:
  auctionHouse — housing details: layout, floor, orientation, decoration, etc.
  auctionAddress — full address with community, district, sub_district
  bidCycle — auction time window
  aiStructure — AI-parsed property structure
"""
import re
from datetime import datetime
from loguru import logger

from .base import AbstractParser
from ..models.item import AuctionItem, Platform
from ..cleaners.price import parse_price_to_yuan, parse_area_sqm
from ..cleaners.text import clean_text, extract_district


# Category mapping
CATEGORY_MAP = {
    "50025969": "住宅",
    "200782003": "商业",
    "200788003": "工业",
    "200798003": "其他",
    "50025970": "土地",
}

# Division code → city name
DIVISION_MAP = {
    "310000": "上海",
    "330200": "宁波",
    "330100": "杭州",
}


def _cents_to_yuan(cents) -> int:
    if not cents:
        return 0
    return int(int(cents) / 100)


def _safe_get(d: dict, *keys, default=None):
    """Try multiple keys, return first non-None/non-empty value."""
    for k in keys:
        v = d.get(k)
        if v is not None and v != "":
            return v
    return default


class TaobaoPaiMaiDetailParser(AbstractParser):
    """Parse a PaiMai detail API JSON response into an AuctionItem."""

    platform = "阿里拍卖"

    async def parse(self, api_data: dict, source_url: str, city_id: int,
                    extra: dict | None = None) -> AuctionItem:
        """Parse detail API JSON into AuctionItem.

        api_data: the parsed MTOP JSON response (the whole thing, not just data).
        extra: optional dict with list-item fields (area, property_type, district, etc.)
        """
        extra = extra or {}
        data = api_data.get("data", api_data)
        if "data" in data:
            data = data["data"]

        # Extract nested objects（initData 中部分字段可能是 str 而非 dict，需保护）
        auction_house = data.get("auctionHouse")
        auction_house = auction_house if isinstance(auction_house, dict) else {}
        auction_address = data.get("auctionAddress")
        auction_address = auction_address if isinstance(auction_address, dict) else {}
        ai_structure = data.get("aiStructure")
        ai_structure = ai_structure if isinstance(ai_structure, dict) else {}
        benefit = data.get("benefit")
        benefit = benefit if isinstance(benefit, dict) else {}

        item = AuctionItem(
            source_url=source_url,
            auction_platform=Platform.ALI.value,
            city_id=city_id,
        )

        self._extract_identity(data, item)
        self._extract_prices(data, benefit, item)
        self._extract_auction_info(data, item)
        self._extract_court_info(data, item)
        self._extract_location(data, auction_address, item, city_id, extra)
        self._extract_stats(data, item)
        self._extract_images(data, item)
        self._extract_property_details(
            data, auction_house, ai_structure, extra, item
        )
        self._extract_tags(data, item)
        self._extract_dates(data, item)
        self._extract_description(data, item)
        self._compute_derived_fields(item)

        return item

    # ============================================================
    # Identity
    # ============================================================

    def _extract_identity(self, data: dict, item: AuctionItem) -> None:
        item.title = data.get("realTitle") or data.get("title", "")
        if item.title and len(item.title) > 200:
            item.title = item.title[:200]

    # ============================================================
    # Prices (all in cents → convert to yuan)
    # ============================================================

    def _extract_prices(self, data: dict, benefit: dict, item: AuctionItem) -> None:
        item.starting_price = _cents_to_yuan(data.get("startPrice", 0))
        item.market_deal_price = _cents_to_yuan(data.get("marketPrice", 0))
        item.deposit = _cents_to_yuan(data.get("foregiftPrice", 0))
        item.increment_amount = _cents_to_yuan(data.get("incrementPrice", 0))
        item.latest_total_price = _cents_to_yuan(data.get("currentPriceLong", 0))

        # Appraisal price — initData 中评估价在 consultPrice（otherPrice 里 CONSULT_PRICE
        # 的 title 即"评估价"）；旧 MTOP 格式用 appraisalPrice 等字段。
        appr = _safe_get(data, "appraisalPrice", "evaluatePrice", "assessPrice",
                         "appraisedPrice", "valuationPrice", "consultPrice")
        if appr:
            item.appraisal_price = _cents_to_yuan(appr)
        if not item.appraisal_price and benefit:
            appr = _safe_get(benefit, "appraisalPrice", "evaluatePrice")
            if appr:
                item.appraisal_price = _cents_to_yuan(appr)
        # Only fall back to market_deal_price if no dedicated appraisal field
        if not item.appraisal_price and item.market_deal_price > 0:
            item.appraisal_price = item.market_deal_price

        # 市场参考价缺失时用评估价兜底（与 deal_reference 逻辑一致）
        if not item.market_deal_price and item.appraisal_price > 0:
            item.market_deal_price = item.appraisal_price

        # Listing min price（referencePrice 兜底；consultPrice 已用作评估价）
        ref_price = benefit.get("referencePrice") or benefit.get("referencePriceCent")
        if ref_price:
            item.listing_min_price = _cents_to_yuan(ref_price)

        # Loan support
        item.loan_support = bool(
            data.get("orgLoan") or data.get("supportForegiftLoan")
        )

    # ============================================================
    # Auction info
    # ============================================================

    def _extract_auction_info(self, data: dict, item: AuctionItem) -> None:
        # Round from titleTag
        title_tag = data.get("titleTag", {})
        pre_tags = title_tag.get("preTags", [])
        if pre_tags:
            round_val = pre_tags[0].get("value", "")
            if round_val in ("一拍", "二拍", "变卖"):
                item.auction_round = round_val

        # Status from bidStatus
        bid_status = int(data.get("bidStatus", 0))
        status_map = {
            1: "即将开拍", 2: "即将开拍", 3: "进行中",
            4: "已结束", 5: "已成交", 6: "已撤回",
        }
        status = status_map.get(bid_status, "")
        if status:
            item.auction_status = status

        # Start / end times
        start_str = data.get("startTime", "")
        if start_str:
            try:
                item.auction_start_time = datetime.strptime(
                    start_str, "%Y-%m-%d %H:%M:%S"
                )
            except ValueError:
                pass

        end_str = data.get("endTime", "")
        if end_str:
            try:
                item.auction_end_time = datetime.strptime(
                    end_str, "%Y-%m-%d %H:%M:%S"
                )
            except ValueError:
                pass

    # ============================================================
    # Court info
    # ============================================================

    def _extract_court_info(self, data: dict, item: AuctionItem) -> None:
        # Court name
        item.court_name = data.get("sellerNick", "")
        if not item.court_name:
            au = data.get("associatedUnit", {})
            item.court_name = au.get("orgName", "")

        # Case number from various possible locations
        case = _safe_get(data, "caseNumber", "caseNo", "executionCaseNo",
                         "caseNum", "enforcementNo")
        if case:
            item.case_number = str(case)

        # Announcement URL
        gonggao = data.get("gongGaoUrl", "")
        if gonggao:
            if gonggao.startswith("//"):
                gonggao = "https:" + gonggao
            item.announcement_url = gonggao

        # Contact / service info → append to description
        extra_lines = []
        phone = data.get("phone", "")
        if phone:
            extra_lines.append(f"电话: {phone}")
        sp = data.get("connectPeople", "")
        if sp:
            extra_lines.append(f"辅助机构: {sp}")
        item.description = "\n".join(extra_lines) if extra_lines else None

    # ============================================================
    # Location
    # ============================================================

    def _extract_location(self, data: dict, auction_address: dict,
                          item: AuctionItem, city_id: int,
                          extra: dict | None = None) -> None:
        extra = extra or {}
        # Province / city from divisions
        divisions = data.get("divisions", [])
        if divisions:
            div_code = divisions[0].get("divisionCode", "")
            item.province_city = DIVISION_MAP.get(
                div_code, divisions[0].get("divisionName", "")
            )
        else:
            item.province_city = DIVISION_MAP.get(str(city_id), "")

        # District from location string: "上海 上海市 长宁区"
        loc = data.get("location", "")
        if loc:
            parts = loc.split()
            if len(parts) >= 3:
                item.district = parts[-1]

        # District from locationId
        loc_id = str(data.get("locationId", ""))
        if loc_id and not item.district:
            item.district = extract_district(loc_id, city_id)

        # District from auctionAddress
        if not item.district:
            dist = _safe_get(auction_address, "district", "area", "region")
            if dist:
                item.district = dist

        # Sub district
        sub = _safe_get(auction_address, "subDistrict", "block", "plate",
                        "subArea", "street")
        if sub:
            item.sub_district = sub

        # Ring road
        ring = _safe_get(auction_address, "ringRoad", "ring")
        if ring:
            item.ring_road = ring

        # Full address
        addr = data.get("auctionAddress", "")
        if isinstance(addr, dict):
            addr = _safe_get(addr, "fullAddress", "address", "detailAddress") or ""
        if not addr:
            addr = _safe_get(auction_address, "fullAddress", "address", "detail")
        item.address = str(addr) if addr else ""

        # Fallback: extract address from title if API didn't provide one
        if not item.address and item.title:
            addr_match = re.search(
                r'([一-鿿]{2,6}(?:市|区|县).{5,80}'
                r'(?:室|号|楼|层|幢|栋|地块|厂房|商铺|车位|单元|房产|建筑物|构筑物|土地|在建工程|不动产|大厦|新村))',
                item.title
            )
            if addr_match:
                item.address = addr_match.group(1)
        # Last resort: address from extra (list-item level)
        if not item.address:
            item.address = extra.get("address", "")

        # Geolocation: initData 的 latlong=["lng","lat"]（字符串数组）优先
        latlong = data.get("latlong")
        if isinstance(latlong, list) and len(latlong) == 2:
            try:
                item.lng = float(latlong[0])
                item.lat = float(latlong[1])
            except (ValueError, TypeError):
                pass

        # Geolocation from auctionAddress or map data
        if (item.lat is None or item.lng is None) and isinstance(auction_address, dict):
            api_lat = auction_address.get("lat") or auction_address.get("latitude")
            api_lng = auction_address.get("lng") or auction_address.get("longitude")
            if api_lat and api_lng:
                try:
                    item.lat = float(api_lat)
                    item.lng = float(api_lng)
                except (ValueError, TypeError):
                    pass
        if item.lat is None or item.lng is None:
            map_info = data.get("mapInfo") or data.get("locationMap") or {}
            if isinstance(map_info, dict):
                mlat = map_info.get("lat") or map_info.get("latitude")
                mlng = map_info.get("lng") or map_info.get("longitude")
                if mlat and mlng:
                    try:
                        item.lat = float(mlat)
                        item.lng = float(mlng)
                    except (ValueError, TypeError):
                        pass

        # Community name from various sources
        community = ""
        if isinstance(auction_address, dict):
            community = _safe_get(
                auction_address,
                "communityName", "community", "village", "estateName", "plotName"
            ) or ""
        if not community and item.address:
            comm_match = re.search(
                r'((?:(?!市|区|镇|省)[一-鿿\w]){2,12}'
                r'(?:花园|苑|新城|公寓|城(?!区)|湾|庭|园|里|村|嘉园|弄))',
                str(item.address)
            )
            if comm_match:
                community = comm_match.group(1)
        if not community and item.title:
            comm_match = re.search(
                r'((?:(?!市|区|镇|省)[一-鿿\w]){2,12}'
                r'(?:花园|苑|新城|公寓|城(?!区)|湾|庭|园|里|村|嘉园|弄))',
                item.title
            )
            if comm_match:
                community = comm_match.group(1)
        item.community_name = community

    # ============================================================
    # Stats
    # ============================================================

    def _extract_stats(self, data: dict, item: AuctionItem) -> None:
        item.view_count = int(data.get("seer", 0))
        item.participant_count = int(data.get("applyNum", 0))

        # Has attachments
        attach_list = data.get("attachmentList") or data.get("attachments") or []
        if attach_list:
            item.has_attachments = True

    # ============================================================
    # Images
    # ============================================================

    def _extract_images(self, data: dict, item: AuctionItem) -> None:
        urls: list[str] = []

        head = data.get("headMedia", {})
        img_list = head.get("imageList", [])
        if not img_list:
            img_list = data.get("imageList", [])

        for src in img_list:
            if src.startswith("//"):
                src = "https:" + src
            if src.startswith("http"):
                # Upgrade Taobao CDN size suffix for full resolution
                # _400x400.jpg → .jpg, _100x100.jpg → .jpg
                src = re.sub(r'_\d+x\d+\.(jpg|jpeg|png|webp)', r'.\1', src)
                urls.append(src)

        # Main picture
        pict = head.get("pictUrl") or data.get("pictUrl", "")
        if pict:
            if pict.startswith("//"):
                pict = "https:" + pict
            if pict.startswith("http"):
                pict = re.sub(r'_\d+x\d+\.(jpg|jpeg|png|webp)', r'.\1', pict)
                if pict not in urls:
                    urls.insert(0, pict)

        # Deduplicate preserving order
        seen = set()
        unique = []
        for u in urls:
            if u not in seen:
                seen.add(u)
                unique.append(u)
        item.image_urls = unique

    # ============================================================
    # Property details
    # ============================================================

    def _extract_property_details(self, data: dict, auction_house: dict,
                                   ai_structure: dict, extra: dict,
                                   item: AuctionItem) -> None:
        # Category from catId
        cat_id = str(data.get("catId", ""))
        ptype = CATEGORY_MAP.get(cat_id, "")
        if ptype:
            item.property_type = ptype
        elif not item.property_type:
            pt = _safe_get(auction_house, "propertyType", "houseType", "estateType",
                           "usage", "realEstateType")
            if pt:
                item.property_type = pt

        # --- Area ---
        if extra:
            area_str = extra.get("area_text", "")
            if area_str:
                area_match = re.search(r'([\d.]+)\s*(?:㎡|m²|平方米|m2)', area_str)
                if area_match:
                    item.area = parse_area_sqm(area_match.group(1))
        if not item.area:
            area_val = _safe_get(auction_house, "buildingArea", "area",
                                  "constructionArea", "coveredArea")
            if area_val:
                item.area = parse_area_sqm(str(area_val))
        if not item.area:
            area_match = re.search(
                r'建面[约]?(\d+(?:\.\d+)?)\s*(?:平|㎡|m²|平方米|m2)', item.title
            )
            if area_match:
                item.area = parse_area_sqm(area_match.group(1))

        # --- Layout ---
        layout = _safe_get(auction_house, "layout", "houseStructure", "roomLayout",
                           "roomType", "unitType", "structure")
        if not layout:
            rooms = _safe_get(auction_house, "roomCount", "rooms")
            halls = _safe_get(auction_house, "hallCount", "halls")
            if rooms:
                layout = f"{rooms}室{halls}厅" if halls else f"{rooms}室"
        item.layout = layout or None

        # --- Floor info + Total floors ---
        floor = _safe_get(auction_house, "floorInfo", "floor", "currentFloor",
                           "floorLevel", "floorDescription")
        item.floor_info = str(floor) if floor else None

        total = _safe_get(auction_house, "totalFloor", "totalFloors", "maxFloor",
                           "floorCount", "buildingFloors")
        if total:
            try:
                item.total_floors = int(total)
            except (ValueError, TypeError):
                pass
        # Extract from floor_info pattern
        if not item.total_floors and item.floor_info:
            tf_match = re.search(r'(?:共|/)\s*(\d+)\s*(?:层)?', item.floor_info)
            if tf_match:
                item.total_floors = int(tf_match.group(1))

        # --- Orientation ---
        orient = _safe_get(auction_house, "orientation", "direction", "face",
                            "toward", "houseDirection")
        item.orientation = str(orient) if orient else None

        # --- Decoration ---
        deco = _safe_get(auction_house, "decoration", "decorateType", "decorate",
                          "renovation", "finishLevel")
        item.decoration = str(deco) if deco else None

        # --- Build year ---
        year_val = _safe_get(auction_house, "buildYear", "yearBuilt", "constructionYear",
                              "builtYear", "completionYear", "buildingYear")
        if year_val:
            try:
                year_int = int(year_val)
                if 1900 < year_int < 2030:
                    item.build_year = year_int
            except (ValueError, TypeError):
                year_match = re.search(r'(\d{4})', str(year_val))
                if year_match:
                    y = int(year_match.group(1))
                    if 1900 < y < 2030:
                        item.build_year = y

        # --- Elevator ---
        elev = _safe_get(auction_house, "hasElevator", "elevator", "lift",
                          "isElevator")
        if elev is not None:
            if isinstance(elev, bool):
                item.has_elevator = elev
            else:
                item.has_elevator = str(elev).lower() in ("true", "1", "yes", "有")

        # --- AI structure fallback ---
        if ai_structure:
            if not item.layout:
                item.layout = _safe_get(ai_structure, "layout", "roomType")
            if not item.area:
                area_val = _safe_get(ai_structure, "area", "buildingArea")
                if area_val:
                    item.area = parse_area_sqm(str(area_val))
            if not item.orientation:
                item.orientation = _safe_get(ai_structure, "orientation", "direction")
            if not item.decoration:
                item.decoration = _safe_get(ai_structure, "decoration", "finish")

    # ============================================================
    # Tags
    # ============================================================

    def _extract_tags(self, data: dict, item: AuctionItem) -> None:
        tags = data.get("tagFront", {}).get("itemTags", [])
        for tag in tags:
            value = tag.get("value", "")
            if "贷款" in value:
                item.loan_support = True

    # ============================================================
    # Dates
    # ============================================================

    def _extract_dates(self, data: dict, item: AuctionItem) -> None:
        # Try to extract real publish/update timestamps from API
        # MTOP uses milliseconds timestamps in some fields, strings in others
        pub_str = _safe_get(data, "publishTime", "createTime", "gmtCreate",
                            "announcementTime", "listingTime")
        if pub_str:
            try:
                if isinstance(pub_str, (int, float)):
                    item.publish_date = datetime.fromtimestamp(
                        float(pub_str) / 1000.0 if float(pub_str) > 1e12
                        else float(pub_str)
                    )
                elif str(pub_str).isdigit() and len(str(pub_str)) >= 13:
                    item.publish_date = datetime.fromtimestamp(int(pub_str) / 1000.0)
                elif str(pub_str).isdigit() and len(str(pub_str)) == 10:
                    item.publish_date = datetime.fromtimestamp(int(pub_str))
                else:
                    item.publish_date = datetime.strptime(str(pub_str), "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError, OSError):
                pass

        upd_str = _safe_get(data, "modifyTime", "gmtModified", "updateTime",
                            "lastModifiedTime", "modified")
        if upd_str:
            try:
                if isinstance(upd_str, (int, float)):
                    item.source_updated_at = datetime.fromtimestamp(
                        float(upd_str) / 1000.0 if float(upd_str) > 1e12
                        else float(upd_str)
                    )
                elif str(upd_str).isdigit() and len(str(upd_str)) >= 13:
                    item.source_updated_at = datetime.fromtimestamp(int(upd_str) / 1000.0)
                elif str(upd_str).isdigit() and len(str(upd_str)) == 10:
                    item.source_updated_at = datetime.fromtimestamp(int(upd_str))
                else:
                    item.source_updated_at = datetime.strptime(str(upd_str), "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError, OSError):
                pass

        # Fallbacks
        if not item.publish_date:
            item.publish_date = datetime.now()
        if not item.source_updated_at:
            item.source_updated_at = item.publish_date or datetime.now()

    # ============================================================
    # Description
    # ============================================================

    def _extract_description(self, data: dict, item: AuctionItem) -> None:
        parts = []
        if item.description:
            parts.append(item.description)

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
            if item.starting_price > 0:
                item.court_discount_rate = round(item.starting_price / item.appraisal_price, 4)
            if item.market_deal_price > 0 and item.appraisal_price > 0:
                item.market_discount_rate = round(item.market_deal_price / item.appraisal_price, 4)

        if item.appraisal_price > 0 and item.starting_price > 0:
            item.bargain_potential = item.appraisal_price - item.starting_price

        if item.latest_total_price == 0:
            item.latest_total_price = item.starting_price
        if item.latest_deal_unit_price == 0 and item.area > 0:
            item.latest_deal_unit_price = round(item.latest_total_price / item.area, 2)
