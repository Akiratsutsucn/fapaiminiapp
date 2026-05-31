"""WeChat Mini-Program server-side APIs.

Provides cached access_token retrieval and wxacode (unlimited) generation.
Token is persisted in system_settings table to survive process restarts.
"""
import json
import time

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from ..models.system_setting import SystemSetting


WX_TOKEN_KEY = "wx_access_token"
WX_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token"
WX_WXACODE_URL = "https://api.weixin.qq.com/wxa/getwxacodeunlimit"

# 公众号（official account）相关
WX_MP_TOKEN_KEY = "wx_mp_access_token"
WX_MP_FREEPUBLISH_URL = "https://api.weixin.qq.com/cgi-bin/freepublish/batchget"
WX_MP_MATERIAL_URL = "https://api.weixin.qq.com/cgi-bin/material/batchget_material"

TOKEN_SAFETY_WINDOW = 300  # refresh 5 min before nominal expiry


async def _load_cached_token(db: AsyncSession, key: str = WX_TOKEN_KEY) -> tuple[str, int] | None:
    row = (await db.execute(select(SystemSetting).where(SystemSetting.key == key))).scalar_one_or_none()
    if not row or not row.value:
        return None
    try:
        data = json.loads(row.value)
        return data["token"], int(data["expire_at"])
    except (json.JSONDecodeError, KeyError, ValueError):
        return None


async def _store_token(db: AsyncSession, token: str, expire_at: int, key: str = WX_TOKEN_KEY, desc: str = "微信小程序 access_token 缓存") -> None:
    payload = json.dumps({"token": token, "expire_at": expire_at})
    row = (await db.execute(select(SystemSetting).where(SystemSetting.key == key))).scalar_one_or_none()
    if row:
        row.value = payload
    else:
        db.add(SystemSetting(key=key, value=payload, description=desc))
    await db.commit()


async def get_wx_access_token(db: AsyncSession) -> str:
    """Return a valid access_token, refreshing from WeChat if cached one is near expiry."""
    cached = await _load_cached_token(db)
    now = int(time.time())
    if cached and cached[1] - TOKEN_SAFETY_WINDOW > now:
        return cached[0]

    if not settings.WECHAT_APPSECRET or settings.WECHAT_APPSECRET == "change-me":
        raise HTTPException(status_code=500, detail="WECHAT_APPSECRET 未配置")

    params = {
        "grant_type": "client_credential",
        "appid": settings.WECHAT_APPID,
        "secret": settings.WECHAT_APPSECRET,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(WX_TOKEN_URL, params=params)
        data = resp.json()

    token = data.get("access_token")
    expires_in = data.get("expires_in")
    if not token or not expires_in:
        raise HTTPException(
            status_code=502,
            detail=f"微信 access_token 获取失败: {data.get('errmsg', data)}",
        )

    expire_at = now + int(expires_in)
    await _store_token(db, token, expire_at)
    return token


async def get_wxacode_unlimit(
    db: AsyncSession,
    scene: str,
    page: str = "pages/index/index",
    env_version: str | None = None,
    width: int = 280,
) -> bytes:
    """Generate an unlimited mini-program QR code (PNG bytes).

    scene: max 32 chars, will be passed via the launch path query string.
    page:  mini-program page path (must be a registered, non-tab page in app.json).
    env_version: 'release' | 'trial' | 'develop' — controls which version's path resolves.
                 Defaults to settings.WECHAT_ENV_VERSION (trial 体验版，发布上线后改 release).
    """
    if len(scene) > 32:
        raise HTTPException(status_code=400, detail="scene 不能超过 32 个字符")

    env = env_version or settings.WECHAT_ENV_VERSION
    token = await get_wx_access_token(db)
    body = {
        "scene": scene,
        "page": page,
        "check_path": env == "release",
        "env_version": env,
        "width": width,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{WX_WXACODE_URL}?access_token={token}",
            json=body,
        )

    content_type = resp.headers.get("content-type", "")
    if "image" in content_type:
        return resp.content

    # Failure responses come back as JSON
    try:
        err = resp.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"微信小程序码生成失败: {resp.text[:200]}")
    raise HTTPException(
        status_code=502,
        detail=f"微信小程序码生成失败: errcode={err.get('errcode')}, errmsg={err.get('errmsg')}",
    )


# ========== 公众号（official account）==========

