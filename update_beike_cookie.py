"""更新贝壳找房（sh.ke.com / nb.ke.com）的 cookie 到生产服务器 .env。

为什么需要：贝壳现在所有小区搜索/详情页都需要登录验证（未登录会重定向到 hip.ke.com/captcha）。
我们用 cookie 绕过这一关，让爬虫能正常抓取小区详情。

用法（最简流程，2 分钟搞定）：
1. 用 Chrome / Edge 打开 https://sh.ke.com 并完成登录（手机号验证码即可）
2. F12 打开开发者工具 → Application → Cookies → https://sh.ke.com
3. 全选所有 cookie 行，复制（Ctrl+C）
4. 在终端运行：python update_beike_cookie.py
5. 把粘贴板里的 cookie 粘进去（终端会出现"请粘贴…"提示）
6. 脚本自动推到服务器 .env 并重启爬虫服务
"""
import os
import sys
import subprocess
from pathlib import Path

# === 服务器配置 ===
SSH_KEY = Path(__file__).resolve().parent / "xiaochengxu.pem"
SSH_USER = "ubuntu"
SSH_HOST = "122.51.156.252"
ENV_PATH = "/opt/fapai/.env"


def parse_devtools_cookies(text: str) -> str:
    """支持 3 种粘贴格式：
    1. DevTools 表格复制（多行，制表符分隔）：name<TAB>value<TAB>...
    2. document.cookie 字符串：name1=value1; name2=value2
    3. 单个 name=value
    """
    text = text.strip()
    if not text:
        return ""

    # 格式 2/3：分号分隔
    if ";" in text and "\t" not in text:
        return text

    # 格式 1：制表符分隔表格
    parts = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        cols = line.split("\t")
        if len(cols) >= 2:
            name, value = cols[0].strip(), cols[1].strip()
            if name and value and "=" not in name:
                parts.append(f"{name}={value}")
    return "; ".join(parts)


def main():
    print("=" * 60)
    print("贝壳找房 Cookie 更新工具")
    print("=" * 60)
    print()
    print("步骤：")
    print("1. 浏览器打开 https://sh.ke.com 并登录")
    print("2. F12 → Application → Cookies → https://sh.ke.com")
    print("3. Ctrl+A 全选所有 cookie 行 → Ctrl+C 复制")
    print("4. 粘贴到下方（粘贴完按两次 Enter 结束输入）")
    print("=" * 60)
    print()
    print("请粘贴 cookie：")

    lines = []
    empty_count = 0
    while True:
        try:
            line = input()
        except EOFError:
            break
        if not line.strip():
            empty_count += 1
            if empty_count >= 1:
                break
        else:
            empty_count = 0
            lines.append(line)

    raw = "\n".join(lines)
    cookie = parse_devtools_cookies(raw)

    if not cookie or len(cookie) < 50:
        print(f"\n[!] cookie 解析失败或太短（{len(cookie)} 字符），请确认粘贴正确。")
        sys.exit(1)

    # 至少要包含贝壳常见的关键字段
    must_have = ["lianjia_token", "lianjia_uuid", "lianjia_ssid", "select_city", "ke_login"]
    matched = [k for k in must_have if k in cookie]
    if not matched:
        print(f"\n[!] cookie 中未发现 lianjia/ke 关键字段，可能不是贝壳的 cookie。")
        ans = input("仍然继续？(y/N): ").strip().lower()
        if ans != "y":
            sys.exit(1)

    print(f"\n[+] cookie 解析成功，{len(cookie)} 字符，命中字段：{matched}")
    print(f"[+] 推送到 {SSH_USER}@{SSH_HOST}:{ENV_PATH}")

    if not SSH_KEY.exists():
        print(f"[!] 找不到 SSH key：{SSH_KEY}")
        sys.exit(1)

    # 用 sed 替换 .env 中的 BEIKE_COOKIE 行（如不存在则追加）
    safe_cookie = cookie.replace('"', '\\"').replace("$", "\\$").replace("`", "\\`")
    cmd = (
        f'if sudo grep -q "^BEIKE_COOKIE=" {ENV_PATH}; then '
        f'  sudo sed -i "s|^BEIKE_COOKIE=.*|BEIKE_COOKIE=\\"{safe_cookie}\\"|" {ENV_PATH}; '
        f'else '
        f'  echo "BEIKE_COOKIE=\\"{safe_cookie}\\"" | sudo tee -a {ENV_PATH} > /dev/null; '
        f'fi && echo OK'
    )

    result = subprocess.run(
        ["ssh", "-i", str(SSH_KEY), "-o", "StrictHostKeyChecking=no",
         f"{SSH_USER}@{SSH_HOST}", cmd],
        capture_output=True, text=True
    )
    if result.returncode != 0 or "OK" not in result.stdout:
        print(f"[!] 推送失败：\n{result.stderr}")
        sys.exit(1)

    print("[+] cookie 已写入 .env")

    # 重启 backend（爬虫和后端都从 .env 读 cookie）
    print("[+] 重启 fapai-backend...")
    subprocess.run(
        ["ssh", "-i", str(SSH_KEY), "-o", "StrictHostKeyChecking=no",
         f"{SSH_USER}@{SSH_HOST}", "sudo systemctl restart fapai-backend"],
        capture_output=True, text=True
    )

    # 立即跑一次小测试
    print("[+] 测试抓取（3 个小区）...")
    test_cmd = (
        f"cd /opt/fapai && sudo -u www-data /opt/fapai/venv/bin/python "
        f"-m crawler.community_scraper --city 上海 --limit 3 --force 2>&1 | tail -15"
    )
    result = subprocess.run(
        ["ssh", "-i", str(SSH_KEY), "-o", "StrictHostKeyChecking=no",
         f"{SSH_USER}@{SSH_HOST}", test_cmd],
        capture_output=True, text=True
    )
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr[-500:])

    print()
    print("=" * 60)
    print("完成！")
    print("=" * 60)
    print("如要全量回填所有小区，登录服务器后跑：")
    print("  sudo -u www-data /opt/fapai/venv/bin/python -m crawler.community_scraper --city 上海 --limit 200")


if __name__ == "__main__":
    main()
