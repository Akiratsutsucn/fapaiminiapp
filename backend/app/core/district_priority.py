"""主城区优先级排序工具。

业务规则：头条捡漏 + 列表页默认排序按 4 档优先级：
  1. 主城 + 一拍/二拍
  2. 郊区 + 一拍/二拍
  3. 主城 + 变卖
  4. 郊区 + 变卖

主城清单是业务定义，不依赖行政区划当前状态：
  - 上海：传统中心城区 7 区 + 浦东新区 + 闵行区
  - 宁波：海曙/江北/鄞州/镇海/北仑（镇海北仑库里暂无数据，写进清单待出现）
  - 杭州：上城/拱墅/西湖/滨江/钱塘/江干/下城（江干下城是历史已并入区，库里仍有历史数据）

提供两种用法：
  - is_main_district(city_id, district)  纯 Python 判定（脚本/解析器）
  - tier_sql_expr()                      SQLAlchemy case() 表达式（ORDER BY 用）
"""
from typing import Optional

# 主城区清单（业务定义，可调）
MAIN_DISTRICTS_BY_CITY: dict[int, tuple[str, ...]] = {
    310000: ("黄浦区", "静安区", "徐汇区", "长宁区", "普陀区",
             "虹口区", "杨浦区", "浦东新区", "闵行区"),
    330200: ("海曙区", "江北区", "鄞州区", "镇海区", "北仑区"),
    330100: ("上城区", "拱墅区", "西湖区", "滨江区",
             "钱塘区", "江干区", "下城区"),
}

# 变卖标识（库里 auction_round 取值）
SALE_BY_AGREEMENT_ROUND = "变卖"


def is_main_district(city_id: Optional[int], district: Optional[str]) -> bool:
    """判断 (城市, 区县) 是否属于业务定义的主城区。"""
    if not city_id or not district:
        return False
    return district in MAIN_DISTRICTS_BY_CITY.get(city_id, ())


def compute_tier(city_id: Optional[int], district: Optional[str], auction_round: Optional[str]) -> int:
    """返回 1/2/3/4 档位。数字越小排越前。"""
    is_main = is_main_district(city_id, district)
    is_sale_by_agreement = (auction_round or "") == SALE_BY_AGREEMENT_ROUND
    if is_main and not is_sale_by_agreement:
        return 1
    if not is_main and not is_sale_by_agreement:
        return 2
    if is_main and is_sale_by_agreement:
        return 3
    return 4


def tier_sql_expr():
    """返回 1/2/3/4 档位的 SQLAlchemy case() 表达式，可直接用于 .order_by()。

    SQL 层等价于 compute_tier()。延迟 import 与 auction_status.effective_status_sql 同样的考虑：
    保持本模块顶部不直接 import SQLAlchemy / ORM。
    """
    from sqlalchemy import case, and_, or_
    from ..models.property import Property

    # 主城判定：用 OR 罗列每个城市的 (city_id, district in [...]) 条件
    main_conditions = []
    for city_id, districts in MAIN_DISTRICTS_BY_CITY.items():
        main_conditions.append(
            and_(Property.city_id == city_id, Property.district.in_(districts))
        )
    is_main = or_(*main_conditions) if main_conditions else False

    is_sale = Property.auction_round == SALE_BY_AGREEMENT_ROUND

    return case(
        (and_(is_main, ~is_sale), 1),
        (and_(~is_main, ~is_sale), 2),
        (and_(is_main, is_sale), 3),
        else_=4,
    )
