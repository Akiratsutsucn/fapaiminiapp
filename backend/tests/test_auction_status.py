"""auction_status 单一事实源的边界单测。

无需 DB / pytest，可直接运行：
    PYTHONPATH=backend python -m tests.test_auction_status      # 从 backend 目录
或被 pytest 收集（test_* 命名）。覆盖：上海消失 bug 的核心场景、反向修正、
结果态保留、缺时间兜底等。
"""
from datetime import datetime, timedelta

import sys
from pathlib import Path

# 允许从 backend 目录直接 `python -m tests.test_auction_status` 运行
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.core.auction_status import effective_status, RESULT_STATES  # noqa: E402

_NOW = datetime(2026, 6, 2, 12, 0)
_D = timedelta(days=1)

# (stored, start, end, expected, 说明)
_CASES = [
    ("已结束", _NOW - _D, _NOW + _D, "进行中", "核心bug：end未到→进行中"),
    ("即将开拍", _NOW - 2 * _D, _NOW - _D, "已结束", "end已过→已结束"),
    ("进行中", _NOW + _D, _NOW + 2 * _D, "即将开拍", "start未到→即将开拍"),
    ("已成交", _NOW - 2 * _D, _NOW - _D, "已成交", "结果态保留(成交)"),
    ("已撤回", _NOW - _D, _NOW + _D, "已撤回", "结果态保留(撤回,即使在时间窗内)"),
    ("中止", _NOW - _D, _NOW + _D, "中止", "结果态保留(中止)"),
    ("流拍", _NOW - 2 * _D, _NOW - _D, "流拍", "结果态保留(流拍)"),
    ("进行中", None, None, "进行中", "无时间→保留存储值"),
    ("", None, None, "即将开拍", "空+无时间→兜底即将开拍"),
    ("即将开拍", _NOW - 5 * _D, None, "已结束", "过开拍缺end+超3天→已结束"),
    ("即将开拍", _NOW - 2 * _D, None, "进行中", "过开拍缺end+未超3天→进行中"),
    ("已结束", _NOW + _D, _NOW + 2 * _D, "即将开拍", "反向修正：误存已结束但未开拍"),
]


def test_effective_status_boundaries():
    for stored, s, e, exp, desc in _CASES:
        got = effective_status(stored, s, e, now=_NOW)
        assert got == exp, f"{desc}: stored={stored!r} -> {got!r}, expect {exp!r}"


def test_result_states_always_preserved():
    """结果态在任意时间窗下都原样保留。"""
    for st in RESULT_STATES:
        for s, e in [(_NOW - _D, _NOW + _D), (_NOW + _D, _NOW + 2 * _D), (None, None)]:
            assert effective_status(st, s, e, now=_NOW) == st


if __name__ == "__main__":
    test_effective_status_boundaries()
    test_result_states_always_preserved()
    print(f"auction_status 单测全部通过（{len(_CASES)} 边界用例 + 结果态保留）")
