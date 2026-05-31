"""Property routes for C-end."""
import math
import os
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from ...core.database import get_session
from ...models.property import Property, PropertyImage
from ...models.community import CommunityInfo
from ...schemas import (
    PropertyListParams, PropertyListItem, PropertyDetail, PaginatedResponse,
    MarketStatsOut, DealReferenceOut,
)

# 市场参考单价合理区间（元/㎡）。京东系部分房源成交单价存在单位错乱
# （个别 >100万/㎡ 或万元未换算 <1000/㎡），超出区间视为脏数据丢弃。
DEAL_UNIT_PRICE_MIN = 1000
DEAL_UNIT_PRICE_MAX = 300000


def _valid_unit_price(v) -> bool:
    """成交单价是否在合理区间内。"""
    try:
        return v is not None and DEAL_UNIT_PRICE_MIN <= float(v) <= DEAL_UNIT_PRICE_MAX
    except (TypeError, ValueError):
        return False

AMAP_API_KEY = os.getenv("AMAP_API_KEY", "")

AMAP_CATEGORIES = {
    "school": ("学校", "141200"),
    "hospital": ("医院", "090100"),
    "transit": ("交通", "150000"),
    "shopping": ("购物", "060000"),
    "food": ("餐饮", "050000"),
    "bank": ("银行", "160100"),
}

router = APIRouter()

# Mobile-visible auction statuses
MOBILE_VISIBLE_STATUSES = ("即将开拍", "进行中", "中止", "撤回", "已撤回")


def _mobile_filter():
    return Property.auction_status.in_(MOBILE_VISIBLE_STATUSES)


