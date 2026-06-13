"""Admin user management routes."""
import math
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.security import get_admin_user, check_write_permission, check_module_permission
from ...models.user import User
from ...schemas import PaginatedResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_users(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("users")),
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
    admin: dict = Depends(check_write_permission()),
):
    from ...core.security import pwd_context

    # 验证角色是否合法
    valid_roles = ["customer", "agent", "salesperson", "leader", "content_manager", "admin"]
    role = body.get("role", "customer")
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"无效的角色类型，可选值：{', '.join(valid_roles)}")

    # 检查手机号是否已存在
    phone = body.get("phone")
    if phone:
        result = await db.execute(select(User).where(User.phone == phone))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="手机号已存在")

    u = User(
        openid=f"admin_created_{body.get('phone', 'no_phone')}",
        nickname=body.get("nickname", "新用户"),
        phone=phone,
        role=role,
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
    admin: dict = Depends(check_write_permission()),
):
    from sqlalchemy import text as _text

    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 先清理指向该用户的关联记录,避免外键约束导致删除失败(此前删用户报500被前端吞掉)。
    # browse_history/demands/property_recommendations/user_favorites: 该用户的记录直接删;
    # users.inviter_id: 把"被该用户邀请"的客户的邀请人置空(保留客户本身)。
    try:
        for tbl in ("browse_history", "demands", "property_recommendations", "user_favorites"):
            await db.execute(_text(f"DELETE FROM {tbl} WHERE user_id = :uid"), {"uid": user_id})
        await db.execute(_text("UPDATE users SET inviter_id = NULL WHERE inviter_id = :uid"), {"uid": user_id})
        await db.delete(u)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"删除失败(可能存在关联数据): {e}")
    return {"message": "删除成功"}


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("users")),
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
    admin: dict = Depends(check_write_permission()),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")

    allowed = {"nickname", "phone", "gender", "role", "city_id", "region", "inviter_id"}
    for k, v in body.items():
        if k in allowed:
            # 验证角色
            if k == "role":
                valid_roles = ["customer", "agent", "salesperson", "leader", "content_manager", "admin"]
                if v not in valid_roles:
                    raise HTTPException(status_code=400, detail=f"无效的角色类型，可选值：{', '.join(valid_roles)}")
            setattr(u, k, v)
    await db.commit()
    return {"message": "更新成功"}


@router.put("/{user_id}/role")
async def update_user_role(
    user_id: int,
    body: dict,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_write_permission()),
):
    """单独的角色修改接口"""
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")

    role = body.get("role")
    if not role:
        raise HTTPException(status_code=400, detail="缺少role参数")

    valid_roles = ["customer", "agent", "salesperson", "leader", "content_manager", "admin"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"无效的角色类型，可选值：{', '.join(valid_roles)}")

    u.role = role
    await db.commit()
    return {"message": "角色更新成功", "role": role}


@router.get("/me/permissions")
async def get_current_user_permissions(
    admin: dict = Depends(get_admin_user),
):
    """获取当前用户的权限列表和可访问模块"""
    from ...core.security import ROLE_PERMISSIONS

    role = admin.get("role", "")
    permissions = ROLE_PERMISSIONS.get(role, [])

    # 是否是只读角色
    is_readonly = role == "leader"

    return {
        "role": role,
        "permissions": permissions,
        "is_readonly": is_readonly,
        "can_access_all": "*" in permissions,
    }


@router.get("/roles/list")
async def get_role_list(
    admin: dict = Depends(get_admin_user),
):
    """获取所有可用角色列表，供前端下拉选择"""
    roles = [
        {"value": "admin", "label": "管理员", "description": "最高管理员，全部权限"},
        {"value": "leader", "label": "领导", "description": "全局可见但只读"},
        {"value": "content_manager", "label": "内容管理员", "description": "仅能访问文章、横幅、爬虫模块"},
        {"value": "agent", "label": "代理商", "description": "可登录后台，部分权限"},
        {"value": "salesperson", "label": "业务员", "description": "不能登录后台"},
        {"value": "customer", "label": "客户", "description": "普通用户，不能登录后台"},
    ]
    return {"roles": roles}
