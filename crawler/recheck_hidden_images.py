"""复检：对当前 hidden=1 且 reason in (logo,solid) 的图片用最新过滤器重判，
若新规则认为正常（户型图/图纸等被误判），则恢复 hidden=0。
banner/qrcode 不动（这两类判据可靠）。
用法：python -m crawler.recheck_hidden_images [--commit]
"""
import sys, asyncio
import httpx
from sqlalchemy import select, update
from crawler.pipelines.junk_image_filter import detect_junk
from crawler.storage.db import get_session
from app.models.property import PropertyImage

COMMIT = "--commit" in sys.argv
CONCURRENCY = 24


async def main():
    db = await get_session()
    sem = asyncio.Semaphore(CONCURRENCY)
    rechecked = unhid = failed = still = 0
    async with httpx.AsyncClient(timeout=20, verify=False) as client:
        async def check_one(img):
            nonlocal failed
            async with sem:
                try:
                    r = await client.get(img.image_url)
                    if r.status_code != 200:
                        failed += 1
                        return None
                    return detect_junk(r.content)
                except Exception:
                    failed += 1
                    return None
        try:
            q = select(PropertyImage).where(
                PropertyImage.hidden == 1,
                PropertyImage.hide_reason.in_(["logo", "solid"]),
            )
            rows = (await db.execute(q)).scalars().all()
            print(f"待复检(logo/solid): {len(rows)}  commit={COMMIT}", flush=True)
            BATCH = 200
            to_unhide = []
            for start in range(0, len(rows), BATCH):
                batch = rows[start:start + BATCH]
                reasons = await asyncio.gather(*[check_one(im) for im in batch])
                for im, reason in zip(batch, reasons):
                    rechecked += 1
                    if reason is None:
                        to_unhide.append(im.id)
                        unhid += 1
                    else:
                        still += 1
                if COMMIT and to_unhide:
                    for iid in to_unhide:
                        await db.execute(update(PropertyImage).where(PropertyImage.id == iid)
                                         .values(hidden=0, hide_reason=None))
                    await db.commit()
                    to_unhide = []
                print(f"  进度 {rechecked}/{len(rows)} 恢复{unhid} 仍垃圾{still} 失败{failed}", flush=True)
            print(f"\n完成：复检{rechecked} 恢复{unhid} 仍判垃圾{still} 失败{failed}", flush=True)
            if not COMMIT:
                print("(dry-run 未写库)", flush=True)
        finally:
            await db.close()


asyncio.run(main())
