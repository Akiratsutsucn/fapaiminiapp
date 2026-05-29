"""Banner (首页横幅) ORM model."""
from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Boolean, DateTime

from ..core.database import Base


class Banner(Base):
    __tablename__ = "banners"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(128), nullable=False, default="")
    image_url = Column(String(512), nullable=False, default="")
    category = Column(String(32), nullable=True)
    link_url = Column(String(512), nullable=True)
    city_id = Column(Integer, nullable=False, default=310000)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
