"""垃圾图检测：广告条幅 / 二维码 / logo色块。保守策略，只标最确定的。

返回 (reason, None)：reason 非空表示判定为垃圾图(应隐藏)。
- qrcode : 含二维码
- banner : 极端宽高比的广告条幅
- logo   : 主色占比高 + 低色彩方差的 logo/广告图
- solid  : 近纯色图块
真实房源照片色彩丰富、宽高比正常，几乎不会命中这些保守阈值。
"""
from __future__ import annotations
import io
from collections import Counter

import numpy as np
from PIL import Image

try:
    from pyzbar.pyzbar import decode as _qr_decode
    _HAS_ZBAR = True
except Exception:  # pyzbar/zbar 未装时降级（只跳过二维码检测）
    _HAS_ZBAR = False


def detect_junk(image_bytes: bytes) -> str | None:
    """检测一张图是否为垃圾图。返回 reason(str) 或 None(正常)。"""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return None  # 打不开的不在这里处理

    w, h = img.size
    if not w or not h:
        return None

    # 预计算颜色统计（多处复用）
    small = img.resize((100, 100))
    arr = np.asarray(small).reshape(-1, 3).astype(np.int16)
    std = float(arr.std(axis=0).mean())
    # 饱和度近似：max-min 通道差的均值（黑白图≈0，彩色照片较高）
    saturation = float((arr.max(axis=1) - arr.min(axis=1)).mean())
    quant = (arr // 32 * 32)
    keys = [tuple(x) for x in quant]
    dominant, dom_count = Counter(keys).most_common(1)[0]
    top_ratio = dom_count / len(keys)
    dom_brightness = sum(dominant) / 3.0  # 主色亮度（白底文档≈240，彩色logo底较低）

    # 边缘密度：文档有密集小字（高频细节），logo/纯色块细节少。
    gray = np.asarray(img.resize((100, 100)).convert("L")).astype(np.int16)
    edges = np.abs(np.diff(gray, axis=0)).mean() + np.abs(np.diff(gray, axis=1)).mean()

    # 0. 尺寸分级：
    #    - max(w,h) < 140：太小（icon / 角标 / 缩略图 / 广告气泡"招商中"126x75），一律 logo。
    #    - 140 ≤ max(w,h) < 200：部分拍卖方上传的真实照片本身就这么小（如 192x128 门头照）。
    #      仅当「像照片」（边缘细节丰富 + 有彩色 + 主色占比不高）时保留，否则判 logo。
    if max(w, h) < 140:
        return "logo"
    if max(w, h) < 200:
        looks_photographic = edges >= 12 and std >= 28 and top_ratio < 0.6
        if not looks_photographic:
            return "logo"

    # 1. 二维码（最高置信度，但 pyzbar 会把照片里的纹理误检为二维码）。
    #    真二维码占据图片主体；照片里误检的"二维码"只占一小块。
    #    用解码返回的 rect 面积占比 + 低饱和度双重确认，排除彩色照片误判。
    if _HAS_ZBAR:
        try:
            codes = _qr_decode(img)
            for c in codes:
                area_ratio = (c.rect.width * c.rect.height) / float(w * h)
                if area_ratio > 0.2 and saturation < 40:
                    return "qrcode"
        except Exception:
            pass

    # 2. 极端宽高比 → 广告条幅（真实房源照片宽高比一般 0.5~2）
    ratio = w / h
    if ratio > 3.0 or ratio < 0.33:
        return "banner"

    # 文档保护（关键）：法拍重要附件——不动产登记单、判决书、破产裁定书、评估报告等，
    # 都是白底黑字（含末页/尾页留白多的情况）。这类主色是白/浅色。
    # 真正的垃圾 logo/广告（法拍卖红底、京东资产平台、招商中）主色都是鲜艳深色。
    # 因此：主色为白/浅色(亮度高且低饱和)的图，一律不判 logo/solid，全部保护。
    dom_is_light_neutral = dom_brightness > 195 and saturation < 35
    if dom_is_light_neutral:
        return None

    # 文档/图纸保护（关键，扩展）：户型图、楼层平面图、扫描件等多为浅灰底 + 近灰度
    # （饱和度极低）。这类对购房很有价值，绝不能误删。判据：主色偏亮(>150) 且
    # 几乎无彩色(saturation<20)。广告/logo 即使浅色也带明显彩色（红/蓝），不会命中。
    if dom_brightness > 150 and saturation < 20:
        return None

    # 3. logo/广告：主色占比高 + 低色彩方差 + 鲜艳或深色主色（白底已被上面排除）+ 细节少
    if top_ratio > 0.72 and std < 45 and edges < 12:
        return "logo"
    # 近纯色彩色图块（图标/视频按钮的彩色底）：极高主色占比 + 细节极少 + 有彩色
    #    （加 saturation>20 约束，避免误伤浅灰户型图——它已被上面的图纸保护拦截，此处双保险）
    if top_ratio > 0.85 and edges < 8 and saturation > 20:
        return "solid"
    # 高饱和纯色广告块（如红底"招商中"气泡、蓝底促销图）：饱和度极高 + 偏暗主色。
    #    真实室内照饱和度一般 <60；广告促销底色饱和度常 >90。加暗主色约束避免误伤鲜艳实景。
    if saturation > 90 and dom_brightness < 110 and top_ratio > 0.3:
        return "logo"

    return None
