# 小程序「全部房源」72 小时刚结束/刚成交窗口 — 设计文档

日期：2026-06-11
分支：feature/v4-round5-spec

## 1. 背景与目标

### 现状
小程序「全部房源」列表只展示可参拍房源（`MOBILE_VISIBLE_STATUSES = (即将开拍, 进行中)`）。所有状态由 `core/auction_status.py` 按 `auction_start_time/end_time` + 当前时间**实时计算**，不信任库里抓到的文本状态。结果态（已成交/已撤回/中止/流拍）和成交确认书铁证（`deal_confirmed`）原样保留、不被时间覆盖。

当某城市/筛选下没有任何可参拍房源时，列表/推荐区会**兜底回退展示已成交**（`MOBILE_FALLBACK_STATUSES`），避免页面空白。

### 目标
1. 「全部房源」列表在可参拍房源之外，**额外纳入过去 72 小时内结束的房源**（含所有结束态：已成交、已结束、流拍、已撤回、中止），让"今天刚成交/刚结束"的房源继续停留 72 小时。
2. 结束/成交**超过 72 小时**的房源在小程序端隐藏不展示。
3. 已成交/已结束房源在**数据库中长期保存**，本功能只改查询条件，绝不删数据。
4. **全站取消兜底逻辑**：列表、推荐区、地图不再"无可参拍时回退已成交"。

### 用户已确认的边界
- **时间基准**：按 `auction_end_time`（计划结束时间）计算 72 小时窗口。
- **窗口范围**：仅「全部房源」列表；详情页被动跟随列表（保证列表项可点开）；地图/推荐仅展示可参拍。
- **结束态范围**：所有结束态（已成交 + 已结束 + 流拍 + 已撤回 + 中止）。
- **兜底**：全站取消。

## 2. 「已成交」判断依据（澄清记录）

后端判定"已成交"不靠时间推算，只认两个铁证来源（优先级从高到低）：
1. **成交确认书**：`deal_confirmed = True`（爬虫从平台附件识别出"成交确认书"PDF）。优先级压倒一切，连时间窗都不看（`auction_status.py:72`、SQL case 分支 0）。
2. **平台明确告知**：`auction_status` 落在 `RESULT_STATES = (已成交, 已撤回, 中止, 流拍)`，原样保留不被时间覆盖（`auction_status.py:76`）。

**时间到了 ≠ 已成交**：`auction_end_time` 过了但无确认书、平台未标结果的房源只算"已结束"（中性态），不算已成交。
**成交日期**取 `online_auction_end_time`（成交确认书 PDF 解析的真实落槌时刻）优先，空则回退 `auction_end_time`。

## 3. 方案选择

**采用方案 A：在 `core/auction_status.py` 新增单一事实源函数 `mobile_listable_sql()`。**

理由：项目历史多次吃过"多处 SQL 口径漂移"的亏（见模块内注释）。把窗口逻辑收敛到 `auction_status.py` 单一函数，列表和详情页共同引用，常量集中一处。不污染 `effective_status` 语义（后台管理和数据看板仍依赖它），其他入口零影响。

否决的方案：
- 方案 B（内联到 `list_properties`）：详情页要复制逻辑，两处易漂移。
- 方案 C（定时任务打窗口标记）：72h 是滑动窗口，定时任务引入延迟和过度复杂度。

## 4. 详细设计

### 4.1 新增核心函数（`backend/app/core/auction_status.py`）

```python
# 新增常量
RECENT_ENDED_WINDOW_HOURS = 72  # 刚结束/刚成交房源在小程序「全部房源」额外停留时长

def mobile_listable_sql(now=None, hours=RECENT_ENDED_WINDOW_HOURS):
    """小程序「全部房源」列表 + 详情页可见性的单一事实源。

    放行条件 = 可参拍 OR 近 N 小时内结束：
      - effective_status ∈ (即将开拍, 进行中)，或
      - auction_end_time 不为空 且 落在 [now - hours, now] 区间内
        （按计划结束时间算，自动涵盖所有结束态：已成交/已结束/流拍/已撤回/中止）
    """
    from sqlalchemy import and_, or_
    from ..models.property import Property
    now = now or datetime.now()
    window_start = now - timedelta(hours=hours)
    return or_(
        effective_status_sql(now).in_(MOBILE_VISIBLE_STATUSES),
        and_(
            Property.auction_end_time.isnot(None),
            Property.auction_end_time >= window_start,
            Property.auction_end_time <= now,
        ),
    )
```

说明：第二段不依赖 `effective_status`，直接按 `auction_end_time` 时间窗判断，因此无论房源最终被算成"已结束"还是"已成交"（含确认书铁证），只要计划结束时刻落在过去 72h 内就放行。

### 4.2 各入口改动对照表

