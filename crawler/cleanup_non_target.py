"""一次性清理库内历史脏数据：剔除「股权/证券类非不动产拍卖」与「非沪甬杭房源」。

与 engine.py 抓取期过滤口径一致（同一组正则 + 同一辖区白名单），用于清掉过滤逻辑
上线前已入库的存量脏数据。删除房源记录 + 图片行 + 磁盘图片目录（沿用 dedup_properties 约定）。

用法：
  python -m crawler.cleanup_non_target            # dry-run，只打印将删除的记录
  python -m crawler.cleanup_non_target --commit    # 真正删除
"""
import sys
import re
import asyncio
import shutil
from pathlib import Path

from sqlalchemy import select, delete
from crawler.storage.db import get_session
from crawler.config import settings
from app.models.property import Property, PropertyImage

COMMIT = "--commit" in sys.argv

# ── 复用 engine 的过滤口径 ───────────────────────────────────────────────
# 沪甬杭三市合法辖区白名单（与 engine.VALID_DISTRICTS 一致）。
VALID_DISTRICTS = {
    310000: {"浦东新区", "宝山区", "闵行区", "松江区", "普陀区", "杨浦区", "奉贤区",
             "嘉定区", "青浦区", "黄浦区", "徐汇区", "虹口区", "静安区", "金山区",
             "长宁区", "崇明区"},
    330200: {"海曙区", "江北区", "江东区", "北仑区", "镇海区", "鄞州区", "奉化区",
             "余姚市", "慈溪市", "象山县", "宁海县"},
    330100: {"余杭区", "上城区", "拱墅区", "富阳区", "临安区", "萧山区", "西湖区",
             "桐庐县", "钱塘区", "建德市", "淳安县", "滨江区", "江干区", "临平区",
             "下城区"},
}
TARGET_CITY_IDS = set(VALID_DISTRICTS.keys())
_ALL_VALID_DISTRICTS = set().union(*VALID_DISTRICTS.values()) | {"上海", "宁波", "杭州"}

# 股权/出资额/证券类（与 engine._re_equity_auction 一致）。
_re_equity = re.compile(r"(股权|出资额|证券代码|证劵代码|股的|偿债|重整案件|注册资本|持股|股份)")
# 房产关键词（与 engine.real_estate_kw 一致），命中则视为真房产，不按股权剔除。
_re_real_estate = re.compile(
    r"室|号楼|栋|公寓|花园|小区|大厦|花苑|别墅|商铺|厂房|办公|住宅|住房|店铺|车位|"
    r"楼盘|公馆|广场|宅基|宿舍|商业用房|工业用房|土地|地块|房产|房地产|不动产|幢|层"
)


def _reason_to_delete(p: Property) -> str | None:
    """返回删除原因（None 表示保留）。口径与 engine 抓取期一致。"""
    title = (p.title or "").strip()

    # 1) 非沪甬杭：city_id 不在三市，或解析出的 district 不在三市辖区白名单
    if p.city_id not in TARGET_CITY_IDS:
        return f"非目标城市(city_id={p.city_id})"
    dist = (p.district or "").strip()
    if dist and dist not in _ALL_VALID_DISTRICTS:
        return f"非沪甬杭辖区(district={dist})"

    # 2) 股权/证券类非不动产：标题含股权关键词且不含任何房产关键词
    if _re_equity.search(title) and not _re_real_estate.search(title):
        return "股权/证券类非不动产"

    return None


async def main():
    db = await get_session()
    try:
        rows = (await db.execute(select(Property))).scalars().all()
        print(f"库内房源总数: {len(rows)}  commit={COMMIT}", flush=True)

        del_ids = []
        reasons = {}
        for p in rows:
            r = _reason_to_delete(p)
            if r:
                del_ids.append(p.id)
                reasons.setdefault(r.split("(")[0], 0)
                reasons[r.split("(")[0]] += 1
                print(f"  删除 id={p.id} [{r}] {(p.title or '')[:36]}", flush=True)

        print(f"\n将删除 {len(del_ids)} 条记录，按原因分布：", flush=True)
        for k, v in sorted(reasons.items(), key=lambda t: -t[1]):
            print(f"    {k}: {v}", flush=True)

        if COMMIT and del_ids:
            base = Path(settings.IMAGE_STORAGE_PATH) / "properties"
            for pid in del_ids:
                await db.execute(delete(PropertyImage).where(PropertyImage.property_id == pid))
                await db.execute(delete(Property).where(Property.id == pid))
                d = base / str(pid)
                if d.exists():
                    shutil.rmtree(d, ignore_errors=True)
            await db.commit()
            print(f"已删除 {len(del_ids)} 条记录及其图片", flush=True)
        elif not COMMIT:
            print("(dry-run 未写库；加 --commit 才会真正删除)", flush=True)
    finally:
        await db.close()


asyncio.run(main())
