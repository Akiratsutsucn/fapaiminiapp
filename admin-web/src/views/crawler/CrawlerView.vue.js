/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getCrawlerStatus, listCrawlerTasks, triggerCrawler } from '@/api/crawler';
const triggerLoading = ref(false);
const taskLoading = ref(false);
const tasks = ref([]);
const statsVisible = ref(false);
const currentStats = ref(null);
function showStats(row) {
    currentStats.value = row.stats_summary;
    statsVisible.value = true;
}
const statusItems = ref([{ label: '最近运行', value: '--' }, { label: '当前状态', value: '--' }]);
const taskColumns = [
    { colKey: 'id', title: 'ID', width: 70 },
    { colKey: 'platform', title: '平台', width: 100 },
    { colKey: 'city', title: '城市', width: 80 },
    { colKey: 'status', title: '状态', width: 90 },
    { colKey: 'total_count', title: '抓取数', width: 80 },
    { colKey: 'new_count', title: '新增', width: 70 },
    { colKey: 'updated_count', title: '更新', width: 70 },
    { colKey: 'success_count', title: '成功', width: 80 },
    { colKey: 'last_run_at', title: '运行时间', width: 180 },
    { colKey: 'op', title: '详情', width: 80 },
];
onMounted(() => { loadStatus(); loadTasks(); });
async function loadStatus() {
    try {
        const data = await getCrawlerStatus();
        statusItems.value = [
            { label: '最近运行', value: data.last_run_at || '--' },
            { label: '当前状态', value: data.is_running ? '运行中' : data.last_status || '--' },
        ];
    }
    catch { /* skip */ }
}
async function loadTasks() {
    taskLoading.value = true;
    try {
        const data = await listCrawlerTasks();
        tasks.value = data;
    }
    finally {
        taskLoading.value = false;
    }
}
async function onTriggerAll() {
    triggerLoading.value = true;
    try {
        await triggerCrawler();
        MessagePlugin.success('任务已创建');
    }
    finally {
        triggerLoading.value = false;
    }
}
async function onTriggerPlatform(platform) {
    try {
        await triggerCrawler({ platform });
        MessagePlugin.success(`${platform} 任务已创建`);
    }
    catch { /* skip */ }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "page-title" },
});
const __VLS_0 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    gutter: (16),
    ...{ style: {} },
}));
const __VLS_2 = __VLS_1({
    gutter: (16),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
const __VLS_4 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    span: (6),
}));
const __VLS_6 = __VLS_5({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
const __VLS_8 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    title: "运行状态",
}));
const __VLS_10 = __VLS_9({
    title: "运行状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.TDescriptions;
/** @type {[typeof __VLS_components.TDescriptions, typeof __VLS_components.tDescriptions, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    items: (__VLS_ctx.statusItems),
}));
const __VLS_14 = __VLS_13({
    items: (__VLS_ctx.statusItems),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
var __VLS_11;
var __VLS_7;
const __VLS_16 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    span: (6),
}));
const __VLS_18 = __VLS_17({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
const __VLS_20 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    title: "手动操作",
}));
const __VLS_22 = __VLS_21({
    title: "手动操作",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
const __VLS_24 = {}.TSpace;
/** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    direction: "vertical",
}));
const __VLS_26 = __VLS_25({
    direction: "vertical",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    ...{ 'onClick': {} },
    theme: "primary",
    loading: (__VLS_ctx.triggerLoading),
}));
const __VLS_30 = __VLS_29({
    ...{ 'onClick': {} },
    theme: "primary",
    loading: (__VLS_ctx.triggerLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_32;
let __VLS_33;
let __VLS_34;
const __VLS_35 = {
    onClick: (__VLS_ctx.onTriggerAll)
};
__VLS_31.slots.default;
var __VLS_31;
const __VLS_36 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_38 = __VLS_37({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
let __VLS_40;
let __VLS_41;
let __VLS_42;
const __VLS_43 = {
    onClick: (...[$event]) => {
        __VLS_ctx.onTriggerPlatform('阿里拍卖');
    }
};
__VLS_39.slots.default;
var __VLS_39;
const __VLS_44 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_46 = __VLS_45({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_48;
let __VLS_49;
let __VLS_50;
const __VLS_51 = {
    onClick: (...[$event]) => {
        __VLS_ctx.onTriggerPlatform('京东拍卖');
    }
};
__VLS_47.slots.default;
var __VLS_47;
const __VLS_52 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_54 = __VLS_53({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_56;
let __VLS_57;
let __VLS_58;
const __VLS_59 = {
    onClick: (...[$event]) => {
        __VLS_ctx.onTriggerPlatform('公拍网');
    }
};
__VLS_55.slots.default;
var __VLS_55;
var __VLS_27;
var __VLS_23;
var __VLS_19;
var __VLS_3;
const __VLS_60 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    title: "任务记录",
}));
const __VLS_62 = __VLS_61({
    title: "任务记录",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
const __VLS_64 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    data: (__VLS_ctx.tasks),
    columns: (__VLS_ctx.taskColumns),
    loading: (__VLS_ctx.taskLoading),
    rowKey: "id",
}));
const __VLS_66 = __VLS_65({
    data: (__VLS_ctx.tasks),
    columns: (__VLS_ctx.taskColumns),
    loading: (__VLS_ctx.taskLoading),
    rowKey: "id",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
{
    const { status: __VLS_thisSlot } = __VLS_67.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_68 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        theme: (row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'running' ? 'primary' : 'default'),
    }));
    const __VLS_70 = __VLS_69({
        theme: (row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'running' ? 'primary' : 'default'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
    (row.status);
    var __VLS_71;
}
{
    const { op: __VLS_thisSlot } = __VLS_67.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    if (row.stats_summary) {
        const __VLS_72 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
        }));
        const __VLS_74 = __VLS_73({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_73));
        let __VLS_76;
        let __VLS_77;
        let __VLS_78;
        const __VLS_79 = {
            onClick: (...[$event]) => {
                if (!(row.stats_summary))
                    return;
                __VLS_ctx.showStats(row);
            }
        };
        __VLS_75.slots.default;
        var __VLS_75;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
    }
}
var __VLS_67;
var __VLS_63;
const __VLS_80 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    visible: (__VLS_ctx.statsVisible),
    header: "本轮爬取详情",
    width: "600px",
    footer: (false),
}));
const __VLS_82 = __VLS_81({
    visible: (__VLS_ctx.statsVisible),
    header: "本轮爬取详情",
    width: "600px",
    footer: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
if (__VLS_ctx.currentStats) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
        ...{ style: {} },
    });
    (JSON.stringify(__VLS_ctx.currentStats, null, 2));
}
var __VLS_83;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            triggerLoading: triggerLoading,
            taskLoading: taskLoading,
            tasks: tasks,
            statsVisible: statsVisible,
            currentStats: currentStats,
            showStats: showStats,
            statusItems: statusItems,
            taskColumns: taskColumns,
            onTriggerAll: onTriggerAll,
            onTriggerPlatform: onTriggerPlatform,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
