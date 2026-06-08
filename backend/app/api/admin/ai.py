"""AI助手聊天API - 管理员智能助手。"""
import os
import json
import uuid
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from ...core.database import get_session
from ...core.security import get_admin_user
from .ai_tools import (
    query_database,
    get_crawler_status,
    analyze_property_stats,
    get_system_overview,
)

router = APIRouter()

# 会话存储（生产环境建议用Redis）
_sessions: dict[str, list[dict]] = {}

# 改用Deepseek API
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")

# 系统提示词
SYSTEM_PROMPT = """你是法拍者联盟管理后台的AI助手。你可以帮助管理员：

1. 查询数据库（只读SQL查询）
2. 分析房源数据和趋势
3. 查看爬虫运行状态
4. 排查系统问题

你可以使用以下工具：
- query_database: 执行SQL查询（仅SELECT）
- get_crawler_status: 获取爬虫最近运行状态
- analyze_property_stats: 分析房源统计数据
- get_system_overview: 获取系统概览

数据库主要表结构：
- properties: 房源表（id, title, city_id, district, starting_price, auction_status, created_at等）
- users: 用户表（id, nickname, phone, role, created_at等）
- demands: 需求表（id, user_id, city, status, created_at等）
- articles: 文章表（id, title, content, published_at等）

城市代码：310000=上海, 330200=宁波, 330100=杭州

请用简体中文回答，保持专业和友好。"""


class ChatRequest(BaseModel):
    session_id: str | None = Field(None, description="会话ID，不传则创建新会话")
    message: str = Field(..., min_length=1, max_length=2000, description="用户消息")


class SessionCreate(BaseModel):
    title: str | None = Field(None, max_length=100, description="会话标题")


class SessionOut(BaseModel):
    session_id: str
    title: str
    created_at: str
    message_count: int


def _create_session_id() -> str:
    """生成新的会话ID。"""
    return str(uuid.uuid4())


def _get_session(session_id: str) -> list[dict]:
    """获取会话历史。"""
    if session_id not in _sessions:
        _sessions[session_id] = []
    return _sessions[session_id]


def _add_message(session_id: str, role: str, content: str | list):
    """添加消息到会话历史。"""
    session = _get_session(session_id)
    session.append({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat(),
    })


async def _call_tool(tool_name: str, tool_input: dict, db: AsyncSession) -> dict:
    """调用工具函数。"""
    try:
        if tool_name == "query_database":
            sql = tool_input.get("sql", "")
            return await query_database(db, sql)

        elif tool_name == "get_crawler_status":
            return await get_crawler_status(db)

        elif tool_name == "analyze_property_stats":
            city = tool_input.get("city")
            days = tool_input.get("days", 7)
            return await analyze_property_stats(db, city, days)

        elif tool_name == "get_system_overview":
            return await get_system_overview(db)

        else:
            return {
                "success": False,
                "error": f"未知的工具: {tool_name}",
            }

    except Exception as e:
        logger.error(f"工具调用失败 {tool_name}: {e}")
        return {
            "success": False,
            "error": str(e),
        }


