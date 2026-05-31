"""City standardization: map city names and codes to canonical forms."""
import re

CITY_MAP = {
    "上海": {"name": "上海", "id": 310000},
    "上海市": {"name": "上海", "id": 310000},
    "shanghai": {"name": "上海", "id": 310000},
    "宁波": {"name": "宁波", "id": 330200},
    "宁波市": {"name": "宁波", "id": 330200},
    "ningbo": {"name": "宁波", "id": 330200},
    "杭州": {"name": "杭州", "id": 330100},
    "杭州市": {"name": "杭州", "id": 330100},
    "hangzhou": {"name": "杭州", "id": 330100},
}

# GBK URL-encoded city names in Taobao URLs
GBK_CITY_DECODE = {
    "%C9%CF%BA%A3": "上海",
    "%C4%FE%B2%A8": "宁波",
    "%BA%BC%D6%DD": "杭州",
}

# cityNum for GPai（公拍网）：上海31、宁波3302、杭州 3301（实测确认前为推定值，部署前校验）
CITY_NUM_MAP = {
    31: "上海",
    3302: "宁波",
    3301: "杭州",
}


def standardize_city(city_name: str) -> tuple[str, int]:
    """Convert any city name variant to canonical (name, id).

    Returns ("上海", 310000) or ("宁波", 330200). Falls back to ("上海", 310000).
    """
    if not city_name:
        return "上海", 310000

    # Check direct mapping
    result = CITY_MAP.get(city_name.strip())
    if result:
        return result["name"], result["id"]

    # Check substring match
    for key, val in CITY_MAP.items():
        if key in city_name:
            return val["name"], val["id"]

    # Default to Shanghai
    return "上海", 310000


def standardize_city_by_num(city_num: int) -> tuple[str, int]:
    """Convert cityNum to canonical (name, id)."""
    city_name = CITY_NUM_MAP.get(city_num, "上海")
    return standardize_city(city_name)


# city_id（行政编码）→ 城市名
CITY_ID_NAME = {
    310000: "上海",
    330200: "宁波",
    330100: "杭州",
}


def city_name_by_id(city_id: int) -> str:
    """行政编码 → 城市名，未知返回空串。"""
    return CITY_ID_NAME.get(city_id, "")
