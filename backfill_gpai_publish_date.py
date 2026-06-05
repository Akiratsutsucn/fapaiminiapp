"""回填公拍网 publish_date = 法院公告落款日期。

阶段一(--from-desc)：用库里已存的 description 提取，无网络，快。
阶段二(--recrawl)：对阶段一提取不到的，重抓详情页正文提取（带 cookie，慢）。
预览模式(默认)：只统计能提取多少，不写库。加 --commit 才写库。

用法：
  python -m crawler.backfill_gpai_publish_date              # 预览(只看 description 命中率)
  python -m crawler.backfill_gpai_publish_date --commit     # 用 description 提取并写库
  python -m crawler.backfill_gpai_publish_date --recrawl --commit  # 再对剩余的重爬补齐
"""
import sys
import asyncio
from sqlalchemy import select, update

from crawler.storage.db import get_session
from app.models.property import Property
from crawler.parsers.gpai_detail import extract_court_announce_date

COMMIT = "--commit" in sys.argv
RECRAWL = "--recrawl" in sys.argv
# --limit N：重爬阶段只试前 N 条（评估成功率用，不写全量）
LIMIT = None
for _a in sys.argv:
    if _a.startswith("--limit="):
        LIMIT = int(_a.split("=", 1)[1])


async def main():
    db = await get_session()
    try:
        rows = (await db.execute(
            select(Property.id, Property.source_url, Property.description,
                   Property.publish_date, Property.created_at)
            .where(Property.auction_platform == "公拍网")
        )).all()
        print(f"公拍网房源总数: {len(rows)}  commit={COMMIT} recrawl={RECRAWL}", flush=True)

        hit_desc = 0       # description 提取成功
        miss = []          # description 提取不到的 (id, url)
        updates = []       # (id, date)
        for r in rows:
            d = extract_court_announce_date(r.description or "")
            if d:
                hit_desc += 1
                updates.append((r.id, d))
            else:
                miss.append((r.id, r.source_url))

        print(f"阶段一(description)可提取: {hit_desc}/{len(rows)}", flush=True)
        print(f"description 提取不到: {len(miss)}", flush=True)

        # 阶段二：重爬补齐
        if RECRAWL and miss:
            targets = miss[:LIMIT] if LIMIT else miss
            print(f"\n开始重爬 {len(targets)} 条" + (f"(--limit={LIMIT}, 共{len(miss)})" if LIMIT else "") + "...", flush=True)
            from crawler.browser import browser_manager
            from crawler.platforms.gpai import GPaiCrawler
            from bs4 import BeautifulSoup
            await browser_manager.start()
            gp = GPaiCrawler()
            recrawl_hit = 0
            n404 = 0
            for i, (pid, url) in enumerate(targets, 1):
                try:
                    html = await gp.fetch_detail(url)
                    text = BeautifulSoup(html, "lxml").get_text("\n", strip=True)
                    d = extract_court_announce_date(text)
                    if d:
                        recrawl_hit += 1
                        updates.append((pid, d))
                    else:
                        # 区分：页面有效但无落款 vs 页面失效
                        if "人民法院" not in text:
                            n404 += 1
                except Exception as e:
                    msg = str(e)[:50]
                    if "无效" in msg or "404" in msg or "不存在" in msg:
                        n404 += 1
                    print(f"  [{i}] id={pid} 重爬失败: {msg}", flush=True)
                if i % 20 == 0:
                    print(f"  进度 {i}/{len(targets)}  命中 {recrawl_hit}  疑似失效 {n404}", flush=True)
            print(f"阶段二(重爬)命中 {recrawl_hit}/{len(targets)}，疑似失效页 {n404}", flush=True)
            await browser_manager.stop()

        print(f"\n合计可写入 publish_date: {len(updates)}/{len(rows)}", flush=True)
        # 抽样展示
        for pid, d in updates[:8]:
            print(f"  样本 id={pid} -> {d.date()}")

        if COMMIT and updates:
            for pid, d in updates:
                await db.execute(
                    update(Property).where(Property.id == pid).values(publish_date=d)
                )
            await db.commit()
            print(f"\n已写库 {len(updates)} 条。", flush=True)
        elif not COMMIT:
            print("\n[预览模式] 未写库。加 --commit 才会写入。", flush=True)
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
