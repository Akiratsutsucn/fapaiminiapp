# AI助手功能使用说明

## 配置

在 `.env` 文件中添加 Anthropic API Key：

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```

## 安装依赖

```bash
pip install anthropic
```

## API接口

### 1. 聊天接口（流式）

```
POST /api/admin/ai/chat
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "session_id": "optional-uuid",  // 可选，不传则创建新会话
  "message": "昨天为什么没有抓取到数据？"
}
```

响应格式：Server-Sent Events (SSE)

```
data: {"type": "text", "text": "让我查看一下爬虫状态..."}

data: {"type": "tool_call", "name": "get_crawler_status", "input": {}}

data: {"type": "tool_result", "name": "get_crawler_status", "result": {...}}

data: {"type": "text", "text": "根据查询结果..."}

data: {"type": "done"}
```

### 2. 获取会话列表

```
GET /api/admin/ai/sessions
Authorization: Bearer {admin_token}
```

### 3. 创建新会话

```
POST /api/admin/ai/sessions
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "title": "房源数据分析"  // 可选
}
```

### 4. 删除会话

```
DELETE /api/admin/ai/sessions/{session_id}
Authorization: Bearer {admin_token}
```

### 5. 获取会话历史

```
GET /api/admin/ai/sessions/{session_id}/messages
Authorization: Bearer {admin_token}
```

## AI工具函数

### 1. query_database

执行只读SQL查询（仅支持SELECT）。

示例对话：
- "查询上海最近7天新增的房源数量"
- "统计各个平台的房源数量"
- "找出折扣最低的10个房源"

### 2. get_crawler_status

获取爬虫运行状态。

示例对话：
- "爬虫今天抓了多少数据？"
- "最近一周各平台的抓取情况如何？"
- "为什么昨天没有新增房源？"

### 3. analyze_property_stats

分析房源统计数据。

示例对话：
- "分析上海的房源数据"
- "宁波最近7天的房源趋势如何？"
- "各类型房源的分布情况"

### 4. get_system_overview

获取系统整体概览。

示例对话：
- "系统目前有多少数据？"
- "给我一个系统概览"
- "当前有多少待处理需求？"

## 使用示例

### JavaScript 前端调用（SSE）

```javascript
async function chatWithAI(message, sessionId = null) {
  const response = await fetch('/api/admin/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      session_id: sessionId,
      message: message
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        if (data.type === 'text') {
          // 显示AI回复的文本
          console.log(data.text);
        } else if (data.type === 'tool_call') {
          // 显示工具调用
          console.log(`调用工具: ${data.name}`);
        } else if (data.type === 'done') {
          // 完成
          break;
        } else if (data.type === 'error') {
          // 错误
          console.error(data.error);
        }
      }
    }
  }

  // 从响应头获取session_id
  const newSessionId = response.headers.get('X-Session-ID');
  return newSessionId;
}

// 使用
chatWithAI('今天新增了多少房源？');
```

## 注意事项

1. **API Key安全**：生产环境务必妥善保管 `ANTHROPIC_API_KEY`，不要提交到Git
2. **会话存储**：当前会话存储在内存中，重启后丢失。生产环境建议用Redis持久化
3. **SQL安全**：已实现SQL注入防护，只允许SELECT语句，禁止DROP/DELETE等危险操作
4. **速率限制**：注意Anthropic API的速率限制，必要时添加请求频控
5. **成本控制**：每次对话会消耗tokens，建议监控使用量

## 数据库表结构参考

### properties（房源表）

主要字段：
- id, title, city_id, district, community_name
- starting_price, appraisal_price, court_discount_rate
- auction_status, auction_start_time, auction_end_time
- property_type, auction_platform, auction_round
- created_at, updated_at

### users（用户表）

主要字段：
- id, openid, nickname, avatar_url, phone
- role (customer/agent/admin)
- created_at

### demands（需求表）

主要字段：
- id, user_id, name, phone, city
- status (待处理/已分配/已完成)
- source (demand-form/message)
- created_at

### articles（文章表）

主要字段：
- id, title, summary, content
- published_at, created_at
