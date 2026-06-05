"""本地无认证 SOCKS5 → 云镜认证 SOCKS5 上游 的纯 asyncio 桥接器。

用途：Chromium 不支持带认证的 socks5 代理，故在本机起一个无认证 socks5 监听端口，
把流量经云镜隧道(带认证)转发出去，让浏览器(阿里详情 SSR)走轮换住宅 IP 绕过限流。

只实现绕过 Chromium 限制所需的最小子集：
  - 本地端：SOCKS5 无认证、CONNECT、DOMAINNAME/IPv4/IPv6
  - 上游端：SOCKS5 用户名/密码认证(RFC1929)，CONNECT，按域名透传(socks5h 语义)

用法：python -m crawler.socks_bridge  （读 .env 的 UPSTREAM_SOCKS / 默认云镜）
环境变量：
  LOCAL_SOCKS_PORT (默认 11080)
  UPSTREAM_SOCKS_HOST / UPSTREAM_SOCKS_PORT / UPSTREAM_SOCKS_USER / UPSTREAM_SOCKS_PASS
"""
import asyncio
import os
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

LOCAL_HOST = "127.0.0.1"
LOCAL_PORT = int(os.getenv("LOCAL_SOCKS_PORT", "11080"))
UP_HOST = os.getenv("UPSTREAM_SOCKS_HOST", "s2.yunjingl2tp.com")
UP_PORT = int(os.getenv("UPSTREAM_SOCKS_PORT", "15432"))
UP_USER = os.getenv("UPSTREAM_SOCKS_USER", "s31dyaf1")
UP_PASS = os.getenv("UPSTREAM_SOCKS_PASS", "123456")


async def _readn(reader, n):
    return await reader.readexactly(n)


async def upstream_connect(dst_host: str, dst_port: int):
    """与云镜上游建立 socks5(认证) 连接，请求 CONNECT 到 dst_host:dst_port。返回 (r, w)。"""
    r, w = await asyncio.open_connection(UP_HOST, UP_PORT)
    # greeting: 支持 no-auth(0) + user/pass(2)
    w.write(b"\x05\x02\x00\x02")
    await w.drain()
    ver, method = await _readn(r, 2)
    if method == 0x02:
        # RFC1929 user/pass
        u = UP_USER.encode(); p = UP_PASS.encode()
        w.write(b"\x01" + bytes([len(u)]) + u + bytes([len(p)]) + p)
        await w.drain()
        _, status = await _readn(r, 2)
        if status != 0x00:
            w.close(); raise OSError("上游认证失败")
    elif method != 0x00:
        w.close(); raise OSError(f"上游不支持的认证方法 {method}")
    # CONNECT request，按域名(socks5h)
    host_b = dst_host.encode()
    req = b"\x05\x01\x00\x03" + bytes([len(host_b)]) + host_b + struct.pack(">H", dst_port)
    w.write(req); await w.drain()
    # reply
    rep = await _readn(r, 4)
    if rep[1] != 0x00:
        w.close(); raise OSError(f"上游CONNECT失败 code={rep[1]}")
    atyp = rep[3]
    if atyp == 0x01:
        await _readn(r, 4)
    elif atyp == 0x03:
        ln = (await _readn(r, 1))[0]; await _readn(r, ln)
    elif atyp == 0x04:
        await _readn(r, 16)
    await _readn(r, 2)  # bound port
    return r, w


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
            ur, uw = await upstream_connect(host, port)
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
    server = await asyncio.start_server(handle_client, LOCAL_HOST, LOCAL_PORT)
    print(f"[socks_bridge] 本地无认证 socks5://{LOCAL_HOST}:{LOCAL_PORT} → 上游 {UP_HOST}:{UP_PORT}(认证)", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
