"""Field mapper: raw dict -> AuctionItem with type coercion."""
from datetime import datetime
from ..models.item import AuctionItem


def map_raw_to_item(raw: dict, platform: str, city_id: int) -> AuctionItem:
    """Convert a raw parsed dict to an AuctionItem with type-safe defaults.

    This is the fallback/generic mapper. Platform-specific parsers should
    produce AuctionItems directly for more control.
    """
    item = AuctionItem(
        source_url=raw.get("source_url", ""),
        auction_platform=platform,
        city_id=city_id,
        title=raw.get("title", ""),
        province_city=raw.get("province_city", ""),
        district=raw.get("district", ""),
        address=raw.get("address", ""),
        community_name=raw.get("community_name", ""),
        property_type=raw.get("property_type", "住宅"),
        area=_safe_float(raw.get("area", 0)),
        starting_price=_safe_int(raw.get("starting_price", 0)),
        appraisal_price=_safe_int(raw.get("appraisal_price", 0)),
        deposit=_safe_int(raw.get("deposit", 0)),
        increment_amount=_safe_int(raw.get("increment_amount", 0)),
        market_deal_price=_safe_int(raw.get("market_deal_price", 0)),
        auction_round=raw.get("auction_round", "一拍"),
        auction_status=raw.get("auction_status", "即将开拍"),
        court_name=raw.get("court_name"),
        description=raw.get("description"),
        view_count=_safe_int(raw.get("view_count", 0)),
        participant_count=_safe_int(raw.get("participant_count", 0)),
        image_urls=raw.get("image_urls", []),
        source_updated_at=datetime.now(),
    )
    return item


def _safe_int(val) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0


def _safe_float(val) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0
