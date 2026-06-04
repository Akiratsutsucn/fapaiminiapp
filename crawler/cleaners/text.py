"""Text cleaning and extraction utilities."""
import re


def clean_text(text: str) -> str:
    """Clean whitespace and common noise from extracted text."""
    if not text:
        return ""
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # Remove common noise
    text = text.replace('\xa0', ' ').replace('　', ' ')
    return text


def extract_district(title: str, city_id: int) -> str:
    """Extract district from a property title or address.

    Examples:
        "上海市浦东新区俱进路285弄..." -> "浦东新区"
        "宁波市鄞州区..." -> "鄞州区"
        "广东广州市增城区..." -> "增城区"
    """
    if not title:
        return ""

    districts_shanghai = [
        "浦东新区", "黄浦区", "徐汇区", "长宁区", "静安区", "普陀区",
        "虹口区", "杨浦区", "闵行区", "宝山区", "嘉定区", "金山区",
        "松江区", "青浦区", "奉贤区", "崇明区",
    ]
    districts_ningbo = [
        "海曙区", "江北区", "江东区", "鄞州区", "镇海区", "北仑区", "奉化区",
        "余姚市", "慈溪市", "宁海县", "象山县",
    ]
    districts_hangzhou = [
        "上城区", "下城区", "江干区", "拱墅区", "西湖区", "滨江区", "萧山区", "余杭区",
        "临平区", "钱塘区", "富阳区", "临安区",
        "桐庐县", "淳安县", "建德市",
    ]

    if city_id == 310000:
        districts = districts_shanghai
    elif city_id == 330200:
        districts = districts_ningbo
    elif city_id == 330100:
        districts = districts_hangzhou
    else:
        districts = []

    for d in districts:
        if d in title:
            return d

    # Generic Chinese district extraction
    # District names are typically 2-4 chars + 区/县 (e.g. "增城区", "浦东新区", "海曙区")
    # Use negative lookahead to avoid matching "市" as part of the district name
    import re
    # Strip leading direct-controlled municipality names to avoid matching
    # "北京" in "北京房山区..." as part of the district
    search_text = re.sub(r'^(北京|上海|天津|重庆)', '', title)
    for m in re.finditer(r'((?:(?!市)[一-鿿]){2,4}(?:区|县))', search_text):
        d = m.group(1)
        if d not in ("地区", "市区", "小区", "社区", "园区", "景区", "片区", "特区"):
            return d
    # Fallback: "XX市" for county-level cities
    for m in re.finditer(r'([一-鿿]{2,4}市)', title):
        d = m.group(1)
        if d not in ("城市",):
            return d
    return ""
