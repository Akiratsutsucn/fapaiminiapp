# 数据审核清洗系统 - 手动部署指南

## 部署方案

由于服务器不是Git仓库，需要手动上传文件。

## 方案一：使用WinSCP上传（推荐）

### 需要上传的新文件（6个）

从本地 `C:\Users\Administrator\Desktop\workspace\法拍者联盟小程序\backend` 上传到服务器：

1. `app/models/data_audit.py` → `/opt/fapai/backend/app/models/`
2. `app/services/data_audit_service.py` → `/opt/fapai/backend/app/services/`
3. `app/services/audit_scheduler.py` → `/opt/fapai/backend/app/services/`
4. `app/api/admin/data_audit.py` → `/opt/fapai/backend/app/api/admin/`
5. `scripts/init_audit_rules.py` → `/opt/fapai/backend/scripts/`
6. `alembic/versions/add_data_audit_tables.py` → `/opt/fapai/backend/alembic/versions/`

### 需要修改的现有文件（4个）

需要在服务器上手动编辑或替换：

1. `app/models/__init__.py` - 添加data_audit导入
2. `app/api/admin/__init__.py` - 添加路由注册
3. `app/core/config.py` - 添加ENABLE_AUDIT_SCHEDULER配置
4. `app/main.py` - 添加调度器启动代码

## 方案二：在服务器上直接执行部署

连接服务器后，在服务器上执行以下命令：

```bash
ssh -i xiaochengxu.pem ubuntu@122.51.156.252

# 进入项目目录
cd /opt/fapai/backend

# 创建必要目录
mkdir -p app/services scripts

# 修改迁移文件的revision
cd alembic/versions
# 需要手动编辑 add_data_audit_tables.py 修改 down_revision

# 执行迁移
cd /opt/fapai/backend
source /opt/fapai/venv/bin/activate
alembic upgrade head

# 初始化规则
PYTHONPATH=/opt/fapai/backend python3 scripts/init_audit_rules.py

# 重启服务
pkill -f "uvicorn app.main:app"
cd /opt/fapai/backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

## 验证部署

```bash
# 检查表是否创建
mysql -u fapai -pfapai123 shanghai_fapai -e "SHOW TABLES LIKE 'audit%';"

# 检查规则数量
mysql -u fapai -pfapai123 shanghai_fapai -e "SELECT COUNT(*) FROM audit_rules;"

# 查看日志
tail -f /opt/fapai/backend/backend.log
```
