/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getViolationList, updateViolation } from '@/api/dataAudit';
const router = useRouter();
const loading = ref(false);
const violations = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);
const filterTaskId = ref('');
const filterStatus = ref('');
const filterSeverity = ref('');
const detailDialogVisible = ref(false);
const violationDetail = ref({});
const resolveDialogVisible = ref(false);
const currentViolationId = ref(null);
const resolveForm = ref({
    status: 'resolved',
    fix_note: ''
});
const submitting = ref(false);
// 加载违规记录列表
const loadViolations = async () => {
    loading.value = true;
    try {
        const params = {
            limit: pageSize.value,
            offset: (currentPage.value - 1) * pageSize.value
        };
        if (filterTaskId.value)
            params.task_id = parseInt(filterTaskId.value);
        if (filterStatus.value)
            params.status = filterStatus.value;
        if (filterSeverity.value)
            params.severity = filterSeverity.value;
        const res = await getViolationList(params);
        violations.value = res.items;
        total.value = res.total;
    }
    catch (error) {
        ElMessage.error('加载违规记录失败');
    }
    finally {
        loading.value = false;
    }
};
// 查看详情
const handleView = (row) => {
    violationDetail.value = row;
    detailDialogVisible.value = true;
};
// 打开标记解决对话框
const handleResolve = (row) => {
    currentViolationId.value = row.id;
    resolveForm.value = {
        status: 'resolved',
        fix_note: ''
    };
    resolveDialogVisible.value = true;
};
// 提交标记解决
const submitResolve = async () => {
    submitting.value = true;
    try {
        await updateViolation(currentViolationId.value, resolveForm.value);
        ElMessage.success('更新成功');
        resolveDialogVisible.value = false;
        detailDialogVisible.value = false;
        loadViolations();
    }
    catch (error) {
        ElMessage.error('更新失败');
    }
    finally {
        submitting.value = false;
    }
};
// 查看房源
const viewProperty = (propertyId) => {
    router.push(`/property/${propertyId}`);
};
// 获取违规详情消息
const getViolationMessage = (detail) => {
    if (!detail)
        return '-';
    return detail.message || JSON.stringify(detail);
};
// 辅助函数
const getSeverityType = (severity) => {
    const map = {
        info: 'info',
        warning: 'warning',
        error: 'danger',
        critical: 'danger'
    };
    return map[severity] || 'info';
};
const getSeverityText = (severity) => {
    const map = {
        info: '信息',
        warning: '警告',
        error: '错误',
        critical: '严重'
    };
    return map[severity] || severity;
};
const getActionType = (action) => {
    const map = {
        flagged: 'warning',
        deleted: 'danger',
        fixed: 'success',
        ignored: 'info'
    };
    return map[action] || 'info';
};
const getActionText = (action) => {
    const map = {
        flagged: '已标记',
        deleted: '已删除',
        fixed: '已修复',
        ignored: '已忽略'
    };
    return map[action] || action;
};
const getStatusType = (status) => {
    const map = {
        open: 'warning',
        resolved: 'success',
        ignored: 'info'
    };
    return map[status] || 'info';
};
const getStatusText = (status) => {
    const map = {
        open: '待处理',
        resolved: '已解决',
        ignored: '已忽略'
    };
    return map[status] || status;
};
onMounted(() => {
    loadViolations();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "audit-violations" },
});
const __VLS_0 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_3.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "filter-bar" },
});
const __VLS_4 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    modelValue: (__VLS_ctx.filterTaskId),
    placeholder: "任务ID",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_6 = __VLS_5({
    modelValue: (__VLS_ctx.filterTaskId),
    placeholder: "任务ID",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
const __VLS_8 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    modelValue: (__VLS_ctx.filterStatus),
    placeholder: "处理状态",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_10 = __VLS_9({
    modelValue: (__VLS_ctx.filterStatus),
    placeholder: "处理状态",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    label: "待处理",
    value: "open",
}));
const __VLS_14 = __VLS_13({
    label: "待处理",
    value: "open",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
const __VLS_16 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    label: "已解决",
    value: "resolved",
}));
const __VLS_18 = __VLS_17({
    label: "已解决",
    value: "resolved",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const __VLS_20 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    label: "已忽略",
    value: "ignored",
}));
const __VLS_22 = __VLS_21({
    label: "已忽略",
    value: "ignored",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
var __VLS_11;
const __VLS_24 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    modelValue: (__VLS_ctx.filterSeverity),
    placeholder: "严重级别",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_26 = __VLS_25({
    modelValue: (__VLS_ctx.filterSeverity),
    placeholder: "严重级别",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    label: "信息",
    value: "info",
}));
const __VLS_30 = __VLS_29({
    label: "信息",
    value: "info",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
const __VLS_32 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    label: "警告",
    value: "warning",
}));
const __VLS_34 = __VLS_33({
    label: "警告",
    value: "warning",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
const __VLS_36 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    label: "错误",
    value: "error",
}));
const __VLS_38 = __VLS_37({
    label: "错误",
    value: "error",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
const __VLS_40 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    label: "严重",
    value: "critical",
}));
const __VLS_42 = __VLS_41({
    label: "严重",
    value: "critical",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
var __VLS_27;
const __VLS_44 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onClick': {} },
    type: "primary",
    ...{ style: {} },
}));
const __VLS_46 = __VLS_45({
    ...{ 'onClick': {} },
    type: "primary",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_48;
let __VLS_49;
let __VLS_50;
const __VLS_51 = {
    onClick: (__VLS_ctx.loadViolations)
};
__VLS_47.slots.default;
var __VLS_47;
const __VLS_52 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    data: (__VLS_ctx.violations),
    ...{ style: {} },
}));
const __VLS_54 = __VLS_53({
    data: (__VLS_ctx.violations),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
__VLS_55.slots.default;
const __VLS_56 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    prop: "id",
    label: "记录ID",
    width: "80",
}));
const __VLS_58 = __VLS_57({
    prop: "id",
    label: "记录ID",
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
const __VLS_60 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    prop: "task_id",
    label: "任务ID",
    width: "80",
}));
const __VLS_62 = __VLS_61({
    prop: "task_id",
    label: "任务ID",
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
const __VLS_64 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    prop: "property_id",
    label: "房源ID",
    width: "80",
}));
const __VLS_66 = __VLS_65({
    prop: "property_id",
    label: "房源ID",
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_67.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_68 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        ...{ 'onClick': {} },
        type: "primary",
        link: true,
        size: "small",
    }));
    const __VLS_70 = __VLS_69({
        ...{ 'onClick': {} },
        type: "primary",
        link: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_72;
    let __VLS_73;
    let __VLS_74;
    const __VLS_75 = {
        onClick: (...[$event]) => {
            __VLS_ctx.viewProperty(row.property_id);
        }
    };
    __VLS_71.slots.default;
    (row.property_id);
    var __VLS_71;
}
var __VLS_67;
const __VLS_76 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    prop: "rule_name",
    label: "违规规则",
    minWidth: "150",
}));
const __VLS_78 = __VLS_77({
    prop: "rule_name",
    label: "违规规则",
    minWidth: "150",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
const __VLS_80 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    prop: "severity",
    label: "严重级别",
    width: "100",
}));
const __VLS_82 = __VLS_81({
    prop: "severity",
    label: "严重级别",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_83.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_84 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        type: (__VLS_ctx.getSeverityType(row.severity)),
        size: "small",
    }));
    const __VLS_86 = __VLS_85({
        type: (__VLS_ctx.getSeverityType(row.severity)),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    (__VLS_ctx.getSeverityText(row.severity));
    var __VLS_87;
}
var __VLS_83;
const __VLS_88 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    label: "违规详情",
    minWidth: "250",
}));
const __VLS_90 = __VLS_89({
    label: "违规详情",
    minWidth: "250",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_91.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_91.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    (__VLS_ctx.getViolationMessage(row.violation_detail));
}
var __VLS_91;
const __VLS_92 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    prop: "action_taken",
    label: "执行动作",
    width: "100",
}));
const __VLS_94 = __VLS_93({
    prop: "action_taken",
    label: "执行动作",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_95.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_96 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        type: (__VLS_ctx.getActionType(row.action_taken)),
        size: "small",
    }));
    const __VLS_98 = __VLS_97({
        type: (__VLS_ctx.getActionType(row.action_taken)),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    (__VLS_ctx.getActionText(row.action_taken));
    var __VLS_99;
}
var __VLS_95;
const __VLS_100 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    prop: "status",
    label: "处理状态",
    width: "100",
}));
const __VLS_102 = __VLS_101({
    prop: "status",
    label: "处理状态",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
__VLS_103.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_103.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_104 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        type: (__VLS_ctx.getStatusType(row.status)),
        size: "small",
    }));
    const __VLS_106 = __VLS_105({
        type: (__VLS_ctx.getStatusType(row.status)),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_107.slots.default;
    (__VLS_ctx.getStatusText(row.status));
    var __VLS_107;
}
var __VLS_103;
const __VLS_108 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    prop: "created_at",
    label: "创建时间",
    width: "160",
}));
const __VLS_110 = __VLS_109({
    prop: "created_at",
    label: "创建时间",
    width: "160",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
const __VLS_112 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    label: "操作",
    width: "180",
    fixed: "right",
}));
const __VLS_114 = __VLS_113({
    label: "操作",
    width: "180",
    fixed: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_115.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_116 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        ...{ 'onClick': {} },
        type: "primary",
        link: true,
        size: "small",
    }));
    const __VLS_118 = __VLS_117({
        ...{ 'onClick': {} },
        type: "primary",
        link: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    let __VLS_120;
    let __VLS_121;
    let __VLS_122;
    const __VLS_123 = {
        onClick: (...[$event]) => {
            __VLS_ctx.handleView(row);
        }
    };
    __VLS_119.slots.default;
    var __VLS_119;
    const __VLS_124 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        ...{ 'onClick': {} },
        type: "success",
        link: true,
        size: "small",
        disabled: (row.status !== 'open'),
    }));
    const __VLS_126 = __VLS_125({
        ...{ 'onClick': {} },
        type: "success",
        link: true,
        size: "small",
        disabled: (row.status !== 'open'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    let __VLS_128;
    let __VLS_129;
    let __VLS_130;
    const __VLS_131 = {
        onClick: (...[$event]) => {
            __VLS_ctx.handleResolve(row);
        }
    };
    __VLS_127.slots.default;
    var __VLS_127;
}
var __VLS_115;
var __VLS_55;
const __VLS_132 = {}.ElPagination;
/** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    ...{ 'onSizeChange': {} },
    ...{ 'onCurrentChange': {} },
    currentPage: (__VLS_ctx.currentPage),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
    pageSizes: ([20, 50, 100]),
    layout: "total, sizes, prev, pager, next, jumper",
    ...{ style: {} },
}));
const __VLS_134 = __VLS_133({
    ...{ 'onSizeChange': {} },
    ...{ 'onCurrentChange': {} },
    currentPage: (__VLS_ctx.currentPage),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
    pageSizes: ([20, 50, 100]),
    layout: "total, sizes, prev, pager, next, jumper",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
let __VLS_136;
let __VLS_137;
let __VLS_138;
const __VLS_139 = {
    onSizeChange: (__VLS_ctx.loadViolations)
};
const __VLS_140 = {
    onCurrentChange: (__VLS_ctx.loadViolations)
};
var __VLS_135;
var __VLS_3;
const __VLS_141 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_142 = __VLS_asFunctionalComponent(__VLS_141, new __VLS_141({
    modelValue: (__VLS_ctx.detailDialogVisible),
    title: "违规记录详情",
    width: "700px",
}));
const __VLS_143 = __VLS_142({
    modelValue: (__VLS_ctx.detailDialogVisible),
    title: "违规记录详情",
    width: "700px",
}, ...__VLS_functionalComponentArgsRest(__VLS_142));
__VLS_144.slots.default;
const __VLS_145 = {}.ElDescriptions;
/** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
// @ts-ignore
const __VLS_146 = __VLS_asFunctionalComponent(__VLS_145, new __VLS_145({
    column: (2),
    border: true,
}));
const __VLS_147 = __VLS_146({
    column: (2),
    border: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_146));
__VLS_148.slots.default;
const __VLS_149 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_150 = __VLS_asFunctionalComponent(__VLS_149, new __VLS_149({
    label: "记录ID",
}));
const __VLS_151 = __VLS_150({
    label: "记录ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_150));
__VLS_152.slots.default;
(__VLS_ctx.violationDetail.id);
var __VLS_152;
const __VLS_153 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_154 = __VLS_asFunctionalComponent(__VLS_153, new __VLS_153({
    label: "任务ID",
}));
const __VLS_155 = __VLS_154({
    label: "任务ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_154));
__VLS_156.slots.default;
(__VLS_ctx.violationDetail.task_id);
var __VLS_156;
const __VLS_157 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({
    label: "房源ID",
}));
const __VLS_159 = __VLS_158({
    label: "房源ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_158));
__VLS_160.slots.default;
const __VLS_161 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_162 = __VLS_asFunctionalComponent(__VLS_161, new __VLS_161({
    ...{ 'onClick': {} },
    type: "primary",
    link: true,
    size: "small",
}));
const __VLS_163 = __VLS_162({
    ...{ 'onClick': {} },
    type: "primary",
    link: true,
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_162));
let __VLS_165;
let __VLS_166;
let __VLS_167;
const __VLS_168 = {
    onClick: (...[$event]) => {
        __VLS_ctx.viewProperty(__VLS_ctx.violationDetail.property_id);
    }
};
__VLS_164.slots.default;
(__VLS_ctx.violationDetail.property_id);
var __VLS_164;
var __VLS_160;
const __VLS_169 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_170 = __VLS_asFunctionalComponent(__VLS_169, new __VLS_169({
    label: "规则ID",
}));
const __VLS_171 = __VLS_170({
    label: "规则ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_170));
__VLS_172.slots.default;
(__VLS_ctx.violationDetail.rule_id);
var __VLS_172;
const __VLS_173 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_174 = __VLS_asFunctionalComponent(__VLS_173, new __VLS_173({
    label: "规则代码",
}));
const __VLS_175 = __VLS_174({
    label: "规则代码",
}, ...__VLS_functionalComponentArgsRest(__VLS_174));
__VLS_176.slots.default;
(__VLS_ctx.violationDetail.rule_code);
var __VLS_176;
const __VLS_177 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_178 = __VLS_asFunctionalComponent(__VLS_177, new __VLS_177({
    label: "规则名称",
}));
const __VLS_179 = __VLS_178({
    label: "规则名称",
}, ...__VLS_functionalComponentArgsRest(__VLS_178));
__VLS_180.slots.default;
(__VLS_ctx.violationDetail.rule_name);
var __VLS_180;
const __VLS_181 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_182 = __VLS_asFunctionalComponent(__VLS_181, new __VLS_181({
    label: "严重级别",
}));
const __VLS_183 = __VLS_182({
    label: "严重级别",
}, ...__VLS_functionalComponentArgsRest(__VLS_182));
__VLS_184.slots.default;
const __VLS_185 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_186 = __VLS_asFunctionalComponent(__VLS_185, new __VLS_185({
    type: (__VLS_ctx.getSeverityType(__VLS_ctx.violationDetail.severity)),
    size: "small",
}));
const __VLS_187 = __VLS_186({
    type: (__VLS_ctx.getSeverityType(__VLS_ctx.violationDetail.severity)),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_186));
__VLS_188.slots.default;
(__VLS_ctx.getSeverityText(__VLS_ctx.violationDetail.severity));
var __VLS_188;
var __VLS_184;
const __VLS_189 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_190 = __VLS_asFunctionalComponent(__VLS_189, new __VLS_189({
    label: "执行动作",
}));
const __VLS_191 = __VLS_190({
    label: "执行动作",
}, ...__VLS_functionalComponentArgsRest(__VLS_190));
__VLS_192.slots.default;
const __VLS_193 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_194 = __VLS_asFunctionalComponent(__VLS_193, new __VLS_193({
    type: (__VLS_ctx.getActionType(__VLS_ctx.violationDetail.action_taken)),
    size: "small",
}));
const __VLS_195 = __VLS_194({
    type: (__VLS_ctx.getActionType(__VLS_ctx.violationDetail.action_taken)),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_194));
__VLS_196.slots.default;
(__VLS_ctx.getActionText(__VLS_ctx.violationDetail.action_taken));
var __VLS_196;
var __VLS_192;
const __VLS_197 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_198 = __VLS_asFunctionalComponent(__VLS_197, new __VLS_197({
    label: "处理状态",
}));
const __VLS_199 = __VLS_198({
    label: "处理状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_198));
__VLS_200.slots.default;
const __VLS_201 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_202 = __VLS_asFunctionalComponent(__VLS_201, new __VLS_201({
    type: (__VLS_ctx.getStatusType(__VLS_ctx.violationDetail.status)),
    size: "small",
}));
const __VLS_203 = __VLS_202({
    type: (__VLS_ctx.getStatusType(__VLS_ctx.violationDetail.status)),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_202));
__VLS_204.slots.default;
(__VLS_ctx.getStatusText(__VLS_ctx.violationDetail.status));
var __VLS_204;
var __VLS_200;
const __VLS_205 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_206 = __VLS_asFunctionalComponent(__VLS_205, new __VLS_205({
    label: "创建时间",
}));
const __VLS_207 = __VLS_206({
    label: "创建时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_206));
__VLS_208.slots.default;
(__VLS_ctx.violationDetail.created_at);
var __VLS_208;
const __VLS_209 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_210 = __VLS_asFunctionalComponent(__VLS_209, new __VLS_209({
    label: "修复时间",
}));
const __VLS_211 = __VLS_210({
    label: "修复时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_210));
__VLS_212.slots.default;
(__VLS_ctx.violationDetail.fixed_at || '-');
var __VLS_212;
const __VLS_213 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_214 = __VLS_asFunctionalComponent(__VLS_213, new __VLS_213({
    label: "修复人",
}));
const __VLS_215 = __VLS_214({
    label: "修复人",
}, ...__VLS_functionalComponentArgsRest(__VLS_214));
__VLS_216.slots.default;
(__VLS_ctx.violationDetail.fixed_by || '-');
var __VLS_216;
const __VLS_217 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_218 = __VLS_asFunctionalComponent(__VLS_217, new __VLS_217({
    label: "违规详情",
    span: (2),
}));
const __VLS_219 = __VLS_218({
    label: "违规详情",
    span: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_218));
__VLS_220.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
    ...{ style: {} },
});
(JSON.stringify(__VLS_ctx.violationDetail.violation_detail, null, 2));
var __VLS_220;
if (__VLS_ctx.violationDetail.fix_note) {
    const __VLS_221 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_222 = __VLS_asFunctionalComponent(__VLS_221, new __VLS_221({
        label: "修复说明",
        span: (2),
    }));
    const __VLS_223 = __VLS_222({
        label: "修复说明",
        span: (2),
    }, ...__VLS_functionalComponentArgsRest(__VLS_222));
    __VLS_224.slots.default;
    (__VLS_ctx.violationDetail.fix_note);
    var __VLS_224;
}
var __VLS_148;
{
    const { footer: __VLS_thisSlot } = __VLS_144.slots;
    const __VLS_225 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_226 = __VLS_asFunctionalComponent(__VLS_225, new __VLS_225({
        ...{ 'onClick': {} },
    }));
    const __VLS_227 = __VLS_226({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_226));
    let __VLS_229;
    let __VLS_230;
    let __VLS_231;
    const __VLS_232 = {
        onClick: (...[$event]) => {
            __VLS_ctx.detailDialogVisible = false;
        }
    };
    __VLS_228.slots.default;
    var __VLS_228;
    const __VLS_233 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_234 = __VLS_asFunctionalComponent(__VLS_233, new __VLS_233({
        ...{ 'onClick': {} },
        type: "success",
        disabled: (__VLS_ctx.violationDetail.status !== 'open'),
    }));
    const __VLS_235 = __VLS_234({
        ...{ 'onClick': {} },
        type: "success",
        disabled: (__VLS_ctx.violationDetail.status !== 'open'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_234));
    let __VLS_237;
    let __VLS_238;
    let __VLS_239;
    const __VLS_240 = {
        onClick: (...[$event]) => {
            __VLS_ctx.handleResolve(__VLS_ctx.violationDetail);
        }
    };
    __VLS_236.slots.default;
    var __VLS_236;
}
var __VLS_144;
const __VLS_241 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_242 = __VLS_asFunctionalComponent(__VLS_241, new __VLS_241({
    modelValue: (__VLS_ctx.resolveDialogVisible),
    title: "标记解决",
    width: "500px",
}));
const __VLS_243 = __VLS_242({
    modelValue: (__VLS_ctx.resolveDialogVisible),
    title: "标记解决",
    width: "500px",
}, ...__VLS_functionalComponentArgsRest(__VLS_242));
__VLS_244.slots.default;
const __VLS_245 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_246 = __VLS_asFunctionalComponent(__VLS_245, new __VLS_245({
    model: (__VLS_ctx.resolveForm),
    labelWidth: "100px",
}));
const __VLS_247 = __VLS_246({
    model: (__VLS_ctx.resolveForm),
    labelWidth: "100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_246));
__VLS_248.slots.default;
const __VLS_249 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_250 = __VLS_asFunctionalComponent(__VLS_249, new __VLS_249({
    label: "处理状态",
}));
const __VLS_251 = __VLS_250({
    label: "处理状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_250));
__VLS_252.slots.default;
const __VLS_253 = {}.ElRadioGroup;
/** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
// @ts-ignore
const __VLS_254 = __VLS_asFunctionalComponent(__VLS_253, new __VLS_253({
    modelValue: (__VLS_ctx.resolveForm.status),
}));
const __VLS_255 = __VLS_254({
    modelValue: (__VLS_ctx.resolveForm.status),
}, ...__VLS_functionalComponentArgsRest(__VLS_254));
__VLS_256.slots.default;
const __VLS_257 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_258 = __VLS_asFunctionalComponent(__VLS_257, new __VLS_257({
    label: "resolved",
}));
const __VLS_259 = __VLS_258({
    label: "resolved",
}, ...__VLS_functionalComponentArgsRest(__VLS_258));
__VLS_260.slots.default;
var __VLS_260;
const __VLS_261 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_262 = __VLS_asFunctionalComponent(__VLS_261, new __VLS_261({
    label: "ignored",
}));
const __VLS_263 = __VLS_262({
    label: "ignored",
}, ...__VLS_functionalComponentArgsRest(__VLS_262));
__VLS_264.slots.default;
var __VLS_264;
var __VLS_256;
var __VLS_252;
const __VLS_265 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_266 = __VLS_asFunctionalComponent(__VLS_265, new __VLS_265({
    label: "修复说明",
}));
const __VLS_267 = __VLS_266({
    label: "修复说明",
}, ...__VLS_functionalComponentArgsRest(__VLS_266));
__VLS_268.slots.default;
const __VLS_269 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_270 = __VLS_asFunctionalComponent(__VLS_269, new __VLS_269({
    modelValue: (__VLS_ctx.resolveForm.fix_note),
    type: "textarea",
    rows: (4),
    placeholder: "请输入修复说明或处理备注",
}));
const __VLS_271 = __VLS_270({
    modelValue: (__VLS_ctx.resolveForm.fix_note),
    type: "textarea",
    rows: (4),
    placeholder: "请输入修复说明或处理备注",
}, ...__VLS_functionalComponentArgsRest(__VLS_270));
var __VLS_268;
var __VLS_248;
{
    const { footer: __VLS_thisSlot } = __VLS_244.slots;
    const __VLS_273 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_274 = __VLS_asFunctionalComponent(__VLS_273, new __VLS_273({
        ...{ 'onClick': {} },
    }));
    const __VLS_275 = __VLS_274({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_274));
    let __VLS_277;
    let __VLS_278;
    let __VLS_279;
    const __VLS_280 = {
        onClick: (...[$event]) => {
            __VLS_ctx.resolveDialogVisible = false;
        }
    };
    __VLS_276.slots.default;
    var __VLS_276;
    const __VLS_281 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_282 = __VLS_asFunctionalComponent(__VLS_281, new __VLS_281({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_283 = __VLS_282({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_282));
    let __VLS_285;
    let __VLS_286;
    let __VLS_287;
    const __VLS_288 = {
        onClick: (__VLS_ctx.submitResolve)
    };
    __VLS_284.slots.default;
    var __VLS_284;
}
var __VLS_244;
/** @type {__VLS_StyleScopedClasses['audit-violations']} */ ;
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-bar']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            violations: violations,
            total: total,
            currentPage: currentPage,
            pageSize: pageSize,
            filterTaskId: filterTaskId,
            filterStatus: filterStatus,
            filterSeverity: filterSeverity,
            detailDialogVisible: detailDialogVisible,
            violationDetail: violationDetail,
            resolveDialogVisible: resolveDialogVisible,
            resolveForm: resolveForm,
            submitting: submitting,
            loadViolations: loadViolations,
            handleView: handleView,
            handleResolve: handleResolve,
            submitResolve: submitResolve,
            viewProperty: viewProperty,
            getViolationMessage: getViolationMessage,
            getSeverityType: getSeverityType,
            getSeverityText: getSeverityText,
            getActionType: getActionType,
            getActionText: getActionText,
            getStatusType: getStatusType,
            getStatusText: getStatusText,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
