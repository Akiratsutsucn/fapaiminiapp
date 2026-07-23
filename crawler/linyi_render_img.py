"""临沂定向渲染抓图：不依赖SSR initData，直接从渲染后的页面收集阿里CDN图下载。
根因：fetch_detail_api骨架时没收集页面img，但这些房源详情页实际有28-66张阿里CDN图。"""
import asyncio, hashlib, os, re, sys
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

# 已知脏图 md5 黑名单(阿里UI图标/「恭喜您报名成功」等内容脏图,处理后 webp 的 md5)。
# 这些图会跨多个房源重复出现,靠尺寸/URL识别不了,只能按内容 md5 拦截。
_BLACKLIST_PATH = os.path.join(os.path.dirname(__file__), "junk_image_md5_blacklist.txt")
JUNK_MD5 = set()
if os.path.exists(_BLACKLIST_PATH):
    with open(_BLACKLIST_PATH) as _f:
        JUNK_MD5 = {ln.strip() for ln in _f if ln.strip()}


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
            # 源URL层过滤:阿里UI图标常带尺寸后缀(_很小)或成功/占位图关键词
            cdn = [u for u in cdn if not re.search(r'_(?:\d{1,2}|1\d{2})x(?:\d{1,2}|1\d{2})[.\-]', u)]
            cdn = [u for u in cdn if not re.search(r'(success|checkmark|placeholder|default|loading|icon|blank)', u, re.I)]
            if not cdn:
                print(f"  id={pid} 过滤后无有效图", flush=True)
                continue
            processed = await img_proc.process_batch(cdn, generate_thumbs=True, platform="阿里拍卖")
            # 三层过滤:①处理后<2KB=图标/占位 ②junk_reason=广告/二维码 ③md5命中已知脏图黑名单
            # (真实房源照片均≥20KB且内容唯一;脏图会跨多房源重复,只能按内容md5拦截)
            def _keep(p):
                b = p.get("full_bytes")
                if not b or len(b) < 2048 or p.get("junk_reason"):
                    return False
                if hashlib.md5(b).hexdigest() in JUNK_MD5:
                    return False
                return True
            processed = [p for p in processed if _keep(p)]
            if not processed:
                print(f"  id={pid} 过滤后无有效图(全为图标/占位/脏图)", flush=True)
                continue
            saved = storage.save_property_images(pid, source_url, processed)
            vis = [s for s in saved if s.get("oss_url")]
            if vis and COMMIT:
                rows_ins = [
                    {"image_url": s["oss_url"], "thumb_url": s.get("thumb_url"), "sort_order": i,
                     "is_cover": i == 0, "hidden": 0, "hide_reason": None}
                    for i, s in enumerate(vis)
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
