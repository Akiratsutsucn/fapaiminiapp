"""upsert 字段更新策略单测:动态字段强刷(含变空)、静态字段保留旧值。
无需DB,测纯函数 build_update_data。从项目根运行:
    python -m crawler.tests.test_upsert_policy
"""
import sys
from pathlib import Path

# 以完整包路径导入(repository.py 内部用 ..models 相对导入,需 crawler 作为包的上级在 path)
_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from crawler.storage.repository import build_update_data, DYNAMIC_FIELDS  # noqa: E402


def test_dynamic_field_overwrites_even_if_empty():
    # 动态字段:新值为0/None也覆盖(反映下架/清零)
    new = {"starting_price": 0, "auction_status": "已撤回"}
    out = build_update_data(new)
    assert out["starting_price"] == 0, "动态字段新值0应覆盖"
    assert out["auction_status"] == "已撤回"


def test_static_field_kept_when_new_is_empty():
    # 静态字段:新值为None/0/""时不进 update_data(保留旧值)
    new = {"area": None, "orientation": None, "layout": ""}
    out = build_update_data(new)
    assert "area" not in out, "静态字段新值空→不覆盖"
    assert "orientation" not in out
    assert "layout" not in out


def test_static_field_overwrites_when_new_nonempty():
    new = {"area": 88.5, "orientation": "南"}
    out = build_update_data(new)
    assert out["area"] == 88.5
    assert out["orientation"] == "南"


def test_image_urls_excluded():
    new = {"image_urls": ["a.jpg"], "starting_price": 100}
    out = build_update_data(new)
    assert "image_urls" not in out


def test_dynamic_fields_membership():
    # 价格/状态/时间类应在动态集合
    for f in ("starting_price", "auction_status", "auction_end_time", "final_deal_price"):
        assert f in DYNAMIC_FIELDS, f"{f} 应属动态字段"


if __name__ == "__main__":
    test_dynamic_field_overwrites_even_if_empty()
    test_static_field_kept_when_new_is_empty()
    test_static_field_overwrites_when_new_nonempty()
    test_image_urls_excluded()
    test_dynamic_fields_membership()
    print("upsert 字段策略单测全部通过")
