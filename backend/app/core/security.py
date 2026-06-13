"""JWT token creation / verification / refresh."""
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_scheme = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效令牌")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="令牌类型错误")
    return payload


async def get_admin_user(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    # 仅 admin / leader / content_manager 可访问管理后台。
    # 代理商(agent)、业务员(salesperson)、客户(customer)仅小程序使用,不能登录后台。
    if user.get("role") not in ("admin", "leader", "content_manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无管理后台访问权限")
    return user


# 角色权限映射(模块级)。仅后台角色:
#   admin           = 全部权限
#   leader          = 全部模块只读(可看,不可改,由 check_write_permission 拦截写操作)
#   content_manager = 仅文章、横幅
ROLE_PERMISSIONS = {
    "admin": ["*"],
    "leader": ["dashboard", "users", "properties", "demands", "articles", "banners", "crawler", "communities", "data-audit"],
    "content_manager": ["articles", "banners"],
}


def check_module_permission(module: str):
    """检查当前用户是否有权访问指定模块"""
    async def dependency(user: dict[str, Any] = Depends(get_admin_user)) -> dict[str, Any]:
        role = user.get("role", "")
        allowed_modules = ROLE_PERMISSIONS.get(role, [])

        # admin有全部权限
        if "*" in allowed_modules:
            return user

        # 检查模块权限
        if module not in allowed_modules:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问此模块")

        return user
    return dependency


def check_write_permission():
    """检查当前用户是否有写权限（leader角色只读）"""
    async def dependency(user: dict[str, Any] = Depends(get_admin_user)) -> dict[str, Any]:
        role = user.get("role", "")

        # leader角色只读，不能进行写操作
        if role == "leader":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="您是只读角色，无权进行此操作")

        return user
    return dependency
