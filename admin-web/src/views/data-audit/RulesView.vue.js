/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getRuleList, createRule, updateRule, deleteRule, getRuleDetail } from '@/api/dataAudit';
const loading = ref(false);
const rules = ref([]);
const filterCategory = ref('');
const filterEnabled = ref(null);
const dialogVisible = ref(false);
const dialogTitle = computed(() => isEdit.value ? '编辑规则' : '新增规则');
const isEdit = ref(false);
const currentRuleId = ref(null);
const submitting = ref(false);
const formRef = ref(null);
const form = ref({
    rule_name: '',
    rule_code: '',
    category: '',
    description: '',
    config: {},
    action: 'flag',
    severity: 'warning',
    enabled: true,
    auto_fix: false
});
const configJson = ref('');
const formRules = {
    rule_name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
    rule_code: [{ required: true, message: '请输入规则代码', trigger: 'blur' }],
    category: [{ required: true, message: '请选择规则分类', trigger: 'change' }],
    action: [{ required: true, message: '请选择执行动作', trigger: 'change' }],
    severity: [{ required: true, message: '请选择严重级别', trigger: 'change' }]
};
const viewDialogVisible = ref(false);
const viewRule = ref({});
// 加载规则列表
const loadRules = async () => {
    loading.value = true;
    try {
        const params = {};
        if (filterCategory.value)
            params.category = filterCategory.value;
        if (filterEnabled.value !== null)
            params.enabled = filterEnabled.value;
        const res = await getRuleList(params);
        rules.value = res;
    }
    catch (error) {
        ElMessage.error('加载规则列表失败');
    }
    finally {
        loading.value = false;
    }
};
// 新增规则
const handleCreate = () => {
    isEdit.value = false;
    currentRuleId.value = null;
    form.value = {
        rule_name: '',
        rule_code: '',
        category: '',
        description: '',
        config: {},
        action: 'flag',
        severity: 'warning',
        enabled: true,
        auto_fix: false
    };
    configJson.value = '';
    dialogVisible.value = true;
};
// 编辑规则
const handleEdit = (row) => {
    isEdit.value = true;
    currentRuleId.value = row.id;
    form.value = {
        rule_name: row.rule_name,
        rule_code: row.rule_code,
        category: row.category,
        description: row.description,
        config: row.config,
        action: row.action,
        severity: row.severity,
        enabled: row.enabled,
        auto_fix: row.auto_fix
    };
    configJson.value = JSON.stringify(row.config, null, 2);
    dialogVisible.value = true;
};
// 查看规则
const handleView = async (row) => {
    try {
        const res = await getRuleDetail(row.id);
        viewRule.value = res;
        viewDialogVisible.value = true;
    }
    catch (error) {
        ElMessage.error('加载规则详情失败');
    }
};
// 删除规则
const handleDelete = (row) => {
    ElMessageBox.confirm(`确定要删除规则"${row.rule_name}"吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(async () => {
        try {
            await deleteRule(row.id);
            ElMessage.success('删除成功');
            loadRules();
        }
        catch (error) {
            ElMessage.error('删除失败');
        }
    }).catch(() => { });
};
// 切换启用状态
const handleToggleEnabled = async (row) => {
    try {
        await updateRule(row.id, { enabled: row.enabled });
        ElMessage.success('更新成功');
    }
    catch (error) {
        ElMessage.error('更新失败');
        row.enabled = !row.enabled; // 回滚
    }
};
// 提交表单
const handleSubmit = async () => {
    if (!formRef.value)
        return;
    await formRef.value.validate(async (valid) => {
        if (!valid)
            return;
        // 解析配置JSON
        try {
            form.value.config = JSON.parse(configJson.value);
        }
        catch (error) {
            ElMessage.error('规则配置格式错误，请输入有效的JSON');
            return;
        }
        submitting.value = true;
        try {
            if (isEdit.value) {
                await updateRule(currentRuleId.value, form.value);
                ElMessage.success('更新成功');
            }
            else {
                await createRule(form.value);
                ElMessage.success('创建成功');
            }
            dialogVisible.value = false;
            loadRules();
        }
        catch (error) {
            ElMessage.error(isEdit.value ? '更新失败' : '创建失败');
        }
        finally {
            submitting.value = false;
        }
    });
};
// 辅助函数
const getCategoryText = (category) => {
    const map = {
        field_required: '必填字段检查',
        field_range: '字段范围检查',
        field_format: '字段格式检查',
        region_filter: '地区过滤',
        property_type_filter: '房产类型过滤'
    };
    return map[category] || category;
};
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
const getActionText = (action) => {
    const map = {
        flag: '仅标记',
        fix: '尝试修复',
        delete: '删除数据'
    };
    return map[action] || action;
};
onMounted(() => {
    loadRules();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "audit-rules" },
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
    const __VLS_4 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
    }));
    const __VLS_6 = __VLS_5({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    let __VLS_8;
    let __VLS_9;
    let __VLS_10;
    const __VLS_11 = {
        onClick: (__VLS_ctx.handleCreate)
    };
    __VLS_7.slots.default;
    var __VLS_7;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "filter-bar" },
});
const __VLS_12 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    modelValue: (__VLS_ctx.filterCategory),
    placeholder: "规则分类",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_14 = __VLS_13({
    modelValue: (__VLS_ctx.filterCategory),
    placeholder: "规则分类",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
const __VLS_16 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    label: "必填字段检查",
    value: "field_required",
}));
const __VLS_18 = __VLS_17({
    label: "必填字段检查",
    value: "field_required",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const __VLS_20 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    label: "字段范围检查",
    value: "field_range",
}));
const __VLS_22 = __VLS_21({
    label: "字段范围检查",
    value: "field_range",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_24 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    label: "字段格式检查",
    value: "field_format",
}));
const __VLS_26 = __VLS_25({
    label: "字段格式检查",
    value: "field_format",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
const __VLS_28 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    label: "地区过滤",
    value: "region_filter",
}));
const __VLS_30 = __VLS_29({
    label: "地区过滤",
    value: "region_filter",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
const __VLS_32 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    label: "房产类型过滤",
    value: "property_type_filter",
}));
const __VLS_34 = __VLS_33({
    label: "房产类型过滤",
    value: "property_type_filter",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
var __VLS_15;
const __VLS_36 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    modelValue: (__VLS_ctx.filterEnabled),
    placeholder: "启用状态",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_38 = __VLS_37({
    modelValue: (__VLS_ctx.filterEnabled),
    placeholder: "启用状态",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
const __VLS_40 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    label: "已启用",
    value: (true),
}));
const __VLS_42 = __VLS_41({
    label: "已启用",
    value: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
const __VLS_44 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    label: "已禁用",
    value: (false),
}));
const __VLS_46 = __VLS_45({
    label: "已禁用",
    value: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
var __VLS_39;
const __VLS_48 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ 'onClick': {} },
    type: "primary",
    ...{ style: {} },
}));
const __VLS_50 = __VLS_49({
    ...{ 'onClick': {} },
    type: "primary",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
let __VLS_52;
let __VLS_53;
let __VLS_54;
const __VLS_55 = {
    onClick: (__VLS_ctx.loadRules)
};
__VLS_51.slots.default;
var __VLS_51;
const __VLS_56 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    data: (__VLS_ctx.rules),
    ...{ style: {} },
}));
const __VLS_58 = __VLS_57({
    data: (__VLS_ctx.rules),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
__VLS_59.slots.default;
const __VLS_60 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    prop: "rule_name",
    label: "规则名称",
    minWidth: "180",
}));
const __VLS_62 = __VLS_61({
    prop: "rule_name",
    label: "规则名称",
    minWidth: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
const __VLS_64 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    prop: "rule_code",
    label: "规则代码",
    width: "200",
}));
const __VLS_66 = __VLS_65({
    prop: "rule_code",
    label: "规则代码",
    width: "200",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
const __VLS_68 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    prop: "category",
    label: "分类",
    width: "140",
}));
const __VLS_70 = __VLS_69({
    prop: "category",
    label: "分类",
    width: "140",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_71.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_72 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        size: "small",
    }));
    const __VLS_74 = __VLS_73({
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_75.slots.default;
    (__VLS_ctx.getCategoryText(row.category));
    var __VLS_75;
}
var __VLS_71;
const __VLS_76 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    prop: "severity",
    label: "严重级别",
    width: "100",
}));
const __VLS_78 = __VLS_77({
    prop: "severity",
    label: "严重级别",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
__VLS_79.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_79.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_80 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        type: (__VLS_ctx.getSeverityType(row.severity)),
        size: "small",
    }));
    const __VLS_82 = __VLS_81({
        type: (__VLS_ctx.getSeverityType(row.severity)),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    __VLS_83.slots.default;
    (__VLS_ctx.getSeverityText(row.severity));
    var __VLS_83;
}
var __VLS_79;
const __VLS_84 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    prop: "action",
    label: "执行动作",
    width: "100",
}));
const __VLS_86 = __VLS_85({
    prop: "action",
    label: "执行动作",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_87.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (__VLS_ctx.getActionText(row.action));
}
var __VLS_87;
const __VLS_88 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    prop: "enabled",
    label: "状态",
    width: "80",
}));
const __VLS_90 = __VLS_89({
    prop: "enabled",
    label: "状态",
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_91.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_91.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_92 = {}.ElSwitch;
    /** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
        ...{ 'onChange': {} },
        modelValue: (row.enabled),
    }));
    const __VLS_94 = __VLS_93({
        ...{ 'onChange': {} },
        modelValue: (row.enabled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    let __VLS_96;
    let __VLS_97;
    let __VLS_98;
    const __VLS_99 = {
        onChange: (...[$event]) => {
            __VLS_ctx.handleToggleEnabled(row);
        }
    };
    var __VLS_95;
}
var __VLS_91;
const __VLS_100 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    label: "统计",
    width: "150",
}));
const __VLS_102 = __VLS_101({
    label: "统计",
    width: "150",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
__VLS_103.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_103.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (row.total_checked);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (row.total_violations);
}
var __VLS_103;
const __VLS_104 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    label: "操作",
    width: "180",
    fixed: "right",
}));
const __VLS_106 = __VLS_105({
    label: "操作",
    width: "180",
    fixed: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_107.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_107.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_108 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        ...{ 'onClick': {} },
        type: "primary",
        link: true,
        size: "small",
    }));
    const __VLS_110 = __VLS_109({
        ...{ 'onClick': {} },
        type: "primary",
        link: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    let __VLS_112;
    let __VLS_113;
    let __VLS_114;
    const __VLS_115 = {
        onClick: (...[$event]) => {
            __VLS_ctx.handleView(row);
        }
    };
    __VLS_111.slots.default;
    var __VLS_111;
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
            __VLS_ctx.handleEdit(row);
        }
    };
    __VLS_119.slots.default;
    var __VLS_119;
    const __VLS_124 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        ...{ 'onClick': {} },
        type: "danger",
        link: true,
        size: "small",
    }));
    const __VLS_126 = __VLS_125({
        ...{ 'onClick': {} },
        type: "danger",
        link: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    let __VLS_128;
    let __VLS_129;
    let __VLS_130;
    const __VLS_131 = {
        onClick: (...[$event]) => {
            __VLS_ctx.handleDelete(row);
        }
    };
    __VLS_127.slots.default;
    var __VLS_127;
}
var __VLS_107;
var __VLS_59;
var __VLS_3;
const __VLS_132 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    modelValue: (__VLS_ctx.dialogVisible),
    title: (__VLS_ctx.dialogTitle),
    width: "700px",
}));
const __VLS_134 = __VLS_133({
    modelValue: (__VLS_ctx.dialogVisible),
    title: (__VLS_ctx.dialogTitle),
    width: "700px",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
const __VLS_136 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    model: (__VLS_ctx.form),
    rules: (__VLS_ctx.rules),
    ref: "formRef",
    labelWidth: "120px",
}));
const __VLS_138 = __VLS_137({
    model: (__VLS_ctx.form),
    rules: (__VLS_ctx.rules),
    ref: "formRef",
    labelWidth: "120px",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
/** @type {typeof __VLS_ctx.formRef} */ ;
var __VLS_140 = {};
__VLS_139.slots.default;
const __VLS_142 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_143 = __VLS_asFunctionalComponent(__VLS_142, new __VLS_142({
    label: "规则名称",
    prop: "rule_name",
}));
const __VLS_144 = __VLS_143({
    label: "规则名称",
    prop: "rule_name",
}, ...__VLS_functionalComponentArgsRest(__VLS_143));
__VLS_145.slots.default;
const __VLS_146 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_147 = __VLS_asFunctionalComponent(__VLS_146, new __VLS_146({
    modelValue: (__VLS_ctx.form.rule_name),
    placeholder: "请输入规则名称",
}));
const __VLS_148 = __VLS_147({
    modelValue: (__VLS_ctx.form.rule_name),
    placeholder: "请输入规则名称",
}, ...__VLS_functionalComponentArgsRest(__VLS_147));
var __VLS_145;
const __VLS_150 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_151 = __VLS_asFunctionalComponent(__VLS_150, new __VLS_150({
    label: "规则代码",
    prop: "rule_code",
}));
const __VLS_152 = __VLS_151({
    label: "规则代码",
    prop: "rule_code",
}, ...__VLS_functionalComponentArgsRest(__VLS_151));
__VLS_153.slots.default;
const __VLS_154 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_155 = __VLS_asFunctionalComponent(__VLS_154, new __VLS_154({
    modelValue: (__VLS_ctx.form.rule_code),
    placeholder: "请输入规则唯一标识码",
    disabled: (__VLS_ctx.isEdit),
}));
const __VLS_156 = __VLS_155({
    modelValue: (__VLS_ctx.form.rule_code),
    placeholder: "请输入规则唯一标识码",
    disabled: (__VLS_ctx.isEdit),
}, ...__VLS_functionalComponentArgsRest(__VLS_155));
var __VLS_153;
const __VLS_158 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_159 = __VLS_asFunctionalComponent(__VLS_158, new __VLS_158({
    label: "规则分类",
    prop: "category",
}));
const __VLS_160 = __VLS_159({
    label: "规则分类",
    prop: "category",
}, ...__VLS_functionalComponentArgsRest(__VLS_159));
__VLS_161.slots.default;
const __VLS_162 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_163 = __VLS_asFunctionalComponent(__VLS_162, new __VLS_162({
    modelValue: (__VLS_ctx.form.category),
    placeholder: "请选择规则分类",
    ...{ style: {} },
}));
const __VLS_164 = __VLS_163({
    modelValue: (__VLS_ctx.form.category),
    placeholder: "请选择规则分类",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_163));
__VLS_165.slots.default;
const __VLS_166 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_167 = __VLS_asFunctionalComponent(__VLS_166, new __VLS_166({
    label: "必填字段检查",
    value: "field_required",
}));
const __VLS_168 = __VLS_167({
    label: "必填字段检查",
    value: "field_required",
}, ...__VLS_functionalComponentArgsRest(__VLS_167));
const __VLS_170 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_171 = __VLS_asFunctionalComponent(__VLS_170, new __VLS_170({
    label: "字段范围检查",
    value: "field_range",
}));
const __VLS_172 = __VLS_171({
    label: "字段范围检查",
    value: "field_range",
}, ...__VLS_functionalComponentArgsRest(__VLS_171));
const __VLS_174 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_175 = __VLS_asFunctionalComponent(__VLS_174, new __VLS_174({
    label: "字段格式检查",
    value: "field_format",
}));
const __VLS_176 = __VLS_175({
    label: "字段格式检查",
    value: "field_format",
}, ...__VLS_functionalComponentArgsRest(__VLS_175));
const __VLS_178 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_179 = __VLS_asFunctionalComponent(__VLS_178, new __VLS_178({
    label: "地区过滤",
    value: "region_filter",
}));
const __VLS_180 = __VLS_179({
    label: "地区过滤",
    value: "region_filter",
}, ...__VLS_functionalComponentArgsRest(__VLS_179));
const __VLS_182 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_183 = __VLS_asFunctionalComponent(__VLS_182, new __VLS_182({
    label: "房产类型过滤",
    value: "property_type_filter",
}));
const __VLS_184 = __VLS_183({
    label: "房产类型过滤",
    value: "property_type_filter",
}, ...__VLS_functionalComponentArgsRest(__VLS_183));
var __VLS_165;
var __VLS_161;
const __VLS_186 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_187 = __VLS_asFunctionalComponent(__VLS_186, new __VLS_186({
    label: "规则描述",
}));
const __VLS_188 = __VLS_187({
    label: "规则描述",
}, ...__VLS_functionalComponentArgsRest(__VLS_187));
__VLS_189.slots.default;
const __VLS_190 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_191 = __VLS_asFunctionalComponent(__VLS_190, new __VLS_190({
    modelValue: (__VLS_ctx.form.description),
    type: "textarea",
    rows: (3),
    placeholder: "请输入规则描述",
}));
const __VLS_192 = __VLS_191({
    modelValue: (__VLS_ctx.form.description),
    type: "textarea",
    rows: (3),
    placeholder: "请输入规则描述",
}, ...__VLS_functionalComponentArgsRest(__VLS_191));
var __VLS_189;
const __VLS_194 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_195 = __VLS_asFunctionalComponent(__VLS_194, new __VLS_194({
    label: "规则配置",
    prop: "config",
}));
const __VLS_196 = __VLS_195({
    label: "规则配置",
    prop: "config",
}, ...__VLS_functionalComponentArgsRest(__VLS_195));
__VLS_197.slots.default;
const __VLS_198 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_199 = __VLS_asFunctionalComponent(__VLS_198, new __VLS_198({
    modelValue: (__VLS_ctx.configJson),
    type: "textarea",
    rows: (8),
    placeholder: '请输入JSON格式的配置，例如：{"fields": ["starting_price", "deposit"]}',
}));
const __VLS_200 = __VLS_199({
    modelValue: (__VLS_ctx.configJson),
    type: "textarea",
    rows: (8),
    placeholder: '请输入JSON格式的配置，例如：{"fields": ["starting_price", "deposit"]}',
}, ...__VLS_functionalComponentArgsRest(__VLS_199));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
var __VLS_197;
const __VLS_202 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_203 = __VLS_asFunctionalComponent(__VLS_202, new __VLS_202({
    label: "执行动作",
    prop: "action",
}));
const __VLS_204 = __VLS_203({
    label: "执行动作",
    prop: "action",
}, ...__VLS_functionalComponentArgsRest(__VLS_203));
__VLS_205.slots.default;
const __VLS_206 = {}.ElRadioGroup;
/** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
// @ts-ignore
const __VLS_207 = __VLS_asFunctionalComponent(__VLS_206, new __VLS_206({
    modelValue: (__VLS_ctx.form.action),
}));
const __VLS_208 = __VLS_207({
    modelValue: (__VLS_ctx.form.action),
}, ...__VLS_functionalComponentArgsRest(__VLS_207));
__VLS_209.slots.default;
const __VLS_210 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_211 = __VLS_asFunctionalComponent(__VLS_210, new __VLS_210({
    label: "flag",
}));
const __VLS_212 = __VLS_211({
    label: "flag",
}, ...__VLS_functionalComponentArgsRest(__VLS_211));
__VLS_213.slots.default;
var __VLS_213;
const __VLS_214 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_215 = __VLS_asFunctionalComponent(__VLS_214, new __VLS_214({
    label: "fix",
}));
const __VLS_216 = __VLS_215({
    label: "fix",
}, ...__VLS_functionalComponentArgsRest(__VLS_215));
__VLS_217.slots.default;
var __VLS_217;
const __VLS_218 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_219 = __VLS_asFunctionalComponent(__VLS_218, new __VLS_218({
    label: "delete",
}));
const __VLS_220 = __VLS_219({
    label: "delete",
}, ...__VLS_functionalComponentArgsRest(__VLS_219));
__VLS_221.slots.default;
var __VLS_221;
var __VLS_209;
var __VLS_205;
const __VLS_222 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_223 = __VLS_asFunctionalComponent(__VLS_222, new __VLS_222({
    label: "严重级别",
    prop: "severity",
}));
const __VLS_224 = __VLS_223({
    label: "严重级别",
    prop: "severity",
}, ...__VLS_functionalComponentArgsRest(__VLS_223));
__VLS_225.slots.default;
const __VLS_226 = {}.ElRadioGroup;
/** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
// @ts-ignore
const __VLS_227 = __VLS_asFunctionalComponent(__VLS_226, new __VLS_226({
    modelValue: (__VLS_ctx.form.severity),
}));
const __VLS_228 = __VLS_227({
    modelValue: (__VLS_ctx.form.severity),
}, ...__VLS_functionalComponentArgsRest(__VLS_227));
__VLS_229.slots.default;
const __VLS_230 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_231 = __VLS_asFunctionalComponent(__VLS_230, new __VLS_230({
    label: "info",
}));
const __VLS_232 = __VLS_231({
    label: "info",
}, ...__VLS_functionalComponentArgsRest(__VLS_231));
__VLS_233.slots.default;
var __VLS_233;
const __VLS_234 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_235 = __VLS_asFunctionalComponent(__VLS_234, new __VLS_234({
    label: "warning",
}));
const __VLS_236 = __VLS_235({
    label: "warning",
}, ...__VLS_functionalComponentArgsRest(__VLS_235));
__VLS_237.slots.default;
var __VLS_237;
const __VLS_238 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_239 = __VLS_asFunctionalComponent(__VLS_238, new __VLS_238({
    label: "error",
}));
const __VLS_240 = __VLS_239({
    label: "error",
}, ...__VLS_functionalComponentArgsRest(__VLS_239));
__VLS_241.slots.default;
var __VLS_241;
const __VLS_242 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_243 = __VLS_asFunctionalComponent(__VLS_242, new __VLS_242({
    label: "critical",
}));
const __VLS_244 = __VLS_243({
    label: "critical",
}, ...__VLS_functionalComponentArgsRest(__VLS_243));
__VLS_245.slots.default;
var __VLS_245;
var __VLS_229;
var __VLS_225;
const __VLS_246 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_247 = __VLS_asFunctionalComponent(__VLS_246, new __VLS_246({
    label: "启用状态",
}));
const __VLS_248 = __VLS_247({
    label: "启用状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_247));
__VLS_249.slots.default;
const __VLS_250 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_251 = __VLS_asFunctionalComponent(__VLS_250, new __VLS_250({
    modelValue: (__VLS_ctx.form.enabled),
}));
const __VLS_252 = __VLS_251({
    modelValue: (__VLS_ctx.form.enabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_251));
var __VLS_249;
const __VLS_254 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_255 = __VLS_asFunctionalComponent(__VLS_254, new __VLS_254({
    label: "自动修复",
}));
const __VLS_256 = __VLS_255({
    label: "自动修复",
}, ...__VLS_functionalComponentArgsRest(__VLS_255));
__VLS_257.slots.default;
const __VLS_258 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_259 = __VLS_asFunctionalComponent(__VLS_258, new __VLS_258({
    modelValue: (__VLS_ctx.form.auto_fix),
}));
const __VLS_260 = __VLS_259({
    modelValue: (__VLS_ctx.form.auto_fix),
}, ...__VLS_functionalComponentArgsRest(__VLS_259));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
var __VLS_257;
var __VLS_139;
{
    const { footer: __VLS_thisSlot } = __VLS_135.slots;
    const __VLS_262 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_263 = __VLS_asFunctionalComponent(__VLS_262, new __VLS_262({
        ...{ 'onClick': {} },
    }));
    const __VLS_264 = __VLS_263({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_263));
    let __VLS_266;
    let __VLS_267;
    let __VLS_268;
    const __VLS_269 = {
        onClick: (...[$event]) => {
            __VLS_ctx.dialogVisible = false;
        }
    };
    __VLS_265.slots.default;
    var __VLS_265;
    const __VLS_270 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_271 = __VLS_asFunctionalComponent(__VLS_270, new __VLS_270({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_272 = __VLS_271({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_271));
    let __VLS_274;
    let __VLS_275;
    let __VLS_276;
    const __VLS_277 = {
        onClick: (__VLS_ctx.handleSubmit)
    };
    __VLS_273.slots.default;
    var __VLS_273;
}
var __VLS_135;
const __VLS_278 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_279 = __VLS_asFunctionalComponent(__VLS_278, new __VLS_278({
    modelValue: (__VLS_ctx.viewDialogVisible),
    title: "规则详情",
    width: "700px",
}));
const __VLS_280 = __VLS_279({
    modelValue: (__VLS_ctx.viewDialogVisible),
    title: "规则详情",
    width: "700px",
}, ...__VLS_functionalComponentArgsRest(__VLS_279));
__VLS_281.slots.default;
const __VLS_282 = {}.ElDescriptions;
/** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
// @ts-ignore
const __VLS_283 = __VLS_asFunctionalComponent(__VLS_282, new __VLS_282({
    column: (2),
    border: true,
}));
const __VLS_284 = __VLS_283({
    column: (2),
    border: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_283));
__VLS_285.slots.default;
const __VLS_286 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_287 = __VLS_asFunctionalComponent(__VLS_286, new __VLS_286({
    label: "规则名称",
}));
const __VLS_288 = __VLS_287({
    label: "规则名称",
}, ...__VLS_functionalComponentArgsRest(__VLS_287));
__VLS_289.slots.default;
(__VLS_ctx.viewRule.rule_name);
var __VLS_289;
const __VLS_290 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_291 = __VLS_asFunctionalComponent(__VLS_290, new __VLS_290({
    label: "规则代码",
}));
const __VLS_292 = __VLS_291({
    label: "规则代码",
}, ...__VLS_functionalComponentArgsRest(__VLS_291));
__VLS_293.slots.default;
(__VLS_ctx.viewRule.rule_code);
var __VLS_293;
const __VLS_294 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_295 = __VLS_asFunctionalComponent(__VLS_294, new __VLS_294({
    label: "规则分类",
}));
const __VLS_296 = __VLS_295({
    label: "规则分类",
}, ...__VLS_functionalComponentArgsRest(__VLS_295));
__VLS_297.slots.default;
(__VLS_ctx.getCategoryText(__VLS_ctx.viewRule.category));
var __VLS_297;
const __VLS_298 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_299 = __VLS_asFunctionalComponent(__VLS_298, new __VLS_298({
    label: "严重级别",
}));
const __VLS_300 = __VLS_299({
    label: "严重级别",
}, ...__VLS_functionalComponentArgsRest(__VLS_299));
__VLS_301.slots.default;
const __VLS_302 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_303 = __VLS_asFunctionalComponent(__VLS_302, new __VLS_302({
    type: (__VLS_ctx.getSeverityType(__VLS_ctx.viewRule.severity)),
    size: "small",
}));
const __VLS_304 = __VLS_303({
    type: (__VLS_ctx.getSeverityType(__VLS_ctx.viewRule.severity)),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_303));
__VLS_305.slots.default;
(__VLS_ctx.getSeverityText(__VLS_ctx.viewRule.severity));
var __VLS_305;
var __VLS_301;
const __VLS_306 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_307 = __VLS_asFunctionalComponent(__VLS_306, new __VLS_306({
    label: "执行动作",
}));
const __VLS_308 = __VLS_307({
    label: "执行动作",
}, ...__VLS_functionalComponentArgsRest(__VLS_307));
__VLS_309.slots.default;
(__VLS_ctx.getActionText(__VLS_ctx.viewRule.action));
var __VLS_309;
const __VLS_310 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_311 = __VLS_asFunctionalComponent(__VLS_310, new __VLS_310({
    label: "启用状态",
}));
const __VLS_312 = __VLS_311({
    label: "启用状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_311));
__VLS_313.slots.default;
const __VLS_314 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_315 = __VLS_asFunctionalComponent(__VLS_314, new __VLS_314({
    type: (__VLS_ctx.viewRule.enabled ? 'success' : 'info'),
    size: "small",
}));
const __VLS_316 = __VLS_315({
    type: (__VLS_ctx.viewRule.enabled ? 'success' : 'info'),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_315));
__VLS_317.slots.default;
(__VLS_ctx.viewRule.enabled ? '已启用' : '已禁用');
var __VLS_317;
var __VLS_313;
const __VLS_318 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_319 = __VLS_asFunctionalComponent(__VLS_318, new __VLS_318({
    label: "自动修复",
}));
const __VLS_320 = __VLS_319({
    label: "自动修复",
}, ...__VLS_functionalComponentArgsRest(__VLS_319));
__VLS_321.slots.default;
(__VLS_ctx.viewRule.auto_fix ? '是' : '否');
var __VLS_321;
const __VLS_322 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_323 = __VLS_asFunctionalComponent(__VLS_322, new __VLS_322({
    label: "累计检查次数",
}));
const __VLS_324 = __VLS_323({
    label: "累计检查次数",
}, ...__VLS_functionalComponentArgsRest(__VLS_323));
__VLS_325.slots.default;
(__VLS_ctx.viewRule.total_checked);
var __VLS_325;
const __VLS_326 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_327 = __VLS_asFunctionalComponent(__VLS_326, new __VLS_326({
    label: "累计违规次数",
}));
const __VLS_328 = __VLS_327({
    label: "累计违规次数",
}, ...__VLS_functionalComponentArgsRest(__VLS_327));
__VLS_329.slots.default;
(__VLS_ctx.viewRule.total_violations);
var __VLS_329;
const __VLS_330 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_331 = __VLS_asFunctionalComponent(__VLS_330, new __VLS_330({
    label: "最后执行时间",
}));
const __VLS_332 = __VLS_331({
    label: "最后执行时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_331));
__VLS_333.slots.default;
(__VLS_ctx.viewRule.last_executed_at || '-');
var __VLS_333;
const __VLS_334 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_335 = __VLS_asFunctionalComponent(__VLS_334, new __VLS_334({
    label: "规则描述",
    span: (2),
}));
const __VLS_336 = __VLS_335({
    label: "规则描述",
    span: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_335));
__VLS_337.slots.default;
(__VLS_ctx.viewRule.description || '-');
var __VLS_337;
const __VLS_338 = {}.ElDescriptionsItem;
/** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
// @ts-ignore
const __VLS_339 = __VLS_asFunctionalComponent(__VLS_338, new __VLS_338({
    label: "规则配置",
    span: (2),
}));
const __VLS_340 = __VLS_339({
    label: "规则配置",
    span: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_339));
__VLS_341.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
    ...{ style: {} },
});
(JSON.stringify(__VLS_ctx.viewRule.config, null, 2));
var __VLS_341;
var __VLS_285;
var __VLS_281;
/** @type {__VLS_StyleScopedClasses['audit-rules']} */ ;
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-bar']} */ ;
// @ts-ignore
var __VLS_141 = __VLS_140;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            rules: rules,
            filterCategory: filterCategory,
            filterEnabled: filterEnabled,
            dialogVisible: dialogVisible,
            dialogTitle: dialogTitle,
            isEdit: isEdit,
            submitting: submitting,
            formRef: formRef,
            form: form,
            configJson: configJson,
            viewDialogVisible: viewDialogVisible,
            viewRule: viewRule,
            loadRules: loadRules,
            handleCreate: handleCreate,
            handleEdit: handleEdit,
            handleView: handleView,
            handleDelete: handleDelete,
            handleToggleEnabled: handleToggleEnabled,
            handleSubmit: handleSubmit,
            getCategoryText: getCategoryText,
            getSeverityType: getSeverityType,
            getSeverityText: getSeverityText,
            getActionText: getActionText,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
