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
          <t-textarea
            v-model="inputMessage"
            placeholder="输入您的问题..."
            :autosize="{ minRows: 2, maxRows: 6 }"
            @keydown.enter.ctrl="onSendMessage"
            :disabled="streaming"
          />
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
import { listAiSessions, createAiSession, deleteAiSession, getSessionMessages, chatStream } from '@/api/ai'
import { marked } from 'marked'

const sessions = ref<any[]>([])
const currentSessionId = ref<number | null>(null)
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
    const data = await listAiSessions()
    sessions.value = data
    if (data.length > 0 && !currentSessionId.value) {
      onSelectSession(data[0].id)
    }
  } catch (err) {
    console.error('加载会话列表失败:', err)
  }
}

async function onCreateSession() {
  try {
    const session = await createAiSession()
    sessions.value.unshift(session)
    onSelectSession(session.id)
    MessagePlugin.success('已创建新对话')
  } catch (err) {
    MessagePlugin.error('创建对话失败')
  }
}

async function onSelectSession(sessionId: number) {
  currentSessionId.value = sessionId
  try {
    const data = await getSessionMessages(sessionId)
    messages.value = data
    scrollToBottom()
  } catch (err) {
    console.error('加载消息失败:', err)
    messages.value = []
  }
}

async function onDeleteSession(sessionId: number) {
  try {
    await deleteAiSession(sessionId)
    sessions.value = sessions.value.filter(s => s.id !== sessionId)
    if (currentSessionId.value === sessionId) {
      currentSessionId.value = sessions.value.length > 0 ? sessions.value[0].id : null
      if (currentSessionId.value) {
        onSelectSession(currentSessionId.value)
      } else {
        messages.value = []
      }
    }
    MessagePlugin.success('已删除对话')
  } catch (err) {
    MessagePlugin.error('删除对话失败')
  }
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
      // 流式结束，将完整消息添加到消息列表
      messages.value.push({
        id: Date.now(),
        session_id: currentSessionId.value!,
        role: 'assistant',
        content: streamContent.value,
        created_at: new Date().toISOString(),
      })
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
  return marked(content, { breaks: true })
}

function formatTime(isoTime: string) {
  const date = new Date(isoTime)
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

.delete-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s;
}

.session-item:hover .delete-btn {
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
</style>
