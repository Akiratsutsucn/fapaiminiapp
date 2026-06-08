# 数据审核清洗系统部署指南

## 系统概述

数据审核清洗系统是一个完整的爬虫数据质量管理解决方案，包含：

1. **审核规则管理**：可配置的数据验证规则
2. **自动审核任务**：每日凌晨2点自动执行全量数据审核
3. **手动审核任务**：管理员可随时触发审核
4. **违规记录管理**：详细记录和处理数据违规情况
5. **可视化报告**：直观展示数据质量评分和统计

## 部署步骤

### 1. 数据库迁移

```bash
cd backend

# 创建迁移文件
alembic revision -m "add data audit tables"

# 复制 backend/alembic/versions/add_data_audit_tables.py 中的内容到新生成的迁移文件

# 执行迁移
alembic upgrade head
```

### 2. 初始化默认规则

```bash
cd backend

# 运行初始化脚本
python -m scripts.init_audit_rules
```

这将创建以下默认规则：
- 核心价格字段必填检查（起拍价、保证金、加价幅度）
- 房源面积必填检查
- 起拍价合理性检查（10万-1亿）
- 保证金合理性检查
- 房源面积合理性检查（10-1000平米）
- 目标城市范围过滤（仅保留上海、宁波、杭州）
- 不动产类型过滤
- 地址信息完整性检查
- 拍卖状态必填检查
- 经纬度合理性检查

### 3. 配置环境变量

在 `backend/.env` 中添加（如需禁用自动调度器）：

```
ENABLE_AUDIT_SCHEDULER=True
```

### 4. 重启后端服务

```bash
cd backend

# 停止现有服务
pkill -f "uvicorn app.main:app"

# 启动新服务
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > backend.log 2>&1 &
```

### 5. 部署前端

前端无需额外配置，重新构建即可：

```bash
cd admin-web

# 安装依赖（如果有新增）
npm install

# 构建生产版本
npm run build

# 上传到服务器 /usr/share/nginx/html/admin/
```

## 功能使用

### 管理后台入口

访问管理后台，左侧菜单会有"数据审核"模块，包含：

1. **审核概览** (`/data-audit`)
   - 查看数据质量评分
   - 查看最新审核任务
   - 快速创建审核任务

2. **审核规则** (`/data-audit/rules`)
   - 查看所有规则
   - 新增/编辑/删除规则
   - 启用/禁用规则

3. **审核任务** (`/data-audit/tasks`)
   - 查看任务执行历史
   - 查看任务详情和进度
   - 查看任务报告

4. **违规记录** (`/data-audit/violations`)
   - 查看所有违规记录
   - 筛选违规记录
   - 标记违规已解决

### 手动执行审核

1. 进入"审核概览"页面
2. 点击"立即审核"按钮
3. 输入任务名称
4. 选择要使用的规则
5. 选择审核范围（全部或特定平台）
6. 点击"创建并执行"

任务将在后台执行，可在"审核任务"页面查看进度。

### 自动定时审核

系统已配置为每天凌晨2点自动执行全量数据审核，无需手动干预。

审核完成后会自动生成报告，可在"审核任务"页面查看。

## API接口

### 审核规则

- `GET /api/admin/data-audit/rules` - 获取规则列表
- `POST /api/admin/data-audit/rules` - 创建规则
- `GET /api/admin/data-audit/rules/{id}` - 获取规则详情
- `PUT /api/admin/data-audit/rules/{id}` - 更新规则
- `DELETE /api/admin/data-audit/rules/{id}` - 删除规则

### 审核任务

- `GET /api/admin/data-audit/tasks` - 获取任务列表
- `POST /api/admin/data-audit/tasks` - 创建并执行任务
- `GET /api/admin/data-audit/tasks/{id}` - 获取任务详情

### 违规记录

- `GET /api/admin/data-audit/violations` - 获取违规记录列表
- `PUT /api/admin/data-audit/violations/{id}` - 更新违规记录状态

### 审核报告

- `GET /api/admin/data-audit/reports` - 获取报告列表
- `GET /api/admin/data-audit/reports/{id}` - 获取报告详情
- `GET /api/admin/data-audit/reports/task/{task_id}` - 根据任务ID获取报告

### 统计数据

- `GET /api/admin/data-audit/dashboard/stats` - 获取仪表板统计

## 规则配置说明

### 规则分类

1. **field_required** - 必填字段检查
   ```json
   {
     "fields": ["starting_price", "deposit", "area"]
   }
   ```

2. **field_range** - 字段范围检查
   ```json
   {
     "field": "starting_price",
     "min": 100000,
     "max": 100000000
   }
   ```

3. **field_format** - 字段格式检查
   ```json
   {
     "field": "phone",
     "pattern": "^1[3-9]\\d{9}$"
   }
   ```

4. **region_filter** - 地区过滤
   ```json
   {
     "allowed_cities": [310000, 330200, 330100]
   }
   ```

5. **property_type_filter** - 房产类型过滤
   ```json
   {
     "allowed_types": ["住宅", "别墅", "公寓"]
   }
   ```

### 执行动作

- **flag** - 仅标记，不修改数据
- **fix** - 尝试自动修复（需配合 auto_fix=true）
- **delete** - 删除违规数据

### 严重级别

- **info** - 信息
- **warning** - 警告
- **error** - 错误
- **critical** - 严重

## 注意事项

1. **慎用delete动作**：配置为delete的规则会直接删除违规数据，请谨慎使用
2. **定时任务时间**：默认凌晨2点执行，可在 `backend/app/services/audit_scheduler.py` 中修改
3. **性能考虑**：大量数据审核会消耗一定时间，建议在业务低峰期执行
4. **规则优先级**：所有规则按顺序执行，delete动作会立即删除数据

## 扩展开发

### 新增规则类型

在 `backend/app/services/data_audit_service.py` 的 `_check_rule` 方法中添加新的分类处理逻辑。

### 自定义报告

在 `backend/app/services/data_audit_service.py` 的 `_generate_report` 方法中修改报告生成逻辑。

### 调整调度时间

修改 `backend/app/services/audit_scheduler.py` 中的 `target_time` 设置。

## 故障排查

### 定时任务未执行

1. 检查后端日志：`tail -f backend.log`
2. 确认 `ENABLE_AUDIT_SCHEDULER=True`
3. 检查数据库中 `audit_tasks` 表

### 前端页面空白

1. 检查路由配置是否正确
2. 检查浏览器控制台错误
3. 确认API接口可访问

### 审核任务卡住

1. 查看任务状态和错误信息
2. 检查后端日志
3. 手动将任务状态改为failed后重试

## 联系支持

如有问题，请查看系统日志或联系开发团队。
