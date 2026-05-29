"""Admin file upload routes — images & attachments stored to local /picture mount."""
import uuid
import os
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from ...core.config import settings
from ...core.security import get_admin_user

router = APIRouter()

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
DOC_TYPES = {
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip", "application/x-zip-compressed",
    "text/plain",
}
ALLOWED_TYPES = IMAGE_TYPES | DOC_TYPES
MAX_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    admin: dict = Depends(get_admin_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file.content_type}")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 20MB")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename else "bin"
    filename = f"{uuid.uuid4().hex}.{ext}"
    is_image = file.content_type in IMAGE_TYPES

    today = date.today()
    sub = "upload" if is_image else "attachments"
    rel_dir = Path(sub) / str(today.year) / f"{today.month:02d}"
    storage_dir = Path(settings.IMAGE_STORAGE_PATH) / rel_dir
    os.makedirs(storage_dir, exist_ok=True)

    file_path = storage_dir / filename
    file_path.write_bytes(content)

    url = f"{settings.IMAGE_BASE_URL}/{rel_dir.as_posix()}/{filename}" if settings.IMAGE_BASE_URL else str(file_path)

    return {
        "url": url,
        "filename": file.filename or filename,
        "size": len(content),
        "type": "image" if is_image else "document",
    }