@router.get("", response_model=PaginatedResponse)
async def list_properties(
    db: AsyncSession = Depends(get_session),
    city_id: int | None = Query(None),
    district: str | None = Query(None),
    price_min: int | None = Query(None),
    price_max: int | None = Query(None),
    keyword: str | None = Query(None),
    property_type: str | None = Query(None),
    auction_status: str | None = Query(None),
    auction_round: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    conditions = [_mobile_filter()]

    if city_id:
        conditions.append(Property.city_id == city_id)
    if district:
        conditions.append(Property.district == district)
    if price_min is not None:
        conditions.append(Property.starting_price >= price_min)
    if price_max is not None:
        conditions.append(Property.starting_price <= price_max)
    if keyword:
        conditions.append(Property.title.contains(keyword))
    if property_type:
        conditions.append(Property.property_type == property_type)
    if auction_status and auction_status in MOBILE_VISIBLE_STATUSES:
        conditions.append(Property.auction_status == auction_status)
    if auction_round:
        conditions.append(Property.auction_round == auction_round)

    # Count
    count_q = select(func.count(Property.id)).where(and_(*conditions))
    total = (await db.execute(count_q)).scalar() or 0

    # Query with sorting
    order_col = getattr(Property, sort_by, None) if sort_by in ("starting_price", "appraisal_price", "area") else Property.created_at
    order_clause = order_col.asc() if sort_order == "asc" else order_col.desc()

    q = (
        select(Property)
        .where(and_(*conditions))
        .order_by(order_clause)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()

    items = []
    for p in rows:
        cover = next((img.image_url for img in (p.images or []) if img.is_cover), None)
        items.append(PropertyListItem(
            id=p.id,
            title=p.title,
            district=p.district,
            community_name=p.community_name,
            area=p.area,
            layout=p.layout,
            starting_price=p.starting_price,
            starting_unit_price=p.starting_unit_price,
            appraisal_price=p.appraisal_price,
            court_discount_rate=p.court_discount_rate,
            auction_round=p.auction_round,
            auction_status=p.auction_status,
            auction_start_time=p.auction_start_time,
            auction_end_time=p.auction_end_time,
            cover_image=cover,
            property_type=p.property_type,
        ))

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/recommend", response_model=list[PropertyListItem])
async def recommend_properties(
    db: AsyncSession = Depends(get_session),
    city_id: int | None = Query(None),
    page_size: int = Query(6, le=20),
):
    conditions = [_mobile_filter()]
    if city_id:
        conditions.append(Property.city_id == city_id)

    q = (
        select(Property)
        .where(and_(*conditions))
        .order_by(Property.auction_start_time.is_(None).asc(),
                  Property.auction_start_time.asc(),
                  Property.created_at.desc())
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()

    items = []
    for p in rows:
        cover = next((img.image_url for img in (p.images or []) if img.is_cover), None)
        items.append(PropertyListItem(
            id=p.id, title=p.title, district=p.district, community_name=p.community_name,
            area=p.area, layout=p.layout, starting_price=p.starting_price,
            starting_unit_price=p.starting_unit_price, appraisal_price=p.appraisal_price,
            court_discount_rate=p.court_discount_rate, auction_round=p.auction_round,
            auction_status=p.auction_status, auction_start_time=p.auction_start_time,
            auction_end_time=p.auction_end_time, cover_image=cover,
            property_type=p.property_type,
        ))
    return items


@router.get("/map-markers")
async def map_markers(
    db: AsyncSession = Depends(get_session),
    city_id: int = Query(310000),
):
    """Return properties with real geo coordinates for map display."""
    q = (
        select(Property)
        .where(
            Property.city_id == city_id,
            Property.lat.isnot(None),
            Property.lng.isnot(None),
            _mobile_filter(),
        )
        .limit(200)
    )
    rows = (await db.execute(q)).scalars().all()
    return [{
        "id": r.id,
        "title": r.title,
        "lat": r.lat,
        "lng": r.lng,
        "starting_price": r.starting_price,
        "auction_status": r.auction_status,
        "property_type": r.property_type,
        "area": r.area,
    } for r in rows]


@router.get("/{property_id}/analysis")
async def property_district_analysis(
    property_id: int,
    db: AsyncSession = Depends(get_session),
):
    """Return district-level market stats for the property's district."""
    q = select(Property).where(Property.id == property_id, _mobile_filter())
    result = await db.execute(q)
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="房源不存在或已下架")

    district = p.district
    city_id = p.city_id

    # Aggregate stats for the district
    conditions = [
        Property.district == district,
        Property.city_id == city_id,
        _mobile_filter(),
    ]

    total_q = select(func.count(Property.id)).where(and_(*conditions))
    total = (await db.execute(total_q)).scalar() or 0

    avg_price_q = select(func.avg(Property.starting_price)).where(and_(*conditions))
    avg_price = (await db.execute(avg_price_q)).scalar() or 0

    avg_discount_q = select(func.avg(Property.court_discount_rate)).where(
        and_(*conditions, Property.court_discount_rate > 0)
    )
    avg_discount = (await db.execute(avg_discount_q)).scalar() or 0

    avg_area_q = select(func.avg(Property.area)).where(and_(*conditions, Property.area > 0))
    avg_area = (await db.execute(avg_area_q)).scalar() or 0

    min_price_q = select(func.min(Property.starting_price)).where(
        and_(*conditions, Property.starting_price > 0)
    )
    min_price = (await db.execute(min_price_q)).scalar() or 0

    max_price_q = select(func.max(Property.starting_price)).where(and_(*conditions))
    max_price = (await db.execute(max_price_q)).scalar() or 0

    # Status distribution
    status_q = (
        select(Property.auction_status, func.count(Property.id))
        .where(and_(*conditions))
        .group_by(Property.auction_status)
    )
    status_rows = (await db.execute(status_q)).all()
    status_dist = {row[0]: row[1] for row in status_rows}

    # Type distribution
    type_q = (
        select(Property.property_type, func.count(Property.id))
        .where(and_(*conditions))
        .group_by(Property.property_type)
    )
    type_rows = (await db.execute(type_q)).all()
    type_dist = {row[0]: row[1] for row in type_rows}

    return {
        "district": district,
        "city_id": city_id,
        "total_active": total,
        "avg_starting_price": int(avg_price),
        "avg_starting_price_wan": round(avg_price / 10000, 1),
        "avg_discount_rate": round(avg_discount, 2),
        "avg_area": round(avg_area, 1),
        "min_starting_price": int(min_price),
        "max_starting_price": int(max_price),
        "status_distribution": status_dist,
        "type_distribution": type_dist,
    }


@router.get("/{property_id}/amenities")
async def property_amenities(property_id: int, db: AsyncSession = Depends(get_session)):
    """Return nearby POIs for a property.

    优先读 property.amenities_cache（预处理好的）；否则走高德 API 实时查询，
    并把结果写回 cache 便于下次秒开。
    """
    q = select(Property).where(Property.id == property_id, _mobile_filter())
    result = await db.execute(q)
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="房源不存在或已下架")

    if not p.lat or not p.lng:
        return {"amenities": {}, "message": "该房源暂无坐标信息"}

    # 优先读缓存（30 天有效）
    from datetime import datetime, timedelta
    if p.amenities_cache and p.amenities_updated_at:
        age = datetime.now() - p.amenities_updated_at
        if age < timedelta(days=30):
            return {
                "amenities": p.amenities_cache,
                "lat": p.lat, "lng": p.lng,
                "cached": True,
                "cached_at": str(p.amenities_updated_at),
            }

    if not AMAP_API_KEY:
        return {
            "amenities": {},
            "message": "周边配套服务暂未配置（需高德地图 API Key）。请设置环境变量 AMAP_API_KEY。",
        }

    amenities: dict[str, list[dict]] = {}

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            for cat_key, (cat_name, cat_code) in AMAP_CATEGORIES.items():
                try:
                    resp = await client.get(
                        "https://restapi.amap.com/v3/place/around",
                        params={
                            "key": AMAP_API_KEY,
                            "location": f"{p.lng},{p.lat}",
                            "radius": 2000,
                            "types": cat_code,
                            "offset": 10,
                            "page": 1,
                            "extensions": "base",
                        },
                    )
                    data = resp.json()
                    if data.get("status") == "1" and data.get("pois"):
                        amenities[cat_key] = [
                            {
                                "name": poi.get("name", ""),
                                "address": poi.get("address", ""),
                                "distance": int(poi.get("distance", 0)),
                                "type": poi.get("type", ""),
                            }
                            for poi in data["pois"]
                        ]
                except Exception as e:
                    logger.warning(f"Amap POI search failed for {cat_key}: {e}")
    except ImportError:
        return {"amenities": {}, "message": "httpx 依赖未安装"}

    # 写回缓存（即使空也写，避免下次重复查无果）
    try:
        p.amenities_cache = amenities
        p.amenities_updated_at = datetime.now()
        await db.commit()
    except Exception as e:
        logger.warning(f"amenities cache write failed: {e}")

    return {"amenities": amenities, "lat": p.lat, "lng": p.lng, "cached": False}


@router.get("/{property_id}", response_model=PropertyDetail)
async def get_property(property_id: int, db: AsyncSession = Depends(get_session)):
    q = select(Property).where(Property.id == property_id, _mobile_filter())
    result = await db.execute(q)
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="房源不存在或已下架")

    detail = PropertyDetail.model_validate(p)

    # Enrich with community info (Beike reference data)
    community = None
    if p.community_name:
        community_q = select(CommunityInfo).where(CommunityInfo.name == p.community_name)
        community = (await db.execute(community_q)).scalar_one_or_none()
        if community:
            # 兼容旧字段：beike_latest_deal_unit_price 仍写入
            if community.avg_price:
                detail.beike_latest_deal_unit_price = community.avg_price
                detail.beike_latest_deal_time = community.price_update_at
                if p.area > 0:
                    detail.beike_latest_deal_total_price = int(community.avg_price * p.area)
            # 新增：嵌入完整小区详情
            from ...schemas import CommunityInfoOut
            detail.community_info = CommunityInfoOut.model_validate(community)

    # 同房型成交参考兜底（E 方案）：
    # 贝壳近30天 → 贝壳均价 → 平台市场成交单价 → 平台最新成交单价。
    # 贝壳数据当前因风控基本抓不到，实际多走平台自带市场成交价。
    detail.deal_reference = _build_deal_reference(p, community)

    return detail


def _build_deal_reference(p: Property, community: CommunityInfo | None) -> DealReferenceOut | None:
    """按优先级挑一个可信的成交单价作为「同房型成交参考」，并标注来源。"""
    candidates = []
    if community is not None:
        candidates.append((getattr(community, "recent_avg_price_30d", None), "贝壳近30天",
                           getattr(community, "last_crawled_at", None)))
        candidates.append((getattr(community, "avg_price", None), "贝壳均价",
                           getattr(community, "price_update_at", None)))
    candidates.append((p.market_deal_unit_price, "市场参考", p.source_updated_at))
    candidates.append((p.latest_deal_unit_price, "平台成交价", p.source_updated_at))

    for unit_price, label, updated_at in candidates:
        if _valid_unit_price(unit_price):
            unit_price = float(unit_price)
            total = int(unit_price * p.area) if p.area and p.area > 0 else None
            return DealReferenceOut(
                unit_price=round(unit_price, 2),
                total_price=total,
                source_label=label,
                updated_at=updated_at,
            )
    return None
