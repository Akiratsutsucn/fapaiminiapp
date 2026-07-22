"""临沂定向渲染抓图：不依赖SSR initData，直接从渲染后的页面收集阿里CDN图下载。
根因：fetch_detail_api骨架时没收集页面img，但这些房源详情页实际有28-66张阿里CDN图。"""
import asyncio, re, sys
from sqlalchemy import select, func
from crawler.browser import browser_manager
from crawler.storage.db import get_session
from crawler.config import settings
from crawler.pipelines.image_processor import ImageProcessor
from crawler.pipelines.local_storage import LocalStorage
from crawler.storage.repository import PropertyImageRepository
from app.models.property import Property, PropertyImage

CDN_RE = re.compile(r'https?://[^"\s]+\.(?:jpg|webp|png|jpeg)', re.I)
COMMIT = "--commit" in sys.argv


async def main():
    db = await get_session()
    img_proc = ImageProcessor(
        extra_headers={"Referer": "https://pages-fast.m.taobao.com/"},
        cookies_str=settings.TAOBAO_COOKIE,
        proxy=settings.IMAGE_PROXY or settings.GPAI_PROXY,
    )
    storage = LocalStorage(base_path=settings.IMAGE_STORAGE_PATH, base_url=settings.IMAGE_BASE_URL)
    sub = (
        select(Property.id, Property.source_url)
        .outerjoin(PropertyImage, (PropertyImage.property_id == Property.id) & (PropertyImage.hidden == 0))
        .where(
            Property.city_id == 371300, Property.is_deleted == 0,
            Property.auction_status.in_(["即将开拍", "进行中"]),
            Property.auction_platform == "阿里拍卖",
        )
        .group_by(Property.id)
        .having(func.count(PropertyImage.id) == 0)
    )
    rows = (await db.execute(sub)).all()
    print(f"临沂缺图房源: {len(rows)} commit={COMMIT}", flush=True)

    await browser_manager.start()
    ctx = await browser_manager.new_isolated_context()
    for pair in (settings.TAOBAO_COOKIE or "").split(";"):
        if "=" in pair:
            n, v = pair.split("=", 1)
            await ctx.add_cookies([{"name": n.strip(), "value": v.strip(), "domain": ".taobao.com", "path": "/"}])
    page = await ctx.new_page()
    fixed = 0
    for pid, source_url in rows:
        m = re.search(r"itemId=(\d+)", source_url or "")
        if not m:
            continue
        url = f"https://pages-fast.m.taobao.com/wow/z/app/pm/dzc-ice/dzc-detail?x-ssr=true&itemId={m.group(1)}"
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(10)
            html = await page.content()
            imgs = list(set(CDN_RE.findall(html)))
            cdn = [u for u in imgs if "alicdn" in u or "taobaocdn" in u or "gw.alicdn" in u]
            cdn = [u for u in cdn if "_120x120" not in u and "logo" not in u.lower()][:20]
            if not cdn:
                print(f"  id={pid} 页面无阿里CDN图", flush=True)
                continue
            processed = await img_proc.process_batch(cdn, generate_thumbs=True, platform="阿里拍卖")
            saved = storage.save_property_images(pid, source_url, processed)
            vis = [s for s in saved if s.get("oss_url") and not s.get("junk_reason")]
            if vis and COMMIT:
                rows_ins = [
                    {"image_url": s["oss_url"], "thumb_url": s.get("thumb_url"), "sort_order": i,
                     "is_cover": i == 0, "hidden": 0, "hide_reason": None}
                    for i, s in enumerate(saved) if s.get("oss_url") and not s.get("junk_reason")
                ]
                await PropertyImageRepository.batch_upsert(db, pid, rows_ins)
                await db.commit()
                fixed += 1
                print(f"  id={pid} 补图成功 {len(vis)}张", flush=True)
            else:
                print(f"  id={pid} 下载失败/全垃圾", flush=True)
        except Exception as e:
            print(f"  id={pid} 异常 {str(e)[:60]}", flush=True)
    await ctx.close()
    await browser_manager.stop()
    await db.close()
    print(f"完成: 补图成功 {fixed}/{len(rows)}", flush=True)


asyncio.run(main())
