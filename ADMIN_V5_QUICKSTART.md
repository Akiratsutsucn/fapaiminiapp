# 管理后台V5 - 5分钟快速开始

## 🚀 最快部署方式

### 前提条件
- 已有正常运行的后端服务
- 已有可访问的数据库
- 有服务器SSH访问权限

---

## 步骤1: 配置API Key (1分钟)

```bash
# SSH到服务器
ssh ubuntu@你的服务器IP

# 编辑.env文件
cd /opt/fapai/backend
nano .env

# 添加这一行（替换为你的真实API Key）
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# 保存退出 (Ctrl+X, Y, Enter)
```

**获取API Key**: 访问 https://console.anthropic.com/settings/keys

---

## 步骤2: 安装依赖 (1分钟)

```bash
# 安装Python依赖
pip install anthropic

# 回到本地，安装前端依赖
cd admin-web
npm install
```

---

## 步骤3: 数据库迁移 (1分钟)

```bash
# 在服务器上
cd /opt/fapai/backend
alembic upgrade head

# 验证表创建
psql -U your_user -d fapai -c "SELECT COUNT(*) FROM crawler_task_details;"
psql -U your_user -d fapai -c "SELECT COUNT(*) FROM data_audit_executions;"
```

---

## 步骤4: 构建和部署前端 (1分钟)

```bash
# 在本地
cd admin-web
npm run build

# 部署到服务器
scp -r dist/* ubuntu@服务器IP:/usr/share/nginx/html/admin/
```

---

## 步骤5: 重启服务 (1分钟)

```bash
# SSH到服务器
ssh ubuntu@你的服务器IP

# 重启所有相关服务
supervisorctl restart fapai-backend
supervisorctl restart audit_scheduler
supervisorctl restart crawler_scheduler

# 查看状态
supervisorctl status
```

---

## 🎉 完成！现在测试

### 1. 访问管理后台
```
https://你的域名/admin
```

### 2. 使用admin账号登录

### 3. 测试AI助手
- 点击左侧菜单"AI助手"
- 点击"新建会话"
- 输入"系统概览"
- 应该看到流式响应

### 4. 测试爬虫详情
- 点击"爬虫管理"
- 点击"全量抓取（所有平台）"
- 等待5-10分钟
- 刷新页面，点击最新任务的"查看详情"
- 应该看到3×3网格

### 5. 测试审核历史
- 点击"审核历史"
- 应该看到历史记录列表（如果已运行过审核）

### 6. 测试角色管理
- 点击"用户管理"
- 点击"创建用户"
- 填写：昵称"测试领导"，手机"13800000001"，角色"领导"
- 保存成功
- 退出登录
- 使用"13800000001"和密码"123456"登录
- 验证只能查看不能编辑

### 7. 测试数据看板
- 点击"数据看板"
- 城市选择"全部"
- 点击任意指标的"查看明细"
- 应该看到三城数据

---

## ❌ 常见错误排查

### AI助手无响应
```bash
# 检查API Key
grep ANTHROPIC_API_KEY /opt/fapai/backend/.env

# 检查日志
tail -f /opt/fapai/backend/logs/app.log
```

### 爬虫详情为空
```bash
# 检查表是否存在
psql -U your_user -d fapai -c "\d crawler_task_details"

# 重新触发一次爬虫
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.yourdomain.com/api/admin/crawler/trigger
```

### 角色权限不生效
- 清除浏览器缓存
- 清除LocalStorage
- 重新登录

### 前端404
```bash
# 检查nginx配置
cat /etc/nginx/sites-enabled/default | grep admin

# 检查文件是否部署
ls -la /usr/share/nginx/html/admin/

# 重启nginx
sudo systemctl restart nginx
```

---

## 📞 获取帮助

### 查看详细文档
```bash
# 完整实施报告
cat ADMIN_V5_IMPLEMENTATION_REPORT.md

# API文档
cat ADMIN_V5_API_DOCUMENTATION.md

# 测试清单
cat ADMIN_V5_TEST_CHECKLIST.md
```

