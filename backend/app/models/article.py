"""Article (法拍秘籍/公众号文章) ORM model."""
from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Boolean, Date, DateTime, Text

from ..core.database import Base


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(256), nullable=False, default="")
    summary = Column(String(512), nullable=True)
    cover_image = Column(String(512), nullable=True)
    mp_url = Column(String(512), nullable=True)
    is_home_show = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    published_at = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
