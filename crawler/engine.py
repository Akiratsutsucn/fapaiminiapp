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
    CrawlerTaskDetailRepository,
)
from .storage.deduplicator import Deduplicator
from .utils.url_registry import SourceConfig, get_configs, group_configs_by_platform
from .utils.failure_type import classify_error, LOGIN_COOKIE, IP_BLOCKED, PARSE_LOGIC
from .pipelines.image_processor import ImageProcessor
from .pipelines.local_storage import LocalStorage
from .pipelines.data_enricher import DataEnricher

import re as _re_engine

# 标题/地址开头若是「外省省名/外省直辖市/外省地市/外省区县」，即使后面带「上海/杭州/宁波」
# 字样（如「河南永城上海公馆」「江阴市上海花园」「绍兴市上虞区新上海花园」），也属于外省
# 房源，应跳过。注意：不含「上海/浙江」本身，也不含杭甬下辖区县（淳安/桐庐/象山/宁海/
# 余姚/慈溪/建德/临安等），避免误杀目标城市。
_re_other_province = _re_engine.compile(
    r"^\s*(?:位于|拍卖)?\s*(河北|河南|山东|山西|陕西|重庆|北京|天津|广东|广西|江苏|四川|湖北|湖南|"
    r"福建|安徽|江西|辽宁|吉林|黑龙江|云南|贵州|甘肃|内蒙古?|新疆|宁夏|青海|海南|西藏|"
    # 外省地市/区县（本次实拍暴露的「上海XX」同名楼盘所在地）：
    r"淄博|唐山|周口|西安|昆明|福州|青岛|江阴|绍兴|启东|蒙自|十堰|滨州|阜阳|荆州|武威|"
    r"黄山|北海|南充|东海|张家口|临邑|微山|盘州|库尔勒|日照|莱西|东明|清河|奇台|道真|"
    r"安乡|安化|云岩|郏县|新泰|高密|永城|商丘|开封|尉氏|睢阳|歙县|徽城)"
)

# 股权/出资额/证券类「非不动产」拍卖（被执行人持有……股权/出资额/证券代码……）
_re_equity_auction = _re_engine.compile(
    r"(股权|出资额|证券代码|证劵代码|股的|偿债|重整案件|注册资本|持股|股份)"
)


PLATFORM_FACTORY = {
    "阿里拍卖": (TaobaoPaiMaiCrawler, TaobaoPaiMaiDetailParser),
    "京东拍卖": (JDAuctionCrawler, JDDetailParser),
    "公拍网": (GPaiCrawler, GPaiDetailParser),
}

CITY_ID_MAP = {"上海": 310000, "宁波": 330200, "杭州": 330100}

