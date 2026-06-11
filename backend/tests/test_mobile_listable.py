"""mobile_listable 单一事实源的边界单测（小程序「全部房源」72h 窗口）。

无需 DB / pytest，可直接运行：
    PYTHONPATH=backend python -m tests.test_mobile_listable      # 从 backend 目录
或被 pytest 收集（test_* 命名）。
"""
from datetime import datetime, timedelta

import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.core.auction_status import mobile_listable, RECENT_ENDED_WINDOW_HOURS  # noqa: E402

_NOW = datetime(2026, 6, 11, 12, 0)
_H = timedelta(hours=1)

# (stored, start, end, deal_confirmed, expected, 说明)
_CASES = [
    # 可参拍：永远放行
    ("即将开拍", _NOW + 2 * _H, _NOW + 5 * _H, None, True, "即将开拍→放行"),
    ("进行中", _NOW - 2 * _H, _NOW + 2 * _H, None, True, "进行中→放行"),
    # 近 72h 内结束：放行（不论结果态）
    ("已成交", _NOW - 71 * _H, _NOW - 71 * _H, None, True, "71h前结束(平台标已成交)→放行"),
    ("已成交", _NOW - 10 * _H, _NOW - 10 * _H, True, True, "10h前结束+成交确认书→放行"),
    ("已结束", _NOW - 71 * _H, _NOW - 71 * _H, None, True, "71h前结束(中性已结束)→放行"),
    ("流拍", _NOW - 50 * _H, _NOW - 50 * _H, None, True, "50h前流拍→放行"),
    ("已撤回", _NOW - 50 * _H, _NOW - 50 * _H, None, True, "50h前已撤回→放行"),
    ("中止", _NOW - 50 * _H, _NOW - 50 * _H, None, True, "50h前中止→放行"),
    # 超 72h：隐藏
    ("已成交", _NOW - 73 * _H, _NOW - 73 * _H, None, False, "73h前结束→隐藏"),
    ("已结束", _NOW - 100 * _H, _NOW - 100 * _H, None, False, "100h前结束→隐藏"),
    # 边界：恰好 72h 整 → 放行（闭区间）
    ("已成交", _NOW - 72 * _H, _NOW - 72 * _H, None, True, "恰好72h整→放行(闭区间)"),
    # 缺 end_time 的非可参拍房源 → 不进窗口
    ("已成交", None, None, None, False, "成交但缺end_time→不进窗口"),
    ("已结束", None, None, None, False, "已结束但缺end_time→不进窗口"),
]


def test_mobile_listable_boundaries():
    for stored, s, e, dc, exp, desc in _CASES:
        got = mobile_listable(stored, s, e, now=_NOW, deal_confirmed=dc)
        assert got == exp, f"{desc}: stored={stored!r} start={s} end={e} -> {got!r}, expect {exp!r}"


def test_window_hours_constant():
    assert RECENT_ENDED_WINDOW_HOURS == 72


if __name__ == "__main__":
    test_mobile_listable_boundaries()
    test_window_hours_constant()
    print(f"mobile_listable 单测全部通过（{len(_CASES)} 边界用例）")
