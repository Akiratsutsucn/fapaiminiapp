# 小程序「全部房源」72 小时窗口 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让小程序「全部房源」列表在可参拍房源之外，额外纳入过去 72 小时内结束的房源（所有结束态），超期隐藏；同时全站取消"无可参拍时回退已成交"的兜底。

**Architecture:** 在 `core/auction_status.py` 新增单一事实源：纯函数 `mobile_listable()`（可无 DB 单测）+ SQLAlchemy 表达式 `mobile_listable_sql()`（用于 WHERE），二者口径一致，沿用模块既有的 `effective_status`/`effective_status_sql` 双函数模式。`v1/properties.py` 的列表与详情页改用该函数，地图/推荐改为仅可参拍。

**Tech Stack:** FastAPI + SQLAlchemy(async)，Python 3.12；小程序 TypeScript（内置编译器产出 `.js`）。

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `backend/app/core/auction_status.py` | 新增常量 `RECENT_ENDED_WINDOW_HOURS` + 纯函数 `mobile_listable()` + 表达式 `mobile_listable_sql()` | 修改 |
| `backend/tests/test_mobile_listable.py` | `mobile_listable()` 边界单测（沿用无 pytest 脚本风格） | 创建 |
| `backend/app/api/v1/properties.py` | 列表默认分支、详情 `_mobile_filter()` 改用 `mobile_listable_sql()`；地图/推荐改仅可参拍；删除 `_pick_listing_statuses` | 修改 |
| `miniprogram/utils/format.ts` | 补全 `流拍`/`已撤回` 状态徽章映射 | 修改 |
| `miniprogram/utils/format.js` | 上述 `.ts` 的编译产物 | 修改（编译生成） |

---

## Task 1: 新增 `mobile_listable()` 纯函数 + 常量（含单测）

**Files:**
- Modify: `backend/app/core/auction_status.py`（在 `DEFAULT_STALE_DAYS` 常量附近新增常量；在 `effective_status` 函数之后新增纯函数）
- Test: `backend/tests/test_mobile_listable.py`

- [ ] **Step 1: 写失败的测试**

创建 `backend/tests/test_mobile_listable.py`：

```python
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && PYTHONPATH=backend python -m tests.test_mobile_listable`
Expected: FAIL — `ImportError: cannot import name 'mobile_listable'`（函数和常量尚未定义）

- [ ] **Step 3: 实现常量 + 纯函数**

在 `backend/app/core/auction_status.py` 的 `DEFAULT_STALE_DAYS = 3` 行之后新增常量：

```python
# 小程序「全部房源」额外纳入「过去 N 小时内结束」的房源（含所有结束态：
# 已成交/已结束/流拍/已撤回/中止），让刚结束/刚成交的房源继续停留 N 小时，超期隐藏。
# 按 auction_end_time（计划结束时间）计算窗口（用户 2026-06-11 确认的口径）。
RECENT_ENDED_WINDOW_HOURS = 72
```

在 `effective_status(...)` 函数定义结束后（`return stored or "即将开拍"` 那一行之后、`# ── SQLAlchemy 表达式 ──` 注释之前）新增纯函数：

```python
def mobile_listable(
    stored_status: str | None,
    start_time: datetime | None,
    end_time: datetime | None,
    now: datetime | None = None,
    hours: int = RECENT_ENDED_WINDOW_HOURS,
    stale_days: int = DEFAULT_STALE_DAYS,
    deal_confirmed: bool | None = None,
) -> bool:
    """小程序「全部房源」列表 + 详情页可见性的单一事实源（纯 Python）。

    放行 = 可参拍 OR 近 hours 小时内结束：
      - effective_status ∈ (即将开拍, 进行中)，或
      - end_time 不为空且落在 [now - hours, now] 闭区间内
        （按计划结束时间算，自动涵盖所有结束态：已成交/已结束/流拍/已撤回/中止）。
    与 mobile_listable_sql() 口径严格一致。
    """
    now = now or datetime.now()
    eff = effective_status(
        stored_status, start_time, end_time,
        now=now, stale_days=stale_days, deal_confirmed=deal_confirmed,
    )
    if eff in MOBILE_VISIBLE_STATUSES:
        return True
    if end_time is not None:
        window_start = now - timedelta(hours=hours)
        return window_start <= end_time <= now
    return False
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && PYTHONPATH=backend python -m tests.test_mobile_listable`
Expected: PASS — `mobile_listable 单测全部通过（13 边界用例）`

