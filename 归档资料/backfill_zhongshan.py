"""一次性:补齐 中山南一路1065号 的41套房源(相似组展开 + 列表数据入库)。
仅用列表API,不走SSR/快代理。"""
import asyncio
from crawler.platforms.taobao_paimai import TaobaoPaiMaiCrawler
from crawler.engine import _build_auction_item_from_list, CITY_ID_MAP
from crawler.storage.repository import PropertyRepository
from crawler.storage.db import get_session

TARGET = "中山南一路1065号"
CITY = "上海"


async def main():
    c = TaobaoPaiMaiCrawler()
    client = await c._get_http()
    await c._collect_by_keyword(client, CITY, max_pages=1)  # 预热token

    # 直接用地址前缀+数字后缀展开(0-9),覆盖全部室号
    found = {}
    for suffix in [""] + [str(d) for d in range(10)]:
        kw = f"{TARGET}{suffix}"
        try:
            items = await c._collect_by_keyword(client, kw, max_pages=50)
        except Exception as e:
            print(f"kw={kw!r} 失败: {e}", flush=True)
            continue
        for it in items:
            if TARGET in (it.title or "") and it.source_url:
                found[it.source_url] = it
        await asyncio.sleep(0.8)

    print(f"共找到 {len(found)} 套 {TARGET}", flush=True)

    city_id = CITY_ID_MAP[CITY]
    saved, created, updated = 0, 0, 0
    for it in found.values():
        db = await get_session()
        try:
            ai = _build_auction_item_from_list(it, "阿里拍卖", city_id)
            pid, action = await PropertyRepository.upsert(db, ai)
            await db.commit()
            saved += 1
            if action == "created":
                created += 1
            else:
                updated += 1
        except Exception as e:
            await db.rollback()
            print(f"入库失败 {it.title}: {e}", flush=True)
        finally:
            await db.close()

    print(f">>> 入库完成: 共{saved}套 (新增{created}, 更新{updated})", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
