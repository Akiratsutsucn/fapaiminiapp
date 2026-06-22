"""Pydantic schemas for request/response validation."""
from datetime import datetime, date
from typing import Any, Optional
from pydantic import BaseModel, Field


# ========== Auth ==========
class LoginRequest(BaseModel):
    code: str = Field(..., description="wx.login() 返回的 code")
    encrypted_data: Optional[str] = Field(None, description="getUserProfile 加密数据")
    iv: Optional[str] = Field(None)
    nickname: Optional[str] = Field(None, description="wx.getUserProfile() 返回的昵称")
    avatar_url: Optional[str] = Field(None, description="wx.getUserProfile() 返回的头像 URL")


class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_info: "UserInfo"


class RefreshRequest(BaseModel):
    refresh_token: str


# ========== User ==========
class UserInfo(BaseModel):
    id: int
    nickname: str = ""
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[int] = None
    role: str = "customer"

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[int] = None


class UserStats(BaseModel):
    favorite_count: int = 0
    participated_count: int = 0
    won_count: int = 0


# ========== Property ==========
class PropertyImageOut(BaseModel):
    id: int
    image_url: str
    thumb_url: Optional[str] = None
    sort_order: int = 0
    is_cover: bool = False
    hidden: int = 0
    hide_reason: Optional[str] = None

    model_config = {"from_attributes": True}


class CommunityInfoOut(BaseModel):
    """小区详情（来自贝壳）。所有字段可选 — 抓不到就是 None。"""
    id: int
    name: str = ""
    district: str = ""
    address_full: Optional[str] = None
    avg_price: Optional[float] = None
    price_update_at: Optional[datetime] = None
    build_year_start: Optional[int] = None
    build_year_end: Optional[int] = None
    property_type: Optional[str] = None
    total_buildings: Optional[int] = None
    total_units: Optional[int] = None
    developer: Optional[str] = None
    plot_ratio: Optional[float] = None
    green_rate: Optional[float] = None
    property_company: Optional[str] = None
    property_fee: Optional[str] = None
    huxing_summary: Optional[str] = None
    recent_deal_count_30d: Optional[int] = None
    recent_avg_price_30d: Optional[float] = None
    on_sale_count: Optional[int] = None
    rent_count: Optional[int] = None
    description: Optional[str] = None
    beike_url: Optional[str] = None
    last_crawled_at: Optional[datetime] = None
    source: Optional[str] = None

    model_config = {"from_attributes": True}


class DealReferenceOut(BaseModel):
    """同房型成交参考 —— 贝壳数据缺失时降级用拍卖平台自带市场成交价兜底。

    优先级：贝壳近30天 → 贝壳均价 → 平台市场成交单价 → 平台最新成交单价。
    source_label 标明数据来源，前端据此展示。
    """
    unit_price: float = 0.0          # 参考成交单价（元/㎡）
    total_price: Optional[int] = None  # 按本房源面积估算的总价（元）
    source_label: str = ""           # 贝壳近30天 / 贝壳均价 / 市场参考 / 平台成交价
    updated_at: Optional[datetime] = None


class RiskTagOut(BaseModel):
    """房源风险/利好标签。level: danger(红)/warning(黄)/safe(绿)。"""
    level: str = "warning"   # danger 红 / warning 黄 / safe 绿
    label: str = ""          # 简短标签，如「租赁占用」
    detail: str = ""         # 一句话说明


class PropertyListItem(BaseModel):
    id: int
    title: str = ""
    district: str = ""
    sub_district: Optional[str] = None
    community_name: str = ""
    source_url: str = ""
    area: float = 0.0
    layout: Optional[str] = None
    starting_price: int = 0
    starting_unit_price: float = 0.0
    appraisal_price: int = 0
    court_discount_rate: float = 0.0
    auction_round: str = "一拍"
    auction_status: str = "即将开拍"
    auction_start_time: Optional[datetime] = None
    auction_end_time: Optional[datetime] = None
    cover_image: Optional[str] = None
    property_type: str = "住宅"
    auction_platform: str = ""
    # 成交价（昨日成交/已成交展示用）：法拍成交价 + 成交折扣率（成交价/评估价）。
    final_deal_price: int = 0
    deal_discount_rate: float = 0.0
    online_auction_end_time: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PropertyDetail(BaseModel):
    id: int
    source_url: str = ""
    auction_platform: str = ""
    city_id: int = 310000
    title: str = ""
    province_city: str = ""
    publish_date: Optional[datetime] = None
    source_updated_at: Optional[datetime] = None
    district: str = ""
    sub_district: Optional[str] = None
    ring_road: Optional[str] = None
    address: str = ""
    community_name: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    property_type: str = "住宅"
    area: float = 0.0
    layout: Optional[str] = None
    floor_info: Optional[str] = None
    total_floors: Optional[int] = None
    has_elevator: Optional[bool] = None
    orientation: Optional[str] = None
    decoration: Optional[str] = None
    build_year: Optional[int] = None
    starting_price: int = 0
    starting_unit_price: float = 0.0
    appraisal_price: int = 0
    court_discount_rate: float = 0.0
    deposit: int = 0
    increment_amount: int = 0
    market_deal_price: int = 0
    market_deal_unit_price: float = 0.0
    market_discount_rate: float = 0.0
    listing_min_price: int = 0
    latest_deal_unit_price: float = 0.0
    latest_total_price: int = 0
    bargain_potential: int = 0
    beike_latest_deal_unit_price: float = 0.0
    beike_latest_deal_total_price: int = 0
    beike_latest_deal_time: Optional[datetime] = None
    auction_round: str = "一拍"
    auction_status: str = "即将开拍"
    auction_start_time: Optional[datetime] = None
    auction_end_time: Optional[datetime] = None
    court_name: Optional[str] = None
    case_number: Optional[str] = None
    announcement_url: Optional[str] = None
    description: Optional[str] = None
    view_count: int = 0
    participant_count: int = 0
    loan_support: Optional[bool] = None
    has_attachments: Optional[bool] = None
    # 成交确认书相关（已成交房源）
    attachments: Optional[list] = None
    deal_confirmed: Optional[bool] = None
    online_auction_end_time: Optional[datetime] = None
    final_deal_price: int = 0
    deal_discount_rate: float = 0.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    images: list[PropertyImageOut] = []
    community_info: Optional[CommunityInfoOut] = None
    deal_reference: Optional[DealReferenceOut] = None
    risk_tags: list[RiskTagOut] = []

    model_config = {"from_attributes": True}


