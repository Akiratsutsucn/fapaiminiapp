"""Property and PropertyImage ORM models — matches AuctionItem 1:1."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Float, Boolean,
    DateTime, Text, ForeignKey, JSON,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # === identity ===
    source_url = Column(String(512), unique=True, nullable=False, index=True)
    auction_platform = Column(String(32), nullable=False, default="")
    city_id = Column(Integer, nullable=False, default=310000)

    # === title & timestamps ===
    title = Column(String(256), nullable=False, default="")
    province_city = Column(String(64), nullable=False, default="")
    publish_date = Column(DateTime, nullable=True)
    source_updated_at = Column(DateTime, nullable=True)

    # === location ===
    district = Column(String(64), nullable=False, default="")
    sub_district = Column(String(64), nullable=True)
    ring_road = Column(String(32), nullable=True)
    address = Column(String(256), nullable=False, default="")
    community_name = Column(String(128), nullable=False, default="")
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    # === building ===
    property_type = Column(String(32), nullable=False, default="住宅")
    area = Column(Float, nullable=False, default=0.0)
    layout = Column(String(32), nullable=True)
    floor_info = Column(String(32), nullable=True)
    total_floors = Column(Integer, nullable=True)
    has_elevator = Column(Boolean, nullable=True)
    orientation = Column(String(32), nullable=True)
    decoration = Column(String(32), nullable=True)
    build_year = Column(Integer, nullable=True)

    # === auction pricing (元) ===
    starting_price = Column(BigInteger, nullable=False, default=0)
    starting_unit_price = Column(Float, nullable=False, default=0.0)
    appraisal_price = Column(BigInteger, nullable=False, default=0)
    court_discount_rate = Column(Float, nullable=False, default=0.0)
    deposit = Column(BigInteger, nullable=False, default=0)
    increment_amount = Column(BigInteger, nullable=False, default=0)

    # === market pricing (元) ===
    market_deal_price = Column(BigInteger, nullable=False, default=0)
    market_deal_unit_price = Column(Float, nullable=False, default=0.0)
    market_discount_rate = Column(Float, nullable=False, default=0.0)
    listing_min_price = Column(BigInteger, nullable=False, default=0)
    latest_deal_unit_price = Column(Float, nullable=False, default=0.0)
    latest_total_price = Column(BigInteger, nullable=False, default=0)
    bargain_potential = Column(BigInteger, nullable=False, default=0)

    # === beike reference ===
    beike_latest_deal_unit_price = Column(Float, nullable=False, default=0.0)
    beike_latest_deal_total_price = Column(BigInteger, nullable=False, default=0)
    beike_latest_deal_time = Column(DateTime, nullable=True)

    # === auction meta ===
    auction_round = Column(String(16), nullable=False, default="一拍")
    auction_status = Column(String(16), nullable=False, default="即将开拍")
    auction_start_time = Column(DateTime, nullable=True)
    auction_end_time = Column(DateTime, nullable=True)

    # === court ===
    court_name = Column(String(128), nullable=True)
    case_number = Column(String(64), nullable=True)
    announcement_url = Column(String(512), nullable=True)

    # === description ===
    description = Column(Text, nullable=True)

    # === stats ===
    view_count = Column(Integer, nullable=False, default=0)
    participant_count = Column(Integer, nullable=False, default=0)

    # === extended (previously stored only in description JSON) ===
    loan_support = Column(Boolean, nullable=True)
    has_attachments = Column(Boolean, nullable=True)

    # === 附件清单 & 成交确认（按用户 2026-06-10 要求）===
    # attachments：详情/公告页的附件清单 [{"name": "成交确认书.pdf", "url": "..."}]，
    #   三平台统一抓取，用于判定"成交确认书"是否存在。
    attachments = Column(JSON, nullable=True, comment="附件清单[{name,url}]")
    # deal_confirmed：附件中存在「成交确认书」→ True，是「已成交」的铁证
    #   （比按结束时间推断可靠）。
    deal_confirmed = Column(Boolean, nullable=True, comment="存在成交确认书附件=已成交铁证")
    # online_auction_end_time：从「成交确认书」PDF 正文解析出的"网拍结束时间"，
    #   是判定"昨日成交"的准绳（优先于 auction_end_time）。
    online_auction_end_time = Column(DateTime, nullable=True, comment="成交确认书内网拍结束时间")
    # final_deal_price：法拍「成交价」(元)，来自成交确认书/成交公告(京东成交确认书PDF
    #   「网络拍卖成交价格：￥…」、公拍网HTML「成交价：…元」、阿里成交结果)。
    #   远低于评估价 appraisal_price，是小程序「昨日成交」展示折扣冲击力的核心数据。
    final_deal_price = Column(BigInteger, nullable=False, default=0, comment="法拍成交价(元),来自成交确认书")

    # === smart enrichment（O5/O6）===
    tags = Column(JSON, nullable=True, comment="智能标签数组，如 ['学区房','地铁2号线','次新房']")
    bargain_tagline = Column(String(256), nullable=True, comment="爆款营销文案 1-2 句")
    amenities_cache = Column(JSON, nullable=True, comment="周边配套预处理结果（高德 POI）")
    amenities_updated_at = Column(DateTime, nullable=True)

    # === system ===
    # 软删除：审核判定为非房产/外省等时标记隐藏(1)，保留在库可追溯/恢复，不物理删除。
    # 小程序所有 C 端入口经 auction_status 单一事实源过滤 is_deleted==0。
    is_deleted = Column(Integer, nullable=False, default=0, server_default="0",
                        comment="软删除标记:0正常/1已删(审核隐藏)")
    deleted_reason = Column(String(64), nullable=True, comment="软删除原因(审核规则code)")
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    # === relationships ===
    images = relationship(
        "PropertyImage", back_populates="property",
        cascade="all, delete-orphan", lazy="selectin",
    )


class PropertyImage(Base):
    __tablename__ = "property_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(
        Integer, ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    image_url = Column(String(512), nullable=False)
    thumb_url = Column(String(512), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_cover = Column(Boolean, nullable=False, default=False)
    # 垃圾图(广告/二维码/logo)自动隐藏：0显示 / 1隐藏。前台不展示，后台可恢复。
    hidden = Column(Integer, nullable=False, default=0, server_default="0")
    hide_reason = Column(String(32), nullable=True)  # qrcode/banner/logo/solid
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    property = relationship("Property", back_populates="images")
