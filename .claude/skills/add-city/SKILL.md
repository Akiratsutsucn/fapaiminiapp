---
name: add-city
description: 为法拍者联盟新增一个目标城市（如临沂）的完整施工指南。城市是全代码库硬编码（无 cities 表），涉及爬虫/后端/小程序/后台四层 20+ 处引用点，极易遗漏。当用户要求"新增城市/加一个城市/添加XX市"时使用本 skill，逐层核对，确保新城市与既有城市（上海310000/宁波330200/杭州330100/临沂371300）完全对称。
---

# 新增城市完整施工指南

## 核心原则
1. **城市是全代码库硬编码**，没有 cities 表。新增城市必须逐一改遍所有引用点，漏一处就出 bug（房源被误判、被审核软删、下拉缺城市、AI 不认识）。
2. **以生产为准**：爬虫（/opt/fapai/crawler）和后端（/opt/fapai/backend）的本地仓库常落后生产。改前必须先 `scp` 从生产拉取文件为基准，改后部署回生产，再回流本地提交。
3. **改完必验证**：抓取后查 4 项——①properties 表 city_id 分布 ②接口 `/api/v1/properties?city_id=X` 返回数 ③是否被误判成上海(city_id=310000 但标题含新城市名) ④是否被审核软删(is_deleted=1)。
4. **与既有城市对称**：任何一处有上海/宁波/杭州，新城市就必须也在。核查用：`grep -rl "330100\|杭州" | 逐文件确认含新城市`。

## 生产连接
- SSH: `ssh -i "<repo>/xiaochengxu.pem" -o StrictHostKeyChecking=no ubuntu@122.51.156.252`
- MySQL: `mysql -ufapai -pfapai123 shanghai_fapai`（加 `2>&1 | grep -v insecure`）
- 爬虫 /opt/fapai/crawler（属主 ubuntu），后端 /opt/fapai/backend（属主 www-data），venv /opt/fapai/venv
- 部署后：爬虫清 `__pycache__`；后端 `systemctl restart fapai-backend.service`；后台 vite build 后传 `/usr/share/nginx/html/admin/`

## 城市参数确定（以新城市为例，行政区划码见国标）
- **city_id**：国标行政区划码（临沂=371300）
- **公拍网 cityNum**：规律=省码+市序（上海31、宁波3302、杭州3301、临沂3713）
- **京东 provinceId**：京东内部编码，需实地探明（见下）。已知：上海2、山西6、河南7、辽宁8、吉林9、黑龙江10、内蒙古11、江苏12、山东13、安徽14、浙江15、四川22、云南25
- **区县列表**：该市所有区县 + **功能区**（开发区/高新区/经济区等，实拍房源 district 常是这些，漏则被白名单误杀）

## 步骤 1：爬虫层（crawler/，改前先从生产 scp 拉取）

**crawler/engine.py**
- `CITY_ID_MAP` 加 `"新城市": <city_id>`
- `VALID_DISTRICTS` 加 `<city_id>: {区县1, 区县2, ... 功能区}`（含临港区/经济技术开发区/经济区/高新区等功能区变体，否则真实房源被 `_ALL_VALID_DISTRICTS` 白名单当"外省同名楼盘"误杀）
- `_ALL_VALID_DISTRICTS` 那行加市名 `"新城市"`
- 城市归属判定链（`if "宁波" in pc elif "杭州"...`）加 `elif "新城市" in pc or "新城市" in addr: city_id=X; province_city="新城市"`
- 省级兜底：仿 `pc in ("浙江省","浙江")` 加 `elif pc in ("山东省","山东") and city_id==X:`（京东收紧到辖区白名单）
- **外省拦截正则** `_re_other_province` / `_re_other_province_any`：若新城市所在省在拦截名单里（如山东），必须用负向先行断言放行，如 `山东(?!省?临沂)`，否则"山东省X市"开头房源全被拦截

**crawler/cleaners/city.py**（★极易漏！京东/公拍网 detail 走这里，不改则新城市房源全被判成上海）
- `CITY_MAP` 加 `"新城市"/"新城市市"/"pinyin": {"name":..,"id":..}`
- `CITY_NUM_MAP` 加 `<cityNum>: "新城市"`
- `CITY_ID_NAME` 加 `<city_id>: "新城市"`
- 注意 `standardize_city` 默认 fallback 上海——城市识别失败会误判上海，务必确保新城市在表中

**crawler/utils/url_registry.py**：`PAIMAI_CONFIGS`（阿里，source_url 固定占位符，只加 city）、`JD_CONFIGS`（京东，`provinceId=<省码>`）、`GPAI_CONFIGS`（公拍网，`cityNum=<num>`，两个 at 类型 376/381）各加 SourceConfig

**crawler/platforms/gpai.py**：`CITY_NUM_MAP` 加新城市
**crawler/platforms/jd.py**：`JD_CITY_MAP` 加新城市；`_match_city` 加 `if "新城市" in v: return <city_id>`
**crawler/main.py**：`--city` choices 加新城市

### 京东 provinceId 探明法（若表中没有该省）
用 Playwright 打开 `pmsearch.jd.com/?publishSource=7&provinceId=N`，拦截 `paimai_unifiedSearch` 接口看返回 city 属于哪省。脚本模板见记忆 `project_*` 或本次会话 /tmp/probe_jd.py。

## 步骤 2：后端层（backend/app/，改前从生产拉取，改后重启 fapai-backend.service）

