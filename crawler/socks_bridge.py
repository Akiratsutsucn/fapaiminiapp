"""本地无认证 SOCKS5 → 青果按量提取住宅代理 的纯 asyncio 桥接器。

用途：Chromium/httpx 直接对接青果短效住宅代理不方便(每次要提取新IP、IP约1分钟失效)，
故在本机起一个无认证 socks5 监听端口，屏蔽上游细节：
  - 本地端：SOCKS5 无认证、CONNECT、DOMAINNAME/IPv4/IPv6（爬虫全部只连这里）
  - 上游端：青果 HTTP 代理（对返回的 server 发 HTTP CONNECT，账密 Authkey:Authpwd）

青果按量提取(qg.net)：
  - 提取: GET https://share.proxy.qg.net/get?key=<Authkey>&num=1&distinct=true
    → {code:SUCCESS, data:[{proxy_ip, server:"ip:port", area, isp, deadline}]}
  - server 才是代理地址；IP 短效(实测约 1 分钟失效)；限速 60 次/分钟。
  - 换 IP = 重新提取。本桥按 TTL 缓存一个当前出口，到期或失败自动换新。

会话/IP 策略：
  - 全桥共享「当前出口 IP」，TTL 内所有新连接复用同一出口(保证单个 SSR 页面的所有子请求
    走同一住宅 IP，不跳变触发风控)；TTL 到期后下一个新连接触发换 IP。
  - CONNECT 上游失败(IP 已失效/被拒)→ 强制换一次 IP 重试，仍失败才回本地报错。
  - 提取受 60 次/分钟限流：TTL 默认 45s → 稳态约 1.3 次/分钟，远低于上限。

用法：python -m crawler.socks_bridge  （读 /opt/fapai/.env 的 QG_* 配置）
环境变量：
  LOCAL_SOCKS_PORT (默认 11080)
  QG_KEY   (青果 Authkey，默认读 QG_KEY)
  QG_PWD   (青果 Authpwd，账密鉴权用；留空则依赖白名单免账密)
  QG_FETCH_URL (提取API，默认 https://share.proxy.qg.net/get)
  QG_IP_TTL (出口IP复用秒数，默认 45)
  QG_AREA / QG_AREA_EX / QG_ISP (可选：地区/排除地区/运营商过滤)
"""
import asyncio
import base64
import json
import os
import struct
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

LOCAL_HOST = "127.0.0.1"
LOCAL_PORT = int(os.getenv("LOCAL_SOCKS_PORT", "11080"))

QG_KEY = os.getenv("QG_KEY", "").strip()
QG_PWD = os.getenv("QG_PWD", "").strip()
QG_FETCH_URL = os.getenv("QG_FETCH_URL", "https://share.proxy.qg.net/get").strip()
QG_IP_TTL = float(os.getenv("QG_IP_TTL", "45"))
# 外部强制换IP的信号文件：爬虫 touch 它，桥在下次取IP时检测到 mtime 变新即强制换出口。
# 跨进程、无需PID/网络接口。见 crawler/socks_bridge_ctl.py。
QG_KICK_FILE = os.getenv("QG_KICK_FILE", "/tmp/fapai_bridge_kick").strip()
QG_AREA = os.getenv("QG_AREA", "").strip()
QG_AREA_EX = os.getenv("QG_AREA_EX", "").strip()
QG_ISP = os.getenv("QG_ISP", "").strip()

# 提取失败时的最短重试间隔(秒)，避免撞 60次/分钟 限流后疯狂重试
_FETCH_MIN_INTERVAL = 1.2


def _log(msg: str):
    print(f"[socks_bridge] {msg}", flush=True)


async def _readn(reader, n):
    return await reader.readexactly(n)


