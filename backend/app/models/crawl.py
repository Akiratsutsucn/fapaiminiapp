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


class CrawlerTaskDetail(Base):
    """爬虫任务详细记录 - 按平台和城市统计"""
    __tablename__ = "crawler_task_details"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(
        Integer, ForeignKey("crawl_tasks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    platform = Column(String(32), nullable=False, comment="平台名称：阿里拍卖/京东拍卖/公拍网")
    city = Column(String(32), nullable=False, comment="城市名称：上海/宁波/杭州")
    total_fetched = Column(Integer, nullable=False, default=0, comment="抓取总数")
    new_count = Column(Integer, nullable=False, default=0, comment="新增数量")
    updated_count = Column(Integer, nullable=False, default=0, comment="更新数量")
    failed_count = Column(Integer, nullable=False, default=0, comment="失败数量")
    skipped_count = Column(Integer, nullable=False, default=0, comment="跳过数量")
    error_messages = Column(Text, nullable=True, comment="错误信息（截断至1000字符）")
    failure_type = Column(String(32), nullable=True, comment="失败原因分类：LOGIN_COOKIE/IP_BLOCKED/PARSE_LOGIC/UNKNOWN")
    duration_seconds = Column(Integer, nullable=True, comment="耗时（秒）")
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    task = relationship("CrawlTask")
