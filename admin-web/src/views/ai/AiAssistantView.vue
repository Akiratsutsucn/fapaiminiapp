<template>
  <div class="ai-assistant">
    <div class="assistant-container">
      <!-- 左侧会话列表 -->
      <div class="session-sidebar">
        <div class="sidebar-header">
          <h3 class="sidebar-title">对话列表</h3>
          <t-button size="small" theme="primary" @click="onCreateSession">
            <template #icon><t-icon name="add" /></template>
            新建对话
          </t-button>
        </div>
        <div class="session-list">
          <div
            v-for="session in sessions"
            :key="session.id"
            class="session-item"
            :class="{ active: currentSessionId === session.id }"
            @click="onSelectSession(session.id)"
          >
            <div class="session-title">{{ session.title || '新对话' }}</div>
            <div class="session-time">{{ formatTime(session.updated_at) }}</div>
            <div class="session-actions">
              <t-button
                variant="text"
                size="small"
                class="rename-btn"
                @click.stop="onRenameSession(session)"
              >
                <template #icon><t-icon name="edit" /></template>
              </t-button>
              <t-button
                variant="text"
                size="small"
                theme="danger"
                class="delete-btn"
                @click.stop="onDeleteSession(session.id)"
              >
                <template #icon><t-icon name="delete" /></template>
              </t-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧对话区域 -->
      <div class="chat-area">
        <div class="chat-header">
          <h3 class="chat-title">AI助手</h3>
        </div>

        <!-- 预设问题 -->
        <div v-if="messages.length === 0" class="quick-templates">
          <div class="template-title">快速开始</div>
          <div class="template-grid">
            <div
              v-for="(template, idx) in templates"
              :key="idx"
              class="template-card"
              @click="onUseTemplate(template)"
            >
              <t-icon :name="template.icon" class="template-icon" />
              <div class="template-text">{{ template.text }}</div>
            </div>
          </div>
        </div>

        <!-- 消息列表 -->
        <div class="message-container" ref="messageContainer">
          <div v-for="msg in messages" :key="msg.id" class="message-wrapper" :class="msg.role">
            <div class="message-bubble">
              <div class="message-role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
              <div class="message-content" v-html="renderMarkdown(msg.content)"></div>
              <div class="message-time">{{ formatTime(msg.created_at) }}</div>
            </div>
          </div>

          <!-- 流式响应中的临时消息 -->
          <div v-if="streaming && streamContent" class="message-wrapper assistant">
            <div class="message-bubble">
              <div class="message-role">AI</div>
              <div class="message-content" v-html="renderMarkdown(streamContent)"></div>
              <t-loading size="small" style="margin-top: 8px" />
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-area">
          <textarea
            v-model="inputMessage"
            class="custom-textarea"
            placeholder="输入您的问题..."
            rows="3"
            @keydown.enter.ctrl.prevent="onSendMessage"
            :disabled="streaming"
          ></textarea>
          <t-button
            theme="primary"
            @click="onSendMessage"
            :loading="streaming"
            :disabled="!inputMessage.trim() || !currentSessionId"
          >
            <template #icon><t-icon name="send" /></template>
            发送 (Ctrl+Enter)
          </t-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listAiSessions, createAiSession, deleteAiSession, getSessionMessages, chatStream, renameAiSession } from '@/api/ai'
import { marked } from 'marked'

const sessions = ref<any[]>([])
const currentSessionId = ref<string | number | null>(null)
const messages = ref<any[]>([])
const inputMessage = ref('')
const streaming = ref(false)
const streamContent = ref('')
const messageContainer = ref<HTMLElement | null>(null)

const templates = [
  { icon: 'chart-line', text: '分析最近的房源数据趋势' },
  { icon: 'error-circle', text: '总结数据审核中的主要问题' },
  { icon: 'user-setting', text: '查看用户增长情况' },
  { icon: 'swap', text: '检查爬虫运行状态' },
]

onMounted(() => {
  loadSessions()
})

