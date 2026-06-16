"""云镜 L2TP/SK5 住宅IP面板 —— 浏览器自动化切换IP。

服务商只提供 WEB 后台点按钮切IP(无API),每天最多20次。本模块用 Playwright
模拟登录 + 点击「切换」按钮完成自动换IP,接入 ip_rotator 的 auto 模式。

流程:登录(账号密码)→ 进切换页 → 点行内「切换」→ 弹窗读今日剩余次数
      → 剩余>0 则点「确定」(全国随机切换)→ 等待生效。

安全:
- 内置每日上限保护(MAX_DAILY,默认19,留1次给人工应急),靠面板弹窗里的
  「今日剩余切换次数N」精确判断,剩余<=PRESERVE 时拒绝切换。
- 全程 headless;失败抛异常由上层(ip_rotator)兜底为「提示人工」。

环境变量(见 .env):
  IP_PANEL_LOGIN_URL / IP_PANEL_SWITCH_URL / IP_PANEL_USER / IP_PANEL_PASS
"""
from __future__ import annotations
import asyncio
import os
import re

from loguru import logger

PRESERVE_QUOTA = 1   # 保留给人工应急的次数:面板剩余 <= 此值时不自动切
NAV_TIMEOUT = 30000


def _cfg() -> dict:
    return {
        "login_url": os.getenv("IP_PANEL_LOGIN_URL", "").strip(),
        "switch_url": os.getenv("IP_PANEL_SWITCH_URL", "").strip(),
        "user": os.getenv("IP_PANEL_USER", "").strip(),
        "passwd": os.getenv("IP_PANEL_PASS", "").strip(),
    }


async def _login(page, cfg: dict) -> None:
    """账号密码登录。处理可能的协议弹窗。"""
    await page.goto(cfg["login_url"], wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
    await asyncio.sleep(2)
    # 协议弹窗(若有)
    try:
        agree = page.get_by_role("button", name="我已阅读并同意")
        if await agree.count() > 0 and await agree.first.is_visible():
            await agree.first.click()
            await asyncio.sleep(1)
    except Exception:
        pass
    await page.fill("input[placeholder='请输入用户名称']", cfg["user"])
    await page.fill("input[placeholder='请输入密码']", cfg["passwd"])
    await asyncio.sleep(0.5)
    await page.click("button.submitBtn")
    await asyncio.sleep(4)
    if "login" in page.url:
        raise RuntimeError("登录后仍停留在登录页,账号密码可能失效")


def _parse_remaining(dialog_text: str) -> int | None:
    """从弹窗文本解析「今日剩余切换次数N」。解析不到返回 None。"""
    m = re.search(r"剩余切换次数\s*(\d+)", dialog_text)
    return int(m.group(1)) if m else None


async def switch_ip_async() -> dict:
    """执行一次自动切换。返回 {ok, remaining, message}。"""
    cfg = _cfg()
    if not all([cfg["login_url"], cfg["switch_url"], cfg["user"], cfg["passwd"]]):
        return {"ok": False, "remaining": None, "message": "IP面板配置不全(检查.env IP_PANEL_*)"}

    from .browser import browser_manager
    await browser_manager.start()
    page = await browser_manager.new_page()
    try:
        await _login(page, cfg)
        await page.goto(cfg["switch_url"], wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        await asyncio.sleep(3)

        sw = page.locator("button.action-btn", has_text="切换")
        if await sw.count() == 0:
            raise RuntimeError("切换页未找到「切换」按钮(页面结构可能变化)")
        await sw.first.click()
        await asyncio.sleep(2)

        # 读弹窗(标题「切换区域」),拿剩余次数
        dialog = page.locator(".el-dialog", has_text="切换").filter(has=page.locator(".el-dialog__body"))
        body_text = ""
        try:
            body_text = await page.locator(".el-dialog__body").first.inner_text(timeout=5000)
        except Exception:
            pass
        remaining = _parse_remaining(body_text)

        if remaining is not None and remaining <= PRESERVE_QUOTA:
            # 额度不足,取消,不切
            await _click_cancel(page)
            return {"ok": False, "remaining": remaining,
                    "message": f"今日剩余{remaining}次 <= 保留{PRESERVE_QUOTA}次,不自动切换"}

        # 确定切换(全国随机:不选地区直接确定)
        await _click_confirm(page)
        await asyncio.sleep(6)  # 等待切换生效
        logger.info(f"[ip_panel] 已点击确定切换IP(切前剩余约 {remaining} 次)")
        return {"ok": True, "remaining": (remaining - 1) if remaining else None,
                "message": "已自动切换IP(全国随机)"}
    finally:
        try:
            await page.close()
        except Exception:
            pass


async def _click_confirm(page) -> None:
    """点弹窗里的「确定」(兼容「确 定」带空格)。"""
    for name in ("确 定", "确定"):
        btn = page.get_by_role("button", name=name, exact=True)
        if await btn.count() > 0 and await btn.first.is_visible():
            await btn.first.click()
            return
    raise RuntimeError("切换弹窗未找到「确定」按钮")


async def _click_cancel(page) -> None:
    for name in ("取 消", "取消"):
        btn = page.get_by_role("button", name=name, exact=True)
        if await btn.count() > 0 and await btn.first.is_visible():
            await btn.first.click()
            return
