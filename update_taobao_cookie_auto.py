"""淘宝自动登录脚本（服务器端 Playwright）。

策略：
1. 优先尝试账号密码登录（来自 .env 的 TAOBAO_USER/TAOBAO_PASS）
2. 检测滑块/验证码：若出现，保存截图到 /var/log/fapai/，退回扫码登录
3. 扫码登录兜底：保存支付宝/淘宝扫码二维码到本地，运维扫码后等待登录态
4. 登录成功后从 context 提取 cookie 写入 /opt/fapai/.env

说明：
- 淘宝反爬很严，账号密码登录大概率触发滑块。建议长期靠扫码登录。
- 扫码模式下脚本会等待最多 180s 让运维扫码确认。

用法：
    cd /opt/fapai
    /opt/fapai/venv/bin/python update_taobao_cookie_auto.py [--mode password|qr|auto]

    --mode auto (默认): 先试账号密码，失败回落扫码
    --mode password: 仅账号密码
    --mode qr: 仅扫码
"""
import argparse
import asyncio
import os
import sys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

# ====== 配置 ======
TAOBAO_USER = os.environ.get("TAOBAO_USER", "")
TAOBAO_PASS = os.environ.get("TAOBAO_PASS", "")

LOGIN_URL = "https://login.taobao.com/member/login.jhtml"
HOME_URL = "https://www.taobao.com"
SF_URL = "https://sf.taobao.com/list/0_50.htm"

ENV_FILES = [
    "/opt/fapai/crawler/.env",
    "/opt/fapai/.env",
]
SCREENSHOT_DIR = Path("/var/log/fapai")
SCREENSHOT_DIR.mkdir(exist_ok=True, parents=True)

# 关键 cookie key（与 update_taobao_cookie.py 对齐）
NEEDED_COOKIES = [
    "_cc_", "_l_g_", "_m_h5_tk", "_m_h5_tk_enc",
    "_nk_", "_samesite_flag_", "_tb_token_",
]


async def detect_captcha(page) -> bool:
    """检测页面是否出现滑块/验证码。"""
    try:
        return await page.evaluate("""
        () => {
            const text = document.body.innerText || '';
            // 滑块关键词
            if (text.includes('请按住滑块') || text.includes('拖动滑块') ||
                text.includes('验证码') || text.includes('安全验证')) {
                return true;
            }
            // nc 滑块组件
            if (document.querySelector('.nc_iconfont, #nc_1_n1z, .baxia-dialog')) {
                return true;
            }
            return false;
        }
        """)
    except Exception:
        return False


async def dismiss_consent_dialog(page) -> bool:
    """淘宝登录页可能弹出「服务协议及隐私保护」对话框，挡住登录按钮。
    检测并自动点击「同意」，返回是否点过。"""
    try:
        # 检测弹窗
        has_dialog = await page.evaluate("""
        () => {
            const text = document.body.innerText || '';
            return text.includes('服务协议及隐私保护') || text.includes('请您阅读并同意');
        }
        """)
        if not has_dialog:
            return False

        # 尝试多个「同意」按钮选择器
        for sel in ['button:has-text("同意")', 'a:has-text("同意")',
                    'div[role="button"]:has-text("同意")', '.next-btn:has-text("同意")',
                    'span:has-text("同意")']:
            try:
                await page.click(sel, timeout=2000)
                print(f"[main] 已关闭协议弹窗: {sel}")
                await asyncio.sleep(1)
                return True
            except Exception:
                continue
        # 兜底：用 evaluate 找文本含「同意」的可点击元素
        clicked = await page.evaluate("""
        () => {
            const els = document.querySelectorAll('button, a, div[role="button"], span');
            for (const el of els) {
                const t = (el.textContent || '').trim();
                if (t === '同意' || t === '我同意' || t === '同意并继续') {
                    el.click();
                    return true;
                }
            }
            return false;
        }
        """)
        if clicked:
            print("[main] 已通过 JS 点击同意按钮")
            await asyncio.sleep(1)
            return True
    except Exception as e:
        print(f"[main] 关闭协议弹窗失败: {e}")
    return False


async def detect_logged_in(page) -> bool:
    """检测当前是否已登录态：URL 不在 login.taobao.com 且页面文本含「我的淘宝/退出/账户管理」。"""
    try:
        url = page.url
        if "login.taobao.com" in url or "/login" in url.lower():
            return False
        text = await page.evaluate("document.body.innerText || ''")
        return ("我的淘宝" in text) or ("退出" in text) or ("账户管理" in text) or ("欢迎" in text and "你好" in text)
    except Exception:
        return False