- [ ] **Step 5: 回归现有 auction_status 单测**

Run: `cd backend && PYTHONPATH=backend python -m tests.test_auction_status`
Expected: PASS — `auction_status 单测全部通过（...）`（确认未破坏既有逻辑）

- [ ] **Step 6: 提交**

```bash
git add backend/app/core/auction_status.py backend/tests/test_mobile_listable.py
git commit -m "feat: 新增mobile_listable纯函数+72h窗口常量(含单测)"
```

---

## Task 2: 新增 `mobile_listable_sql()` 表达式

**Files:**
- Modify: `backend/app/core/auction_status.py`（在 `effective_status_sql()` 函数之后新增）

- [ ] **Step 1: 实现 SQLAlchemy 表达式**

在 `backend/app/core/auction_status.py` 的 `effective_status_sql()` 函数定义结束后（`else_=s,` 的 `)` 之后、`def sold_on_sql` 之前）新增：

```python
def mobile_listable_sql(now: datetime | None = None, hours: int = RECENT_ENDED_WINDOW_HOURS):
    """小程序「全部房源」列表 + 详情页可见性的单一事实源（SQLAlchemy 表达式）。

    与 mobile_listable() 纯函数口径严格一致：
      可参拍(即将开拍/进行中) OR auction_end_time 落在 [now-hours, now] 闭区间内。
    可直接用于 .where()。
    """
    from sqlalchemy import and_, or_
    from ..models.property import Property

    now = now or datetime.now()
    window_start = now - timedelta(hours=hours)
    et = Property.auction_end_time
    return or_(
        effective_status_sql(now).in_(MOBILE_VISIBLE_STATUSES),
        and_(et.isnot(None), et >= window_start, et <= now),
    )
```

- [ ] **Step 2: 验证语法与可导入**

Run: `cd backend && python -c "from app.core.auction_status import mobile_listable_sql; print(type(mobile_listable_sql()))"`
Expected: 打印 `<class 'sqlalchemy.sql.elements.BooleanClauseList'>`（或类似 SQL 表达式类型），无异常

- [ ] **Step 3: 提交**

```bash
git add backend/app/core/auction_status.py
git commit -m "feat: 新增mobile_listable_sql表达式(与纯函数同口径)"
```

---

## Task 3: 列表 `list_properties` 改用窗口函数 + 删除兜底

**Files:**
- Modify: `backend/app/api/v1/properties.py:10-14`（import）、`:81-94`（`_mobile_filter` / `_pick_listing_statuses`）、`:175-184`（状态过滤分支）

- [ ] **Step 1: 更新 import**

把 `backend/app/api/v1/properties.py` 顶部的 import（第 10-14 行）：

```python
from ...core.auction_status import (
    effective_status, effective_status_sql,
    MOBILE_VISIBLE_STATUSES, MOBILE_FALLBACK_STATUSES, MOBILE_DETAIL_STATUSES,
    listed_on_sql, sold_on_sql,
)
```

改为：

```python
from ...core.auction_status import (
    effective_status, effective_status_sql, mobile_listable_sql,
    MOBILE_VISIBLE_STATUSES,
    listed_on_sql, sold_on_sql,
)
```

（移除不再使用的 `MOBILE_FALLBACK_STATUSES`、`MOBILE_DETAIL_STATUSES`。）

- [ ] **Step 2: 改写 `_mobile_filter` 并删除 `_pick_listing_statuses`**

把第 81-94 行：

