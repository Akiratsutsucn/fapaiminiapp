"""Test whether PaiMai SSR detail page renders data to DOM."""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

with open('/opt/fapai/.env') as f:
    for line in f:
        if line.startswith('TAOBAO_COOKIE='):
            cookie = line.split('=', 1)[1].strip()
            break
    else:
        cookie = ''


async def main():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

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
        url = (
            'https://pages-fast.m.taobao.com/wow/z/app/pm/dzc-ice/dzc-detail'
            '?x-ssr=true&disableNav=YES&x-preload=true&forceThemis=true'
            '&skeleton=true&itemId=1046317979782'
        )

        print('Loading page...')
        await page.goto(url, wait_until='networkidle', timeout=45000)
        await asyncio.sleep(3)

        data = await page.evaluate('''() => {
            const r = {};
            r.bodyLen = document.body.innerText.length;
            r.hasQiPaiJia = document.body.innerText.includes("u8d77u62cdu4ef7");
            r.firstText = document.body.innerText.substring(0, 800);
            return r;
        }''')

        print('Body text length:', data['bodyLen'])
        print('Has unicode chars:', data['hasQiPaiJia'])
        print('First 800 chars:')
        print(data['firstText'])

        await browser.close()


asyncio.run(main())
