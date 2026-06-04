"""PropertyRecommendation (定向推荐房源) ORM model.

管理员把房源定向推荐给指定注册用户，用户在小程序「为你推荐」中查看。
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey

from ..core.database import Base


class PropertyRecommendation(Base):
    __tablename__ = "property_recommendations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)
    # 关联的购房需求（可空，从需求管理推荐时带上）
    demand_id = Column(Integer, nullable=True)
    reason = Column(Text, nullable=True)          # 推荐语
    status = Column(String(16), nullable=False, default="未读")  # 未读/已读
    created_by = Column(String(64), nullable=True)  # 操作的管理员
    created_at = Column(DateTime, nullable=False, default=datetime.now)
