"""Admin article management routes."""
import math
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from ...core.database import get_session
from ...core.security import get_admin_user
from ...models.article import Article
from ...schemas import PaginatedResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_articles(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
    keyword: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    conditions = []
    if keyword:
        conditions.append(Article.title.contains(keyword))

    base_q = select(func.count(Article.id))
    if conditions:
        base_q = base_q.where(*conditions)
    total = (await db.execute(base_q)).scalar() or 0

    q = select(Article).order_by(Article.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    if conditions:
        q = q.where(*conditions)
    rows = (await db.execute(q)).scalars().all()

    items = [{
        "id": a.id, "title": a.title, "summary": a.summary,
        "cover_image": a.cover_image, "mp_url": a.mp_url,
        "is_home_show": a.is_home_show, "sort_order": a.sort_order,
        "published_at": str(a.published_at) if a.published_at else None,
        "created_at": str(a.created_at),
    } for a in rows]

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post("")
async def create_article(
    body: dict,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    a = Article(
        title=body.get("title", ""),
        summary=body.get("summary", ""),
        cover_image=body.get("cover_image", ""),
        mp_url=body.get("mp_url", ""),
        is_home_show=body.get("is_home_show", False),
        sort_order=body.get("sort_order", 0),
        published_at=date.fromisoformat(body["published_at"]) if body.get("published_at") else None,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return {"message": "创建成功", "id": a.id}


@router.put("/{article_id}")
async def update_article(
    article_id: int,
    body: dict,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="文章不存在")

    editable = {"title", "summary", "cover_image", "mp_url", "is_home_show", "sort_order"}
    for k, v in body.items():
        if k in editable:
            if k == "published_at" and v:
                a.published_at = date.fromisoformat(v)
            else:
                setattr(a, k, v)
    await db.commit()
    return {"message": "更新成功"}


@router.delete("/{article_id}")
async def delete_article(
    article_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="文章不存在")
    await db.delete(a)
    await db.commit()
    return {"message": "删除成功"}
