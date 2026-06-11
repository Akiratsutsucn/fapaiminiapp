"""User routes for C-end."""
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.database import get_session
from ...core.security import get_current_user
from ...core.auction_status import effective_status
from ...models.user import User
from ...models.favorite import UserFavorite
from ...models.browse_history import BrowseHistory
from ...schemas import UserInfo, UserProfileUpdate, UserStats

router = APIRouter()

_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_AVATAR_MAX = 5 * 1024 * 1024  # 5MB


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """C 端用户上传头像（微信 chooseAvatar 选好的图片），存储并写回 user.avatar_url。"""
    if file.content_type not in _AVATAR_TYPES:
        raise HTTPException(status_code=400, detail="头像仅支持 jpg/png/webp/gif")
    content = await file.read()
    if len(content) > _AVATAR_MAX:
        raise HTTPException(status_code=400, detail="头像大小不能超过 5MB")

    ext = (file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png")
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        ext = "png"
    filename = f"{uuid.uuid4().hex}.{ext}"
    rel_dir = Path("avatars")
    storage_dir = Path(settings.IMAGE_STORAGE_PATH) / rel_dir
    os.makedirs(storage_dir, exist_ok=True)
    (storage_dir / filename).write_bytes(content)

    url = f"{settings.IMAGE_BASE_URL}/{rel_dir.as_posix()}/{filename}" if settings.IMAGE_BASE_URL else str(storage_dir / filename)

    user = (await db.execute(select(User).where(User.id == int(user_data["sub"])))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.avatar_url = url
    await db.commit()
    return {"avatar_url": url}


@router.get("/profile", response_model=UserInfo)
async def get_profile(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(User).where(User.id == int(user_data["sub"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return UserInfo.model_validate(user)


@router.put("/profile", response_model=UserInfo)
async def update_profile(
    body: UserProfileUpdate,
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(User).where(User.id == int(user_data["sub"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(user, k, v)
    await db.commit()
    await db.refresh(user)
    return UserInfo.model_validate(user)


@router.get("/stats", response_model=UserStats)
async def get_stats(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = int(user_data["sub"])
    # 关注房源计数须与「关注房源/房源收藏」列表口径一致：
    # 约定——小程序只展示「即将开拍/进行中」可参拍房源，已结束/已成交/流拍等不再露出。
    # 房源下架后列表会过滤掉它，计数也必须同步排除，否则数字与列表对不上、不随下架减少。
    from ...core.auction_status import effective_status_sql, MOBILE_VISIBLE_STATUSES
    from ...models.property import Property
    fav_count = (await db.execute(
        select(func.count(UserFavorite.id))
        .join(Property, Property.id == UserFavorite.target_id)
        .where(
            UserFavorite.user_id == uid,
            UserFavorite.favorite_type == "property",
            effective_status_sql().in_(MOBILE_VISIBLE_STATUSES),
        )
    )).scalar() or 0
    return UserStats(favorite_count=fav_count)


@router.get("/favorites", response_model=dict)
async def list_favorites(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    favorite_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
):
    uid = int(user_data["sub"])
    conditions = [UserFavorite.user_id == uid]
    if favorite_type:
        conditions.append(UserFavorite.favorite_type == favorite_type)

    # 房源收藏/关注房源：约定小程序只展示「即将开拍/进行中」可参拍房源。
    # 在列表源头按实时状态过滤，已结束/已成交/流拍等收藏不再返回（与 /stats 计数同口径），
    # 避免依赖详情接口的兜底状态导致已结束房源漏出。文章收藏(article)不受影响。
    if favorite_type == "property":
        from ...core.auction_status import effective_status_sql, MOBILE_VISIBLE_STATUSES
        from ...models.property import Property

        base = (
            select(UserFavorite)
            .join(Property, Property.id == UserFavorite.target_id)
            .where(*conditions, effective_status_sql().in_(MOBILE_VISIBLE_STATUSES))
        )
        count_q = (
            select(func.count(UserFavorite.id))
            .join(Property, Property.id == UserFavorite.target_id)
            .where(*conditions, effective_status_sql().in_(MOBILE_VISIBLE_STATUSES))
        )
    else:
        base = select(UserFavorite).where(*conditions)
        count_q = select(func.count(UserFavorite.id)).where(*conditions)

    q = (
        base
        .order_by(UserFavorite.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()
    total = (await db.execute(count_q)).scalar() or 0
    return {"items": [{"id": r.id, "type": r.favorite_type, "target_id": r.target_id, "created_at": str(r.created_at)} for r in rows], "total": total}


@router.post("/favorites")
async def add_favorite(
    favorite_type: str = "property",
    target_id: int = 0,
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = int(user_data["sub"])
    existing = await db.execute(
        select(UserFavorite).where(
            UserFavorite.user_id == uid,
            UserFavorite.favorite_type == favorite_type,
            UserFavorite.target_id == target_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"message": "已收藏"}
    fav = UserFavorite(user_id=uid, favorite_type=favorite_type, target_id=target_id)
    db.add(fav)
    await db.commit()
    return {"message": "收藏成功", "id": fav.id}


@router.delete("/favorites/{fav_id}")
async def remove_favorite(
    fav_id: int,
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = int(user_data["sub"])
    result = await db.execute(
        select(UserFavorite).where(UserFavorite.id == fav_id, UserFavorite.user_id == uid)
    )
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status_code=404, detail="收藏不存在")
    await db.delete(fav)
    await db.commit()
    return {"message": "已取消收藏"}


@router.get("/browse-history", response_model=dict)
async def list_history(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    page: int = 1,
    page_size: int = 20,
):
    uid = int(user_data["sub"])
    q = (
        select(BrowseHistory)
        .where(BrowseHistory.user_id == uid)
        .order_by(BrowseHistory.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()
    total = (await db.execute(
        select(func.count(BrowseHistory.id)).where(BrowseHistory.user_id == uid)
    )).scalar() or 0
    return {"items": [{"id": r.id, "type": r.history_type, "target_id": r.target_id, "created_at": str(r.created_at)} for r in rows], "total": total}


@router.get("/recommendations", response_model=dict)
async def list_recommendations(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    page: int = 1,
    page_size: int = 20,
):
    """我的「为你推荐」列表，返回房源摘要 + 推荐语。"""
    from ...models.recommendation import PropertyRecommendation
    from ...models.property import Property, PropertyImage

    uid = int(user_data["sub"])
    q = (
        select(PropertyRecommendation)
        .where(PropertyRecommendation.user_id == uid)
        .order_by(PropertyRecommendation.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()
    total = (await db.execute(
        select(func.count(PropertyRecommendation.id)).where(PropertyRecommendation.user_id == uid)
    )).scalar() or 0

    items = []
    for r in rows:
        p = (await db.execute(select(Property).where(Property.id == r.property_id))).scalar_one_or_none()
        if not p:
            continue
        cover = next((img.image_url for img in (p.images or []) if img.is_cover), None)
        items.append({
            "rec_id": r.id,
            "reason": r.reason,
            "status": r.status,
            "created_at": str(r.created_at),
            "property": {
                "id": p.id, "title": p.title, "district": p.district,
                "community_name": p.community_name, "area": p.area,
                "starting_price": p.starting_price, "appraisal_price": p.appraisal_price,
                "auction_status": effective_status(p.auction_status, p.auction_start_time, p.auction_end_time),
                "auction_round": p.auction_round,
                "cover_image": cover, "property_type": p.property_type,
            },
        })
    return {"items": items, "total": total}


@router.get("/recommendations/unread-count", response_model=dict)
async def unread_recommendation_count(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    from ...models.recommendation import PropertyRecommendation
    uid = int(user_data["sub"])
    cnt = (await db.execute(
        select(func.count(PropertyRecommendation.id)).where(
            PropertyRecommendation.user_id == uid,
            PropertyRecommendation.status == "未读",
        )
    )).scalar() or 0
    return {"unread": cnt}


@router.post("/recommendations/{rec_id}/read")
async def mark_recommendation_read(
    rec_id: int,
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    from ...models.recommendation import PropertyRecommendation
    uid = int(user_data["sub"])
    rec = (await db.execute(
        select(PropertyRecommendation).where(
            PropertyRecommendation.id == rec_id,
            PropertyRecommendation.user_id == uid,
        )
    )).scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="推荐不存在")
    rec.status = "已读"
    await db.commit()
    return {"message": "ok"}


# ========== 业务员/代理商：我的客户需求 ==========

def _demand_to_dict(d) -> dict:
    return {
        "id": d.id, "name": d.name, "phone": d.phone, "gender": d.gender,
        "city": d.city, "purpose": d.purpose, "budget": d.budget,
        "own_funds": d.own_funds, "target_district": d.target_district,
        "remark": d.remark, "source": d.source, "status": d.status,
        "assign_read": d.assign_read,
        "created_at": str(d.created_at),
    }


@router.get("/my-demands", response_model=dict)
async def my_assigned_demands(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    page: int = 1,
    page_size: int = 20,
):
    """业务员/代理商查看分配给自己的客户需求与留言。"""
    from ...models.demand import Demand
    uid = int(user_data["sub"])
    base = select(Demand).where(Demand.assigned_user_id == uid)
    total = (await db.execute(
        select(func.count(Demand.id)).where(Demand.assigned_user_id == uid)
    )).scalar() or 0
    rows = (await db.execute(
        base.order_by(Demand.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()
    return {"items": [_demand_to_dict(d) for d in rows], "total": total}


@router.get("/my-demands/unread-count", response_model=dict)
async def my_assigned_demands_unread(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    from ...models.demand import Demand
    uid = int(user_data["sub"])
    cnt = (await db.execute(
        select(func.count(Demand.id)).where(
            Demand.assigned_user_id == uid, Demand.assign_read == 0
        )
    )).scalar() or 0
    return {"unread": cnt}


@router.post("/my-demands/{demand_id}/read")
async def mark_my_demand_read(
    demand_id: int,
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    from ...models.demand import Demand
    uid = int(user_data["sub"])
    d = (await db.execute(
        select(Demand).where(Demand.id == demand_id, Demand.assigned_user_id == uid)
    )).scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="需求不存在")
    d.assign_read = 1
    await db.commit()
    return {"message": "ok"}


@router.post("/my-demands/{demand_id}/status")
async def update_my_demand_status(
    demand_id: int,
    status: str,
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """对接人更新需求处理状态（已分配→已完成）。"""
    from ...models.demand import Demand
    if status not in ("已分配", "已完成"):
        raise HTTPException(status_code=400, detail="状态不合法")
    uid = int(user_data["sub"])
    d = (await db.execute(
        select(Demand).where(Demand.id == demand_id, Demand.assigned_user_id == uid)
    )).scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="需求不存在")
    d.status = status
    d.assign_read = 1
    await db.commit()
    return {"message": "ok"}
