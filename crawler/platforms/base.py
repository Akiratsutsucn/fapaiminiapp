"""Abstract base class for platform crawlers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from loguru import logger


@dataclass
class ListItem:
    """Lightweight item extracted from a list/search page."""
    source_url: str
    title: str = ""
    publish_date: datetime | None = None
    auction_status: str = ""
    starting_price_text: str = ""  # raw text, parsed later on detail page
    district: str = ""
    area_text: str = ""
    address: str = ""


def check_url_cooldown(url: str) -> Optional[str]:
    """检测某 URL 的 host 是否在风控冷却中。

    在 fetch 前调用：返回 None 表示可继续，返回 str 表示跳过原因。
    使用 anti_block.PlatformCooldown 全局单例。
    """
    try:
        from ..anti_block import get_cooldown
        return get_cooldown().should_skip(url)
    except Exception as e:
        logger.debug(f"check_url_cooldown 失败: {e}")
        return None


def mark_url_blocked(url: str, reason: str = ""):
    """触发了风控时调用，让该 host 冷却 30 分钟。"""
    try:
        from ..anti_block import get_cooldown
        get_cooldown().mark_bad(url, reason)
    except Exception as e:
        logger.debug(f"mark_url_blocked 失败: {e}")


class AbstractBrokerCrawler(ABC):
    """Base class for all platform-specific crawlers.

    Each broker (Taobao, JD, GPai) implements:
      - collect_list_items(): paginate through list/search pages, yield ListItems
      - fetch_detail(): open a detail page and return rendered HTML
    """

    platform: str  # "阿里拍卖" / "京东拍卖" / "公拍网"

    @abstractmethod
    async def collect_list_items(
        self, source_url: str, city: str, max_pages: int = 50
    ) -> list[ListItem]:
        """Paginate through the list/search page for a source URL.
        Returns all detail page URLs (with basic metadata) found.
        """

    @abstractmethod
    async def fetch_detail(self, detail_url: str) -> str:
        """Navigate to a detail page and return its rendered HTML content."""

    @abstractmethod
    async def close(self) -> None:
        """Clean up any resources specific to this crawler."""
