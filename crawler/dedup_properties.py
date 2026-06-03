"""去重：同一房源被重复抓取（同平台+同标题+同面积多条记录，如 www/s 子域、不同 Web_Item_ID）。
保留"最佳"一条，删除其余重复记录及其图片行+磁盘文件。

保留优先级（每个 标题+面积 组内）：
  1. 状态：进行中 > 即将开拍 > 已结束/已撤回/流拍
  2. 可见图片数多者优先
  3. id 小者优先（最早抓取的规范记录）

用法：python -m crawler.dedup_properties [--commit]
"""
import sys, asyncio, shutil
from pathlib import Path
from sqlalchemy import select, delete, func
from crawler.storage.db import get_session
from crawler.config import settings
from app.models.property import Property, PropertyImage

COMMIT = "--commit" in sys.argv

STATUS_RANK = {"进行中": 0, "即将开拍": 1, "已结束": 2, "已撤回": 3, "流拍": 3, "撤回": 3}


def status_rank(s: str) -> int:
    return STATUS_RANK.get(s or "", 5)


async def main():
    db = await get_session()
    try:
        # 找出重复组（按 平台+标题+面积四舍五入）。面积用 ROUND 规避浮点精度，
        # 且后续按 (平台,标题) 取全部行再在 Python 内分组，不用浮点等值查询。
        dup = (
            select(Property.auction_platform, Property.title)
            .group_by(Property.auction_platform, Property.title)
            .having(func.count() > 1)
        )
        groups = (await db.execute(dup)).all()
        print(f"候选重复标题组: {len(groups)}  commit={COMMIT}", flush=True)

        def area_key(a):
            return round(float(a), 1) if a is not None else None

        total_del = 0
        del_ids = []
        for pf, title in groups:
            allrows = (await db.execute(
                select(Property).where(
                    Property.auction_platform == pf,
                    Property.title == title,
                )
            )).scalars().all()
            # 按面积四舍五入在内存分组
            by_area: dict = {}
            for p in allrows:
                by_area.setdefault(area_key(p.area), []).append(p)
            for akey, rows in by_area.items():
                if len(rows) < 2:
                    continue
                # 每条算可见图片数
                scored = []
                for p in rows:
                    vis = (await db.execute(
                        select(func.count(PropertyImage.id)).where(
                            PropertyImage.property_id == p.id, PropertyImage.hidden == 0
                        )
                    )).scalar() or 0
                    scored.append((status_rank(p.auction_status), -vis, p.id, p))
                scored.sort(key=lambda t: (t[0], t[1], t[2]))  # 最小=保留
                keep = scored[0][3]
                drops = [s[3] for s in scored[1:]]
                for d in drops:
                    del_ids.append(d.id)
                total_del += len(drops)
                print(f"  [{pf}] {title[:20]}|{akey} 保留 id={keep.id}({keep.auction_status}) "
                      f"删除 {[d.id for d in drops]}", flush=True)

        print(f"\n将删除 {total_del} 条重复记录", flush=True)

        if COMMIT and del_ids:
            base = Path(settings.IMAGE_STORAGE_PATH) / "properties"
            for pid in del_ids:
                await db.execute(delete(PropertyImage).where(PropertyImage.property_id == pid))
                await db.execute(delete(Property).where(Property.id == pid))
                # 删磁盘图片目录
                d = base / str(pid)
                if d.exists():
                    shutil.rmtree(d, ignore_errors=True)
            await db.commit()
            print(f"已删除 {len(del_ids)} 条重复记录及其图片", flush=True)
        elif not COMMIT:
            print("(dry-run 未写库)", flush=True)
    finally:
        await db.close()


asyncio.run(main())
