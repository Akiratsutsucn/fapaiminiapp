"""SystemSetting (系统设置) ORM model."""
from sqlalchemy import Column, Integer, BigInteger, String, Text

from ..core.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    description = Column(String(256), nullable=True)
