# 法拍者联盟小程序

> 上海 / 宁波 法拍房资讯聚合小程序 — 三平台（阿里 / 京东 / 公拍网）+ 贝壳数据的聚合、去重、智能丰富，帮用户高效找到捡漏房源。

## 项目组成

```
.
├── miniprogram/        微信小程序前端（莫兰迪蓝 + 跳色橙 V2 设计）
├── admin-web/          Vue 3 + TDesign 管理后台
├── backend/            FastAPI + MySQL，对外 /api/v1（小程序）+ /api/admin（后台）
├── crawler/            Playwright + httpx 爬虫，三平台 + 贝壳
└── scripts/            一次性脚本（回填 / 健康检查 / 本地阿里抓取等）
```

## 快速开始

### 后端（生产环境部署在腾讯云）

```bash
# 1. 装依赖
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. 配置 .env（参考 .env.example）
cp ../.env.example ../.env
vim ../.env

# 3. 跑 alembic 迁移
alembic upgrade head

# 4. 启动
uvicorn app.main:app --host 0.0.0.0 --port 25081 --workers 4
```

### 爬虫

```bash
cd crawler
python -m playwright install chromium

# 全量跑
python -m crawler.main

# 单平台
python -m crawler.main --source taobao --city 上海

# 贝壳小区抓取
python -m crawler.community_scraper --city 上海 --limit 100
```

### 管理后台

```bash
cd admin-web
npm install
npm run dev    # 开发
npm run build  # 生产
```

### 小程序

用微信开发者工具打开 `miniprogram/`。

## 关键设计

### 数据流
```
三平台爬虫（阿里/京东/公拍）→ 入库 properties
        ↓
geocoder（高德 geocoding）→ 补 lat/lng
        ↓
text_extractor（智能解析 title/description）→ 补 layout/装修/电梯/case_number 等
        ↓
beike sug API → 补 community_info（小区名/区/板块/贝壳链接）
        ↓
amenities backfill（高德 POI）→ 补周边配套
        ↓
smart_enrich → 生成 tags + 爆款营销文案
        ↓
状态自校正 → 修正过期房源状态
```

### 抗封堵框架（crawler/anti_block.py）
- 3 次指数退避重试（2/4/8s）+ 每次重试换 UA
- 风控感知：`captcha / punish / deny_pc / 请登录` 关键词检测
- 风控触发后该 host 冷却 30 分钟（PlatformCooldown）
- 代理池：PROXY_POOL 多代理轮换 + 失败 15 分钟冷却
- Playwright 自动用代理池启动

详见 [PROXY-SETUP.md](./PROXY-SETUP.md)

### UI 设计
莫兰迪蓝主调（80%）+ 跳色橙（10% CTA / 立省徽章 / 折扣率）+ 大字报价格（80rpx）+ 胶囊 chip。

## 已完成

- ✅ 三平台爬虫（阿里 / 京东 / 公拍）
- ✅ 贝壳小区数据 sug API 抓取
- ✅ 高德 POI 周边配套预处理
- ✅ 智能字段补全（提取小区名/楼层/装修/案号等）
- ✅ 智能 tags + 爆款文案
- ✅ 拍卖状态自动校正
- ✅ 抗封堵框架（重试 + UA轮换 + 代理池 + 风控冷却）
- ✅ 30 分钟无操作自动登出
- ✅ V2 UI（莫兰迪蓝 + 跳色橙）

## 待完成

- 阿里 MTOP API 在腾讯云 IDC IP 被识别为爬虫 → 已写本地抓取工具 `scripts/crawl_taobao_local.py`，待买代理
- 贝壳 `/xiaoqu/*` 路径在云 IP 被反爬 → 仅 sug API 可用，详情字段抓不到，待买代理

## License

私有项目，未授权请勿使用。
