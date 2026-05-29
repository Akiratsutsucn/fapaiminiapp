"""公拍网自动登录 + 提取 cookie + 写入服务器 .env。

用法：
1. 在脚本顶部填写 GPAI_USER 和 GPAI_PASS
2. 服务器上跑：cd /opt/fapai && /opt/fapai/venv/bin/python3 update_gpai_cookie.py
3. cookie 过期时重跑此脚本即可

设计思路：
- 用 Playwright 模拟浏览器登录公拍网
- 登录成功后从浏览器 context 拿到完整 cookies
- 拼成 GPAI_COOKIE 字符串写入 /opt/fapai/crawler/.env
"""
import asyncio
import os
import sys
sys.path.insert(0, "/opt/fapai")

# ====== 在这里填账号密码 ======
GPAI_USER = os.environ.get("GPAI_USER", "")
GPAI_PASS = os.environ.get("GPAI_PASS", "")

LOGIN_URL = "https://www.gpai.net/user/login.do"
HOME_URL = "https://www.gpai.net/"
SEARCH_URL = "https://s.gpai.net/sf/search.do?at=376&cityNum=31"

ENV_FILES = [
    "/opt/fapai/crawler/.env",
    "/opt/fapai/.env",
]


async def main():
    if not GPAI_USER or not GPAI_PASS:
        print("错误：请设置环境变量 GPAI_USER 和 GPAI_PASS")
        print("用法: GPAI_USER=xxx GPAI_PASS=xxx python3 update_gpai_cookie.py")
        sys.exit(1)

    from crawler.browser import browser_manager
    await browser_manager.start()
    page = await browser_manager.new_page()

    print(f"=== 步骤1: 访问登录页 {LOGIN_URL} ===")
    await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
    await asyncio.sleep(2)

    # 截图查看登录页结构
    await page.screenshot(path="/tmp/gpai_login.png")

    # 探测登录表单
    print("\n=== 步骤2: 找登录表单元素 ===")
    form_info = await page.evaluate("""
    () => {
        const inputs = [];
        document.querySelectorAll('input').forEach(inp => {
            inputs.push({
                name: inp.name || '',
                type: inp.type || '',
                id: inp.id || '',
                placeholder: inp.placeholder || ''
            });
        });
        return inputs;
    }
    """)
    for f in form_info:
        print(f"  input: {f}")

    # 一般公拍网登录字段名是 username/password
    print("\n=== 步骤3: 填写表单 ===")
    try:
        # 试常见字段名
        for user_selector in ['input[name="username"]', 'input[name="userName"]', 'input[name="loginName"]', 'input[name="account"]', 'input#username']:
            try:
                await page.fill(user_selector, GPAI_USER, timeout=2000)
                print(f"  用户名填入: {user_selector}")
                break
            except Exception:
                continue
        else:
            print("  WARN: 没找到用户名字段，使用第一个 type=text 的输入框")
            await page.fill('input[type="text"]:first-of-type', GPAI_USER)

        for pass_selector in ['input[name="password"]', 'input[name="passwd"]', 'input[type="password"]', 'input#password']:
            try:
                await page.fill(pass_selector, GPAI_PASS, timeout=2000)
                print(f"  密码填入: {pass_selector}")
                break
            except Exception:
                continue

        await asyncio.sleep(1)
    except Exception as e:
        print(f"  填表错误: {e}")

    # 截图填表后
    await page.screenshot(path="/tmp/gpai_login_filled.png")

    print("\n=== 步骤4: 提交登录 ===")
    # 找登录按钮
    submitted = False
    for btn_selector in ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("登录")', 'a:has-text("登录")', '#login-btn', '#submit']:
        try:
            await page.click(btn_selector, timeout=2000)
            submitted = True
            print(f"  点击: {btn_selector}")
            break
        except Exception:
            continue

    if not submitted:
        print("  WARN: 未找到登录按钮，尝试回车")
        await page.keyboard.press("Enter")

    # 等待登录跳转
    print("\n=== 步骤5: 等待登录完成 ===")
    await asyncio.sleep(8)
    await page.screenshot(path="/tmp/gpai_after_login.png")

    print(f"  当前 URL: {page.url}")

    # 检查是否登录成功
    page_text = await page.evaluate("document.body.innerText")
    is_logged_in = (
        "退出" in page_text
        or "我的" in page_text
        or "个人中心" in page_text
        or GPAI_USER in page_text
    )
    has_login_btn = "登录" in page_text and not is_logged_in

    if is_logged_in:
        print("  登录成功！")
    elif has_login_btn:
        print(f"  登录失败，页面仍有登录按钮。请检查 /tmp/gpai_after_login.png")
        print(f"  页面文本前 500 字: {page_text[:500]}")
        # 不退出，仍然尝试拿 cookie

    print("\n=== 步骤6: 访问 search.do 验证 ===")
    await page.goto(SEARCH_URL, wait_until="networkidle", timeout=30000)
    await asyncio.sleep(3)
    await page.screenshot(path="/tmp/gpai_search.png")

    # 检查是否还是 403
    title = await page.title()
    if "403" in title or "Forbidden" in title:
        print(f"  还是 403：{title}")
    else:
        print(f"  访问成功，标题: {title}")
        # 看是否有列表
        items = await page.evaluate("""
        () => document.querySelectorAll('a[href*="item2.do"]').length
        """)
        print(f"  列表项数: {items}")

    print("\n=== 步骤7: 提取 cookies ===")
    cookies = await page.context.cookies()
    print(f"  共 {len(cookies)} 个 cookie")

    # 拼成字符串
    cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies if 'gpai' in c['domain'].lower())
    print(f"  公拍网相关 cookie 字符串长度: {len(cookie_str)}")
    print(f"  首 200 字: {cookie_str[:200]}")

    if not cookie_str:
        print("  ERROR: 没有公拍网 cookie")
        await page.close()
        await browser_manager.stop()
        sys.exit(1)

    print("\n=== 步骤8: 写入 .env ===")
    for env_file in ENV_FILES:
        try:
            if not os.path.exists(env_file):
                continue
            with open(env_file) as f:
                content = f.read()
            if "GPAI_COOKIE=" in content:
                # 替换
                lines = content.splitlines()
                new_lines = []
                for line in lines:
                    if line.startswith("GPAI_COOKIE="):
                        new_lines.append(f"GPAI_COOKIE={cookie_str}")
                    else:
                        new_lines.append(line)
                content = "\n".join(new_lines)
                if not content.endswith("\n"):
                    content += "\n"
            else:
                content += f"\nGPAI_COOKIE={cookie_str}\n"
            with open(env_file, "w") as f:
                f.write(content)
            print(f"  已更新 {env_file}")
        except PermissionError:
            print(f"  权限不足，无法写 {env_file}（可能需要 sudo）")
        except Exception as e:
            print(f"  写 {env_file} 失败: {e}")

    await page.close()
    await browser_manager.stop()
    print("\n完成！")


asyncio.run(main())
