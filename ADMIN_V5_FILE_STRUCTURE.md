# 管理后台V5版本 - 项目文件结构

```
法拍者联盟小程序/
│
├── 📄 deploy_admin_v5.sh                          # 一键部署脚本
├── 📄 ADMIN_V5_IMPLEMENTATION_REPORT.md           # 完整实施报告 ⭐
├── 📄 ADMIN_V5_API_DOCUMENTATION.md               # API文档 ⭐
├── 📄 ADMIN_V5_TEST_CHECKLIST.md                  # 测试清单 ⭐
├── 📄 ADMIN_V5_FINAL_SUMMARY.md                   # 项目总结 ⭐
│
├── admin-web/                                      # 前端项目
│   ├── 📄 ADMIN_V5_PLAN.md                        # 技术方案
│   ├── 📄 package.json                            # ✏️ 新增marked依赖
│   │
│   ├── src/
│   │   ├── views/
│   │   │   ├── ai/
│   │   │   │   └── 📄 AiAssistantView.vue        # ✨ 新建 - AI助手界面
│   │   │   │
│   │   │   ├── crawler/
│   │   │   │   └── 📄 CrawlerView.vue            # ✏️ 修改 - 增加任务详情展示
│   │   │   │
│   │   │   ├── data-audit/
│   │   │   │   └── 📄 ExecutionsView.vue         # ✨ 新建 - 审核历史页面
│   │   │   │
│   │   │   ├── user/
│   │   │   │   └── 📄 UserList.vue               # ✏️ 修改 - 角色管理增强
│   │   │   │
│   │   │   └── dashboard/
│   │   │       └── 📄 Dashboard.vue              # ✏️ 修改 - 城市分项展示
│   │   │
│   │   ├── api/
│   │   │   ├── 📄 ai.ts                          # ✨ 新建 - AI助手API
│   │   │   ├── 📄 dataAudit.ts                   # ✨ 新建 - 审核历史API
│   │   │   ├── 📄 crawler.ts                     # ✏️ 修改 - 增加详情API
│   │   │   └── 📄 users.ts                       # ✏️ 修改 - 增加角色API
│   │   │
│   │   ├── 📄 router/index.ts                    # ✏️ 修改 - 新增路由和权限
│   │   │
│   │   └── layouts/
│   │       └── 📄 AdminLayout.vue                # ✏️ 修改 - 菜单调整
│   │
│   └── dist/                                      # 构建产物（部署此目录）
│
├── backend/                                        # 后端项目
│   │
│   ├── 📄 .env                                    # ⚠️ 需添加 ANTHROPIC_API_KEY
│   ├── 📄 README_AI.md                            # ✨ AI助手使用文档
│   ├── 📄 ROLE_MANAGEMENT_IMPLEMENTATION.md       # ✨ 角色管理实施文档
│   ├── 📄 IMPLEMENTATION_SUMMARY.md               # ✨ 爬虫详情实施总结
│   ├── 📄 DEPLOYMENT_CHECKLIST.txt                # ✨ 部署检查清单
│   │
│   ├── app/
│   │   ├── models/
│   │   │   ├── 📄 user.py                        # ✏️ 修改 - 扩展role字段
│   │   │   ├── 📄 crawl.py                       # ✏️ 修改 - 新增CrawlerTaskDetail模型
│   │   │   └── 📄 data_audit.py                  # ✏️ 修改 - 新增DataAuditExecution模型
│   │   │
│   │   ├── core/
│   │   │   └── 📄 security.py                    # ✏️ 修改 - 权限中间件
│   │   │
│   │   ├── api/
│   │   │   └── admin/
│   │   │       ├── 📄 __init__.py                # ✏️ 修改 - 注册AI路由
│   │   │       ├── 📄 ai.py                      # ✨ 新建 - AI助手API
│   │   │       ├── 📄 ai_tools.py                # ✨ 新建 - AI工具函数
│   │   │       ├── 📄 auth.py                    # ✏️ 修改 - 登录控制
│   │   │       ├── 📄 users.py                   # ✏️ 修改 - 用户管理增强
│   │   │       ├── 📄 dashboard.py               # ✏️ 修改 - 城市分项
│   │   │       ├── 📄 crawler.py                 # ✏️ 修改 - 任务详情API
│   │   │       ├── 📄 data_audit.py              # ✏️ 修改 - 审核历史API
│   │   │       ├── 📄 properties.py              # ✏️ 修改 - 应用权限控制
│   │   │       ├── 📄 demands.py                 # ✏️ 修改 - 应用权限控制
│   │   │       ├── 📄 articles.py                # ✏️ 修改 - 应用权限控制
│   │   │       ├── 📄 banners.py                 # ✏️ 修改 - 应用权限控制
│   │   │       ├── 📄 communities.py             # ✏️ 修改 - 应用权限控制
│   │   │       └── 📄 settings.py                # ✏️ 修改 - 应用权限控制
│   │   │
│   │   └── services/
│   │       └── 📄 audit_scheduler.py             # ✏️ 修改 - 集成审核记录
│   │
│   ├── crawler/
│   │   ├── 📄 engine.py                          # ✏️ 修改 - 详细统计逻辑
│   │   ├── storage/
│   │   │   └── 📄 repository.py                  # ✏️ 修改 - 新增DetailRepository
│   │   └── platforms/
│   │       └── 📄 base.py                        # ✏️ 修改 - ListItem新增city字段
│   │
│   ├── alembic/
│   │   └── versions/
│   │       ├── 📄 d1e2f3a4b5c6_add_crawler_task_details.py    # ✨ 新建 - 爬虫详情表
│   │       └── 📄 c5f8d3a1e9b2_add_audit_executions.py        # ✨ 新建 - 审核历史表
│   │
│   ├── migrations/
│   │   └── 📄 add_new_roles.sql                  # ✨ 新建 - 角色数据
│   │
│   ├── scripts/
│   │   └── 📄 test_audit_execution.py            # ✨ 新建 - 审核测试脚本
│   │
│   ├── 📄 test_crawler_details.py                # ✨ 新建 - 爬虫测试脚本
│   └── 📄 deploy_audit_execution_history.sh      # ✨ 新建 - 审核部署脚本
│
└── docs/                                          # 文档目录
    ├── 📄 data-audit-execution-history.md         # ✨ 审核功能文档
    ├── 📄 data-audit-execution-deployment-checklist.md  # ✨ 审核部署清单
    ├── 📄 data-audit-execution-summary.md         # ✨ 审核实施总结
    └── 📄 data-audit-execution-quickstart.md      # ✨ 审核快速开始
```

