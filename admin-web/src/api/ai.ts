import http from '@/utils/request'

export interface AiSession {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export interface AiMessage {
  id: number
  session_id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ChatRequest {
  session_id: number
  message: string
}

export function listAiSessions() {
  return http.get<AiSession[]>('/ai/sessions').then(r => r.data)
}

export function createAiSession(title?: string) {
  return http.post<AiSession>('/ai/sessions', { title }).then(r => r.data)
}

export function deleteAiSession(id: number) {
  return http.delete(`/ai/sessions/${id}`).then(r => r.data)
}

export function getSessionMessages(sessionId: number) {
  return http.get<AiMessage[]>(`/ai/sessions/${sessionId}/messages`).then(r => r.data)
}

// SSE 流式聊天
export function chatStream(sessionId: number, message: string, onChunk: (text: string) => void, onDone: () => void, onError: (err: any) => void) {
  const token = localStorage.getItem('admin_token')
  const url = `/api/admin/ai/chat`

  const eventSource = new EventSource(
    `${url}?session_id=${sessionId}&message=${encodeURIComponent(message)}&token=${token}`
  )

  eventSource.onmessage = (event) => {
    if (event.data === '[DONE]') {
      eventSource.close()
      onDone()
    } else {
      try {
        const data = JSON.parse(event.data)
        if (data.content) {
          onChunk(data.content)
        }
      } catch (err) {
        console.error('解析SSE消息失败:', err)
      }
    }
  }

  eventSource.onerror = (err) => {
    eventSource.close()
    onError(err)
  }

  return () => eventSource.close()
}
