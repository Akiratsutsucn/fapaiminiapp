"""隧道代理换 IP 工具。

适配 90daili 隧道代理：入口 IP:端口固定（PROXY_POOL），后端出口 IP 可换。
撞风控时调 triggerTunnelIpChange 换一个新出口 IP，而不是冷却唯一的入口。

环境变量：
    TUNNEL_IP_CHANGE_URL=http://api.90daili.com/api/v3/triggerTunnelIpChange?uid=xxx&id=yyy
        触发换 IP 的 API。为空则禁用主动换 IP（退回原冷却逻辑）。
    TUNNEL_IP_CHANGE_MIN_INTERVAL=30
        两次主动换 IP 的最小间隔（秒），避免频繁调用被代理商限流。
"""
from __future__ import annotations
import os
import time

import httpx
from loguru import logger


# 上次换 IP 时间戳（进程内，节流用）
_last_change_at: float = 0.0


def _min_interval() -> float:
    try:
        return float(os.getenv("TUNNEL_IP_CHANGE_MIN_INTERVAL", "30"))
    except (TypeError, ValueError):
        return 30.0


def is_enabled() -> bool:
    # 已禁用：住宅IP服务商不支持API自动换IP(只能手动换、每天≤20次)。
    # 此前 trigger_ip_change 每撞风控就自动调用，一晚303次全失败(订单不存在),
    # 纯属无效调用且可能触发服务商换IP次数限制。固定IP下重试也徒劳(同IP同结果)。
    # 全局关闭，所有调用点(anti_block/browser/community_scraper/taobao_paimai)自动跳过。
    return False


def trigger_ip_change(reason: str = "", *, force: bool = False) -> bool:
    """触发隧道代理换一个新出口 IP（同步阻塞，超时 15s）。

    返回 True 表示已发起换 IP（或刚换过仍在间隔内当作成功），False 表示未配置或失败。
    force=True 时忽略最小间隔（用于明确需要立即换的场景）。
    """
    global _last_change_at
    url = os.getenv("TUNNEL_IP_CHANGE_URL", "").strip()
    if not url:
        return False

    now = time.time()
    interval = _min_interval()
    if not force and (now - _last_change_at) < interval:
        # 间隔内已经换过，跳过（视作成功，避免上层误判）
        logger.debug(f"[tunnel] 换IP间隔未到（{interval}s），跳过本次触发 reason={reason}")
        return True

    try:
        resp = httpx.get(url, timeout=15.0)
        ok = resp.status_code == 200
        if ok:
            _last_change_at = time.time()
            logger.info(f"[tunnel] 已触发换IP reason={reason} resp={resp.text[:120]}")
        else:
            logger.warning(f"[tunnel] 换IP接口返回 HTTP {resp.status_code}: {resp.text[:120]}")
        return ok
    except Exception as e:
        logger.warning(f"[tunnel] 换IP失败 reason={reason}: {e}")
        return False
