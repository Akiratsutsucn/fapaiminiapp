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

TOKEN_SAFETY_WINDOW = 300  # refresh 5 min before nominal expiry


async def _load_cached_token(db: AsyncSession) -> tuple[str, int] | None:
    row = (await db.execute(select(SystemSetting).where(SystemSetting.key == WX_TOKEN_KEY))).scalar_one_or_none()
    if not row or not row.value:
        return None
    try:
        data = json.loads(row.value)
        return data["token"], int(data["expire_at"])
    except (json.JSONDecodeError, KeyError, ValueError):
        return None


async def _store_token(db: AsyncSession, token: str, expire_at: int) -> None:
    payload = json.dumps({"token": token, "expire_at": expire_at})
    row = (await db.execute(select(SystemSetting).where(SystemSetting.key == WX_TOKEN_KEY))).scalar_one_or_none()
    if row:
        row.value = payload
    else:
        db.add(SystemSetting(key=WX_TOKEN_KEY, value=payload, description="微信小程序 access_token 缓存"))
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
