"""CrawlEngine — core orchestrator for the entire crawl pipeline.

Flow:
  1. Load source URL configs
  2. For each platform: collect list items → deduplicate → fetch + parse details → process images → save
  3. Run incremental comparison (24h diff)
  4. Log summary
"""
import asyncio
import time
from datetime import datetime

from loguru import logger

from .config import settings
from .browser import browser_manager
from .anti_crawl import random_sleep
from .models.item import AuctionItem
from .platforms.base import AbstractBrokerCrawler
from .platforms.taobao_paimai import TaobaoPaiMaiCrawler
from .platforms.jd import JDAuctionCrawler
from .platforms.gpai import GPaiCrawler
from .parsers.taobao_paimai_detail import TaobaoPaiMaiDetailParser
from .parsers.jd_detail import JDDetailParser
from .parsers.gpai_detail import GPaiDetailParser
from .storage.db import get_session
from .storage.repository import (
    PropertyRepository,
    PropertyImageRepository,
    CrawlRecordRepository,
    CrawlTaskRepository,
)
from .storage.deduplicator import Deduplicator
from .utils.url_registry import SourceConfig, get_configs, group_configs_by_platform
from .pipelines.image_processor import ImageProcessor
from .pipelines.local_storage import LocalStorage
from .pipelines.data_enricher import DataEnricher


PLATFORM_FACTORY = {
    "阿里拍卖": (TaobaoPaiMaiCrawler, TaobaoPaiMaiDetailParser),
    "京东拍卖": (JDAuctionCrawler, JDDetailParser),
    "公拍网": (GPaiCrawler, GPaiDetailParser),
}

CITY_ID_MAP = {"上海": 310000, "宁波": 330200, "杭州": 330100}


class CrawlRunResult:
    """Summary of a crawl run."""

    def __init__(self):
        self.start_time = datetime.now()
        self.end_time: datetime | None = None
        self.platform_stats: dict[str, dict] = {}
        self.total_list_items = 0
        self.total_new = 0
        self.total_updated = 0
        self.total_skipped = 0
        self.total_failed = 0
        self.total_ended = 0  # marked as ended in incremental comparison
        self.total_relisted = 0  # previously ended properties that reappeared

    @property
    def duration_seconds(self) -> float:
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0

    def log_summary(self) -> None:
        logger.info("=" * 50)
        logger.info("CRAWL RUN SUMMARY")
        logger.info(f"  Duration: {self.duration_seconds:.0f}s")
        logger.info(f"  Platforms:")
        for platform, stats in self.platform_stats.items():
            logger.info(
                f"    {platform}: {stats['list_items']} found, "
                f"{stats['new']} new, {stats['updated']} updated, "
                f"{stats['skipped']} skipped, {stats['failed']} failed, "
                f"{stats['relisted']} relisted, {stats['ended']} ended"
            )
        logger.info(
            f"  TOTAL: {self.total_list_items} found, "
            f"{self.total_new} new, {self.total_updated} updated, "
            f"{self.total_skipped} skipped, {self.total_failed} failed, "
            f"{self.total_relisted} relisted, {self.total_ended} ended"
        )
        logger.info("=" * 50)


