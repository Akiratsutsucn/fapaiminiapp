"""Article (法拍秘籍/公众号文章) ORM model."""
from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Boolean, Date, DateTime, Text

from ..core.database import Base


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(256), nullable=False, default="")
    summary = Column(String(512), nullable=True)
    # 文章正文（公众号原文 HTML，供小程序内直接阅读，无需跳转）
    content = Column(Text, nullable=True)
    cover_image = Column(String(512), nullable=True)
    mp_url = Column(String(512), nullable=True)
    is_home_show = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    published_at = Column(Date, nullable=True)
    # 来源：manual（手工录入）/ wechat_mp（公众号同步）
    source = Column(String(32), nullable=False, default="manual")
    # 公众号文章去重键（article_id / media_id）
    source_id = Column(String(256), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
