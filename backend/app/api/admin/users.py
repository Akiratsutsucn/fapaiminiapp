"""Admin user management routes."""
import math
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.security import get_admin_user
from ...models.user import User
from ...schemas import PaginatedResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_users(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
    phone: str | None = Query(None),
    role: str | None = Query(None),
    keyword: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    conditions = []
    if phone:
        conditions.append(User.phone == phone)
    if role:
        conditions.append(User.role == role)
    if keyword:
        conditions.append(User.nickname.contains(keyword))

    base_q = select(func.count(User.id))
    if conditions:
        base_q = base_q.where(and_(*conditions))
    total = (await db.execute(base_q)).scalar() or 0

    q = select(User).order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    if conditions:
        q = q.where(and_(*conditions))
    rows = (await db.execute(q)).scalars().all()

    items = [
        {
            "id": u.id, "nickname": u.nickname, "avatar_url": u.avatar_url,
            "phone": u.phone, "role": u.role, "inviter_id": u.inviter_id,
            "region": u.region or "",
            "city_id": u.city_id, "created_at": str(u.created_at),
        }
        for u in rows
    ]
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post("")
async def create_user(
    body: dict,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    from ...core.security import pwd_context
    u = User(
        openid=f"admin_created_{body.get('phone', 'no_phone')}",
        nickname=body.get("nickname", "新用户"),
        phone=body.get("phone"),
        role=body.get("role", "customer"),
        city_id=body.get("city_id", 310000),
        region=body.get("region", "") or "",
        inviter_id=body.get("inviter_id"),
        password_hash=pwd_context.hash(body.get("password", "123456")),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return {"id": u.id, "nickname": u.nickname, "phone": u.phone, "role": u.role, "created_at": str(u.created_at)}


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    await db.delete(u)
    await db.commit()
    return {"message": "删除成功"}


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {
        "id": u.id, "nickname": u.nickname, "avatar_url": u.avatar_url,
        "phone": u.phone, "gender": u.gender, "birthday": str(u.birthday) if u.birthday else None,
        "role": u.role, "inviter_id": u.inviter_id,
        "region": u.region or "",
        "city_id": u.city_id,
        "created_at": str(u.created_at),
    }


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    body: dict,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")

    allowed = {"nickname", "phone", "gender", "role", "city_id", "region", "inviter_id"}
    for k, v in body.items():
        if k in allowed:
            setattr(u, k, v)
    await db.commit()
    return {"message": "更新成功"}