async def get_mp_access_token(db: AsyncSession) -> str:
    """获取公众号 access_token，缓存于 system_settings（与小程序 token 隔离）。

    需先在公众号后台「IP白名单」加入本服务器出口 IP，否则微信返回 errcode 40164。
    """
    cached = await _load_cached_token(db, WX_MP_TOKEN_KEY)
    now = int(time.time())
    if cached and cached[1] - TOKEN_SAFETY_WINDOW > now:
        return cached[0]

    if not settings.WECHAT_MP_APPID or not settings.WECHAT_MP_APPSECRET:
        raise HTTPException(status_code=500, detail="WECHAT_MP_APPID/WECHAT_MP_APPSECRET 未配置")

    params = {
        "grant_type": "client_credential",
        "appid": settings.WECHAT_MP_APPID,
        "secret": settings.WECHAT_MP_APPSECRET,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(WX_TOKEN_URL, params=params)
        data = resp.json()

    token = data.get("access_token")
    expires_in = data.get("expires_in")
    if not token or not expires_in:
        raise HTTPException(
            status_code=502,
            detail=f"公众号 access_token 获取失败: errcode={data.get('errcode')}, errmsg={data.get('errmsg')}"
                   "（若 errcode=40164 请把服务器 IP 加入公众号后台 IP白名单）",
        )

    expire_at = now + int(expires_in)
    await _store_token(db, token, expire_at, WX_MP_TOKEN_KEY, "微信公众号 access_token 缓存")
    return token


def _normalize_mp_item(article_id: str, news: dict, update_time: int | None) -> dict:
    """把公众号一篇图文统一成 article 字段映射。

    freepublish 与 material 接口的 news_item 字段一致：
    title / author / digest / content_source_url / url / thumb_url / thumb_media_id。
    """
    return {
        "source_id": article_id,
        "title": (news.get("title") or "").strip(),
        "summary": (news.get("digest") or "").strip()[:512],
        "cover_image": news.get("thumb_url") or "",
        "mp_url": news.get("url") or news.get("content_source_url") or "",
        "update_time": update_time,
    }


async def fetch_mp_published_articles(db: AsyncSession, limit: int = 40) -> list[dict]:
    """拉取公众号已群发文章，返回归一化后的文章列表。

    优先用 freepublish/batchget（发布能力，返回已发布图文），
    失败（如未开通发布能力）降级到 material/batchget_material（永久素材 type=news）。
    每篇多图文只取主条（news_item[0]），并以 article_id+索引去重。
    """
    token = await get_mp_access_token(db)
    out: list[dict] = []

    # 1. 优先 freepublish/batchget
    async with httpx.AsyncClient(timeout=15.0) as client:
        offset = 0
        page_size = min(20, limit)
        while len(out) < limit:
            body = {"offset": offset, "count": page_size, "no_content": 1}
            resp = await client.post(f"{WX_MP_FREEPUBLISH_URL}?access_token={token}", json=body)
            data = resp.json()
            errcode = data.get("errcode", 0)
            if errcode and errcode != 0:
                logger_msg = f"freepublish errcode={errcode} errmsg={data.get('errmsg')}"
                # 发布能力未开通/无权限 → 跳出走降级
                break
            items = data.get("item", [])
            if not items:
                break
            for it in items:
                aid = str(it.get("article_id", ""))
                news_list = (it.get("content") or {}).get("news_item", [])
                upd = it.get("update_time")
                for idx, news in enumerate(news_list[:1]):  # 只取主条
                    norm = _normalize_mp_item(f"{aid}_{idx}" if idx else aid, news, upd)
                    if norm["title"]:
                        out.append(norm)
            if len(items) < page_size:
                break
            offset += page_size
        if out:
            return out[:limit]

    # 2. 降级：material/batchget_material（永久图文素材）
    async with httpx.AsyncClient(timeout=15.0) as client:
        offset = 0
        page_size = min(20, limit)
        while len(out) < limit:
            body = {"type": "news", "offset": offset, "count": page_size}
            resp = await client.post(f"{WX_MP_MATERIAL_URL}?access_token={token}", json=body)
            data = resp.json()
            errcode = data.get("errcode", 0)
            if errcode and errcode != 0:
                raise HTTPException(
                    status_code=502,
                    detail=f"公众号文章拉取失败: errcode={errcode}, errmsg={data.get('errmsg')}",
                )
            items = data.get("item", [])
            if not items:
                break
            for it in items:
                mid = str(it.get("media_id", ""))
                news_list = (it.get("content") or {}).get("news_item", [])
                upd = it.get("update_time") or (it.get("content") or {}).get("update_time")
                for idx, news in enumerate(news_list[:1]):
                    norm = _normalize_mp_item(f"{mid}_{idx}" if idx else mid, news, upd)
                    if norm["title"]:
                        out.append(norm)
            if len(items) < page_size:
                break
            offset += page_size

    return out[:limit]