| 入口 | 函数/位置 | 改动前 | 改动后 |
|------|----------|--------|--------|
| 全部房源列表 | `v1/properties.py: list_properties` | `_pick_listing_statuses` 可参拍/兜底已成交 | 默认分支改用 `mobile_listable_sql()`，**删除兜底** |
| 详情页 | `v1/properties.py: get_property` 经 `_mobile_filter()` | `effective_status_sql().in_(MOBILE_DETAIL_STATUSES)` | `_mobile_filter()` 改为返回 `mobile_listable_sql()`，详情页可点开列表里的所有房源 |
| 详情子资源 | `analysis` / `amenities` 经 `_mobile_filter()` | 同上 | 跟随 `_mobile_filter()` 自动变更 |
| 地图 | `v1/properties.py: map_markers` 经 `_mobile_filter()` | 含已成交兜底 | **改为仅可参拍** `effective_status_sql().in_(MOBILE_VISIBLE_STATUSES)`（不能再用 `_mobile_filter`，因其已含 72h 窗口） |
| 推荐区 | `v1/properties.py: recommend_properties` | 可参拍/兜底已成交 | **改为仅可参拍**，删除 `_pick_listing_statuses` 调用 |
| 首页统计 market-stats | `v1/common.py` | 昨日成交/上架独立口径 | **不动** |
| 数据看板 | `admin/dashboard.py` | 独立口径 | **不动** |
| 用户统计/需求匹配 | `v1/users.py` / `admin/demands.py` | 仅可参拍 | **不动** |

注意：`map_markers` 当前用 `_mobile_filter()`，而 `_mobile_filter()` 改造后会含 72h 窗口；为满足"地图仅可参拍"，`map_markers` 需改为直接用 `MOBILE_VISIBLE_STATUSES`，不再走 `_mobile_filter()`。

### 4.3 列表筛选逻辑调整（`list_properties`）

`auction_status` 显式多选筛选、`sold_day=yesterday`、`listed_day=yesterday` 这些专用入口的口径**保持不变**（它们与首页 market-stats 强绑定）。只改"无显式状态筛选"的默认分支：

```python
# 改动前（默认分支）：
listing_statuses = await _pick_listing_statuses(db, conditions)
conditions.append(effective_status_sql().in_(listing_statuses))

# 改动后：
conditions.append(mobile_listable_sql())
```

`_pick_listing_statuses` 在 `list_properties` 默认分支和 `recommend_properties` 都被移除后，若无其他引用则一并删除（保持代码整洁）。`auction_status` 显式筛选分支里 `valid` 为空时原本也调用 `_pick_listing_statuses` 兜底，改为 `mobile_listable_sql()`。

### 4.4 前端改动（小程序）

后端列表现在会返回新的结束态（已结束/流拍/已撤回/中止），前端状态徽章映射需补全：

`miniprogram/utils/format.ts`：
- `statusLabel` 缺 `流拍`、`已撤回`（现有"撤回"key 不匹配后端"已撤回"）。补全：`流拍 → 流拍`、`已撤回 → 已撤回`。
- `statusTagClass` 同步补 `流拍 → tag-orange`、`已撤回 → tag-orange`。

`.ts` 改完需编译出 `.js`（项目用内置 TS 编译器，`.js` 是产物）。

`property-list` 页面：默认列表已能渲染多种状态徽章，无需改筛选 UI（用户未要求新增状态筛选项）。

### 4.5 数据库

**零改动**。已成交/已结束房源本就长期保存。本功能只改查询 WHERE 条件，不新增字段、不删数据、不需要 alembic 迁移。

## 5. 测试策略

### 单元测试（后端，扩展 `tests/test_auction_status.py`）
为 `mobile_listable_sql` 的等价纯函数逻辑或通过构造记录验证以下场景（按 `auction_end_time` 相对 now 的位置）：
1. 即将开拍（start > now）→ 放行
2. 进行中（start ≤ now ≤ end）→ 放行
3. 71 小时前结束的已成交（deal_confirmed=True）→ 放行
4. 71 小时前结束的已结束（无确认书）→ 放行
5. 71 小时前结束的流拍/已撤回/中止 → 放行
6. 73 小时前结束的任何结束态 → **不放行**
7. `auction_end_time` 为空的房源 → 不进窗口（仅当可参拍才放行）
8. 边界：恰好 72 小时整 → 放行（闭区间）

由于现有 `tests/` 是无 pytest 依赖的手写脚本风格，新测试沿用同一风格，能 `python tests/test_xxx.py` 直接跑并断言。验证 SQL 表达式建议用 SQLite 内存库构造少量房源端到端跑 `list_properties` 的 WHERE 条件。

### 手工/集成验证
- 本地起后端，构造覆盖上述场景的房源，调 `GET /api/v1/properties` 确认返回集合正确。
- 调 `GET /api/v1/properties/{id}` 确认 72h 内结束的房源能打开、超 72h 的返回 404。
- 调 `GET /api/v1/properties/map-markers` 确认只含可参拍。
- 确认 market-stats / dashboard 数字不受影响。

## 6. 已知局限
1. **成交确认书延迟**：成交确认书可能在结拍数天后才被爬虫抓到。若某房 `auction_end_time` 已过 72h 才抓到确认书，它不会以"已成交"身份回到列表（因窗口按计划结束时间算）。属数据延迟的天然限制。
2. **缺 `auction_end_time` 的成交房**：极少数成交但 `auction_end_time` 为空的房源无法进入窗口。
3. 窗口按 `auction_end_time`（计划结束）而非真实落槌 `online_auction_end_time`，是用户明确选择（口径更简单、覆盖更全）。

## 7. 影响面小结
- 改动文件：`backend/app/core/auction_status.py`（新增函数+常量）、`backend/app/api/v1/properties.py`（列表/详情/地图/推荐）、`miniprogram/utils/format.ts`（+产物 `.js`）。
- 不动：market-stats、dashboard、users、demands、数据库 schema、爬虫。
- 部署：后端热部署（改 .py 即时生效流程）；小程序需重新编译上传。
