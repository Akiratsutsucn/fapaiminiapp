"""Community metadata — district-level reference data for property enrichment."""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime

from ..core.database import Base


class CommunityInfo(Base):
    __tablename__ = "community_info"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False, index=True)
    district = Column(String(64), nullable=False, default="")
    sub_district = Column(String(64), nullable=True)
    city_id = Column(Integer, nullable=False, default=310000)

    # geo
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    # price reference
    avg_price = Column(Float, nullable=True, comment="参考均价(元/㎡)")
    price_update_at = Column(DateTime, nullable=True)

    # building info
    build_year_start = Column(Integer, nullable=True)
    build_year_end = Column(Integer, nullable=True)
    property_type = Column(String(32), nullable=True, comment="住宅/商业/办公等")
    total_buildings = Column(Integer, nullable=True)
    total_units = Column(Integer, nullable=True)
    developer = Column(String(128), nullable=True)

    # === 扩展字段（贝壳抓取） ===
    plot_ratio = Column(Float, nullable=True, comment="容积率")
    green_rate = Column(Float, nullable=True, comment="绿化率(0-1)")
    property_company = Column(String(128), nullable=True, comment="物业公司")
    property_fee = Column(String(64), nullable=True, comment="物业费(元/㎡/月)")
    huxing_summary = Column(String(256), nullable=True, comment="主力户型摘要")
    address_full = Column(String(256), nullable=True, comment="完整地址")

    # 近30天成交参考
    recent_deal_count_30d = Column(Integer, nullable=True, comment="近30天成交套数")
    recent_avg_price_30d = Column(Float, nullable=True, comment="近30天成交均价(元/㎡)")
    on_sale_count = Column(Integer, nullable=True, comment="在售房源数")
    rent_count = Column(Integer, nullable=True, comment="在租房源数")

    # 富文本介绍 / 用户可读小区详情
    description = Column(Text, nullable=True, comment="小区详细介绍（用户可见）")

    # 数据源链接
    beike_url = Column(String(256), nullable=True, comment="贝壳小区详情页链接")
    last_crawled_at = Column(DateTime, nullable=True, comment="贝壳上次抓取时间")

    # metadata
    source = Column(String(64), nullable=True, comment="数据来源")
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
