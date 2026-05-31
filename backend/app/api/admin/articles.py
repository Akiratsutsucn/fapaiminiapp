"""Admin article management routes."""
import math
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime

from ...core.database import get_session
from ...core.security import get_admin_user
from ...core.wechat import fetch_mp_published_articles
from ...models.article import Article
from ...schemas import PaginatedResponse

router = APIRouter()


async def sync_articles_from_mp(db: AsyncSession, limit: int = 40) -> dict:
    """从公众号拉取已群发文章并入库（手动按钮与定时任务共用）。

    按 source_id 去重：已存在则更新标题/摘要/封面/链接，不存在则新建。
    返回 {created, updated, total}。
    """
    fetched = await fetch_mp_published_articles(db, limit=limit)
    created = updated = 0
    for art in fetched:
        sid = art.get("source_id")
        if not sid:
            continue
        row = (await db.execute(
            select(Article).where(Article.source_id == sid, Article.source == "wechat_mp")
        )).scalar_one_or_none()
        pub = None
        if art.get("update_time"):
            try:
                pub = datetime.fromtimestamp(int(art["update_time"])).date()
            except (ValueError, OSError):
                pub = None
        if row:
            row.title = art["title"] or row.title
            row.summary = art["summary"] or row.summary
            row.cover_image = art["cover_image"] or row.cover_image
            row.mp_url = art["mp_url"] or row.mp_url
            if pub:
                row.published_at = pub
            updated += 1
        else:
            db.add(Article(
                title=art["title"], summary=art["summary"],
                cover_image=art["cover_image"], mp_url=art["mp_url"],
                published_at=pub, source="wechat_mp", source_id=sid,
                is_home_show=False, sort_order=0,
            ))
            created += 1
    await db.commit()
    return {"created": created, "updated": updated, "total": len(fetched)}


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
        "source": getattr(a, "source", "manual"),
        "published_at": str(a.published_at) if a.published_at else None,
        "created_at": str(a.created_at),
    } for a in rows]

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/sync-from-mp")
async def sync_from_mp(
    body: dict | None = None,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """从公众号「拍来盟科技」同步已群发文章到文章管理。"""
    limit = int((body or {}).get("limit", 40))
    limit = max(1, min(limit, 100))
    result = await sync_articles_from_mp(db, limit=limit)
    return {
        "message": f"同步完成：新增 {result['created']} 篇，更新 {result['updated']} 篇",
        **result,
    }


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
