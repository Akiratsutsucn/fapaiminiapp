"""AI 助手会话与消息 ORM 模型（持久化到数据库，替代原内存 _sessions dict）。

原实现把会话存在进程内存的 _sessions dict 里，配合 uvicorn --workers 4 多进程，
导致：会话不跨 worker 共享（点新会话报「会话不存在」）、重启即丢、无法改名。
改为落库后统一解决。
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Text, ForeignKey,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class AiSession(Base):
    __tablename__ = "ai_sessions"

    # 会话 ID（UUID 字符串，与前端既有约定一致）
    session_id = Column(String(64), primary_key=True)
    title = Column(String(100), nullable=False, default="新会话")  # 可改名
    created_at = Column(DateTime, nullable=False, default=datetime.now, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    messages = relationship(
        "AiMessage", back_populates="session", lazy="selectin",
        cascade="all, delete-orphan", order_by="AiMessage.id",
    )


class AiMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        String(64), ForeignKey("ai_sessions.session_id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    role = Column(String(16), nullable=False)  # user / assistant
    content = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    session = relationship("AiSession", back_populates="messages")
