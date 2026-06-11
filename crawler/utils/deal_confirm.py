"""成交确认书 PDF 解析：下载附件 PDF，提取「网拍结束时间」。

用途（用户 2026-06-10 要求）：
  「成交确认书」附件是房源已成交的铁证，其正文里有「网拍结束时间」——
  用它判定「昨日成交」比按拍卖结束时间（auction_end_time，常是计划结束时间，
  可能因延时出价而与真实落槌时间不符）推断要准。

实现：
  1. download_pdf_text()  —— httpx 下载 PDF，pdfplumber 提取文本层（首选）。
  2. extract_online_end_time() —— 从文本正则解析「网拍结束时间」为 datetime。
  3. parse_deal_confirm_end_time() —— 上面两步的组合入口（给定 PDF url 直接拿时间）。

降级与容错：
  - pdfplumber 未安装 / PDF 是扫描件（无文本层）/ 下载失败 → 返回 None，不抛异常，
    不做 OCR（成本高、收益不稳）；调用方据此回退到 auction_end_time 口径。
  - 所有异常吞掉并 debug 日志，绝不让单条 PDF 解析失败影响整轮抓取。
"""
import re
from datetime import datetime

from loguru import logger

# 「网拍结束时间」的多种措辞 + 紧随其后的日期时间。
# 覆盖：网拍结束时间 / 网络拍卖结束时间 / 拍卖结束时间 / 成交时间 / 落槌时间。
# 日期格式覆盖：2026年05月13日 10时00分 / 2026-05-13 10:00 / 2026/05/13 10:00:00。
_END_TIME_LABEL = (
    r"(?:网(?:络)?拍(?:卖)?结束时间|拍卖结束时间|成交时间|落槌时间|结拍时间)"
)
_DT_PATTERNS = (
    # 2026年05月13日 10时00分(00秒)
    (r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日"
     r"(?:\s*(\d{1,2})\s*[时:：]\s*(\d{1,2})\s*(?:分)?(?:\s*(\d{1,2})\s*秒)?)?",
     "cn"),
    # 2026-05-13 10:00:00 / 2026/05/13 10:00
    (r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})"
     r"(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?",
     "iso"),
)


def extract_online_end_time(text: str) -> datetime | None:
    """从成交确认书正文文本里解析「网拍结束时间」。无法解析返回 None。"""
    if not text:
        return None
    flat = re.sub(r"\s+", " ", text)
    # 在「结束时间」标签后 40 字窗口内找日期时间，避免抓到正文里别的日期。
    label_m = re.search(_END_TIME_LABEL, flat)
    search_space = flat[label_m.start():label_m.start() + 60] if label_m else flat
    for pat, kind in _DT_PATTERNS:
        m = re.search(pat, search_space)
        if not m:
            continue
        try:
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            hh = int(m.group(4)) if m.group(4) else 0
            mm = int(m.group(5)) if m.group(5) else 0
            ss = int(m.group(6)) if m.group(6) else 0
            return datetime(y, mo, d, hh, mm, ss)
        except (ValueError, TypeError):
            continue
    return None


# 成交价措辞：京东「网络拍卖成交价格：￥4605900.00」、公拍网「成交价：9282000 元」、
# 阿里「成交价 …元」等。金额可能带 ￥/¥、千分位逗号、小数、万/亿单位。
_DEAL_PRICE_PATTERNS = (
    r"(?:网络拍卖)?成交价(?:格)?[为约是：:\s]*[¥￥]?\s*([\d,]+(?:\.\d+)?)\s*(万|亿|元|圆)?",
    r"成交金额[为约是：:\s]*[¥￥]?\s*([\d,]+(?:\.\d+)?)\s*(万|亿|元|圆)?",
    r"最终成交[价格]*[为约是：:\s]*[¥￥]?\s*([\d,]+(?:\.\d+)?)\s*(万|亿|元|圆)?",
)


def extract_deal_price(text: str) -> int:
    """从成交确认书/成交公告正文解析「成交价」(元)。无法解析返回 0。

    成交确认书金额多为「￥4605900.00（肆佰陆拾万…圆整）」这类已是「元」单位的精确值，
    故优先按元解析；仅当显式带「万/亿」单位时才换算。
    """
    if not text:
        return 0
    flat = re.sub(r"\s+", " ", text)
    for pat in _DEAL_PRICE_PATTERNS:
        m = re.search(pat, flat)
        if not m:
            continue
        num_s = (m.group(1) or "").replace(",", "")
        unit = m.group(2) or ""
        try:
            val = float(num_s)
        except ValueError:
            continue
        if unit == "万":
            val *= 10_000
        elif unit == "亿":
            val *= 100_000_000
        # 「元/圆/无单位」→ 已是元
        val = int(round(val))
        # 合理性：法拍房成交价区间 [1万, 50亿]，排除误抓的小数/编号
        if 10_000 <= val <= 5_000_000_000:
            return val
    return 0


async def download_pdf_text(url: str, timeout: float = 20.0) -> str:
    """下载 PDF 并提取文本层。失败/扫描件/缺库 → 返回空串（不抛）。

    注意：京东成交确认书 confirmationUrl 形如
    `//storage.jd.com/salesconfirmation.customs.paimai/<hash>/1`——既无 .pdf 后缀、
    也不含 "pdf" 字样，故不能按后缀预判跳过；统一下载后用 %PDF magic bytes 判定。
    """
    if not url:
        return ""
    try:
        import pdfplumber  # 延迟导入：未装 pdfplumber 时本函数静默降级
    except ImportError:
        logger.debug("[deal_confirm] pdfplumber 未安装，跳过 PDF 文本解析")
        return ""
    try:
        import io
        import httpx
        if url.startswith("//"):
            url = "https:" + url
        headers = {
            "Referer": "https://paimai.jd.com/",
            "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/126.0.0.0 Safari/537.36"),
        }
        async with httpx.AsyncClient(timeout=timeout, headers=headers,
                                     follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.content
        if not data or not data[:5].startswith(b"%PDF"):
            return ""  # 非 PDF 内容（可能是 HTML 错误页）
        parts: list[str] = []
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages[:5]:  # 成交确认书通常 1~2 页，最多读 5 页
                parts.append(page.extract_text() or "")
        return "\n".join(parts)
    except Exception as e:
        logger.debug(f"[deal_confirm] PDF 下载/解析失败 {url}: {e}")
        return ""


async def parse_deal_confirm_end_time(url: str) -> datetime | None:
    """给定成交确认书 PDF url，返回其中的「网拍结束时间」。失败返回 None。"""
    text = await download_pdf_text(url)
    if not text:
        return None
    return extract_online_end_time(text)


async def parse_deal_confirm(url: str) -> dict:
    """给定成交确认书 PDF url，一次性解析「网拍结束时间」+「成交价」。

    返回 {"end_time": datetime|None, "deal_price": int}。下载/解析失败返回空值字典，
    不抛异常（调用方据此回退）。只下载一次 PDF，避免重复网络开销。
    """
    text = await download_pdf_text(url)
    if not text:
        return {"end_time": None, "deal_price": 0}
    return {
        "end_time": extract_online_end_time(text),
        "deal_price": extract_deal_price(text),
    }
