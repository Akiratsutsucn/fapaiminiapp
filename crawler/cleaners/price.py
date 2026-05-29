"""Price normalization: convert all price formats to 元 (int)."""
import re
from loguru import logger


def parse_price_to_yuan(text: str) -> int:
    """Parse a price string to integer 元.

    Examples:
        "100万"       -> 1,000,000
        "1.5亿"       -> 150,000,000
        "5,000元"     -> 5,000
        "1234567.89"  -> 1,234,567
        "120.5万元"   -> 1,205,000
    """
    if not text:
        return 0

    text = text.strip().replace(" ", "").replace(",", "").replace("，", "")

    # Extract numeric value
    num_match = re.search(r'([\d.]+)', text)
    if not num_match:
        return 0

    try:
        num = float(num_match.group(1))
    except ValueError:
        return 0

    # Detect unit
    if "亿" in text:
        num *= 100_000_000
    elif "万" in text:
        num *= 10_000
    # else: already in 元

    # Round to integer (法拍房 prices are whole yuan)
    result = int(round(num))

    if result < 0:
        logger.warning(f"Negative price parsed: '{text}' -> {result}")
        return 0

    return result


def parse_area_sqm(text: str) -> float:
    """Parse area string to float (㎡).

    防御性解析：
    - "134.992" → 134.992（保留小数）
    - "134,992" 这种千位分隔符在房产领域没意义（>10000 ㎡ 几乎不可能是住宅），直接判错
    - "134.99 ㎡" → 134.99
    - 空 / 解析失败 → 0.0

    极端值防护：单户面积超过 5000 ㎡ 视为脏数据返回 0.0。
    """
    if not text:
        return 0.0

    text = text.strip().replace(" ", "").replace("，", ",")

    # 优先匹配 "X.Y" 数字（保留小数点）
    # 注意：不去逗号，因为逗号可能是误抓的千位分隔（房产里 area 不可能上万）
    num_match = re.search(r'(\d+(?:\.\d+)?)', text)
    if not num_match:
        return 0.0

    try:
        value = float(num_match.group(1))
    except ValueError:
        return 0.0

    # 极端值防护：住宅/商业地产单户 area 不可能 > 5000 ㎡
    # > 5000 几乎肯定是 parser 把别的字段（如总价/总号）误当成 area
    if value > 5000:
        logger.warning(f"Suspicious area value '{text}' -> {value}, returning 0")
        return 0.0

    if value < 0:
        return 0.0

    return value