# ===== 青果出口 IP 管理 =====
class QGProxyManager:
    """维护「当前青果出口代理」，TTL 缓存 + 失败换新 + 限流保护。"""

    def __init__(self):
        self._server: str | None = None       # "ip:port"
        self._area: str = ""
        self._fetched_at: float = 0.0
        self._last_fetch_call: float = 0.0
        self._kick_mtime: float = 0.0          # 上次已响应的 kick 文件 mtime
        self._lock = asyncio.Lock()

    def _kicked(self) -> bool:
        """检测外部是否请求了强制换IP(kick 文件 mtime 变新)。"""
        try:
            m = os.stat(QG_KICK_FILE).st_mtime
        except OSError:
            return False
        if m > self._kick_mtime:
            self._kick_mtime = m
            return True
        return False

    def _build_fetch_url(self) -> str:
        params = {"key": QG_KEY, "num": "1", "distinct": "true"}
        if QG_AREA:
            params["area"] = QG_AREA
        if QG_AREA_EX:
            params["area_ex"] = QG_AREA_EX
        if QG_ISP:
            params["isp"] = QG_ISP
        return QG_FETCH_URL + "?" + urllib.parse.urlencode(params)

    def _fetch_sync(self) -> tuple[str, str]:
        """同步 HTTP 拉一个新出口。返回 (server, area)。失败抛异常。"""
        url = self._build_fetch_url()
        req = urllib.request.Request(url, headers={"User-Agent": "fapai-bridge/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8", "ignore")
        data = json.loads(body)
        if data.get("code") != "SUCCESS" or not data.get("data"):
            raise OSError(f"青果提取失败: {body[:200]}")
        item = data["data"][0]
        server = item.get("server", "").strip()
        if not server or ":" not in server:
            raise OSError(f"青果返回无效 server: {item}")
        return server, item.get("area", "")

    async def get(self, force: bool = False) -> str:
        """返回当前可用出口 server(ip:port)。TTL 过期或 force 时换新。"""
        async with self._lock:
            now = time.time()
            fresh = (
                self._server
                and not force
                and not self._kicked()          # 外部请求换IP → 视作不新鲜
                and (now - self._fetched_at) < QG_IP_TTL
            )
            if fresh:
                return self._server

            # 限流保护：两次真实提取之间至少间隔 _FETCH_MIN_INTERVAL
            wait = _FETCH_MIN_INTERVAL - (now - self._last_fetch_call)
            if wait > 0:
                await asyncio.sleep(wait)

            self._last_fetch_call = time.time()
            server, area = await asyncio.to_thread(self._fetch_sync)
            self._server = server
            self._area = area
            self._fetched_at = time.time()
            _log(f"换出口IP → {server} ({area})")
            return server


qg = QGProxyManager()


async def upstream_connect(dst_host: str, dst_port: int, server: str):
    """经青果 HTTP 代理 server 发 CONNECT 到 dst_host:dst_port。返回 (r, w)。"""
    up_host, up_port = server.rsplit(":", 1)
    r, w = await asyncio.open_connection(up_host, int(up_port))
    req = (
        f"CONNECT {dst_host}:{dst_port} HTTP/1.1\r\n"
        f"Host: {dst_host}:{dst_port}\r\n"
    )
    if QG_KEY and QG_PWD:
        token = base64.b64encode(f"{QG_KEY}:{QG_PWD}".encode()).decode()
        req += f"Proxy-Authorization: Basic {token}\r\n"
    req += "Proxy-Connection: Keep-Alive\r\n\r\n"
    w.write(req.encode())
    await w.drain()

    # 读 CONNECT 响应头(到 \r\n\r\n 为止)
    raw = b""
    while b"\r\n\r\n" not in raw:
        chunk = await r.read(1024)
        if not chunk:
            w.close()
            raise OSError("上游 CONNECT 无响应")
        raw += chunk
        if len(raw) > 65536:
            w.close()
            raise OSError("上游 CONNECT 响应头过大")
    status_line = raw.split(b"\r\n", 1)[0].decode("latin1", "ignore")
    parts = status_line.split(" ", 2)
    if len(parts) < 2 or not parts[1].startswith("2"):
        w.close()
        raise OSError(f"上游 CONNECT 失败: {status_line}")
    return r, w


async def upstream_connect_with_retry(dst_host: str, dst_port: int):
    """拿当前出口发 CONNECT；失败则强制换 IP 重试一次。"""
    server = await qg.get()
    try:
        return await upstream_connect(dst_host, dst_port, server)
    except Exception as e:
        _log(f"CONNECT via {server} 失败({e})，换IP重试")
        server = await qg.get(force=True)
        return await upstream_connect(dst_host, dst_port, server)


async def pipe(reader, writer):
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def handle_client(creader, cwriter):
    try:
        # 本地 socks5 无认证握手
        ver_nmethods = await _readn(creader, 2)
        if ver_nmethods[0] != 0x05:
            cwriter.close(); return
        nmethods = ver_nmethods[1]
        await _readn(creader, nmethods)
        cwriter.write(b"\x05\x00")  # no-auth
        await cwriter.drain()
        # request
        hdr = await _readn(creader, 4)
        if hdr[1] != 0x01:  # only CONNECT
            cwriter.write(b"\x05\x07\x00\x01\x00\x00\x00\x00\x00\x00"); await cwriter.drain()
            cwriter.close(); return
        atyp = hdr[3]
        if atyp == 0x01:
            host = ".".join(str(b) for b in await _readn(creader, 4))
        elif atyp == 0x03:
            ln = (await _readn(creader, 1))[0]
            host = (await _readn(creader, ln)).decode("utf-8", "ignore")
        elif atyp == 0x04:
            raw = await _readn(creader, 16)
            host = ":".join(format(x, "x") for x in struct.unpack(">8H", raw))
        else:
            cwriter.close(); return
        port = struct.unpack(">H", await _readn(creader, 2))[0]

        try:
            ur, uw = await upstream_connect_with_retry(host, port)
        except Exception:
            cwriter.write(b"\x05\x01\x00\x01\x00\x00\x00\x00\x00\x00")
            await cwriter.drain(); cwriter.close(); return
        # success reply
        cwriter.write(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
        await cwriter.drain()
        # 双向桥接
        await asyncio.gather(pipe(creader, uw), pipe(ur, cwriter))
    except (asyncio.IncompleteReadError, ConnectionError):
        try: cwriter.close()
        except Exception: pass
    except Exception:
        try: cwriter.close()
        except Exception: pass


async def main():
    if not QG_KEY:
        _log("警告：未配置 QG_KEY，青果提取会失败。请在 .env 设置 QG_KEY/QG_PWD。")
    server = await asyncio.start_server(handle_client, LOCAL_HOST, LOCAL_PORT)
    _log(
        f"本地无认证 socks5://{LOCAL_HOST}:{LOCAL_PORT} → 青果按量提取"
        f"(TTL={QG_IP_TTL}s, area={QG_AREA or '不限'})"
    )
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
