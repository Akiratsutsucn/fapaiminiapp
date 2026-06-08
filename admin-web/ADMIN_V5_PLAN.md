# 管理后台V5版本升级方案

## 概述
本次升级涉及5个大型功能模块的开发，需要前后端协同完成。

## 一、AI排错功能模块

### 需求
在管理后台增加AI助手功能，让管理员可以通过对话界面进行系统排错、数据分析等操作。

### 技术方案
**前端：**
- 路由：`/ai-assistant`
- 组件：`AiAssistantView.vue`
- 功能：类CLI的对话界面，支持流式响应
- UI：参考聊天界面，左侧历史会话列表，右侧对话区

**后端：**
- API：`/api/admin/ai/chat` (POST) - 发送消息并接收流式响应
- API：`/api/admin/ai/sessions` (GET/POST/DELETE) - 会话管理
- 集成：调用Anthropic Claude API
- 工具能力：查询数据库、执行只读SQL、查看日志、分析爬虫状态

### 实现细节
- 使用Server-Sent Events (SSE)实现流式响应
- AI助手可以访问只读数据库查询
- 提供预设问题模板（如"昨天抓取失败原因"）

---

## 二、爬虫任务记录详细化

### 需求
当前任务记录颗粒度不够，需要展示：
- 三个平台（阿里拍卖、京东拍卖、公拍网）
- 三个城市（上海、宁波、杭州）
- 每个组合的：成功数、新增数、更新数、失败数、失败原因

### 技术方案
**数据库改造：**
- 修改`crawler_tasks`表结构，增加详细统计字段
- 新增`crawler_task_details`表，记录每个平台-城市组合的详细信息

```sql
CREATE TABLE crawler_task_details (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES crawler_tasks(id),
    platform VARCHAR(32) NOT NULL,
    city VARCHAR(32) NOT NULL,
    total_fetched INTEGER DEFAULT 0,
    new_count INTEGER DEFAULT 0,
    updated_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_messages TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**爬虫改造：**
- 修改`crawlers/`中的各个爬虫类，记录详细统计
- 每个城市-平台组合独立记录

**前端改造：**
- 任务记录表格改为分组展示
- 点击任务行展开详情，显示9宫格（3平台×3城市）
- 失败项高亮显示，可查看错误信息

---

## 三、数据审核可视化

### 需求
- 展示每天5点定时审核的执行情况
- 显示审核规则、审核结果、清理数据量
- 显示必填字段修复情况

### 技术方案
**数据库改造：**
```sql
CREATE TABLE data_audit_executions (
    id SERIAL PRIMARY KEY,
    execution_time TIMESTAMP NOT NULL,
    rules_applied JSONB,  -- 应用的规则列表
    properties_checked INTEGER DEFAULT 0,
    properties_deleted INTEGER DEFAULT 0,
    properties_fixed INTEGER DEFAULT 0,
    violations_found JSONB,  -- 违规详情
    execution_duration INTEGER,  -- 执行耗时（秒）
    status VARCHAR(32) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT NOW()
);
```

**后端改造：**
- 修改`schedulers/data_audit.py`，记录每次审核执行
- API：`/api/admin/data-audit/executions` - 获取审核执行历史
- API：`/api/admin/data-audit/rules` - 审核规则CRUD

**前端改造：**
- 新页面：`/data-audit/executions` - 审核执行历史
- 时间轴展示每天5点的审核记录
- 点击查看详细规则和结果

---

## 四、用户角色管理强化

### 需求
- admin可以创建用户、分配角色
- 新增角色：领导（只读）、内容管理员（限定模块）
- 保留现有：代理商、业务员、客户（不能登录后台）

### 技术方案
**数据库改造：**
```sql
-- User表role字段扩展（已有customer/agent/admin）
-- 新增：leader（领导）、content_manager（内容管理员）

CREATE TABLE user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    module VARCHAR(64) NOT NULL,  -- 模块名
    can_read BOOLEAN DEFAULT TRUE,
    can_write BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**后端改造：**
- 修改`core/security.py`，增加角色权限检查中间件
- 角色定义：
  - admin: 全部权限
  - leader: 全部可读，无写入权限
  - content_manager: 仅文章、横幅、爬虫模块
  - agent: 现有逻辑不变
  - customer: 不能登录后台

**前端改造：**
- 用户管理页面增加"创建用户"按钮
- 创建用户表单：昵称、手机号、角色选择、初始密码
- 路由守卫增强，根据角色动态显示菜单

---

## 五、数据看板城市分项

### 需求
将"总房源数"、"今日新增"等指标拆分为上海/宁波/杭州三城数据，逻辑与小程序一致。

### 技术方案
**后端改造：**
- 修改`api/admin/dashboard.py`
- 每个指标返回：
```json
{
  "total": 1234,
  "by_city": {
    "shanghai": 800,
    "ningbo": 234,
    "hangzhou": 200
  }
}
```

**前端改造：**
- Dashboard卡片增加城市明细展示
- 可折叠显示三城数据
- 使用图表（饼图/柱状图）可视化比例

---

## 实施计划

### Phase 1: 数据库改造与后端API（2-3天）
1. 创建新表（crawler_task_details, data_audit_executions, user_permissions）
2. 爬虫任务记录详细化后端实现
3. 数据审核执行记录后端实现
4. 用户角色权限后端实现
5. 数据看板城市分项后端实现

### Phase 2: 前端页面开发（3-4天）
1. AI助手界面开发
2. 爬虫管理页面改造
3. 数据审核可视化页面
4. 用户管理页面强化
5. 数据看板改造

### Phase 3: 集成测试与部署（1天）
1. 本地联调测试
2. 生产环境部署
3. 验收测试

---

## 子任务分配

### Subagent-1: 数据库改造与爬虫详细统计
- 创建迁移脚本
- 修改crawler相关代码
- 实现详细统计API

### Subagent-2: 数据审核可视化后端
- 创建审核执行记录表
- 修改定时任务记录逻辑
- 实现审核历史API

### Subagent-3: 用户角色管理后端
- 权限表设计
- 角色权限中间件
- 用户管理API增强

### Subagent-4: 数据看板与AI助手后端
- 数据看板城市分项API
- AI助手聊天API（SSE）
- AI工具函数实现

### Subagent-5: 前端开发
- 所有5个模块的前端实现
- 路由配置
- 组件开发
