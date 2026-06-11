"""Test PaiMai SSR detail page — comprehensive extraction attempt.

Strategies tried:
  1. Navigate search page first to warm up session / solve captcha
  2. Navigate detail page, wait for DOM content
  3. If skeleton detected, reload page (captcha cookies may now be set)
  4. Extract data from <script> tags, window variables, rendered DOM
  5. Capture MTOP detail API responses from network
"""
import asyncio
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Read cookie from .env
env_path = '/opt/fapai/.env'
cookie = ''
with open(env_path) as f:
    for line in f:
        if line.startswith('TAOBAO_COOKIE='):
            cookie = line.split('=', 1)[1].strip()
            break


def parse_cookies(cookie_str: str) -> list[dict]:
    cookies = []
    for pair in cookie_str.split(';'):
        pair = pair.strip()
        if '=' in pair:
            name, value = pair.split('=', 1)
            cookies.append({
                'name': name.strip(),
                'value': value.strip(),
                'domain': '.taobao.com',
                'path': '/',
            })
    return cookies


SEARCH_URL = (
    'https://pages-fast.m.taobao.com/wow/z/app/pm/search-ssr/search'
    '?x-ssr=true&disableNav=YES'
)

DETAIL_URL_TMPL = (
    'https://pages-fast.m.taobao.com/wow/z/app/pm/dzc-ice/dzc-detail'
    '?x-ssr=true&disableNav=YES&x-preload=true&forceThemis=true'
    '&skeleton=true&itemId={item_id}'
)

ITEM_IDS = [
    '1046317979782',  # 上海 松江 商铺
    '1043323992605',  # another item
]


