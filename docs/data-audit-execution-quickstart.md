# 数据审核执行历史 - 快速开始

## 一、快速部署（3分钟）

```bash
# 1. 进入项目目录
cd /opt/fapai/backend

# 2. 执行数据库迁移
alembic upgrade head

# 3. 重启服务
sudo supervisorctl restart fapai-backend
sudo supervisorctl restart audit_scheduler

# 完成！
```

## 二、验证部署

### 方式1：运行测试脚本
```bash
cd /opt/fapai/backend
python scripts/test_audit_execution.py
```

### 方式2：直接查询数据库
```sql
-- 查看表是否创建成功
SHOW TABLES LIKE 'data_audit_executions';

-- 查看表结构
DESC data_audit_executions;
```

### 方式3：调用API
```bash
# 查询执行历史（需要管理员token）
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:8000/api/admin/data-audit/executions"
```

## 三、API使用示例

### 1. 获取最近30天的执行历史
```bash
curl "http://localhost:8000/api/admin/data-audit/executions?page=1&page_size=20"
```

### 2. 按日期范围查询
```bash
curl "http://localhost:8000/api/admin/data-audit/executions?start_date=2026-06-01&end_date=2026-06-08"
```

### 3. 只查看失败的执行
```bash
curl "http://localhost:8000/api/admin/data-audit/executions?status=failed"
```

### 4. 获取统计摘要
```bash
curl "http://localhost:8000/api/admin/data-audit/executions/stats/summary?days=30"
```

### 5. 查看单次执行详情
```bash
curl "http://localhost:8000/api/admin/data-audit/executions/1"
```

## 四、查看执行记录

### 等待自动执行
系统每天凌晨 **5:00** 自动执行审核任务并记录执行历史。

### 手动创建测试记录
```bash
cd /opt/fapai/backend
python scripts/test_audit_execution.py
```

### 数据库直接查询
```sql
-- 查看最近10条执行记录
SELECT 
    id, 
    execution_time, 
    properties_checked, 
    properties_deleted, 
    properties_fixed, 
    status,
    execution_duration
FROM data_audit_executions
ORDER BY execution_time DESC
LIMIT 10;

-- 查看违规统计
SELECT 
    id,
    execution_time,
    violations_found
FROM data_audit_executions
WHERE violations_found IS NOT NULL
ORDER BY execution_time DESC;
```

## 五、常见问题

### Q1: 表创建失败？
```bash
# 检查alembic版本
alembic current

# 查看待执行的迁移
alembic heads

# 强制升级到最新版本
alembic upgrade head
```

### Q2: API返回404？
检查路由是否正确注册，确认服务已重启：
```bash
sudo supervisorctl status fapai-backend
sudo supervisorctl restart fapai-backend
```

### Q3: 没有看到执行记录？
- 检查是否已等待到第二天凌晨5点
- 或运行测试脚本手动创建记录
- 检查audit_scheduler服务是否正常运行

### Q4: 时间显示不对？
所有时间使用服务器本地时区，确认服务器时区设置：
```bash
date
timedatectl
```

## 六、监控建议

### 检查定时任务是否正常
```bash
# 查看调度器日志
tail -f /opt/fapai/backend/logs/audit_scheduler.log

# 检查最近一次执行时间
SELECT MAX(execution_time) FROM data_audit_executions;
```

### 设置告警
- 如果超过24小时没有新记录，说明定时任务未执行
- 如果连续失败，需要检查错误信息
- 如果删除数量异常激增，需要人工审查

## 七、数据清理

### 手动清理90天前的记录
```sql
-- 查看90天前的记录数
SELECT COUNT(*) FROM data_audit_executions 
WHERE execution_time < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- 删除90天前的记录
DELETE FROM data_audit_executions 
WHERE execution_time < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### 定时清理脚本（可选）
```bash
# 创建清理脚本
cat > /opt/fapai/backend/scripts/cleanup_old_executions.sh << 'EOF'
#!/bin/bash
mysql -u user -p'password' database << SQL
DELETE FROM data_audit_executions 
WHERE execution_time < DATE_SUB(NOW(), INTERVAL 90 DAY);
SQL
EOF

# 添加到crontab（每月1号凌晨2点执行）
crontab -e
0 2 1 * * /opt/fapai/backend/scripts/cleanup_old_executions.sh
```

## 八、完整工作流

```mermaid
graph LR
    A[每天5:00] --> B[调度器启动审核任务]
    B --> C[记录开始时间]
    C --> D[执行审核]
    D --> E[统计结果]
    E --> F[创建执行记录]
    F --> G[保存到数据库]
    G --> H[前端可查询]
```

## 九、相关文档

- **功能文档**: `docs/data-audit-execution-history.md`
- **部署清单**: `docs/data-audit-execution-deployment-checklist.md`
- **实施总结**: `docs/data-audit-execution-summary.md`

## 十、技术支持

如有问题，请检查：
1. 服务日志: `/opt/fapai/backend/logs/`
2. 数据库连接是否正常
3. 调度器是否在运行
4. API服务是否正常响应

---

**就这么简单！** 3分钟完成部署，立即开始记录审核历史。
