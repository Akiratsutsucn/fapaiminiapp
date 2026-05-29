"""一键提取本地 Chrome 的淘宝 Cookie，并推送到服务器更新 .env。

【新版】使用 Chrome 远程调试协议（CDP）拿 cookie，完全绕过 v20/App-Bound Encryption。
- Chrome 137+ 强制使用 v20 加密格式，传统的 DPAPI + AES-GCM 解密方法已失效
- 本脚本启动 Chrome 时附加 --remote-debugging-port=9222，通过 DevTools API 拿明文 cookie
- 完全合法，不破解任何加密

用法：
1. 关闭所有 Chrome 窗口（脚本会用调试模式重新启动）
2. 运行：python update_taobao_cookie.py
3. 脚本会自动打开 sf.taobao.com，**如果未登录请在弹出的 Chrome 里完成登录**
4. 看到「按 Enter 继续」时，在终端按回车（确保 cookie 已落盘）
5. 脚本提取 cookie 并推送到服务器
"""
import os
import sys
import json
import time
import subprocess
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import quote

# Chrome 路径
CHROME_PATHS = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
]
DEBUG_PORT = 9222
USER_DATA_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/User Data"

# 关键 cookie key（淘宝 sf 必需的登录态）
NEEDED_COOKIES = [
    "_cc_", "_l_g_", "_m_h5_tk", "_m_h5_tk_enc",
    "_nk_", "_samesite_flag_", "_tb_token_",
]

SERVER_IP = "122.51.156.252"
SSH_KEY = r"C:\Users\Administrator\Desktop\workspace\法拍者联盟小程序\xiaochengxu.pem"


def find_chrome() -> Path:
    for p in CHROME_PATHS:
        if p.exists():
            return p
    print("错误：找不到 Chrome 安装路径")
    sys.exit(1)


def kill_chrome():
    """杀掉所有 Chrome 进程，否则 --remote-debugging-port 启动会失败。"""
    subprocess.run(
        ["taskkill", "/F", "/IM", "chrome.exe"],
        capture_output=True, text=True
    )
    time.sleep(2)


def start_chrome_debug(chrome: Path) -> subprocess.Popen:
    """以调试模式启动 Chrome，访问淘宝 sf 首页。"""
    # 用一个独立的 user-data-dir 避免和当前用户的 profile 冲突
    # 但我们要复用现有 cookie，所以用默认 profile + 调试端口
    cmd = [
        str(chrome),
        f"--remote-debugging-port={DEBUG_PORT}",
        f"--user-data-dir={USER_DATA_DIR}",
        "https://sf.taobao.com/list/0_50.htm",
    ]
    print(f"[chrome] 启动: {' '.join(cmd[:3])}...")
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return proc


def wait_for_debugger(timeout: int = 20) -> bool:
    """等 Chrome 调试端口就绪。"""
    for i in range(timeout):
        try:
            with urlopen(f"http://localhost:{DEBUG_PORT}/json/version", timeout=2) as r:
                data = json.loads(r.read())
                print(f"[chrome] DevTools 就绪: {data.get('Browser', '?')}")
                return True
        except Exception:
            time.sleep(1)
    return False


def get_taobao_cookies() -> dict:
    """通过 DevTools Network.getAllCookies 拿所有 cookie，过滤 .taobao.com。"""
    # 先找一个 page target（必须是 page 类型才能用 Network 域）
    with urlopen(f"http://localhost:{DEBUG_PORT}/json", timeout=5) as r:
        targets = json.loads(r.read())
    page_target = None
    for t in targets:
        if t.get("type") == "page":
            page_target = t
            break
    if not page_target:
        print("[chrome] 找不到 page target")
        return {}

    # 通过 HTTP 端点直接调 Network.getAllCookies
    # Chrome 也支持 /json/protocol 但我们这里用 WebSocket
    try:
        from websocket import create_connection
    except ImportError:
        print("  安装 websocket-client...")
        subprocess.run([sys.executable, "-m", "pip", "install", "websocket-client"], check=True)
        from websocket import create_connection

    ws_url = page_target["webSocketDebuggerUrl"]
    ws = create_connection(ws_url, timeout=10)
    ws.send(json.dumps({"id": 1, "method": "Network.getAllCookies"}))
    resp = json.loads(ws.recv())
    ws.close()

    if "result" not in resp:
        print(f"[chrome] CDP 错误: {resp}")
        return {}

    all_cookies = resp["result"].get("cookies", [])
    print(f"[chrome] 共拿到 {len(all_cookies)} 个 cookie")

    # 过滤 .taobao.com 域
    result = {}
    for c in all_cookies:
        domain = c.get("domain", "")
        if "taobao.com" in domain or "tmall.com" in domain:
            result[c["name"]] = c["value"]
    return result