```python
def _mobile_filter():
    """详情/地图等：允许访问可参拍 + 已成交兜底房源（按实时状态判断）。"""
    return effective_status_sql().in_(MOBILE_DETAIL_STATUSES)


async def _pick_listing_statuses(db, base_conditions) -> tuple:
    """决定列表展示哪组状态：有即将开拍/进行中就用它们，
    否则（该城市/筛选下没有可参拍房源）回退到已成交，避免首页空白。
    注意：按实时计算状态统计，而非库存状态。"""
    primary_q = select(func.count(Property.id)).where(
        and_(*base_conditions, effective_status_sql().in_(MOBILE_VISIBLE_STATUSES))
    )
    primary_count = (await db.execute(primary_q)).scalar() or 0
    return MOBILE_VISIBLE_STATUSES if primary_count > 0 else MOBILE_FALLBACK_STATUSES
```

改为（删除 `_pick_listing_statuses`，`_mobile_filter` 改用窗口函数）：

```python
def _mobile_filter():
    """详情/分析/周边等：可见性跟随「全部房源」列表 = 可参拍 + 近 72h 内结束，
    保证列表里能看到的房源都能点开详情。"""
    return mobile_listable_sql()
```

- [ ] **Step 3: 改写状态过滤默认分支**

把第 175-184 行（`elif statuses:` 与 `else:` 两段）：

```python
    elif statuses:
        valid = [s for s in statuses if s in MOBILE_VISIBLE_STATUSES]
        if valid:
            conditions.append(effective_status_sql().in_(valid))
        else:
            listing_statuses = await _pick_listing_statuses(db, conditions)
            conditions.append(effective_status_sql().in_(listing_statuses))
    else:
        listing_statuses = await _pick_listing_statuses(db, conditions)
        conditions.append(effective_status_sql().in_(listing_statuses))
```

改为：

```python
    elif statuses:
        valid = [s for s in statuses if s in MOBILE_VISIBLE_STATUSES]
        if valid:
            conditions.append(effective_status_sql().in_(valid))
        else:
            # 无有效可参拍状态筛选 → 回落到默认窗口口径（可参拍 + 近72h结束）
            conditions.append(mobile_listable_sql())
    else:
        # 默认：可参拍 + 近72h内结束的房源（取消「无可参拍时兜底已成交」）
        conditions.append(mobile_listable_sql())
```

- [ ] **Step 4: 验证编译通过**

Run: `cd backend && python -c "import ast; ast.parse(open('app/api/v1/properties.py', encoding='utf-8').read()); print('OK')"`
Expected: 打印 `OK`

- [ ] **Step 5: 确认 `_pick_listing_statuses` 已无残留引用**

Run: `cd backend && grep -rn "_pick_listing_statuses" app/`
Expected: 仅 `recommend_properties` 中第 ~259 行还有 1 处引用（Task 4 处理）。其余（旧 180/183 行）应已消失。

- [ ] **Step 6: 提交**

```bash
git add backend/app/api/v1/properties.py
git commit -m "feat: 全部房源列表改用72h窗口口径,详情页跟随,删除列表兜底"
```

---

## Task 4: 推荐区 `recommend_properties` 改为仅可参拍

**Files:**
- Modify: `backend/app/api/v1/properties.py:254-260`（`recommend_properties` 状态条件）

- [ ] **Step 1: 改写推荐区状态条件**

把 `recommend_properties` 中第 254-260 行：

```python
    conditions = []
    if city_id:
        conditions.append(Property.city_id == city_id)
    # 有可参拍房源就推可参拍，否则兜底推已成交（避免首页推荐区空白）。
    # 用实时计算状态筛选，避免推到库存状态过期/抓错的房源。
    listing_statuses = await _pick_listing_statuses(db, conditions)
    conditions.append(effective_status_sql().in_(listing_statuses))
```

改为：

```python
    conditions = []
    if city_id:
        conditions.append(Property.city_id == city_id)
    # 推荐区仅推可参拍房源（即将开拍/进行中）。按用户 2026-06-11 要求全站取消
    # 「无可参拍时兜底已成交」逻辑：宁可推荐区为空也不展示过期成交房。
    conditions.append(effective_status_sql().in_(MOBILE_VISIBLE_STATUSES))
```

- [ ] **Step 2: 验证 `_pick_listing_statuses` 已彻底移除引用**

Run: `cd backend && grep -rn "_pick_listing_statuses\|MOBILE_FALLBACK_STATUSES\|MOBILE_DETAIL_STATUSES" app/api/v1/properties.py`
Expected: 无输出（函数与两个兜底常量在本文件已全部清除）

