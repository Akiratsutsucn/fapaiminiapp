"""AuctionItem dataclass — the canonical data model for crawled property data."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class Platform(StrEnum):
    ALI = "阿里拍卖"
    JD = "京东拍卖"
    GPAI = "公拍网"


class AuctionRound(StrEnum):
    FIRST = "一拍"
    SECOND = "二拍"
    SELL = "变卖"


class AuctionStatus(StrEnum):
    UPCOMING = "即将开拍"
    ONGOING = "进行中"
    ENDED = "已结束"
    SOLD = "已成交"
    WITHDRAWN = "已撤回"


@dataclass
class AuctionItem:
    """All fields that can be extracted from auction detail pages."""

    # === identity ===
    source_url: str
    auction_platform: str  # Platform enum value
    city_id: int = 310000  # 310000=上海, 330200=宁波

    # === title & timestamps ===
    title: str = ""
    province_city: str = ""
    publish_date: datetime | None = None
    source_updated_at: datetime | None = None

    # === location ===
    district: str = ""
    sub_district: str | None = None
    ring_road: str | None = None
    address: str = ""
    community_name: str = ""
    lat: float | None = None
    lng: float | None = None

    # === building ===
    property_type: str = "住宅"
    area: float = 0.0
    layout: str | None = None
    floor_info: str | None = None
    total_floors: int | None = None
    has_elevator: bool | None = None
    orientation: str | None = None
    decoration: str | None = None
    build_year: int | None = None

    # === auction pricing (元) ===
    starting_price: int = 0
    starting_unit_price: float = 0.0
    appraisal_price: int = 0
    court_discount_rate: float = 0.0
    deposit: int = 0
    increment_amount: int = 0

    # === market pricing (元) ===
    market_deal_price: int = 0
    market_deal_unit_price: float = 0.0
    market_discount_rate: float = 0.0
    listing_min_price: int = 0
    latest_deal_unit_price: float = 0.0
    latest_total_price: int = 0
    bargain_potential: int = 0

    # === beike reference ===
    beike_latest_deal_unit_price: float = 0.0
    beike_latest_deal_total_price: int = 0
    beike_latest_deal_time: datetime | None = None

    # === auction meta ===
    auction_round: str = AuctionRound.FIRST.value
    auction_status: str = AuctionStatus.UPCOMING.value
    auction_start_time: datetime | None = None
    auction_end_time: datetime | None = None

    # === court ===
    court_name: str | None = None
    case_number: str | None = None
    announcement_url: str | None = None

    # === description ===
    description: str | None = None

    # === stats ===
    view_count: int = 0
    participant_count: int = 0

    # === extended (fields without direct DB columns) ===
    loan_support: bool | None = None
    has_attachments: bool | None = None

    # === images ===
    image_urls: list[str] = field(default_factory=list)
