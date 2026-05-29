"""检测淘宝、公拍网 cookie 是否仍然有效。

通过实际访问目标站点验证：
- 淘宝：访问 sf.taobao.com，检测页面是否仍然不被劫持到登录页
- 公拍网：访问 www.gpai.net/sf/，检测是否能拿到 item2.do 链接

可以放进 cron / systemd timer 每天跑一次，过期时通过日志告警。

用法：
    # 在服务器上跑
    cd /opt/fapai && /opt/fapai/venv/bin/python -m scripts.check_cookie_health [--platform taobao|gpai|all]
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from loguru import logger  # noqa: E402


async def check_taobao() -> tuple[bool, str]:
    """返回 (is_healthy, message)。"""
    try:
        from crawler.browser import browser_manager
        from crawler.config import settings
    except ImportError as e:
        return False, f"crawler 模块导入失败: {e}"

    cookie_str = (settings.TAOBAO_COOKIE or "").strip()
    if not cookie_str:
        return False, "TAOBAO_COOKIE 未配置"

    await browser_manager.start()
    try:
        page = await browser_manager.new_page()
        # 注入 cookie
        cookies = []
        for pair in cookie_str.split(";"):
            pair = pair.strip()
            if "=" in pair:
                name, value = pair.split("=", 1)
                cookies.append({"name": name.strip(), "value": value.strip(),
                                "domain": ".taobao.com", "path": "/"})
        if cookies:
            await page.context.add_cookies(cookies)

        try:
            await page.goto("https://sf.taobao.com/", timeout=20000)
            await asyncio.sleep(2)
            text = await page.evaluate("document.body.textContent || ''")
            url = page.url
            # 优先看 URL：跳到登录域名才算未登录
            if "login.taobao.com" in url:
                return False, f"被引导到登录页 (url={url[:80]})"
            if "deny_pc" in url or "punish" in url:
                return False, f"被风控拦截 (url={url[:80]})"
            # 检查列表页是否有「司法拍卖」内容
            # 注意："亲，请登录"是淘宝默认页面 header 文案，不是登录失败标志
            if "司法拍卖" in text or "标的物" in text or "起拍价" in text:
                # 看看有没有列表项
                count = await page.evaluate("document.querySelectorAll('a[href*=\"sf_item.htm\"], .sf-item-list-pic, .sf-item').length")
                return True, f"OK，sf 首页正常加载（疑似列表 {count} 项）"
            return False, "页面未识别为 sf.taobao.com"
        finally:
            await page.close()
    finally:
        await browser_manager.stop()


async def check_gpai() -> tuple[bool, str]:
    """返回 (is_healthy, message)。GPAI_COOKIE 未配置时也算健康（因为公拍网 anonymous 默认能访问）。"""
    try:
        from crawler.browser import browser_manager
        from crawler.config import settings
    except ImportError as e:
        return False, f"crawler 模块导入失败: {e}"

    cookie_str = (settings.GPAI_COOKIE or "").strip()

    await browser_manager.start()
    try:
        page = await browser_manager.new_page()
        if cookie_str:
            cookies = []
            for pair in cookie_str.split(";"):
                pair = pair.strip()
                if "=" in pair:
                    name, value = pair.split("=", 1)
                    cookies.append({"name": name.strip(), "value": value.strip(),
                                    "domain": ".gpai.net", "path": "/"})
            if cookies:
                await page.context.add_cookies(cookies)

        try:
            await page.goto("https://www.gpai.net/sf/", timeout=30000)
            await asyncio.sleep(3)
            text = await page.evaluate("document.body.textContent || ''")
            url = page.url
            # 登录墙检测
            if ("请先登录" in text or "请登录后" in text or "您还没有登录" in text or
                    "/login" in url.lower()):
                return False, f"被要求登录 (url={url[:80]})"
            # 检查列表
            count = await page.evaluate("document.querySelectorAll('a[href*=\"item2.do\"]').length")
            if count > 0:
                marker = "已配置 cookie" if cookie_str else "anonymous"
                return True, f"OK，{marker}，列表 {count} 项"
            return False, "未检测到 item2.do 链接"
        finally:
            await page.close()
    finally:
        await browser_manager.stop()


async def _try_gpai_auto_relogin() -> bool:
    """检测到公拍网 cookie 失效时，调用 update_gpai_cookie_auto.py 自动登录续期。

    依赖 .env 里已配置 GPAI_USER / GPAI_PASS。返回 True 表示子进程成功（不一定能登上，
    但脚本本身没崩，cookie 写入了 .env），调用方应该再次跑 check_gpai 校验。
    """
    user = os.environ.get("GPAI_USER", "")
    if not user:
        logger.warning("[health] GPAI_USER 未配置，无法自动重登")
        return False

    auto_script = ROOT / "update_gpai_cookie_auto.py"
    if not auto_script.exists():
        logger.warning(f"[health] 自动登录脚本不存在: {auto_script}")
        return False

    import subprocess
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, str(auto_script),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env={**os.environ},
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
        except asyncio.TimeoutError:
            proc.kill()
            logger.error("[health] 自动登录超时（>120s）")
            return False

        out = (stdout or b"").decode("utf-8", errors="replace")
        # auto 脚本最后一行打印 "完成！" 表示成功
        if "完成！" in out and proc.returncode == 0:
            return True
        logger.error(f"[health] 自动登录失败 returncode={proc.returncode}")
        # 打印输出尾部 30 行帮助排查
        for line in out.splitlines()[-30:]:
            logger.error(f"  {line}")
        return False
    except Exception as e:
        logger.error(f"[health] 自动登录异常: {e}")
        return False


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--platform", choices=["taobao", "gpai", "all"], default="all")
    args = p.parse_args()

    targets = []
    if args.platform in ("taobao", "all"):
        targets.append(("taobao", check_taobao))
    if args.platform in ("gpai", "all"):
        targets.append(("gpai", check_gpai))

    summary = []
    for name, fn in targets:
        logger.info(f"[health] 检测 {name}...")
        try:
            ok, msg = await fn()
        except Exception as e:
            ok, msg = False, f"异常: {e}"
        flag = "OK" if ok else "FAIL"
        line = f"[{flag}] {name}: {msg}"
        logger.info(line) if ok else logger.error(line)

        # 公拍网失败时尝试自动重登（用 GPAI_USER/PASS）
        if not ok and name == "gpai":
            logger.warning("[health] 公拍网 cookie 失效，尝试自动重登...")
            recovered = await _try_gpai_auto_relogin()
            if recovered:
                logger.info("[health] 自动重登成功，重新检测...")
                try:
                    ok, msg = await check_gpai()
                except Exception as e:
                    ok, msg = False, f"重登后再检测异常: {e}"
                flag = "OK (auto-recovered)" if ok else "FAIL (relogin attempted)"
                line = f"[{flag}] {name}: {msg}"
                logger.info(line) if ok else logger.error(line)
            else:
                logger.error("[health] 自动重登失败")

        summary.append((name, ok, msg))

    print("\n" + "=" * 60)
    print("Cookie 健康检测报告")
    print("=" * 60)
    for name, ok, msg in summary:
        flag = "[OK]  " if ok else "[FAIL]"
        print(f"  {flag} {name}: {msg}")
    print()

    # 退出码：任一失败 → 1（方便 cron 触发告警）
    if any(not ok for _, ok, _ in summary):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
