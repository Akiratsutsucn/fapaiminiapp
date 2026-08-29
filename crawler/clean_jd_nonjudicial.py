"""清理京东非司法标的：publishSource!=7 的存量房源软删(全状态)。

详情层自0705已硬过滤非司法标的(fetch_detail_api 返回 None),但在此之前入库的
存量仍在库里。本脚本用同一 getProductBasicInfo 接口逐个复核 publishSource,
确认非司法才软删 is_deleted=1;接口失败/字段缺失一律保留(不误杀)。

用法: python -m crawler.clean_jd_nonjudicial [--commit] [--limit N]
"""
import asyncio, json, re, sys

import httpx
from loguru import logger
from sqlalchemy import select

from crawler.storage.db import get_session
from app.models.property import Property

COMMIT = "--commit" in sys.argv
LIMIT = 0
for i, a in enumerate(sys.argv):
    if a == "--limit" and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])

API = "https://api.m.jd.com/api"
HEADERS = {
    "Referer": "https://paimai.jd.com/",
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
}


async def get_publish_source(client: httpx.AsyncClient, paimai_id: str) -> str | None:
    resp = await client.get(API, params={
        "appid": "paimai",
        "functionId": "getProductBasicInfo",
        "body": json.dumps({"paimaiId": int(paimai_id)}),
        "loginType": "3",
    })
    data = (resp.json() or {}).get("data") or {}
    ps = data.get("publishSource")
    return None if ps is None else str(ps)


async def main():
    db = await get_session()
    try:
        q = (select(Property.id, Property.title, Property.source_url, Property.auction_status)
             .where(Property.auction_platform == "京东拍卖", Property.is_deleted == 0)
             .order_by(Property.id.desc()))
        rows = (await db.execute(q)).all()
        if LIMIT:
            rows = rows[:LIMIT]
        print(f"待复核京东房源: {len(rows)}  commit={COMMIT}", flush=True)

        deleted = kept = unknown = 0
        async with httpx.AsyncClient(timeout=15, headers=HEADERS) as client:
            for pid, title, url, status in rows:
                m = re.search(r"paimai\.jd\.com/(\d+)", url or "")
                if not m:
                    unknown += 1
                    continue
                try:
                    ps = await get_publish_source(client, m.group(1))
                except Exception as e:
                    logger.debug(f"id={pid} publishSource fail: {e}")
                    unknown += 1
                    continue
                if ps is None:
                    unknown += 1
                    continue
                if ps != "7":
                    deleted += 1
                    if deleted <= 10 or deleted % 100 == 0:
                        print(f"  软删 id={pid} publishSource={ps} {title[:30]}", flush=True)
                    if COMMIT:
                        await db.execute(
                            Property.__table__.update()
                            .where(Property.id == pid)
                            .values(is_deleted=1))
                        if deleted % 50 == 0:
                            await db.commit()
                else:
                    kept += 1
                await asyncio.sleep(0.3)
        if COMMIT:
            await db.commit()
        print(f"\n完成: 软删非司法 {deleted} / 保留司法 {kept} / 复核失败保留 {unknown} / 共 {len(rows)}", flush=True)
        if not COMMIT:
            print("(dry-run 未写库)", flush=True)
    finally:
        await db.close()


asyncio.run(main())
