# 房源平台标签 + 头条捡漏主城区排序 设计稿

**日期**：2026-06-05
**作者**：本轮第四轮甲方需求
**状态**：已确认

## 1. 背景

甲方第四轮提出两条需求：

1. **房源出处可见**：每套房源卡片需明示来源平台（阿里拍卖 / 京东拍卖 / 公拍网），用于客户验证房源真实性。库里 `auction_platform` 字段已规整为这三类（889 + 1253 + 987 全覆盖），仅缺前端渲染。
2. **头条捡漏排序优化**：主城区房源前置、变卖压后；同档内按开拍时间升序（已开拍/今天开拍优先，催客户行动）。

## 2. 需求 1：平台标签

### 2.1 数据来源

后端 `Property.auction_platform` 字段已存在且值规整：

| 库值 | 标签文字 | 描边/文字色 |
|---|---|---|
| `阿里拍卖` | 阿里拍卖 | `#FF6A00`（阿里橙） |
| `京东拍卖` | 京东拍卖 | `#E1251B`（京东红） |
| `公拍网` | 公拍网 | `#3D5C7C`（公拍蓝灰） |
| 其它（如 `人工录入`） | 不显示 | — |

### 2.2 视觉规范

- 浅色描边小标签，描边和文字同色，**不填充背景**
- 字号 20rpx
- 内边距 4rpx 8rpx
- 圆角 4rpx
- 描边宽度 1rpx
- 位置：house-card 价格行右下角，评估价"--万"右侧

### 2.3 生效范围

所有用 `<house-card>` 组件渲染的页面：
- 首页头条捡漏
- 房源列表页
- 我的→收藏 / 历史 / 推荐
- 详情页相关推荐

改一处全员生效，零业务副作用。

### 2.4 实现要点

- house-card 已经从 PropertyItem 接收 `auction_platform`（typings.d.ts:48 已声明），数据全在
- 在 wxml 价格行（`.card-price-row`）末尾加 `<view class="platform-tag platform-{{platformKey}}" wx:if="{{platformKey}}">`
- ts 里把 `auction_platform` 库值映射成 css 短 key：阿里→`ali`、京东→`jd`、公拍网→`gpai`，其它→空串（不显示）

## 3. 需求 2：头条捡漏 + 列表页默认排序

### 3.1 排序逻辑（4 档）

| 档位 | 主城/郊区 | 拍卖轮次 | 例子 |
|---|---|---|---|
| 1（最前） | 主城 | 一拍 / 二拍 | 浦东一拍 |
| 2 | 郊区 | 一拍 / 二拍 | 松江一拍 |
| 3 | 主城 | 变卖 | 静安变卖 |
| 4（最后） | 郊区 | 变卖 | 崇明变卖 |

**第二原则**：开拍时间 `auction_start_time` 升序（早开拍/已开拍优先），缺时间值排最后。

**第三原则**（兜底）：`created_at DESC`（新抓的房源优先），保证排序稳定。

### 3.2 主城区清单

```python
MAIN_DISTRICTS_BY_CITY = {
    310000: ["黄浦区", "静安区", "徐汇区", "长宁区", "普陀区",
             "虹口区", "杨浦区", "浦东新区", "闵行区"],
    330200: ["海曙区", "江北区", "鄞州区", "镇海区", "北仑区"],
    330100: ["上城区", "拱墅区", "西湖区", "滨江区",
             "钱塘区", "江干区", "下城区"],
}
```

注：宁波镇海/北仑库里目前无数据，但写进清单，后续抓取出现自动归主城。杭州下城区是历史已并入拱墅的旧区名，库里仍有 4 套历史数据，归主城。

### 3.3 生效范围

- **`/api/v1/properties/recommend`**（首页头条捡漏）：始终应用 4 档排序
- **`/api/v1/properties`**（列表页）：仅当 `sort_by` 未传或为 `default` 时套用 4 档排序。用户主动点"起拍价/评估价/面积"按钮时按字段排序，不叠加主城优先

### 3.4 实现要点

- 新建 `backend/app/core/district_priority.py`：
  - 暴露常量 `MAIN_DISTRICTS_BY_CITY`
  - 暴露纯函数 `is_main_district(city_id, district) -> bool`（脚本/解析器可用）
  - 暴露 `tier_sql_expr()` 返回 1/2/3/4 的 SQLAlchemy `case()` 表达式（WHERE / ORDER BY 用）
- `properties.py:recommend_properties` 排序改为：`tier ASC, auction_start_time NULLS LAST ASC, created_at DESC`
- `properties.py:list_properties` 在 `sort_by is None` 时套同样规则
- 单元测试：`backend/tests/test_district_priority.py` 覆盖三城主城/郊区/未知 district、各种 round 组合

## 4. 涉及修改清单

### 后端（4 文件）

| 文件 | 类型 | 说明 |
|---|---|---|
| `backend/app/core/district_priority.py` | 新增 | 主城清单 + tier_sql_expr() |
| `backend/app/api/v1/properties.py` | 改 | recommend / list_properties 排序 + 构造 PropertyListItem 时补传 auction_platform |
| `backend/tests/test_district_priority.py` | 新增 | 边界单测 |
| `backend/app/schemas/__init__.py` | 改 | PropertyListItem 加 `auction_platform: str = ""` 字段（PropertyDetail 已有，PropertyListItem 漏了，前端 typings 声明但接口实际无此字段） |

### 小程序（4 文件）

| 文件 | 类型 |
|---|---|
| `miniprogram/components/house-card/house-card.ts` | 改 observers |
| `miniprogram/components/house-card/house-card.js` | 同步 |
| `miniprogram/components/house-card/house-card.wxml` | 加 platform-tag |
| `miniprogram/components/house-card/house-card.wxss` | 加 .platform-tag 系列样式 |

## 5. 部署

- backend：scp 上传 → 备份 → sudo cp → 重启 fapai-backend.service → 健康验证
- 小程序：用户在微信开发者工具上传体验版

## 6. 验证清单

1. backend 单元测试：`is_main_district` + tier 边界全过
2. 生产实测 `/api/v1/properties/recommend?city_id=310000`：前 6 套全部为主城非变卖（库里上海主城非变卖 ≥ 6 套）
3. 列表页 `sort_by` 为空：第一页前 N 套是主城非变卖优先
4. 列表页 `sort_by=starting_price`：严格按起拍价升序，不再叠主城优先
5. 卡片渲染：3 个平台各抽 1 套，视觉描边色对（jd 红 / ali 橙 / gpai 蓝灰）
6. 首页 home-summary、market-stats 数字不变（本轮不改口径）

## 7. 不改的事

- 库表结构不动（`auction_platform` + `district` 字段都已就位）
- 老 commit 的口径修复（home-summary 三城限定、sold_day 仅成交、listed_day 独立分支）保留
- 其它接口（地图、详情、推荐房源给客户那个）排序不变