async def _stream_chat(
    session_id: str,
    message: str,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    """流式聊天生成器（SSE格式）- 使用Deepseek V3。"""
    try:
        # 检查API Key
        if not DEEPSEEK_API_KEY:
            yield f"data: {json.dumps({'type': 'error', 'error': 'DEEPSEEK_API_KEY未配置'}, ensure_ascii=False)}\n\n"
            return

        # 导入OpenAI SDK（Deepseek兼容OpenAI接口）
        try:
            from openai import AsyncOpenAI
        except ImportError:
            yield f"data: {json.dumps({'type': 'error', 'error': '请安装openai包: pip install openai'}, ensure_ascii=False)}\n\n"
            return

        # 创建Deepseek客户端
        client = AsyncOpenAI(
            api_key=DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com"
        )

        # 获取会话历史
        history = _get_session(session_id)

        # 构建消息列表（OpenAI格式）
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

        for msg in history:
            if msg["role"] in ["user", "assistant"]:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"] if isinstance(msg["content"], str) else json.dumps(msg["content"], ensure_ascii=False),
                })

        # 添加当前用户消息
        messages.append({
            "role": "user",
            "content": message,
        })

        # 定义工具（OpenAI格式）
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "query_database",
                    "description": "执行SQL查询（仅支持SELECT语句）。用于查询房源、用户、需求等数据。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "sql": {
                                "type": "string",
                                "description": "SQL查询语句（仅SELECT）",
                            }
                        },
                        "required": ["sql"],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_crawler_status",
                    "description": "获取爬虫最近运行状态，包括今日、昨日、最近7天的新增房源数，以及各平台和城市的统计。",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "analyze_property_stats",
                    "description": "分析房源统计数据，包括总数、可参拍数、平均折扣、价格分布、类型分布、每日新增趋势等。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                                "description": "城市名称（上海/宁波/杭州），不传则分析全部城市",
                                "enum": ["上海", "宁波", "杭州"],
                            },
                            "days": {
                                "type": "integer",
                                "description": "分析最近N天的数据，默认7天",
                                "default": 7,
                            },
                        },
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_system_overview",
                    "description": "获取系统整体概览数据，包括房源、用户、需求、文章的总数和关键指标。",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                    },
                }
            },
        ]

        # 调用Deepseek API（流式）
        assistant_message = ""
        tool_calls_list = []

        stream = await client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            tools=tools,
            stream=True,
            max_tokens=4096,
        )

        async for chunk in stream:
            if not chunk.choices:
                continue

            choice = chunk.choices[0]
            delta = choice.delta

            # 文本增量
            if delta.content:
                text = delta.content
                assistant_message += text
                yield f"data: {json.dumps({'type': 'text', 'text': text}, ensure_ascii=False)}\n\n"

            # 工具调用
            if delta.tool_calls:
                for tool_call in delta.tool_calls:
                    # 初始化或更新工具调用
                    if tool_call.index >= len(tool_calls_list):
                        tool_calls_list.append({
                            "id": tool_call.id,
                            "name": tool_call.function.name if tool_call.function else "",
                            "arguments": tool_call.function.arguments if tool_call.function else "",
                        })
                    else:
                        # 累积参数
                        if tool_call.function and tool_call.function.arguments:
                            tool_calls_list[tool_call.index]["arguments"] += tool_call.function.arguments

        # 检查是否有完整的停止原因
        has_tool_calls = len(tool_calls_list) > 0

        # 处理工具调用
        if has_tool_calls:
            for tool_call in tool_calls_list:
                tool_name = tool_call["name"]

                # 解析工具参数
                try:
                    tool_input = json.loads(tool_call["arguments"])
                except:
                    tool_input = {}

                # 通知前端工具调用开始
                yield f"data: {json.dumps({'type': 'tool_call', 'name': tool_name, 'input': tool_input}, ensure_ascii=False)}\n\n"

                # 执行工具
                tool_result = await _call_tool(tool_name, tool_input, db)

                # 通知前端工具结果
                yield f"data: {json.dumps({'type': 'tool_result', 'name': tool_name, 'result': tool_result}, ensure_ascii=False)}\n\n"

                # 继续对话，带上工具结果
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": tool_call["id"],
                        "type": "function",
                        "function": {
                            "name": tool_name,
                            "arguments": tool_call["arguments"],
                        }
                    }]
                })
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": json.dumps(tool_result, ensure_ascii=False),
                })

            # 再次调用API获取最终回复
            final_response = ""
            stream2 = await client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                tools=tools,
                stream=True,
                max_tokens=4096,
            )

            async for chunk in stream2:
                if not chunk.choices:
                    continue

                choice = chunk.choices[0]
                delta = choice.delta

                if delta.content:
                    text = delta.content
                    final_response += text
                    yield f"data: {json.dumps({'type': 'text', 'text': text}, ensure_ascii=False)}\n\n"

            assistant_message = final_response

        # 保存到会话历史
        _add_message(session_id, "user", message)
        _add_message(session_id, "assistant", assistant_message)

        # 发送完成信号
        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

    except Exception as e:
        logger.error(f"AI聊天失败: {e}")
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)}, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """AI助手聊天接口（SSE流式返回）。"""
    # 创建或获取会话ID
    session_id = req.session_id or _create_session_id()

    # 返回SSE流
    return StreamingResponse(
        _stream_chat(session_id, req.message, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-ID": session_id,
        },
    )


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    admin: dict = Depends(get_admin_user),
):
    """获取会话列表。"""
    sessions = []
    for session_id, messages in _sessions.items():
        # 用第一条用户消息作为标题
        title = "新会话"
        for msg in messages:
            if msg["role"] == "user":
                title = msg["content"][:50]
                break

        sessions.append(SessionOut(
            session_id=session_id,
            title=title,
            created_at=messages[0]["timestamp"] if messages else datetime.now().isoformat(),
            message_count=len(messages),
        ))

    # 按创建时间倒序
    sessions.sort(key=lambda x: x.created_at, reverse=True)
    return sessions


@router.post("/sessions", response_model=SessionOut)
async def create_session(
    req: SessionCreate,
    admin: dict = Depends(get_admin_user),
):
    """创建新会话。"""
    session_id = _create_session_id()
    _sessions[session_id] = []

    return SessionOut(
        session_id=session_id,
        title=req.title or "新会话",
        created_at=datetime.now().isoformat(),
        message_count=0,
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    admin: dict = Depends(get_admin_user),
):
    """删除会话。"""
    if session_id in _sessions:
        del _sessions[session_id]
        return {"success": True, "message": "会话已删除"}
    else:
        raise HTTPException(status_code=404, detail="会话不存在")


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    admin: dict = Depends(get_admin_user),
):
    """获取会话历史消息。"""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="会话不存在")

    return {
        "session_id": session_id,
        "messages": _sessions[session_id],
    }
