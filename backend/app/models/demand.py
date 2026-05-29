"""Demand (购房需求) ORM model."""
from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Date, DateTime, Text, ForeignKey

from ..core.database import Base


class Demand(Base):
    __tablename__ = "demands"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(32), nullable=False, default="")
    gender = Column(Integer, nullable=True)
    birthday = Column(Date, nullable=True)
    phone = Column(String(20), nullable=False, default="")
    city = Column(String(32), nullable=False, default="")
    purpose = Column(String(16), nullable=True)  # 投资/自住/不限
    budget = Column(String(32), nullable=True)
    own_funds = Column(String(32), nullable=True)
    target_district = Column(String(64), nullable=True)
    agent_wechat = Column(String(64), nullable=True)
    remark = Column(Text, nullable=True)
    # 来源：demand-form=选房需求表单, message=联系客服留言
    source = Column(String(16), nullable=False, default="demand-form", server_default="demand-form")
    status = Column(String(16), nullable=False, default="待处理")  # 待处理/已分配/已完成
    created_at = Column(DateTime, nullable=False, default=datetime.now)
