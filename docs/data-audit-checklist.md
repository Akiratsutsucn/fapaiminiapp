# 数据审核清洗系统 - 部署检查清单

## 📋 部署前检查

### 环境检查
- [ ] Python 3.8+ 已安装
- [ ] Node.js 16+ 已安装
- [ ] MySQL 5.7+ 已安装并运行
- [ ] 后端虚拟环境已激活
- [ ] 前端依赖已安装

### 代码检查
- [ ] 已拉取最新代码
- [ ] 后端代码无语法错误
- [ ] 前端代码无语法错误

## 📦 后端部署步骤

### 1. 数据库迁移
```bash
cd backend
alembic upgrade head
```
**验证**：
- [ ] 迁移执行成功，无错误
- [ ] 检查数据库是否创建了以下表：
  ```sql
  SHOW TABLES LIKE 'audit_%';
  ```
  应显示：audit_rules, audit_tasks, audit_violations, audit_reports

### 2. 初始化默认规则
```bash
python -m scripts.init_audit_rules
```
**验证**：
- [ ] 输出显示"成功初始化 10 条默认审核规则"
- [ ] 检查规则是否已插入：
  ```sql
  SELECT COUNT(*) FROM audit_rules;
  ```
  应返回 10

### 3. 环境配置
检查 `backend/.env` 或 `backend/app/core/config.py`：
- [ ] `DATABASE_URL` 配置正确
- [ ] `ENABLE_AUDIT_SCHEDULER=True` （启用定时调度）

### 4. 重启后端服务

**停止现有服务**：
```bash
pkill -f "uvicorn app.main:app"
```

**启动新服务**：
```bash
cd backend
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

**验证**：
- [ ] 进程已启动：`ps aux | grep uvicorn`
- [ ] 端口已监听：`netstat -tulnp | grep 8000`
- [ ] 日志中显示"数据审核调度器已启动"：
  ```bash
  tail -f backend.log | grep -i audit
  ```
- [ ] API可访问：`curl http://localhost:8000/health`

### 5. 测试后端API

**测试规则列表接口**：
```bash
curl -X GET "http://localhost:8000/api/admin/data-audit/rules" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```
- [ ] 返回10条规则
- [ ] 响应状态码为200

**测试统计接口**：
```bash
curl -X GET "http://localhost:8000/api/admin/data-audit/dashboard/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```
- [ ] 返回统计数据
- [ ] `total_rules` 为 10

## 🎨 前端部署步骤

### 1. 构建前端
```bash
cd admin-web
npm run build
```
**验证**：
- [ ] 构建成功，无错误
- [ ] `dist` 目录已生成

### 2. 上传到服务器
```bash
# 本地执行
scp -r admin-web/dist/* user@server:/usr/share/nginx/html/admin/
```
- [ ] 文件上传成功
- [ ] 新增文件包含在内

### 3. 重启Nginx（如需要）
```bash
# 服务器执行
sudo nginx -t
sudo nginx -s reload
```
- [ ] Nginx配置测试通过
- [ ] Nginx重启成功

### 4. 测试前端访问

**打开管理后台**：
- [ ] 访问 `https://your-domain.com/admin`
- [ ] 登录成功
- [ ] 左侧菜单显示"数据审核"

**进入数据审核模块**：
- [ ] 点击"数据审核"菜单
- [ ] 审核概览页正常显示
- [ ] 统计数据正常加载

**测试各个子页面**：
- [ ] 审核规则页面正常显示，规则列表加载成功
- [ ] 审核任务页面正常显示
- [ ] 违规记录页面正常显示

## ✅ 功能验证

### 1. 手动执行审核任务

**步骤**：
1. 进入"审核概览"页面
2. 点击"立即审核"按钮
3. 输入任务名称：`测试审核_手动`
4. 选择所有规则（默认全选）
5. 审核范围选择"全部数据"
6. 点击"创建并执行"

**验证**：
- [ ] 弹出成功提示
- [ ] 任务创建成功
- [ ] 进入"审核任务"页面，看到新任务
- [ ] 任务状态为"执行中"或"已完成"
- [ ] 等待任务完成后，点击"查看报告"
- [ ] 报告页面正常显示，包含质量评分和统计数据

### 2. 查看违规记录

**步骤**：
1. 进入"违规记录"页面
2. 查看违规列表

**验证**：
- [ ] 违规记录列表正常显示
- [ ] 可以看到违规的房源ID、规则名称、违规详情
- [ ] 点击"查看详情"可以查看完整违规信息
- [ ] 点击"标记解决"可以更新违规状态

### 3. 规则管理