### 检查服务状态
```bash
# 所有服务状态
supervisorctl status

# 查看后端日志
tail -100 /opt/fapai/backend/logs/app.log

# 查看爬虫日志
tail -100 /opt/fapai/backend/logs/crawler.log

# 查看审核日志
tail -100 /opt/fapai/backend/logs/audit.log
```

---

## 🎯 下一步

### 今天完成
- ✅ 部署完成
- ⬜ 基础功能测试
- ⬜ 创建测试账号（各角色）
- ⬜ 验证权限正确

### 本周完成
- ⬜ 完整测试清单验证
- ⬜ 收集用户反馈
- ⬜ 优化发现的问题

### 下周计划
- ⬜ AI会话持久化到Redis
- ⬜ 添加监控和告警
- ⬜ 性能优化

---

## 📊 部署验证命令

```bash
# 一键验证脚本
cat > /tmp/verify_v5.sh << 'EOF'
#!/bin/bash
echo "=== V5部署验证 ==="
echo ""

echo "1. 检查环境变量..."
grep -q ANTHROPIC_API_KEY /opt/fapai/backend/.env && echo "✅ API Key已配置" || echo "❌ API Key未配置"

echo ""
echo "2. 检查Python依赖..."
pip show anthropic &>/dev/null && echo "✅ anthropic已安装" || echo "❌ anthropic未安装"

echo ""
echo "3. 检查数据库表..."
psql -U fapai -d fapai -c "SELECT 1 FROM crawler_task_details LIMIT 1" &>/dev/null && echo "✅ crawler_task_details表存在" || echo "❌ 表不存在"
psql -U fapai -d fapai -c "SELECT 1 FROM data_audit_executions LIMIT 1" &>/dev/null && echo "✅ data_audit_executions表存在" || echo "❌ 表不存在"

echo ""
echo "4. 检查服务状态..."
supervisorctl status fapai-backend | grep -q RUNNING && echo "✅ 后端服务运行中" || echo "❌ 后端服务未运行"
supervisorctl status audit_scheduler | grep -q RUNNING && echo "✅ 审核调度器运行中" || echo "❌ 审核调度器未运行"

echo ""
echo "5. 检查前端部署..."
[ -f "/usr/share/nginx/html/admin/index.html" ] && echo "✅ 前端文件已部署" || echo "❌ 前端文件未找到"

echo ""
echo "=== 验证完成 ==="
EOF

chmod +x /tmp/verify_v5.sh
bash /tmp/verify_v5.sh
```

---

## 🔄 回滚方案

如果部署失败需要回滚：

```bash
# 1. 回滚数据库
cd /opt/fapai/backend
alembic downgrade -1  # 回退一个版本

# 2. 回滚前端（使用之前的备份）
sudo rm -rf /usr/share/nginx/html/admin/*
sudo cp -r /path/to/backup/* /usr/share/nginx/html/admin/

# 3. 重启服务
supervisorctl restart all

# 4. 验证服务正常
curl https://your-domain.com/admin
```

**重要**: 部署前建议先备份：
```bash
# 备份数据库
pg_dump -U fapai fapai > backup_$(date +%Y%m%d).sql

# 备份前端
tar -czf admin_backup_$(date +%Y%m%d).tar.gz /usr/share/nginx/html/admin/
```

---

## ✅ 成功标志

部署成功的标志：
- ✅ 可以正常访问管理后台
- ✅ AI助手可以发送消息并收到回复
- ✅ 爬虫任务详情可以展开查看
- ✅ 审核历史页面可以打开
- ✅ 可以创建不同角色的用户
- ✅ 数据看板显示城市分项
- ✅ 后端日志无ERROR级别错误

---

**预计总耗时**: 5-10分钟  
**难度**: ⭐⭐☆☆☆ (简单)  
**风险**: ⭐☆☆☆☆ (低)

**祝部署顺利！** 🎉