async def main():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 414, 'height': 896},
            user_agent=(
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
                'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 '
                'Mobile/15E148 Safari/604.1'
            ),
            locale='zh-CN',
        )

        cookies_list = parse_cookies(cookie)
        if cookies_list:
            await context.add_cookies(cookies_list)
            print(f'Added {len(cookies_list)} cookies')

        # Collect all MTOP API responses
        mtop_responses = []
        all_mtop_urls = set()

        async def on_response(response):
            url = response.url
            if 'mtop' in url.lower() or 'queryHttpsItemDetail' in url:
                all_mtop_urls.add(url[:120])
                try:
                    body = await response.text()
                    mtop_responses.append({
                        'url': url[:150],
                        'status': response.status,
                        'body': body[:600],
                    })
                except Exception:
                    pass

        page = await context.new_page()
        page.on('response', on_response)

        # ---- Strategy 1: Warm up session with search page ----
        print('=' * 60)
        print('Phase 1: Warm up with search page')
        print('=' * 60)
        try:
            await page.goto(SEARCH_URL, wait_until='networkidle', timeout=45000)
            await asyncio.sleep(3)
            search_text = await page.evaluate('() => document.body.innerText')
            print(f'Search page body: {len(search_text)} chars')
            print(f'Search preview: {search_text[:300]}')
        except Exception as e:
            print(f'Search page error: {e}')

        # ---- Strategy 2: Load detail page ----
        item_id = ITEM_IDS[0]
        detail_url = DETAIL_URL_TMPL.format(item_id=item_id)

        print()
        print('=' * 60)
        print(f'Phase 2: Load detail page for item {item_id}')
        print('=' * 60)

        for attempt in range(3):
            mtop_responses.clear()
            all_mtop_urls.clear()

            print(f'\n--- Attempt {attempt + 1} ---')
            try:
                await page.goto(detail_url, wait_until='networkidle', timeout=60000)
            except Exception as e:
                print(f'  goto error: {e}')

            await asyncio.sleep(5)

            # Check what rendered
            data = await page.evaluate('''() => {
                const r = {};
                r.bodyLen = document.body.innerText.length;
                r.bodyPreview = document.body.innerText.substring(0, 500);

                // Check for skeleton
                r.hasSkeleton = document.body.innerText.includes('测试请不要拍');
                r.isLoading = !!document.querySelector('.skeleton, [class*="skeleton"], [class*="Skeleton"]');
                r.hasPrice = /\\d/.test(document.body.innerText);

                // Find all script tags
                const scripts = document.querySelectorAll('script');
                r.scriptCount = scripts.length;
                r.scriptsWithData = [];
                for (const s of scripts) {
                    const text = s.textContent || '';
                    if (text.includes('itemId') || text.includes('auctionTitle') ||
                        text.includes('startPrice') || text.includes('"data"')) {
                        r.scriptsWithData.push(text.substring(0, 300));
                    }
                }

                // Window-level data stores
                r.windowKeys = [];
                for (const key of Object.keys(window)) {
                    if (key.includes('DATA') || key.includes('STATE') || key.includes('PRELOAD') ||
                        key.includes('STORE') || key.includes('MODEL') || key.includes('APP') ||
                        key.startsWith('__')) {
                        try {
                            const val = window[key];
                            r.windowKeys.push(key + ': ' + typeof val);
                        } catch(e) {}
                    }
                }

                // React root content
                const root = document.getElementById('root');
                if (root) {
                    r.rootChildren = root.children.length;
                    r.rootHTML = root.innerHTML.substring(0, 500);
                    r.rootText = root.innerText.substring(0, 300);
                }

                // Check for next.js or ice data
                for (const key of ['__NEXT_DATA__', '__ICE_APP_DATA__', '__ICE_SSR_DATA__',
                                    '__INITIAL_STATE__', '__PRELOADED_STATE__']) {
                    if (window[key]) {
                        try {
                            r[key] = JSON.stringify(window[key]).substring(0, 500);
                        } catch(e) {}
                    }
                }

                return r;
            }''')

            print(f'  Body length: {data["bodyLen"]}')
            print(f'  Has skeleton text: {data.get("hasSkeleton", "N/A")}')
            print(f'  Has price digits: {data.get("hasPrice", "N/A")}')
            print(f'  Root children: {data.get("rootChildren", "N/A")}')
            print(f'  Root text: {data.get("rootText", "N/A")[:200]}')
            print(f'  Script count: {data.get("scriptCount", "N/A")}')
            print(f'  Scripts with data: {len(data.get("scriptsWithData", []))}')
            for s in data.get('scriptsWithData', []):
                print(f'    SCRIPT: {s[:200]}')
            print(f'  Window keys: {data.get("windowKeys", [])}')
            for k in ['__NEXT_DATA__', '__ICE_APP_DATA__', '__ICE_SSR_DATA__',
                       '__INITIAL_STATE__', '__PRELOADED_STATE__']:
                if k in data:
                    print(f'  {k}: {data[k][:300]}')

            # Check body preview
            print(f'\n  Body preview: {data.get("bodyPreview", "")[:400]}')

            # Network responses
            print(f'\n  MTOP responses captured: {len(mtop_responses)}')
            print(f'  Unique MTOP URLs: {len(all_mtop_urls)}')
            for url in sorted(all_mtop_urls):
                print(f'    {url[:120]}')
            for r in mtop_responses:
                print(f'    [{r["status"]}] {r["url"][:100]}')
                print(f'      Body: {r["body"][:300]}')

            # If we got real data, break
            if data['bodyLen'] > 100 and data.get('hasPrice'):
                print('\n  >>> SUCCESS: Detail page rendered with data!')
                break

            if not data.get('hasSkeleton') and data['bodyLen'] > 100:
                print('\n  >>> Partial success: No skeleton, some content')
                break

            print('\n  >>> Skeleton detected, waiting 8s then retrying...')
            await asyncio.sleep(8)

        # ---- Strategy 3: Extract everything available ----
        print()
        print('=' * 60)
        print('Phase 3: Deep extraction')
        print('=' * 60)

        final = await page.evaluate('''() => {
            const r = {};

            // All text content
            r.fullBody = document.body.innerText.substring(0, 2000);

            // All image URLs
            const imgs = document.querySelectorAll('img[src]');
            r.imageUrls = Array.from(imgs).map(i => i.src).filter(s => s.startsWith('http')).slice(0, 20);

            // Links
            const links = document.querySelectorAll('a[href]');
            r.links = Array.from(links).map(a => ({href: a.href.substring(0, 120), text: a.innerText.substring(0, 60)})).slice(0, 20);

            // Meta
            const metas = document.querySelectorAll('meta');
            r.metas = Array.from(metas).map(m => ({
                name: m.getAttribute('name') || m.getAttribute('property') || '',
                content: (m.getAttribute('content') || '').substring(0, 150)
            })).filter(m => m.content);

            // All data attributes on root-level elements
            const dataAttrs = document.querySelectorAll('[data-spm], [data-id], [data-item-id], [data-itemid]');
            r.dataAttrs = Array.from(dataAttrs).map(el => ({
                tag: el.tagName,
                spm: el.getAttribute('data-spm'),
                id: el.getAttribute('data-id') || el.getAttribute('data-item-id') || el.getAttribute('data-itemid'),
            }));

            // Try to access any module/component state
            r.allWindowKeys = [];
            for (const key of Object.getOwnPropertyNames(window).slice(0, 200)) {
                r.allWindowKeys.push(key);
            }

            return r;
        }''')

        print(f'Full body ({len(final["fullBody"])} chars):')
        print(final['fullBody'][:1000])
        print(f'\nImages ({len(final["imageUrls"])}):')
        for url in final['imageUrls'][:10]:
            print(f'  {url}')
        print(f'\nLinks ({len(final["links"])}):')
        for link in final['links'][:10]:
            print(f'  {link["href"]} | {link["text"]}')
        print(f'\nMeta tags: {final["metas"]}')
        print(f'\nData attrs: {final["dataAttrs"]}')

        # Check relevant window keys
        relevant = [k for k in final.get('allWindowKeys', [])
                    if any(term in k.lower() for term in
                           ['data', 'state', 'store', 'model', 'preload', 'ssr', 'ice', 'react', 'app', 'config'])]
        print(f'\nRelevant window keys: {relevant[:30]}')

        await browser.close()


asyncio.run(main())
