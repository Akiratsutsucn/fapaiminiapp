# 数据审核执行历史功能文档

## 功能概述

数据审核执行历史模块记录每次定时审核任务的详细信息，包括：
- 执行时间
- 应用的审核规则
- 检查、删除、修复的房源数量
- 违规详情统计
- 执行耗时
- 执行状态（成功/失败）

## 数据库变更

### 新增表：data_audit_executions

```sql
CREATE TABLE data_audit_executions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    execution_time DATETIME NOT NULL COMMENT '执行时间',
    rules_applied JSON COMMENT '应用的规则列表',
    properties_checked INT DEFAULT 0 COMMENT '检查的房源数',
    properties_deleted INT DEFAULT 0 COMMENT '删除的房源数',
    properties_fixed INT DEFAULT 0 COMMENT '修复的房源数',
    violations_found JSON COMMENT '违规详情统计',
    execution_duration INT COMMENT '执行耗时（秒）',
    status VARCHAR(32) DEFAULT 'completed' COMMENT '执行状态',
    error_message TEXT COMMENT '错误信息',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_audit_exec_time (execution_time DESC)
);
```

### 数据示例

```json
{
  "id": 1,
  "execution_time": "2026-06-08 05:00:00",
  "rules_applied": [
    {
      "rule_id": 1,
      "rule_name": "清理非房产数据",
      "rule_code": "non_property_filter",
      "enabled": true,
      "action": "delete"
    }
  ],
  "properties_checked": 1500,
  "properties_deleted": 23,
  "properties_fixed": 45,
  "violations_found": {
    "清理非房产数据": 23,
    "修复必填字段": 30
  },
  "execution_duration": 180,
  "status": "completed"
}
```

## API 接口

### 1. 获取执行历史列表

```
GET /api/admin/data-audit/executions
```

**查询参数：**
- `start_date`: 开始日期（可选，格式：2026-06-01）
- `end_date`: 结束日期（可选，格式：2026-06-08）
- `status`: 状态过滤（可选，completed/failed）
- `page`: 页码（默认：1）
- `page_size`: 每页数量（默认：20）

### 2. 获取单次执行详情

```
GET /api/admin/data-audit/executions/{execution_id}
```

### 3. 获取执行历史统计摘要

```
GET /api/admin/data-audit/executions/stats/summary?days=30
```

## 部署步骤

### 1. 执行数据库迁移

```bash
cd backend
alembic upgrade head
```

### 2. 重启审核调度器

```bash
supervisorctl restart audit_scheduler
```

### 3. 验证功能

```bash
cd backend
python scripts/test_audit_execution.py
```

## 相关文件

- 模型：`backend/app/models/data_audit.py` (DataAuditExecution)
- 调度器：`backend/app/services/audit_scheduler.py`
- API：`backend/app/api/admin/data_audit.py`
- 迁移：`backend/alembic/versions/c5f8d3a1e9b2_add_audit_executions.py`
- 测试：`backend/scripts/test_audit_execution.py`
