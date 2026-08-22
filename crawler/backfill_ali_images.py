"""补图：为缺少可见图片的在拍房源重新抓取并下载图片。

针对详情抓取失败/图片下载限流(阿里 img.alicdn.com 420)导致首轮没存到图的房源，
重新跑详情解析+下载图片。阿里走 IMAGE_PROXY 住宅代理规避420;京东直连。

候选口径:状态为「即将开拍/进行中」且无任何可见图(原口径 auction_start_time>now
漏掉所有「进行中」房源——它们已开拍但仍需图)。

用法：
  python -m crawler.backfill_ali_images [--commit] [--limit N] [--city-id 371300]
                                        [--platform 阿里拍卖|京东拍卖]
"""
import sys, re, asyncio
from sqlalchemy import select, func
from loguru import logger

from crawler.storage.db import get_session
from crawler.config import settings
from crawler.browser import browser_manager
from crawler.platforms.taobao_paimai import TaobaoPaiMaiCrawler
from crawler.parsers.taobao_paimai_detail import TaobaoPaiMaiDetailParser
from crawler.platforms.jd import JDAuctionCrawler
from crawler.parsers.jd_detail import JDDetailParser
from crawler.pipelines.image_processor import ImageProcessor, select_valid_images, IMG_CANDIDATE_LIMIT
from crawler.pipelines.local_storage import LocalStorage
from crawler.storage.repository import PropertyImageRepository
from app.models.property import Property, PropertyImage

COMMIT = "--commit" in sys.argv
LIMIT = 0
CITY_ID = 0
PLATFORM = "阿里拍卖"
for i, a in enumerate(sys.argv):
    if a == "--limit" and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])
    if a == "--city-id" and i + 1 < len(sys.argv):
        CITY_ID = int(sys.argv[i + 1])
    if a == "--platform" and i + 1 < len(sys.argv):
        PLATFORM = sys.argv[i + 1]


def extract_item_id(source_url: str) -> str | None:
    m = re.search(r"itemId=(\d+)", source_url) or re.search(r"id=(\d+)", source_url) \
        or re.search(r"/(\d{8,})", source_url)
    return m.group(1) if m else None


async def main():
    db = await get_session()
    if PLATFORM == "京东拍卖":
        img_proc = ImageProcessor(extra_headers={}, cookies_str="", proxy=None)
        crawler = JDAuctionCrawler()
        parser = JDDetailParser()
        need_browser = False
    else:
        proxy = settings.IMAGE_PROXY or settings.GPAI_PROXY
        img_proc = ImageProcessor(
            extra_headers={"Referer": "https://pages-fast.m.taobao.com/"},
            cookies_str=settings.TAOBAO_COOKIE,
            proxy=proxy,
        )
        crawler = TaobaoPaiMaiCrawler()
        parser = TaobaoPaiMaiDetailParser()
        need_browser = True
    storage = LocalStorage(base_path=settings.IMAGE_STORAGE_PATH, base_url=settings.IMAGE_BASE_URL)

    if need_browser:
        await browser_manager.start()
    try:
        # 在拍(即将开拍/进行中)、但无可见图片的房源(--city-id 可限定城市,如临沂371300)
        _conds = [
            Property.auction_platform == PLATFORM,
            Property.auction_status.in_(("即将开拍", "进行中")),
            Property.is_deleted == 0,
        ]
        if CITY_ID:
            _conds.append(Property.city_id == CITY_ID)
        sub = (
            select(Property.id)
            .outerjoin(PropertyImage, (PropertyImage.property_id == Property.id) & (PropertyImage.hidden == 0))
            .where(*_conds)
            .group_by(Property.id)
            .having(func.count(PropertyImage.id) == 0)
        )
        ids = [r[0] for r in (await db.execute(sub)).all()]
        if LIMIT:
            ids = ids[:LIMIT]
        print(f"待补图{PLATFORM}房源(city={CITY_ID or '全部'}): {len(ids)}  commit={COMMIT}", flush=True)

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
            # 房源图规则(全城市统一):多取候选(前10张)下载,过滤脏图后取前3张有效图
            processed = await img_proc.process_batch(img_urls[:IMG_CANDIDATE_LIMIT], generate_thumbs=True, platform=PLATFORM)
            valid = select_valid_images(processed)  # 过滤脏图(junk/<2KB/md5黑名单)+取前3张
            saved = storage.save_property_images(pid, p.source_url, valid)
            rows = [{
                "image_url": s["oss_url"], "thumb_url": s.get("thumb_url"),
                "sort_order": i, "is_cover": (i == 0),
                "hidden": 0, "hide_reason": None,
            } for i, s in enumerate(saved) if s.get("oss_url")]
            if rows and COMMIT:
                await PropertyImageRepository.batch_upsert(db, pid, rows)
                await db.commit()
            if rows:
                fixed += 1
                print(f"  id={pid} 补图成功 {len(rows)}张 (itemId={item_id})", flush=True)
            else:
                stillempty += 1
                print(f"  id={pid} 仍无有效图(全为图标/占位/脏图)", flush=True)
        print(f"\n完成：补图成功 {fixed} / 仍空 {stillempty} / 详情失败 {nodetail} / 无itemId {noid} / 共 {len(ids)}", flush=True)
        if not COMMIT:
            print("(dry-run 未写库)", flush=True)
    finally:
        await crawler.close()
        if need_browser:
            await browser_manager.stop()
        await db.close()


asyncio.run(main())
