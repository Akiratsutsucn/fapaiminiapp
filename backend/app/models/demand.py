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
    # 分配对接人（业务员/代理商）—— 关联到 users，便于其在小程序「客户需求管理」查看
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_role = Column(String(16), nullable=True)  # salesperson 业务员 / agent 代理商
    assigned_name = Column(String(64), nullable=True)  # 对接人显示名（冗余，便于列表展示）
    assign_read = Column(Integer, nullable=False, default=0, server_default="0")  # 对接人是否已读 0未读/1已读
    remark = Column(Text, nullable=True)
    # 来源：demand-form=选房需求表单, message=联系客服留言
    source = Column(String(16), nullable=False, default="demand-form", server_default="demand-form")
    status = Column(String(16), nullable=False, default="待处理")  # 待处理/已分配/已完成
    created_at = Column(DateTime, nullable=False, default=datetime.now)
