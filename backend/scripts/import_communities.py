"""导入沪杭甬小区/商圈清单到 community_info,并据此给缺商圈的房源补 sub_district。

CSV 格式:小区名称,类型,区域(行政区),商圈板块,城市,数据来源
两个文件:住宅小区清单 + 商住楼清单(约1万去重小区)。

用途:现有 community_info 仅129条、房源商圈缺失54.7%。导入这批小区→商圈映射后:
  ① community_info 扩到约1万条(小区管理数据补全)
  ② 用小区名匹配,给缺 sub_district 的房源补商圈板块

默认 dry-run,加 --commit 落库。--only-import 只导小区不回填房源。
    cd /opt/fapai && /opt/fapai/venv/bin/python -m backend.scripts.import_communities
    cd /opt/fapai && /opt/fapai/venv/bin/python -m backend.scripts.import_communities --commit
"""
import argparse
import asyncio
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from loguru import logger  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.models.community import CommunityInfo  # noqa: E402
from app.models.property import Property  # noqa: E402
from crawler.storage.db import get_session, engine  # noqa: E402

CITY = {"上海": 310000, "杭州": 330100, "宁波": 330200}
CSV_DIR = ROOT / "归档资料" / "参考资料"
CSV_FILES = ["沪杭甬住宅小区清单.csv", "沪杭甬商住楼清单.csv"]

# 各市合法辖区全名(简称→全名匹配:全名 contains 简称)。复用与 engine 一致的辖区集合。
VALID_DISTRICTS = {
    310000: ["浦东新区", "宝山区", "闵行区", "松江区", "普陀区", "杨浦区", "奉贤区",
             "嘉定区", "青浦区", "黄浦区", "徐汇区", "虹口区", "静安区", "金山区",
             "长宁区", "崇明区"],
    330200: ["海曙区", "江北区", "北仑区", "镇海区", "鄞州区", "奉化区",
             "余姚市", "慈溪市", "象山县", "宁海县"],
    330100: ["余杭区", "上城区", "拱墅区", "富阳区", "临安区", "萧山区", "西湖区",
             "桐庐县", "钱塘区", "建德市", "淳安县", "滨江区", "临平区"],
}

def _full_district(short: str, city_id: int) -> str:
    """简称(嘉定)→全名(嘉定区)。匹配不到则原样返回。"""
    short = (short or "").strip()
    if not short:
        return ""
    for full in VALID_DISTRICTS.get(city_id, []):
        if full.startswith(short) or short in full:
            return full
    return short


def _norm_type(t: str) -> str:
    """CSV类型对齐到我们的体系。住宅→住宅;写字楼→写字楼;商业→其他商用。"""
    t = (t or "").strip()
    if t == "住宅":
        return "住宅"
    if t == "写字楼":
        return "写字楼"
    if t == "商业":
        return "其他商用"  # 商住楼清单"商业"粒度粗,归其他商用,具体细分以房源标题为准
    return t or "住宅"


def _load_csv_rows():
    """读两个CSV,去重(同名同城,后者覆盖),返回 {(name,city_id): dict}。"""
    merged = {}
    for fn in CSV_FILES:
        path = CSV_DIR / fn
        if not path.exists():
            logger.warning(f"CSV不存在: {path}")
            continue
        with open(path, encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                name = (r.get("小区名称") or "").strip()
                city_id = CITY.get((r.get("城市") or "").strip())
                if not name or not city_id:
                    continue
                merged[(name, city_id)] = {
                    "name": name,
                    "city_id": city_id,
                    "district": _full_district(r.get("区域(行政区)"), city_id),
                    "sub_district": (r.get("商圈板块") or "").strip(),
                    "property_type": _norm_type(r.get("类型")),
                    "source": (r.get("数据来源") or "fang.com").strip(),
                }
    return merged


async def main():
    ap = argparse.ArgumentParser(description="导入沪杭甬小区/商圈清单 + 回填房源商圈")
    ap.add_argument("--commit", action="store_true", help="实际写库(默认 dry-run)")
    ap.add_argument("--only-import", action="store_true", help="只导小区,不回填房源商圈")
    args = ap.parse_args()

    rows = _load_csv_rows()
    logger.info(f"CSV去重小区 {len(rows)} 条")

    db = await get_session()
    inserted = updated = 0
    try:
        existing = {}
        for c in (await db.execute(select(CommunityInfo))).scalars().all():
            existing[(c.name, c.city_id)] = c

        for key, data in rows.items():
            cur = existing.get(key)
            if cur is None:
                db.add(CommunityInfo(**data))
                inserted += 1
            else:
                # 仅补空:已有不覆盖
                if not (cur.sub_district or "").strip() and data["sub_district"]:
                    cur.sub_district = data["sub_district"]
                if not (cur.district or "").strip() and data["district"]:
                    cur.district = data["district"]
                updated += 1
        logger.info(f"小区导入:新增 {inserted}，命中已存在 {updated}")
        if args.commit:
            await db.commit()
            logger.success("小区已写库")

        # === 回填房源商圈 ===
        if not args.only_import:
            by_city = {}
            for (name, city_id), data in rows.items():
                if data["sub_district"]:
                    by_city.setdefault(city_id, []).append((name, data["sub_district"]))
            for cid in by_city:
                by_city[cid].sort(key=lambda x: len(x[0]), reverse=True)  # 长名优先

            props = (await db.execute(
                select(Property).where(
                    Property.is_deleted == 0,
                    (Property.sub_district.is_(None)) | (Property.sub_district == ""),
                )
            )).scalars().all()
            filled = 0
            for p in props:
                cand = by_city.get(p.city_id or 310000, [])
                hay = (p.community_name or "") + " " + (p.title or "")
                for name, sub in cand:
                    if len(name) >= 3 and name in hay:  # 至少3字,避免2字小区名误命中
                        p.sub_district = sub
                        filled += 1
                        break
            logger.info(f"房源商圈回填:{filled} 条(扫描 {len(props)} 条缺商圈房源)")
            if args.commit:
                await db.commit()
                logger.success("房源商圈已写库")

        if not args.commit:
            logger.warning("** dry-run:未写库,加 --commit 落库 **")
    finally:
        await db.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
