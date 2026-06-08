# 管理后台V5版本API文档

## 概述

本文档列出V5版本新增和修改的所有API端点。

**Base URL**: `https://api.yourdomain.com`  
**认证方式**: Bearer Token (在请求头中添加 `Authorization: Bearer YOUR_TOKEN`)

---

## 一、AI助手模块

### 1. 获取会话列表

**端点**: `GET /api/admin/ai/sessions`

**响应**:
```json
[
  {
    "session_id": "uuid-string",
    "created_at": "2026-06-08 10:00:00",
    "message_count": 5
  }
]
```

---

### 2. 创建新会话

**端点**: `POST /api/admin/ai/sessions`

**请求体**: (空)

**响应**:
```json
{
  "session_id": "uuid-string",
  "created_at": "2026-06-08 10:00:00"
}
```

---

### 3. 删除会话

**端点**: `DELETE /api/admin/ai/sessions/{session_id}`

**响应**:
```json
{
  "message": "会话已删除"
}
```

---

### 4. 获取会话历史消息

**端点**: `GET /api/admin/ai/sessions/{session_id}/messages`

**响应**:
```json
[
  {
    "role": "user",
    "content": "你好",
    "timestamp": "2026-06-08 10:00:00"
  },
  {
    "role": "assistant",
    "content": "你好！我是AI助手...",
    "timestamp": "2026-06-08 10:00:01"
  }
]
```

---

### 5. 发送消息（流式响应）

**端点**: `GET /api/admin/ai/chat`

**查询参数**:
- `session_id`: 会话ID（可选，不传则创建新会话）
- `message`: 用户消息内容
- `token`: 认证token（也可以通过Header传递）

**响应**: Server-Sent Events (SSE) 流

```
data: {"type": "content", "text": "我"}

data: {"type": "content", "text": "是"}

data: {"type": "content", "text": "AI助手"}

data: {"type": "done"}
```

**前端调用示例**:
```javascript
const eventSource = new EventSource(
  `/api/admin/ai/chat?session_id=${sessionId}&message=${encodeURIComponent(message)}&token=${token}`
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'content') {
    // 追加文本到界面
    appendText(data.text);
  } else if (data.type === 'done') {
    eventSource.close();
  }
};
```

---

## 二、爬虫任务详情模块

### 1. 获取任务详情

**端点**: `GET /api/admin/crawler/tasks/{task_id}/details`

**响应**:
```json
{
  "task_id": 123,
  "details": {
    "阿里拍卖": {
      "上海": {
        "total_fetched": 100,
        "new_count": 20,
        "updated_count": 75,
        "failed_count": 5,
        "error_messages": "连接超时...",
        "duration_seconds": 120
      },
      "宁波": { ... },
      "杭州": { ... }
    },
    "京东拍卖": { ... },
    "公拍网": { ... }
  }
}
```

---

## 三、数据审核模块

### 1. 获取审核执行历史（分页）

**端点**: `GET /api/admin/data-audit/executions`

**查询参数**:
- `page`: 页码（默认1）
- `page_size`: 每页数量（默认20）
- `start_date`: 开始日期（可选，格式：2026-06-01）
- `end_date`: 结束日期（可选）
- `status`: 状态筛选（可选，completed/failed）

**响应**:
```json
{
  "items": [
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
        "缺少标题": 15
      },
      "execution_duration": 180,
      "status": "completed",
      "created_at": "2026-06-08 05:03:00"
    }
  ],
  "total": 30,
  "page": 1,
  "page_size": 20,
  "total_pages": 2
}
```

---

### 2. 获取单次审核详情

**端点**: `GET /api/admin/data-audit/executions/{execution_id}`

**响应**:
```json
{
  "id": 1,
  "execution_time": "2026-06-08 05:00:00",
  "rules_applied": [...],
  "properties_checked": 1500,
  "properties_deleted": 23,
  "properties_fixed": 45,
  "violations_found": {...},
  "execution_duration": 180,
  "status": "completed",
  "error_message": null,
  "created_at": "2026-06-08 05:03:00"
}
```

---

### 3. 获取审核统计摘要

**端点**: `GET /api/admin/data-audit/executions/stats/summary`

**查询参数**:
- `days`: 统计天数（默认30）

**响应**:
```json
{
  "total_executions": 30,
  "successful_executions": 28,
  "failed_executions": 2,
  "total_checked": 45000,
  "total_deleted": 690,
  "total_fixed": 1350,
  "avg_duration": 175.5,
  "recent_7_days": [
    {
      "date": "2026-06-08",
      "checked": 1500,
      "deleted": 23,
      "fixed": 45
    }
  ]
}
```

---

## 四、用户管理模块（增强）

### 1. 获取当前用户权限

**端点**: `GET /api/admin/users/me/permissions`

**响应**:
```json
{
  "user_id": 1,
  "role": "admin",
  "modules": [
    "dashboard",
    "users",
    "properties",
    "demands",
    "articles",
    "banners",
    "crawler",
    "communities",
    "data-audit",
    "settings"
  ],
  "can_write": true
}
```

---

### 2. 获取角色列表

**端点**: `GET /api/admin/users/roles/list`

