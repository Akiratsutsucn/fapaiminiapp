"""Source URL configuration for all 15 target URLs.

Each entry maps a source URL to its platform, city, and metadata.
"""
from dataclasses import dataclass


@dataclass
class SourceConfig:
    platform: str  # "阿里拍卖" / "京东拍卖" / "公拍网"
    city: str  # "上海" / "宁波"
    source_url: str
    label: str = ""  # human-readable description
    property_type: str = ""  # if the URL is type-specific


# ---- Taobao PaiMai (new platform via MTOP API, 2 cities) ----
# The PaiMai crawler uses the MTOP API directly — source_url is a placeholder
# since the API endpoint is fixed. Each config represents a city to crawl.

PAIMAI_CONFIGS = [
    SourceConfig(
        platform="阿里拍卖",
        city="上海",
        source_url="https://pages-fast.m.taobao.com/wow/z/app/pm/search-ssr/search",
        label="阿里拍卖-上海-诉讼资产",
    ),
    SourceConfig(
        platform="阿里拍卖",
        city="宁波",
        source_url="https://pages-fast.m.taobao.com/wow/z/app/pm/search-ssr/search",
        label="阿里拍卖-宁波-诉讼资产",
    ),
]


# ---- JD Auction URLs (2 cities) ----
JD_CONFIGS = [
    SourceConfig(
        platform="京东拍卖",
        city="上海",
        source_url="https://pmsearch.jd.com/?publishSource=7&childrenCateId=12728&provinceId=2&cityId=2810",
        label="京东-上海-cityId筛选",
    ),
    SourceConfig(
        platform="京东拍卖",
        city="宁波",
        source_url="https://pmsearch.jd.com/?publishSource=7&childrenCateId=12728&provinceId=15",
        label="京东-宁波-浙江省筛选",
    ),
]

# ---- GPai URLs (4) ----
# at=376, at=381 (asset type codes) × cityNum=31(上海), 3302(宁波)

GPAI_CONFIGS = [
    SourceConfig(
        platform="公拍网",
        city="上海",
        source_url="https://s.gpai.net/sf/search.do?at=376&cityNum=31",
        label="公拍网-上海-类型A",
    ),
    SourceConfig(
        platform="公拍网",
        city="上海",
        source_url="https://s.gpai.net/sf/search.do?cityNum=31&at=381",
        label="公拍网-上海-类型B",
    ),
    SourceConfig(
        platform="公拍网",
        city="宁波",
        source_url="https://s.gpai.net/sf/search.do?at=376&cityNum=3302",
        label="公拍网-宁波-类型A",
    ),
    SourceConfig(
        platform="公拍网",
        city="宁波",
        source_url="https://s.gpai.net/sf/search.do?at=381&cityNum=3302",
        label="公拍网-宁波-类型B",
    ),
]


def get_all_configs() -> list[SourceConfig]:
    """Get all source URL configurations."""
    return PAIMAI_CONFIGS + JD_CONFIGS + GPAI_CONFIGS  # type: ignore[operator]


def get_configs_by_platform(platform: str) -> list[SourceConfig]:
    """Filter configs by platform."""
    return [c for c in get_all_configs() if c.platform == platform]


def get_configs_by_city(city: str) -> list[SourceConfig]:
    """Filter configs by city."""
    return [c for c in get_all_configs() if c.city == city]


def get_configs(platform: str | None = None, city: str | None = None) -> list[SourceConfig]:
    """Flexible config filter. None means 'all'."""
    configs = get_all_configs()
    if platform:
        configs = [c for c in configs if c.platform == platform]
    if city:
        configs = [c for c in configs if c.city == city]
    return configs


# Group configs for efficient crawling (same platform+crawler instance can handle multiple configs)
def group_configs_by_platform(configs: list[SourceConfig]) -> dict[str, list[SourceConfig]]:
    """Group source configs by platform for batch processing."""
    grouped: dict[str, list[SourceConfig]] = {}
    for cfg in configs:
        grouped.setdefault(cfg.platform, []).append(cfg)
    return grouped
