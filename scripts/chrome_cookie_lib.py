"""Chrome cookie 提取共享库（Windows 专用）。

封装了 Chrome v10/v11 加密 cookie 的本地解密逻辑，供
update_taobao_cookie.py / update_gpai_cookie.py 等脚本复用。

依赖：pywin32, pycryptodomex
"""
import os
import sys
import json
import shutil
import sqlite3
import subprocess
from pathlib import Path

CHROME_PROFILE = Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/User Data/Default"
COOKIES_DB = CHROME_PROFILE / "Network" / "Cookies"
LOCAL_STATE = Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/User Data/Local State"


def _ensure(pkg: str, import_name: str = ""):
    """惰性安装依赖。"""
    try:
        __import__(import_name or pkg)
    except ImportError:
        print(f"  安装依赖 {pkg}...")
        subprocess.run([sys.executable, "-m", "pip", "install", pkg], check=True)


def get_master_key() -> bytes:
    """读取 Chrome Local State 里的 DPAPI 加密 master key 并解密。"""
    import base64
    _ensure("pywin32", "win32crypt")
    import win32crypt

    with open(LOCAL_STATE, "r", encoding="utf-8") as f:
        local_state = json.load(f)
    encrypted_key = base64.b64decode(local_state["os_crypt"]["encrypted_key"])
    encrypted_key = encrypted_key[5:]  # 去掉 "DPAPI" 前缀
    master_key = win32crypt.CryptUnprotectData(encrypted_key, None, None, None, 0)[1]
    return master_key


def decrypt_cookie(encrypted_value: bytes, master_key: bytes) -> str:
    """解密单条 Chrome v10/v11 加密 cookie。"""
    _ensure("pycryptodomex", "Cryptodome.Cipher")
    from Cryptodome.Cipher import AES

    if encrypted_value[:3] in (b"v10", b"v11"):
        nonce = encrypted_value[3:15]
        ciphertext = encrypted_value[15:-16]
        tag = encrypted_value[-16:]
        cipher = AES.new(master_key, AES.MODE_GCM, nonce=nonce)
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)
        return plaintext.decode("utf-8", errors="replace")
    else:
        # 旧格式 DPAPI
        import win32crypt
        return win32crypt.CryptUnprotectData(encrypted_value, None, None, None, 0)[1].decode("utf-8", errors="replace")


def _copy_db_via_winapi() -> Path:
    """Chrome 锁住 cookie DB 时，用 Win32 共享读 fallback 复制一份到 TEMP。"""
    import ctypes
    from ctypes import wintypes

    tmp_db = Path(os.environ.get("TEMP", ".")) / "chrome_cookies_tmp.db"

    # 先尝试普通复制
    try:
        shutil.copy2(COOKIES_DB, tmp_db)
        return tmp_db
    except PermissionError:
        pass

    # fallback: Win32 共享读
    kernel32 = ctypes.windll.kernel32
    kernel32.CreateFileW.restype = wintypes.HANDLE
    kernel32.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                                      ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    FILE_SHARE_READ = 0x1
    FILE_SHARE_WRITE = 0x2
    FILE_SHARE_DELETE = 0x4
    OPEN_EXISTING = 3
    GENERIC_READ = 0x80000000
    INVALID_HANDLE = -1

    h = kernel32.CreateFileW(
        str(COOKIES_DB), GENERIC_READ,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        None, OPEN_EXISTING, 0, None
    )
    if h is None or h == INVALID_HANDLE or h == 0xFFFFFFFFFFFFFFFF:
        err = ctypes.get_last_error()
        print(f"  Chrome 锁住了 cookie 数据库 (handle={h}, err={err})")
        print("  请彻底关闭所有 Chrome 窗口（包括后台进程）后重试")
        sys.exit(1)
    size_low = kernel32.GetFileSize(h, None)
    buf = ctypes.create_string_buffer(size_low)
    bytes_read = wintypes.DWORD(0)
    ok = kernel32.ReadFile(h, buf, size_low, ctypes.byref(bytes_read), None)
    kernel32.CloseHandle(h)
    if not ok or bytes_read.value == 0:
        print(f"  ReadFile 失败 ok={ok} bytes_read={bytes_read.value}")
        sys.exit(1)
    with open(tmp_db, "wb") as f:
        f.write(buf.raw[:bytes_read.value])
    print(f"  通过 Win32 共享读模式复制了 {bytes_read.value} 字节")
    return tmp_db


def extract_cookies_for_host(host_pattern: str) -> dict:
    """提取指定 host 的所有 cookie。

    Args:
        host_pattern: SQL LIKE 模式，例如 '%taobao.com' 或 '%gpai.net'
    Returns:
        {name: value} 字典
    """
    if not COOKIES_DB.exists():
        print(f"错误：找不到 Chrome Cookie 数据库：{COOKIES_DB}")
        sys.exit(1)

    tmp_db = _copy_db_via_winapi()
    master_key = get_master_key()

    conn = sqlite3.connect(str(tmp_db))
    cur = conn.cursor()
    cur.execute(
        "SELECT name, encrypted_value, value FROM cookies WHERE host_key LIKE ?",
        (host_pattern,),
    )
    rows = cur.fetchall()
    conn.close()
    tmp_db.unlink(missing_ok=True)

    cookies = {}
    for name, encrypted_value, value in rows:
        if encrypted_value:
            try:
                v = decrypt_cookie(encrypted_value, master_key)
                cookies[name] = v
            except Exception:
                if value:
                    cookies[name] = value
        elif value:
            cookies[name] = value

    return cookies


def push_env_var_to_server(env_key: str, env_value: str, ssh_key: str, server_ip: str = "122.51.156.252") -> bool:
    """SSH 到服务器更新 .env 中的某个变量。"""
    # 用 sed -E 替换；env_value 可能含 |，所以分隔符用 #
    safe_value = env_value.replace("#", r"\#")
    cmd = [
        "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        f"ubuntu@{server_ip}",
        f"for f in /opt/fapai/crawler/.env /opt/fapai/.env /opt/fapai/backend/.env; do "
        f"  [ -f \"$f\" ] || continue; "
        f"  if grep -q '^{env_key}=' \"$f\"; then "
        f"    sed -i 's#^{env_key}=.*#{env_key}={safe_value}#' \"$f\"; "
        f"  else "
        f"    echo '{env_key}={safe_value}' >> \"$f\"; "
        f"  fi; "
        f"done && echo OK"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print(f"SSH 错误: {result.stderr}")
        return False
    return True
