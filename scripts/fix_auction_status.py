"""一次性修复历史房源的 auction_status：按 auction_start_time / auction_end_time +
当前时间重算「时序态」（即将开拍/进行中/已结束），保留「结果态」（已成交/已撤回/中止/流拍）。

背景：各平台爬虫把抓取那一刻的页面状态文本直接存库，与真实时间窗脱节后状态就一直错，
导致 C 端按「即将开拍/进行中」筛选时本该可参拍的房源被过滤消失（典型：上海房源全部不可见）。
读取层已改为实时计算状态，本脚本把库里已存的错误值也一次性纠正，便于后台计数 / 增强步骤
按正确状态运行。与 backend core.auction_status / crawler engine 自校正同一口径。

用法：
    # 默认（连 .env 配置的库，dry-run 预览）
    cd /opt/fapai && ./venv/bin/python -m scripts.fix_auction_status --dry-run
    # 实际写回
    cd /opt/fapai && ./venv/bin/python -m scripts.fix_auction_status
    # 限定平台
    ./venv/bin/python -m scripts.fix_auction_status --platform 京东拍卖
"""
import argparse
import asyncio
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import select  # noqa: E402

from app.models.property import Property  # noqa: E402
from app.core.auction_status import effective_status  # noqa: E402
from crawler.storage.db import get_session  # noqa: E402


async def run(platform: str | None, dry_run: bool) -> None:
    db = await get_session()
    try:
        q = select(Property)
        if platform:
            q = q.where(Property.auction_platform == platform)
        rows = (await db.execute(q)).scalars().all()

        changes: Counter = Counter()  # (old -> new) 计数
        changed = 0
        for p in rows:
            new_status = effective_status(
                p.auction_status, p.auction_start_time, p.auction_end_time
            )
            if new_status != p.auction_status:
                changes[f"{p.auction_status} → {new_status}"] += 1
                changed += 1
                if not dry_run:
                    p.auction_status = new_status

        if not dry_run and changed:
            await db.commit()

        print(f"扫描 {len(rows)} 条" + (f"（平台={platform}）" if platform else ""))
        print(f"{'将修正' if dry_run else '已修正'} {changed} 条：")
        for k, v in sorted(changes.items(), key=lambda x: -x[1]):
            print(f"  {k}: {v}")
        if dry_run:
            print("\n[dry-run] 未写库。去掉 --dry-run 实际执行。")
    finally:
        await db.close()


def main() -> None:
    ap = argparse.ArgumentParser(description="按时间重算并修正历史房源 auction_status")
    ap.add_argument("--platform", default=None, help="只修指定平台（京东拍卖/阿里拍卖/公拍网）")
    ap.add_argument("--dry-run", action="store_true", help="只预览不写库")
    args = ap.parse_args()
    asyncio.run(run(args.platform, args.dry_run))


if __name__ == "__main__":
    main()
