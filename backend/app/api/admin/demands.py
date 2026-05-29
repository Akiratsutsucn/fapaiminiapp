"""Admin demand management routes."""
import math
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.security import get_admin_user
from ...models.demand import Demand
from ...schemas import PaginatedResponse, AdminDemandUpdate, RecommendRequest

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_demands(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
    phone: str | None = Query(None),
    target_district: str | None = Query(None),
    status: str | None = Query(None),
    source: str | None = Query(None),  # demand-form / message
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    conditions = []
    if phone:
        conditions.append(Demand.phone == phone)
    if target_district:
        conditions.append(Demand.target_district == target_district)
    if status:
        conditions.append(Demand.status == status)
    if source:
        conditions.append(Demand.source == source)

    base_q = select(func.count(Demand.id))
    if conditions:
        base_q = base_q.where(and_(*conditions))
    total = (await db.execute(base_q)).scalar() or 0

    q = select(Demand).order_by(Demand.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    if conditions:
        q = q.where(and_(*conditions))
    rows = (await db.execute(q)).scalars().all()

    items = [
        {
            "id": d.id, "user_id": d.user_id, "name": d.name,
            "gender": d.gender, "birthday": str(d.birthday) if d.birthday else None,
            "phone": d.phone, "city": d.city, "purpose": d.purpose,
            "budget": d.budget, "own_funds": d.own_funds,
            "target_district": d.target_district, "agent_wechat": d.agent_wechat,
            "remark": d.remark, "source": d.source, "status": d.status,
            "created_at": str(d.created_at),
        }
        for d in rows
    ]
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post("")
async def create_demand(
    body: dict,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    d = Demand(
        user_id=body.get("user_id", 0),
        name=body.get("name", ""),
        phone=body.get("phone", ""),
        city=body.get("city", "上海"),
        purpose=body.get("purpose", "自住"),
        budget=body.get("budget", ""),
        target_district=body.get("target_district", ""),
        status=body.get("status", "待处理"),
    )
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return {"id": d.id, "name": d.name, "status": d.status, "created_at": str(d.created_at)}


@router.delete("/{demand_id}")
async def delete_demand(
    demand_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    result = await db.execute(select(Demand).where(Demand.id == demand_id))
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="需求不存在")
    await db.delete(d)
    await db.commit()
    return {"message": "删除成功"}


@router.put("/{demand_id}")
async def update_demand(
    demand_id: int,
    body: AdminDemandUpdate,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    result = await db.execute(select(Demand).where(Demand.id == demand_id))
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="需求不存在")

    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(d, k, v)
    await db.commit()
    return {"message": "更新成功"}


@router.post("/recommend")
async def recommend_property(
    body: RecommendRequest,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    return {"message": f"已向用户{body.user_id}推荐房源{body.property_id}", "notification_sent": False}
