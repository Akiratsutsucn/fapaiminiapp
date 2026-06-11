"""mine_appraisal_price 评估价正文兜底单测。无需DB/pytest,可直接跑:
    cd crawler && python -m tests.test_field_miner_appraisal
"""
import sys
from pathlib import Path

_CRAWLER = Path(__file__).resolve().parent.parent
if str(_CRAWLER) not in sys.path:
    sys.path.insert(0, str(_CRAWLER))

from cleaners.field_miner import mine_appraisal_price  # noqa: E402

_CASES = [
    ("经评估,该房产评估价为350万元", 3_500_000, "评估价为X万元"),
    ("房屋评估价值：280.5万元", 2_805_000, "评估价值X万"),
    ("评估单价不计,市场价约500万元", 5_000_000, "市场价X万"),
    ("起拍价300万元,保证金30万元", 0, "无评估价表述→0(不被起拍价误命中)"),
    ("评估总价人民币12,000,000元", 12_000_000, "带千分位的元"),
    ("", 0, "空文本→0"),
]


def test_mine_appraisal_price():
    for text, expect, desc in _CASES:
        got = mine_appraisal_price(text)
        assert got == expect, f"{desc}: {text!r} -> {got}, expect {expect}"


if __name__ == "__main__":
    test_mine_appraisal_price()
    print(f"mine_appraisal_price 单测通过({len(_CASES)} 例)")
