"""一次性补全：京东拍卖房源缺失的评估价/市场价/折扣率（从 JD API 重新拉取）。

只更新 appraisal_price=0 的京东房源，避免覆盖已有数据。
court_discount_rate = starting_price / appraisal_price（与解析器口径一致）。
用法：python backfill_jd_prices.py [--commit]
"""
import sys, asyncio, re
import httpx
from sqlalchemy import select
from crawler.storage.db import get_session
from app.models.property import Property

COMMIT = "--commit" in sys.argv


async def fetch_jd(client, paimai_id):
    try:
        resp = await client.get(
            "https://api.m.jd.com/api",
            params={"appid": "paimai", "functionId": "getProductBasicInfo",
                    "body": '{"paimaiId":' + str(paimai_id) + '}', "loginType": "3"},
        )
        return resp.json().get("data", {}) or {}
    except Exception as e:
        print(f"  api fail {paimai_id}: {e}")
        return {}


async def main():
    db = await get_session()
    try:
        rows = (await db.execute(
            select(Property).where(
                Property.auction_platform == "京东拍卖",
                (Property.appraisal_price == 0) | (Property.appraisal_price.is_(None)),
            )
        )).scalars().all()
        print(f"待补全京东房源: {len(rows)}  commit={COMMIT}", flush=True)
        updated = 0
        async with httpx.AsyncClient(timeout=15) as client:
            for p in rows:
                m = re.search(r"paimai\.jd\.com/(\d+)", p.source_url or "") or re.search(r"orderId=(\d+)", p.source_url or "")
                if not m:
                    continue
                d = await fetch_jd(client, m.group(1))
                if not d:
                    continue
                jbi = d.get("judicatureBasicInfoResult") or {}
                appr = 0
                ap = d.get("assessmentPrice")
                try:
                    if ap and float(ap) > 0:
                        appr = int(float(ap))
                except (ValueError, TypeError):
                    pass
                if not appr:
                    mp = jbi.get("marketPrice")
                    try:
                        if mp and float(mp) > 0:
                            appr = int(float(mp))
                    except (ValueError, TypeError):
                        pass
                if appr > 0:
                    p.appraisal_price = appr
                    if not p.market_deal_price:
                        p.market_deal_price = appr
                    if p.starting_price and p.starting_price > 0:
                        p.court_discount_rate = round(p.starting_price / appr, 4)
                        p.bargain_potential = max(0, appr - p.starting_price)
                    updated += 1
                    print(f"  id={p.id} appr={appr} disc={p.court_discount_rate}", flush=True)
                # 补保证金
                if not p.deposit:
                    ep = d.get("ensurePrice")
                    try:
                        if ep and float(ep) > 0:
                            p.deposit = int(float(ep))
                    except (ValueError, TypeError):
                        pass
        if COMMIT:
            await db.commit()
            print(f"已提交，更新 {updated} 条", flush=True)
        else:
            print(f"(dry-run) 可更新 {updated} 条", flush=True)
    finally:
        await db.close()


asyncio.run(main())