- **api/v1/common.py**：`CITIES` 列表加 `{"city_id":X,"city_name":"新城市","is_active":True}`（小程序城市列表接口 `/api/v1/cities` 的数据源；home-summary 统计动态读 CITIES 自动含新城市）
- **api/v1/ai_search.py**：`DISTRICTS` 加新城市所有区县（AI 找房自然语言解析，漏则搜不出新城市区县）
- **api/admin/settings.py**：`CITIES` 加新城市
- **api/admin/dashboard.py**：`CITIES` 字典加 `"pinyin": X`；Query 描述补新城市
- **api/admin/ai_tools.py**：两处 `city_map`（id→名、名→id）加新城市
- **api/admin/ai.py**：AI 助手 system prompt 的"城市代码"行加新城市（★有功能意义，漏则 AI 后台助手不认识新城市）；city enum `["上海","宁波","杭州"]` 加新城市
- **models/crawl.py**：字段 comment（次要）

## 步骤 3：数据库审核规则（★★最大的坑，只改代码不改这里，抓的房源会被全部软删★★）

审核模块 `data_audit_service._check_region` 按 `audit_rules` 表 id=6 的 `config.allowed_cities` 判定，不在白名单的城市房源被 `is_deleted=1` 软删（小程序/接口就查不到）。必须：
```sql
UPDATE audit_rules SET config='{"allowed_cities": [310000,330200,330100,371300,<新city_id>]}' WHERE id=6;
-- 若新城市房源已被误删，恢复：
UPDATE properties SET is_deleted=0 WHERE city_id=<新city_id> AND is_deleted=1;
```

## 步骤 4：小程序（miniprogram/，★ .ts 源和 .js 运行时都要改且保持一致，微信实际加载 .js）

- **pages/index/index**：`DISTRICTS_BY_CITY` 加 `<city_id>: [区县...]`；`DEFAULT_CITIES` 加新城市
- **pages/map-property/map-property**：`DISTRICTS_BY_CITY` 加区县；城市中心坐标 `<city_id>: {lat, lng}` 加新城市
- **pages/property-list/property-list**：`DISTRICTS_BY_CITY` 加区县；`cityNameMap` 加新城市
- **pages/property-detail/property-detail**：`DISTRICT_INTRO` 板块介绍库加新城市各区县介绍（可选增强，无则降级不显示）
- **pages/login/login**：分享文案里的"上海/宁波/杭州"加新城市（可选）
- 城市列表实际从后端 `/api/v1/cities` 拉，`DEFAULT_CITIES` 只是兜底
- 改完 `node --check pages/**/*.js` 校验；**需重新上传体验版**才生效

## 步骤 5：后台 admin-web（改 .vue 源，改后 `npm run build` + 传 `/usr/share/nginx/html/admin/`）

8 个 vue 各有城市配置，逐一加新城市（t-option 下拉 / CITY_MAP / 区县常量 / 表头 / 三元判定）：
banner/BannerList、community/CommunityList（**两处下拉：筛选区+编辑弹窗**）、crawler/CrawlerView（表头+cities数组）、dashboard/Dashboard（下拉+pinyin映射）、demand/DemandList（下拉+recCity三元）、property/PropertyEdit、property/PropertyList（下拉+区县常量LY_DISTRICTS+districtOptions分支）、user/UserList

## 步骤 6：抓取数据

`cd /opt/fapai && set -a; . ./.env; set +a` 后分平台跑（阿里早晨成功率高）：
```
nohup ./venv/bin/python -m crawler.main --source taobao --city 新城市 > /tmp/new_ali.log 2>&1 &
nohup ./venv/bin/python -m crawler.main --source gpai --city 新城市 > /tmp/new_gpai.log 2>&1 &
nohup ./venv/bin/python -m crawler.main --source jd --city 新城市 > /tmp/new_jd.log 2>&1 &
```
- 阿里按 keyword='城市 区县' 逐区搜（复用 VALID_DISTRICTS）；公拍网靠 cityNum（代理失效会回退 socks 桥）；京东全国搜+provinceId 缩范围+_match_city 过滤
- 深度字段（面积/评估价/折扣/图片）靠每日渐补机制多轮累积（阿里 SSR 限量渐补 + backfill_fields + fapai-image-backfill.timer），新城市首轮数据"薄"是正常冷启动，会逐日追平

## 步骤 7：验证（4 项必查）
```sql
-- ① city_id 分布  ② 是否误判上海(标题含新城市名但 city_id=310000)  ③ 是否被软删
SELECT city_id,auction_platform,is_deleted,COUNT(*) FROM properties WHERE city_id=<X> OR title LIKE '%新城市%' GROUP BY 1,2,3;
```
- ④ 接口：`curl 'http://127.0.0.1:25081/api/v1/properties?city_id=<X>&page=1&page_size=1'` 看 total
- 一致性复扫：`grep -rl "330100\|杭州" <各层目录> | 逐文件确认含新城市`，任何有三城无新城市的地方都是遗漏

## 遗漏点速查表（20+ 处，逐一核对）
爬虫：engine(CITY_ID_MAP/VALID_DISTRICTS/_ALL_VALID/判定链/省兜底/外省正则)、city.py(3表)、url_registry(3平台)、gpai、jd(2处)、main
后端：common、ai_search、settings、dashboard、ai_tools(2处)、ai(2处)、crawl注释
数据库：audit_rules id=6 allowed_cities
小程序：index(2)、map-property(2)、property-list(2)、property-detail(1)、login(1) 的 ts+js
后台：8 个 vue

