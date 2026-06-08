# 数据审核清洗系统 - 快速开始

## 一分钟了解系统

数据审核清洗系统是为法拍者联盟小程序的爬虫数据设计的质量管理工具，能够：

✅ **自动检查**：每天凌晨2点自动审核全部房源数据  
✅ **智能清洗**：自动删除外省市数据、非不动产数据  
✅ **质量评分**：实时计算数据质量评分  
✅ **可视化管理**：直观展示审核结果和违规记录  

## 快速部署（5分钟）

### 步骤1：数据库迁移

```bash
cd backend
alembic upgrade head
```

### 步骤2：初始化规则

```bash
python -m scripts.init_audit_rules
```

### 步骤3：重启后端

```bash
pkill -f "uvicorn app.main:app"
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

### 步骤4：访问管理后台

打开管理后台，左侧菜单会出现"数据审核"模块。

## 默认规则说明

系统初始化后会自动创建以下规则：

### 强制清洗规则（action=delete）

1. **目标城市过滤**  
   - 仅保留：上海（310000）、宁波（330200）、杭州（330100）  
   - 其他城市数据自动删除

2. **不动产类型过滤**  
   - 仅保留：住宅、别墅、公寓、商铺、写字楼、厂房、仓库、车位  
   - 其他类型（如机动车、股权）自动删除

### 数据质量检查规则（action=flag）

3. **核心价格字段必填**  
   - 检查：起拍价、保证金、加价幅度  
   - 违规：标记但不删除

4. **房源面积必填**  
   - 检查：面积字段  
   - 违规：标记但不删除

5. **起拍价合理性**  
   - 范围：10万 - 1亿  
   - 违规：标记但不删除

6. **保证金合理性**  
   - 范围：大于0且小于5000万  
   - 违规：标记但不删除

7. **面积合理性**  
   - 范围：10 - 1000平米  
   - 违规：标记但不删除

8. **地址信息完整性**  
   - 检查：地址、区域  
   - 违规：标记但不删除

9. **拍卖状态必填**  
   - 检查：拍卖状态字段  
   - 违规：标记但不删除

10. **经纬度合理性**  
    - 范围：经度115-125（中国东部）  
    - 违规：标记但不删除

## 常见操作

### 手动执行审核

1. 进入"数据审核" → "审核概览"
2. 点击"立即审核"
3. 选择规则，点击"创建并执行"
4. 在"审核任务"页面查看进度

### 查看审核报告

1. 进入"数据审核" → "审核任务"
2. 找到已完成的任务
3. 点击"查看报告"

### 处理违规记录

1. 进入"数据审核" → "违规记录"
2. 筛选需要处理的记录
3. 点击"查看详情"查看违规原因
4. 点击"标记解决"标记为已处理

### 新增自定义规则

1. 进入"数据审核" → "审核规则"
2. 点击"新增规则"
3. 填写规则信息和配置
4. 选择执行动作和严重级别
5. 保存后规则将在下次审核时生效

## 规则配置示例

### 示例1：检查标题不能为空

```json
{
  "rule_name": "标题必填",
  "rule_code": "REQUIRED_TITLE",
  "category": "field_required",
  "config": {
    "fields": ["title"]
  },
  "action": "flag",
  "severity": "error"
}
```

### 示例2：检查建筑年份合理性

```json
{
  "rule_name": "建筑年份合理性",
  "rule_code": "VALID_BUILD_YEAR",
  "category": "field_range",
  "config": {
    "field": "build_year",
    "min": 1980,
    "max": 2025
  },
  "action": "flag",
  "severity": "warning"
}
```

### 示例3：过滤特定平台数据

如果只想保留阿里拍卖和京东拍卖的数据：

```json
{
  "rule_name": "平台过滤",
  "rule_code": "PLATFORM_FILTER",
  "category": "property_type_filter",
  "config": {
    "allowed_types": ["阿里拍卖", "京东拍卖"]
  },
  "action": "delete",
  "severity": "critical"
}
```

注意：这个示例需要修改代码支持平台过滤规则类型。

## 监控与维护

### 查看系统日志

```bash
tail -f backend/backend.log | grep -i audit
```

### 检查定时任务

每天凌晨2点后，检查是否生成了新的审核任务：

```sql
SELECT * FROM audit_tasks 
WHERE task_type = 'scheduled' 
ORDER BY created_at DESC 
LIMIT 1;
```

### 查看数据质量趋势

在"审核任务"页面，对比最近几次审核的质量评分，关注数据质量变化趋势。

## 常见问题

### Q1：定时任务没有执行怎么办？

**A**：检查以下几点：
1. 后端服务是否正常运行
2. 环境变量 `ENABLE_AUDIT_SCHEDULER` 是否为 `True`
3. 查看后端日志是否有报错

### Q2：审核任务一直显示"执行中"？

**A**：可能是任务异常中断。查看后端日志确认错误原因，然后手动更新任务状态：

```sql
UPDATE audit_tasks SET status = 'failed', error_message = '任务超时' WHERE id = <任务ID>;
```

### Q3：如何临时禁用某条规则？

**A**：在"审核规则"页面，点击规则的启用开关即可禁用，禁用后该规则不会在下次审核时执行。

### Q4：delete动作会立即删除数据吗？

**A**：是的。配置为 `action=delete` 的规则在检测到违规时会立即删除数据，请谨慎使用。建议先设置为 `flag` 测试规则效果，确认无误后再改为 `delete`。

### Q5：可以修改定时任务的执行时间吗？

**A**：可以。修改 `backend/app/services/audit_scheduler.py` 文件中的 `target_time` 设置，例如改为凌晨3点：

```python
target_time = datetime.combine(now.date(), time(hour=3, minute=0))
```

修改后需要重启后端服务。

### Q6：审核会影响系统性能吗？

**A**：审核任务在后台线程中执行，不会阻塞API请求。但大量数据审核会增加数据库负载，建议在业务低峰期（如凌晨）执行。

## 数据字典

### 规则分类（category）

| 值 | 说明 |
|---|---|
| field_required | 必填字段检查 |
| field_range | 字段范围检查 |
| field_format | 字段格式检查 |
| region_filter | 地区过滤 |
| property_type_filter | 房产类型过滤 |

### 执行动作（action）

| 值 | 说明 |
|---|---|
| flag | 仅标记，不修改数据 |
| fix | 尝试自动修复（需配合auto_fix=true） |
| delete | 删除违规数据 |

### 严重级别（severity）

| 值 | 说明 | 前端颜色 |
|---|---|---|
| info | 信息 | 蓝色 |
| warning | 警告 | 橙色 |
| error | 错误 | 红色 |
| critical | 严重 | 深红色 |

### 任务状态（status）

| 值 | 说明 |
|---|---|
| pending | 待执行 |
| running | 执行中 |
| completed | 已完成 |
| failed | 失败 |

### 违规处理状态（violation status）

| 值 | 说明 |
|---|---|
| open | 待处理 |
| resolved | 已解决 |
| ignored | 已忽略 |

## 进阶配置

### 自定义审核范围

创建任务时，可以通过 `scope` 参数限制审核范围：

```json
{
  "task_name": "审核阿里拍卖数据",
  "rule_ids": [1, 2, 3],
  "scope": {
    "platforms": ["阿里拍卖"],
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    }
  }
}
```

### 批量处理违规记录

如果需要批量标记违规记录为已解决，可以使用API：

```bash
for id in {1..100}; do
  curl -X PUT "http://localhost:8000/api/admin/data-audit/violations/$id" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "resolved", "fix_note": "批量处理"}'
done
```

## 系统限制

1. **单次审核数据量**：建议不超过10万条，否则可能超时
2. **并发任务数**：同时只能运行1个审核任务
3. **规则数量**：建议不超过50条规则
4. **报告保存时间**：报告永久保存在数据库中

## 技术支持

- 设计文档：`docs/data-audit-design.md`
- 部署文档：`docs/data-audit-deployment.md`
- API文档：访问 `http://localhost:8000/docs`

## 更新日志

### v1.0.0 (2026-06-08)

- ✨ 新增数据审核清洗系统
- ✨ 支持5种规则类型
- ✨ 自动定时审核
- ✨ 可视化管理后台
- ✨ 审核报告生成
- ✨ 违规记录管理
