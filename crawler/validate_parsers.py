"""Real-page validation script for all three auction platform parsers.

Run on the production server where Playwright is installed:
  cd /opt/fapai && source venv/bin/activate && python -m crawler.validate_parsers

Tests:
  1. List page collection — can we extract detail URLs from each platform?
  2. Detail page parsing — can we extract all ~45 fields from a sample detail page?
  3. Field coverage report — which fields populated vs. empty.
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Ensure package is importable
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger

# Redirect loguru to stdout for validation
logger.remove()
logger.add(sys.stdout, level="INFO", format="<green>{time:HH:mm:ss}</green> | <level>{level: <7}</level> | <level>{message}</level>")


# ============================================================
# Test URLs — real listings from each platform
# ============================================================
TEST_SOURCES = [
    {
        "name": "阿里拍卖 (淘宝司法)",
        "platform": "阿里拍卖",
        "city": "上海",
        "list_url": "https://sf.taobao.com/list/50025969____%C9%CF%BA%A3.htm",  # 上海住宅
        "list_type": "playwright",
        "parser_module": "crawler.parsers.taobao_detail",
        "parser_class": "TaobaoDetailParser",
        "crawler_module": "crawler.platforms.taobao",
        "crawler_class": "TaobaoSFCrawler",
        "city_id": 310000,
    },
    {
        "name": "京东拍卖",
        "platform": "京东拍卖",
        "city": "上海",
        "list_url": "https://pmsearch.jd.com/?publishSource=7&childrenCateId=12728",
        "list_type": "playwright",
        "parser_module": "crawler.parsers.jd_detail",
        "parser_class": "JDDetailParser",
        "crawler_module": "crawler.platforms.jd",
        "crawler_class": "JDAuctionCrawler",
        "city_id": 310000,
    },
    {
        "name": "公拍网",
        "platform": "公拍网",
        "city": "上海",
        "list_url": "https://s.gpai.net/sf/search.do?at=376&cityNum=31",
        "list_type": "httpx_then_playwright",
        "parser_module": "crawler.parsers.gpai_detail",
        "parser_class": "GPaiDetailParser",
        "crawler_module": "crawler.platforms.gpai",
        "crawler_class": "GPaiCrawler",
        "city_id": 310000,
    },
]

# All expected fields from AuctionItem (excluding image_urls, description, computed fields)
EXPECTED_FIELDS = [
    # Identity
    "title", "source_url", "auction_platform", "city_id", "province_city",
    # Location
    "district", "sub_district", "address", "community_name",
    # Property details
    "property_type", "area", "layout", "floor_info", "total_floors",
    "orientation", "decoration", "build_year", "has_elevator", "ring_road",
    # Prices
    "starting_price", "appraisal_price", "market_deal_price",
    "deposit", "increment_amount", "listing_min_price",
    "latest_total_price", "latest_deal_unit_price",
    # Auction
    "auction_round", "auction_status",
    "auction_start_time", "auction_end_time",
    # Court
    "court_name", "case_number",
    # Stats
    "view_count", "participant_count",
    # Booleans
    "loan_support", "has_attachments",
    # Dates
    "publish_date", "source_updated_at",
    # Computed (derived)
    "starting_unit_price", "market_deal_unit_price",
    "court_discount_rate", "market_discount_rate", "bargain_potential",
]

FIELD_LABELS = {
    # Critical fields
    "title": "标题", "source_url": "源URL", "auction_platform": "平台",
    "city_id": "城市", "province_city": "省/市",
    "district": "区域", "address": "地址", "community_name": "小区名",
    "property_type": "物业类型", "area": "面积", "layout": "户型",
    "starting_price": "起拍价", "appraisal_price": "评估价",
    "auction_round": "拍卖轮次", "auction_status": "拍卖状态",
    "auction_start_time": "开拍时间", "court_name": "法院",
    # Important fields
    "deposit": "保证金", "market_deal_price": "市场价",
    "increment_amount": "加价幅度", "case_number": "案号",
    "sub_district": "板块", "floor_info": "楼层",
    "total_floors": "总楼层", "orientation": "朝向",
    "decoration": "装修", "build_year": "建筑年代",
    "has_elevator": "电梯", "ring_road": "环线",
    "view_count": "围观人数", "participant_count": "参拍人数",
    "loan_support": "支持贷款", "has_attachments": "有附件",
    "auction_end_time": "结束时间",
    "listing_min_price": "挂牌价", "latest_total_price": "最新成交价",
    "latest_deal_unit_price": "最新成交单价",
    "publish_date": "发布日期", "source_updated_at": "数据更新时间",
    "starting_unit_price": "起拍单价", "market_deal_unit_price": "市场单价",
    "court_discount_rate": "法院折扣率", "market_discount_rate": "市场折扣率",
    "bargain_potential": "捡漏空间",
    "image_urls": "图片URLs", "description": "描述",
}


class ValidationReport:
    """Track extraction results for a single test."""

    def __init__(self, platform_name: str):
        self.platform = platform_name
        self.list_items_found = 0
        self.list_error: str | None = None
        self.detail_url: str = ""
        self.detail_html_size = 0
        self.detail_error: str | None = None
        self.fields_populated: set[str] = set()
        self.fields_empty: set[str] = set()
        self.field_values: dict[str, str] = {}

    def record_field(self, name: str, value) -> None:
        if value is None or value == "" or value == 0 or value == 0.0 or value is False:
            self.fields_empty.add(name)
        else:
            self.fields_populated.add(name)
            self.field_values[name] = str(value)[:80]

    def print_report(self) -> None:
        total = len(self.fields_populated) + len(self.fields_empty)
        rate = len(self.fields_populated) / max(total, 1) * 100

        print(f"\n{'='*60}")
        print(f"  {self.platform} — 解析验证报告")
        print(f"{'='*60}")

        print(f"\n  📋 列表页: ", end="")
        if self.list_error:
            print(f"❌ 失败 — {self.list_error}")
        else:
            print(f"✅ 获取 {self.list_items_found} 条房源")

        print(f"  📄 详情页: ", end="")
        if self.detail_error:
            print(f"❌ 失败 — {self.detail_error}")
        else:
            print(f"✅ {self.detail_html_size} bytes")

        print(f"\n  📊 字段覆盖率: {len(self.fields_populated)}/{total} ({rate:.0f}%)")
        print(f"  {'─'*40}")

        CRITICAL_FIELDS = {
            "title", "district", "address", "property_type", "area", "layout",
            "starting_price", "appraisal_price", "auction_round", "auction_status",
            "auction_start_time", "court_name",
        }
        IMPORTANT_FIELDS = {
            "deposit", "market_deal_price", "community_name", "floor_info",
            "orientation", "decoration", "build_year", "case_number",
            "view_count", "total_floors", "has_elevator",
        }

        print(f"  ✅ 关键字段已填充:")
        for f in sorted(self.fields_populated):
            label = FIELD_LABELS.get(f, f)
            marker = ""
            if f in CRITICAL_FIELDS:
                marker = "🔴"
            elif f in IMPORTANT_FIELDS:
                marker = "🟡"
            val = self.field_values.get(f, "")
            if len(val) > 60:
                val = val[:57] + "..."
            print(f"     {marker} {label}: {val}")

        missing_critical = self.fields_empty & CRITICAL_FIELDS
        missing_important = self.fields_empty & IMPORTANT_FIELDS

        if missing_critical:
            print(f"\n  ❌ 缺失关键字段: {', '.join(FIELD_LABELS.get(f, f) for f in sorted(missing_critical))}")
        if missing_important:
            print(f"  ⚠️  缺失重要字段: {', '.join(FIELD_LABELS.get(f, f) for f in sorted(missing_important))}")

        remaining = self.fields_empty - CRITICAL_FIELDS - IMPORTANT_FIELDS
        if remaining:
            print(f"  ℹ️  未填充次要字段: {', '.join(FIELD_LABELS.get(f, f) for f in sorted(remaining))}")
        print()


async def validate_platform(config: dict) -> ValidationReport:
    """Validate one platform: list -> detail -> parse."""
    report = ValidationReport(config["name"])

    # Import platform-specific classes
    try:
        parser_mod = __import__(config["parser_module"], fromlist=[config["parser_class"]])
        parser_cls = getattr(parser_mod, config["parser_class"])

        crawler_mod = __import__(config["crawler_module"], fromlist=[config["crawler_class"]])
        crawler_cls = getattr(crawler_mod, config["crawler_class"])
    except Exception as e:
        report.list_error = f"导入失败: {e}"
        return report

    from crawler.browser import browser_manager

    crawler = crawler_cls()
    parser = parser_cls()

    try:
        # ===== STEP 1: Collect list items =====
        logger.info(f"[{config['name']}] 开始抓取列表页...")
        list_items = await crawler.collect_list_items(
            config["list_url"], config["city"], max_pages=1
        )
        report.list_items_found = len(list_items)

        if not list_items:
            report.list_error = "未找到任何房源链接"
            return report

        # Take the first item that has a valid URL
        detail_url = ""
        for item in list_items:
            if item.source_url and item.source_url.startswith("http"):
                detail_url = item.source_url
                break

        if not detail_url:
            report.list_error = "列表项缺少有效URL"
            return report

        report.detail_url = detail_url[:120]
        logger.info(f"[{config['name']}] 详情页: {detail_url[:100]}")

        # ===== STEP 2: Fetch detail page =====
        html = await crawler.fetch_detail(detail_url)
        report.detail_html_size = len(html)

        # Save a sample of the HTML for debugging
        debug_dir = Path("/tmp/crawler_debug")
        debug_dir.mkdir(exist_ok=True)
        slug = config["platform"].replace(" ", "_")
        html_path = debug_dir / f"{slug}_detail.html"
        html_path.write_text(html[:50000], encoding="utf-8")
        logger.info(f"[{config['name']}] HTML样本已保存: {html_path}")

        # ===== STEP 3: Parse =====
        auction_item = await parser.parse(html, detail_url, config["city_id"])

        # ===== STEP 4: Record field coverage =====
        for field in EXPECTED_FIELDS:
            value = getattr(auction_item, field, None)
            report.record_field(field, value)

        # Also check images
        imgs = getattr(auction_item, "image_urls", [])
        if imgs:
            report.record_field("image_urls", f"{len(imgs)} images")

        desc = getattr(auction_item, "description", "")
        if desc and desc.strip() and desc != "【扩展信息】{}":
            report.record_field("description", desc[:80])

    except Exception as e:
        import traceback
        report.detail_error = f"{type(e).__name__}: {e}"
        logger.error(f"[{config['name']}] 异常: {traceback.format_exc()}")
    finally:
        await crawler.close()

    return report


async def main():
    from crawler.browser import browser_manager

    print("\n" + "=" * 60)
    print("  法拍爬虫 — 真实页面验证")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 60)

    await browser_manager.start()
    reports = []

    for config in TEST_SOURCES:
        try:
            report = await validate_platform(config)
            reports.append(report)
            report.print_report()
        except Exception as e:
            logger.error(f"[{config['name']}] 致命错误: {e}")
            import traceback
            traceback.print_exc()

    await browser_manager.stop()

    # ===== SUMMARY =====
    print(f"\n{'='*60}")
    print(f"  总结")
    print(f"{'='*60}")
    for r in reports:
        total = len(r.fields_populated) + len(r.fields_empty)
        rate = len(r.fields_populated) / max(total, 1) * 100
        status = "✅" if r.list_items_found > 0 and not r.detail_error else "❌"
        print(f"  {status} {r.platform}: 列表{r.list_items_found}条 | 字段{rate:.0f}% ({len(r.fields_populated)}/{total})")
    print()


if __name__ == "__main__":
    asyncio.run(main())
