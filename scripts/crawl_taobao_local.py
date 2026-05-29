"""本地家用 IP 跑阿里 MTOP 抓取，输出 SQL 推送到服务器。

为什么需要：
- 服务器是腾讯云 IDC IP，阿里 MTOP API 永远返回 FAIL_SYS_TOKEN_ILLEGAL（IP 黑名单）
- 你家用宽带不会被阿里识别为爬虫
- 在本地跑，把结果（properties + images）推到服务器 MySQL

用法：
    cd 法拍者联盟小程序
    python scripts/crawl_taobao_local.py --max-items 50

    --max-items N   只抓 N 个（默认 100）
    --no-push       只本地保存，不推服务器
    --dry-run       只 list，不爬 detail
"""
from __future__ import annotations
import argparse
import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from loguru import logger  # noqa: E402

# 本地用 SQLite 临时库（避免污染你本地开发环境）
TEMP_DB = ROOT / "_local_taobao_crawl.db"

SSH_KEY = ROOT / "xiaochengxu.pem"
SSH_USER = "ubuntu"
SSH_HOST = "122.51.156.252"


def setup_local_env():
    """让本地代码用临时 SQLite 而不是生产 MySQL。"""
    os.environ["DB_TYPE"] = "sqlite"
    os.environ["DB_NAME"] = "_local_taobao_crawl"
    # 让 .env 不覆盖
    env_file = ROOT / ".env"
    if env_file.exists():
        os.environ["DOTENV_DISABLE"] = "1"


async def run_crawl(max_items: int, dry_run: bool):
    """跑阿里抓取，结果落本地 SQLite。"""
    from crawler.engine import CrawlEngine
    from crawler.config import settings

    settings.MAX_DETAIL_ITEMS = max_items
    settings.PLAYWRIGHT_HEADLESS = True

    engine = CrawlEngine()
    result = await engine.run(
        platform="阿里拍卖",
        city=None,  # 上海+宁波
        max_pages=10,
    )

    logger.info(f"\n=== 本地抓取完成 ===")
    logger.info(f"  total: {result.total_list_items}, new: {result.total_new}, updated: {result.total_updated}")
    return result


def export_data_to_sql() -> Path:
    """把本地 SQLite 中的 properties + property_images 导出为 SQL 文件。"""
    import sqlite3

    out = ROOT / "_local_taobao_crawl.sql"
    conn = sqlite3.connect(str(TEMP_DB))
    cur = conn.cursor()

    lines = []
    lines.append("-- 本地阿里抓取数据 → 服务器")
    lines.append(f"-- 生成时间: {datetime.now().isoformat()}")
    lines.append("SET FOREIGN_KEY_CHECKS=0;")
    lines.append("")

    # properties
    cur.execute("SELECT * FROM properties WHERE auction_platform = '阿里拍卖'")
    props_cols = [c[0] for c in cur.description]
    props = cur.fetchall()
    if props:
        col_str = ",".join(f"`{c}`" for c in props_cols)
        lines.append(f"-- {len(props)} properties")
        for row in props:
            vals = []
            for v in row:
                if v is None:
                    vals.append("NULL")
                elif isinstance(v, (int, float)):
                    vals.append(str(v))
                else:
                    vs = str(v).replace("\\", "\\\\").replace("'", "''")
                    vals.append(f"'{vs}'")
            lines.append(
                f"INSERT INTO properties ({col_str}) VALUES ({','.join(vals)}) "
                f"ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at);"
            )

    lines.append("SET FOREIGN_KEY_CHECKS=1;")
    out.write_text("\n".join(lines), encoding="utf-8")
    conn.close()
    return out


def push_to_server(sql_file: Path):
    """SCP 到服务器，导入 MySQL。"""
    if not SSH_KEY.exists():
        logger.error(f"SSH key 不存在: {SSH_KEY}")
        return False

    logger.info(f"[push] scp {sql_file.name} → {SSH_USER}@{SSH_HOST}")
    subprocess.run(
        ["scp", "-i", str(SSH_KEY), "-o", "StrictHostKeyChecking=no",
         str(sql_file), f"{SSH_USER}@{SSH_HOST}:/tmp/"],
        check=True,
    )

    logger.info(f"[push] 服务器执行 SQL")
    cmd = (
        f"sudo mysql shanghai_fapai < /tmp/{sql_file.name}"
    )
    subprocess.run(
        ["ssh", "-i", str(SSH_KEY), "-o", "StrictHostKeyChecking=no",
         f"{SSH_USER}@{SSH_HOST}", cmd],
        check=True,
    )
    logger.info("[push] 完成")
    return True


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-items", type=int, default=100)
    parser.add_argument("--no-push", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    setup_local_env()
    from crawler.utils.logger import setup_logger
    setup_logger("INFO")

    if TEMP_DB.exists():
        TEMP_DB.unlink()
        logger.info("清除旧的本地 SQLite")

    # 初始化本地数据库
    from sqlalchemy.ext.asyncio import create_async_engine
    from app.core.database import Base
    eng = create_async_engine(f"sqlite+aiosqlite:///{TEMP_DB}")
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await eng.dispose()
    logger.info(f"本地 SQLite 初始化: {TEMP_DB}")

    await run_crawl(args.max_items, args.dry_run)

    if args.dry_run:
        logger.info("dry-run 完成，不导出/不推送")
        return

    sql_file = export_data_to_sql()
    logger.info(f"SQL 已导出: {sql_file}")

    if args.no_push:
        logger.info("--no-push，跳过推送服务器")
    else:
        push_to_server(sql_file)


if __name__ == "__main__":
    asyncio.run(main())