def build_cookie_string(cookies: dict) -> str:
    """组装成 .env 用的 TAOBAO_COOKIE 字符串。"""
    parts = []
    used = set()
    for k in NEEDED_COOKIES:
        if k in cookies:
            parts.append(f"{k}={cookies[k]}")
            used.add(k)
        else:
            print(f"  警告：未找到关键 cookie {k}")

    # 加可选字段
    for k, v in cookies.items():
        if k in used or not v:
            continue
        if k.startswith("_uab_") or k.startswith("Hm_") or k.startswith("_ga"):
            continue
        parts.append(f"{k}={v}")
    return "; ".join(parts)


def push_to_server(cookie_str: str) -> bool:
    """SSH 到服务器更新 .env 中的 TAOBAO_COOKIE。"""
    # 用引号包裹，避免分号被 shell source 时炸
    safe = cookie_str.replace('"', r'\"').replace('$', r'\$')
    cmd = [
        "ssh", "-i", SSH_KEY, "-o", "StrictHostKeyChecking=no",
        f"ubuntu@{SERVER_IP}",
        f'for f in /opt/fapai/crawler/.env /opt/fapai/.env /opt/fapai/backend/.env; do '
        f'  [ -f "$f" ] || continue; '
        f'  sudo sed -i "/^TAOBAO_COOKIE=/d" "$f"; '
        f'  echo "TAOBAO_COOKIE=\\"{safe}\\"" | sudo tee -a "$f" > /dev/null; '
        f'done && echo OK'
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print(f"SSH 错误: {result.stderr}")
        return False
    return True


def main():
    print("=" * 60)
    print("淘宝 Cookie 自动提取工具（CDP 版，绕过 v20）")
    print("=" * 60)

    chrome = find_chrome()
    print(f"\n[1/4] Chrome 路径: {chrome}")

    # 检测是否已经有调试 Chrome 在跑
    print(f"\n[2/4] 检测调试端口 {DEBUG_PORT}...")
    if not wait_for_debugger(timeout=2):
        # 没有调试 Chrome，引导用户手动启动
        print("\n" + "*" * 60)
        print("* 没检测到调试模式 Chrome。请按以下步骤操作：")
        print("*")
        print("* 1. 关闭所有 Chrome 窗口（任务管理器里也清干净）")
        print("*")
        print("* 2. 在【新】cmd 窗口里跑这一行（一行复制粘贴）：")
        print("*")
        print(f'*    "{chrome}" --remote-debugging-port={DEBUG_PORT} --user-data-dir="{USER_DATA_DIR}" https://sf.taobao.com/list/0_50.htm')
        print("*")
        print("* 3. Chrome 会打开淘宝页面（应该已是登录态）")
        print("*    - 已登录：直接回到这里按回车")
        print("*    - 未登录：在 Chrome 里扫码或账号密码登录后再按回车")
        print("*" * 60)
        try:
            input("\n准备好之后按回车继续 >>> ")
        except (EOFError, KeyboardInterrupt):
            print("\n用户取消")
            sys.exit(1)
        # 再次检测
        if not wait_for_debugger(timeout=10):
            print("\n仍然连接不上调试端口，请确认 Chrome 已用 --remote-debugging-port=9222 启动")
            sys.exit(1)
    else:
        print(f"  检测到已有调试模式 Chrome 在跑，直接复用")

    print("\n[3/4] 通过 CDP 提取淘宝 cookie...")
    cookies = get_taobao_cookies()
    if not cookies:
        print("没有拿到淘宝 cookie，请确认 Chrome 里已登录淘宝")
        sys.exit(1)

    print(f"  找到 {len(cookies)} 个淘宝/天猫 cookie")
    if "_m_h5_tk" in cookies:
        tk = cookies["_m_h5_tk"]
        print(f"  _m_h5_tk: {tk[:30]}...")
        if "_" in tk:
            from datetime import datetime
            try:
                ts = int(tk.rsplit("_", 1)[1])
                print(f"  有效期至: {datetime.fromtimestamp(ts/1000).strftime('%Y-%m-%d %H:%M:%S')}")
            except (ValueError, IndexError):
                pass

    cookie_str = build_cookie_string(cookies)
    print(f"  cookie 字符串长度: {len(cookie_str)} 字符")
    if not cookie_str:
        print("空 cookie 字符串，退出")
        sys.exit(1)

    print("\n[4/4] 推送到服务器并更新 .env...")
    success = push_to_server(cookie_str)

    if success:
        print("\n" + "=" * 60)
        print("完成！服务器 TAOBAO_COOKIE 已更新。")
        print("可以关闭调试模式 Chrome 窗口了。")
        print("=" * 60)
    else:
        print("\n推送失败，请手动复制以下内容到服务器 .env:")
        print(f"\nTAOBAO_COOKIE={cookie_str}\n")


if __name__ == "__main__":
    main()
