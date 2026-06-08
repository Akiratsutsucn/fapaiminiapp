/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted, nextTick } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { listAiSessions, createAiSession, deleteAiSession, getSessionMessages, chatStream } from '@/api/ai';
import { marked } from 'marked';
const sessions = ref([]);
const currentSessionId = ref(null);
const messages = ref([]);
const inputMessage = ref('');
const streaming = ref(false);
const streamContent = ref('');
const messageContainer = ref(null);
const templates = [
    { icon: 'chart-line', text: '分析最近的房源数据趋势' },
    { icon: 'error-circle', text: '总结数据审核中的主要问题' },
    { icon: 'user-setting', text: '查看用户增长情况' },
    { icon: 'swap', text: '检查爬虫运行状态' },
];
onMounted(() => {
    loadSessions();
});
async function loadSessions() {
    try {
        const data = await listAiSessions();
        sessions.value = data;
        if (data.length > 0 && !currentSessionId.value) {
            onSelectSession(data[0].id);
        }
    }
    catch (err) {
        console.error('加载会话列表失败:', err);
    }
}
async function onCreateSession() {
    try {
        const session = await createAiSession();
        sessions.value.unshift(session);
        onSelectSession(session.id);
        MessagePlugin.success('已创建新对话');
    }
    catch (err) {
        MessagePlugin.error('创建对话失败');
    }
}
async function onSelectSession(sessionId) {
    currentSessionId.value = sessionId;
    try {
        const data = await getSessionMessages(sessionId);
        messages.value = data;
        scrollToBottom();
    }
    catch (err) {
        console.error('加载消息失败:', err);
        messages.value = [];
    }
}
async function onDeleteSession(sessionId) {
    try {
        await deleteAiSession(sessionId);
        sessions.value = sessions.value.filter(s => s.id !== sessionId);
        if (currentSessionId.value === sessionId) {
            currentSessionId.value = sessions.value.length > 0 ? sessions.value[0].id : null;
            if (currentSessionId.value) {
                onSelectSession(currentSessionId.value);
            }
            else {
                messages.value = [];
            }
        }
        MessagePlugin.success('已删除对话');
    }
    catch (err) {
        MessagePlugin.error('删除对话失败');
    }
}
function onUseTemplate(template) {
    inputMessage.value = template.text;
    onSendMessage();
}
async function onSendMessage() {
    if (!inputMessage.value.trim() || !currentSessionId.value || streaming.value)
        return;
    const userMessage = inputMessage.value.trim();
    inputMessage.value = '';
    // 添加用户消息到界面
    messages.value.push({
        id: Date.now(),
        session_id: currentSessionId.value,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString(),
    });
    scrollToBottom();
    // 开始流式响应
    streaming.value = true;
    streamContent.value = '';
    const stopStream = chatStream(currentSessionId.value, userMessage, (chunk) => {
        streamContent.value += chunk;
        scrollToBottom();
    }, () => {
        // 流式结束，将完整消息添加到消息列表
        messages.value.push({
            id: Date.now(),
            session_id: currentSessionId.value,
            role: 'assistant',
            content: streamContent.value,
            created_at: new Date().toISOString(),
        });
        streaming.value = false;
        streamContent.value = '';
        scrollToBottom();
    }, (err) => {
        streaming.value = false;
        streamContent.value = '';
        MessagePlugin.error('发送消息失败');
        console.error('SSE错误:', err);
    });
}
function renderMarkdown(content) {
    return marked(content, { breaks: true });
}
function formatTime(isoTime) {
    const date = new Date(isoTime);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1)
        return '刚刚';
    if (minutes < 60)
        return `${minutes}分钟前`;
    if (hours < 24)
        return `${hours}小时前`;
    if (days < 7)
        return `${days}天前`;
    return date.toLocaleDateString();
}
function scrollToBottom() {
    nextTick(() => {
        if (messageContainer.value) {
            messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
        }
    });
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['session-item']} */ ;
/** @type {__VLS_StyleScopedClasses['session-item']} */ ;
/** @type {__VLS_StyleScopedClasses['session-item']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['template-card']} */ ;
/** @type {__VLS_StyleScopedClasses['message-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['message-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['message-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['user']} */ ;
/** @type {__VLS_StyleScopedClasses['message-bubble']} */ ;
/** @type {__VLS_StyleScopedClasses['message-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['assistant']} */ ;
/** @type {__VLS_StyleScopedClasses['message-bubble']} */ ;
/** @type {__VLS_StyleScopedClasses['message-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['user']} */ ;
/** @type {__VLS_StyleScopedClasses['message-role']} */ ;
/** @type {__VLS_StyleScopedClasses['message-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['assistant']} */ ;
/** @type {__VLS_StyleScopedClasses['message-role']} */ ;
/** @type {__VLS_StyleScopedClasses['message-content']} */ ;
/** @type {__VLS_StyleScopedClasses['message-content']} */ ;
/** @type {__VLS_StyleScopedClasses['message-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['user']} */ ;
/** @type {__VLS_StyleScopedClasses['message-time']} */ ;
/** @type {__VLS_StyleScopedClasses['message-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['assistant']} */ ;
/** @type {__VLS_StyleScopedClasses['message-time']} */ ;
/** @type {__VLS_StyleScopedClasses['input-area']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ai-assistant" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "assistant-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "session-sidebar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sidebar-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "sidebar-title" },
});
const __VLS_0 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    size: "small",
    theme: "primary",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    size: "small",
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onClick: (__VLS_ctx.onCreateSession)
};
__VLS_3.slots.default;
{
    const { icon: __VLS_thisSlot } = __VLS_3.slots;
    const __VLS_8 = {}.TIcon;
    /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        name: "add",
    }));
    const __VLS_10 = __VLS_9({
        name: "add",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
}
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "session-list" },
});
for (const [session] of __VLS_getVForSourceType((__VLS_ctx.sessions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.onSelectSession(session.id);
            } },
        key: (session.id),
        ...{ class: "session-item" },
        ...{ class: ({ active: __VLS_ctx.currentSessionId === session.id }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "session-title" },
    });
    (session.title || '新对话');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "session-time" },
    });
    (__VLS_ctx.formatTime(session.updated_at));
    const __VLS_12 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
        theme: "danger",
        ...{ class: "delete-btn" },
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
        theme: "danger",
        ...{ class: "delete-btn" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_16;
    let __VLS_17;
    let __VLS_18;
    const __VLS_19 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onDeleteSession(session.id);
        }
    };
    __VLS_15.slots.default;
    {
        const { icon: __VLS_thisSlot } = __VLS_15.slots;
        const __VLS_20 = {}.TIcon;
        /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            name: "delete",
        }));
        const __VLS_22 = __VLS_21({
            name: "delete",
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    var __VLS_15;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "chat-area" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "chat-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "chat-title" },
});
if (__VLS_ctx.messages.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "quick-templates" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "template-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "template-grid" },
    });
    for (const [template, idx] of __VLS_getVForSourceType((__VLS_ctx.templates))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.messages.length === 0))
                        return;
                    __VLS_ctx.onUseTemplate(template);
                } },
            key: (idx),
            ...{ class: "template-card" },
        });
        const __VLS_24 = {}.TIcon;
        /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
            name: (template.icon),
            ...{ class: "template-icon" },
        }));
        const __VLS_26 = __VLS_25({
            name: (template.icon),
            ...{ class: "template-icon" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_25));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "template-text" },
        });
        (template.text);
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "message-container" },
    ref: "messageContainer",
});
/** @type {typeof __VLS_ctx.messageContainer} */ ;
for (const [msg] of __VLS_getVForSourceType((__VLS_ctx.messages))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (msg.id),
        ...{ class: "message-wrapper" },
        ...{ class: (msg.role) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "message-bubble" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "message-role" },
    });
    (msg.role === 'user' ? '我' : 'AI');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "message-content" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderMarkdown(msg.content)) }, null, null);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "message-time" },
    });
    (__VLS_ctx.formatTime(msg.created_at));
}
if (__VLS_ctx.streaming && __VLS_ctx.streamContent) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "message-wrapper assistant" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "message-bubble" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "message-role" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "message-content" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderMarkdown(__VLS_ctx.streamContent)) }, null, null);
    const __VLS_28 = {}.TLoading;
    /** @type {[typeof __VLS_components.TLoading, typeof __VLS_components.tLoading, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        size: "small",
        ...{ style: {} },
    }));
    const __VLS_30 = __VLS_29({
        size: "small",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "input-area" },
});
const __VLS_32 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.inputMessage),
    placeholder: "输入您的问题...",
    autosize: ({ minRows: 2, maxRows: 6 }),
    disabled: (__VLS_ctx.streaming),
}));
const __VLS_34 = __VLS_33({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.inputMessage),
    placeholder: "输入您的问题...",
    autosize: ({ minRows: 2, maxRows: 6 }),
    disabled: (__VLS_ctx.streaming),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_36;
let __VLS_37;
let __VLS_38;
const __VLS_39 = {
    onKeydown: (__VLS_ctx.onSendMessage)
};
var __VLS_35;
const __VLS_40 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    ...{ 'onClick': {} },
    theme: "primary",
    loading: (__VLS_ctx.streaming),
    disabled: (!__VLS_ctx.inputMessage.trim() || !__VLS_ctx.currentSessionId),
}));
const __VLS_42 = __VLS_41({
    ...{ 'onClick': {} },
    theme: "primary",
    loading: (__VLS_ctx.streaming),
    disabled: (!__VLS_ctx.inputMessage.trim() || !__VLS_ctx.currentSessionId),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
let __VLS_44;
let __VLS_45;
let __VLS_46;
const __VLS_47 = {
    onClick: (__VLS_ctx.onSendMessage)
};
__VLS_43.slots.default;
{
    const { icon: __VLS_thisSlot } = __VLS_43.slots;
    const __VLS_48 = {}.TIcon;
    /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        name: "send",
    }));
    const __VLS_50 = __VLS_49({
        name: "send",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
}
var __VLS_43;
/** @type {__VLS_StyleScopedClasses['ai-assistant']} */ ;
/** @type {__VLS_StyleScopedClasses['assistant-container']} */ ;
/** @type {__VLS_StyleScopedClasses['session-sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-header']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-title']} */ ;
/** @type {__VLS_StyleScopedClasses['session-list']} */ ;
/** @type {__VLS_StyleScopedClasses['session-item']} */ ;
/** @type {__VLS_StyleScopedClasses['session-title']} */ ;
/** @type {__VLS_StyleScopedClasses['session-time']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-area']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-header']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-title']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-templates']} */ ;
/** @type {__VLS_StyleScopedClasses['template-title']} */ ;
/** @type {__VLS_StyleScopedClasses['template-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['template-card']} */ ;
/** @type {__VLS_StyleScopedClasses['template-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['template-text']} */ ;
/** @type {__VLS_StyleScopedClasses['message-container']} */ ;
/** @type {__VLS_StyleScopedClasses['message-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['message-bubble']} */ ;
/** @type {__VLS_StyleScopedClasses['message-role']} */ ;
/** @type {__VLS_StyleScopedClasses['message-content']} */ ;
/** @type {__VLS_StyleScopedClasses['message-time']} */ ;
/** @type {__VLS_StyleScopedClasses['message-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['assistant']} */ ;
/** @type {__VLS_StyleScopedClasses['message-bubble']} */ ;
/** @type {__VLS_StyleScopedClasses['message-role']} */ ;
/** @type {__VLS_StyleScopedClasses['message-content']} */ ;
/** @type {__VLS_StyleScopedClasses['input-area']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            sessions: sessions,
            currentSessionId: currentSessionId,
            messages: messages,
            inputMessage: inputMessage,
            streaming: streaming,
            streamContent: streamContent,
            messageContainer: messageContainer,
            templates: templates,
            onCreateSession: onCreateSession,
            onSelectSession: onSelectSession,
            onDeleteSession: onDeleteSession,
            onUseTemplate: onUseTemplate,
            onSendMessage: onSendMessage,
            renderMarkdown: renderMarkdown,
            formatTime: formatTime,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
