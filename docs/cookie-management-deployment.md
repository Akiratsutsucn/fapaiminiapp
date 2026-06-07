## Cookie管理功能部署文档

### 功能说明

在管理后台的"爬虫管理"页面添加了三个平台（淘宝拍卖、京东拍卖、公拍网）的Cookie管理功能，方便管理员在Cookie过期后直接在后台更新，无需手动运行本地Python脚本。

### 修改的文件

#### 后端文件
1. `backend/app/api/admin/crawler.py`
   - 添加了 `CookieUpdateRequest` 数据模型
   - 添加了 `GET /crawler/cookies` 接口：获取三个平台的Cookie配置状态
   - 添加了 `POST /crawler/cookies` 接口：更新指定平台的Cookie

#### 前端文件
1. `admin-web/src/api/crawler.ts`
   - 添加了 `CookieStatus` 和 `CookiesStatusResponse` 类型定义
   - 添加了 `getCookiesStatus()` 函数
   - 添加了 `updateCookie()` 函数

2. `admin-web/src/views/crawler/CrawlerView.vue`
   - 在页面右侧添加了"Cookie管理"卡片
   - 为三个平台各提供了一个文本框和保存按钮
   - 显示每个平台的配置状态（已配置/未配置）

### 使用方法

1. 登录管理后台，进入"爬虫管理"页面
2. 在右侧的"Cookie管理"卡片中，可以看到三个平台的配置状态
3. 当某个平台的Cookie过期时：
   - 在对应平台的文本框中粘贴新的Cookie字符串
   - 点击"保存Cookie"按钮
   - 系统会自动更新服务器上的 `.env` 文件

### Cookie获取方法

#### 淘宝拍卖
使用本地脚本 `update_taobao_cookie.py` 或手动从浏览器获取：
1. 用Chrome访问 https://sf.taobao.com
2. 登录后打开开发者工具（F12）
3. 在Application > Cookies 中找到 `.taobao.com` 域名下的cookie
4. 复制所有cookie键值对，格式：`key1=value1; key2=value2; ...`

#### 京东拍卖
手动从浏览器获取：
1. 用Chrome访问京东拍卖网站并登录
2. 打开开发者工具（F12）
3. 在Application > Cookies 中找到京东域名下的cookie
4. 复制所有cookie键值对

#### 公拍网
使用本地脚本 `update_gpai_cookie.py` 或手动从浏览器获取：
1. 用Chrome访问 https://www.gpai.net 并登录
2. 打开开发者工具（F12）
3. 在Application > Cookies 中找到 `.gpai.net` 域名下的cookie
4. 复制所有cookie键值对

### 部署步骤

#### 1. 备份现有部署

```bash
ssh -i xiaochengxu.pem ubuntu@122.51.156.252

# 备份后端
cd /opt/fapai/backend
sudo cp -r app app.backup.$(date +%Y%m%d_%H%M%S)

# 备份前端
cd /opt/fapai/admin-web
sudo cp -r dist dist.backup.$(date +%Y%m%d_%H%M%S)
```

#### 2. 上传文件到服务器

在本地执行：

```powershell
# 上传后端文件
scp -i xiaochengxu.pem backend/app/api/admin/crawler.py ubuntu@122.51.156.252:/tmp/

# 上传前端构建产物
cd admin-web
scp -i ../xiaochengxu.pem -r dist/* ubuntu@122.51.156.252:/tmp/admin-dist/
```

#### 3. 部署到服务器

```bash
# 部署后端
sudo cp /tmp/crawler.py /opt/fapai/backend/app/api/admin/crawler.py
sudo chown ubuntu:ubuntu /opt/fapai/backend/app/api/admin/crawler.py

# 重启后端服务
sudo systemctl restart fapai-backend

# 检查后端状态
sudo systemctl status fapai-backend

# 部署前端
sudo rm -rf /usr/share/nginx/html/admin/*
sudo cp -r /tmp/admin-dist/* /usr/share/nginx/html/admin/
sudo chown -R www-data:www-data /usr/share/nginx/html/admin

# 重启Nginx
sudo systemctl reload nginx
```

#### 4. 验证部署

1. 打开浏览器访问：https://admin.fapaizhelianmeng.cn/admin/#/crawler
2. 检查页面右侧是否显示"Cookie管理"卡片
3. 检查是否显示三个平台的配置状态
4. 测试更新一个Cookie（可以输入测试内容）
5. 检查服务器上的 `.env` 文件是否正确更新：

```bash
ssh -i xiaochengxu.pem ubuntu@122.51.156.252
cat /opt/fapai/crawler/.env | grep COOKIE
```

### 注意事项

1. **权限问题**：确保后端进程有权限读写 `.env` 文件
2. **Cookie格式**：粘贴的Cookie必须是标准格式：`key1=value1; key2=value2`
3. **生效时间**：更新Cookie后，下次爬虫运行时会自动使用新的Cookie（不需要重启服务）
4. **安全性**：Cookie包含敏感信息，只有管理员账号可以访问此功能

### 回滚方案

如果部署后出现问题，执行以下命令回滚：

```bash
ssh -i xiaochengxu.pem ubuntu@122.51.156.252

# 找到最新的备份
ls -lt /opt/fapai/backend/app.backup.*

# 回滚后端（替换为实际的备份目录名）
sudo rm -rf /opt/fapai/backend/app
sudo cp -r /opt/fapai/backend/app.backup.YYYYMMDD_HHMMSS /opt/fapai/backend/app
sudo systemctl restart fapai-backend

# 回滚前端
ls -lt /opt/fapai/admin-web/dist.backup.*
sudo rm -rf /usr/share/nginx/html/admin/*
sudo cp -r /opt/fapai/admin-web/dist.backup.YYYYMMDD_HHMMSS/* /usr/share/nginx/html/admin/
sudo systemctl reload nginx
```

### 后续优化建议

1. **自动获取Cookie**：集成浏览器自动化，让用户直接在后台扫码登录获取Cookie
2. **Cookie有效期监控**：定期检查Cookie是否过期，过期前提醒管理员更新
3. **Cookie加密存储**：考虑对存储的Cookie进行加密处理
4. **操作日志**：记录Cookie更新操作的日志，便于审计