- [ ] **Step 3: 验证编译通过**

Run: `cd backend && python -c "import ast; ast.parse(open('app/api/v1/properties.py', encoding='utf-8').read()); print('OK')"`
Expected: 打印 `OK`

- [ ] **Step 4: 提交**

```bash
git add backend/app/api/v1/properties.py
git commit -m "feat: 推荐区改为仅推可参拍,取消已成交兜底"
```

---

## Task 5: 地图 `map_markers` 改为仅可参拍

**Files:**
- Modify: `backend/app/api/v1/properties.py:290-306`（`map_markers` 的 WHERE 条件）

**背景：** `map_markers` 原本用 `_mobile_filter()`。Task 3 已把 `_mobile_filter()` 改成含 72h 窗口，但用户要求"地图仅可参拍"，故地图不能再走 `_mobile_filter()`，需直接用 `MOBILE_VISIBLE_STATUSES`。

- [ ] **Step 1: 改写地图查询条件**

把 `map_markers` 中的查询（第 296-305 行）：

```python
    q = (
        select(Property)
        .where(
            Property.city_id == city_id,
            Property.lat.isnot(None),
            Property.lng.isnot(None),
            _mobile_filter(),
        )
        .limit(200)
    )
```

改为：

```python
    q = (
        select(Property)
        .where(
            Property.city_id == city_id,
            Property.lat.isnot(None),
            Property.lng.isnot(None),
            # 地图仅展示可参拍房源（不含近72h结束的）——窗口仅作用于「全部房源」列表。
            effective_status_sql().in_(MOBILE_VISIBLE_STATUSES),
        )
        .limit(200)
    )
```

- [ ] **Step 2: 验证编译通过**

Run: `cd backend && python -c "import ast; ast.parse(open('app/api/v1/properties.py', encoding='utf-8').read()); print('OK')"`
Expected: 打印 `OK`

- [ ] **Step 3: 确认 `_mobile_filter()` 仍被详情类端点使用（不可误删）**

Run: `cd backend && grep -n "_mobile_filter" app/api/v1/properties.py`
Expected: 仍有 3 处调用（`get_property`、`property_district_analysis`、`property_amenities`）+ 1 处定义。地图那处应已消失。

- [ ] **Step 4: 提交**

```bash
git add backend/app/api/v1/properties.py
git commit -m "feat: 地图标记改为仅展示可参拍房源"
```

---

## Task 6: 端到端验证（SQLite 内存库构造房源跑列表）

**Files:**
- Test: `backend/tests/test_recent_window_e2e.py`（创建，临时端到端验证，跑通后保留为回归测试）

- [ ] **Step 1: 写端到端测试**

创建 `backend/tests/test_recent_window_e2e.py`：

```python
"""端到端验证 72h 窗口的 SQL 条件（用 SQLite 内存库）。

无需外部 DB，可直接运行：
    PYTHONPATH=backend python -m tests.test_recent_window_e2e
"""
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from sqlalchemy import select, func, and_  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession  # noqa: E402

from app.core.database import Base  # noqa: E402
from app.models.property import Property  # noqa: E402
from app.core.auction_status import mobile_listable_sql  # noqa: E402

_NOW = datetime(2026, 6, 11, 12, 0)
_H = timedelta(hours=1)


async def _run():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    rows = [
        # (title, status, start, end, 期望进入列表?)
        ("即将开拍", "即将开拍", _NOW + 2 * _H, _NOW + 5 * _H, True),
        ("进行中", "进行中", _NOW - 2 * _H, _NOW + 2 * _H, True),
        ("71h前成交", "已成交", _NOW - 71 * _H, _NOW - 71 * _H, True),
        ("50h前流拍", "流拍", _NOW - 50 * _H, _NOW - 50 * _H, True),
        ("73h前成交", "已成交", _NOW - 73 * _H, _NOW - 73 * _H, False),
        ("成交缺end", "已成交", None, None, False),
    ]
    async with AsyncSession(engine) as db:
        for i, (title, st, s, e, _) in enumerate(rows, 1):
            db.add(Property(
                id=i, title=title, city_id=310000, auction_status=st,
                auction_start_time=s, auction_end_time=e,
                source_url=f"https://example.com/p/{i}",  # unique，nullable=False 必填
            ))
        await db.commit()

        q = select(Property.title).where(mobile_listable_sql(now=_NOW))
        visible = {r[0] for r in (await db.execute(q)).all()}

    await engine.dispose()

    expected = {title for (title, *_rest, ok) in rows if ok}
    assert visible == expected, f"窗口结果不符：得到 {visible}，期望 {expected}"
    print(f"72h窗口端到端验证通过：列表可见 {sorted(visible)}")


def test_recent_window_e2e():
    asyncio.run(_run())


if __name__ == "__main__":
    test_recent_window_e2e()
```

