"""Page structure diagnostic tool — saves screenshots + HTML + network logs for debugging.

Usage (on server):
  cd /opt/fapai && source venv/bin/activate && python -m crawler.diagnose_pages
"""
import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger
logger.remove()
logger.add(sys.stdout, level="INFO", format="<green>{time:HH:mm:ss}</green> | <level>{message}</level>")


DIAGNOSTIC_TASKS = [
    {
        "name": "taobao_list",
        "label": "阿里拍卖-列表页",
        "url": "https://sf.taobao.com/list/50025969____%C9%CF%BA%A3.htm",
        "wait_selector": "div.sf-content, div.item-list, div.J_ItemList",
        "wait_ms": 5000,
    },
    {
        "name": "jd_list",
        "label": "京东拍卖-列表页",
        "url": "https://pmsearch.jd.com/?publishSource=7&childrenCateId=12728",
        "wait_selector": "div[class*='card'], div[class*='item'], div[class*='list']",
        "wait_ms": 5000,
    },
    {
        "name": "gpai_list",
        "label": "公拍网-列表页",
        "url": "https://s.gpai.net/sf/search.do?at=01&cityNum=00",
        "wait_selector": "table, div.search-item, div.result-item",
        "wait_ms": 3000,
    },
]


async def diagnose_list_page(page, task: dict, out_dir: Path) -> list[dict]:
    """Load a list page, capture everything useful for debugging."""
    logger.info(f"[{task['label']}] 加载中...")

    # Collect XHR/Fetch responses
    network_logs: list[dict] = []

    async def log_response(response):
        try:
            url = response.url
            ct = response.headers.get("content-type", "")
            status = response.status
            if "json" in ct or "javascript" in ct or "text/html" in ct or "xml" in ct:
                try:
                    body = await response.text()
                    body_preview = body[:500] if body else ""
                except Exception:
                    body_preview = "<binary>"
                network_logs.append({
                    "url": url[:200],
                    "status": status,
                    "content_type": ct[:80],
                    "body_preview": body_preview[:300],
                })
        except Exception:
            pass

    page.on("response", log_response)

    try:
        await page.goto(task["url"], wait_until="domcontentloaded", timeout=30000)
    except Exception as e:
        logger.error(f"[{task['label']}] 页面加载超时: {e}")
        return []

    # Wait for content
    if task.get("wait_selector"):
        try:
            await page.wait_for_selector(task["wait_selector"], timeout=10000)
            logger.info(f"[{task['label']}] 选择器匹配成功: {task['wait_selector']}")
        except Exception:
            logger.warning(f"[{task['label']}] 选择器未匹配: {task['wait_selector']}")

    await asyncio.sleep(task.get("wait_ms", 3000) / 1000)
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    await asyncio.sleep(1.5)
    await page.evaluate("window.scrollTo(0, 0)")
    await asyncio.sleep(0.5)

    # Screenshot
    ss_path = out_dir / f"{task['name']}.png"
    try:
        await page.screenshot(path=str(ss_path), full_page=True)
        logger.info(f"[{task['label']}] 截图已保存: {ss_path}")
    except Exception as e:
        logger.warning(f"[{task['label']}] 截图失败: {e}")

    # Save full HTML
    html_path = out_dir / f"{task['name']}.html"
    html = await page.content()
    html_path.write_text(html, encoding="utf-8")
    logger.info(f"[{task['label']}] HTML已保存: {html_path} ({len(html)} bytes)")

    # ===== Extract ALL links, grouped by pattern =====
    links_data = await page.evaluate("""
    () => {
        const links = [];
        const seen = new Set();
        document.querySelectorAll('a[href]').forEach(a => {
            const href = (a.href || '').trim();
            if (!href || !href.startsWith('http') || seen.has(href)) return;
            seen.add(href);
            links.push({
                href: href.substring(0, 250),
                text: (a.textContent || '').trim().substring(0, 100),
                cls: (a.className || '').substring(0, 80),
                parent_tag: a.parentElement ? a.parentElement.tagName : '',
                parent_cls: a.parentElement ? (a.parentElement.className || '').substring(0, 80) : '',
            });
        });
        return links;
    }
    """)

    # Group links by URL domain pattern
    from collections import Counter
    pattern_counts = Counter()
    for link in links_data:
        href = link["href"]
        if "taobao" in href:
            if "/item" in href or "sf-item" in href:
                pattern_counts["taobao_detail"] += 1
            else:
                pattern_counts["taobao_other"] += 1
        elif "paimai.jd.com" in href:
            if "notice" in href:
                pattern_counts["jd_notice"] += 1
            elif "detail" in href or "auction" in href:
                pattern_counts["jd_detail"] += 1
            else:
                pattern_counts["jd_other"] += 1
        elif "gpai.net" in href:
            if "item.do" in href or "sf/item" in href:
                pattern_counts["gpai_detail"] += 1
            else:
                pattern_counts["gpai_other"] += 1
        else:
            pattern_counts["other_domain"] += 1

    logger.info(f"[{task['label']}] 链接分类: {dict(pattern_counts)}")

    # Print sample links from each category
    for pattern in ["taobao_detail", "jd_detail", "jd_notice", "gpai_detail"]:
        samples = [l for l in links_data if _match_pattern(l["href"], pattern)]
        if samples:
            logger.info(f"  [{pattern}] {len(samples)} links, sample: {samples[0]['href'][:120]}")
            logger.info(f"    text='{samples[0]['text'][:80]}' parent_cls='{samples[0]['parent_cls'][:60]}'")

    # ===== Look for embedded JSON data (__INITIAL_STATE__, __NEXT_DATA__, etc.) =====
    embedded = await page.evaluate("""
    () => {
        const results = {};
        const jsonPatterns = ['__INITIAL_STATE__', '__NEXT_DATA__', '__NUXT__',
            'window.__DATA__', 'window.__PRELOADED_STATE__', '__APP_DATA__',
            'window._DATA_', 'window.g_initialProps'];
        for (const key of jsonPatterns) {
            try {
                const val = eval(key);
                if (val) {
                    results[key] = JSON.stringify(val).substring(0, 2000);
                }
            } catch(e) {}
        }
        // Also check all script tags with JSON
        document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]').forEach((s, i) => {
            results['script_json_' + i] = (s.textContent || '').substring(0, 1000);
        });
        // Check for data in window object
        for (const key of Object.keys(window)) {
            if (key.startsWith('_') && typeof window[key] === 'object' && window[key] !== null && key !== 'window') {
                try {
                    const s = JSON.stringify(window[key]);
                    if (s.length > 100 && s.length < 5000) {
                        results['window.' + key] = s.substring(0, 1000);
                    }
                } catch(e) {}
            }
        }
        return results;
    }
    """)
    if embedded:
        logger.info(f"[{task['label']}] 发现内嵌数据: {list(embedded.keys())}")
        for key, val in embedded.items():
            logger.info(f"  {key}: {val[:300]}...")

    # ===== DOM analysis =====
    dom_info = await page.evaluate("""
    () => {
        const info = {};
        const text = document.body.textContent || '';

        // Key containers
        ['div.sf-content', 'div.pm-list', 'div.auction-list',
         'div[class*="card"]', 'table.search-result', 'div.search-item',
         'div.J_ItemList', 'div[data-spm]'].forEach(sel => {
            const count = document.querySelectorAll(sel).length;
            if (count > 0) info['found_' + sel.replace(/[^a-zA-Z0-9_-]/g, '_')] = count;
        });

        info.has_auction_keywords = /一拍|二拍|变卖/.test(text);
        info.has_status = /即将开拍|进行中|已结束|已成交/.test(text);
        info.has_price = /起拍价|评估价/.test(text);
        info.has_login = /亲，请登录|请登录|login/.test(text);
        info.body_text_len = text.length;
        info.body_sample = text.substring(0, 600).replace(/\\s+/g, ' ');

        return info;
    }
    """)
    logger.info(f"[{task['label']}] DOM分析: {json.dumps(dom_info, ensure_ascii=False, default=str)[:500]}")
    logger.info(f"[{task['label']}] 页面文本: {dom_info.get('body_sample', '')[:300]}")

    # ===== Save network logs =====
    net_path = out_dir / f"{task['name']}_network.json"
    net_path.write_text(json.dumps(network_logs, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"[{task['label']}] 网络请求日志: {net_path} ({len(network_logs)} entries)")

    # Filter network log for interesting entries
    interesting = [
        e for e in network_logs
        if "json" in e.get("content_type", "") or "auction" in e.get("url", "").lower()
        or "api" in e.get("url", "").lower() or "search" in e.get("url", "").lower()
    ]
    if interesting:
        logger.info(f"[{task['label']}] 可疑API请求: {len(interesting)}")
        for entry in interesting[:5]:
            logger.info(f"  {entry['url'][:150]} -> {entry['status']}")
            if entry.get("body_preview"):
                logger.info(f"    body: {entry['body_preview'][:200]}")

    return links_data


def _match_pattern(href: str, pattern: str) -> bool:
    if pattern == "taobao_detail":
        return ("/item" in href or "sf-item" in href) and "taobao" in href
    elif pattern == "jd_detail":
        return "paimai.jd.com" in href and ("detail" in href or "auction" in href) and "notice" not in href
    elif pattern == "jd_notice":
        return "paimai.jd.com" in href and "notice" in href
    elif pattern == "gpai_detail":
        return "gpai.net" in href and ("item.do" in href or "sf/item" in href)
    return False


async def main():
    from crawler.browser import browser_manager

    out_dir = Path("/tmp/crawler_diagnostic")
    out_dir.mkdir(exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  法拍爬虫 — 页面结构诊断 v2")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  输出目录: {out_dir}")
    print(f"{'='*60}\n")

    await browser_manager.start()
    page = await browser_manager.new_page()

    for task in DIAGNOSTIC_TASKS:
        try:
            await diagnose_list_page(page, task, out_dir)
        except Exception as e:
            logger.error(f"[{task['label']}] 诊断失败: {e}")
            import traceback
            traceback.print_exc()

    await page.close()
    await browser_manager.stop()

    print(f"\n{'='*60}")
    print(f"  诊断完成 — 文件保存在: {out_dir}")
    print(f"{'='*60}")
    for f in sorted(out_dir.glob("*")):
        size = f.stat().st_size
        print(f"  {f.name} ({size:,} bytes)")


if __name__ == "__main__":
    asyncio.run(main())
