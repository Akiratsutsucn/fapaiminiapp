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
    # 登录方式:admin 用用户名「admin」(nickname)登录;其余后台角色(领导/内容管理员)
    # 用「手机号 + 密码」登录。先按用户名找 admin,找不到再按手机号找。
    ident = (req.username or "").strip()
    user = None
    if ident == "admin":
        result = await db.execute(select(User).where(User.nickname == "admin"))
        user = result.scalar_one_or_none()
    if user is None:
        result = await db.execute(select(User).where(User.phone == ident))
        user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="账号或密码错误")

    if not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")

    # 仅 admin / leader / content_manager 可登录管理后台。
    # 代理商/业务员/客户仅小程序使用,不能登录后台。
    if user.role not in ("admin", "leader", "content_manager"):
        raise HTTPException(status_code=403, detail="无管理后台访问权限")

    token_data = {"sub": str(user.id), "openid": user.openid, "role": user.role}
    access_token = create_access_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token="",
        user_info=UserInfo.model_validate(user),
    )