- [ ] **Step 2: 确认 aiosqlite 可用**

Run: `cd backend && python -c "import aiosqlite; print('aiosqlite ok')"`
Expected: 打印 `aiosqlite ok`。若 ImportError，先 `pip install aiosqlite`（仅测试依赖）。

- [ ] **Step 3: 确认 `Base` 与 `Property` 可导入**

Run: `cd backend && python -c "from app.core.database import Base; from app.models.property import Property; print('imports ok')"`
Expected: 打印 `imports ok`（已确认 `Base` 定义于 `app/core/database.py:26`）。

- [ ] **Step 4: 运行端到端测试确认通过**

Run: `cd backend && PYTHONPATH=backend python -m tests.test_recent_window_e2e`
Expected: PASS — `72h窗口端到端验证通过：列表可见 ['50h前流拍', '71h前成交', '即将开拍', '进行中']`

- [ ] **Step 5: 提交**

```bash
git add backend/tests/test_recent_window_e2e.py
git commit -m "test: 72h窗口SQLite端到端回归测试"
```

---

## Task 7: 前端状态徽章映射补全

**Files:**
- Modify: `miniprogram/utils/format.ts:72-95`（`statusLabel` + `statusTagClass`）
- Modify: `miniprogram/utils/format.js`（编译产物，随 `.ts` 重新生成）

- [ ] **Step 1: 补全 `statusLabel` 与 `statusTagClass`**

把 `miniprogram/utils/format.ts` 第 72-95 行：

```typescript
/** 拍卖状态标签文字 */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    '即将开拍': '即将开拍',
    '进行中': '正在拍卖',
    '已结束': '已结束',
    '已成交': '已成交',
    '中止': '中止',
    '撤回': '撤回',
  };
  return map[status] || status;
}

/** 拍卖状态标签样式类 */
export function statusTagClass(status: string): string {
  const map: Record<string, string> = {
    '即将开拍': 'tag-blue',
    '进行中': 'tag-red',
    '已结束': 'tag-red',
    '已成交': 'tag-green',
    '中止': 'tag-orange',
    '撤回': 'tag-orange',
  };
  return map[status] || 'tag-blue';
}
```

改为（补 `流拍`、`已撤回`，保留旧 `撤回` 兼容）：

```typescript
/** 拍卖状态标签文字 */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    '即将开拍': '即将开拍',
    '进行中': '正在拍卖',
    '已结束': '已结束',
    '已成交': '已成交',
    '流拍': '流拍',
    '已撤回': '已撤回',
    '中止': '中止',
    '撤回': '撤回',
  };
  return map[status] || status;
}

/** 拍卖状态标签样式类 */
export function statusTagClass(status: string): string {
  const map: Record<string, string> = {
    '即将开拍': 'tag-blue',
    '进行中': 'tag-red',
    '已结束': 'tag-red',
    '已成交': 'tag-green',
    '流拍': 'tag-orange',
    '已撤回': 'tag-orange',
    '中止': 'tag-orange',
    '撤回': 'tag-orange',
  };
  return map[status] || 'tag-blue';
}
```

- [ ] **Step 2: 同步编译产物 `format.js`**

`miniprogram/utils/format.js` 是 `.ts` 的编译产物。在 `.js` 中找到对应的两个 map 对象（`statusLabel` / `statusTagClass`），同样补入 `'流拍'` 与 `'已撤回'` 两个键（值同上：label 为 `'流拍'`/`'已撤回'`，class 均为 `'tag-orange'`）。保持与 `.ts` 完全一致。

