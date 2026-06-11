"""Property routes for C-end."""
import math
import os
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from ...core.database import get_session
from ...core.auction_status import (
    effective_status, effective_status_sql, mobile_listable_sql, mobile_sort_rank_sql,
    MOBILE_VISIBLE_STATUSES,
    listed_on_sql, sold_on_sql,
)
from ...core.district_priority import tier_sql_expr
from ...models.property import Property, PropertyImage
from ...models.community import CommunityInfo
from ...schemas import (
    PropertyListParams, PropertyListItem, PropertyDetail, PaginatedResponse,
    MarketStatsOut, DealReferenceOut, RiskTagOut,
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

# 列表封面图域名：thumb_url 历史数据多存为 http://<裸IP>/images/...，小程序强制
# HTTPS+备案域名无法加载，统一重写到 https 域名（文件路径一致，仅换 scheme+host）。
_PUBLIC_IMG_HOST = "https://xcxapi.fapaizhelianmeng.cn"


def _normalize_img(url: str | None) -> str | None:
    """把图片 URL 统一到对外可访问的 https 域名（修正裸 IP / http 缩略图地址）。"""
    if not url:
        return url
    idx = url.find("/images/")
    if idx >= 0 and (url.startswith("http://") or "122.51.156.252" in url):
        return _PUBLIC_IMG_HOST + url[idx:]
    return url


def _list_cover(p) -> str | None:
    """列表卡片封面：优先缩略图(thumb_url，约为原图 1/6 体积，缓解滚动跳帧)，
    无缩略图再退回原图；并统一重写到 https 域名。"""
    imgs = [img for img in (p.images or []) if not getattr(img, "hidden", 0)]
    chosen = next((img for img in imgs if img.is_cover), None) or (imgs[0] if imgs else None)
    if not chosen:
        return None
    return _normalize_img(chosen.thumb_url or chosen.image_url)

AMAP_CATEGORIES = {
    "school": ("学校", "141200"),
    "hospital": ("医院", "090100"),
    "transit": ("交通", "150000"),
    "shopping": ("购物", "060000"),
    "food": ("餐饮", "050000"),
    "bank": ("银行", "160100"),
}

router = APIRouter()

# 小程序可见性的单一事实源 = core.auction_status.mobile_listable_sql()：
# 可参拍(即将开拍/进行中) OR auction_end_time 落在过去 72h 内（含所有结束态）。
# 所有状态判断都走 effective_status_sql()/mobile_listable_sql()——按 auction_start_time/
# end_time + 当前时间实时计算，不信任库里可能过期/抓错的 auction_status 文本。


def _mobile_filter():
    """详情/分析/周边等：可见性跟随「全部房源」列表 = 可参拍 + 近 72h 内结束，
    保证列表里能看到的房源都能点开详情。"""
    return mobile_listable_sql()


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
    discount_min: float | None = Query(None, description="折扣下限(如0.1)，捡漏入口用"),
    discount_max: float | None = Query(None, description="折扣上限(如0.65)，捡漏入口用"),
    listed_day: str | None = Query(None, description="上架日筛选：yesterday=昨日上架(真实上架日期)"),
    sold_day: str | None = Query(None, description="成交日筛选：yesterday=昨日成交(真实结束日期)"),
    sort_by: str | None = Query(None),
    sort_order: str = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    from datetime import date as _date, timedelta as _timedelta

    def _multi(v):
        """逗号分隔的多值参数 → 去空白的列表；单值也兼容。"""
        if not v:
            return []
        return [s.strip() for s in v.split(",") if s.strip()]

    conditions = []

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

    # 物业类型 / 拍卖轮次：支持逗号分隔多选
    ptypes = _multi(property_type)
    if ptypes:
        conditions.append(Property.property_type.in_(ptypes))
    rounds = _multi(auction_round)
    if rounds:
        conditions.append(Property.auction_round.in_(rounds))

    # 折扣范围（捡漏入口）：court_discount_rate 落在 [discount_min, discount_max]
    if discount_min is not None:
        conditions.append(Property.court_discount_rate >= discount_min)
    if discount_max is not None:
        conditions.append(Property.court_discount_rate <= discount_max)

    # 昨日上架：真实上架日期 publish_date == 昨天（口径与首页 market-stats 共用 listed_on_sql）
    if listed_day == "yesterday":
        _y = _date.today() - _timedelta(days=1)
        conditions.append(listed_on_sql(_y))

    # 状态过滤（口径须与首页 market-stats 各计数一一对应，保证首页数字 == 列表「共xxx套」）：
    # - sold_day=yesterday：昨日成交入口，仅「已成交」+ 真实结束日期==昨天
    # - listed_day=yesterday：昨日上架入口，真实上架日期==昨天 + 仍为可参拍状态
    #   （即将开拍/进行中）。约定：小程序不展示已结束/已成交房源，与 market-stats 同口径。
    # - 否则按用户选的状态(支持多选)，再否则自动决定可参拍/兜底
    statuses = _multi(auction_status)
    if sold_day == "yesterday":
        # 昨日成交：复用 sold_on_sql（成交日期优先取成交确认书内「网拍结束时间」
        # online_auction_end_time，空则回退 auction_end_time），口径与首页 market-stats
        # / dashboard 的 yesterday_sold 完全一致。
        _y = _date.today() - _timedelta(days=1)
        conditions.append(sold_on_sql(_y))
    elif listed_day == "yesterday":
        # 昨日上架：除真实上架日期外，仍须套小程序可参拍状态（即将开拍/进行中）——
        # 约定：小程序只展示可参拍房源，昨天上架但已结束/已成交的不再露出。
        # 口径须与 market-stats.yesterday_listed 一致（同样叠加 MOBILE_VISIBLE_STATUSES），
        # 保证「首页数字 == 列表共xxx套」。
        conditions.append(effective_status_sql().in_(MOBILE_VISIBLE_STATUSES))
    elif statuses:
        valid = [s for s in statuses if s in MOBILE_VISIBLE_STATUSES]
        if valid:
            conditions.append(effective_status_sql().in_(valid))
        else:
            # 无有效可参拍状态筛选 → 回落到默认窗口口径（可参拍 + 近72h结束）
            conditions.append(mobile_listable_sql())
    else:
        # 默认：可参拍 + 近72h内结束的房源（取消「无可参拍时兜底已成交」）
        conditions.append(mobile_listable_sql())

    # Count
    count_q = select(func.count(Property.id)).where(and_(*conditions))
    total = (await db.execute(count_q)).scalar() or 0

    # 排序：用户主动选了字段(starting_price/appraisal_price/area)就按该字段；
    # 否则套 状态优先(可参拍排前/已结束已成交沉底) + 主城优先 4 档 + 开拍时间升序 + created_at desc 兜底。
    if sort_by in ("starting_price", "appraisal_price", "area"):
        order_col = getattr(Property, sort_by)
        # 状态优先仍置顶：即使按价格/面积排序，已结束/已成交也沉到可参拍之后
        order_clauses = [
            mobile_sort_rank_sql().asc(),
            order_col.asc() if sort_order == "asc" else order_col.desc(),
        ]
    else:
        order_clauses = [
            mobile_sort_rank_sql().asc(),
            tier_sql_expr().asc(),
            Property.auction_start_time.is_(None).asc(),
            Property.auction_start_time.asc(),
            Property.created_at.desc(),
        ]

    q = (
        select(Property)
        .where(and_(*conditions))
        .order_by(*order_clauses)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()

    items = []
    for p in rows:
        cover = _list_cover(p)
        # 成交折扣率 = 成交价 / 评估价（成交价远低于评估价是「昨日成交」的核心冲击力）
        deal_rate = 0.0
        if p.final_deal_price and p.appraisal_price and p.appraisal_price > 0:
            deal_rate = round(p.final_deal_price / p.appraisal_price, 4)
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
            auction_status=effective_status(p.auction_status, p.auction_start_time, p.auction_end_time, deal_confirmed=p.deal_confirmed),
            auction_start_time=p.auction_start_time,
            auction_end_time=p.auction_end_time,
            cover_image=cover,
            property_type=p.property_type,
            auction_platform=p.auction_platform,
            final_deal_price=p.final_deal_price or 0,
            deal_discount_rate=deal_rate,
            online_auction_end_time=p.online_auction_end_time,
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
    conditions = []
    if city_id:
        conditions.append(Property.city_id == city_id)
    # 推荐区仅推可参拍房源（即将开拍/进行中）。按用户 2026-06-11 要求全站取消
    # 「无可参拍时兜底已成交」逻辑：宁可推荐区为空也不展示过期成交房。
    conditions.append(effective_status_sql().in_(MOBILE_VISIBLE_STATUSES))

    q = (
        select(Property)
        .where(and_(*conditions))
        .order_by(tier_sql_expr().asc(),
                  Property.auction_start_time.is_(None).asc(),
                  Property.auction_start_time.asc(),
                  Property.created_at.desc())
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()

    items = []
    for p in rows:
        cover = _list_cover(p)
        items.append(PropertyListItem(
            id=p.id, title=p.title, district=p.district, community_name=p.community_name,
            area=p.area, layout=p.layout, starting_price=p.starting_price,
            starting_unit_price=p.starting_unit_price, appraisal_price=p.appraisal_price,
            court_discount_rate=p.court_discount_rate, auction_round=p.auction_round,
            auction_status=effective_status(p.auction_status, p.auction_start_time, p.auction_end_time),
            auction_start_time=p.auction_start_time,
            auction_end_time=p.auction_end_time, cover_image=cover,
            property_type=p.property_type,
            auction_platform=p.auction_platform,
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
            # 地图仅展示可参拍房源（不含近72h结束的）——窗口仅作用于「全部房源」列表。
            effective_status_sql().in_(MOBILE_VISIBLE_STATUSES),
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
        "auction_status": effective_status(r.auction_status, r.auction_start_time, r.auction_end_time),
        "property_type": r.property_type,
        "area": r.area,
        "district": r.district,
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

    # Status distribution（按实时计算状态分组）
    eff = effective_status_sql()
    status_q = (
        select(eff, func.count(Property.id))
        .where(and_(*conditions))
        .group_by(eff)
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

    # 拍卖状态按实时计算（与列表/筛选口径一致），避免详情页显示过期/抓错的库存状态
    detail.auction_status = effective_status(p.auction_status, p.auction_start_time, p.auction_end_time, deal_confirmed=p.deal_confirmed)
    # 成交折扣率 = 成交价 / 评估价（已成交房源展示「远低于评估价」的冲击力）
    if p.final_deal_price and p.appraisal_price and p.appraisal_price > 0:
        detail.deal_discount_rate = round(p.final_deal_price / p.appraisal_price, 4)

    # 过滤垃圾图(广告/二维码/logo)：前台只展示未隐藏的图片
    if detail.images:
        detail.images = [
            img for img in detail.images if not getattr(img, "hidden", 0)
        ]
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

    # 风险/利好标签（红黄绿）
    detail.risk_tags = _build_risk_tags(p)

    return detail


# 风险/利好关键词词典：(关键词列表, level, label, detail)
# level: danger 红(重大风险) / warning 黄(需注意) / safe 绿(利好)
# 注意：这些是"明确表述风险"的强关键词，避免命中"租赁情况：无"这类利好表述。
_RISK_RULES = [
    (["买卖不破租赁", "现由他人租赁", "存在租赁", "已出租", "租赁合同", "长期租赁", "尚在租期"],
     "danger", "租赁占用", "标的存在租赁，可能买卖不破租赁，需核实租约与腾退难度"),
    (["户籍未迁", "户口未迁", "户籍未迁出", "存在户籍", "有户口登记", "落户于此"],
     "danger", "户口未迁", "标的可能存在户口未迁出，影响后续落户"),
    (["有人居住", "实际占用", "被他人占用", "现由他人占用", "占用人为", "租户占用"],
     "danger", "人员占用", "标的现状有人居住或占用，腾退存在难度"),
    (["系被执行人唯一", "唯一一套住房", "为唯一住房", "属唯一住房"],
     "warning", "唯一住房", "可能为被执行人唯一住房，腾退周期可能较长"),
    (["欠缴", "拖欠", "物业费未", "水电费未", "欠物业", "尚欠", "欠款需"],
     "warning", "欠费提示", "标的可能存在物业/水电等欠费，过户前需核实结清"),
    (["不支持贷款", "不能贷款", "需一次性付款", "无法按揭", "不接受贷款"],
     "warning", "需全款", "标的可能不支持贷款，需一次性付款"),
    (["补缴土地出让金", "税费由买受人", "税费均由买受人", "一切税费由", "所有税费由买受人"],
     "warning", "税费自担", "成交相关税费可能由买受人承担，需预估成本"),
]

_SAFE_RULES = [
    (["可办理贷款", "支持贷款", "可按揭", "支持按揭"],
     "safe", "支持贷款", "标的支持贷款，资金压力较小"),
]

# 结构化"字段：值"模式 —— 公拍网/京东标的物介绍含"租赁情况 无/占用情况 空置/户口情况 无"。
# 用正则判断字段后紧跟的值是利好还是风险，避免"租赁"二字一出现就误报。
import re as _re

# (字段正则, 利好值正则→safe标签, 风险值正则→danger标签)
_STRUCT_RULES = [
    {
        "field": r"租赁(?:情况|状况)?[:：\s]{0,4}",
        "safe": (r"^(无|没有|不存在|未发现|空)", "safe", "无租赁", "公告载明无租赁，腾退风险较低"),
        "risk": (r"^(有|存在|.{0,6}年|至.{0,8}止|租期)", "danger", "租赁占用", "公告载明存在租赁，需核实买卖不破租赁风险"),
    },
    {
        "field": r"(?:占用情况|拍品现状|标的现状)[:：\s]{0,4}",
        "safe": (r"(空置|腾空|无人|有钥匙)", "safe", "已腾空", "公告载明现状空置/有钥匙，腾退压力小"),
        "risk": (r"(被占用|他人居住|租户|占用人|有人居住)", "danger", "人员占用", "公告载明现状被占用，腾退存在难度"),
    },
    {
        "field": r"户(?:口|籍)(?:情况)?[:：\s]{0,4}",
        "safe": (r"^(无|没有|不存在|未查|查询无)", "safe", "无户口", "公告载明无户籍登记，落户无障碍"),
        "risk": (r"^(有|存在|.{0,4}人|未迁)", "danger", "户口未迁", "公告载明存在户籍登记，影响后续落户"),
    },
]


def _scan_struct(text: str) -> list[tuple]:
    """扫描"字段：值"结构，返回 (level,label,detail) 列表。"""
    out = []
    for rule in _STRUCT_RULES:
        for m in _re.finditer(rule["field"], text):
            tail = text[m.end():m.end() + 30].strip()
            srx, slv, slb, sdt = rule["safe"]
            rrx, rlv, rlb, rdt = rule["risk"]
            if _re.search(rrx, tail):
                out.append((rlv, rlb, rdt))
                break
            elif _re.search(srx, tail):
                out.append((slv, slb, sdt))
                break
    return out


def _build_risk_tags(p: Property) -> list[RiskTagOut]:
    """从公告文本 + 结构化字段提炼风险/利好标签（红黄绿）。

    法拍最大的坑在于租赁占用、户口、欠费、是否能贷款等——把它们从冗长公告里
    提炼成顶部标签，帮助用户快速判断。优先用"字段：值"结构精准判断（避免
    "租赁情况：无"被误报为有租赁），再用强关键词兜底。命中即提示，需用户复核。
    """
    text = " ".join(filter(None, [p.title or "", p.description or ""]))
    tags: list[RiskTagOut] = []
    seen_labels = set()

    # 0. 结构化"字段：值"判断（最准，优先）
    for level, label, detail in _scan_struct(text):
        if label not in seen_labels:
            tags.append(RiskTagOut(level=level, label=label, detail=detail))
            seen_labels.add(label)

    # 1. 强关键词命中（风险）—— 仅对结构化未覆盖的项补充
    for keywords, level, label, detail in _RISK_RULES:
        if label in seen_labels:
            continue
        if any(kw in text for kw in keywords):
            tags.append(RiskTagOut(level=level, label=label, detail=detail))
            seen_labels.add(label)

    # 2. 结构化字段：贷款支持
    if p.loan_support is True and "支持贷款" not in seen_labels:
        tags.append(RiskTagOut(level="safe", label="支持贷款", detail="该房源支持贷款，资金压力较小"))
        seen_labels.add("支持贷款")
    elif p.loan_support is False and "需全款" not in seen_labels:
        tags.append(RiskTagOut(level="warning", label="需全款", detail="该房源不支持贷款，需一次性付款"))
        seen_labels.add("需全款")

    # 3. 关键词命中（利好）
    for keywords, level, label, detail in _SAFE_RULES:
        if label in seen_labels:
            continue
        if any(kw in text for kw in keywords):
            tags.append(RiskTagOut(level=level, label=label, detail=detail))
            seen_labels.add(label)

    # 4. 附件提示（中性偏利好：有公告附件可供尽调）
    if p.has_attachments and "含附件" not in seen_labels:
        tags.append(RiskTagOut(level="safe", label="含附件", detail="附带评估报告/竞买公告等附件，可供尽调参考"))

    return tags


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
