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
export function getSessionMessages(sessionId) {
    return http.get(`/ai/sessions/${sessionId}/messages`).then(r => r.data);
}
// SSE 流式聊天
export function chatStream(sessionId, message, onChunk, onDone, onError) {
    const token = localStorage.getItem('admin_token');
    const url = `/api/admin/ai/chat`;
    const eventSource = new EventSource(`${url}?session_id=${sessionId}&message=${encodeURIComponent(message)}&token=${token}`);
    eventSource.onmessage = (event) => {
        if (event.data === '[DONE]') {
            eventSource.close();
            onDone();
        }
        else {
            try {
                const data = JSON.parse(event.data);
                if (data.content) {
                    onChunk(data.content);
                }
            }
            catch (err) {
                console.error('解析SSE消息失败:', err);
            }
        }
    };
    eventSource.onerror = (err) => {
        eventSource.close();
        onError(err);
    };
    return () => eventSource.close();
}
