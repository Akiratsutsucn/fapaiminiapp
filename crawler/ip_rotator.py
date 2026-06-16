"""换 IP 抽象层 —— 把「需要换IP」和「具体怎么换」解耦。

上层(SSR 熔断)只调 request_ip_rotation_async(),不关心底层方式。

模式(环境变量 IP_ROTATION_MODE):
  auto   = 调用 ip_panel 用浏览器自动化点云镜面板「切换」按钮换住宅IP
           (服务商只给WEB后台、无API,每天≤20次,内置额度保护)。
  manual = 仅记录+提示人工换IP(默认,作为 auto 失败时的兜底语义)。

环境变量:
  IP_ROTATION_MODE = manual | auto
  IP_PANEL_*       = 见 ip_panel.py(登录URL/切换URL/账号/密码)
"""
from __future__ import annotations
import os
import time

from loguru import logger


# 进程内记录最近一次换IP请求(节流 + 供上层查询)
_last_rotation_request_at: float = 0.0
_rotation_request_count: int = 0


def rotation_mode() -> str:
    """当前换IP模式：manual(默认) / auto。"""
    return os.getenv("IP_ROTATION_MODE", "manual").strip().lower()


def request_ip_rotation(reason: str = "") -> dict:
    """请求换一个新IP。返回 {mode, rotated, manual_required, message}。

    - manual 模式(当前):不实际换,只记录事件 + 标记需人工换IP。
    - auto 模式(未来):从地址池API取新IP切换。
    """
    global _last_rotation_request_at, _rotation_request_count
    _last_rotation_request_at = time.time()
    _rotation_request_count += 1

    mode = rotation_mode()
    if mode == "auto":
        try:
            ok = _rotate_via_pool(reason)
            return {
                "mode": "auto", "rotated": ok, "manual_required": False,
                "message": "已从地址池自动切换IP" if ok else "自动换IP失败",
            }
        except Exception as e:
            logger.error(f"[ip_rotator] auto 换IP异常: {e}")
            return {"mode": "auto", "rotated": False, "manual_required": True,
                    "message": f"自动换IP异常,需人工介入: {e}"}

    # manual 模式:不自动换,提示人工
    logger.warning(
        f"[ip_rotator] 检测到需换IP(reason={reason})。当前为手动模式,"
        f"不自动切换。建议运维手动切换住宅IP后重跑爬虫以恢复完整抓取。"
    )
    return {
        "mode": "manual", "rotated": False, "manual_required": True,
        "message": "当前IP疑似被风控,需手动切换住宅IP后重跑(每天可换≤20次)",
    }


def _rotate_via_pool(reason: str) -> bool:
    """[已废弃占位] 旧的地址池API方案(服务商未批准)。保留以兼容旧引用。"""
    return False


async def request_ip_rotation_async(reason: str = "") -> dict:
    """异步版换IP(auto 模式实际执行浏览器自动切换)。

    auto 模式:调用 ip_panel 浏览器自动化点「切换」按钮换住宅IP(每天≤20次,
    内置额度保护)。manual 模式:仅记录+提示人工(同 request_ip_rotation)。
    """
    global _last_rotation_request_at, _rotation_request_count
    _last_rotation_request_at = time.time()
    _rotation_request_count += 1

    if rotation_mode() != "auto":
        logger.warning(f"[ip_rotator] 需换IP(reason={reason}),当前 manual 模式,提示人工。")
        return {"mode": "manual", "rotated": False, "manual_required": True,
                "message": "当前IP疑似被风控,需手动切换住宅IP后重跑(每天可换≤20次)"}

    try:
        from . import ip_panel
        result = await ip_panel.switch_ip_async()
        if result.get("ok"):
            logger.info(f"[ip_rotator] 自动换IP成功(reason={reason}): {result.get('message')}")
            return {"mode": "auto", "rotated": True, "manual_required": False,
                    "message": result.get("message", "已自动切换IP"),
                    "remaining": result.get("remaining")}
        # 未切成(额度不足/按钮异常)→ 兜底提示人工
        logger.warning(f"[ip_rotator] 自动换IP未成功: {result.get('message')}")
        return {"mode": "auto", "rotated": False, "manual_required": True,
                "message": result.get("message", "自动换IP失败,需人工介入"),
                "remaining": result.get("remaining")}
    except Exception as e:
        logger.error(f"[ip_rotator] auto 换IP异常: {e}")
        return {"mode": "auto", "rotated": False, "manual_required": True,
                "message": f"自动换IP异常,需人工介入: {e}"}


def stats() -> dict:
    """供上层/监控查询换IP请求情况。"""
    return {
        "mode": rotation_mode(),
        "request_count": _rotation_request_count,
        "last_request_at": _last_rotation_request_at,
    }