async function loadSessions() {
  try {
    const res = await listAiSessions()
    // 兼容后端可能返回数组或 {sessions:[...]} / {data:[...]} 等结构
    let data: any[] = []
    if (Array.isArray(res)) {
      data = res
    } else if (res && Array.isArray((res as any).sessions)) {
      data = (res as any).sessions
    } else if (res && Array.isArray((res as any).data)) {
      data = (res as any).data
    }

    // 过滤掉无效的会话（id为空或undefined），并统一字段名
    sessions.value = data
      .filter(s => s && (s.id || s.session_id))
      .map(s => ({
        ...s,
        id: s.id || s.session_id  // 统一使用id字段
      }))

    if (sessions.value.length > 0 && !currentSessionId.value) {
      onSelectSession(sessions.value[0].id)
    } else if (sessions.value.length === 0) {
      // 如果没有会话，自动创建一个
      await onCreateSession()
    }
  } catch (err) {
    console.error('加载会话列表失败:', err)
  }
}

async function onCreateSession() {
  try {
    const session = await createAiSession()
    console.log('创建会话成功:', session)

    // 处理后端返回字段名不匹配：session_id vs id
    const sessionId = session.id || session.session_id
    if (!session || !sessionId) {
      console.error('创建的会话无效:', session)
      MessagePlugin.error('创建对话失败：返回数据无效')
      return
    }

    // 统一使用id字段
    const normalizedSession = {
      ...session,
      id: sessionId
    }

    sessions.value.unshift(normalizedSession)
    onSelectSession(sessionId)
    MessagePlugin.success('已创建新对话')
  } catch (err) {
    console.error('创建对话失败:', err)
    MessagePlugin.error('创建对话失败')
  }
}

async function onSelectSession(sessionId: string | number) {
  if (!sessionId) {
    console.warn('会话ID无效，跳过加载')
    return
  }
  currentSessionId.value = sessionId
  try {
    const data = await getSessionMessages(sessionId)
    // 兼容后端可能返回数组或 {messages:[...]} / {data:[...]} 等结构
    let rawList: any[] = []
    if (Array.isArray(data)) {
      rawList = data
    } else if (data && Array.isArray((data as any).messages)) {
      rawList = (data as any).messages
    } else if (data && Array.isArray((data as any).data)) {
      rawList = (data as any).data
    }

    // 规范化每条消息字段：后端用 timestamp，前端用 created_at；补充 id
    messages.value = rawList
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m, idx) => ({
        id: m.id ?? idx,
        session_id: sessionId,
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        created_at: m.created_at || m.timestamp || '',
      }))
    scrollToBottom()
  } catch (err) {
    console.error('加载消息失败:', err)
    messages.value = []
  }
}

async function onDeleteSession(sessionId: string | number) {
  if (!sessionId) {
    console.error('删除会话失败：会话ID无效', sessionId)
    MessagePlugin.error('会话ID无效')
    return
  }

  try {
    await deleteAiSession(sessionId)
    sessions.value = sessions.value.filter(s => s.id !== sessionId)
    if (currentSessionId.value === sessionId) {
      if (sessions.value.length > 0) {
        onSelectSession(sessions.value[0].id)
      } else {
        // 删除最后一个会话后，创建新会话
        currentSessionId.value = null
        messages.value = []
        await onCreateSession()
      }
    }
    MessagePlugin.success('已删除对话')
  } catch (err) {
    console.error('删除对话失败:', err)
    MessagePlugin.error('删除对话失败')
  }
}

function onRenameSession(session: any) {
  const sessionId = session.id
  if (!sessionId) {
    MessagePlugin.error('会话ID无效')
    return
  }
  const input = window.prompt('重命名对话', session.title || '')
  if (input === null) return  // 用户取消
  const newTitle = input.trim()
  if (!newTitle) {
    MessagePlugin.error('标题不能为空')
    return
  }
  renameAiSession(sessionId, newTitle)
    .then(() => {
      const s = sessions.value.find(x => x.id === sessionId)
      if (s) s.title = newTitle
      MessagePlugin.success('已重命名')
    })
    .catch((err) => {
      console.error('重命名失败:', err)
      MessagePlugin.error('重命名失败')
    })
}

function onUseTemplate(template: any) {
  inputMessage.value = template.text
  onSendMessage()
}