---

## 图例说明

- ✨ **新建文件** - 本次V5版本新增
- ✏️ **修改文件** - 基于现有文件改造
- ⭐ **重要文档** - 必读文档
- ⚠️ **需要配置** - 部署前必须配置

---

## 文件统计

### 前端
- 新建: 4个Vue组件 + 2个API客户端 = **6个文件**
- 修改: 5个Vue组件 + 2个API客户端 + 1个路由 + 1个布局 + 1个配置 = **10个文件**

### 后端
- 新建: 2个API模块 + 2个迁移脚本 + 4个测试/部署脚本 = **8个文件**
- 修改: 3个模型 + 1个中间件 + 9个API模块 + 3个爬虫文件 + 1个调度器 = **17个文件**

### 文档
- 技术方案: 1个
- API文档: 1个
- 测试清单: 1个
- 实施报告: 1个
- 项目总结: 1个
- 模块文档: 8个

**总计**: 新建26个，修改27个，共**53个文件**涉及改动

---

## 核心流程图

### AI助手对话流程
```
用户输入消息
    ↓
前端发送GET请求 (/api/admin/ai/chat?message=xxx)
    ↓
后端接收请求，创建SSE连接
    ↓
调用Claude API (anthropic.messages.create)
    ↓
流式返回 (yield "data: {...}\n\n")
    ↓
AI可能调用工具 (query_database/get_crawler_status等)
    ↓
继续流式返回结果
    ↓
发送 "data: {type: 'done'}"
    ↓
前端关闭EventSource
    ↓
消息保存到会话历史
```

### 爬虫详情统计流程
```
定时任务触发 (凌晨2点)
    ↓
创建 crawler_task 记录
    ↓
Engine.run() 执行爬虫
    ↓
按平台循环 (阿里/京东/公拍网)
    ↓
  按城市统计初始化 (上海/宁波/杭州)
    ↓
  抓取列表页 (item.city自动识别)
    ↓
  抓取详情页 (按城市归类统计)
    ↓
  保存到 crawler_task_details 表
    ↓
下一个平台
    ↓
任务完成，更新 crawler_task.status
```

### 数据审核记录流程
```
定时任务触发 (凌晨5点)
    ↓
audit_scheduler.create_daily_audit_task()
    ↓
记录开始时间、准备规则列表
    ↓
执行审核逻辑 (遍历规则)
    ↓
统计: 检查数/删除数/修复数/违规详情
    ↓
计算执行耗时
    ↓
创建 data_audit_executions 记录
    ↓
前端通过 /api/admin/data-audit/executions 查询
```

