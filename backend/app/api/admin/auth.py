"""Admin auth routes — username/password login for B-end."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.security import create_access_token, pwd_context
from ...models.user import User
from ...schemas import AdminLoginRequest, TokenResponse, UserInfo

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def admin_login(req: AdminLoginRequest, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(User).where(User.nickname == req.username))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    # 只允许admin、agent、leader、content_manager登录管理后台
    # salesperson和customer不能登录
    if user.role not in ("admin", "agent", "leader", "content_manager"):
        raise HTTPException(status_code=403, detail="无管理后台访问权限")

    token_data = {"sub": str(user.id), "openid": user.openid, "role": user.role}
    access_token = create_access_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token="",
        user_info=UserInfo.model_validate(user),
    )
