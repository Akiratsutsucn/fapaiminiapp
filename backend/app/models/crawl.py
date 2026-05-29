"""CrawlTask and CrawlRecord ORM models."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, DateTime, Text, ForeignKey, JSON,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class CrawlTask(Base):
    __tablename__ = "crawl_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String(32), nullable=True)
    city = Column(String(32), nullable=True)
    status = Column(String(16), nullable=False, default="pending")
    total_count = Column(Integer, nullable=True)
    success_count = Column(Integer, nullable=True)
    new_count = Column(Integer, nullable=True)       # 本轮新增房源数
    updated_count = Column(Integer, nullable=True)   # 本轮已存在但有变化的房源数
    error_message = Column(Text, nullable=True)
    stats_summary = Column(JSON, nullable=True)       # 详细 diff 报告：变价/状态变化等
    cron_expression = Column(String(32), nullable=True)
    last_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    records = relationship("CrawlRecord", back_populates="task", lazy="selectin")


class CrawlRecord(Base):
    __tablename__ = "crawl_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(
        Integer, ForeignKey("crawl_tasks.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    property_id = Column(
        Integer, ForeignKey("properties.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    status = Column(String(16), nullable=False, default="pending")
    source_url = Column(String(512), nullable=True)
    raw_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    task = relationship("CrawlTask", back_populates="records")
