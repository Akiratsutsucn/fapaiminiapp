#!/bin/bash
# 部署数据审核执行历史功能

set -e

echo "=========================================="
echo "部署数据审核执行历史功能"
echo "=========================================="

# 1. 检查Python环境
echo ""
echo "1. 检查Python环境..."
python --version

# 2. 执行数据库迁移
echo ""
echo "2. 执行数据库迁移..."
cd /opt/fapai/backend
alembic upgrade head

# 3. 运行测试脚本（可选）
echo ""
echo "3. 运行测试脚本验证功能..."
python scripts/test_audit_execution.py

# 4. 重启审核调度器
echo ""
echo "4. 重启审核调度器..."
if command -v supervisorctl &> /dev/null; then
    sudo supervisorctl restart audit_scheduler
    echo "审核调度器已重启"
else
    echo "警告：未找到supervisorctl命令，请手动重启审核调度器"
fi

# 5. 验证API
echo ""
echo "5. 验证API端点..."
echo "执行历史列表: GET /api/admin/data-audit/executions"
echo "单次执行详情: GET /api/admin/data-audit/executions/{id}"
echo "统计摘要: GET /api/admin/data-audit/executions/stats/summary"

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "后续步骤："
echo "1. 等待明天凌晨5点，系统会自动执行审核并记录"
echo "2. 通过API查询执行历史：curl http://localhost:8000/api/admin/data-audit/executions"
echo "3. 在后台管理系统中查看可视化界面"
echo ""
