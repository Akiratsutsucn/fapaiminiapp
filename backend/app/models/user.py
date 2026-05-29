"""User ORM model."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Enum

from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    openid = Column(String(64), unique=True, nullable=False, index=True)
    unionid = Column(String(64), nullable=True)
    nickname = Column(String(64), nullable=False, default="")
    avatar_url = Column(String(512), nullable=True)
    phone = Column(String(20), nullable=True)
    gender = Column(Integer, nullable=True)  # 1男/2女
    birthday = Column(Date, nullable=True)
    role = Column(String(16), nullable=False, default="customer")  # customer/agent/admin
    password_hash = Column(String(128), nullable=True)  # bcrypt hash for admin/agent login
    inviter_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    region = Column(String(64), nullable=True, default="")  # 代理商负责地区，例如「上海市长宁区」
    city_id = Column(Integer, nullable=False, default=310000)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
