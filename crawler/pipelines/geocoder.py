"""高德地图 geocoding：根据房源地址解析经纬度。

接口：https://restapi.amap.com/v3/geocode/geo
- 调用频次：免费个人 key 5000/天，企业开发者 30万/天
- 入参：address（必填，最佳含「省+市+区+具体地址」）+ city（建议传，提高精度）
- 返回：location 字段格式为 "经度,纬度"（lng,lat），需注意顺序
"""
import os
import asyncio
from typing import Optional, Tuple
from loguru import logger

AMAP_API_KEY = os.getenv("AMAP_API_KEY", "")

# city_id → 高德 city 参数（adcode 或城市名都可以，用 adcode 更精准）
CITY_ADCODE = {
    310000: "310000",  # 上海
    330200: "330200",  # 宁波
    330100: "330100",  # 杭州
}


async def geocode_address(
    address: str,
    city_id: Optional[int] = None,
    province_city: Optional[str] = None,
    timeout: int = 10,
) -> Optional[Tuple[float, float]]:
    """根据地址解析 (lat, lng)。失败返回 None。

    Args:
        address: 详细地址，如「浦东新区张江路 200 号」
        city_id: 行政区代码，用于限定查询城市
        province_city: 备用，省市信息（如「上海市」）

    Returns:
        (lat, lng) 元组；解析失败返回 None
    """
    if not address or not AMAP_API_KEY:
        return None

    # 构造完整查询地址：
    # 仅当 address 不含「省/市/直辖市」前缀时才拼 province_city，避免「上海+重庆市...」这种错拼
    full_addr = address.strip()
    addr_starts_with_admin = any(
        full_addr.startswith(prefix) for prefix in (
            "上海", "北京", "天津", "重庆", "浙江", "江苏", "广东", "广西", "山东", "河北", "河南", "湖北", "湖南",
            "山西", "陕西", "辽宁", "吉林", "黑龙江", "安徽", "江西", "福建", "云南", "贵州", "四川",
            "甘肃", "青海", "海南", "台湾", "宁夏", "新疆", "西藏", "内蒙古", "香港", "澳门",
        )
    )
    if (
        province_city and province_city.strip()
        and not addr_starts_with_admin
        and province_city.strip() not in full_addr
    ):
        full_addr = f"{province_city.strip()}{full_addr}"

    city_param = CITY_ADCODE.get(city_id, "") if city_id else ""

    try:
        import httpx
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                "https://restapi.amap.com/v3/geocode/geo",
                params={
                    "key": AMAP_API_KEY,
                    "address": full_addr,
                    "city": city_param,
                },
            )
            data = resp.json()

            # 高德接口返回示例：
            # {"status": "1", "geocodes": [{"location": "121.5,31.2", ...}]}
            if data.get("status") != "1":
                logger.debug(f"[geocode] Amap fail addr={full_addr!r} -> {data.get('info')}")
                return None
            geocodes = data.get("geocodes") or []
            if not geocodes:
                return None
            location = geocodes[0].get("location") or ""
            if "," not in location:
                return None
            lng_str, lat_str = location.split(",", 1)
            lat = float(lat_str)
            lng = float(lng_str)
            # 简单合法性校验
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                return None
            return (lat, lng)
    except Exception as e:
        logger.warning(f"[geocode] exception addr={full_addr!r}: {e}")
        return None


async def geocode_property(prop_id: int, address: str, city_id: int, province_city: str = "") -> Optional[Tuple[float, float]]:
    """房源专用包装：附带 prop_id 用于日志。"""
    result = await geocode_address(address, city_id=city_id, province_city=province_city)
    if result:
        logger.debug(f"[geocode] #{prop_id} {address[:30]!r} -> {result}")
    else:
        logger.debug(f"[geocode] #{prop_id} {address[:30]!r} -> None")
    return result
