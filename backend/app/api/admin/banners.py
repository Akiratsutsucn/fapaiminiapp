"""Admin banner management routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.security import get_admin_user
from ...models.banner import Banner

router = APIRouter()


@router.get("")
async def list_banners(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    rows = (await db.execute(
        select(Banner).order_by(Banner.sort_order.asc())
    )).scalars().all()
    return [{
        "id": b.id, "title": b.title, "image_url": b.image_url,
        "category": b.category, "link_url": b.link_url,
        "article_id": b.article_id,
        "city_id": b.city_id, "sort_order": b.sort_order,
        "is_active": b.is_active, "created_at": str(b.created_at),
    } for b in rows]


@router.post("")
async def create_banner(
    body: dict,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    b = Banner(
        title=body.get("title", ""),
        image_url=body.get("image_url", ""),
        category=body.get("category", ""),
        link_url=body.get("link_url", ""),
        article_id=body.get("article_id") or None,
        city_id=body.get("city_id", 310000),
        sort_order=body.get("sort_order", 0),
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return {"message": "创建成功", "id": b.id}


@router.put("/{banner_id}")
async def update_banner(
    banner_id: int,
    body: dict,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    result = await db.execute(select(Banner).where(Banner.id == banner_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="横幅不存在")

    editable = {"title", "image_url", "category", "link_url", "article_id", "city_id", "sort_order", "is_active"}
    for k, v in body.items():
        if k in editable:
            setattr(b, k, v)
    await db.commit()
    return {"message": "更新成功"}


@router.delete("/{banner_id}")
async def delete_banner(
    banner_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    result = await db.execute(select(Banner).where(Banner.id == banner_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="横幅不存在")
    await db.delete(b)
    await db.commit()
    return {"message": "删除成功"}
