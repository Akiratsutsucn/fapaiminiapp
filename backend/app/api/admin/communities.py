"""Admin community (小区) data management routes."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from ...core.database import get_session
from ...core.security import get_admin_user
from ...models.community import CommunityInfo

router = APIRouter()


class CommunityCreate(BaseModel):
    name: str = Field(..., max_length=128)
    district: str = Field(default="", max_length=64)
    sub_district: str | None = None
    city_id: int = 310000
    lat: float | None = None
    lng: float | None = None
    avg_price: float | None = None
    build_year_start: int | None = None
    build_year_end: int | None = None
    property_type: str | None = None
    total_buildings: int | None = None
    total_units: int | None = None
    developer: str | None = None
    source: str | None = None
    remark: str | None = None


class CommunityUpdate(BaseModel):
    name: str | None = None
    district: str | None = None
    sub_district: str | None = None
    city_id: int | None = None
    lat: float | None = None
    lng: float | None = None
    avg_price: float | None = None
    build_year_start: int | None = None
    build_year_end: int | None = None
    property_type: str | None = None
    total_buildings: int | None = None
    total_units: int | None = None
    developer: str | None = None
    source: str | None = None
    remark: str | None = None


class CommunityBatchImport(BaseModel):
    communities: list[CommunityCreate]


@router.get("")
async def list_communities(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
    city_id: int | None = None,
    keyword: str | None = None,
    limit: int = 100,
):
    q = select(CommunityInfo)
    if city_id:
        q = q.where(CommunityInfo.city_id == city_id)
    if keyword:
        q = q.where(CommunityInfo.name.like(f"%{keyword}%"))
    q = q.order_by(CommunityInfo.district, CommunityInfo.name).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": r.id, "name": r.name, "district": r.district,
            "sub_district": r.sub_district, "city_id": r.city_id,
            "lat": r.lat, "lng": r.lng,
            "avg_price": r.avg_price, "price_update_at": str(r.price_update_at) if r.price_update_at else None,
            "build_year_start": r.build_year_start, "build_year_end": r.build_year_end,
            "property_type": r.property_type, "total_buildings": r.total_buildings,
            "total_units": r.total_units, "developer": r.developer,
            "source": r.source, "remark": r.remark,
            "created_at": str(r.created_at), "updated_at": str(r.updated_at),
        }
        for r in rows
    ]


@router.get("/{community_id}")
async def get_community(
    community_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    r = (await db.execute(
        select(CommunityInfo).where(CommunityInfo.id == community_id)
    )).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="小区不存在")
    return {
        "id": r.id, "name": r.name, "district": r.district,
        "sub_district": r.sub_district, "city_id": r.city_id,
        "lat": r.lat, "lng": r.lng,
        "avg_price": r.avg_price, "price_update_at": str(r.price_update_at) if r.price_update_at else None,
        "build_year_start": r.build_year_start, "build_year_end": r.build_year_end,
        "property_type": r.property_type, "total_buildings": r.total_buildings,
        "total_units": r.total_units, "developer": r.developer,
        "source": r.source, "remark": r.remark,
        "created_at": str(r.created_at), "updated_at": str(r.updated_at),
    }


@router.post("")
async def create_community(
    body: CommunityCreate,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    existing = (await db.execute(
        select(CommunityInfo).where(CommunityInfo.name == body.name)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"小区 '{body.name}' 已存在")

    c = CommunityInfo(**body.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return {"message": "小区已创建", "id": c.id}


@router.put("/{community_id}")
async def update_community(
    community_id: int,
    body: CommunityUpdate,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    c = (await db.execute(
        select(CommunityInfo).where(CommunityInfo.id == community_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(c, key, val)
    c.updated_at = datetime.now()
    if body.avg_price is not None:
        c.price_update_at = datetime.now()
        c.source = c.source or "manual"

    await db.commit()
    return {"message": "小区已更新", "id": c.id}


@router.delete("/{community_id}")
async def delete_community(
    community_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    c = (await db.execute(
        select(CommunityInfo).where(CommunityInfo.id == community_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在")

    await db.delete(c)
    await db.commit()
    return {"message": "小区已删除"}


@router.post("/batch-import")
async def batch_import_communities(
    body: CommunityBatchImport,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    added = 0
    skipped = 0
    for item in body.communities:
        existing = (await db.execute(
            select(CommunityInfo).where(CommunityInfo.name == item.name)
        )).scalar_one_or_none()
        if existing:
            skipped += 1
            continue
        db.add(CommunityInfo(**item.model_dump()))
        added += 1

    await db.commit()
    return {"message": f"导入完成", "added": added, "skipped": skipped}


@router.post("/refresh-prices")
async def refresh_community_prices(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """Attempt to refresh community prices from external sources (placeholder)."""
    return {
        "message": "自动刷新暂不可用。请通过 PUT /api/admin/communities/{id} 手动更新均价，或使用 batch-import 接口批量导入。",
        "note": "贝壳找房现已要求登录验证，自动抓取暂时不可用",
    }