async def try_password_login(page) -> tuple[bool, str]:
    """尝试账号密码登录。返回 (是否成功, 失败原因)。"""
    if not TAOBAO_USER or not TAOBAO_PASS:
        return False, "TAOBAO_USER/TAOBAO_PASS 未配置"

    print(f"[password] 访问登录页 {LOGIN_URL}...")
    try:
        await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)
    except Exception as e:
        return False, f"登录页加载失败: {e}"

    # 关协议弹窗
    await dismiss_consent_dialog(page)

    await page.screenshot(path=str(SCREENSHOT_DIR / "taobao_login_page.png"))
    print(f"[password] 已截图: {SCREENSHOT_DIR / 'taobao_login_page.png'}")

    # 寻找用户名输入框（淘宝有时是 #fm-login-id，有时是 input[name=loginId]）
    user_filled = False
    for sel in ['input[name="fm-login-id"]', '#fm-login-id', 'input[name="TPL_username"]',
                'input[placeholder*="账号"]', 'input[placeholder*="手机号"]', 'input[name="loginId"]']:
        try:
            await page.fill(sel, TAOBAO_USER, timeout=2000)
            print(f"[password] 用户名填入: {sel}")
            user_filled = True
            break
        except Exception:
            continue
    if not user_filled:
        return False, "未找到用户名输入框"

    pass_filled = False
    for sel in ['input[name="fm-login-password"]', '#fm-login-password',
                'input[name="TPL_password"]', 'input[type="password"]']:
        try:
            await page.fill(sel, TAOBAO_PASS, timeout=2000)
            print(f"[password] 密码填入: {sel}")
            pass_filled = True
            break
        except Exception:
            continue
    if not pass_filled:
        return False, "未找到密码输入框"

    await asyncio.sleep(1.5)

    # 点击登录按钮
    submitted = False
    for sel in ['button[type="submit"]', '.fm-button', '.password-login',
                'button:has-text("登录")', 'a:has-text("登录")']:
        try:
            await page.click(sel, timeout=2000)
            submitted = True
            print(f"[password] 点击登录按钮: {sel}")
            break
        except Exception:
            continue
    if not submitted:
        return False, "未找到登录按钮"

    # 等待 1-2 秒看是否弹「服务协议」
    await asyncio.sleep(2)
    if await dismiss_consent_dialog(page):
        # 弹窗关闭后再次点登录（有的版本同意后自动提交，有的需要再点一次）
        await asyncio.sleep(2)
        if not await detect_logged_in(page) and "login.taobao.com" in page.url:
            print("[password] 同意后再次点击登录...")
            for sel in ['button[type="submit"]', '.fm-button', 'button:has-text("登录")']:
                try:
                    await page.click(sel, timeout=2000)
                    break
                except Exception:
                    continue
            await asyncio.sleep(3)

    # 等待登录跳转或滑块出现
    await asyncio.sleep(5)
    await page.screenshot(path=str(SCREENSHOT_DIR / "taobao_after_submit.png"))

    if await detect_captcha(page):
        return False, "出现滑块/验证码（淘宝反爬，建议改用扫码登录）"

    if await detect_logged_in(page):
        print("[password] 登录成功")
        return True, ""

    # 再等几秒（有时跳转较慢）
    await asyncio.sleep(5)
    if await detect_logged_in(page):
        print("[password] 登录成功（延迟跳转）")
        return True, ""

    return False, f"登录失败，当前 URL: {page.url}"


async def try_qr_login(page, wait_seconds: int = 180) -> tuple[bool, str]:
    """扫码登录：保存二维码图片到 SCREENSHOT_DIR/taobao_qr.png，等待运维扫码。"""
    print(f"[qr] 访问登录页 {LOGIN_URL}...")
    try:
        await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)
    except Exception as e:
        return False, f"登录页加载失败: {e}"

    # 关协议弹窗
    await dismiss_consent_dialog(page)
    try:
        await page.click('text=扫码登录', timeout=3000)
        await asyncio.sleep(2)
    except Exception:
        pass  # 默认 tab

    # 截图：尝试只裁剪二维码区域；失败则全页面截图
    qr_path = SCREENSHOT_DIR / "taobao_qr.png"
    cropped = False
    try:
        # 淘宝二维码通常在 .qrcode-img 或 canvas 元素内
        for sel in ['.qrcode-img', '.qrcode', '#qrcode', 'canvas', '.iconfont-qrcode']:
            try:
                el = await page.wait_for_selector(sel, timeout=2000)
                if el:
                    box = await el.bounding_box()
                    if box and box["width"] > 100 and box["height"] > 100:
                        # 裁剪稍微外扩 20px 让二维码周围有白边
                        await page.screenshot(path=str(qr_path), clip={
                            "x": max(0, box["x"] - 20),
                            "y": max(0, box["y"] - 20),
                            "width": box["width"] + 40,
                            "height": box["height"] + 40,
                        })
                        cropped = True
                        print(f"[qr] 已裁剪二维码区域 ({sel}, {int(box['width'])}x{int(box['height'])})")
                        break
            except Exception:
                continue
    except Exception:
        pass

    if not cropped:
        await page.screenshot(path=str(qr_path), full_page=True)
        print("[qr] 已保存全页截图（未能定位二维码元素）")

    print(f"[qr] 二维码: {qr_path}")
    print(f"[qr] === 扫码方法 ===")
    print(f"[qr] 本机执行：scp -i <key> ubuntu@122.51.156.252:{qr_path} ./qr.png")
    print(f"[qr] 然后用淘宝 App 扫描 qr.png")
    print(f"[qr] 等待扫码确认，最多 {wait_seconds} 秒...")

    # 轮询登录状态
    elapsed = 0
    poll_interval = 5
    while elapsed < wait_seconds:
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval
        if await detect_logged_in(page):
            print(f"[qr] 扫码登录成功（用时 {elapsed}s）")
            return True, ""
        if elapsed % 30 == 0:
            print(f"[qr] 仍在等待... ({elapsed}/{wait_seconds}s)")
            # 每 30s 重新截图（二维码可能刷新）
            await page.screenshot(path=str(qr_path), full_page=True)

    return False, f"扫码超时（{wait_seconds}s 内未检测到登录态）"


