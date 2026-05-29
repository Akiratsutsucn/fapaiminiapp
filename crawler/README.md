# 法拍房数据爬虫 — 完成总结

## 项目结构 (34个文件)

```
shanghai-fapai/crawler/
├── main.py                    # CLI入口: --source, --city, --task-id, --schedule
├── config.py                  # pydantic-settings，复用后端.env
├── engine.py                  # CrawlEngine 编排核心
├── browser.py                 # Playwright 浏览器管理(单例)
├── anti_crawl.py              # UA池, 随机延迟, stealth JS
├── scheduler.py               # APScheduler 每日定时(凌晨3点)
├── requirements.txt           # playwright, bs4, lxml
├── run.bat / run.sh           # 启动脚本
│
├── models/item.py             # AuctionItem @dataclass (45字段)
├── platforms/                 # 平台爬虫
│   ├── base.py                # AbstractBrokerCrawler (ABC)
│   ├── taobao.py              # 淘宝司法拍卖 - 分页列表 + 详情
│   ├── jd.py                  # 京东拍卖 - 无限滚动 + 详情
│   └── gpai.py                # 公拍网 - requests/Playwright双模式
├── parsers/                   # 详情页解析器
│   ├── taobao_detail.py       # 淘宝CSS选择器 + 正则提取
│   ├── jd_detail.py           # 京东CSS选择器 + 正则提取
│   └── gpai_detail.py         # 公拍网CSS选择器 + 正则提取
├── cleaners/                  # 数据清洗
│   ├── price.py               # 价格归一化(万/亿→元)
│   ├── city.py                # 城市标准化(上海/宁波)
│   ├── text.py                # 文本清洗 + 区域提取
│   └── field_mapper.py        # raw dict → AuctionItem
├── storage/                   # 存储层
│   ├── db.py                  # 独立async session
│   ├── repository.py          # Property/CrawlRecord Repository
│   └── deduplicator.py        # URL双重去重(内存+DB)
└── utils/
    ├── logger.py              # loguru配置(控制台+文件滚动)
    ├── retry.py               # @retry_on_failure 装饰器
    └── url_registry.py        # 15个源URL配置
```

## 数据源覆盖

| 平台 | URL数 | 城市 | 渲染方式 | 采集策略 |
|------|-------|------|---------|---------|
| 淘宝司法拍卖 (sf.taobao.com) | 10 | 上海/宁波 | JS重度渲染 | Playwright |
| 京东拍卖 (pmsearch.jd.com) | 1 | 上海/宁波 | JS无限滚动 | Playwright |
| 公拍网 (s.gpai.net) | 4 | 上海/宁波 | 服务端渲染 | httpx + Playwright降级 |

## 数据流

```
源URL列表 → 列表页采集(detail URLs) → URL去重(内存+DB)
→ 详情页抓取+解析 → 数据清洗(价格/城市/文本) → AuctionItem
→ DB upsert + 图片存储 → 增量比对(24h) → 生成执行记录
```

## 后端集成改动

- **`app/services/crawl.py`**: `trigger_crawl_task()` 现在会真正生成爬虫子进程；新增 `get_task_progress()` 查询实时进度
- **`app/api/admin/crawl.py`**: 新增 `GET /tasks/{id}/progress` 接口

## 使用方式

### 命令行

```bash
# 全量采集
python -m crawler.main

# 指定平台+城市
python -m crawler.main --source taobao --city 上海 --max-pages 3

# 强制刷新（跳过去重）
python -m crawler.main --force-refresh

# 定时调度模式
python -m crawler.main --schedule

# 管理后台触发（指定task-id）
python -m crawler.main --task-id 1

# 有头模式调试
python -m crawler.main --source taobao --max-pages 1 --no-headless
```

### 管理后台 API

```bash
# 触发任务
POST /api/admin/crawl/tasks/{id}/trigger

# 查看进度
GET /api/admin/crawl/tasks/{id}/progress

# 查看执行记录
GET /api/admin/crawl/tasks/{id}/records?page=1&page_size=20
```

### 安装依赖

```bash
pip install -r backend/requirements.txt
pip install -r crawler/requirements.txt
playwright install chromium
```

## 核心功能清单

| 功能 | 状态 |
|------|------|
| 多平台支持（淘宝/京东/公拍网） | ✅ |
| 上海+宁波双城市 | ✅ |
| 15个源URL全量覆盖 | ✅ |
| Playwright无头浏览器 | ✅ |
| requests+BS4（公拍网优先） | ✅ |
| 自动分页/无限滚动 | ✅ |
| 随机UA轮换（20+） | ✅ |
| 随机请求延迟 | ✅ |
| Stealth JS注入反检测 | ✅ |
| 可扩展代理支持 | ✅ |
| 价格单位归一化（万/亿→元） | ✅ |
| 城市标准化（上海/宁波） | ✅ |
| URL双重去重（内存+DB） | ✅ |
| 指数退避重试机制 | ✅ |
| 异常捕获+日志记录 | ✅ |
| Loguru日志（控制台+文件滚动） | ✅ |
| 24小时增量比对 | ✅ |
| APScheduler定时调度 | ✅ |
| 管理后台API触发 | ✅ |
| 实时进度查询 | ✅ |
| 执行记录追踪 | ✅ |
| 过期房源自动标记 | ✅ |

## 抓取字段完整映射

需求中的所有字段均已映射到 `properties` 表的对应列，部分无直接列的字段处理方案：

| 需求字段 | DB处理方式 |
|----------|-----------|
| 参拍人数 | 建议通过Alembic新增 `participant_count` 列 |
| 是否支持贷款 | 存入 `description` Text字段（JSON格式） |
| 有无相关附件 | 存入 `description` Text字段（JSON格式） |
| 同房型贝壳数据 | 保留 `beike_*` 列，后续对接贝壳API |

## 注意事项

1. **CSS选择器需要实际验证**：三个平台的详情页选择器是根据常见司法拍卖页面结构编写的，实际运行时可能需要根据页面调整。选择器集中在 `parsers/` 目录的各平台文件中，易于维护。
2. **淘宝反爬**：淘宝对 headless 浏览器有检测，可能需要配置代理或使用 `--no-headless` 调试。如果遇到验证码，会在日志中记录URL并跳过。
3. **公拍网**：优先使用 httpx（服务端渲染，速度快），失败自动降级到 Playwright。
4. **增量更新**：每次运行结束时自动对比DB，标记超过7天未出现的进行中/即将开拍房源为"已结束"。
5. **数据质量**：部分字段（如朝向、装修、环线）不一定在所有平台的详情页中展示，解析器会尽力提取，缺失字段留空。
