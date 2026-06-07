"""Admin article management routes."""
import math
import re
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime

from ...core.database import get_session
from ...core.security import get_admin_user
from ...core.wechat import fetch_mp_published_articles, fetch_article_meta_from_url
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
        "has_content": bool(getattr(a, "content", None)),
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
    if result["total"] == 0:
        # 微信 freepublish/material 接口只能列出「通过发布接口发布」或「永久素材草稿」的图文，
        # 公众号后台手动群发/发表的文章微信不提供 API 列出（见 core.wechat 注释），故返回 0 篇。
        # 不报错（调用本身成功），但如实告知并引导改用「粘贴链接导入」。
        return {
            "message": "未拉取到文章。微信接口只能同步「通过发布接口发布」的图文，"
                       "公众号后台手动群发的文章无法列出，请改用右侧「粘贴链接导入」。",
            **result,
        }
    return {
        "message": f"同步完成：新增 {result['created']} 篇，更新 {result['updated']} 篇",
        **result,
    }


async def _upsert_fetched_article(db: AsyncSession, art: dict) -> str:
    """把一篇归一化文章 upsert 进库，返回 'created' / 'updated' / 'skipped'。

    按 source_id（公众号永久链接 key）去重，与 sync_articles_from_mp 一致。
    """
    sid = art.get("source_id")
    if not sid:
        return "skipped"
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
        if art.get("content"):
            row.content = art["content"]
        if pub:
            row.published_at = pub
        return "updated"
    db.add(Article(
        title=art["title"], summary=art["summary"],
        content=art.get("content") or None,
        cover_image=art["cover_image"], mp_url=art["mp_url"],
        published_at=pub, source="wechat_mp", source_id=sid,
        is_home_show=False, sort_order=0,
    ))
    return "created"


@router.post("/import-from-url")
async def import_from_url(
    body: dict,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """粘贴公众号文章永久链接导入（支持多条，换行/空格分隔）。

    适用于「群发」发出、freepublish 接口拉不到的历史文章。
    """
    raw = (body or {}).get("urls") or (body or {}).get("url") or ""
    urls = [u.strip() for u in re.split(r"[\s\n]+", str(raw)) if u.strip()]
    if not urls:
        raise HTTPException(status_code=400, detail="请粘贴至少一条公众号文章链接")
    if len(urls) > 30:
        raise HTTPException(status_code=400, detail="单次最多导入 30 条链接")

    created = updated = 0
    failed: list[dict] = []
    for u in urls:
        try:
            art = await fetch_article_meta_from_url(u)
            result = await _upsert_fetched_article(db, art)
            if result == "created":
                created += 1
            elif result == "updated":
                updated += 1
        except HTTPException as e:
            failed.append({"url": u, "reason": e.detail})
        except Exception as e:  # noqa: BLE001 抓取/解析意外错误兜底，不中断整批
            failed.append({"url": u, "reason": str(e)})
    await db.commit()

    parts = [f"新增 {created} 篇", f"更新 {updated} 篇"]
    if failed:
        parts.append(f"失败 {len(failed)} 条")
    return {
        "message": "导入完成：" + "，".join(parts),
        "created": created, "updated": updated,
        "failed": failed, "total": len(urls),
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
        content=body.get("content") or None,
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

    editable = {"title", "summary", "content", "cover_image", "mp_url", "is_home_show", "sort_order"}
    for k, v in body.items():
        if k in editable:
            if k == "published_at" and v:
                a.published_at = date.fromisoformat(v)
            else:
                setattr(a, k, v)
    await db.commit()
    return {"message": "更新成功"}


@router.post("/{article_id}/refetch-content")
async def refetch_article_content(
    article_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """重新抓取该文章公众号原文正文（用于补全历史文章的全文内容）。"""
    a = (await db.execute(select(Article).where(Article.id == article_id))).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="文章不存在")
    if not a.mp_url:
        raise HTTPException(status_code=400, detail="该文章无公众号原文链接，无法抓取正文")
    art = await fetch_article_meta_from_url(a.mp_url)
    a.title = art["title"] or a.title
    a.summary = art["summary"] or a.summary
    a.cover_image = art["cover_image"] or a.cover_image
    if art.get("content"):
        a.content = art["content"]
    await db.commit()
    return {
        "message": "正文抓取完成" if art.get("content") else "未抓取到正文（链接可能已失效）",
        "has_content": bool(art.get("content")),
        "content_length": len(art.get("content") or ""),
    }


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
