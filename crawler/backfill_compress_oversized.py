"""存量图片压缩：扫描 /picture 下超过目标大小的图片,用 image_processor 的目标大小
压缩逻辑重新压制并原地覆盖,使每张图 ≤ TARGET_MAX_BYTES(180KB)。

特点:
- 纯磁盘文件操作,不依赖数据库、不重新下载(直接读已存的图重压)。
- 幂等:已达标的图跳过;可中断后重复跑(每次只处理仍超标的)。
- 限速:每张之间小睡,避免对 COS 挂载(cosfs)造成写压力。
- 安全:压完比原图小才覆盖;压缩失败的图保持原样不动。

用法:
  python -m crawler.backfill_compress_oversized            # 演练(只统计,不写)
  python -m crawler.backfill_compress_oversized --commit   # 实际覆盖
  python -m crawler.backfill_compress_oversized --commit --limit 500
  python -m crawler.backfill_compress_oversized --commit --dir /picture/properties
"""
import sys
import time
from pathlib import Path

from loguru import logger

from crawler.pipelines.image_processor import ImageProcessor, MAX_WIDTH, TARGET_MAX_BYTES

COMMIT = "--commit" in sys.argv
BASE_DIR = "/picture"
LIST_FILE = ""  # 可选:从预先扫好的文件列表读路径,跳过慢速全盘遍历(cosfs)
LIMIT = 0
for i, a in enumerate(sys.argv):
    if a == "--limit" and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])
    if a == "--dir" and i + 1 < len(sys.argv):
        BASE_DIR = sys.argv[i + 1]
    if a == "--list" and i + 1 < len(sys.argv):
        LIST_FILE = sys.argv[i + 1]

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
SLEEP_BETWEEN = 0.03  # 限速:每张之间小睡,降低 cosfs 写压力


def iter_from_list(list_file: str):
    """从扫描结果文件读路径。格式每行 "<size> <path>" 或纯 "<path>"。"""
    for line in Path(list_file).read_text().splitlines():
        line = line.strip()
        if not line or line == "DONE":
            continue
        parts = line.split(None, 1)
        path = Path(parts[1]) if len(parts) == 2 and parts[0].isdigit() else Path(line)
        if path.is_file() and path.suffix.lower() in IMG_EXTS:
            yield path


def iter_oversized(base: Path):
    """逐个产出超过目标大小的图片路径(流式,避免一次性收集巨量列表)。"""
    for p in base.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in IMG_EXTS:
            continue
        try:
            if p.stat().st_size > TARGET_MAX_BYTES:
                yield p
        except OSError:
            continue


def main():
    if LIST_FILE:
        source = iter_from_list(LIST_FILE)
        logger.info(f"从列表 {LIST_FILE} 读取超标图片"
                    f"{'(实际覆盖)' if COMMIT else '(演练,不写盘)'}...")
    else:
        base = Path(BASE_DIR)
        if not base.exists():
            logger.error(f"目录不存在: {base}")
            return
        source = iter_oversized(base)
        logger.info(f"扫描 {base} 中超过 {TARGET_MAX_BYTES // 1024}KB 的图片"
                    f"{'(实际覆盖)' if COMMIT else '(演练,不写盘)'}...")

    scanned = compressed = skipped = failed = 0
    saved_bytes = 0

    for path in source:
        scanned += 1
        try:
            raw = path.read_bytes()
            orig = len(raw)
            # 用目标大小压缩逻辑重压(保持 WebP、≤180KB)
            out = ImageProcessor._resize_to_webp(raw, MAX_WIDTH, 80, TARGET_MAX_BYTES)
            if len(out) >= orig:
                # 压完没变小(罕见,已是高度压缩)→ 不动
                skipped += 1
            elif COMMIT:
                path.write_bytes(out)
                compressed += 1
                saved_bytes += orig - len(out)
            else:
                compressed += 1
                saved_bytes += orig - len(out)
            if scanned % 100 == 0:
                logger.info(f"进度: 已查{scanned} 压缩{compressed} 跳过{skipped} "
                            f"失败{failed} 节省{saved_bytes // 1024 // 1024}MB")
        except Exception as e:
            failed += 1
            logger.warning(f"压缩失败,保持原样: {path} — {e}")
        if SLEEP_BETWEEN:
            time.sleep(SLEEP_BETWEEN)
        if LIMIT and scanned >= LIMIT:
            logger.info(f"达到 --limit {LIMIT},停止")
            break

    logger.info(f"完成: 超标图 {scanned} 张, 压缩 {compressed}, 跳过 {skipped}, "
                f"失败 {failed}, 节省 {saved_bytes // 1024 // 1024}MB"
                f"{' (演练未写盘,加 --commit 实际执行)' if not COMMIT else ''}")


if __name__ == "__main__":
    main()
