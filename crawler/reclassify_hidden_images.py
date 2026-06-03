"""复检所有 hidden=1 的图片：用最新 detect_junk 重新判定，
现在判为 None（真实照片，主要是 140-199px 被旧规则误杀的小照片）的，恢复 hidden=0。

用法：python -m crawler.reclassify_hidden_images [--commit]
"""
import sys, asyncio
from pathlib import Path
from sqlalchemy import select, update
from crawler.storage.db import get_session
from crawler.config import settings
from crawler.pipelines.junk_image_filter import detect_junk
from app.models.property import PropertyImage

COMMIT = "--commit" in sys.argv


def url_to_path(url: str) -> Path:
    rel = url.split("/images/properties/")[-1]
    return Path(settings.IMAGE_STORAGE_PATH) / "properties" / rel


async def main():
    db = await get_session()
    try:
        rows = (await db.execute(
            select(PropertyImage.id, PropertyImage.image_url, PropertyImage.hide_reason)
            .where(PropertyImage.hidden == 1)
        )).all()
        print(f"待复检隐藏图: {len(rows)}  commit={COMMIT}", flush=True)

        unhide_ids = []
        changed_reason = {}  # reason 改变（如 logo->banner）暂不动，只关心 ->None
        missing = 0
        for iid, url, reason in rows:
            p = url_to_path(url)
            if not p.exists():
                missing += 1
                continue
            try:
                new = detect_junk(p.read_bytes())
            except Exception:
                continue
            if new is None:
                unhide_ids.append(iid)

        print(f"现判为真实照片(可恢复显示): {len(unhide_ids)}  文件缺失: {missing}", flush=True)

        if COMMIT and unhide_ids:
            # 批量恢复
            B = 500
            for i in range(0, len(unhide_ids), B):
                chunk = unhide_ids[i:i + B]
                await db.execute(
                    update(PropertyImage)
                    .where(PropertyImage.id.in_(chunk))
                    .values(hidden=0, hide_reason=None)
                )
            await db.commit()
            print(f"已恢复 {len(unhide_ids)} 张图片显示", flush=True)
        elif not COMMIT:
            print("(dry-run 未写库)", flush=True)
    finally:
        await db.close()


asyncio.run(main())
