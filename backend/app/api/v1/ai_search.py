"""AI自然语言搜索解析接口"""
import re
from typing import Optional
from fastapi import APIRouter

router = APIRouter()


class NLSearchParser:
    """自然语言搜索解析器"""

    # 区县关键词（上海/宁波/杭州）
    DISTRICTS = [
        # 上海
        '黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区',
        '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区',
        '奉贤区', '崇明区',
        # 宁波
        '海曙区', '江北区', '江东区', '北仑区', '镇海区', '鄞州区', '奉化区',
        '余姚市', '慈溪市', '宁海县', '象山县',
        # 杭州
        '上城区', '下城区', '江干区', '拱墅区', '西湖区', '滨江区', '萧山区',
        '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市',
    ]

    # 户型关键词
    LAYOUT_PATTERNS = [
        (r'([一二三四五1-5])[室房]', 'bedrooms'),
        (r'([一二三四五1-5])厅', 'livingrooms'),
        (r'([一二三四五1-5])卫', 'bathrooms'),
    ]

    CN_NUM_MAP = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5}

    # 价格关键词
    PRICE_PATTERNS = [
        (r'(\d+)万以下', 'max'),
        (r'(\d+)万以上', 'min'),
        (r'(\d+)万[到至\-~](\d+)万', 'range'),
        (r'(\d+)[到至\-~](\d+)万', 'range'),
    ]

    # 面积关键词
    AREA_PATTERNS = [
        (r'(\d+)平[米方]?以下', 'max'),
        (r'(\d+)平[米方]?以上', 'min'),
        (r'(\d+)[到至\-~](\d+)平[米方]?', 'range'),
    ]

    # 物业类型
    PROPERTY_TYPES = {
        '住宅': '住宅',
        '别墅': '别墅',
        '商铺': '商铺',
        '写字楼': '写字楼',
        '厂房': '厂房',
        '车位': '车位',
    }

    # 拍卖状态关键词
    AUCTION_STATUS_KEYWORDS = {
        '捡漏': 'bargain',
        '即将开拍': '即将开拍',
        '正在拍': '进行中',
        '进行中': '进行中',
    }

    @classmethod
    def parse(cls, query: str) -> dict:
        """解析自然语言查询，返回结构化筛选条件"""
        result = {}

        # 1. 提取区域
        district = cls._extract_district(query)
        if district:
            result['district'] = district

        # 2. 提取户型
        layout = cls._extract_layout(query)
        if layout:
            result['layout'] = layout

        # 3. 提取价格
        price = cls._extract_price(query)
        if price:
            result.update(price)

        # 4. 提取面积
        area = cls._extract_area(query)
        if area:
            result.update(area)

        # 5. 提取物业类型
        property_type = cls._extract_property_type(query)
        if property_type:
            result['property_type'] = property_type

        # 6. 提取拍卖状态
        auction_info = cls._extract_auction_status(query)
        if auction_info:
            result.update(auction_info)

        return result

    @classmethod
    def _extract_district(cls, query: str) -> Optional[str]:
        """提取区县"""
        for district in cls.DISTRICTS:
            if district in query:
                return district
        return None

    @classmethod
    def _extract_layout(cls, query: str) -> Optional[str]:
        """提取户型，如'三室两厅' -> '3室2厅'"""
        parts = []
        for pattern, label in cls.LAYOUT_PATTERNS:
            match = re.search(pattern, query)
            if match:
                num_str = match.group(1)
                num = cls.CN_NUM_MAP.get(num_str, num_str)
                if label == 'bedrooms':
                    parts.append(f'{num}室')
                elif label == 'livingrooms':
                    parts.append(f'{num}厅')
                elif label == 'bathrooms':
                    parts.append(f'{num}卫')

        return ''.join(parts) if parts else None

    @classmethod
    def _extract_price(cls, query: str) -> dict:
        """提取价格范围（单位：万元）"""
        result = {}

        for pattern, ptype in cls.PRICE_PATTERNS:
            match = re.search(pattern, query)
            if match:
                if ptype == 'max':
                    result['price_max'] = int(match.group(1)) * 10000
                elif ptype == 'min':
                    result['price_min'] = int(match.group(1)) * 10000
                elif ptype == 'range':
                    result['price_min'] = int(match.group(1)) * 10000
                    result['price_max'] = int(match.group(2)) * 10000
                break

        return result

    @classmethod
    def _extract_area(cls, query: str) -> dict:
        """提取面积范围（单位：平方米）"""
        result = {}

        for pattern, atype in cls.AREA_PATTERNS:
            match = re.search(pattern, query)
            if match:
                if atype == 'max':
                    result['area_max'] = int(match.group(1))
                elif atype == 'min':
                    result['area_min'] = int(match.group(1))
                elif atype == 'range':
                    result['area_min'] = int(match.group(1))
                    result['area_max'] = int(match.group(2))
                break

        return result

    @classmethod
    def _extract_property_type(cls, query: str) -> Optional[str]:
        """提取物业类型"""
        for keyword, value in cls.PROPERTY_TYPES.items():
            if keyword in query:
                return value
        return None

    @classmethod
    def _extract_auction_status(cls, query: str) -> dict:
        """提取拍卖状态相关信息"""
        result = {}

        for keyword, value in cls.AUCTION_STATUS_KEYWORDS.items():
            if keyword in query:
                if value == 'bargain':
                    # 捡漏：折扣率 0.1-0.65
                    result['discount_min'] = 0.1
                    result['discount_max'] = 0.65
                else:
                    result['auction_status'] = value
                break

        return result


@router.get("/parse")
async def parse_nl_search(query: str):
    """
    解析自然语言搜索查询

    示例：
    - "徐汇区三室两厅500万以下"
    - "浦东新区100平以上捡漏房"
    - "宁波江北区两室一厅200到300万"
    """
    parsed = NLSearchParser.parse(query)
    return {
        "query": query,
        "parsed": parsed,
    }
