"""存量 district 修正:把错存成市名(杭州/上海/宁波)的区字段,从标题重新提取真正的区名。
根因见 taobao_paimai district 提取修复。默认 dry-run,加 --commit 落库。
    cd /opt/fapai && /opt/fapai/venv/bin/python -m backend.scripts.fix_district          # dry-run
    cd /opt/fapai && /opt/fapai/venv/bin/python -m backend.scripts.fix_district --commit  # 落库
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from loguru import logger  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.models.property import Property  # noqa: E402
from crawler.storage.db import get_session, engine  # noqa: E402

# 各市的合法区/县名(带后缀),从标题精确提取
_DISTRICTS = [
    # 上海
    "黄浦区", "徐汇区", "长宁区", "静安区", "普陀区", "虹口区", "杨浦区",
    "浦东新区", "闵行区", "宝山区", "嘉定区", "金山区", "松江区", "青浦区",
    "奉贤区", "崇明区",
    # 宁波
    "海曙区", "江北区", "北仑区", "镇海区", "鄞州区", "奉化区",
    "象山县", "宁海县", "余姚市", "慈溪市",
    # 杭州
    "上城区", "拱墅区", "西湖区", "滨江区", "萧山区", "余杭区",
    "临平区", "钱塘区", "富阳区", "临安区", "桐庐县", "淳安县", "建德市",
    # 历史旧区名(标题里可能仍出现)
    "下城区", "江干区",
]
# 市名(被错存为 district 的值)
_CITY_NAMES = ("上海", "宁波", "杭州")


def extract_district_from_title(title: str) -> str:
    if not title:
        return ""
    # 第一遍:带后缀精确匹配(钱塘区/西湖区...)
    for d in _DISTRICTS:
        if d in title:
            return d
    # 第二遍:无后缀的区名(标题写"钱塘世贸江滨""钱塘耀顺"等无"区"字),
    # 仅对歧义低的区名做,避免误伤(如"上城"可能在普通词里,保留带后缀优先)
    _bare = {
        "钱塘": "钱塘区", "西湖": "西湖区", "滨江": "滨江区", "萧山": "萧山区",
        "余杭": "余杭区", "临平": "临平区", "富阳": "富阳区", "临安": "临安区",
        "桐庐": "桐庐县", "淳安": "淳安县", "拱墅": "拱墅区",
        "浦东": "浦东新区", "闵行": "闵行区", "徐汇": "徐汇区", "长宁": "长宁区",
        "静安": "静安区", "普陀": "普陀区", "虹口": "虹口区", "杨浦": "杨浦区",
        "宝山": "宝山区", "嘉定": "嘉定区", "松江": "松江区", "青浦": "青浦区",
        "奉贤": "奉贤区", "崇明": "崇明区", "黄浦": "黄浦区", "金山": "金山区",
        "海曙": "海曙区", "江北": "江北区", "北仑": "北仑区", "镇海": "镇海区",
        "鄞州": "鄞州区", "奉化": "奉化区", "象山": "象山县", "宁海": "宁海县",
        "余姚": "余姚市", "慈溪": "慈溪市",
    }
    for bare, full in _bare.items():
        if bare in title:
            return full
    return ""


async def main():
    ap = argparse.ArgumentParser(description="存量district修正(市名→真正的区名)")
    ap.add_argument("--commit", action="store_true", help="实际写库(默认 dry-run)")
    args = ap.parse_args()

    db = await get_session()
    fixed = 0
    skipped = 0
    try:
        rows = (await db.execute(
            select(Property).where(
                Property.is_deleted == 0,
                Property.district.in_(_CITY_NAMES),
            )
        )).scalars().all()
        logger.info(f"扫描 {len(rows)} 条 district=市名 的房源")

        for p in rows:
            d = extract_district_from_title(p.title or "")
            if d:
                logger.info(f"[修正] id={p.id} {p.district}→{d} | {(p.title or '')[:30]}")
                p.district = d
                fixed += 1
            else:
                skipped += 1  # 标题无区名,留待重抓补

        logger.info(f"将修正 {fixed} 条 / 无法从标题提取跳过 {skipped} 条")
        if args.commit:
            await db.commit()
            logger.success("已写库")
        else:
            logger.warning("** dry-run:未写库,加 --commit 落库 **")
    finally:
        await db.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