# 三市合法辖区白名单（用于拦截「外省叫『上海花园/上海城/上海路』的楼盘」——
# 这类标题含「上海」会骗过关键词判断，但解析出的 district 是外省地名，可据此精确拦截）。
VALID_DISTRICTS = {
    310000: {  # 上海 16 区
        "浦东新区", "宝山区", "闵行区", "松江区", "普陀区", "杨浦区", "奉贤区",
        "嘉定区", "青浦区", "黄浦区", "徐汇区", "虹口区", "静安区", "金山区",
        "长宁区", "崇明区",
    },
    330200: {  # 宁波
        "海曙区", "江北区", "江东区", "北仑区", "镇海区", "鄞州区", "奉化区",
        "余姚市", "慈溪市", "象山县", "宁海县",
    },
    330100: {  # 杭州
        "余杭区", "上城区", "拱墅区", "富阳区", "临安区", "萧山区", "西湖区",
        "桐庐县", "钱塘区", "建德市", "淳安县", "滨江区", "江干区", "临平区",
        "下城区",
    },
}
# 所有合法辖区合集（任一市命中即视为目标区域内）。额外并入市级名称（上海/宁波/杭州），
# 兼容部分房源 district 只解析到市级、未细分到区的合法情况。
_ALL_VALID_DISTRICTS = set().union(*VALID_DISTRICTS.values()) | {"上海", "宁波", "杭州"}


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
                try:
                    # 主流程异常后 session 可能停在 invalid transaction（如 2013 Lost
                    # connection 后未回滚），不先 rollback 连「标记 failed」的 commit 都会失败，
                    # 导致任务永远卡在 running。先回滚重置 session 再写状态。
                    await db.rollback()
                except Exception:
                    pass
                try:
                    await CrawlTaskRepository.update_status(
                        db, self.task_id, "failed", error_message=str(e)
                    )
                    await db.commit()
                except Exception as e2:
                    logger.error(f"标记任务 failed 也失败了: {e2}")
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
        image_proxy = None
        if platform_name == "阿里拍卖":
            extra_headers = {"Referer": "https://pages-fast.m.taobao.com/"}
            cookies_str = settings.TAOBAO_COOKIE
            # 阿里图片(img.alicdn.com)对机房IP突发限流420，走住宅代理下载更稳。
            # 优先用专用 IMAGE_PROXY，未配则复用 GPAI_PROXY。
            image_proxy = settings.IMAGE_PROXY or settings.GPAI_PROXY
        image_processor = ImageProcessor(
            extra_headers=extra_headers, cookies_str=cookies_str, proxy=image_proxy
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
        # 按城市统计详情（用于保存到 crawler_task_details）
        city_stats: dict[str, dict] = {}
        # 连续失败计数：达到阈值就 mark host bad（30 分钟冷却）
        consecutive_failures = {"count": 0, "last_url": ""}
        CONSECUTIVE_FAILURE_THRESHOLD = 10

        try:
            # Collect list items from all source URLs for this platform
            all_list_items = []
            for cfg in configs:
                city_name = cfg.city
                # 初始化该城市的统计数据
                if city_name not in city_stats:
                    city_stats[city_name] = {
                        "start_time": time.time(),
                        "total_fetched": 0,
                        "new": 0,
                        "updated": 0,
                        "skipped": 0,
                        "failed": 0,
                        "error_messages": [],
                        "failure_type": None,
                    }

                logger.info(f"[{platform_name}] Processing source: {cfg.label} ({cfg.source_url})")
                try:
                    items = await crawler.collect_list_items(cfg.source_url, cfg.city, max_pages)
                    # 为每个item设置城市信息
                    for item in items:
                        if not hasattr(item, 'city') or not item.city:
                            item.city = city_name
                    all_list_items.extend(items)
                    city_stats[city_name]["total_fetched"] += len(items)
                    logger.info(f"[{platform_name}] {cfg.label}: {len(items)} items")
                    # 列表返回空 + 爬虫检测到登录墙 → 标记为登录/cookie失效
                    if not items and getattr(crawler, "_login_wall_detected", False):
                        if city_stats[city_name]["failure_type"] is None:
                            city_stats[city_name]["failure_type"] = LOGIN_COOKIE
                        city_stats[city_name]["error_messages"].append(
                            f"{cfg.label}: 检测到登录墙，cookie 可能已失效"
                        )
                        logger.error(
                            f"[{platform_name}][{city_name}] 登录墙：列表返回空，标记 failure_type=LOGIN_COOKIE"
                        )
                except Exception as e:
                    error_msg = f"{cfg.label}: {str(e)}"
                    city_stats[city_name]["error_messages"].append(error_msg)
                    # 归类失败原因：登录墙优先于异常文本分类
                    ftype = LOGIN_COOKIE if getattr(crawler, "_login_wall_detected", False) else classify_error(e)
                    if city_stats[city_name]["failure_type"] is None:
                        city_stats[city_name]["failure_type"] = ftype
                    logger.error(f"[{platform_name}] Failed to collect from {cfg.label}: {e} (failure_type={ftype})")
                    continue
                # 京东列表接口对高频访问敏感：城市间留足冷却时间，避免后一城市被限流返回 0
                if platform_name == "京东拍卖":
                    await random_sleep(25, 40)
                else:
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
                                        # Verify essential fields were parsed.
                                        # 京东变卖类标的起拍价可能为 0，只要有标题即视为成功（接口直取已含全字段）。
                                        _ok_cond = bool(auction_item.title) and (
                                            platform_name == "京东拍卖" or bool(auction_item.starting_price)
                                        )
                                        if _ok_cond:
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
                        addr_head = ((auction_item.address or auction_item.title or "")).strip()[:8]
                        # 先排除「外省楼盘名带沪杭甬字样」的误判：
                        # 如「河南永城上海公馆」「内蒙古丰镇浦江上海城」「四川上海广场」——
                        # 标题/地址以外省省名或外省地市开头时，即使含「上海」二字也不是目标城市。
                        # 标题/地址以外省省名或外省地市/区县开头时，即使含「上海」二字也不是
                        # 目标城市。同时检查 address 开头与 title 开头——部分房源 address 被搜索
                        # 城市兜底覆盖（如阿里列表按 keyword=上海 搜出），真实外地信息只在 title 里
                        # （如「江阴市上海花园…」「绍兴市上虞区新上海花园…」）。
                        _title_head = (auction_item.title or "").strip()[:10]
                        _other_province = _re_other_province.match(addr_head) or \
                                          _re_other_province.match(_title_head)
                        if _other_province:
                            logger.info(
                                f"[{platform_name}] Skipping out-of-region (外省楼盘名含沪杭甬): "
                                f"{_other_province.group(1)} — {(auction_item.title or '')[:36]}"
                            )
                            return "skipped_city", None
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
                        # province_city 仅到省级（如「浙江省」）：用本次抓取的目标城市兜底。
                        # 但京东用省级 provinceId 搜索,会混入浙江其他市(嘉兴/衢州等),故对京东
                        # 收紧:仅当解析出的 district 属于目标城市辖区白名单才放行,否则跳过。
                        # 阿里/公拍按 keyword=城市名 精确搜索,混入外市概率低,维持宽松兜底
                        # (避免误杀 district 解析失败的真实杭甬房源)。
                        elif pc in ("浙江省", "浙江") and city_id in (330200, 330100):
                            _d = (auction_item.district or "").strip()
                            if "京东" in platform_name and not (
                                _d and _d in VALID_DISTRICTS.get(city_id, set())
                            ):
                                logger.debug(
                                    f"[{platform_name}] Skipping 京东浙江省级兜底未命中辖区: "
                                    f"district={_d!r} city_id={city_id} — {item.source_url}"
                                )
                                return "skipped_city", None
                            auction_item.city_id = city_id
                            auction_item.province_city = "宁波" if city_id == 330200 else "杭州"
                        else:
                            logger.debug(
                                f"[{platform_name}] Skipping non-target city: "
                                f"{pc} — {item.source_url}"
                            )
                            return "skipped_city", None

                        # district 白名单校验：解析出的辖区必须属于沪甬杭三市，否则判定为
                        # 「外省同名楼盘」（如昆明呈贡『上海·东盟』、青岛黄岛『上海东二路』、
                        # 北海海城『上海路』等——标题含『上海』但实为外省），直接跳过。
                        # 注：district 为空时不拦（部分房源未解析出区县，留给后续兜底）。
                        _dist = (auction_item.district or "").strip()
                        if _dist and _dist not in _ALL_VALID_DISTRICTS:
                            logger.info(
                                f"[{platform_name}] Skipping out-of-region (外省同名楼盘, "
                                f"district={_dist}): {(auction_item.title or '')[:36]} — {item.source_url}"
                            )
                            return "skipped_city", None

                        # Asset type filter: skip vehicles, equipment, goods (not real estate)
                        title = auction_item.title or ""
                        import re as _re_asset

                        # (a) 车牌号：整个标题就是一个车牌（如「浙BV53K7」「沪B975D5」）→ 动产，跳过
                        if _re_asset.match(
                            r"^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁]"
                            r"[A-Z][0-9A-Z]{4,6}$",
                            title.strip()
                        ):
                            logger.info(
                                f"[{platform_name}] Skipping license-plate: {title[:30]} — {item.source_url}"
                            )
                            return "skipped_non_real_estate", None

                        # (b) 动产/物品：标题以「放置于/放置在/存放于…」开头描述存放地点的动产，
                        #     或以「财物/财产/物资/等物品/一批」结尾 → 多为机器/库存/物品，非不动产。
                        #     注意：「动产」结尾必须排除「不动产」（真房产），用负向后顾断言。
                        if _re_asset.match(r"^(放置|存放)(于|在|的)", title) or \
                           _re_asset.search(r"(财物|财产|物资|等物品|一批|(?<!不)动产)\s*$", title):
                            logger.info(
                                f"[{platform_name}] Skipping movable-asset: {title[:36]} — {item.source_url}"
                            )
                            return "skipped_non_real_estate", None

                        # (b2) 「房屋内物品/室内物品」类纯动产：标题以「…物品」结尾，被拍主体是
                        #      屋内物品本身（动产），非不动产。必须排除「房屋及/房产及/…及室内物品」
                        #      「（含室内物品）」「…不动产」等连房带物的真房产打包标的——只要标题含
                        #      及/以及/不动产/房产/房地产/全幢/整幢 即视为真房产，予以保留。
                        #      例：「林碧云名下位于…201室房屋内物品」(纯物品) → 跳过；
                        #          「…602室及室内物品」「…（含室内物品）」(连房带物) → 保留。
                        if _re_asset.search(r"(房屋内物品|室内物品|屋内物品|房内物品)\s*$", title) and \
                           not _re_asset.search(r"(及|以及|不动产|房产|房地产|全幢|整幢)", title):
                            logger.info(
                                f"[{platform_name}] Skipping movable-asset (房屋内物品类纯动产): "
                                f"{title[:40]} — {item.source_url}"
                            )
                            return "skipped_non_real_estate", None

                        non_real_estate_kw = _re_asset.compile(
                            r"车牌|本田|奔驰|宝马|奥迪|大众|丰田|日产|路虎|保时捷|普通客车|轿车|商务车|货车|挖掘机|装载机|捷豹|荣威"
                            r"|越野车|牌小型|牌轿车|客车|摩托车|电动车|叉车|铲车|搅拌车|罐车|挂车|牌汽车|号牌"
                            r"|包装箱|集装箱|阻隔瓶|塑料桶|物资一批|设备一批|手机一批|电脑一批|电脑\d+台|塑料造粒机|生产设备|加工设备|办公设备"
                            r"|成型机|研磨机|钻床|加工中心|起重机|压缩机|车床|铣床|冲床|注塑机|空压机|发电机组|数控|电源柜"
                            r"|家具一套|红木家具|字画|书画|画一幅|花盆|笔筒|手表|名表|江诗丹顿|劳力士|包等物品|麻将包|古玩|瓷器|玉器"
                            r"|专利权|商标权|著作权|股权|股票|出资额|证券代码|充电设备|变压器|机器设备|生产线|存货"
                        )
                        real_estate_kw = _re_asset.compile(
                            r"室|号楼|栋|公寓|花园|小区|大厦|花苑|别墅|商铺|厂房|办公|住宅|住房|店铺|车位|楼盘|公馆|广场|宅基|宿舍|商业用房|工业用房|土地|地块|房产|房地产|不动产|幢|层"
                        )
                        if non_real_estate_kw.search(title) and not real_estate_kw.search(title):
                            logger.info(
                                f"[{platform_name}] Skipping non-real-estate: {title[:40]} — {item.source_url}"
                            )
                            return "skipped_non_real_estate", None

                        # 股权/出资额/证券类拍卖（非不动产）：标题含股权关键词且不含房产关键词时跳过
                        if _re_equity_auction.search(title) and not real_estate_kw.search(title):
                            logger.info(
                                f"[{platform_name}] Skipping equity/stock auction: {title[:40]} — {item.source_url}"
                            )
                            return "skipped_non_real_estate", None

                        # 正向兜底门槛：真实房源标题几乎都带具体地址要素（室/弄/幢/路X号/小区/
                        # 花园/店铺/乡镇/街道等）或房产词。若「面积≤0」且标题完全不含任何地址/
                        # 房产要素，则几乎一定是纯物品/设备/车辆类动产（如「加工中心一台(VF-855)」
                        # 「电脑2台」「摇臂钻床」），无需穷举设备名即可拦截。
                        _addr_feature = _re_asset.compile(
                            r"室|号楼|幢|栋|弄|座|路\d+|街道|[一-鿿]镇|[一-鿿]乡|[一-鿿]村|小区|花园|花苑|"
                            r"公寓|别墅|商铺|店铺|厂房|车位|车库|储藏室|土地|地块|房产|房地产|不动产|宗地|"
                            r"楼盘|商业用房|工业用房|名苑|嘉园|新村|公馆|广场|家园|号房|地下室|商住|住宅|"
                            r"公租房|安置房|经济适用房|银座|大厦|商厦|写字楼|号、"
                        )
                        _area_val = auction_item.area or 0
                        if _area_val <= 0 and not _addr_feature.search(title):
                            logger.info(
                                f"[{platform_name}] Skipping non-real-estate (无面积+无地址要素，疑似动产): "
                                f"{title[:40]} — {item.source_url}"
                            )
                            return "skipped_non_real_estate", None
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
                        # 归类失败原因并记入对应城市统计（不覆盖列表阶段已确定的登录/风控分类）
                        try:
                            detail_city = getattr(item, "city", None)
                            if detail_city and detail_city in city_stats:
                                if city_stats[detail_city]["failure_type"] is None:
                                    city_stats[detail_city]["failure_type"] = classify_error(e)
                        except Exception:
                            pass
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

            # 统计结果并按城市归类
            for idx, result in enumerate(results):
                # 获取该item对应的城市
                item_city = to_fetch[idx].city if idx < len(to_fetch) and hasattr(to_fetch[idx], 'city') and to_fetch[idx].city else None

                if isinstance(result, Exception):
                    platform_stats["failed"] += 1
                    if item_city and item_city in city_stats:
                        city_stats[item_city]["failed"] += 1
                elif result[0] == "created":
                    platform_stats["new"] += 1
                    if item_city and item_city in city_stats:
                        city_stats[item_city]["new"] += 1
                elif result[0] == "updated":
                    platform_stats["updated"] += 1
                    if item_city and item_city in city_stats:
                        city_stats[item_city]["updated"] += 1
                elif result[0] == "failed":
                    platform_stats["failed"] += 1
                    if item_city and item_city in city_stats:
                        city_stats[item_city]["failed"] += 1
                elif result[0] in ("skipped_city", "skipped", "skipped_non_real_estate"):
                    platform_stats["skipped"] += 1
                    if item_city and item_city in city_stats:
                        city_stats[item_city]["skipped"] += 1

            # Enrich newly created/updated properties with community data
            try:
                enriched = await DataEnricher.enrich_all_stale(db, limit=200)
                if enriched:
                    logger.info(f"[{platform_name}] Enriched {enriched} properties with community data")
            except Exception as e:
                logger.warning(f"[{platform_name}] Data enrichment failed: {e}")
                try:
                    await db.rollback()  # 重置可能被污染的事务，避免拖垮后续步骤/平台
                except Exception:
                    pass

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
                try:
                    await db.rollback()  # 重置可能被污染的事务，避免拖垮后续步骤/平台
                except Exception:
                    pass

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
                try:
                    await db.rollback()  # 重置可能被污染的事务，避免拖垮后续步骤/平台
                except Exception:
                    pass

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
                try:
                    await db.rollback()  # 重置可能被污染的事务，避免拖垮后续步骤/平台
                except Exception:
                    pass

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
                try:
                    await db.rollback()  # 重置可能被污染的事务，避免拖垮后续步骤/平台
                except Exception:
                    pass

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
                try:
                    await db.rollback()  # 重置可能被污染的事务，避免拖垮后续步骤/平台
                except Exception:
                    pass

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

        # 保存每个城市的详细统计到 crawler_task_details
        if self.task_id:
            for city_name, stats in city_stats.items():
                try:
                    duration = int(time.time() - stats["start_time"])
                    error_msg = "; ".join(stats["error_messages"]) if stats["error_messages"] else None

                    await CrawlerTaskDetailRepository.create_or_update(
                        db,
                        task_id=self.task_id,
                        platform=platform_name,
                        city=city_name,
                        total_fetched=stats["total_fetched"],
                        new_count=stats["new"],
                        updated_count=stats["updated"],
                        failed_count=stats["failed"],
                        skipped_count=stats["skipped"],
                        error_messages=error_msg,
                        duration_seconds=duration,
                        failure_type=stats.get("failure_type"),
                    )
                    await db.commit()
                    logger.info(
                        f"[{platform_name}][{city_name}] 详情已保存: "
                        f"抓取{stats['total_fetched']}, 新增{stats['new']}, "
                        f"更新{stats['updated']}, 失败{stats['failed']}"
                    )
                except Exception as e:
                    logger.error(f"保存任务详情失败 [{platform_name}][{city_name}]: {e}")

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
