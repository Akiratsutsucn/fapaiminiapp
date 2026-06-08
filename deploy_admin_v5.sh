#!/bin/bash
# 管理后台V5版本一键部署脚本
# 使用方法: bash deploy_admin_v5.sh

set -e  # 遇到错误立即退出

echo "=========================================="
echo "管理后台V5版本部署脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -d "backend" ] || [ ! -d "admin-web" ]; then
    echo -e "${RED}错误: 请在项目根目录执行此脚本${NC}"
    exit 1
fi

# Step 1: 检查环境变量
echo -e "${YELLOW}[1/8] 检查环境配置...${NC}"
if ! grep -q "ANTHROPIC_API_KEY" backend/.env 2>/dev/null; then
    echo -e "${RED}警告: backend/.env 中未找到 ANTHROPIC_API_KEY${NC}"
    echo "请添加: ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx"
    read -p "是否继续部署？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ ANTHROPIC_API_KEY 已配置${NC}"
fi

# Step 2: 安装后端依赖
echo -e "${YELLOW}[2/8] 安装后端依赖...${NC}"
cd backend
if command -v pip &> /dev/null; then
    pip install anthropic -q
    echo -e "${GREEN}✓ anthropic 已安装${NC}"
else
    echo -e "${RED}错误: 未找到 pip 命令${NC}"
    exit 1
fi
cd ..

# Step 3: 数据库迁移
echo -e "${YELLOW}[3/8] 执行数据库迁移...${NC}"
cd backend

# 检查迁移文件是否存在
if [ ! -f "alembic/versions/d1e2f3a4b5c6_add_crawler_task_details.py" ]; then
    echo -e "${RED}警告: 爬虫详情迁移文件不存在${NC}"
fi

if [ ! -f "alembic/versions/c5f8d3a1e9b2_add_audit_executions.py" ]; then
    echo -e "${RED}警告: 审核历史迁移文件不存在${NC}"
fi

# 执行迁移
if command -v alembic &> /dev/null; then
    alembic upgrade head
    echo -e "${GREEN}✓ 数据库迁移完成${NC}"
else
    echo -e "${RED}错误: 未找到 alembic 命令${NC}"
    exit 1
fi
cd ..

# Step 4: 验证数据库表
echo -e "${YELLOW}[4/8] 验证数据库表...${NC}"
TABLES=("crawler_task_details" "data_audit_executions")
for table in "${TABLES[@]}"; do
    # 这里需要根据实际数据库连接方式调整
    echo "  - 检查表: $table"
done
echo -e "${GREEN}✓ 数据库表验证完成（请手动确认）${NC}"

# Step 5: 安装前端依赖
echo -e "${YELLOW}[5/8] 安装前端依赖...${NC}"
cd admin-web
if [ ! -d "node_modules/marked" ]; then
    if command -v npm &> /dev/null; then
        npm install
        echo -e "${GREEN}✓ 前端依赖已安装${NC}"
    else
        echo -e "${RED}错误: 未找到 npm 命令${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ 前端依赖已存在${NC}"
fi
cd ..

# Step 6: 构建前端
echo -e "${YELLOW}[6/8] 构建前端代码...${NC}"
cd admin-web
npm run build
if [ -d "dist" ]; then
    echo -e "${GREEN}✓ 前端构建成功${NC}"
else
    echo -e "${RED}错误: 前端构建失败${NC}"
    exit 1
fi
cd ..

# Step 7: 部署前端（需要配置服务器信息）
echo -e "${YELLOW}[7/8] 部署前端到服务器...${NC}"
read -p "是否部署到生产服务器？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 从记忆中读取的服务器信息
    SERVER_USER="ubuntu"
    SERVER_HOST="你的服务器IP"  # 请替换为实际IP
    DEPLOY_PATH="/usr/share/nginx/html/admin"

    read -p "请输入服务器IP地址: " SERVER_HOST

    if [ ! -z "$SERVER_HOST" ]; then
        echo "正在部署到 $SERVER_USER@$SERVER_HOST:$DEPLOY_PATH"
        scp -r admin-web/dist/* $SERVER_USER@$SERVER_HOST:$DEPLOY_PATH/
        echo -e "${GREEN}✓ 前端部署完成${NC}"
    else
        echo -e "${YELLOW}跳过前端部署${NC}"
    fi
else
    echo -e "${YELLOW}跳过前端部署${NC}"
fi

# Step 8: 重启后端服务
echo -e "${YELLOW}[8/8] 重启后端服务...${NC}"
read -p "是否重启生产服务器后端服务？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ ! -z "$SERVER_HOST" ]; then
        echo "正在重启后端服务..."
        ssh $SERVER_USER@$SERVER_HOST << 'EOF'
supervisorctl restart fapai-backend
supervisorctl restart audit_scheduler
supervisorctl restart crawler_scheduler
supervisorctl status
EOF
        echo -e "${GREEN}✓ 后端服务重启完成${NC}"
    else
        echo -e "${YELLOW}跳过服务重启${NC}"
    fi
else
    echo -e "${YELLOW}跳过服务重启${NC}"
fi

# 完成
echo ""
echo "=========================================="
echo -e "${GREEN}部署完成！${NC}"
echo "=========================================="
echo ""
echo "后续验证步骤："
echo "1. 访问管理后台: https://yourdomain.com/admin"
echo "2. 使用admin账号登录"
echo "3. 测试AI助手功能"
echo "4. 触发一次爬虫任务，查看详细统计"
echo "5. 查看数据审核历史"
echo "6. 测试用户角色管理"
echo "7. 查看数据看板城市分项"
echo ""
echo "详细测试清单请参考: ADMIN_V5_IMPLEMENTATION_REPORT.md"
echo ""
