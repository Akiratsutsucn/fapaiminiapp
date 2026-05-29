"""智能数据丰富：从已有字段衍生出 tags + 爆款文案。

tags：从 description / address 中识别地铁、学区、商圈、新旧房标签
bargain_tagline：根据折扣/面积/楼层/装修动态生成爆款营销文案
"""
from __future__ import annotations
import re
from typing import Optional


# === 地铁线路（上海+宁波核心线路）===
_METRO_PATTERNS = [
    (r"地铁\s*1\s*号线|轨交\s*1\s*号线", "地铁1号线"),
    (r"地铁\s*2\s*号线|轨交\s*2\s*号线", "地铁2号线"),
    (r"地铁\s*3\s*号线|轨交\s*3\s*号线", "地铁3号线"),
    (r"地铁\s*4\s*号线|轨交\s*4\s*号线", "地铁4号线"),
    (r"地铁\s*5\s*号线|轨交\s*5\s*号线", "地铁5号线"),
    (r"地铁\s*6\s*号线|轨交\s*6\s*号线", "地铁6号线"),
    (r"地铁\s*7\s*号线|轨交\s*7\s*号线", "地铁7号线"),
    (r"地铁\s*8\s*号线|轨交\s*8\s*号线", "地铁8号线"),
    (r"地铁\s*9\s*号线|轨交\s*9\s*号线", "地铁9号线"),
    (r"地铁\s*10\s*号线|轨交\s*10\s*号线", "地铁10号线"),
    (r"地铁\s*11\s*号线|轨交\s*11\s*号线", "地铁11号线"),
    (r"地铁\s*12\s*号线|轨交\s*12\s*号线", "地铁12号线"),
    (r"地铁\s*13\s*号线|轨交\s*13\s*号线", "地铁13号线"),
    (r"地铁\s*14\s*号线|轨交\s*14\s*号线", "地铁14号线"),
    (r"地铁\s*15\s*号线|轨交\s*15\s*号线", "地铁15号线"),
    (r"地铁\s*16\s*号线|轨交\s*16\s*号线", "地铁16号线"),
    (r"地铁\s*17\s*号线|轨交\s*17\s*号线", "地铁17号线"),
    (r"地铁\s*18\s*号线|轨交\s*18\s*号线", "地铁18号线"),
]

# === 学区/教育 ===
_EDUCATION_PATTERNS = [
    (r"重点(?:中学|小学)|示范(?:中学|小学)", "重点学区"),
    (r"学区房|对口(?:小学|中学|学校)|名校", "学区房"),
    (r"双学区", "双学区"),
    (r"国际学校", "国际学校"),
]

# === 商圈/便利 ===
_COMMERCE_PATTERNS = [
    (r"陆家嘴|静安寺|徐家汇|南京西路|南京东路|淮海中路|世纪大道", "核心商圈"),
    (r"万达广场|龙之梦|大悦城|新世界|久光|嘉里城|环贸|来福士|港汇恒隆", "成熟商圈"),
    (r"商圈|步行街|cbd|CBD", "城市商圈"),
]

# === 房源属性 ===
_PROPERTY_PATTERNS = [
    (r"次新房|2010年[以后]|2015年[以后]|2020年[以后]", "次新房"),
    (r"满五唯一", "满五唯一"),
    (r"满两年|满二", "满二"),
    (r"南北通透|朝南北|南北朝向", "南北通透"),
    (r"复式|跃层|loft|LOFT", "复式"),
    (r"花园|带花园|私家花园", "带花园"),
    (r"露台|大露台", "带露台"),
    (r"地下车位|车位|停车位", "含车位"),
    (r"江景|河景|观江|观河", "江/河景"),
    (r"景观房|公园景|湖景", "景观房"),
    (r"婚房|新装修|刚装修", "新装修"),
    (r"毛坯|清水房", "毛坯交付"),
    (r"精装修|精装", "精装"),
    (r"豪装|豪华装修", "豪装"),
    (r"老洋房|花园洋房", "花园洋房"),
    (r"别墅", "别墅"),
    (r"loft|LOFT|挑高", "挑高/LOFT"),
]

# === 拍卖属性 ===
_AUCTION_PATTERNS = [
    (r"无产证|无房产证|无证", "无产证"),
    (r"已腾空|已搬空|空置", "已腾空"),
    (r"无优先购买权|无优先权人", "无优先权"),
    (r"未结清按揭|有按揭|带按揭", "带按揭"),
    (r"租约|有租约|出租中", "有租约"),
    (r"户口未迁|户口在|有户口", "户口风险"),
    (r"无抵押|无查封", "无抵押"),
]


