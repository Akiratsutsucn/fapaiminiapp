"""存量清洗 v2：并发下载(走 https 域名，比 cosfs 顺序读快很多) + 分批写库。

对已入库图片跑垃圾检测，命中则标 hidden=1（保守，不删文件）。
用法：python -m crawler.backfill_junk_images [--commit] [--limit N] [--concurrency C]
默认 dry-run；--commit 才写库。每批 200 张提交一次，断了也不丢进度。
"""
import sys, asyncio
import httpx
from sqlalchemy import select, update
from crawler.pipelines.junk_image_filter import detect_junk
from crawler.storage.db import get_session
from app.models.property import PropertyImage

COMMIT = "--commit" in sys.argv
LIMIT = 0
CONCURRENCY = 16
for i, a in enumerate(sys.argv):
    if a == "--limit" and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])
    if a == "--concurrency" and i + 1 < len(sys.argv):
        CONCURRENCY = int(sys.argv[i + 1])

BATCH = 200


async def main():
    db = await get_session()
    sem = asyncio.Semaphore(CONCURRENCY)
    stats = {"qrcode": 0, "banner": 0, "logo": 0, "solid": 0}
    checked = total_junk = failed = 0

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
            q = select(PropertyImage).where(PropertyImage.hidden == 0)
            if LIMIT:
                q = q.limit(LIMIT)
            rows = (await db.execute(q)).scalars().all()
            print(f"待检测: {len(rows)} 张  commit={COMMIT} 并发={CONCURRENCY}", flush=True)

            for start in range(0, len(rows), BATCH):
                batch = rows[start:start + BATCH]
                reasons = await asyncio.gather(*[check_one(im) for im in batch])
                to_hide = []
                for im, reason in zip(batch, reasons):
                    checked += 1
                    if reason:
                        stats[reason] = stats.get(reason, 0) + 1
                        total_junk += 1
                        to_hide.append((im.id, reason))
                if COMMIT and to_hide:
                    for iid, reason in to_hide:
                        await db.execute(update(PropertyImage).where(PropertyImage.id == iid)
                                         .values(hidden=1, hide_reason=reason))
                    await db.commit()
                print(f"  进度 {checked}/{len(rows)}  累计垃圾{total_junk} 下载失败{failed} {stats}", flush=True)

            print(f"\n完成：检查{checked} 垃圾{total_junk} 失败{failed} 明细{stats}", flush=True)
            if not COMMIT:
                print("(dry-run 未写库)", flush=True)
        finally:
            await db.close()


asyncio.run(main())