async def extract_taobao_cookies(page) -> dict:
    """从浏览器 context 提取 .taobao.com 域 cookie。"""
    cookies = await page.context.cookies()
    result = {}
    for c in cookies:
        domain = c.get("domain", "")
        if "taobao.com" in domain or "tmall.com" in domain:
            result[c["name"]] = c["value"]
    return result


def build_cookie_string(cookies: dict) -> str:
    parts = []
    used = set()
    for k in NEEDED_COOKIES:
        if k in cookies:
            parts.append(f"{k}={cookies[k]}")
            used.add(k)
    for k, v in cookies.items():
        if k in used or not v:
            continue
        # 跳过太大的 cookie（cna 等）也无所谓，多带没事
        parts.append(f"{k}={v}")
    return "; ".join(parts)


def write_cookie_to_env(cookie_str: str) -> int:
    """写入服务器 .env 文件。返回成功写入的文件数。"""
    written = 0
    for env_file in ENV_FILES:
        p = Path(env_file)
        if not p.exists():
            continue
        try:
            with open(p) as f:
                lines = f.read().splitlines()
            replaced = False
            for i, line in enumerate(lines):
                if line.startswith("TAOBAO_COOKIE="):
                    lines[i] = f'TAOBAO_COOKIE="{cookie_str}"'
                    replaced = True
                    break
            if not replaced:
                lines.append(f'TAOBAO_COOKIE="{cookie_str}"')
            with open(p, "w") as f:
                f.write("\n".join(lines) + "\n")
            print(f"  已更新 {env_file}")
            written += 1
        except PermissionError:
            print(f"  权限不足，无法写 {env_file}（需要 sudo 权限运行此脚本）")
        except Exception as e:
            print(f"  写 {env_file} 失败: {e}")
    return written


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["password", "qr", "auto"], default="qr",
                        help="qr=扫码（推荐，默认）；password=密码（淘宝反爬严，几乎必然失败）；auto=先密码后扫码")
    parser.add_argument("--qr-wait", type=int, default=180)
    args = parser.parse_args()

    # 加载 .env（如果脚本从 systemd 起没经过 EnvironmentFile）
    if not TAOBAO_USER:
        for f in ENV_FILES:
            if Path(f).exists():
                with open(f) as fp:
                    for line in fp:
                        line = line.strip()
                        if line.startswith("TAOBAO_USER="):
                            globals()["TAOBAO_USER"] = line.split("=", 1)[1].strip().strip('"')
                        elif line.startswith("TAOBAO_PASS="):
                            globals()["TAOBAO_PASS"] = line.split("=", 1)[1].strip().strip('"')

    from crawler.browser import browser_manager
    await browser_manager.start()
    page = await browser_manager.new_page()

    success = False
    error_msg = ""

    if args.mode in ("password", "auto"):
        ok, err = await try_password_login(page)
        if ok:
            success = True
        else:
            print(f"[main] 账号密码登录失败：{err}")
            error_msg = err

    if not success and args.mode in ("qr", "auto"):
        ok, err = await try_qr_login(page, wait_seconds=args.qr_wait)
        if ok:
            success = True
        else:
            print(f"[main] 扫码登录失败：{err}")
            error_msg = err

    if success:
        cookies = await extract_taobao_cookies(page)
        print(f"[main] 提取到 {len(cookies)} 个 cookie")
        cookie_str = build_cookie_string(cookies)
        print(f"[main] cookie 字符串长度: {len(cookie_str)}")
        if "_m_h5_tk" in cookies:
            print(f"[main] _m_h5_tk: {cookies['_m_h5_tk'][:30]}...")
        written = write_cookie_to_env(cookie_str)
        print(f"[main] 已写入 {written} 个 .env 文件")
    else:
        print(f"[main] 全部登录方式失败: {error_msg}")
        await page.screenshot(path=str(SCREENSHOT_DIR / "taobao_failed.png"))

    await page.close()
    await browser_manager.stop()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