**响应**:
```json
[
  {
    "code": "admin",
    "name": "最高管理员",
    "description": "拥有全部权限"
  },
  {
    "code": "leader",
    "name": "领导",
    "description": "全局可见但只读"
  },
  {
    "code": "content_manager",
    "name": "内容管理员",
    "description": "仅能管理文章、横幅、爬虫"
  },
  {
    "code": "agent",
    "name": "代理商",
    "description": "可管理用户和需求"
  },
  {
    "code": "salesperson",
    "name": "业务员",
    "description": "不能登录后台"
  },
  {
    "code": "customer",
    "name": "客户",
    "description": "不能登录后台"
  }
]
```

---

### 3. 创建用户（增强）

**端点**: `POST /api/admin/users`

**请求体**:
```json
{
  "nickname": "张三",
  "phone": "13800138000",
  "role": "leader",
  "password": "123456",
  "city_id": 310000,
  "region": "上海市黄浦区"
}
```

**响应**:
```json
{
  "id": 123,
  "nickname": "张三",
  "phone": "13800138000",
  "role": "leader",
  "created_at": "2026-06-08 10:00:00"
}
```

---

### 4. 修改用户角色

**端点**: `PUT /api/admin/users/{user_id}/role`

**请求体**:
```json
{
  "role": "content_manager"
}
```

**响应**:
```json
{
  "message": "角色修改成功"
}
```

---

## 五、数据看板模块（增强）

### 1. 获取看板数据（带城市分项）

**端点**: `GET /api/admin/dashboard`

**查询参数**:
- `city_id`: 城市ID（0=全部，310000=上海，330200=宁波，330100=杭州）

**响应**（当city_id=0时）:
```json
{
  "total_properties": {
    "total": 1234,
    "by_city": {
      "shanghai": 800,
      "ningbo": 234,
      "hangzhou": 200
    }
  },
  "today_new": {
    "total": 45,
    "by_city": {
      "shanghai": 25,
      "ningbo": 10,
      "hangzhou": 10
    }
  },
  "upcoming": {
    "total": 120,
    "by_city": {
      "shanghai": 70,
      "ningbo": 25,
      "hangzhou": 25
    }
  },
  "bargain_count": {
    "total": 30,
    "by_city": {
      "shanghai": 15,
      "ningbo": 8,
      "hangzhou": 7
    }
  },
  "yesterday_listed": {
    "total": 50,
    "by_city": {
      "shanghai": 28,
      "ningbo": 12,
      "hangzhou": 10
    }
  },
  "yesterday_sold": {
    "total": 15,
    "by_city": {
      "shanghai": 8,
      "ningbo": 4,
      "hangzhou": 3
    }
  }
}
```

**响应**（当city_id=310000时）:
```json
{
  "total_properties": {
    "total": 800
  },
  "today_new": {
    "total": 25
  },
  ...
}
```

---

## 权限说明

### 各角色可访问的模块

| 角色 | 可访问模块 | 写权限 |
|------|-----------|--------|
| admin | 全部 | ✅ |
| leader | 全部 | ❌ |
| content_manager | articles, banners, crawler | ✅ |
| agent | dashboard, users, demands | ✅ |
| salesperson | - | - |
| customer | - | - |

### API权限控制

- 所有 `/api/admin/*` 端点都需要认证
- `salesperson` 和 `customer` 角色无法登录管理后台
- `leader` 角色只能调用GET请求，POST/PUT/DELETE会返回403
- `content_manager` 访问非授权模块会返回403

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证（Token无效或过期） |
| 403 | 无权限（角色不允许访问） |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 环境配置

### 后端环境变量

```bash
# AI助手（必需）
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# 数据库
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/fapai

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
```

### 依赖安装

```bash
# 后端
pip install anthropic

# 前端
npm install marked
```

---

## 测试工具

### Postman Collection

建议创建Postman Collection，包含以上所有端点，方便测试。

### curl测试示例

```bash
# 设置Token变量
TOKEN="your-admin-token"

# 测试AI助手
curl -N -H "Authorization: Bearer $TOKEN" \
  "https://api.yourdomain.com/api/admin/ai/chat?session_id=test&message=系统概览"

# 测试爬虫详情
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourdomain.com/api/admin/crawler/tasks/123/details"

# 测试审核历史
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourdomain.com/api/admin/data-audit/executions?page=1&page_size=10"

# 测试创建用户
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"测试","phone":"13800138000","role":"leader","password":"123456"}' \
  "https://api.yourdomain.com/api/admin/users"
```

---

## 性能建议

### 缓存策略

- AI会话历史：建议使用Redis缓存
- 数据看板数据：可缓存5分钟
- 审核历史列表：可缓存1小时

### 分页建议

- 默认page_size=20
- 最大page_size=100
- 超大数据集使用游标分页

### 并发控制

- AI助手：单用户最多3个并发请求
- 爬虫任务：同时最多1个全量抓取任务
- 审核历史：无限制

---

## 更新日志

### V5.0 (2026-06-08)

**新增**:
- AI助手模块（5个API）
- 爬虫任务详情（1个API）
- 数据审核历史（3个API）
- 用户角色管理（3个API）

**修改**:
- 数据看板API增加城市分项字段

**优化**:
- 权限控制中间件
- 错误处理统一化

---

## 联系方式

**技术支持**: 你的邮箱  
**文档更新**: 2026-06-08  
**版本**: V5.0
