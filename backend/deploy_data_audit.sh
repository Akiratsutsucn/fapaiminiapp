#!/bin/bash
# 数据审核清洗系统部署脚本

echo "======================================"
echo "数据审核清洗系统部署开始"
echo "======================================"

# 1. 备份现有文件
echo "[1/6] 备份现有文件..."
cd /opt/fapai/backend
cp app/models/__init__.py app/models/__init__.py.bak_$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# 2. 创建必要的目录
echo "[2/6] 创建目录..."
mkdir -p app/services
mkdir -p scripts

# 3. 执行数据库迁移
echo "[3/6] 执行数据库迁移..."
cd /opt/fapai/backend
source /opt/fapai/venv/bin/activate
alembic upgrade head

# 4. 初始化审核规则
echo "[4/6] 初始化审核规则..."
PYTHONPATH=/opt/fapai/backend python3 /opt/fapai/backend/scripts/init_audit_rules.py

# 5. 重启后端服务
echo "[5/6] 重启后端服务..."
pkill -f "uvicorn app.main:app"
sleep 2
cd /opt/fapai/backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &

sleep 3
tail -20 backend.log

echo ""
echo "======================================"
echo "✓ 部署完成！"
echo "======================================"
