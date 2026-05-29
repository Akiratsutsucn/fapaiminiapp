"""UserFavorite (收藏) ORM model."""
from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey

from ..core.database import Base


class UserFavorite(Base):
    __tablename__ = "user_favorites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    favorite_type = Column(String(16), nullable=False, default="property")  # property/article
    target_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
