"""Abstract base class for detail page parsers."""
from abc import ABC, abstractmethod
from ..models.item import AuctionItem


class AbstractParser(ABC):
    """Base class for platform-specific detail page parsers.

    Each platform parser takes rendered HTML and returns a populated AuctionItem.
    """

    platform: str  # "阿里拍卖" / "京东拍卖" / "公拍网"

    @abstractmethod
    async def parse(self, html: str, source_url: str, city_id: int,
                    extra: dict | None = None) -> AuctionItem:
        """Parse a detail page's HTML into an AuctionItem."""