### 角色权限检查流程
```
用户访问API端点
    ↓
JWT Token验证 (get_admin_user)
    ↓
提取用户角色 (admin/leader/content_manager/agent)
    ↓
模块级权限检查 (check_module_permission)
    ↓
  - 查ROLE_PERMISSIONS映射
  - 判断role是否可访问该模块
    ↓
操作级权限检查 (check_write_permission)
    ↓
  - 如果是GET请求，通过
  - 如果是POST/PUT/DELETE
    - admin: 通过
    - leader: 拒绝 (403)
    - content_manager: 检查模块白名单
    - agent: 检查模块白名单
    ↓
执行业务逻辑
    ↓
返回响应
```

---

## 数据库表关系

```
users (现有)
  ├─ role: 扩展支持 leader, content_manager
  └─ 关联: inviter_id → users.id

crawler_tasks (现有)
  └─ 1:N → crawler_task_details (新增)
              ├─ platform (阿里拍卖/京东拍卖/公拍网)
              ├─ city (上海/宁波/杭州)
              ├─ total_fetched
              ├─ new_count
              ├─ updated_count
              ├─ failed_count
              └─ error_messages

data_audit_rules (现有)
  └─ 被引用 → data_audit_executions.rules_applied (新增)
                  ├─ execution_time
                  ├─ rules_applied (JSONB)
                  ├─ properties_checked
                  ├─ properties_deleted
                  ├─ properties_fixed
                  └─ violations_found (JSONB)

properties (现有)
  ├─ city_id (用于城市分项统计)
  └─ 被所有模块查询
```

---

## API端点汇总

### AI助手 (5个)
- GET  /api/admin/ai/sessions
- POST /api/admin/ai/sessions
- DELETE /api/admin/ai/sessions/{id}
- GET  /api/admin/ai/sessions/{id}/messages
- GET  /api/admin/ai/chat (SSE)

### 爬虫管理 (1个新增)
- GET  /api/admin/crawler/tasks/{id}/details

### 数据审核 (3个新增)
- GET  /api/admin/data-audit/executions
- GET  /api/admin/data-audit/executions/{id}
- GET  /api/admin/data-audit/executions/stats/summary

### 用户管理 (3个新增)
- GET  /api/admin/users/me/permissions
- GET  /api/admin/users/roles/list
- PUT  /api/admin/users/{id}/role

### 数据看板 (1个修改)
- GET  /api/admin/dashboard (响应增加 by_city 字段)

**总计**: 新增12个端点，修改1个端点

---

## 前端路由汇总

### 新增路由 (2个)
- /ai-assistant → AiAssistantView.vue (仅admin可访问)
- /data-audit/executions → ExecutionsView.vue (仅admin可访问)

### 修改路由 (0个)
所有现有路由保持不变，仅调整权限配置

### 权限常量
```typescript
ADMIN_ONLY = ['admin']
ADMIN_OR_AGENT = ['admin', 'agent']
CONTENT_MANAGER = ['admin', 'content_manager']
LEADER_AND_ABOVE = ['admin', 'leader']
```

---

## 菜单结构

```
管理后台
├── 数据看板 (admin, agent, leader可见)
├── 用户管理 (admin, agent可见)
├── 房源管理 (admin可见)
├── 需求管理 (admin, agent可见)
├── 文章管理 (admin, content_manager可见)
├── 横幅管理 (admin, content_manager可见)
├── 爬虫管理 (admin, content_manager可见)
│   └── 任务记录 (展开可查看3×3详情)
├── 小区管理 (admin可见)
├── 审核历史 (admin可见) ← 新增
├── AI助手 (admin可见) ← 新增
└── 系统设置 (admin可见)
```

---

## 部署依赖

### 环境要求
- Python 3.9+
- Node.js 16+
- PostgreSQL 12+
- Nginx

### Python依赖 (新增)
```
anthropic>=0.18.0
```

### NPM依赖 (新增)
```
marked: ^12.0.0
```

### 环境变量 (新增)
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```

---

## 部署检查清单

- [ ] 1. 确认Python和Node.js版本
- [ ] 2. 安装 anthropic 和 marked
- [ ] 3. 配置 ANTHROPIC_API_KEY
- [ ] 4. 执行数据库迁移 (alembic upgrade head)
- [ ] 5. 验证新表创建成功
- [ ] 6. 构建前端 (npm run build)
- [ ] 7. 部署前端到 /usr/share/nginx/html/admin
- [ ] 8. 重启后端服务
- [ ] 9. 重启审核调度器
- [ ] 10. 重启爬虫调度器
- [ ] 11. 基础功能验证
- [ ] 12. 完整测试

---

**文件树生成时间**: 2026-06-08  
**版本**: V5.0  
**状态**: 开发完成，待部署