async function onSendMessage() {
  if (!inputMessage.value.trim() || !currentSessionId.value || streaming.value) return

  const userMessage = inputMessage.value.trim()
  inputMessage.value = ''

  // 添加用户消息到界面
  if (!Array.isArray(messages.value)) messages.value = []
  messages.value.push({
    id: Date.now(),
    session_id: currentSessionId.value,
    role: 'user',
    content: userMessage,
    created_at: new Date().toISOString(),
  })

  scrollToBottom()

  // 开始流式响应
  streaming.value = true
  streamContent.value = ''

  const stopStream = chatStream(
    currentSessionId.value,
    userMessage,
    (chunk) => {
      streamContent.value += chunk
      scrollToBottom()
    },
    () => {
      // 流式结束，将完整消息添加到消息列表（仅在有内容时）
      if (streamContent.value) {
        if (!Array.isArray(messages.value)) messages.value = []
        messages.value.push({
          id: Date.now(),
          session_id: currentSessionId.value!,
          role: 'assistant',
          content: streamContent.value,
          created_at: new Date().toISOString(),
        })
      }
      streaming.value = false
      streamContent.value = ''
      scrollToBottom()
    },
    (err) => {
      streaming.value = false
      streamContent.value = ''
      MessagePlugin.error('发送消息失败')
      console.error('SSE错误:', err)
    }
  )
}

function renderMarkdown(content: string) {
  if (!content) return ''
  try {
    return marked(content, { breaks: true })
  } catch (err) {
    console.error('Markdown渲染失败:', err)
    return content
  }
}

function formatTime(isoTime: string) {
  if (!isoTime) return ''
  const date = new Date(isoTime)
  if (isNaN(date.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString()
}

function scrollToBottom() {
  nextTick(() => {
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
    }
  })
}
</script>

<style scoped>
.ai-assistant {
  height: calc(100vh - 64px);
  padding: 20px;
}

.assistant-container {
  display: flex;
  height: 100%;
  gap: 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  overflow: hidden;
}

/* 左侧会话列表 */
.session-sidebar {
  width: 280px;
  border-right: 1px solid #e7e7e7;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e7e7e7;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  position: relative;
  transition: background 0.2s;
}

.session-item:hover {
  background: #f5f5f5;
}

.session-item.active {
  background: #e6f0ff;
}

.session-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-time {
  font-size: 12px;
  color: #999;
}

.session-actions {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.session-item:hover .session-actions {
  opacity: 1;
}

/* 右侧对话区域 */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 16px;
  border-bottom: 1px solid #e7e7e7;
}

.chat-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

/* 预设问题 */
.quick-templates {
  padding: 24px;
}

.template-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1a1a1a;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.template-card {
  padding: 16px;
  border: 1px solid #e7e7e7;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
}

.template-card:hover {
  border-color: #0052d9;
  background: #f5f9ff;
}

.template-icon {
  font-size: 24px;
  color: #0052d9;
}

.template-text {
  font-size: 14px;
  color: #333;
}

/* 消息列表 */
.message-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.message-wrapper {
  margin-bottom: 20px;
  display: flex;
}

.message-wrapper.user {
  justify-content: flex-end;
}

.message-wrapper.assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 8px;
}

.message-wrapper.user .message-bubble {
  background: #0052d9;
  color: #fff;
}

.message-wrapper.assistant .message-bubble {
  background: #f5f5f5;
  color: #333;
}

.message-role {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}

.message-wrapper.user .message-role {
  color: rgba(255,255,255,0.8);
}

.message-wrapper.assistant .message-role {
  color: #666;
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.message-content :deep(pre) {
  background: #2d2d2d;
  color: #f8f8f2;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 8px 0;
}

.message-content :deep(code) {
  background: rgba(0,0,0,0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.message-time {
  font-size: 11px;
  margin-top: 6px;
}

.message-wrapper.user .message-time {
  color: rgba(255,255,255,0.6);
}

.message-wrapper.assistant .message-time {
  color: #999;
}

/* 输入区域 */
.input-area {
  padding: 16px;
  border-top: 1px solid #e7e7e7;
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-area :deep(.t-textarea) {
  flex: 1;
}

.custom-textarea {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dcdcdc;
  border-radius: 3px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  min-height: 60px;
  max-height: 200px;
  transition: border-color 0.2s;
}

.custom-textarea:focus {
  outline: none;
  border-color: #0052d9;
}

.custom-textarea:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.custom-textarea::placeholder {
  color: #999;
}
</style>
