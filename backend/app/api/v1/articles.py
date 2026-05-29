"""Article routes for C-end."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...models.article import Article
from ...schemas import ArticleOut

router = APIRouter()


@router.get("", response_model=list[ArticleOut])
async def list_articles(
    db: AsyncSession = Depends(get_session),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = (
        select(Article)
        .order_by(Article.published_at.desc(), Article.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()
    return [ArticleOut.model_validate(r) for r in rows]


@router.get("/recommend", response_model=list[ArticleOut])
async def recommend_articles(
    db: AsyncSession = Depends(get_session),
    limit: int = Query(5, le=20),
):
    q = (
        select(Article)
        .where(Article.is_home_show == True)
        .order_by(Article.sort_order.asc(), Article.published_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    return [ArticleOut.model_validate(r) for r in rows]


@router.get("/{article_id}", response_model=ArticleOut)
async def get_article(article_id: int, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(Article).where(Article.id == article_id))
    r = result.scalar_one_or_none()
    if not r:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="文章不存在")
    return ArticleOut.model_validate(r)
