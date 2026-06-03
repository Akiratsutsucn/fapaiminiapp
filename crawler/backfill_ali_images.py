"""补图：为缺少可见图片的阿里在拍房源重新抓取并下载图片（走 IMAGE_PROXY 住宅代理规避420）。

针对 img.alicdn.com 突发限流导致首轮没存到图的房源，重新跑详情解析+下载图片。
用法：python -m crawler.backfill_ali_images [--commit] [--limit N]
"""
import sys, re, asyncio
from sqlalchemy import select, func
from loguru import logger

from crawler.storage.db import get_session
from crawler.config import settings
from crawler.browser import browser_manager
from crawler.platforms.taobao_paimai import TaobaoPaiMaiCrawler
from crawler.parsers.taobao_paimai_detail import TaobaoPaiMaiDetailParser
from crawler.pipelines.image_processor import ImageProcessor
from crawler.pipelines.local_storage import LocalStorage
from crawler.storage.repository import PropertyImageRepository
from app.models.property import Property, PropertyImage

COMMIT = "--commit" in sys.argv
LIMIT = 0
for i, a in enumerate(sys.argv):
    if a == "--limit" and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])


def extract_item_id(source_url: str) -> str | None:
    m = re.search(r"itemId=(\d+)", source_url) or re.search(r"id=(\d+)", source_url) \
        or re.search(r"/(\d{8,})", source_url)
    return m.group(1) if m else None


async def main():
    db = await get_session()
    proxy = settings.IMAGE_PROXY or settings.GPAI_PROXY
    img_proc = ImageProcessor(
        extra_headers={"Referer": "https://pages-fast.m.taobao.com/"},
        cookies_str=settings.TAOBAO_COOKIE,
        proxy=proxy,
    )
    storage = LocalStorage(base_path=settings.IMAGE_STORAGE_PATH, base_url=settings.IMAGE_BASE_URL)
    crawler = TaobaoPaiMaiCrawler()
    parser = TaobaoPaiMaiDetailParser()

    await browser_manager.start()
    try:
        # 阿里在拍、但无可见图片的房源
        sub = (
            select(Property.id)
            .outerjoin(PropertyImage, (PropertyImage.property_id == Property.id) & (PropertyImage.hidden == 0))
            .where(Property.auction_platform == "阿里拍卖", Property.auction_start_time > func.now())
            .group_by(Property.id)
            .having(func.count(PropertyImage.id) == 0)
        )
        ids = [r[0] for r in (await db.execute(sub)).all()]
        if LIMIT:
            ids = ids[:LIMIT]
        print(f"待补图阿里房源: {len(ids)}  proxy={'on' if proxy else 'off'} commit={COMMIT}", flush=True)

        fixed = stillempty = noid = nodetail = 0
        for pid in ids:
            p = (await db.execute(select(Property).where(Property.id == pid))).scalar_one_or_none()
            if not p or not p.source_url:
                noid += 1
                continue
            item_id = extract_item_id(p.source_url)
            if not item_id:
                noid += 1
                print(f"  id={pid} 无法解析itemId: {p.source_url[:60]}", flush=True)
                continue
            try:
                detail = await crawler.fetch_detail_api(item_id)
            except Exception as e:
                logger.debug(f"id={pid} detail fail: {e}")
                detail = None
            if not detail:
                nodetail += 1
                continue
            try:
                item = await parser.parse(detail, p.source_url, p.city_id or 310000)
            except Exception as e:
                logger.debug(f"id={pid} parse fail: {e}")
                nodetail += 1
                continue
            img_urls = item.image_urls or []
            if not img_urls:
                stillempty += 1
                print(f"  id={pid} 详情无图片URL", flush=True)
                continue
            processed = await img_proc.process_batch(img_urls[:20], generate_thumbs=True, platform="阿里拍卖")
            saved = storage.save_property_images(pid, p.source_url, processed)
            rows = [{
                "image_url": s["oss_url"], "thumb_url": s.get("thumb_url"),
                "sort_order": i, "is_cover": False,
                "hidden": 1 if s.get("junk_reason") else 0, "hide_reason": s.get("junk_reason"),
            } for i, s in enumerate(saved) if s.get("oss_url")]
            # 封面 = 第一张非垃圾图
            for r in rows:
                if not r["hidden"]:
                    r["is_cover"] = True
                    break
            visible = [r for r in rows if not r["hidden"]]
            if rows and visible and COMMIT:
                await PropertyImageRepository.batch_upsert(db, pid, rows)
                await db.commit()
            if visible:
                fixed += 1
                print(f"  id={pid} 补图成功 {len(visible)}可见/{len(rows)}张 (itemId={item_id})", flush=True)
            else:
                stillempty += 1
                print(f"  id={pid} 仍无可见图({len(rows)}张全垃圾/失败)", flush=True)
        print(f"\n完成：补图成功 {fixed} / 仍空 {stillempty} / 详情失败 {nodetail} / 无itemId {noid} / 共 {len(ids)}", flush=True)
        if not COMMIT:
            print("(dry-run 未写库)", flush=True)
    finally:
        await crawler.close()
        await browser_manager.stop()
        await db.close()


asyncio.run(main())
