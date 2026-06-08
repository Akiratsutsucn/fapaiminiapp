/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getDashboardStats, getRuleList, createTask } from '@/api/dataAudit';
const router = useRouter();
const stats = ref({
    total_rules: 0,
    enabled_rules: 0,
    total_tasks: 0,
    open_violations: 0,
    latest_task: null,
    latest_quality_score: null
});
const createTaskVisible = ref(false);
const enabledRules = ref([]);
const taskForm = ref({
    task_name: '',
    task_type: 'manual',
    rule_ids: [],
    scope: {
        platforms: []
    }
});
const scopeType = ref('all');
// 最新任务描述项
const taskDescItems = computed(() => {
    if (!stats.value.latest_task)
        return [];
    return [
        { label: '任务名称', content: stats.value.latest_task.task_name },
        { label: '状态', content: getTaskStatusText(stats.value.latest_task.status) },
        { label: '质量评分', content: stats.value.latest_task.quality_score !== null ? stats.value.latest_task.quality_score.toFixed(1) : '-' },
        { label: '完成时间', content: stats.value.latest_task.completed_at || '-' }
    ];
});
// 加载统计数据
const loadStats = async () => {
    try {
        const res = await getDashboardStats();
        stats.value = res;
    }
    catch (error) {
        MessagePlugin.error('加载统计数据失败');
    }
};
// 加载启用的规则
const loadEnabledRules = async () => {
    try {
        const res = await getRuleList({ enabled: true });
        enabledRules.value = res;
    }
    catch (error) {
        MessagePlugin.error('加载规则列表失败');
    }
};
// 打开创建任务对话框
const handleCreateTask = () => {
    taskForm.value = {
        task_name: `手动审核_${new Date().toLocaleDateString()}`,
        task_type: 'manual',
        rule_ids: [],
        scope: {
            platforms: []
        }
    };
    scopeType.value = 'all';
    createTaskVisible.value = true;
    loadEnabledRules();
};
// 提交创建任务
const submitCreateTask = async () => {
    if (!taskForm.value.task_name) {
        MessagePlugin.warning('请输入任务名称');
        return;
    }
    if (taskForm.value.rule_ids.length === 0) {
        MessagePlugin.warning('请至少选择一个规则');
        return;
    }
    try {
        const data = {
            task_name: taskForm.value.task_name,
            task_type: taskForm.value.task_type,
            rule_ids: taskForm.value.rule_ids,
            scope: scopeType.value === 'all' ? null : taskForm.value.scope
        };
        await createTask(data);
        MessagePlugin.success('审核任务已创建，正在后台执行');
        createTaskVisible.value = false;
        setTimeout(loadStats, 1000);
    }
    catch (error) {
        MessagePlugin.error('创建任务失败');
    }
};
// 导航到子页面
const navigateTo = (page) => {
    router.push(`/data-audit/${page}`);
};
// 获取任务状态文本
const getTaskStatusText = (status) => {
    const map = {
        pending: '待执行',
        running: '执行中',
        completed: '已完成',
        failed: '失败'
    };
    return map[status] || status;
};
// 获取评分样式类
const getScoreClass = (score) => {
    if (score === null || score === undefined)
        return '';
    if (score >= 90)
        return 'text-success';
    if (score >= 70)
        return 'text-warning';
    return 'text-danger';
};
onMounted(() => {
    loadStats();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['function-card']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "data-audit-dashboard" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "page-title" },
});
const __VLS_0 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onClick: (__VLS_ctx.handleCreateTask)
};
__VLS_3.slots.default;
var __VLS_3;
const __VLS_8 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    gutter: (16),
    ...{ class: "stats-row" },
}));
const __VLS_10 = __VLS_9({
    gutter: (16),
    ...{ class: "stats-row" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    span: (3),
}));
const __VLS_14 = __VLS_13({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
const __VLS_16 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    hoverShadow: true,
}));
const __VLS_18 = __VLS_17({
    hoverShadow: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-item" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.stats.total_rules || 0);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-meta" },
});
(__VLS_ctx.stats.enabled_rules || 0);
var __VLS_19;
var __VLS_15;
const __VLS_20 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    span: (3),
}));
const __VLS_22 = __VLS_21({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
const __VLS_24 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    hoverShadow: true,
}));
const __VLS_26 = __VLS_25({
    hoverShadow: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-item" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.stats.total_tasks || 0);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
var __VLS_27;
var __VLS_23;
const __VLS_28 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    span: (3),
}));
const __VLS_30 = __VLS_29({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    hoverShadow: true,
}));
const __VLS_34 = __VLS_33({
    hoverShadow: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-item" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value" },
    ...{ class: (__VLS_ctx.getScoreClass(__VLS_ctx.stats.latest_quality_score)) },
});
(__VLS_ctx.stats.latest_quality_score !== null ? __VLS_ctx.stats.latest_quality_score.toFixed(1) : '-');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
var __VLS_35;
var __VLS_31;
const __VLS_36 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    span: (3),
}));
const __VLS_38 = __VLS_37({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
const __VLS_40 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    hoverShadow: true,
}));
const __VLS_42 = __VLS_41({
    hoverShadow: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-item" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value text-warning" },
});
(__VLS_ctx.stats.open_violations || 0);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
var __VLS_43;
var __VLS_39;
var __VLS_11;
if (__VLS_ctx.stats.latest_task) {
    const __VLS_44 = {}.TCard;
    /** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        title: "最新审核任务",
        ...{ style: {} },
    }));
    const __VLS_46 = __VLS_45({
        title: "最新审核任务",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    __VLS_47.slots.default;
    const __VLS_48 = {}.TDescriptions;
    /** @type {[typeof __VLS_components.TDescriptions, typeof __VLS_components.tDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        items: (__VLS_ctx.taskDescItems),
    }));
    const __VLS_50 = __VLS_49({
        items: (__VLS_ctx.taskDescItems),
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    const __VLS_52 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        ...{ 'onClick': {} },
        size: "small",
    }));
    const __VLS_54 = __VLS_53({
        ...{ 'onClick': {} },
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    let __VLS_56;
    let __VLS_57;
    let __VLS_58;
    const __VLS_59 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.stats.latest_task))
                return;
            __VLS_ctx.navigateTo('tasks');
        }
    };
    __VLS_55.slots.default;
    var __VLS_55;
    const __VLS_60 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ 'onClick': {} },
        size: "small",
        ...{ style: {} },
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onClick': {} },
        size: "small",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_64;
    let __VLS_65;
    let __VLS_66;
    const __VLS_67 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.stats.latest_task))
                return;
            __VLS_ctx.navigateTo('tasks');
        }
    };
    __VLS_63.slots.default;
    var __VLS_63;
    var __VLS_47;
}
const __VLS_68 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    gutter: (16),
    ...{ class: "function-cards" },
}));
const __VLS_70 = __VLS_69({
    gutter: (16),
    ...{ class: "function-cards" },
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
const __VLS_72 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    span: (4),
}));
const __VLS_74 = __VLS_73({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
const __VLS_76 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    ...{ 'onClick': {} },
    hoverShadow: true,
    ...{ class: "function-card" },
}));
const __VLS_78 = __VLS_77({
    ...{ 'onClick': {} },
    hoverShadow: true,
    ...{ class: "function-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
let __VLS_80;
let __VLS_81;
let __VLS_82;
const __VLS_83 = {
    onClick: (...[$event]) => {
        __VLS_ctx.navigateTo('rules');
    }
};
__VLS_79.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "function-content" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "function-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "function-desc" },
});
var __VLS_79;
var __VLS_75;
const __VLS_84 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    span: (4),
}));
const __VLS_86 = __VLS_85({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
const __VLS_88 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    ...{ 'onClick': {} },
    hoverShadow: true,
    ...{ class: "function-card" },
}));
const __VLS_90 = __VLS_89({
    ...{ 'onClick': {} },
    hoverShadow: true,
    ...{ class: "function-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
let __VLS_92;
let __VLS_93;
let __VLS_94;
const __VLS_95 = {
    onClick: (...[$event]) => {
        __VLS_ctx.navigateTo('tasks');
    }
};
__VLS_91.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "function-content" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "function-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "function-desc" },
});
var __VLS_91;
var __VLS_87;
const __VLS_96 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    span: (4),
}));
const __VLS_98 = __VLS_97({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
__VLS_99.slots.default;
const __VLS_100 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    ...{ 'onClick': {} },
    hoverShadow: true,
    ...{ class: "function-card" },
}));
const __VLS_102 = __VLS_101({
    ...{ 'onClick': {} },
    hoverShadow: true,
    ...{ class: "function-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
let __VLS_104;
let __VLS_105;
let __VLS_106;
const __VLS_107 = {
    onClick: (...[$event]) => {
        __VLS_ctx.navigateTo('violations');
    }
};
__VLS_103.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "function-content" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "function-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "function-desc" },
});
var __VLS_103;
var __VLS_99;
var __VLS_71;
const __VLS_108 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.createTaskVisible),
    header: "创建审核任务",
    width: "600px",
}));
const __VLS_110 = __VLS_109({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.createTaskVisible),
    header: "创建审核任务",
    width: "600px",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
let __VLS_112;
let __VLS_113;
let __VLS_114;
const __VLS_115 = {
    onConfirm: (__VLS_ctx.submitCreateTask)
};
__VLS_111.slots.default;
const __VLS_116 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    data: (__VLS_ctx.taskForm),
    labelWidth: "100px",
}));
const __VLS_118 = __VLS_117({
    data: (__VLS_ctx.taskForm),
    labelWidth: "100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
__VLS_119.slots.default;
const __VLS_120 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    label: "任务名称",
}));
const __VLS_122 = __VLS_121({
    label: "任务名称",
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
const __VLS_124 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    modelValue: (__VLS_ctx.taskForm.task_name),
    placeholder: "请输入任务名称",
}));
const __VLS_126 = __VLS_125({
    modelValue: (__VLS_ctx.taskForm.task_name),
    placeholder: "请输入任务名称",
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
var __VLS_123;
const __VLS_128 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    label: "选择规则",
}));
const __VLS_130 = __VLS_129({
    label: "选择规则",
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
const __VLS_132 = {}.TCheckboxGroup;
/** @type {[typeof __VLS_components.TCheckboxGroup, typeof __VLS_components.tCheckboxGroup, typeof __VLS_components.TCheckboxGroup, typeof __VLS_components.tCheckboxGroup, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    modelValue: (__VLS_ctx.taskForm.rule_ids),
}));
const __VLS_134 = __VLS_133({
    modelValue: (__VLS_ctx.taskForm.rule_ids),
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
for (const [rule] of __VLS_getVForSourceType((__VLS_ctx.enabledRules))) {
    const __VLS_136 = {}.TCheckbox;
    /** @type {[typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        key: (rule.id),
        value: (rule.id),
    }));
    const __VLS_138 = __VLS_137({
        key: (rule.id),
        value: (rule.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    __VLS_139.slots.default;
    (rule.rule_name);
    var __VLS_139;
}
var __VLS_135;
var __VLS_131;
const __VLS_140 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    label: "审核范围",
}));
const __VLS_142 = __VLS_141({
    label: "审核范围",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
__VLS_143.slots.default;
const __VLS_144 = {}.TRadioGroup;
/** @type {[typeof __VLS_components.TRadioGroup, typeof __VLS_components.tRadioGroup, typeof __VLS_components.TRadioGroup, typeof __VLS_components.tRadioGroup, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    modelValue: (__VLS_ctx.scopeType),
}));
const __VLS_146 = __VLS_145({
    modelValue: (__VLS_ctx.scopeType),
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
__VLS_147.slots.default;
const __VLS_148 = {}.TRadio;
/** @type {[typeof __VLS_components.TRadio, typeof __VLS_components.tRadio, typeof __VLS_components.TRadio, typeof __VLS_components.tRadio, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    value: "all",
}));
const __VLS_150 = __VLS_149({
    value: "all",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
__VLS_151.slots.default;
var __VLS_151;
const __VLS_152 = {}.TRadio;
/** @type {[typeof __VLS_components.TRadio, typeof __VLS_components.tRadio, typeof __VLS_components.TRadio, typeof __VLS_components.tRadio, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    value: "custom",
}));
const __VLS_154 = __VLS_153({
    value: "custom",
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
__VLS_155.slots.default;
var __VLS_155;
var __VLS_147;
var __VLS_143;
if (__VLS_ctx.scopeType === 'custom') {
    const __VLS_156 = {}.TFormItem;
    /** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
        label: "平台",
    }));
    const __VLS_158 = __VLS_157({
        label: "平台",
    }, ...__VLS_functionalComponentArgsRest(__VLS_157));
    __VLS_159.slots.default;
    const __VLS_160 = {}.TCheckboxGroup;
    /** @type {[typeof __VLS_components.TCheckboxGroup, typeof __VLS_components.tCheckboxGroup, typeof __VLS_components.TCheckboxGroup, typeof __VLS_components.tCheckboxGroup, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        modelValue: (__VLS_ctx.taskForm.scope.platforms),
    }));
    const __VLS_162 = __VLS_161({
        modelValue: (__VLS_ctx.taskForm.scope.platforms),
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    __VLS_163.slots.default;
    const __VLS_164 = {}.TCheckbox;
    /** @type {[typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
        value: "阿里拍卖",
    }));
    const __VLS_166 = __VLS_165({
        value: "阿里拍卖",
    }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    __VLS_167.slots.default;
    var __VLS_167;
    const __VLS_168 = {}.TCheckbox;
    /** @type {[typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
        value: "京东拍卖",
    }));
    const __VLS_170 = __VLS_169({
        value: "京东拍卖",
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    __VLS_171.slots.default;
    var __VLS_171;
    const __VLS_172 = {}.TCheckbox;
    /** @type {[typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
        value: "公拍网",
    }));
    const __VLS_174 = __VLS_173({
        value: "公拍网",
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
    __VLS_175.slots.default;
    var __VLS_175;
    var __VLS_163;
    var __VLS_159;
}
var __VLS_119;
var __VLS_111;
/** @type {__VLS_StyleScopedClasses['data-audit-dashboard']} */ ;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-row']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['function-cards']} */ ;
/** @type {__VLS_StyleScopedClasses['function-card']} */ ;
/** @type {__VLS_StyleScopedClasses['function-content']} */ ;
/** @type {__VLS_StyleScopedClasses['function-title']} */ ;
/** @type {__VLS_StyleScopedClasses['function-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['function-card']} */ ;
/** @type {__VLS_StyleScopedClasses['function-content']} */ ;
/** @type {__VLS_StyleScopedClasses['function-title']} */ ;
/** @type {__VLS_StyleScopedClasses['function-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['function-card']} */ ;
/** @type {__VLS_StyleScopedClasses['function-content']} */ ;
/** @type {__VLS_StyleScopedClasses['function-title']} */ ;
/** @type {__VLS_StyleScopedClasses['function-desc']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            stats: stats,
            createTaskVisible: createTaskVisible,
            enabledRules: enabledRules,
            taskForm: taskForm,
            scopeType: scopeType,
            taskDescItems: taskDescItems,
            handleCreateTask: handleCreateTask,
            submitCreateTask: submitCreateTask,
            navigateTo: navigateTo,
            getScoreClass: getScoreClass,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