class PropertyListParams(BaseModel):
    city_id: Optional[int] = Field(None, ge=100000, le=999999)
    district: Optional[str] = None
    price_min: Optional[int] = None
    price_max: Optional[int] = None
    keyword: Optional[str] = None
    property_type: Optional[str] = None
    auction_status: Optional[str] = None
    auction_round: Optional[str] = None
    sort_by: Optional[str] = Field(None, pattern="^(starting_price|appraisal_price|area)$")
    sort_order: Optional[str] = Field("asc", pattern="^(asc|desc)$")
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    total_pages: int


# ========== Article ==========
class ArticleOut(BaseModel):
    id: int
    title: str = ""
    summary: Optional[str] = None
    content: Optional[str] = None
    cover_image: Optional[str] = None
    mp_url: Optional[str] = None
    published_at: Optional[date] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ========== Banner ==========
class BannerOut(BaseModel):
    id: int
    title: str = ""
    image_url: str = ""
    category: Optional[str] = None
    link_url: Optional[str] = None
    article_id: Optional[int] = None
    sort_order: int = 0

    model_config = {"from_attributes": True}


# ========== Demand ==========
class DemandCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=32)
    gender: Optional[int] = Field(None, ge=1, le=2)
    phone: str = Field(..., min_length=11, max_length=11)
    city: Optional[str] = Field(None, max_length=32)
    purpose: Optional[str] = Field(None, pattern="^(投资|自住|不限)$")
    budget: Optional[str] = None
    own_funds: Optional[str] = None
    target_district: Optional[str] = None
    remark: Optional[str] = None  # 留言内容 / 备注
    source: Optional[str] = Field("demand-form", pattern="^(demand-form|message)$")


class DemandOut(BaseModel):
    id: int
    user_id: int
    name: str = ""
    phone: str = ""
    city: str = ""
    purpose: Optional[str] = None
    budget: Optional[str] = None
    target_district: Optional[str] = None
    agent_wechat: Optional[str] = None
    remark: Optional[str] = None
    source: str = "demand-form"
    status: str = "待处理"
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ========== Admin ==========
class AdminDemandUpdate(BaseModel):
    agent_wechat: Optional[str] = None
    remark: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(待处理|已分配|已完成)$")
    assigned_user_id: Optional[int] = None
    assigned_role: Optional[str] = None
    assigned_name: Optional[str] = None


class AdminPropertyCreate(BaseModel):
    title: str
    district: str = ""
    address: str = ""
    community_name: str = ""
    area: float = 0.0
    property_type: str = "住宅"
    starting_price: int = 0
    appraisal_price: int = 0
    deposit: int = 0
    auction_round: str = "一拍"
    auction_status: str = "即将开拍"
    auction_start_time: Optional[datetime] = None
    auction_end_time: Optional[datetime] = None
    court_name: Optional[str] = None
    city_id: int = 310000


class RecommendRequest(BaseModel):
    user_id: int
    property_id: int
    message: Optional[str] = None
    demand_id: Optional[int] = None


# ========== Market Stats ==========
class MarketStatsOut(BaseModel):
    bargain_count: int = 0
    upcoming_count: int = 0
    yesterday_listed: int = 0
    yesterday_sold: int = 0


# ========== Invite ==========
class InviteRecord(BaseModel):
    nickname: str = ""
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None


# ========== Crawler ==========
class CrawlerTriggerRequest(BaseModel):
    platform: Optional[str] = None
    city: Optional[str] = None


class CrawlTaskOut(BaseModel):
    id: int
    platform: Optional[str] = None
    city: Optional[str] = None
    status: str = "pending"
    total_count: Optional[int] = None
    success_count: Optional[int] = None
    last_run_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CrawlerStatusOut(BaseModel):
    last_run_at: Optional[datetime] = None
    last_status: str = "unknown"
    is_running: bool = False


# ========== City ==========
class CityOut(BaseModel):
    city_id: int
    city_name: str
    is_active: bool = True