class CrawlEngine:
    """Orchestrates crawling across all platforms."""

    def __init__(self, task_id: int | None = None):
        self.task_id = task_id
        self.result = CrawlRunResult()
        self.deduplicator = Deduplicator(stale_hours=settings.STALE_REFRESH_HOURS)

    async def run(
        self,
        platform: str | None = None,
        city: str | None = None,
        max_pages: int = 50,
        force_refresh: bool = False,
    ) -> CrawlRunResult:
        """Main entry point. Run the full crawl pipeline."""
        configs = get_configs(platform=platform, city=city)
        grouped = group_configs_by_platform(configs)

        logger.info(
            f"CrawlEngine started: {len(configs)} source URLs across {len(grouped)} platforms"
        )

        # Start browser
        await browser_manager.start()

        db = await get_session()

        try:
            # Update task status if provided
            if self.task_id:
                await CrawlTaskRepository.update_status(
                    db, self.task_id, "running"
                )
                await db.commit()

            # Process each platform
            for platform_name, platform_configs in grouped.items():
                await self._process_platform(
                    db, platform_name, platform_configs, max_pages, force_refresh
                )

            # Incremental comparison
            await self._run_incremental_comparison(db, platform, city)

            self.result.end_time = datetime.now()

            # Update task status
            if self.task_id:
                # 构造 diff 报告：每平台的新增/更新数 + 时长
                duration_sec = (self.result.end_time - self.result.start_time).total_seconds() if self.result.start_time else 0
                stats = {
                    "duration_sec": int(duration_sec),
                    "total_list_items": self.result.total_list_items,
                    "total_new": self.result.total_new,
                    "total_updated": self.result.total_updated,
                    "total_relisted": getattr(self.result, "total_relisted", 0),
                    "total_failed": getattr(self.result, "total_failed", 0),
                    "by_platform": getattr(self.result, "by_platform", {}),
                }
                await CrawlTaskRepository.update_status(
                    db,
                    self.task_id,
                    "completed",
                    total_count=self.result.total_list_items,
                    success_count=self.result.total_new + self.result.total_updated,
                    new_count=self.result.total_new,
                    updated_count=self.result.total_updated,
                    stats_summary=stats,
                )
                await db.commit()

        except Exception as e:
            logger.error(f"CrawlEngine failed: {e}")
            if self.task_id:
                await CrawlTaskRepository.update_status(
                    db, self.task_id, "failed", error_message=str(e)
                )
                await db.commit()
            raise
        finally:
            await db.close()
            await browser_manager.stop()

        self.result.log_summary()
        return self.result

    async def _process_platform(
        self,
        db,
        platform_name: str,
        configs: list[SourceConfig],
        max_pages: int,
        force_refresh: bool,
    ) -> None:
        """Run the crawl pipeline for one platform."""
        crawler_cls, parser_cls = PLATFORM_FACTORY[platform_name]
        crawler: AbstractBrokerCrawler = crawler_cls()
        parser = parser_cls()

        # Image processing pipeline
        extra_headers = {}
        cookies_str = ""
        if platform_name == "阿里拍卖":
            extra_headers = {"Referer": "https://pages-fast.m.taobao.com/"}
            cookies_str = settings.TAOBAO_COOKIE
        image_processor = ImageProcessor(
            extra_headers=extra_headers, cookies_str=cookies_str
        )
        local_storage = LocalStorage(
            base_path=settings.IMAGE_STORAGE_PATH,
            base_url=settings.IMAGE_BASE_URL,
        )

        platform_stats = {
            "list_items": 0,
            "new": 0,
            "updated": 0,
            "skipped": 0,
            "failed": 0,
            "ended": 0,
            "relisted": 0,
        }
        # 连续失败计数：达到阈值就 mark host bad（30 分钟冷却）
        consecutive_failures = {"count": 0, "last_url": ""}
        CONSECUTIVE_FAILURE_THRESHOLD = 10

        try:
            # Collect list items from all source URLs for this platform
            all_list_items = []
            for cfg in configs:
                logger.info(f"[{platform_name}] Processing source: {cfg.label} ({cfg.source_url})")
                try:
                    items = await crawler.collect_list_items(cfg.source_url, cfg.city, max_pages)
                    all_list_items.extend(items)
                    logger.info(f"[{platform_name}] {cfg.label}: {len(items)} items")
                except Exception as e:
                    logger.error(f"[{platform_name}] Failed to collect from {cfg.label}: {e}")
                    continue
                await random_sleep(1, 3)

            platform_stats["list_items"] = len(all_list_items)
            self.result.total_list_items += len(all_list_items)

            # Deduplicate and filter URLs to fetch
            city_id = CITY_ID_MAP.get(configs[0].city, 310000)
            to_fetch = []
            for item in all_list_items:
                if not item.source_url:
                    continue
                should, reason = await self.deduplicator.should_fetch(
                    db, item.source_url, force_refresh
                )
                if should:
                    to_fetch.append(item)
                else:
                    platform_stats["skipped"] += 1

            logger.info(
                f"[{platform_name}] {len(to_fetch)} to fetch, "
                f"{platform_stats['skipped']} skipped (dedup)"
            )

            # Fetch details concurrently with semaphore
            # API-driven crawlers (PaiMai) use concurrency=1 to avoid MTOP rate-limiting
            api_concurrency = 1 if (hasattr(crawler, 'fetch_detail_api') or platform_name == '公拍网') else settings.DETAIL_PAGE_CONCURRENCY
            semaphore = asyncio.Semaphore(api_concurrency)

            async def process_detail(item) -> tuple[str, int | None]:
                """Fetch, parse, process images, and save a single detail page.

                Each task uses its own DB session to avoid concurrent-access errors
                with aiomysql / SQLAlchemy async sessions.
                """
                # 风控冷却检查：该 host 在冷却期内直接跳过
                try:
                    from .platforms.base import check_url_cooldown
                    skip_reason = check_url_cooldown(item.source_url)
                    if skip_reason:
                        logger.warning(f"[{platform_name}] 跳过 {item.source_url[:80]}: {skip_reason}")
                        return "skipped", None
                except Exception:
                    pass

                async with semaphore:
                    task_db = await get_session()
                    try:
                        # API-driven crawler (PaiMai) vs HTML crawler (JD, GPai)
                        if hasattr(crawler, 'fetch_detail_api'):
                            # MTOP API has aggressive rate-limiting — space out calls
                            await random_sleep(2.0, 4.0)
                            _api_ok = False

                            import re as _re
                            item_id_match = _re.search(r'itemId=(\d+)', item.source_url)
                            if item_id_match:
                                item_id = item_id_match.group(1)
                                try:
                                    api_data = await crawler.fetch_detail_api(item_id)
                                    if api_data:
                                        extra = {
                                            "area_text": item.area_text,
                                            "district": item.district,
                                            "address": item.address,
                                        }
                                        auction_item = await parser.parse(
                                            api_data, item.source_url, city_id, extra=extra
                                        )
                                        # Verify essential fields were parsed
                                        if auction_item.title and auction_item.starting_price:
                                            _api_ok = True
                                        else:
                                            logger.warning(
                                                f"[{platform_name}] MTOP returned empty data for {item_id}, falling back to Playwright"
                                            )
                                    else:
                                        logger.warning(
                                            f"[{platform_name}] MTOP returned None for {item_id}, falling back to Playwright"
                                        )
                                except Exception as api_err:
                                    logger.warning(
                                        f"[{platform_name}] MTOP API failed for {item_id}: {api_err}, falling back to Playwright"
                                    )
                            else:
                                logger.warning(
                                    f"[{platform_name}] Cannot extract itemId from {item.source_url}"
                                )

                            # Fallback: use Playwright HTML fetch + parse
                            if not _api_ok:
                                try:
                                    html = await crawler.fetch_detail(item.source_url)
                                    await random_sleep(0.5, 2.0)
                                    extra = {
                                        "title": item.title,
                                        "area_text": item.area_text,
                                        "auction_status": item.auction_status,
                                        "district": item.district,
                                        "starting_price_text": getattr(item, 'starting_price_text', ''),
                                        "address": item.address,
                                    }
                                    # TaobaoPaiMaiDetailParser expects dict, not HTML str.
                                    # Try to intercept MTOP network responses embedded in page.
                                    # If we got HTML, create a minimal dict from list-level data.
                                    if isinstance(html, str):
                                        logger.info(f"[{platform_name}] Building item from list-level data for {item.source_url[:80]}")
                                        from .models.item import AuctionItem
                                        auction_item = AuctionItem(source_url=item.source_url, auction_platform=platform_name)
                                        auction_item.title = item.title or ""
                                        auction_item.district = item.district or ""
                                        auction_item.address = item.address or ""
                                        auction_item.auction_status = item.auction_status or ""
                                        auction_item.city_id = city_id
                                        if hasattr(item, 'area_text') and item.area_text:
                                            import re as _re2
                                            m = _re2.search(r'[\d.]+', str(item.area_text))
                                            if m:
                                                auction_item.area = float(m.group())
                                        if hasattr(item, 'starting_price_text') and item.starting_price_text:
                                            from .cleaners.price import parse_price_to_yuan
                                            auction_item.starting_price = parse_price_to_yuan(item.starting_price_text)
                                    else:
                                        auction_item = await parser.parse(html, item.source_url, city_id, extra=extra)
                                except Exception as fb_err:
                                    logger.error(
                                        f"[{platform_name}] Playwright fallback also failed for {item.source_url}: {fb_err}"
                                    )
                                    return "failed", None
                        else:
                            # Fetch detail HTML
                            html = await crawler.fetch_detail(item.source_url)
                            await random_sleep(0.5, 2.0)

                            # Pass list-level metadata to help detail parser
                            extra = {
                                "title": item.title,
                                "area_text": item.area_text,
                                "auction_status": item.auction_status,
                                "district": item.district,
                                "starting_price_text": item.starting_price_text,
                                "address": item.address,
                            }
                            auction_item = await parser.parse(html, item.source_url, city_id, extra=extra)

                        # 智能城市分配：根据解析出的 province_city 自动判定 city_id
                        # 只保留上海/宁波/杭州，其他城市直接 skip
                        pc = (auction_item.province_city or "").strip()
                        addr = (auction_item.address or "") + " " + (auction_item.title or "")
                        # 兼容 parser 偶尔解析异常的边界情况（如「江宁波市」「省宁波市」）
                        if "宁波" in pc or "宁波" in addr:
                            auction_item.city_id = 330200
                            auction_item.province_city = "宁波"
                        elif "杭州" in pc or "杭州" in addr:
                            auction_item.city_id = 330100
                            auction_item.province_city = "杭州"
                        elif "上海" in pc or "上海" in addr:
                            auction_item.city_id = 310000
                            auction_item.province_city = "上海"
                        # province_city 仅到省级（如「浙江省」），用本次抓取的目标城市兜底：
                        # 阿里列表用 keyword=城市名 搜出，city_id 即对应城市，地址未能细分时按其归属。
                        elif pc in ("浙江省", "浙江") and city_id in (330200, 330100):
                            auction_item.city_id = city_id
                            auction_item.province_city = "宁波" if city_id == 330200 else "杭州"
                        else:
                            logger.debug(
                                f"[{platform_name}] Skipping non-target city: "
                                f"{pc} — {item.source_url}"
                            )
                            return "skipped_city", None

                        # Asset type filter: skip vehicles, equipment, goods (not real estate)
                        title = auction_item.title or ""
                        import re as _re_asset
                        non_real_estate_kw = _re_asset.compile(
                            r"车牌|本田|奔驰|宝马|奥迪|大众|丰田|日产|路虎|保时捷|普通客车|轿车|商务车|货车|挖掘机|装载机|捷豹|荣威"
                            r"|包装箱|集装箱|阻隔瓶|塑料桶|物资一批|设备一批|手机一批|电脑一批"
                        )
                        real_estate_kw = _re_asset.compile(
                            r"室|号楼|栋|公寓|花园|小区|大厦|花苑|别墅|商铺|厂房|办公|住宅|住房|店铺|车位|楼盘|公馆|广场|宅基|宿舍|商业用房|工业用房|土地|地块"
                        )
                        if non_real_estate_kw.search(title) and not real_estate_kw.search(title):
                            logger.info(
                                f"[{platform_name}] Skipping non-real-estate: {title[:40]} — {item.source_url}"
                            )
                            return "skipped_non_real_estate", None

                        # Save property to DB first (to get property_id)
                        prop_id, action = await PropertyRepository.upsert(task_db, auction_item)
                        await task_db.commit()

                        # Process images: download → resize (keep aspect ratio) → WebP → local /picture
                        image_urls = auction_item.image_urls or []
                        image_dicts = []
                        if auction_item.image_urls and settings.IMAGE_PROCESS_ENABLED:
                            try:
                                processed = await image_processor.process_batch(
                                    auction_item.image_urls, generate_thumbs=True,
                                    platform=platform_name
                                )

                                uploaded = local_storage.save_property_images(
                                    prop_id, item.source_url, processed
                                )
                                image_dicts = []
                                _cover_set = False
                                for i, u in enumerate(uploaded):
                                    if not u["oss_url"]:
                                        continue
                                    is_junk = bool(u.get("junk_reason"))
                                    # 封面取第一张非垃圾图
                                    is_cover = (not is_junk) and (not _cover_set)
                                    if is_cover:
                                        _cover_set = True
                                    image_dicts.append({
                                        "image_url": u["oss_url"],
                                        "thumb_url": u.get("thumb_url", ""),
                                        "sort_order": i,
                                        "is_cover": is_cover,
                                        "hidden": 1 if is_junk else 0,
                                        "hide_reason": u.get("junk_reason"),
                                    })

                                logger.debug(
                                    f"Processed {len(auction_item.image_urls)} images for property #{prop_id}, "
                                    f"{len(image_dicts)} saved to local"
                                )
                            except Exception as img_err:
                                logger.warning(f"Image processing failed for #{prop_id}: {img_err}")
                                image_dicts = [
                                    {"image_url": url, "sort_order": i, "is_cover": i == 0}
                                    for i, url in enumerate(auction_item.image_urls) if url
                                ]

                        # Save image records (local URLs with thumbnails, or originals)
                        if image_dicts:
                            await PropertyImageRepository.batch_upsert(
                                task_db, prop_id, image_dicts
                            )
                            await task_db.commit()

                        # Create crawl record
                        await CrawlRecordRepository.create(
                            task_db,
                            task_id=self.task_id,
                            property_id=prop_id,
                            status="success",
                            source_url=item.source_url,
                            raw_data={"title": auction_item.title, "action": action},
                        )
                        await task_db.commit()

                        # 成功 → 重置连续失败计数
                        consecutive_failures["count"] = 0
                        return action, prop_id

                    except Exception as e:
                        logger.error(f"[{platform_name}] Failed {item.source_url}: {e}")
                        try:
                            await CrawlRecordRepository.create(
                                task_db,
                                task_id=self.task_id,
                                property_id=None,
                                status="failed",
                                source_url=item.source_url,
                                error_message=str(e)[:1000],
                            )
                            await task_db.commit()
                        except Exception:
                            pass
                        # 连续失败检测：达到阈值就 mark 该 host bad，跳过剩余 URL
                        consecutive_failures["count"] += 1
                        consecutive_failures["last_url"] = item.source_url
                        if consecutive_failures["count"] >= CONSECUTIVE_FAILURE_THRESHOLD:
                            try:
                                from .platforms.base import mark_url_blocked
                                mark_url_blocked(
                                    item.source_url,
                                    f"{platform_name} 连续失败 {consecutive_failures['count']} 次",
                                )
                            except Exception:
                                pass
                        return "failed", None
                    finally:
                        await task_db.close()

            # Execute concurrent detail processing
            tasks = [process_detail(item) for item in to_fetch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, Exception):
                    platform_stats["failed"] += 1
                elif result[0] == "created":
                    platform_stats["new"] += 1
                elif result[0] == "updated":
                    platform_stats["updated"] += 1
                elif result[0] == "failed":
                    platform_stats["failed"] += 1
                elif result[0] == "skipped_city":
                    platform_stats["skipped"] += 1

            # Enrich newly created/updated properties with community data
            try:
                enriched = await DataEnricher.enrich_all_stale(db, limit=200)
                if enriched:
                    logger.info(f"[{platform_name}] Enriched {enriched} properties with community data")
            except Exception as e:
                logger.warning(f"[{platform_name}] Data enrichment failed: {e}")

            # 给本批次新爬到的、缺坐标的房源补 lat/lng（高德 geocoding）
            try:
                from .pipelines.geocoder import geocode_property
                from sqlalchemy import or_, update as sql_update, select as sql_select
                from app.models.property import Property as PropertyModel

                missing_geo = (await db.execute(
                    sql_select(PropertyModel.id, PropertyModel.address, PropertyModel.city_id, PropertyModel.province_city)
                    .where(
                        or_(PropertyModel.lat.is_(None), PropertyModel.lng.is_(None)),
                        PropertyModel.address.isnot(None),
                        PropertyModel.address != "",
                    )
                    .limit(100)
                )).all()

                if missing_geo:
                    geo_filled = 0
                    for r in missing_geo:
                        result = await geocode_property(r.id, r.address, r.city_id or 310000, r.province_city or "")
                        if result:
                            lat, lng = result
                            await db.execute(
                                sql_update(PropertyModel).where(PropertyModel.id == r.id).values(lat=lat, lng=lng)
                            )
                            geo_filled += 1
                        await asyncio.sleep(0.25)  # 限速 ~4 QPS
                    if geo_filled:
                        await db.commit()
                        logger.info(f"[{platform_name}] Geocoded {geo_filled}/{len(missing_geo)} new properties")
            except Exception as e:
                logger.warning(f"[{platform_name}] Geocoding step failed: {e}")

            # 周边配套（高德 POI 预处理）：给新增 / 缓存过期的房源补 amenities_cache
            try:
                from datetime import datetime, timedelta
                import os
                amap_key = os.getenv("AMAP_API_KEY", "")
                if amap_key:
                    from sqlalchemy import select as sql_select, or_
                    from app.models.property import Property as PropertyModel
                    visible = ["即将开拍", "进行中", "中止", "撤回", "已撤回"]
                    cutoff = datetime.now() - timedelta(days=30)
                    targets = (await db.execute(
                        sql_select(PropertyModel)
                        .where(
                            PropertyModel.auction_platform == platform_name,
                            PropertyModel.auction_status.in_(visible),
                            PropertyModel.lat.isnot(None),
                            PropertyModel.lng.isnot(None),
                            or_(
                                PropertyModel.amenities_cache.is_(None),
                                PropertyModel.amenities_updated_at.is_(None),
                                PropertyModel.amenities_updated_at < cutoff,
                            ),
                        )
                        .limit(20)  # 每平台跑完只补 20 个，避免高德额度耗尽
                    )).scalars().all()

                    if targets:
                        from scripts.backfill_amenities import fetch_amenities, AMAP_KEY
                        # 临时设置 KEY
                        import scripts.backfill_amenities as ba
                        ba.AMAP_KEY = amap_key
                        import httpx
                        async with httpx.AsyncClient() as client:
                            done = 0
                            for p in targets:
                                try:
                                    amen = await fetch_amenities(client, p.lat, p.lng)
                                    p.amenities_cache = amen
                                    p.amenities_updated_at = datetime.now()
                                    done += 1
                                except Exception as e:
                                    logger.debug(f"amenities P#{p.id} 失败: {e}")
                                await asyncio.sleep(0.5)
                            if done:
                                await db.commit()
                                logger.info(f"[{platform_name}] POI 预处理 {done}/{len(targets)} 套")
            except Exception as e:
                logger.warning(f"[{platform_name}] amenities step failed: {e}")

            # 贝壳小区详情抓取：给本批次有 community_name 但 community_info 缺失/过期的房源补抓
            try:
                from .community_scraper import backfill_all
                # 限制每个平台跑完只抓 30 个新小区，避免被风控
                new_count, skipped_count = await backfill_all(limit=30)
                if new_count or skipped_count:
                    logger.info(f"[{platform_name}] Beike community 抓取：新增/更新 {new_count}，跳过 {skipped_count}")
            except Exception as e:
                logger.warning(f"[{platform_name}] Beike community step failed: {e}")

            # 状态自校正：按 auction_start_time / end_time + 当前时间全向重算 auction_status。
            # 与后端读取层 core.auction_status.effective_status 同一口径：
            #   - 结果态（已成交/已撤回/中止/流拍）保留，不被时间覆盖；
            #   - 时序态（即将开拍/进行中/已结束）一律按时间窗重算，含「已结束→进行中」反向修正，
            #     修复爬虫抓取时刻状态文本错误（如开拍中却抓成已结束）导致房源被前台筛掉的问题。
            try:
                from app.core.auction_status import effective_status_sql, RESULT_STATES
                from sqlalchemy import update as sql_update
                from app.models.property import Property as PropertyModel

                eff = effective_status_sql()
                r = await db.execute(
                    sql_update(PropertyModel).where(
                        PropertyModel.auction_platform == platform_name,
                        PropertyModel.auction_status.notin_(RESULT_STATES),
                        PropertyModel.auction_status != eff,
                    ).values(auction_status=eff)
                )
                fixed = r.rowcount or 0
                if fixed:
                    await db.commit()
                    logger.info(f"[{platform_name}] 状态自校正：按时间重算修正 {fixed} 条")
            except Exception as e:
                logger.warning(f"[{platform_name}] 状态自校正失败: {e}")

            # 智能字段补全：从 title/description 提取 layout/装修/户型/case_number 等
            try:
                from .cleaners.text_extractor import enrich_property as text_enrich
                from sqlalchemy import select as sql_select
                from app.models.property import Property as PropertyModel

                visible = ["即将开拍", "进行中", "中止", "撤回", "已撤回"]
                rows = (await db.execute(
                    sql_select(PropertyModel).where(
                        PropertyModel.auction_status.in_(visible),
                        PropertyModel.auction_platform == platform_name,
                    )
                )).scalars().all()
                text_filled = 0
                for p in rows:
                    updates = text_enrich(p)
                    if updates:
                        for k, v in updates.items():
                            setattr(p, k, v)
                        text_filled += 1
                if text_filled:
                    await db.commit()
                    logger.info(f"[{platform_name}] 文本智能补全 {text_filled} 个字段")
            except Exception as e:
                logger.warning(f"[{platform_name}] text_extractor 失败: {e}")

            # 智能标签 + 爆款文案
            try:
                from .cleaners.smart_enrich import enrich_smart_fields
                from sqlalchemy import select as sql_select
                from app.models.property import Property as PropertyModel

                rows = (await db.execute(
                    sql_select(PropertyModel).where(
                        PropertyModel.auction_status.in_(visible),
                        PropertyModel.auction_platform == platform_name,
                    )
                )).scalars().all()
                tagged = 0
                for p in rows:
                    updates = enrich_smart_fields(p)
                    if updates:
                        for k, v in updates.items():
                            setattr(p, k, v)
                        tagged += 1
                if tagged:
                    await db.commit()
                    logger.info(f"[{platform_name}] 智能标签/文案 {tagged} 套")
            except Exception as e:
                logger.warning(f"[{platform_name}] smart_enrich 失败: {e}")

        finally:
            await crawler.close()

        # Track relisted count
        platform_stats["relisted"] = self.deduplicator.relisted_count
        self.result.total_relisted += platform_stats["relisted"]

        self.result.platform_stats[platform_name] = platform_stats
        self.result.total_new += platform_stats["new"]
        self.result.total_updated += platform_stats["updated"]
        self.result.total_skipped += platform_stats["skipped"]
        self.result.total_failed += platform_stats["failed"]

    async def _run_incremental_comparison(
        self, db, platform: str | None, city: str | None
    ) -> None:
        """Compare current crawl results against DB, mark stale auctions as ended."""
        logger.info("Running incremental comparison...")

        platforms_to_check = [platform] if platform else list(PLATFORM_FACTORY.keys())

        for platform_name in platforms_to_check:
            crawled_urls = self.deduplicator._seen
            if not crawled_urls:
                continue

            stale_items = await PropertyRepository.find_stale_urls(
                db, set(crawled_urls), platform_name
            )

            for item in stale_items:
                try:
                    await PropertyRepository.mark_as_ended(db, item["id"])
                    await CrawlRecordRepository.create(
                        db,
                        task_id=self.task_id,
                        property_id=item["id"],
                        status="success",
                        source_url=item["source_url"],
                        raw_data={"action": "marked_ended", "previous_status": item["auction_status"]},
                    )
                    await db.commit()
                    if platform_name in self.result.platform_stats:
                        self.result.platform_stats[platform_name]["ended"] += 1
                    self.result.total_ended += 1
                except Exception as e:
                    logger.error(f"Failed to mark {item['source_url']} as ended: {e}")

            logger.info(f"[{platform_name}] Marked {len(stale_items)} items as ended")
