"""district_priority 边界单测。

无需 DB / pytest，可直接运行：
    PYTHONPATH=backend python -m tests.test_district_priority
覆盖：三城主城/郊区识别、4 档计算、空值/未知 city/未知 district、变卖归类。
"""
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.core.district_priority import (  # noqa: E402
    is_main_district,
    compute_tier,
    MAIN_DISTRICTS_BY_CITY,
    SALE_BY_AGREEMENT_ROUND,
)


def test_is_main_district_shanghai():
    # 主城正例
    for d in ["黄浦区", "静安区", "浦东新区", "闵行区"]:
        assert is_main_district(310000, d), f"上海 {d} 应为主城"
    # 郊区
    for d in ["松江区", "金山区", "崇明区", "奉贤区"]:
        assert not is_main_district(310000, d), f"上海 {d} 应为郊区"


def test_is_main_district_ningbo():
    for d in ["海曙区", "江北区", "鄞州区"]:
        assert is_main_district(330200, d), f"宁波 {d} 应为主城"
    for d in ["慈溪市", "余姚市", "象山县", "宁海县", "奉化区"]:
        assert not is_main_district(330200, d), f"宁波 {d} 应为郊区"


def test_is_main_district_hangzhou():
    for d in ["上城区", "拱墅区", "西湖区", "滨江区", "钱塘区", "下城区"]:
        assert is_main_district(330100, d), f"杭州 {d} 应为主城"
    for d in ["余杭区", "萧山区", "富阳区", "临安区", "淳安县", "桐庐县", "建德市", "临平区"]:
        assert not is_main_district(330100, d), f"杭州 {d} 应为郊区"


def test_is_main_district_edge_cases():
    assert is_main_district(None, "黄浦区") is False, "city_id=None 应返回 False"
    assert is_main_district(310000, None) is False, "district=None 应返回 False"
    assert is_main_district(310000, "") is False, "district='' 应返回 False"
    assert is_main_district(999999, "黄浦区") is False, "未知 city_id 应返回 False"
    assert is_main_district(310000, "未知区") is False, "未知 district 应返回 False"


def test_compute_tier():
    # 1: 主城非变卖
    assert compute_tier(310000, "黄浦区", "一拍") == 1
    assert compute_tier(310000, "浦东新区", "二拍") == 1
    assert compute_tier(330100, "西湖区", "一拍") == 1
    # 2: 郊区非变卖
    assert compute_tier(310000, "松江区", "一拍") == 2
    assert compute_tier(310000, "崇明区", "二拍") == 2
    assert compute_tier(330100, "余杭区", "一拍") == 2
    # 3: 主城变卖
    assert compute_tier(310000, "静安区", "变卖") == 3
    assert compute_tier(330200, "海曙区", "变卖") == 3
    # 4: 郊区变卖
    assert compute_tier(310000, "金山区", "变卖") == 4
    assert compute_tier(330100, "建德市", "变卖") == 4


def test_compute_tier_edge_cases():
    # 缺 round → 视为非变卖（按一二拍处理）
    assert compute_tier(310000, "黄浦区", None) == 1, "主城 round=None 视为档 1"
    assert compute_tier(310000, "黄浦区", "") == 1, "主城 round='' 视为档 1"
    assert compute_tier(310000, "松江区", None) == 2, "郊区 round=None 视为档 2"
    # 缺 city_id / district → 当郊区
    assert compute_tier(None, "黄浦区", "一拍") == 2
    assert compute_tier(310000, None, "一拍") == 2
    # 未知 city → 当郊区
    assert compute_tier(999999, "黄浦区", "变卖") == 4


def test_clusters_cover_real_districts():
    """生产实测的所有 district 都能被分类（不漏不错）。"""
    real = {
        310000: ["浦东新区", "松江区", "宝山区", "金山区", "闵行区", "奉贤区",
                 "青浦区", "嘉定区", "徐汇区", "普陀区", "长宁区", "杨浦区",
                 "虹口区", "静安区", "黄浦区", "崇明区"],
        330200: ["鄞州区", "海曙区", "慈溪市", "江北区", "余姚市", "象山县",
                 "奉化区", "宁海县"],
        330100: ["余杭区", "萧山区", "上城区", "富阳区", "拱墅区", "临安区",
                 "西湖区", "淳安县", "桐庐县", "钱塘区", "建德市", "滨江区",
                 "临平区", "江干区", "下城区"],
    }
    for city_id, districts in real.items():
        for d in districts:
            t = compute_tier(city_id, d, "一拍")
            assert t in (1, 2), f"city={city_id} {d} 的档位 {t} 不在 (1,2)"


if __name__ == "__main__":
    test_is_main_district_shanghai()
    test_is_main_district_ningbo()
    test_is_main_district_hangzhou()
    test_is_main_district_edge_cases()
    test_compute_tier()
    test_compute_tier_edge_cases()
    test_clusters_cover_real_districts()
    print("OK: district_priority 全部边界用例通过")
