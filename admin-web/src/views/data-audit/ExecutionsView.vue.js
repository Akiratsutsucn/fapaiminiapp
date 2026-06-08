/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, onMounted, computed } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { listAuditExecutions, getAuditExecutionDetail, getAuditStats } from '@/api/dataAudit';
const executions = ref([]);
const dayFilter = ref(7);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const detailVisible = ref(false);
const detailLoading = ref(false);
const currentDetail = ref(null);
const statsData = ref({ recent_7_days: [], recent_30_days: [] });
const stats7Days = computed(() => {
    const data = statsData.value.recent_7_days || [];
    return {
        execution_count: data.length,
        total_violations: data.reduce((sum, item) => sum + item.total_violations, 0),
        cleaned_count: data.reduce((sum, item) => sum + item.cleaned_count, 0),
        fixed_count: data.reduce((sum, item) => sum + item.fixed_count, 0),
    };
});
const ruleColumns = [
    { colKey: 'rule_name', title: '规则名称', width: 200 },
    { colKey: 'rule_description', title: '规则说明', width: 300 },
    { colKey: 'violation_count', title: '违规数', width: 100 },
    { colKey: 'cleaned_count', title: '清理数', width: 100 },
    { colKey: 'fixed_count', title: '修复数', width: 100 },
];
onMounted(() => {
    loadExecutions();
    loadStats();
});
async function loadExecutions() {
    try {
        const params = {
            page: pagination.current,
            page_size: pagination.pageSize,
            days: dayFilter.value,
        };
        const data = await listAuditExecutions(params);
        executions.value = data.items;
        pagination.total = data.total;
    }
    catch (err) {
        MessagePlugin.error('加载审核记录失败');
    }
}
async function loadStats() {
    try {
        const data = await getAuditStats();
        statsData.value = data;
    }
    catch (err) {
        console.error('加载统计数据失败:', err);
    }
}
async function onViewDetail(id) {
    detailVisible.value = true;
    detailLoading.value = true;
    currentDetail.value = null;
    try {
        const data = await getAuditExecutionDetail(id);
        currentDetail.value = data;
    }
    catch (err) {
        MessagePlugin.error('加载详情失败');
    }
    finally {
        detailLoading.value = false;
    }
}
function onPageChange(pageInfo) {
    pagination.current = pageInfo.current;
    loadExecutions();
}
function formatDateTime(isoTime) {
    if (!isoTime)
        return '--';
    const date = new Date(isoTime);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
function getActionTheme(action) {
    const themeMap = {
        delete: 'danger',
        fix: 'success',
        flag: 'warning'
    };
    return themeMap[action] || 'default';
}
function getActionLabel(action) {
    const labelMap = {
        delete: '删除',
        fix: '修复',
        flag: '标记'
    };
    return labelMap[action] || action;
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['timeline-item']} */ ;
/** @type {__VLS_StyleScopedClasses['timeline-item']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-number']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-number']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-number']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
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
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({}));
const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.stats7Days.execution_count);
var __VLS_11;
var __VLS_7;
const __VLS_12 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    span: (6),
}));
const __VLS_14 = __VLS_13({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
const __VLS_16 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.stats7Days.total_violations);
var __VLS_19;
var __VLS_15;
const __VLS_20 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    span: (6),
}));
const __VLS_22 = __VLS_21({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
const __VLS_24 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({}));
const __VLS_26 = __VLS_25({}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.stats7Days.cleaned_count);
var __VLS_27;
var __VLS_23;
const __VLS_28 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    span: (6),
}));
const __VLS_30 = __VLS_29({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.stats7Days.fixed_count);
var __VLS_35;
var __VLS_31;
var __VLS_3;
const __VLS_36 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    title: "执行记录",
}));
const __VLS_38 = __VLS_37({
    title: "执行记录",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "filter-bar" },
});
const __VLS_40 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.dayFilter),
    ...{ style: {} },
}));
const __VLS_42 = __VLS_41({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.dayFilter),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
let __VLS_44;
let __VLS_45;
let __VLS_46;
const __VLS_47 = {
    onChange: (__VLS_ctx.loadExecutions)
};
__VLS_43.slots.default;
const __VLS_48 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    value: (7),
    label: "最近7天",
}));
const __VLS_50 = __VLS_49({
    value: (7),
    label: "最近7天",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
const __VLS_52 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    value: (30),
    label: "最近30天",
}));
const __VLS_54 = __VLS_53({
    value: (30),
    label: "最近30天",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
const __VLS_56 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    value: (90),
    label: "最近90天",
}));
const __VLS_58 = __VLS_57({
    value: (90),
    label: "最近90天",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
var __VLS_43;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "timeline-container" },
});
if (__VLS_ctx.executions.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty-state" },
    });
    const __VLS_60 = {}.TIcon;
    /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        name: "inbox",
        ...{ style: {} },
    }));
    const __VLS_62 = __VLS_61({
        name: "inbox",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
}
for (const [execution] of __VLS_getVForSourceType((__VLS_ctx.executions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (execution.id),
        ...{ class: "timeline-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "timeline-dot" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "timeline-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "execution-time" },
    });
    (__VLS_ctx.formatDateTime(execution.execution_time));
    const __VLS_64 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        theme: (execution.status === 'completed' ? 'success' : 'danger'),
        size: "small",
    }));
    const __VLS_66 = __VLS_65({
        theme: (execution.status === 'completed' ? 'success' : 'danger'),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    __VLS_67.slots.default;
    (execution.status);
    var __VLS_67;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-summary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "summary-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "summary-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "summary-value" },
    });
    (execution.total_rules);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "summary-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "summary-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "summary-value warning" },
    });
    (execution.total_violations);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "summary-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "summary-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "summary-value success" },
    });
    (execution.cleaned_count);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "summary-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "summary-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "summary-value primary" },
    });
    (execution.fixed_count);
    const __VLS_68 = {}.TSpace;
    /** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        ...{ style: {} },
    }));
    const __VLS_70 = __VLS_69({
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
    const __VLS_72 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        ...{ 'onClick': {} },
        size: "small",
        variant: "outline",
    }));
    const __VLS_74 = __VLS_73({
        ...{ 'onClick': {} },
        size: "small",
        variant: "outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    let __VLS_76;
    let __VLS_77;
    let __VLS_78;
    const __VLS_79 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onViewDetail(execution.id);
        }
    };
    __VLS_75.slots.default;
    {
        const { icon: __VLS_thisSlot } = __VLS_75.slots;
        const __VLS_80 = {}.TIcon;
        /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
            name: "view-list",
        }));
        const __VLS_82 = __VLS_81({
            name: "view-list",
        }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    }
    var __VLS_75;
    var __VLS_71;
}
if (__VLS_ctx.pagination.total > __VLS_ctx.pagination.pageSize) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    const __VLS_84 = {}.TPagination;
    /** @type {[typeof __VLS_components.TPagination, typeof __VLS_components.tPagination, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        ...{ 'onChange': {} },
        total: (__VLS_ctx.pagination.total),
        current: (__VLS_ctx.pagination.current),
        pageSize: (__VLS_ctx.pagination.pageSize),
    }));
    const __VLS_86 = __VLS_85({
        ...{ 'onChange': {} },
        total: (__VLS_ctx.pagination.total),
        current: (__VLS_ctx.pagination.current),
        pageSize: (__VLS_ctx.pagination.pageSize),
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    let __VLS_88;
    let __VLS_89;
    let __VLS_90;
    const __VLS_91 = {
        onChange: (__VLS_ctx.onPageChange)
    };
    var __VLS_87;
}
var __VLS_39;
const __VLS_92 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    visible: (__VLS_ctx.detailVisible),
    header: "审核详情",
    width: "900px",
    footer: (false),
}));
const __VLS_94 = __VLS_93({
    visible: (__VLS_ctx.detailVisible),
    header: "审核详情",
    width: "900px",
    footer: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
if (__VLS_ctx.detailLoading) {
    const __VLS_96 = {}.TLoading;
    /** @type {[typeof __VLS_components.TLoading, typeof __VLS_components.tLoading, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        size: "large",
    }));
    const __VLS_98 = __VLS_97({
        size: "large",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
}
else if (__VLS_ctx.currentDetail) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-summary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.formatDateTime(__VLS_ctx.currentDetail.execution_time));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-value" },
    });
    const __VLS_100 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        theme: (__VLS_ctx.currentDetail.status === 'completed' ? 'success' : 'danger'),
    }));
    const __VLS_102 = __VLS_101({
        theme: (__VLS_ctx.currentDetail.status === 'completed' ? 'success' : 'danger'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    __VLS_103.slots.default;
    (__VLS_ctx.currentDetail.status);
    var __VLS_103;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.currentDetail.properties_checked);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.currentDetail.execution_duration);
    const __VLS_104 = {}.TDivider;
    /** @type {[typeof __VLS_components.TDivider, typeof __VLS_components.tDivider, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({}));
    const __VLS_106 = __VLS_105({}, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "rules-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "section-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "rules-list" },
    });
    for (const [rule] of __VLS_getVForSourceType((__VLS_ctx.currentDetail.rules_applied))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (rule.rule_id),
            ...{ class: "rule-item" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "rule-info" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "rule-name" },
        });
        (rule.rule_name);
        const __VLS_108 = {}.TTag;
        /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
        // @ts-ignore
        const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
            size: "small",
            theme: (__VLS_ctx.getActionTheme(rule.action)),
        }));
        const __VLS_110 = __VLS_109({
            size: "small",
            theme: (__VLS_ctx.getActionTheme(rule.action)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_109));
        __VLS_111.slots.default;
        (__VLS_ctx.getActionLabel(rule.action));
        var __VLS_111;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "rule-code" },
        });
        (rule.rule_code);
    }
    const __VLS_112 = {}.TDivider;
    /** @type {[typeof __VLS_components.TDivider, typeof __VLS_components.tDivider, ]} */ ;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({}));
    const __VLS_114 = __VLS_113({}, ...__VLS_functionalComponentArgsRest(__VLS_113));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "actions-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "section-title" },
    });
    if (__VLS_ctx.currentDetail.detailed_actions && __VLS_ctx.currentDetail.detailed_actions.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "actions-list" },
        });
        for (const [action, index] of __VLS_getVForSourceType((__VLS_ctx.currentDetail.detailed_actions))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (index),
                ...{ class: "action-item" },
            });
            const __VLS_116 = {}.TIcon;
            /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
            // @ts-ignore
            const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
                name: "check-circle",
                ...{ class: "action-icon" },
            }));
            const __VLS_118 = __VLS_117({
                name: "check-circle",
                ...{ class: "action-icon" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_117));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "action-text" },
            });
            (action);
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-actions" },
        });
        const __VLS_120 = {}.TIcon;
        /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
        // @ts-ignore
        const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
            name: "info-circle",
            ...{ style: {} },
        }));
        const __VLS_122 = __VLS_121({
            name: "info-circle",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_121));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
    }
    const __VLS_124 = {}.TDivider;
    /** @type {[typeof __VLS_components.TDivider, typeof __VLS_components.tDivider, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({}));
    const __VLS_126 = __VLS_125({}, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stats-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "section-title" },
    });
    const __VLS_128 = {}.TRow;
    /** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        gutter: (16),
    }));
    const __VLS_130 = __VLS_129({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    __VLS_131.slots.default;
    const __VLS_132 = {}.TCol;
    /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        span: (4),
    }));
    const __VLS_134 = __VLS_133({
        span: (4),
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-number deleted" },
    });
    (__VLS_ctx.currentDetail.properties_deleted);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-label" },
    });
    var __VLS_135;
    const __VLS_136 = {}.TCol;
    /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        span: (4),
    }));
    const __VLS_138 = __VLS_137({
        span: (4),
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    __VLS_139.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-number fixed" },
    });
    (__VLS_ctx.currentDetail.properties_fixed);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-label" },
    });
    var __VLS_139;
    const __VLS_140 = {}.TCol;
    /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        span: (4),
    }));
    const __VLS_142 = __VLS_141({
        span: (4),
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    __VLS_143.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-number flagged" },
    });
    (__VLS_ctx.currentDetail.action_statistics?.flagged_count || 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-label" },
    });
    var __VLS_143;
    var __VLS_131;
    if (__VLS_ctx.currentDetail.violations_found && Object.keys(__VLS_ctx.currentDetail.violations_found).length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "violations-section" },
        });
        const __VLS_144 = {}.TDivider;
        /** @type {[typeof __VLS_components.TDivider, typeof __VLS_components.tDivider, ]} */ ;
        // @ts-ignore
        const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({}));
        const __VLS_146 = __VLS_145({}, ...__VLS_functionalComponentArgsRest(__VLS_145));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
            ...{ class: "section-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "violations-list" },
        });
        for (const [count, ruleName] of __VLS_getVForSourceType((__VLS_ctx.currentDetail.violations_found))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (ruleName),
                ...{ class: "violation-item" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "violation-rule" },
            });
            (ruleName);
            const __VLS_148 = {}.TTag;
            /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
            // @ts-ignore
            const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
                theme: "warning",
                size: "small",
            }));
            const __VLS_150 = __VLS_149({
                theme: "warning",
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_149));
            __VLS_151.slots.default;
            (count);
            var __VLS_151;
        }
    }
}
var __VLS_95;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['timeline-container']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['timeline-item']} */ ;
/** @type {__VLS_StyleScopedClasses['timeline-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['timeline-card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['execution-time']} */ ;
/** @type {__VLS_StyleScopedClasses['card-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['warning']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['success']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['rules-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['rules-list']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-item']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-info']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-name']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-code']} */ ;
/** @type {__VLS_StyleScopedClasses['actions-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['actions-list']} */ ;
/** @type {__VLS_StyleScopedClasses['action-item']} */ ;
/** @type {__VLS_StyleScopedClasses['action-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['action-text']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-box']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-number']} */ ;
/** @type {__VLS_StyleScopedClasses['deleted']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-box']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-number']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-box']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-number']} */ ;
/** @type {__VLS_StyleScopedClasses['flagged']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['violations-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['violations-list']} */ ;
/** @type {__VLS_StyleScopedClasses['violation-item']} */ ;
/** @type {__VLS_StyleScopedClasses['violation-rule']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            executions: executions,
            dayFilter: dayFilter,
            pagination: pagination,
            detailVisible: detailVisible,
            detailLoading: detailLoading,
            currentDetail: currentDetail,
            stats7Days: stats7Days,
            loadExecutions: loadExecutions,
            onViewDetail: onViewDetail,
            onPageChange: onPageChange,
            formatDateTime: formatDateTime,
            getActionTheme: getActionTheme,
            getActionLabel: getActionLabel,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
