# 数据审核清洗系统 - 文件清单和部署命令

## 📦 需要上传的文件清单

### 新增文件（6个）

| 本地路径 | 服务器路径 | 说明 |
|---------|-----------|------|
| `backend/app/models/data_audit.py` | `/opt/fapai/backend/app/models/data_audit.py` | 数据模型 |
| `backend/app/services/data_audit_service.py` | `/opt/fapai/backend/app/services/data_audit_service.py` | 审核服务 |
| `backend/app/services/audit_scheduler.py` | `/opt/fapai/backend/app/services/audit_scheduler.py` | 定时调度器 |
| `backend/app/api/admin/data_audit.py` | `/opt/fapai/backend/app/api/admin/data_audit.py` | API接口 |
| `backend/scripts/init_audit_rules.py` | `/opt/fapai/backend/scripts/init_audit_rules.py` | 规则初始化 |
| `backend/alembic/versions/add_data_audit_tables.py` | `/opt/fapai/backend/alembic/versions/add_data_audit_tables.py` | 数据库迁移 |

### 需要修改的文件（4个）

#### 1. backend/app/models/__init__.py

在第11行后添加：
```python
from .data_audit import AuditRule, AuditTask, AuditViolation, AuditReport
```

在 `__all__` 列表末尾添加：
```python
    "AuditRule", "AuditTask", "AuditViolation", "AuditReport",
```

#### 2. backend/app/api/admin/__init__.py

在第3行的imports后添加：
```python
from . import data_audit
```

在最后一个router注册后添加：
```python
router.include_router(data_audit.router, prefix="/data-audit", tags=["数据审核"])
```

#### 3. backend/app/core/config.py

在第48行（DEBUG配置后）添加：
```python
    # ===== data audit scheduler =====
    ENABLE_AUDIT_SCHEDULER: bool = True
```

#### 4. backend/app/main.py

将 lifespan 函数替换为：
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    # 启动数据审核调度器（后台任务）
    audit_task = None
    if settings.ENABLE_AUDIT_SCHEDULER:
        from .services.audit_scheduler import start_audit_scheduler
        audit_task = asyncio.create_task(start_audit_scheduler())
        logger.info("数据审核调度器已启动")

    yield

    # 关闭调度器
    if audit_task:
        audit_task.cancel()
        try:
            await audit_task
        except asyncio.CancelledError:
            logger.info("数据审核调度器已停止")
```

在文件开头导入部分添加：
```python
import asyncio
from loguru import logger
```

## 🚀 部署命令（服务器端执行）

```bash
# 1. 连接服务器
ssh -i "xiaochengxu.pem" ubuntu@122.51.156.252

# 2. 进入项目目录
cd /opt/fapai/backend

# 3. 备份现有文件
cp app/models/__init__.py app/models/__init__.py.bak
cp app/api/admin/__init__.py app/api/admin/__init__.py.bak
cp app/core/config.py app/core/config.py.bak
cp app/main.py app/main.py.bak

# 4. 创建必要目录
mkdir -p app/services

# 5. 修改迁移文件的 down_revision
# 需要将 add_data_audit_tables.py 中的 down_revision = 'head' 改为最新的revision
cd alembic/versions
LATEST=$(ls -t *.py | grep -v add_data | head -1 | sed 's/_.*//'); echo $LATEST
# 手动编辑 add_data_audit_tables.py，将 down_revision 改为上面显示的值

# 6. 执行数据库迁移
cd /opt/fapai/backend
source /opt/fapai/venv/bin/activate
alembic upgrade head

# 7. 初始化审核规则
PYTHONPATH=/opt/fapai/backend python3 scripts/init_audit_rules.py

# 8. 重启后端服务
pkill -f "uvicorn app.main:app"
sleep 2
cd /opt/fapai/backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &

# 9. 验证部署
sleep 3
tail -30 backend.log | grep -E "(调度器|error|Error)"

# 10. 检查数据库
mysql -u fapai -pfapai123 shanghai_fapai -e "SHOW TABLES LIKE 'audit%';"
mysql -u fapai -pfapai123 shanghai_fapai -e "SELECT COUNT(*) FROM audit_rules;"
```

## ✅ 验证清单

- [ ] 数据库中有4张audit表
- [ ] audit_rules表有10条记录
- [ ] 后端日志显示"数据审核调度器已启动"
- [ ] API文档可访问：http://122.51.156.252:8000/docs
- [ ] 管理后台显示"数据审核"菜单

## 📞 需要帮助？

如果遇到问题，请提供：
1. 执行到哪一步
2. 错误日志内容
3. 数据库连接是否正常
