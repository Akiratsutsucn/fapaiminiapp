/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getDashboard } from '@/api/dashboard';
import { getCrawlerStatus, triggerCrawler } from '@/api/crawler';
const router = useRouter();
const triggerLoading = ref(false);
const cityId = ref(0); // 0=全部, 310000=上海, 330200=宁波
const cards = ref([
    { label: '总房源数', value: 0 },
    { label: '今日新增', value: 0 },
    { label: '即将开拍', value: 0 },
    { label: '捡漏房源', value: 0 },
    { label: '昨日上架', value: 0 },
    { label: '昨日成交', value: 0 },
    { label: '注册用户', value: 0 },
    { label: '代理商', value: 0 },
    { label: '待处理需求', value: 0 },
    { label: '待处理留言', value: 0 },
    { label: '已成交', value: 0 },
    { label: '总文章数', value: 0 },
]);
const crawlerItems = ref([
    { label: '最近运行', value: '--' },
    { label: '运行状态', value: '--' },
]);
async function loadDashboard() {
    try {
        const data = await getDashboard(cityId.value || undefined);
        cards.value[0].value = data.total_properties || 0;
        cards.value[1].value = data.today_new || 0;
        cards.value[2].value = data.upcoming || 0;
        cards.value[3].value = data.bargain_count || 0;
        cards.value[4].value = data.yesterday_listed || 0;
        cards.value[5].value = data.yesterday_sold || 0;
        cards.value[6].value = data.total_users || 0;
        cards.value[7].value = data.agent_count || 0;
        cards.value[8].value = data.pending_demands || 0;
        cards.value[9].value = data.pending_messages || 0;
        cards.value[10].value = data.sold || 0;
        cards.value[11].value = data.total_articles || 0;
    }
    catch { /* skip */ }
}
onMounted(async () => {
    loadDashboard();
    try {
        const status = await getCrawlerStatus();
        crawlerItems.value = [
            { label: '最近运行', value: status.last_run_at || '--' },
            { label: '运行状态', value: status.is_running ? '运行中' : (status.last_status || '--') },
        ];
    }
    catch { /* skip */ }
});
async function onTriggerCrawl() {
    triggerLoading.value = true;
    try {
        await triggerCrawler();
        MessagePlugin.success('爬取任务已创建');
    }
    finally {
        triggerLoading.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "dashboard" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "page-title" },
});
const __VLS_0 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.cityId),
    ...{ style: {} },
}));
const __VLS_2 = __VLS_1({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.cityId),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onChange: (__VLS_ctx.loadDashboard)
};
__VLS_3.slots.default;
const __VLS_8 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    value: (0),
    label: "全部",
}));
const __VLS_10 = __VLS_9({
    value: (0),
    label: "全部",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
const __VLS_12 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    value: (310000),
    label: "上海",
}));
const __VLS_14 = __VLS_13({
    value: (310000),
    label: "上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
const __VLS_16 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    value: (330200),
    label: "宁波",
}));
const __VLS_18 = __VLS_17({
    value: (330200),
    label: "宁波",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
var __VLS_3;
const __VLS_20 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    gutter: (16),
    ...{ class: "stat-cards" },
}));
const __VLS_22 = __VLS_21({
    gutter: (16),
    ...{ class: "stat-cards" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
for (const [card] of __VLS_getVForSourceType((__VLS_ctx.cards))) {
    const __VLS_24 = {}.TCol;
    /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        span: (3),
        key: (card.label),
    }));
    const __VLS_26 = __VLS_25({
        span: (3),
        key: (card.label),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_27.slots.default;
    const __VLS_28 = {}.TCard;
    /** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        title: (card.label),
        hoverShadow: true,
    }));
    const __VLS_30 = __VLS_29({
        title: (card.label),
        hoverShadow: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_31.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-value" },
    });
    (card.value);
    var __VLS_31;
    var __VLS_27;
}
var __VLS_23;
const __VLS_32 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    gutter: (16),
    ...{ style: {} },
}));
const __VLS_34 = __VLS_33({
    gutter: (16),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
const __VLS_36 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    span: (6),
}));
const __VLS_38 = __VLS_37({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
const __VLS_40 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    title: "爬虫运行状态",
}));
const __VLS_42 = __VLS_41({
    title: "爬虫运行状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
const __VLS_44 = {}.TDescriptions;
/** @type {[typeof __VLS_components.TDescriptions, typeof __VLS_components.tDescriptions, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    items: (__VLS_ctx.crawlerItems),
}));
const __VLS_46 = __VLS_45({
    items: (__VLS_ctx.crawlerItems),
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
const __VLS_48 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ 'onClick': {} },
    theme: "primary",
    size: "small",
    loading: (__VLS_ctx.triggerLoading),
    ...{ style: {} },
}));
const __VLS_50 = __VLS_49({
    ...{ 'onClick': {} },
    theme: "primary",
    size: "small",
    loading: (__VLS_ctx.triggerLoading),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
let __VLS_52;
let __VLS_53;
let __VLS_54;
const __VLS_55 = {
    onClick: (__VLS_ctx.onTriggerCrawl)
};
__VLS_51.slots.default;
var __VLS_51;
var __VLS_43;
var __VLS_39;
const __VLS_56 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    span: (6),
}));
const __VLS_58 = __VLS_57({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
const __VLS_60 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    title: "快速入口",
}));
const __VLS_62 = __VLS_61({
    title: "快速入口",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
const __VLS_64 = {}.TSpace;
/** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    direction: "vertical",
    ...{ style: {} },
}));
const __VLS_66 = __VLS_65({
    direction: "vertical",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
const __VLS_68 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    ...{ 'onClick': {} },
    variant: "outline",
    block: true,
}));
const __VLS_70 = __VLS_69({
    ...{ 'onClick': {} },
    variant: "outline",
    block: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
let __VLS_72;
let __VLS_73;
let __VLS_74;
const __VLS_75 = {
    onClick: (...[$event]) => {
        __VLS_ctx.router.push('/properties');
    }
};
__VLS_71.slots.default;
var __VLS_71;
const __VLS_76 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    ...{ 'onClick': {} },
    variant: "outline",
    block: true,
}));
const __VLS_78 = __VLS_77({
    ...{ 'onClick': {} },
    variant: "outline",
    block: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
let __VLS_80;
let __VLS_81;
let __VLS_82;
const __VLS_83 = {
    onClick: (...[$event]) => {
        __VLS_ctx.router.push('/demands');
    }
};
__VLS_79.slots.default;
var __VLS_79;
const __VLS_84 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    ...{ 'onClick': {} },
    variant: "outline",
    block: true,
}));
const __VLS_86 = __VLS_85({
    ...{ 'onClick': {} },
    variant: "outline",
    block: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
let __VLS_88;
let __VLS_89;
let __VLS_90;
const __VLS_91 = {
    onClick: (...[$event]) => {
        __VLS_ctx.router.push('/articles');
    }
};
__VLS_87.slots.default;
var __VLS_87;
var __VLS_67;
var __VLS_63;
var __VLS_59;
var __VLS_35;
/** @type {__VLS_StyleScopedClasses['dashboard']} */ ;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-cards']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            router: router,
            triggerLoading: triggerLoading,
            cityId: cityId,
            cards: cards,
            crawlerItems: crawlerItems,
            loadDashboard: loadDashboard,
            onTriggerCrawl: onTriggerCrawl,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
