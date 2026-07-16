"""爬虫侧控制本地 socks 桥(socks_bridge.py)立即换出口IP。

机制：touch 一个 kick 文件更新其 mtime；桥在下次取IP时检测到 mtime 变新即强制
换一个新的青果出口IP。跨进程、无需知道桥 PID、无需网络接口。

桥端读同一路径(QG_KICK_FILE，默认 /tmp/fapai_bridge_kick)。桥按 TTL 本就会自动
轮换出口IP，本模块只是让爬虫能在「主动切IP/撞风控」时提前触发一次，不是必需路径——
触发失败时桥仍会按 TTL 自然轮换，故所有异常都吞掉、不影响爬虫主流程。
"""
from __future__ import annotations
import asyncio
import os

from loguru import logger

KICK_FILE = os.getenv("QG_KICK_FILE", "/tmp/fapai_bridge_kick").strip()


def _touch_kick() -> None:
    # 更新 mtime（文件不存在则创建）。用 utime 显式推进，避免同秒内 mtime 不变。
    with open(KICK_FILE, "a"):
        pass
    os.utime(KICK_FILE, None)


async def force_bridge_ip_change(reason: str = "") -> bool:
    """请求桥立即换一个新出口IP。返回是否成功发出请求（非换IP本身成功）。"""
    try:
        await asyncio.to_thread(_touch_kick)
        logger.debug(f"[bridge_ctl] 已请求桥换IP reason={reason}")
        return True
    except Exception as e:
        logger.debug(f"[bridge_ctl] 请求桥换IP失败 reason={reason}: {e}")
        return False
