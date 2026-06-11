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
    SourceConfig(
        platform="阿里拍卖",
        city="杭州",
        source_url="https://pages-fast.m.taobao.com/wow/z/app/pm/search-ssr/search",
        label="阿里拍卖-杭州-诉讼资产",
    ),
]


# ---- JD Auction URLs (2 cities) ----
# 不带 childrenCateId：原 12728=住宅用房会漏掉商业/工业/办公，去掉后返回该城市
# 全部类目的司法拍卖（publishSource=7 保留），物业类型由 jd_detail._guess_property_type 归类。
JD_CONFIGS = [
    SourceConfig(
        platform="京东拍卖",
        city="上海",
        source_url="https://pmsearch.jd.com/?publishSource=7&provinceId=2&cityId=2810",
        label="京东-上海-cityId筛选",
    ),
    SourceConfig(
        platform="京东拍卖",
        city="宁波",
        source_url="https://pmsearch.jd.com/?publishSource=7&provinceId=15",
        label="京东-宁波-浙江省筛选",
    ),
    SourceConfig(
        platform="京东拍卖",
        city="杭州",
        source_url="https://pmsearch.jd.com/?publishSource=7&provinceId=15",
        label="京东-杭州-浙江省筛选",
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
    SourceConfig(
        platform="公拍网",
        city="杭州",
        source_url="https://s.gpai.net/sf/search.do?at=376&cityNum=3301",
        label="公拍网-杭州-住宅代理城市搜索",
    ),
    SourceConfig(
        platform="公拍网",
        city="杭州",
        source_url="https://s.gpai.net/sf/search.do?at=381&cityNum=3301",
        label="公拍网-杭州-类型B",
    ),
    # 注：公拍网现通过住宅代理(GPAI_PROXY)调 s.gpai.net 城市精确搜索(cityNum)，
    # 见 gpai.py _fetch_city_search_ids；城市归属仍由详情页 province_city 二次校验。
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
