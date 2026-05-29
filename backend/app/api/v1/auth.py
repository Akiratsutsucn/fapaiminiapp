"""Auth routes — WeChat login."""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.config import settings
from ...core.security import create_access_token, create_refresh_token, get_current_user
from ...models.user import User
from ...schemas import LoginRequest, TokenResponse, UserInfo

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def wx_login(req: LoginRequest, db: AsyncSession = Depends(get_session)):
    # Exchange code for openid via WeChat API
    wx_url = (
        f"https://api.weixin.qq.com/sns/jscode2session"
        f"?appid={settings.WECHAT_APPID}&secret={settings.WECHAT_APPSECRET}&js_code={req.code}"
        f"&grant_type=authorization_code"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.get(wx_url)
        wx_data = resp.json()

    openid = wx_data.get("openid")
    if not openid:
        raise HTTPException(status_code=400, detail=f"微信登录失败: {wx_data.get('errmsg', '未知错误')}")

    # Find or create user
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.openid == openid))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            openid=openid,
            nickname=req.nickname or "",
            avatar_url=req.avatar_url,
        )
        db.add(user)
        await db.flush()
    else:
        # 仅当前端传入新数据时才覆写，避免抹掉用户已编辑过的资料
        if req.nickname:
            user.nickname = req.nickname
        if req.avatar_url:
            user.avatar_url = req.avatar_url
        if not user.nickname:
            user.nickname = ""

    await db.commit()

    token_data = {"sub": str(user.id), "openid": openid, "role": user.role or "customer"}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_info=UserInfo.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_session)):
    from ...core.security import decode_token
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="令牌类型错误")

    openid = payload.get("openid")
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.openid == openid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    token_data = {"sub": str(user.id), "openid": openid, "role": user.role or "customer"}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user_info=UserInfo.model_validate(user),
    )


@router.get("/me", response_model=UserInfo)
async def get_me(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == int(user_data["sub"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return UserInfo.model_validate(user)
