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
    if user.get("role") not in ("admin", "agent", "leader", "content_manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无管理后台访问权限")
    return user


# 角色权限映射
ROLE_PERMISSIONS = {
    "admin": ["*"],  # 全部权限
    "leader": ["dashboard", "users", "properties", "demands", "articles", "banners", "crawler", "communities", "data-audit"],  # 全部模块只读
    "content_manager": ["articles", "banners", "crawler"],  # 仅内容管理相关模块
    "agent": ["dashboard", "users", "demands"],  # 代理商权限
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
