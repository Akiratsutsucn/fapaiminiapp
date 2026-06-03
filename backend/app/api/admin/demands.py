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
            "assigned_user_id": d.assigned_user_id, "assigned_role": d.assigned_role,
            "assigned_name": d.assigned_name,
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
    # 若(重新)分配对接人，重置已读状态并自动置为「已分配」，便于对方在小程序看到红点
    if "assigned_user_id" in update_data and update_data["assigned_user_id"] != d.assigned_user_id:
        d.assign_read = 0
        if d.status == "待处理":
            d.status = "已分配"
    for k, v in update_data.items():
        setattr(d, k, v)
    await db.commit()
    return {"message": "更新成功"}


@router.get("/assignable-users")
async def list_assignable_users(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """列出可分配的对接人：业务员(salesperson) + 代理商(agent)。"""
    from ...models.user import User
    rows = (await db.execute(
        select(User).where(User.role.in_(["salesperson", "agent"])).order_by(User.role, User.id)
    )).scalars().all()
    role_label = {"salesperson": "业务员", "agent": "代理商"}
    return [
        {
            "id": u.id,
            "name": u.nickname or (u.phone or f"用户{u.id}"),
            "phone": u.phone,
            "role": u.role,
            "role_label": role_label.get(u.role, u.role),
            "region": u.region,
        }
        for u in rows
    ]


@router.post("/recommend")
async def recommend_property(
    body: RecommendRequest,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """把房源定向推荐给指定用户，写入 property_recommendations。

    用户在小程序「为你推荐」中查看。重复推荐(同用户同房源未读)则更新推荐语。
    """
    from ...models.recommendation import PropertyRecommendation
    from ...models.property import Property
    from ...models.user import User

    # 校验用户与房源存在
    user = (await db.execute(select(User).where(User.id == body.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    prop = (await db.execute(select(Property).where(Property.id == body.property_id))).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="房源不存在")

    # 只允许推荐「即将开拍」或「进行中」的房源（按实时计算状态，与小程序口径一致）。
    # 已结束/已成交/已撤回/中止等不可参拍的房源不能推荐给用户。
    from ...core.auction_status import effective_status, MOBILE_VISIBLE_STATUSES
    eff_status = effective_status(prop.auction_status, prop.auction_start_time, prop.auction_end_time)
    if eff_status not in MOBILE_VISIBLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"该房源当前状态为「{eff_status}」，只能推荐「即将开拍」或「进行中」的房源",
        )

    # 去重：同用户同房源已存在则更新推荐语，避免重复推送
    existing = (await db.execute(
        select(PropertyRecommendation).where(
            PropertyRecommendation.user_id == body.user_id,
            PropertyRecommendation.property_id == body.property_id,
        )
    )).scalar_one_or_none()

    if existing:
        existing.reason = body.message or existing.reason
        existing.status = "未读"
        if body.demand_id:
            existing.demand_id = body.demand_id
        action = "已更新推荐"
    else:
        db.add(PropertyRecommendation(
            user_id=body.user_id,
            property_id=body.property_id,
            demand_id=body.demand_id,
            reason=body.message,
            status="未读",
            created_by=str(admin.get("sub") or admin.get("username") or "admin"),
        ))
        action = "已推荐"

    await db.commit()
    return {"message": f"{action}：《{prop.title[:20]}》→ 用户{body.user_id}", "ok": True}


@router.get("/recommend/list")
async def list_recommendations(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
    user_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """列出推荐记录（管理员查看推荐历史）。"""
    from ...models.recommendation import PropertyRecommendation
    from ...models.property import Property

    conditions = []
    if user_id:
        conditions.append(PropertyRecommendation.user_id == user_id)

    q = select(PropertyRecommendation).order_by(PropertyRecommendation.created_at.desc())
    if conditions:
        q = q.where(and_(*conditions))
    q = q.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()

    out = []
    for r in rows:
        prop = (await db.execute(select(Property).where(Property.id == r.property_id))).scalar_one_or_none()
        out.append({
            "id": r.id, "user_id": r.user_id, "property_id": r.property_id,
            "property_title": prop.title if prop else "(房源已删除)",
            "reason": r.reason, "status": r.status,
            "created_by": r.created_by, "created_at": str(r.created_at),
        })
    return out
