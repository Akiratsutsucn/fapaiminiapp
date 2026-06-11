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
from ...models.ai_chat import AiSession, AiMessage
from sqlalchemy import select, func, delete as sql_delete
from .ai_tools import (
    query_database,
    get_crawler_status,
    analyze_property_stats,
    get_system_overview,
)

router = APIRouter()

# Deepseek API
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


async def _ensure_session(db: AsyncSession, session_id: str) -> AiSession:
    """获取会话，不存在则创建（落库）。"""
    sess = await db.get(AiSession, session_id)
    if sess is None:
        sess = AiSession(session_id=session_id, title="新会话")
        db.add(sess)
        await db.commit()
    return sess


async def _get_history(db: AsyncSession, session_id: str) -> list[dict]:
    """获取会话历史消息（按时间顺序），返回 {role, content} 列表。"""
    rows = (await db.execute(
        select(AiMessage).where(AiMessage.session_id == session_id).order_by(AiMessage.id)
    )).scalars().all()
    return [{"role": m.role, "content": m.content} for m in rows]


async def _add_message(db: AsyncSession, session_id: str, role: str, content) -> None:
    """添加消息到会话历史（落库）。content 非字符串时序列化。"""
    text_content = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
    db.add(AiMessage(session_id=session_id, role=role, content=text_content or ""))
    # 触发会话 updated_at 刷新
    sess = await db.get(AiSession, session_id)
    if sess is not None:
        sess.updated_at = datetime.now()
        # 首条用户消息自动作为标题（仅当标题仍是默认值时）
        if role == "user" and sess.title in ("新会话", "", None):
            sess.title = (text_content or "新会话")[:50]
    await db.commit()


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

        # 获取会话历史（从数据库）
        history = await _get_history(db, session_id)

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
            # 先把「assistant 发起的所有 tool_calls」作为单条 assistant 消息加入
            # （OpenAI/Deepseek 规范：一条 assistant 消息携带全部 tool_calls，
            #  随后跟与之 id 对应的多条 tool 响应；原实现拆成多条 assistant 消息会
            #  导致第二次请求 messages 格式非法 → 接口报错/不返回 → 前端卡在「正在调用工具」）
            assistant_tool_calls = []
            tool_response_messages = []
            for tool_call in tool_calls_list:
                tool_name = tool_call["name"]
                try:
                    tool_input = json.loads(tool_call["arguments"])
                except Exception:
                    tool_input = {}

                # 通知前端工具调用开始
                yield f"data: {json.dumps({'type': 'tool_call', 'name': tool_name, 'input': tool_input}, ensure_ascii=False)}\n\n"

                # 执行工具
                tool_result = await _call_tool(tool_name, tool_input, db)

                # 通知前端工具结果
                yield f"data: {json.dumps({'type': 'tool_result', 'name': tool_name, 'result': tool_result}, ensure_ascii=False)}\n\n"

                assistant_tool_calls.append({
                    "id": tool_call["id"],
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "arguments": tool_call["arguments"],
                    },
                })
                tool_response_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": json.dumps(tool_result, ensure_ascii=False),
                })

            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": assistant_tool_calls,
            })
            messages.extend(tool_response_messages)

            # 再次调用API获取最终回复（带错误兜底，避免前端卡死）
            final_response = ""
            try:
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
            except Exception as e2:
                logger.error(f"AI二次调用(工具结果汇总)失败: {e2}")
                # 工具结果已拿到但汇总失败：给用户一个可读的兜底回复，而非永久卡在「正在调用工具」
                fallback = "（已查询到数据，但生成最终回复时出错，请重试或换个问法）"
                if not final_response:
                    final_response = fallback
                    yield f"data: {json.dumps({'type': 'text', 'text': fallback}, ensure_ascii=False)}\n\n"

            assistant_message = final_response

        # 保存到会话历史（数据库）
        await _add_message(db, session_id, "user", message)
        await _add_message(db, session_id, "assistant", assistant_message)

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
    # 创建或获取会话ID，并确保会话已落库（外键依赖 + 跨 worker 可见）
    session_id = req.session_id or _create_session_id()
    await _ensure_session(db, session_id)

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
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """获取会话列表（数据库，按更新时间倒序）。"""
    # 会话 + 消息数
    sessions = (await db.execute(
        select(AiSession).order_by(AiSession.updated_at.desc())
    )).scalars().all()

    # 统计每个会话的消息数
    counts = dict((await db.execute(
        select(AiMessage.session_id, func.count(AiMessage.id)).group_by(AiMessage.session_id)
    )).all())

    return [
        SessionOut(
            session_id=s.session_id,
            title=s.title or "新会话",
            created_at=s.created_at.isoformat() if s.created_at else datetime.now().isoformat(),
            message_count=int(counts.get(s.session_id, 0)),
        )
        for s in sessions
    ]


@router.post("/sessions", response_model=SessionOut)
async def create_session(
    req: SessionCreate,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """创建新会话（落库）。"""
    session_id = _create_session_id()
    sess = AiSession(session_id=session_id, title=req.title or "新会话")
    db.add(sess)
    await db.commit()

    return SessionOut(
        session_id=session_id,
        title=sess.title,
        created_at=sess.created_at.isoformat() if sess.created_at else datetime.now().isoformat(),
        message_count=0,
    )


@router.patch("/sessions/{session_id}")
async def rename_session(
    session_id: str,
    req: SessionCreate,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """重命名会话。"""
    sess = await db.get(AiSession, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    new_title = (req.title or "").strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    sess.title = new_title[:100]
    await db.commit()
    return {"success": True, "session_id": session_id, "title": sess.title}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """删除会话（连同消息，CASCADE）。"""
    sess = await db.get(AiSession, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    await db.delete(sess)
    await db.commit()
    return {"success": True, "message": "会话已删除"}


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(get_admin_user),
):
    """获取会话历史消息（数据库）。"""
    sess = await db.get(AiSession, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="会话不存在")

    rows = (await db.execute(
        select(AiMessage).where(AiMessage.session_id == session_id).order_by(AiMessage.id)
    )).scalars().all()

    return {
        "session_id": session_id,
        "messages": [
            {
                "id": m.id,
                "session_id": m.session_id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else "",
            }
            for m in rows
        ],
    }
