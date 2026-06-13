"""换 IP 抽象层 —— 面向未来的统一接口。

设计目的：把「需要换 IP」这个动作和「具体怎么换」解耦。
上层(如 SSR 熔断)只调 request_ip_rotation()，不关心当前是手动还是自动换。

当前阶段(固定住宅IP，只能手动换、每天≤20次)：
    实现 = 记录一次「换IP请求」事件 + 返回 manual_required，让上层把
    「IP被风控,需手动切换」写进任务状态,供运维早上看到后手动换IP重跑。
    ❌ 不调用任何换IP API(此前 90daili 自动换IP接口已失效并禁用)。

未来阶段(换服务商,API 地址池 ~1000 IP):
    只需把 _ROTATION_MODE 改为 "auto" 并实现 _rotate_via_pool()——
    从地址池 API 取下一个 IP 切换。上层熔断逻辑零改动。

环境变量(未来启用自动换IP时):
    IP_ROTATION_MODE = manual | auto   (默认 manual)
    IP_POOL_API_URL  = 地址池提取API(auto模式用)
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
    """[未来实现] 从地址池API取下一个IP并切换。

    换服务商后在此实现:调 IP_POOL_API_URL 取新IP → 更新本地代理出口。
    目前未接入,返回 False。
    """
    api_url = os.getenv("IP_POOL_API_URL", "").strip()
    if not api_url:
        logger.warning("[ip_rotator] auto模式但未配置 IP_POOL_API_URL,无法换IP")
        return False
    # TODO(换服务商后): 调用地址池API取IP、切换 socks 桥上游出口。
    logger.warning("[ip_rotator] _rotate_via_pool 尚未实现(待换服务商后接入地址池)")
    return False


def stats() -> dict:
    """供上层/监控查询换IP请求情况。"""
    return {
        "mode": rotation_mode(),
        "request_count": _rotation_request_count,
        "last_request_at": _last_rotation_request_at,
    }
