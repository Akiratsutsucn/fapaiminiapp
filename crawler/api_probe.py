"""Targeted API probe — captures full JSON responses from GPai and JD mobile APIs."""
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger
logger.remove()
logger.add(sys.stdout, level="INFO", format="<green>{time:HH:mm:ss}</green> | <level>{message}</level>")


async def probe_gpai_api():
    """Use Playwright to capture the full searchMore2 API response."""
    from crawler.browser import browser_manager

    await browser_manager.start()
    page = await browser_manager.new_page()

    # Intercept the searchMore2 response
    api_responses = []

    async def on_response(response):
        if "searchMore2" in response.url:
            try:
                body = await response.text()
                api_responses.append({"url": response.url, "body": body})
                logger.info(f"Captured searchMore2 response: {len(body)} bytes")
            except Exception as e:
                logger.error(f"Failed to capture: {e}")

    page.on("response", on_response)

    logger.info("Loading GPai search page...")
    await page.goto("https://s.gpai.net/sf/search.do?at=01&cityNum=00",
                    wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)  # Wait for JS to execute and API calls to complete

    # Also try to manually call the API via fetch
    logger.info("Trying manual API call via fetch...")
    try:
        result = await page.evaluate("""
        async () => {
            try {
                const resp = await fetch('/api/searchMore2?at=01&cityNum=00&page=1&pageSize=5',
                    {headers: {'Accept': 'application/json'}});
                const text = await resp.text();
                return text.substring(0, 3000);
            } catch(e) {
                return 'Error: ' + e.message;
            }
        }
        """)
        logger.info(f"Manual fetch result: {result[:500]}")
    except Exception as e:
        logger.error(f"Manual fetch failed: {e}")

    await page.close()
    await browser_manager.stop()

    # Save captured responses
    out = Path("/tmp/crawler_diagnostic/gpai_api_response.json")
    out.write_text(json.dumps(api_responses, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Saved {len(api_responses)} API responses to {out}")

    if api_responses:
        # Parse and display first response
        data = json.loads(api_responses[0]["body"])
        items = data.get("data", {}).get("list", [])
        logger.info(f"API returned {len(items)} items")
        if items:
            logger.info(f"First item keys: {list(items[0].keys())}")
            logger.info(f"First item: {json.dumps(items[0], ensure_ascii=False)[:1000]}")


async def probe_jd_api():
    """Test JD mobile API with correct parameters."""
    from playwright.async_api import async_playwright
    import httpx

    logger.info("Testing JD mobile API...")

    # The areaId for Shanghai is 2 (from getAreaInfoMap)
    # childrenCateId 12728 = 住宅用房
    async with httpx.AsyncClient(timeout=30) as client:
        # Test 1: Search API
        search_url = "https://api.m.jd.com/api"
        search_params = {
            "appid": "paimai",
            "functionId": "gePublicSearchResData",
            "body": json.dumps({
                "areaId": 2,  # Shanghai
                "pageSize": 10,
                "page": 1,
                "childrenCateId": 12728,  # 住宅用房
                "publishSource": 7,  # judicial
            }),
            "jsonp": "test",
        }
        try:
            resp = await client.get(search_url, params=search_params, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
                "Referer": "https://pmsearch.jd.com/",
                "Accept": "application/json",
            })
            logger.info(f"JD Search API: status={resp.status_code}, len={len(resp.text)}")
            # Parse JSONP
            text = resp.text
            if text.startswith("test("):
                text = text[5:-1]  # remove jsonp wrapper
            data = json.loads(text)
            logger.info(f"JD Search response: code={data.get('code')}, message={data.get('message')}")
            datas = data.get("datas", [])
            logger.info(f"Items returned: {len(datas)}")
            if datas:
                logger.info(f"First item keys: {list(datas[0].keys())}")
                logger.info(f"First item: {json.dumps(datas[0], ensure_ascii=False)[:800]}")
        except Exception as e:
            logger.error(f"JD Search API failed: {e}")

        # Test 2: Try with different areaId formats
        for area_id in [2, "2", 4600001]:
            search_params["body"] = json.dumps({"areaId": area_id, "pageSize": 5, "page": 1})
            try:
                resp = await client.get(search_url, params=search_params, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
                })
                text = resp.text
                if text.startswith("test("):
                    text = text[5:-1]
                data = json.loads(text)
                logger.info(f"  areaId={area_id}: code={data.get('code')}, items={len(data.get('datas', []))}, msg={data.get('message', '')[:80]}")
            except Exception as e:
                logger.error(f"  areaId={area_id}: {e}")


async def main():
    print("\n" + "=" * 60)
    print("  API Probe — 法拍爬虫")
    print("=" * 60)

    logger.info("=== Phase 1: GPai API ===")
    await probe_gpai_api()

    logger.info("\n=== Phase 2: JD Mobile API ===")
    await probe_jd_api()

    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