def extract_tags(p) -> list[str]:
    """从 property 抽取所有 tags。"""
    text_blob = " ".join(filter(None, [
        p.title or "", p.description or "", p.address or "",
        p.community_name or "", p.sub_district or "",
    ]))

    tags: list[str] = []

    # 地铁
    for pattern, tag in _METRO_PATTERNS:
        if re.search(pattern, text_blob, re.IGNORECASE):
            tags.append(tag)

    # 学区
    for pattern, tag in _EDUCATION_PATTERNS:
        if re.search(pattern, text_blob, re.IGNORECASE) and tag not in tags:
            tags.append(tag)

    # 商圈
    for pattern, tag in _COMMERCE_PATTERNS:
        if re.search(pattern, text_blob, re.IGNORECASE) and tag not in tags:
            tags.append(tag)

    # 房源属性
    for pattern, tag in _PROPERTY_PATTERNS:
        if re.search(pattern, text_blob, re.IGNORECASE) and tag not in tags:
            tags.append(tag)

    # 拍卖属性
    for pattern, tag in _AUCTION_PATTERNS:
        if re.search(pattern, text_blob, re.IGNORECASE) and tag not in tags:
            tags.append(tag)

    # 数值衍生
    if p.area:
        if p.area >= 200:
            tags.append("大平层")
        elif p.area < 50:
            tags.append("精致小户")

    if p.build_year:
        from datetime import datetime
        age = datetime.now().year - p.build_year
        if age < 5:
            tags.append("次新房")
        elif age < 10 and "次新房" not in tags:
            tags.append("次新房")

    if p.has_elevator is True:
        tags.append("电梯房")

    if p.auction_round and "二拍" in p.auction_round:
        tags.append("二拍")
    elif p.auction_round and "变卖" in p.auction_round:
        tags.append("变卖")

    # 折扣 tags
    if p.starting_price and p.appraisal_price and p.appraisal_price > 0:
        ratio = p.starting_price / p.appraisal_price
        if ratio < 0.7:
            tags.append("超低折扣")
        elif ratio < 0.85:
            tags.append("七折捡漏")

    # 唯一化 + 限制最多 8 个
    seen = set()
    out = []
    for t in tags:
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
        if len(out) >= 8:
            break
    return out


def build_bargain_tagline(p, tags: list[str] | None = None) -> Optional[str]:
    """根据房源数据生成 1-2 句爆款营销文案。

    优先使用：折扣（最有冲击力）+ 地段（增加吸引力）+ 一个亮点 tag。
    """
    if not p.starting_price or not p.appraisal_price or p.appraisal_price <= 0:
        return None

    ratio = p.starting_price / p.appraisal_price
    saving_wan = (p.appraisal_price - p.starting_price) / 10000
    discount_pct = int((1 - ratio) * 100)

    # 第一句：折扣冲击
    if ratio < 0.5:
        first = f"⚡ {discount_pct}% 史诗级捡漏"
    elif ratio < 0.65:
        first = f"⚡ {discount_pct}% 抄底价"
    elif ratio < 0.75:
        first = f"💥 立省 {saving_wan:.0f} 万"
    elif ratio < 0.9:
        first = f"💰 立减 {saving_wan:.0f} 万"
    else:
        first = "近评估价"

    # 第二句：地段或属性
    parts = []
    location = p.district or ""
    if p.sub_district:
        location += f" · {p.sub_district}"
    if location:
        parts.append(location)

    # 找最重要的标签
    priority_tags = ["核心商圈", "学区房", "南北通透", "次新房", "电梯房", "大平层", "复式", "带花园"]
    if tags:
        for t in priority_tags:
            if t in tags:
                parts.append(t)
                break

    if p.area:
        parts.append(f"{p.area:.0f}㎡")

    if p.auction_round and p.auction_round != "一拍":
        parts.append(p.auction_round)

    if parts:
        second = " · ".join(parts[:3])
        return f"{first} · {second}"
    return first


def enrich_smart_fields(p) -> dict:
    """对一个 Property 对象生成 tags + tagline。返回 updates dict。"""
    updates = {}

    new_tags = extract_tags(p)
    if new_tags:
        # 永远覆盖（每次跑都重新计算）
        updates["tags"] = new_tags

    new_line = build_bargain_tagline(p, new_tags)
    if new_line:
        updates["bargain_tagline"] = new_line

    return updates
