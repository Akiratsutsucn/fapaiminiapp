"""批量纠正阿里「已撤回」误判（2026-08-12）。

根因：旧解析逻辑只认 bidStatus==5 为成交，实测成交房源常返回 bidStatus==2，
导致大量成交房源被时间兜底误判为「已撤回」。新逻辑（taobao_paimai_detail）
用组合判据（有成交价+有出价+已过结束时间 / showSfDealConfirm）识别成交。

本脚本：对库里所有 阿里拍卖·已撤回 房源，重新调 MTOP 详情 API + 新解析器，
把真实成交的纠正为「已成交」并回填 final_deal_price / deal_date / deal_confirmed。

用法：
  python -m crawler.refetch_ali_withdrawn            # dry-run 只统计会改哪些
  python -m crawler.refetch_ali_withdrawn --commit   # 真正写库
"""
import asyncio
import re
import sys

from sqlalchemy import select

from crawler.browser import browser_manager
from crawler.storage.db import get_session
from crawler.platforms.taobao_paimai import TaobaoPaiMaiCrawler
from crawler.parsers.taobao_paimai_detail import TaobaoPaiMaiDetailParser
from app.models.property import Property

COMMIT = "--commit" in sys.argv


async def main() -> None:
    db = await get_session()
    q = select(Property).where(
        Property.is_deleted == 0,
        Property.auction_platform == "阿里拍卖",
        Property.auction_status == "已撤回",
    )
    props = (await db.execute(q)).scalars().all()
    print(f"阿里·已撤回 待纠正房源: {len(props)} 套 commit={COMMIT}", flush=True)

    await browser_manager.start()
    crawler = TaobaoPaiMaiCrawler()
    parser = TaobaoPaiMaiDetailParser()

    stats = {"成交": 0, "撤回": 0, "其它": 0, "失败": 0}
    try:
        for p in props:
            m = re.search(r"itemId=(\d+)", p.source_url or "")
            if not m:
                stats["失败"] += 1
                continue
            item_id = m.group(1)
            try:
                detail = await crawler.fetch_detail_api(item_id)
                if not detail:
                    stats["失败"] += 1
                    print(f"  id={p.id} itemId={item_id} API无数据", flush=True)
                    continue
                data = detail.get("data", detail)
                item = await parser.parse(data, p.source_url, p.city_id, {})
                new_status = item.auction_status
                tag = "成交" if new_status == "已成交" else ("撤回" if new_status == "已撤回" else "其它")
                stats[tag] = stats.get(tag, 0) + 1
                changed = (new_status != p.auction_status) or (item.final_deal_price and not p.final_deal_price)
                mark = ""
                if changed:
                    mark = f"  → {p.auction_status} ⇒ {new_status} 成交价{item.final_deal_price} deal_date={item.deal_date}"
                print(f"  id={p.id} [{tag}]{mark}", flush=True)
                if COMMIT and changed:
                    p.auction_status = new_status
                    if item.final_deal_price:
                        p.final_deal_price = item.final_deal_price
                    if item.deal_date is not None:
                        p.deal_date = item.deal_date
                    if item.deal_confirmed is not None:
                        p.deal_confirmed = item.deal_confirmed
                    if item.latest_total_price:
                        p.latest_total_price = item.latest_total_price
                    db.add(p)
                    await db.commit()
            except Exception as e:
                stats["失败"] += 1
                print(f"  id={p.id} 异常 {str(e)[:60]}", flush=True)
    finally:
        await browser_manager.stop()
        await db.close()

    print(f"完成: 成交 {stats.get('成交',0)} / 撤回 {stats.get('撤回',0)} / 其它 {stats.get('其它',0)} / 失败 {stats.get('失败',0)}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
