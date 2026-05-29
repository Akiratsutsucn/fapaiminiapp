"""User routes for C-end."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.security import get_current_user
from ...models.user import User
from ...models.favorite import UserFavorite
from ...models.browse_history import BrowseHistory
from ...schemas import UserInfo, UserProfileUpdate, UserStats

router = APIRouter()


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
    fav_count = (await db.execute(
        select(func.count(UserFavorite.id)).where(UserFavorite.user_id == uid)
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

    q = (
        select(UserFavorite)
        .where(*conditions)
        .order_by(UserFavorite.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()
    total = (await db.execute(select(func.count(UserFavorite.id)).where(*conditions))).scalar() or 0
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
