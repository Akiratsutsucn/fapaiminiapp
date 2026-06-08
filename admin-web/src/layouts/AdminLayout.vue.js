/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';
import { startIdleTimer, stopIdleTimer } from '@/utils/idleTimer';
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const collapsed = ref(false);
const ALL_MENUS = [
    { path: '/dashboard', label: '数据看板', icon: 'chart-bar', roles: ['admin', 'agent', 'leader'] },
    { path: '/ai-assistant', label: 'AI助手', icon: 'chat', roles: ['admin'] },
    { path: '/users', label: '用户管理', icon: 'user', roles: ['admin', 'agent'] },
    { path: '/properties', label: '房源管理', icon: 'home', roles: ['admin'] },
    { path: '/demands', label: '需求管理', icon: 'task', roles: ['admin', 'agent'] },
    { path: '/articles', label: '文章管理', icon: 'file-paste', roles: ['admin', 'content_manager'] },
    { path: '/banners', label: '横幅管理', icon: 'image', roles: ['admin', 'content_manager'] },
    { path: '/crawler', label: '爬虫管理', icon: 'cloud-download', roles: ['admin', 'content_manager'] },
    { path: '/data-audit/executions', label: '审核历史', icon: 'check-circle', roles: ['admin'] },
    { path: '/communities', label: '小区管理', icon: 'shop', roles: ['admin'] },
    { path: '/settings', label: '系统设置', icon: 'setting', roles: ['admin'] },
];
const visibleMenus = computed(() => ALL_MENUS.filter(m => auth.hasRole(m.roles)));
const activeMenu = computed(() => '/' + (route.path.split('/').filter(Boolean)[0] || 'dashboard'));
const currentTitle = computed(() => route.meta.title || '');
const roleLabel = computed(() => {
    const r = auth.role;
    if (r === 'admin')
        return '最高管理员';
    if (r === 'leader')
        return '领导';
    if (r === 'content_manager')
        return '内容管理员';
    if (r === 'agent')
        return '代理商';
    if (r === 'salesperson')
        return '业务员';
    return '';
});
function onMenuChange(val) { router.push(val); }
function onLogout() {
    DialogPlugin.confirm({ header: '退出登录', body: '确定要退出管理后台吗？', onConfirm: () => { stopIdleTimer(); auth.logout(); router.push('/login'); } });
}
// 30 分钟无操作 → 自动登出
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
onMounted(() => {
    startIdleTimer(() => {
        auth.logout();
        MessagePlugin.warning('30 分钟无操作，请重新登录');
        router.push('/login');
    }, IDLE_TIMEOUT_MS);
});
onUnmounted(() => {
    stopIdleTimer();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.TLayout;
/** @type {[typeof __VLS_components.TLayout, typeof __VLS_components.tLayout, typeof __VLS_components.TLayout, typeof __VLS_components.tLayout, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "admin-layout" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "admin-layout" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
__VLS_3.slots.default;
const __VLS_5 = {}.TAside;
/** @type {[typeof __VLS_components.TAside, typeof __VLS_components.tAside, typeof __VLS_components.TAside, typeof __VLS_components.tAside, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    width: (__VLS_ctx.collapsed ? '64px' : '220px'),
    ...{ class: "admin-aside" },
}));
const __VLS_7 = __VLS_6({
    width: (__VLS_ctx.collapsed ? '64px' : '220px'),
    ...{ class: "admin-aside" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_8.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.router.push('/dashboard');
        } },
    ...{ class: "logo" },
});
if (!__VLS_ctx.collapsed) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "logo-text" },
    });
}
if (!__VLS_ctx.collapsed) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "logo-version" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "logo-text-short" },
    });
}
const __VLS_9 = {}.TMenu;
/** @type {[typeof __VLS_components.TMenu, typeof __VLS_components.tMenu, typeof __VLS_components.TMenu, typeof __VLS_components.tMenu, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    ...{ 'onChange': {} },
    value: (__VLS_ctx.activeMenu),
    collapsed: (__VLS_ctx.collapsed),
    theme: "dark",
}));
const __VLS_11 = __VLS_10({
    ...{ 'onChange': {} },
    value: (__VLS_ctx.activeMenu),
    collapsed: (__VLS_ctx.collapsed),
    theme: "dark",
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
let __VLS_13;
let __VLS_14;
let __VLS_15;
const __VLS_16 = {
    onChange: (__VLS_ctx.onMenuChange)
};
__VLS_12.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.visibleMenus))) {
    const __VLS_17 = {}.TMenuItem;
    /** @type {[typeof __VLS_components.TMenuItem, typeof __VLS_components.tMenuItem, typeof __VLS_components.TMenuItem, typeof __VLS_components.tMenuItem, ]} */ ;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
        value: (item.path),
    }));
    const __VLS_19 = __VLS_18({
        value: (item.path),
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    __VLS_20.slots.default;
    {
        const { icon: __VLS_thisSlot } = __VLS_20.slots;
        const __VLS_21 = {}.TIcon;
        /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
        // @ts-ignore
        const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
            name: (item.icon),
        }));
        const __VLS_23 = __VLS_22({
            name: (item.icon),
        }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    }
    (item.label);
    var __VLS_20;
}
var __VLS_12;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "aside-footer" },
});
const __VLS_25 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    ...{ 'onClick': {} },
    variant: "text",
    theme: "default",
    ...{ class: "logout-btn" },
}));
const __VLS_27 = __VLS_26({
    ...{ 'onClick': {} },
    variant: "text",
    theme: "default",
    ...{ class: "logout-btn" },
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
let __VLS_29;
let __VLS_30;
let __VLS_31;
const __VLS_32 = {
    onClick: (__VLS_ctx.onLogout)
};
__VLS_28.slots.default;
const __VLS_33 = {}.TIcon;
/** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    name: "poweroff",
}));
const __VLS_35 = __VLS_34({
    name: "poweroff",
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
if (!__VLS_ctx.collapsed) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
var __VLS_28;
var __VLS_8;
const __VLS_37 = {}.TLayout;
/** @type {[typeof __VLS_components.TLayout, typeof __VLS_components.tLayout, typeof __VLS_components.TLayout, typeof __VLS_components.tLayout, ]} */ ;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({}));
const __VLS_39 = __VLS_38({}, ...__VLS_functionalComponentArgsRest(__VLS_38));
__VLS_40.slots.default;
const __VLS_41 = {}.THeader;
/** @type {[typeof __VLS_components.THeader, typeof __VLS_components.tHeader, typeof __VLS_components.THeader, typeof __VLS_components.tHeader, ]} */ ;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
    ...{ class: "admin-header" },
}));
const __VLS_43 = __VLS_42({
    ...{ class: "admin-header" },
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
__VLS_44.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-left" },
});
const __VLS_45 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_47 = __VLS_46({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_46));
let __VLS_49;
let __VLS_50;
let __VLS_51;
const __VLS_52 = {
    onClick: (...[$event]) => {
        __VLS_ctx.collapsed = !__VLS_ctx.collapsed;
    }
};
__VLS_48.slots.default;
const __VLS_53 = {}.TIcon;
/** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
    name: (__VLS_ctx.collapsed ? 'menu-fold' : 'menu-unfold'),
}));
const __VLS_55 = __VLS_54({
    name: (__VLS_ctx.collapsed ? 'menu-fold' : 'menu-unfold'),
}, ...__VLS_functionalComponentArgsRest(__VLS_54));
var __VLS_48;
const __VLS_57 = {}.TBreadcrumb;
/** @type {[typeof __VLS_components.TBreadcrumb, typeof __VLS_components.tBreadcrumb, typeof __VLS_components.TBreadcrumb, typeof __VLS_components.tBreadcrumb, ]} */ ;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({}));
const __VLS_59 = __VLS_58({}, ...__VLS_functionalComponentArgsRest(__VLS_58));
__VLS_60.slots.default;
const __VLS_61 = {}.TBreadcrumbItem;
/** @type {[typeof __VLS_components.TBreadcrumbItem, typeof __VLS_components.tBreadcrumbItem, typeof __VLS_components.TBreadcrumbItem, typeof __VLS_components.tBreadcrumbItem, ]} */ ;
// @ts-ignore
const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({}));
const __VLS_63 = __VLS_62({}, ...__VLS_functionalComponentArgsRest(__VLS_62));
__VLS_64.slots.default;
(__VLS_ctx.currentTitle);
var __VLS_64;
var __VLS_60;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-right" },
});
if (__VLS_ctx.roleLabel) {
    const __VLS_65 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
        theme: (__VLS_ctx.auth.isAdmin ? 'primary' : 'warning'),
        variant: "light",
        ...{ style: {} },
    }));
    const __VLS_67 = __VLS_66({
        theme: (__VLS_ctx.auth.isAdmin ? 'primary' : 'warning'),
        variant: "light",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
    __VLS_68.slots.default;
    (__VLS_ctx.roleLabel);
    var __VLS_68;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "user-name" },
});
(__VLS_ctx.auth.user?.nickname || '管理员');
var __VLS_44;
const __VLS_69 = {}.TContent;
/** @type {[typeof __VLS_components.TContent, typeof __VLS_components.tContent, typeof __VLS_components.TContent, typeof __VLS_components.tContent, ]} */ ;
// @ts-ignore
const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
    ...{ class: "admin-content" },
}));
const __VLS_71 = __VLS_70({
    ...{ class: "admin-content" },
}, ...__VLS_functionalComponentArgsRest(__VLS_70));
__VLS_72.slots.default;
const __VLS_73 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ ;
// @ts-ignore
const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({}));
const __VLS_75 = __VLS_74({}, ...__VLS_functionalComponentArgsRest(__VLS_74));
var __VLS_72;
var __VLS_40;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['admin-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['admin-aside']} */ ;
/** @type {__VLS_StyleScopedClasses['logo']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-text']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-version']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-text-short']} */ ;
/** @type {__VLS_StyleScopedClasses['aside-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['logout-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['admin-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-left']} */ ;
/** @type {__VLS_StyleScopedClasses['header-right']} */ ;
/** @type {__VLS_StyleScopedClasses['user-name']} */ ;
/** @type {__VLS_StyleScopedClasses['admin-content']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            router: router,
            auth: auth,
            collapsed: collapsed,
            visibleMenus: visibleMenus,
            activeMenu: activeMenu,
            currentTitle: currentTitle,
            roleLabel: roleLabel,
            onMenuChange: onMenuChange,
            onLogout: onLogout,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
