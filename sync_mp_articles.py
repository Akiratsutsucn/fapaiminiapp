"""公众号文章每日同步脚本（systemd timer 触发）。

用法：
    cd /opt/fapai && /opt/fapai/venv/bin/python3 sync_mp_articles.py

设计：
- 复用后端 core/wechat.py 的拉取逻辑 + admin/articles.py 的入库去重逻辑
- 读取 backend 的 async_session 直接连库（与 FastAPI 同一套 settings/.env）
- 由 systemd timer 每日定时触发；管理后台「从公众号同步」按钮走同一套函数
"""
import asyncio
import sys

sys.path.insert(0, "/opt/fapai")
sys.path.insert(0, "/opt/fapai/backend")


async def main():
    from app.core.database import async_session
    from app.api.admin.articles import sync_articles_from_mp

    async with async_session() as db:
        try:
            result = await sync_articles_from_mp(db, limit=40)
            print(f"[sync_mp] 同步完成：新增 {result['created']} 篇，"
                  f"更新 {result['updated']} 篇，拉取 {result['total']} 篇")
        except Exception as e:
            print(f"[sync_mp] 同步失败：{e}")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
