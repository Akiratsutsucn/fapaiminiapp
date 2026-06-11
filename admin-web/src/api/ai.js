import http from '@/utils/request';
export function listAiSessions() {
    return http.get('/ai/sessions').then(r => r.data);
}
export function createAiSession(title) {
    return http.post('/ai/sessions', { title }).then(r => r.data);
}
export function deleteAiSession(id) {
    return http.delete(`/ai/sessions/${id}`).then(r => r.data);
}
export function renameAiSession(id, title) {
    return http.patch(`/ai/sessions/${id}`, { title }).then(r => r.data);
}
export function getSessionMessages(sessionId) {
    return http.get(`/ai/sessions/${sessionId}/messages`).then(r => r.data);
}
// SSE 流式聊天（使用 fetch + POST，匹配后端协议）
export function chatStream(sessionId, message, onChunk, onDone, onError) {
    const token = localStorage.getItem('admin_token');
    const controller = new AbortController();
    let finished = false;
    // 幂等包装：done/error 只触发一次
    const safeDone = () => {
        if (finished)
            return;
        finished = true;
        onDone();
    };
    const safeError = (err) => {
        if (finished)
            return;
        finished = true;
        onError(err);
    };
    fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            session_id: String(sessionId),
            message,
        }),
        signal: controller.signal,
    })
        .then(async (response) => {
        if (!response.ok) {
            throw new Error(`请求失败: ${response.status}`);
        }
        if (!response.body) {
            throw new Error('响应体为空');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            // 按 SSE 事件分割（以 \n\n 分隔）
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const event of events) {
                const line = event.trim();
                if (!line.startsWith('data:'))
                    continue;
                const dataStr = line.slice(5).trim();
                if (!dataStr)
                    continue;
                try {
                    const data = JSON.parse(dataStr);
                    handleSseData(data, onChunk, safeDone, safeError);
                }
                catch (err) {
                    console.error('解析SSE消息失败:', err, dataStr);
                }
            }
        }
        // 流结束，确保触发完成回调
        safeDone();
    })
        .catch((err) => {
        if (err.name === 'AbortError')
            return;
        safeError(err);
    });
    return () => controller.abort();
}
// 处理后端返回的各类 SSE 数据
function handleSseData(data, onChunk, onDone, onError) {
    switch (data.type) {
        case 'text':
            if (data.text)
                onChunk(data.text);
            break;
        case 'tool_call':
            onChunk(`\n\n> 正在调用工具：${data.name}...\n\n`);
            break;
        case 'tool_result':
            // 工具结果不直接展示，等待AI总结
            break;
        case 'error':
            onError(new Error(data.error || 'AI服务错误'));
            break;
        case 'done':
            onDone();
            break;
        default:
            break;
    }
}
