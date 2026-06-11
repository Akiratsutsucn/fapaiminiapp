"""跨平台「缺字段兜底挖掘器」+ 附件/成交确认书识别。

背景（用户 2026-06-10 要求）：
  面积、加价幅度、起拍价、保证金、房源照片 这五个字段在三个平台的
  「竞买公告 / 标的物介绍 / 标的物详情 / 竞拍公告」里 100% 都有。
  但各平台解析器原先只信任自己的主数据源（接口字段 / 单一区块），主源缺了就留空，
  没有「翻遍所有公告/详情文本再挖一遍」的统一兜底——这才是审核老发现缺字段的根因。

本模块提供两类能力，供三平台解析器共用：
  1. mine_*()       —— 从聚合后的全文（所有区块拼接）兜底挖掘四个文本型字段
                       （面积/加价幅度/起拍价/保证金；照片是图片源不在此）。
  2. parse_attachments() / has_deal_confirmation()
                    —— 统一解析附件清单、识别「成交确认书」。

设计原则：
  - 只在主源「缺失/为 0」时调用，绝不覆盖已抓到的可信值；
  - 正则尽量覆盖三平台的写法差异（内联型、表格型、带括号单位等）；
  - 数值都经 price/area cleaner 做范围与单位归一，杜绝脏值入库。
"""
import re

from .price import parse_price_to_yuan, parse_area_sqm

# 「成交确认书」别名：三平台/各法院措辞略有差异，统一在此维护。
DEAL_CONFIRM_KEYWORDS = (
    "成交确认书",
    "拍卖成交确认书",
    "网络司法拍卖成交确认书",
    "竞买成交确认书",
)

# 面积合理区间（㎡）：排除宗地/使用权超大面积与误抓的小数。
_AREA_MIN, _AREA_MAX = 5.0, 5000.0


def normalize_text(*parts: str) -> str:
    """把多个文本区块拼成单行全文（空白归一），供下面的 mine_* 正则扫描。

    任意 part 可为 None/空，自动跳过。各平台解析器把
    竞买公告 / 标的物介绍 / 标的物详情 / 竞拍公告 的正文全部传进来即可。
    """
    joined = " ".join(p for p in parts if p)
    return re.sub(r"\s+", " ", joined).strip()


def mine_area(full_text: str) -> float:
    """从全文兜底挖建筑面积（㎡）。覆盖内联型 / 表格型 / 带括号单位三类写法。

    - 负向先行排除「地下建筑面积」（地下部分非套内/总建面）；
    - (?:总)?建筑[一-龥]{0,2}面积 兼容 建筑面积/建筑总面积/总建筑面积/套内建筑面积；
    - 表格型：表头「建筑面积（平方米）」后与数值被其它单元格隔开，窗口内取首个小数。
    """
    if not full_text:
        return 0.0
    patterns = (
        # 内联型：标签后紧跟数值 + 单位
        r"(?<!地下)(?:总)?建筑[一-龥]{0,2}面积[为约是：:\s]*([\d]+(?:\.\d+)?)\s*(?:平方米|㎡|平米|m²|m2)",
        # 内联型：标签后 8 字内出现数值（含「建筑面积（㎡）123」无空格写法）
        r"(?<!地下)(?:总)?建筑[一-龥]{0,2}面积[^0-9]{0,8}([\d]+(?:\.\d+)?)",
        # 表格型：带括号单位表头后窗口内取首个小数（楼层是整数，不会被误取）
        r"(?<!地下)(?:总)?建筑[一-龥]{0,2}面积\s*[（(][^)）]{0,10}[)）].{0,120}?(\d+\.\d+)",
    )
    for pat in patterns:
        m = re.search(pat, full_text)
        if not m:
            continue
        v = parse_area_sqm(m.group(1))
        if _AREA_MIN <= v <= _AREA_MAX:
            return v
    return 0.0