**测试新增规则**：
1. 进入"审核规则"页面
2. 点击"新增规则"
3. 填写规则信息：
   - 规则名称：测试规则
   - 规则代码：TEST_RULE
   - 规则分类：必填字段检查
   - 规则配置：`{"fields": ["title"]}`
   - 执行动作：仅标记
   - 严重级别：警告
4. 保存

**验证**：
- [ ] 规则创建成功
- [ ] 规则列表中显示新规则
- [ ] 可以编辑规则
- [ ] 可以启用/禁用规则
- [ ] 可以删除规则（删除刚创建的测试规则）

### 4. 定时任务验证

**方法1：查看日志**（第二天凌晨2点后）
```bash
tail -100 backend.log | grep -i "每日自动审核"
```
- [ ] 日志中显示"创建每日审核任务"
- [ ] 日志中显示任务完成信息

**方法2：查看数据库**（第二天凌晨2点后）
```sql
SELECT * FROM audit_tasks 
WHERE task_type = 'scheduled' 
AND DATE(created_at) = CURDATE() 
ORDER BY created_at DESC 
LIMIT 1;
```
- [ ] 返回今天创建的scheduled任务
- [ ] 任务状态为completed

**方法3：管理后台查看**（第二天凌晨2点后）
- [ ] 进入"审核任务"页面
- [ ] 任务列表中有当天的"每日自动审核"任务
- [ ] 任务状态为"已完成"

## 🔧 故障排查

### 后端问题

**问题1：数据库迁移失败**
```bash
# 检查数据库连接
mysql -h DB_HOST -u DB_USER -p DB_NAME

# 查看迁移历史
cd backend
alembic history

# 查看当前版本
alembic current
```

**问题2：后端服务无法启动**
```bash
# 查看详细错误
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 检查端口占用
netstat -tulnp | grep 8000
```

**问题3：API接口返回500错误**
```bash
# 查看后端日志
tail -100 backend.log

# 查看实时日志
tail -f backend.log
```

**问题4：定时任务未执行**
```bash
# 检查调度器是否启动
tail -100 backend.log | grep -i "调度器"

# 检查配置
grep ENABLE_AUDIT_SCHEDULER backend/.env
```

### 前端问题

**问题1：页面空白**
- [ ] 打开浏览器控制台，查看错误信息
- [ ] 检查Network标签，查看API请求是否成功
- [ ] 检查路由配置是否正确

**问题2：API请求失败**
- [ ] 检查后端服务是否运行
- [ ] 检查API URL配置
- [ ] 检查管理员Token是否有效

**问题3：部分页面无法访问**
- [ ] 检查路由是否正确配置
- [ ] 检查角色权限设置

## 📊 性能监控

### 首次运行监控

**监控指标**：
- [ ] 任务执行时间（应在5分钟内完成万级数据）
- [ ] CPU使用率（应在合理范围内）
- [ ] 内存使用率（应无明显泄漏）
- [ ] 数据库连接数（应正常）

**查看任务执行耗时**：
```sql
SELECT 
  id, 
  task_name, 
  total_records, 
  duration_seconds,
  CONCAT(FLOOR(duration_seconds/60), '分', duration_seconds%60, '秒') as 耗时
FROM audit_tasks 
ORDER BY created_at DESC 
LIMIT 10;
```

### 长期监控建议

- [ ] 设置数据库慢查询日志
- [ ] 定期查看后端日志
- [ ] 监控数据库表大小增长
- [ ] 关注数据质量评分趋势

## 📝 部署记录

**部署信息**：
- 部署日期：____________________
- 部署人员：____________________
- 部署环境：____________________
- 后端版本：v1.0.0
- 前端版本：v1.0.0

**部署结果**：
- [ ] 后端部署成功
- [ ] 前端部署成功
- [ ] 功能验证通过
- [ ] 定时任务验证通过

**备注**：
___________________________________________________
___________________________________________________
___________________________________________________

## 🎉 部署完成

恭喜！数据审核清洗系统已成功部署。

### 后续工作

1. **观察运行**：关注第一次定时任务的执行情况
2. **数据清洗效果**：查看清洗掉的数据量和类型
3. **质量评分**：记录初始质量评分，用于后续对比
4. **用户培训**：向管理员演示系统使用方法

### 相关文档

- 设计文档：`docs/data-audit-design.md`
- 部署文档：`docs/data-audit-deployment.md`
- 快速开始：`docs/data-audit-quickstart.md`
- 功能总结：`docs/data-audit-summary.md`
- 检查清单：`docs/data-audit-checklist.md`（本文件）

### 技术支持

如遇问题，请查看：
1. 后端日志：`backend/backend.log`
2. 浏览器控制台
3. 数据库audit_tasks表的error_message字段
