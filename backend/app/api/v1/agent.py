"""Agent routes — invite list, poster."""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.database import get_session
from ...core.security import get_current_user
from ...core.wechat import get_wxacode_unlimit
from ...models.user import User

router = APIRouter()

WXACODE_DIR_NAME = "wxacode"


@router.get("/invite-list")
async def invite_list(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = int(user_data["sub"])
    rows = await db.execute(
        select(User).where(User.inviter_id == uid).order_by(User.created_at.desc())
    )
    users = rows.scalars().all()
    return [
        {"id": u.id, "nickname": u.nickname or "", "avatar_url": u.avatar_url, "created_at": str(u.created_at)}
        for u in users
    ]


@router.get("/poster")
async def get_poster(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = int(user_data["sub"])

    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    storage_dir = Path(settings.IMAGE_STORAGE_PATH) / WXACODE_DIR_NAME
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_path = storage_dir / f"agent_{uid}.png"

    if not file_path.exists():
        scene = f"agent_{uid}"
        png_bytes = await get_wxacode_unlimit(
            db=db,
            scene=scene,
            page="pages/index/index",
        )
        file_path.write_bytes(png_bytes)

    base_url = settings.IMAGE_BASE_URL.rstrip("/")
    qr_url = f"{base_url}/{WXACODE_DIR_NAME}/agent_{uid}.png"
    share_link = f"https://xcxapi.fapaizhelianmeng.cn?inviter={uid}"

    return {
        "qr_url": qr_url,
        "agent_nickname": user.nickname or "法拍经纪人",
        "share_link": share_link,
    }
