"""补图：为缺少可见图片的在拍房源重新抓取并下载图片。

针对详情抓取失败/图片下载限流(阿里 img.alicdn.com 420)导致首轮没存到图的房源，
重新跑详情解析+下载图片。图片下载直连(实测比住宅代理更不易被alicdn限流420)。

候选口径:状态为「即将开拍/进行中」且无任何可见图(原口径 auction_start_time>now
漏掉所有「进行中」房源——它们已开拍但仍需图)。

用法：
  python -m crawler.backfill_ali_images [--commit] [--limit N] [--city-id 371300]
                                        [--platform 阿里拍卖|京东拍卖]
"""
import sys, re, asyncio, subprocess, time
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


# ===== 隧道出口IP轮换等待(阿里专用) =====
# 青果长效动态型是隧道模式:server固定、出口IP服务端自动轮换(约30分钟),
# 提取API恒返回通道被占,无法主动换IP。SSR连续失败(当前出口被阿里风控)时,
# 正确做法是停手等下一轮轮换,而不是把几百条房源全烧在被风控的IP上。
def _exit_ip_via_bridge() -> str:
    """经本地socks桥查当前隧道出口IP(与爬虫同出口)。"""
    for url in ("https://ipinfo.io/ip", "https://api.ipify.org"):
        try:
            r = subprocess.run(
                ["curl", "-s", "--max-time", "15", "-x", "socks5://127.0.0.1:11080", url],
                capture_output=True, text=True, timeout=20)
            ip = r.stdout.strip()
            if re.fullmatch(r"\d+\.\d+\.\d+\.\d+", ip):
                return ip
        except Exception:
            pass
    return ""


async def _wait_ip_rotation(old_ip: str, max_wait: int = 2400) -> bool:
    """轮询桥出口IP直到轮换(或超时)。返回是否等到了新IP。"""
    waited = 0
    while waited < max_wait:
        await asyncio.sleep(60)
        waited += 60
        ip = await asyncio.to_thread(_exit_ip_via_bridge)
        if ip and ip != old_ip:
            print(f"  出口IP已轮换 {old_ip or '?'} → {ip} (等待{waited}s)", flush=True)
            return True
        if waited % 300 == 0:
            print(f"  等待隧道轮换中... {waited}s (出口仍 {ip or old_ip or '?'})", flush=True)
    return False


def _reset_ssr_circuit(crawler):
    """解掉阿里爬虫的SSR熔断,轮换后用新出口重试。"""
    crawler._ssr_circuit_open = False
    crawler._ssr_circuit_skips = 0
    if hasattr(crawler, "_ssr_fail_streak"):
        crawler._ssr_fail_streak = 0


async def main():
    db = await get_session()
    if PLATFORM == "京东拍卖":
        img_proc = ImageProcessor(extra_headers={}, cookies_str="", proxy=None)
        crawler = JDAuctionCrawler()
        parser = JDDetailParser()
        need_browser = False
    else:
        # 图片下载直连(不走住宅代理):2026-08-24 实测 img.alicdn.com 对服务器机房IP
        # 连发30次全200,而经青果住宅代理批量下载反而大面积420(住宅出口IP被阿里
        # 系CDN重点限流)。直连还顺带不烧代理流量、不与SSR抢同一出口IP的风控额度。
        # 若直连也遇420,ImageProcessor 自带重试+10分钟冷却兜底。
        img_proc = ImageProcessor(
            extra_headers={"Referer": "https://pages-fast.m.taobao.com/"},
            cookies_str=settings.TAOBAO_COOKIE,
            proxy=None,
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

        # 列表优先快速通道(阿里):列表API稳定可用且每行自带 headerPicUrls
        # (0825实测:206套缺图中177套在四城列表里且全部带图)。先抓四城列表
        # 填 _row_cache,命中即免SSR直接补图——SSR名额是阿里侧最稀缺资源。
        if PLATFORM == "阿里拍卖":
            from crawler.utils.url_registry import get_configs
            for _cfg in get_configs(platform="阿里拍卖"):
                try:
                    _items = await crawler.collect_list_items(_cfg.source_url, _cfg.city, 8)
                    print(f"  列表采集 {_cfg.city}: {len(_items)} 条", flush=True)
                except Exception as e:
                    print(f"  列表采集 {_cfg.city} 失败: {e}", flush=True)
            print(f"  列表缓存 {len(getattr(crawler, '_row_cache', {}))} 条", flush=True)

        fixed = stillempty = noid = nodetail = 0
        fail_streak = 0
        total_waited = 0           # 轮换等待总预算(秒),防整轮耗在等IP上
        WAIT_BUDGET = 100 * 60
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
            # 快速通道:列表行带图 → 免SSR
            detail = None
            if PLATFORM == "阿里拍卖":
                _row = getattr(crawler, "_row_cache", {}).get(item_id)
                if _row:
                    try:
                        detail = crawler._build_detail_from_row(_row)
                    except Exception:
                        detail = None
            if not detail:
                try:
                    # 图片下载冷却期(alicdn连续420)中硬跑=白烧一次SSR成功:
                    # 图全被跳过下载→这套仍判"仍空"。等冷却结束再抓。
                    _cd = getattr(img_proc, "_cooldown_until", 0)
                    _left = (_cd - time.monotonic()) if _cd else 0
                    if _left > 0:
                        print(f"  图片冷却中,等{int(_left)+3}s再继续(避免白烧SSR)", flush=True)
                        await asyncio.sleep(_left + 3)
                    detail = await crawler.fetch_detail_api(item_id)
                except Exception as e:
                    logger.debug(f"id={pid} detail fail: {e}")
                    detail = None
            if not detail:
                nodetail += 1
                # 阿里:连续失败=当前出口IP被风控(熔断期会快速连烧几十条),
                # 停手等隧道自动轮换(约30分钟)再继续,烧穿也比全灭强。
                if PLATFORM == "阿里拍卖":
                    fail_streak += 1
                    if fail_streak >= 3 and total_waited < WAIT_BUDGET:
                        old = await asyncio.to_thread(_exit_ip_via_bridge)
                        print(f"  连续{fail_streak}条详情失败,疑似出口IP被风控,"
                              f"等隧道轮换(当前 {old or '?'})...", flush=True)
                        t0 = asyncio.get_event_loop().time()
                        ok = await _wait_ip_rotation(old)
                        total_waited += int(asyncio.get_event_loop().time() - t0)
                        _reset_ssr_circuit(crawler)
                        fail_streak = 0
                        if not ok:
                            print("  等轮换超时(40分钟),继续尝试", flush=True)
                continue
            fail_streak = 0
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