def mine_increment(full_text: str) -> int:
    """从全文兜底挖加价幅度（元）。覆盖「加价幅度/竞价幅度/每次加价/增价幅度」等写法。"""
    if not full_text:
        return 0
    patterns = (
        r"(?:加价|竞价|增价)幅度[（(]?[^)）]{0,8}[)）]?[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"每次(?:加价|出价|竞价)(?:增加|不低于|不少于)?[幅度]?[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"(?:加价|竞价)阶梯[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
    )
    for pat in patterns:
        m = re.search(pat, full_text)
        if m:
            val = _money_with_unit(m.group(1), m.group(2))
            if val > 0:
                return val
    return 0


def mine_starting_price(full_text: str) -> int:
    """从全文兜底挖起拍价（元）。覆盖 起拍价/起始价/起拍/变卖价/当前价 等标签。"""
    if not full_text:
        return 0
    patterns = (
        r"起拍价[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"起始价[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"变卖价[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"拍卖保留价[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"当前价[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
    )
    for pat in patterns:
        m = re.search(pat, full_text)
        if m:
            val = _money_with_unit(m.group(1), m.group(2))
            if val > 0:
                return val
    return 0


def mine_deposit(full_text: str) -> int:
    """从全文兜底挖保证金（元）。覆盖 保证金/竞买保证金/变卖预缴款 等标签。"""
    if not full_text:
        return 0
    patterns = (
        r"(?:竞买)?保证金[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"变卖预缴款[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
    )
    for pat in patterns:
        m = re.search(pat, full_text)
        if m:
            val = _money_with_unit(m.group(1), m.group(2))
            if val > 0:
                return val
    return 0


def mine_appraisal_price(full_text: str) -> int:
    """从全文兜底挖评估价/市场价（元）。覆盖 评估价/评估值/评估总价/市场价 等写法。

    注意：只认明确的「评估/市场价」标签，避免被「起拍价/保证金」就近误命中。
    """
    if not full_text:
        return 0
    patterns = (
        r"评估价(?:值|格)?[为约是：:\s]*(?:人民币)?\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"评估总价[为约是：:\s]*(?:人民币)?\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"房屋评估价?值?[为约是：:\s]*(?:人民币)?\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"市场价(?:值|格)?[为约是：:\s]*(?:人民币)?\s*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
    )
    for pat in patterns:
        m = re.search(pat, full_text)
        if m:
            val = _money_with_unit(m.group(1), m.group(2))
            if val > 0:
                return val
    return 0


def _money_with_unit(num_str: str, unit: str | None) -> int:
    """把「数值 + 单位(万/亿/元)」组合交给 parse_price_to_yuan 归一为元。"""
    if not num_str:
        return 0
    return parse_price_to_yuan(f"{num_str}{unit or '元'}")


# ── 附件清单 & 成交确认书 ──────────────────────────────────────────────────

def parse_attachments(raw_list) -> list[dict]:
    """把各平台原始附件列表归一为 [{"name","url"}]。

    入参可为：
      - dict 列表（阿里：[{"name"/"title"/"fileName", "url"/"downloadUrl"/"fileUrl"}]）
      - (name, url) 二元组列表（HTML 解析：(<a> 文本, href)）
      - str 列表（只有名称、无链接）
    名称/链接缺失时分别留空字符串。去重（按 name+url）。
    """
    out: list[dict] = []
    seen: set = set()
    for el in (raw_list or []):
        name, url = "", ""
        if isinstance(el, dict):
            name = (el.get("name") or el.get("title") or el.get("fileName")
                    or el.get("attachmentName") or "").strip()
            url = (el.get("url") or el.get("downloadUrl") or el.get("fileUrl")
                   or el.get("ossUrl") or el.get("href") or "").strip()
        elif isinstance(el, (tuple, list)) and len(el) == 2:
            name = (el[0] or "").strip()
            url = (el[1] or "").strip()
        elif isinstance(el, str):
            name = el.strip()
        if not name and not url:
            continue
        key = (name, url)
        if key in seen:
            continue
        seen.add(key)
        out.append({"name": name, "url": url})
    return out


def find_deal_confirmation(attachments: list[dict]) -> dict | None:
    """在附件清单里找「成交确认书」，返回该附件 dict（含 url），无则 None。"""
    for att in (attachments or []):
        name = att.get("name") or ""
        if any(kw in name for kw in DEAL_CONFIRM_KEYWORDS):
            return att
    return None


def has_deal_confirmation_in_text(full_text: str) -> bool:
    """正文里出现「成交确认书」字样（附件名拿不到时的弱兜底）。"""
    if not full_text:
        return False
    return any(kw in full_text for kw in DEAL_CONFIRM_KEYWORDS)


# ── 统一高层入口 ──────────────────────────────────────────────────────────

def apply_text_fallbacks(item, full_text: str, raw_attachments=None) -> dict | None:
    """三平台解析器统一调用的「缺字段兜底 + 附件 + 成交确认书」入口（同步部分）。

    职责：
      1. 五字段（面积/加价幅度/起拍价/保证金/评估价）主源为空/0 时，从 full_text 兜底挖；
         （照片 image_urls 是图片源、不在文本内，仍由各平台自身逻辑处理）
      2. 把原始附件列表归一为 item.attachments [{name,url}]；
      3. 识别「成交确认书」：附件名命中 → item.deal_confirmed=True（铁证）；
         附件拿不到但正文出现「成交确认书」字样 → 也置 True（弱兜底）。

    返回：若找到「成交确认书」附件且带 url，返回该附件 dict（供调用方异步下载 PDF
          解析网拍结束时间）；否则 None。

    注意：本函数只做同步逻辑，不触网。PDF 下载/时间解析由调用方在 async 上下文里
          用 utils.deal_confirm.parse_deal_confirm_end_time(url) 完成。
    """
    # 1. 五字段兜底（仅在主源缺失时）
    if not item.area or item.area <= 0:
        v = mine_area(full_text)
        if v > 0:
            item.area = v
    if not item.increment_amount or item.increment_amount <= 0:
        v = mine_increment(full_text)
        if v > 0:
            item.increment_amount = v
    if not item.starting_price or item.starting_price <= 0:
        v = mine_starting_price(full_text)
        if v > 0:
            item.starting_price = v
    if not item.deposit or item.deposit <= 0:
        v = mine_deposit(full_text)
        if v > 0:
            item.deposit = v
    if not item.appraisal_price or item.appraisal_price <= 0:
        v = mine_appraisal_price(full_text)
        if v > 0:
            item.appraisal_price = v

    # 2. 附件清单归一
    attachments = parse_attachments(raw_attachments)
    if attachments:
        item.attachments = attachments
        item.has_attachments = True

    # 3. 成交确认书识别
    confirm_att = find_deal_confirmation(attachments)
    if confirm_att:
        item.deal_confirmed = True
        return confirm_att if confirm_att.get("url") else None
    # 弱兜底：正文出现「成交确认书」字样
    if has_deal_confirmation_in_text(full_text):
        item.deal_confirmed = True
    return None


