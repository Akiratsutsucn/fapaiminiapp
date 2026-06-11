"""Explore PaiMai SSR detail page DOM to find embedded auction data.

This script navigates to a PaiMai detail page, waits for full render,
and searches for where the auction data is stored.
"""
import asyncio, json, re, sys, os

# Read cookie from .env
env_path = '/opt/fapai/.env'
cookie = ''
with open(env_path) as f:
    for line in f:
        if line.startswith('TAOBAO_COOKIE='):
            cookie = line.split('=', 1)[1].strip()
            break


async def main():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        # Add cookies
        cookies_list = []
        for pair in cookie.split(';'):
            pair = pair.strip()
            if '=' in pair:
                name, value = pair.split('=', 1)
                cookies_list.append({
                    'name': name.strip(),
                    'value': value.strip(),
                    'domain': '.taobao.com',
                    'path': '/',
                })
        if cookies_list:
            await context.add_cookies(cookies_list)

        page = await context.new_page()

        # Collect network responses to find API data
        api_responses = []

        async def on_response(response):
            if 'mtop' in response.url.lower() or 'queryHttpsItemDetail' in response.url:
                try:
                    body = await response.text()
                    api_responses.append({
                        'url': response.url,
                        'status': response.status,
                        'body': body[:500],
                    })
                except:
                    pass

        page.on('response', on_response)

        url = (
            'https://pages-fast.m.taobao.com/wow/z/app/pm/dzc-ice/dzc-detail'
            '?x-ssr=true&disableNav=YES&x-preload=true&forceThemis=true'
            '&skeleton=true&itemId=1046317979782'
        )

        print('Loading page...')
        await page.goto(url, wait_until='networkidle', timeout=60000)
        await asyncio.sleep(5)

        # Check API responses captured
        print(f'\nAPI responses captured: {len(api_responses)}')
        for r in api_responses:
            print(f"  {r['status']} {r['url'][:100]}...")
            print(f"  Body preview: {r['body'][:300]}")

        # Extract data from DOM
        data = await page.evaluate('''() => {
            const r = {};

            // 1. Try to get data from React component state or Redux store
            r.bodyTextLen = document.body.innerText.length;

            // 2. Look for embedded JSON in script tags
            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
                const text = s.textContent || '';
                if (text.includes('"itemId"') && text.length < 100000) {
                    r.scriptWithItemId = text.substring(0, 500);
                    break;
                }
            }

            // 3. Try to get data from page data attributes
            const rootEl = document.getElementById('root') || document.querySelector('[data-spm]');
            if (rootEl) {
                r.rootHTML = rootEl.innerHTML ? rootEl.innerHTML.substring(0, 500) : 'empty';
            }

            // 4. Look for __INITIAL_STATE__ or similar
            for (const key of Object.keys(window)) {
                if (key.includes('DATA') || key.includes('STATE') || key.includes('PRELOAD')) {
                    try {
                        const val = window[key];
                        if (typeof val === 'object' && val !== null) {
                            r[key] = JSON.stringify(val).substring(0, 300);
                        } else if (typeof val === 'string' && val.length > 50) {
                            r[key] = val.substring(0, 300);
                        }
                    } catch(e) {}
                }
            }

            // 5. Check meta tags
            const metas = document.querySelectorAll('meta');
            for (const m of metas) {
                const name = m.getAttribute('name') || m.getAttribute('property') || '';
                const content = m.getAttribute('content') || '';
                if (content && content.length > 10) {
                    r['meta_' + name] = content.substring(0, 200);
                }
            }

            // 6. Check for text content that looks like auction data
            const bodyText = document.body.innerText;
            if (bodyText.length > 10) {
                r.bodyPreview = bodyText.substring(0, 1000);
            }

            return r;
        }''')

        print(f'\nBody text length: {data.get("bodyTextLen")}')
        print(f'Body preview: {data.get("bodyPreview", "N/A")[:300]}')

        if 'scriptWithItemId' in data:
            print(f'\nScript with itemId: {data["scriptWithItemId"][:500]}')

        if 'rootHTML' in data:
            print(f'\nRoot HTML: {data["rootHTML"][:500]}')

        # Check for window-level data
        print('\nWindow data keys found:')
        for key, val in data.items():
            if key not in ('bodyTextLen', 'bodyPreview', 'scriptWithItemId', 'rootHTML') and not key.startswith('meta_'):
                print(f'  {key}: {str(val)[:200]}')

        # Print meta tags
        print('\nMeta tags:')
        for key, val in data.items():
            if key.startswith('meta_'):
                print(f'  {key}: {val}')

        await browser.close()


asyncio.run(main())
