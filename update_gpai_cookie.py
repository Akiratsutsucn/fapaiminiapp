"""一键提取本地 Chrome 的公拍网 Cookie，并推送到服务器更新 .env。

使用场景（备用）：当公拍网未来开始要求登录才能访问详情页时，运行此脚本注入 cookie。
当前公拍网默认 anonymous 即可访问，本脚本平时不需要使用。

用法：
1. 用 Chrome 打开 https://www.gpai.net 并完成登录（手机号/微信扫码）
2. 关闭 Chrome（脚本要读 Cookies 数据库）
3. 运行：python update_gpai_cookie.py

如果服务器上没有 Chrome，可以选择 update_gpai_cookie_auto.py（基于 Playwright 自动登录）。
"""
import sys
from pathlib import Path

# 让 scripts 模块能找到
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.chrome_cookie_lib import extract_cookies_for_host, push_env_var_to_server  # noqa: E402

SSH_KEY = r"C:\Users\Administrator\Desktop\workspace\法拍者联盟小程序\xiaochengxu.pem"

# 公拍网常见关键 cookie（实际登录态字段名以网站为准，缺失不致命）
COMMON_KEYS = ["JSESSIONID", "ASP.NET_SessionId", "userId", "userToken", "loginToken", "token"]


def build_cookie_string(cookies: dict) -> str:
    """组装成 .env 用的 GPAI_COOKIE 字符串。"""
    parts = []
    used = set()
    # 优先收常见 key
    for k in COMMON_KEYS:
        if k in cookies:
            parts.append(f"{k}={cookies[k]}")
            used.add(k)
    # 再加上其他所有 cookie（兜底）
    for k, v in cookies.items():
        if k in used:
            continue
        if not v:
            continue
        # 跳过明显是分析/广告类
        if k.startswith("_ga") or k.startswith("_gid") or k.startswith("Hm_") or k.startswith("_uab_"):
            continue
        parts.append(f"{k}={v}")
    return "; ".join(parts)


if __name__ == "__main__":
    print("=" * 60)
    print("公拍网 Cookie 自动提取工具（备用）")
    print("=" * 60)
    print()
    print("[1/3] 从本地 Chrome 提取公拍网 Cookie...")
    cookies = extract_cookies_for_host("%gpai.net")
    if not cookies:
        print("未找到 .gpai.net cookie。请先用 Chrome 打开 https://www.gpai.net 登录后再运行此脚本。")
        sys.exit(1)
    print(f"  找到 {len(cookies)} 个 .gpai.net cookie")
    # 显示主要 key 帮你确认
    for k in COMMON_KEYS:
        if k in cookies:
            v = cookies[k]
            print(f"  {k}: {v[:30]}{'...' if len(v) > 30 else ''}")

    print()
    print("[2/3] 组装 Cookie 字符串...")
    cookie_str = build_cookie_string(cookies)
    print(f"  长度: {len(cookie_str)} 字符")
    if not cookie_str:
        print("没有可用 cookie，退出。")
        sys.exit(1)

    print()
    print("[3/3] 推送到服务器并更新 .env...")
    if push_env_var_to_server("GPAI_COOKIE", cookie_str, SSH_KEY):
        print()
        print("=" * 60)
        print("完成！服务器 GPAI_COOKIE 已更新。")
        print("现在可以在管理后台触发公拍网爬虫了。")
        print("=" * 60)
    else:
        print("推送失败，请手动复制以下内容到服务器 .env:")
        print()
        print(f"GPAI_COOKIE={cookie_str}")