> 说明：若本机装有微信开发者工具的 CLI 或 tsc，可直接重新编译生成 `.js`；否则按上一句手工同步该文件的两个 map。

- [ ] **Step 3: 验证 `.ts` 与 `.js` 一致**

Run: `cd "miniprogram/utils" && grep -c "流拍\|已撤回" format.ts format.js`
Expected: `format.ts` 与 `format.js` 均输出 `2`（各含「流拍」「已撤回」两处）

- [ ] **Step 4: 提交**

```bash
git add miniprogram/utils/format.ts miniprogram/utils/format.js
git commit -m "feat(mp): 状态徽章补全流拍/已撤回映射"
```

---

## Task 8: 部署与真实验证

**Files:** 无代码改动，部署 + 验证。

- [ ] **Step 1: 后端热部署**

按项目既定流程（参考记忆 `project_backend_deploy_and_mp_visibility.md`）：把改动的 `auction_status.py`、`v1/properties.py` 同步到生产 `/opt/fapai/`，校验 `compile()` 通过，按属主 `www-data` 部署，重启后端服务（端口 25081）。

- [ ] **Step 2: 线上接口验证**

```bash
# 全部房源列表（默认）：应含可参拍 + 近72h结束的房源
curl -s "https://xcxapi.fapaizhelianmeng.cn/api/v1/properties?city_id=310000&page_size=50" | python -c "import sys,json; d=json.load(sys.stdin); from collections import Counter; print('total=',d['total']); print(Counter(i['auction_status'] for i in d['items']))"
```
Expected: 状态分布里出现「已成交/已结束」等结束态（证明 72h 房源进来了），且总数 > 0。

- [ ] **Step 3: 详情页可点开验证**

从 Step 2 返回里挑一个「已成交/已结束」房源的 id，`curl GET /api/v1/properties/{id}`，Expected: 返回 200（可点开），而非 404。再挑一个明显超 72h 的（若能构造）确认 404。

- [ ] **Step 4: 地图仅可参拍验证**

```bash
curl -s "https://xcxapi.fapaizhelianmeng.cn/api/v1/properties/map-markers?city_id=310000" | python -c "import sys,json; d=json.load(sys.stdin); from collections import Counter; print(Counter(i['auction_status'] for i in d))"
```
Expected: 仅含「即将开拍/进行中」。

- [ ] **Step 5: 首页统计未受影响**

```bash
curl -s "https://xcxapi.fapaizhelianmeng.cn/api/v1/common/market-stats?city_id=310000"
```
Expected: 字段与改前一致（upcoming/yesterday_listed/yesterday_sold 口径不变）。

- [ ] **Step 6: 小程序端验证**

微信开发者工具重新编译上传，「全部房源」列表确认能看到「已成交/已结束/流拍」徽章正常渲染（颜色：成交绿、结束红、流拍/撤回橙），点进详情页正常打开。

- [ ] **Step 7: 更新记忆**

在记忆目录新增/更新一条 `project` 记忆，记录 72h 窗口口径（按 auction_end_time 计算、仅作用于全部房源列表+详情、地图推荐仅可参拍、全站取消兜底、market-stats 不受影响），并在 `MEMORY.md` 加索引行。

---

## 自查结论

- **Spec 覆盖**：目标 1（纳入 72h 内结束）→ Task 1-3；目标 2（超期隐藏）→ 窗口闭区间 + Task 6 验证；目标 3（DB 长期保存）→ 全程只改 WHERE，无删除/无迁移；目标 4（全站取消兜底）→ Task 3（列表）+ Task 4（推荐）+ Task 5（地图）。详情页跟随列表 → Task 3 改 `_mobile_filter`。前端徽章缺口 → Task 7。
- **占位符**：无 TBD/TODO，所有代码步骤含完整代码。
- **类型一致**：`mobile_listable()`（纯函数，bool）与 `mobile_listable_sql()`（表达式）命名/口径一致；`RECENT_ENDED_WINDOW_HOURS` 全程统一；`_mobile_filter()` 改造后被详情类端点复用、地图改为直接 `MOBILE_VISIBLE_STATUSES`，无悬空引用。
