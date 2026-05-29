/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { listDemands, createDemand, updateDemand, deleteDemand } from '@/api/demands';
const loading = ref(false);
const list = ref([]);
const filters = reactive({ phone: '', status: '', source: '' });
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const columns = [
    { colKey: 'id', title: 'ID', width: 70 },
    { colKey: 'source', title: '来源', width: 100 },
    { colKey: 'name', title: '姓名', width: 80 },
    { colKey: 'phone', title: '手机号', width: 130 },
    { colKey: 'city', title: '城市', width: 80 },
    { colKey: 'purpose', title: '用途', width: 70 },
    { colKey: 'budget', title: '预算', width: 100 },
    { colKey: 'target_district', title: '意向区域', width: 120 },
    { colKey: 'remark', title: '留言/备注', width: 220 },
    { colKey: 'agent_wechat', title: '业务员', width: 120 },
    { colKey: 'status', title: '状态', width: 80 },
    { colKey: 'created_at', title: '提交时间', width: 160 },
    { colKey: 'op', title: '操作', width: 140 },
];
const editVisible = ref(false);
const editForm = reactive({ id: 0, agent_wechat: '', status: '待处理', remark: '' });
const createVisible = ref(false);
const createForm = reactive({ name: '', phone: '', city: '上海', purpose: '自住', budget: '', target_district: '' });
onMounted(() => loadData());
async function loadData() {
    loading.value = true;
    try {
        const params = { page: pagination.current, page_size: pagination.pageSize };
        if (filters.phone)
            params.phone = filters.phone;
        if (filters.status)
            params.status = filters.status;
        if (filters.source)
            params.source = filters.source;
        const data = await listDemands(params);
        list.value = data.items;
        pagination.total = data.total;
    }
    finally {
        loading.value = false;
    }
}
function onSearch() { pagination.current = 1; loadData(); }
function onPageChange(p) { pagination.current = p.current; loadData(); }
function onEdit(row) {
    Object.assign(editForm, { id: row.id, agent_wechat: row.agent_wechat || '', status: row.status, remark: row.remark || '' });
    editVisible.value = true;
}
async function onSaveEdit() {
    try {
        await updateDemand(editForm.id, { agent_wechat: editForm.agent_wechat, status: editForm.status, remark: editForm.remark });
        MessagePlugin.success('更新成功');
        editVisible.value = false;
        loadData();
    }
    catch { /* skip */ }
}
function onCreate() {
    createForm.name = '';
    createForm.phone = '';
    createForm.city = '上海';
    createForm.purpose = '自住';
    createForm.budget = '';
    createForm.target_district = '';
    createVisible.value = true;
}
async function onSaveCreate() {
    try {
        await createDemand({ ...createForm });
        MessagePlugin.success('创建成功');
        createVisible.value = false;
        loadData();
    }
    catch { /* skip */ }
}
async function onDelete(row) {
    try {
        await deleteDemand(row.id);
        MessagePlugin.success('删除成功');
        loadData();
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
const __VLS_0 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "search-bar" },
});
const __VLS_4 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.phone),
    placeholder: "搜索手机号",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_6 = __VLS_5({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.phone),
    placeholder: "搜索手机号",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
let __VLS_8;
let __VLS_9;
let __VLS_10;
const __VLS_11 = {
    onChange: (__VLS_ctx.onSearch)
};
var __VLS_7;
const __VLS_12 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.status),
    placeholder: "处理状态",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_14 = __VLS_13({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.status),
    placeholder: "处理状态",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_15.slots.default;
const __VLS_20 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    value: "待处理",
    label: "待处理",
}));
const __VLS_22 = __VLS_21({
    value: "待处理",
    label: "待处理",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_24 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    value: "已分配",
    label: "已分配",
}));
const __VLS_26 = __VLS_25({
    value: "已分配",
    label: "已分配",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
const __VLS_28 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    value: "已完成",
    label: "已完成",
}));
const __VLS_30 = __VLS_29({
    value: "已完成",
    label: "已完成",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
var __VLS_15;
const __VLS_32 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.source),
    placeholder: "来源",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_34 = __VLS_33({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.source),
    placeholder: "来源",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_36;
let __VLS_37;
let __VLS_38;
const __VLS_39 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_35.slots.default;
const __VLS_40 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    value: "demand-form",
    label: "选房需求",
}));
const __VLS_42 = __VLS_41({
    value: "demand-form",
    label: "选房需求",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
const __VLS_44 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    value: "message",
    label: "客服留言",
}));
const __VLS_46 = __VLS_45({
    value: "message",
    label: "客服留言",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
var __VLS_35;
const __VLS_48 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_50 = __VLS_49({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
let __VLS_52;
let __VLS_53;
let __VLS_54;
const __VLS_55 = {
    onClick: (__VLS_ctx.loadData)
};
__VLS_51.slots.default;
var __VLS_51;
const __VLS_56 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    ...{ 'onClick': {} },
    theme: "primary",
    variant: "outline",
}));
const __VLS_58 = __VLS_57({
    ...{ 'onClick': {} },
    theme: "primary",
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
let __VLS_60;
let __VLS_61;
let __VLS_62;
const __VLS_63 = {
    onClick: (__VLS_ctx.onCreate)
};
__VLS_59.slots.default;
var __VLS_59;
const __VLS_64 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.columns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
    pagination: (__VLS_ctx.pagination),
}));
const __VLS_66 = __VLS_65({
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.columns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
    pagination: (__VLS_ctx.pagination),
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
let __VLS_68;
let __VLS_69;
let __VLS_70;
const __VLS_71 = {
    onPageChange: (__VLS_ctx.onPageChange)
};
__VLS_67.slots.default;
{
    const { source: __VLS_thisSlot } = __VLS_67.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_72 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        theme: (row.source === 'message' ? 'warning' : 'primary'),
        variant: "light",
    }));
    const __VLS_74 = __VLS_73({
        theme: (row.source === 'message' ? 'warning' : 'primary'),
        variant: "light",
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_75.slots.default;
    (row.source === 'message' ? '客服留言' : '选房需求');
    var __VLS_75;
}
{
    const { status: __VLS_thisSlot } = __VLS_67.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_76 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        theme: (row.status === '待处理' ? 'warning' : row.status === '已分配' ? 'primary' : 'success'),
    }));
    const __VLS_78 = __VLS_77({
        theme: (row.status === '待处理' ? 'warning' : row.status === '已分配' ? 'primary' : 'success'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    __VLS_79.slots.default;
    (row.status);
    var __VLS_79;
}
{
    const { remark: __VLS_thisSlot } = __VLS_67.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    if (row.remark) {
        const __VLS_80 = {}.TTooltip;
        /** @type {[typeof __VLS_components.TTooltip, typeof __VLS_components.tTooltip, typeof __VLS_components.TTooltip, typeof __VLS_components.tTooltip, ]} */ ;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
            content: (row.remark),
        }));
        const __VLS_82 = __VLS_81({
            content: (row.remark),
        }, ...__VLS_functionalComponentArgsRest(__VLS_81));
        __VLS_83.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ style: {} },
        });
        (row.remark);
        var __VLS_83;
    }
}
{
    const { op: __VLS_thisSlot } = __VLS_67.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_84 = {}.TSpace;
    /** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({}));
    const __VLS_86 = __VLS_85({}, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    const __VLS_88 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
    }));
    const __VLS_90 = __VLS_89({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    let __VLS_92;
    let __VLS_93;
    let __VLS_94;
    const __VLS_95 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onEdit(row);
        }
    };
    __VLS_91.slots.default;
    var __VLS_91;
    const __VLS_96 = {}.TPopconfirm;
    /** @type {[typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ 'onConfirm': {} },
        content: "确定删除该需求？",
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onConfirm': {} },
        content: "确定删除该需求？",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_100;
    let __VLS_101;
    let __VLS_102;
    const __VLS_103 = {
        onConfirm: (...[$event]) => {
            __VLS_ctx.onDelete(row);
        }
    };
    __VLS_99.slots.default;
    const __VLS_104 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        variant: "text",
        size: "small",
        theme: "danger",
    }));
    const __VLS_106 = __VLS_105({
        variant: "text",
        size: "small",
        theme: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_107.slots.default;
    var __VLS_107;
    var __VLS_99;
    var __VLS_87;
}
var __VLS_67;
var __VLS_3;
const __VLS_108 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.editVisible),
    header: "编辑需求",
    width: "500px",
}));
const __VLS_110 = __VLS_109({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.editVisible),
    header: "编辑需求",
    width: "500px",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
let __VLS_112;
let __VLS_113;
let __VLS_114;
const __VLS_115 = {
    onConfirm: (__VLS_ctx.onSaveEdit)
};
__VLS_111.slots.default;
const __VLS_116 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    data: (__VLS_ctx.editForm),
    labelWidth: "100px",
}));
const __VLS_118 = __VLS_117({
    data: (__VLS_ctx.editForm),
    labelWidth: "100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
__VLS_119.slots.default;
const __VLS_120 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    label: "分配业务员",
}));
const __VLS_122 = __VLS_121({
    label: "分配业务员",
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
const __VLS_124 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    modelValue: (__VLS_ctx.editForm.agent_wechat),
    placeholder: "业务员微信号",
}));
const __VLS_126 = __VLS_125({
    modelValue: (__VLS_ctx.editForm.agent_wechat),
    placeholder: "业务员微信号",
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
var __VLS_123;
const __VLS_128 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    label: "状态",
}));
const __VLS_130 = __VLS_129({
    label: "状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
const __VLS_132 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    modelValue: (__VLS_ctx.editForm.status),
}));
const __VLS_134 = __VLS_133({
    modelValue: (__VLS_ctx.editForm.status),
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
const __VLS_136 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    value: "待处理",
    label: "待处理",
}));
const __VLS_138 = __VLS_137({
    value: "待处理",
    label: "待处理",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
const __VLS_140 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    value: "已分配",
    label: "已分配",
}));
const __VLS_142 = __VLS_141({
    value: "已分配",
    label: "已分配",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
const __VLS_144 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    value: "已完成",
    label: "已完成",
}));
const __VLS_146 = __VLS_145({
    value: "已完成",
    label: "已完成",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
var __VLS_135;
var __VLS_131;
const __VLS_148 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    label: "备注",
}));
const __VLS_150 = __VLS_149({
    label: "备注",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
__VLS_151.slots.default;
const __VLS_152 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    modelValue: (__VLS_ctx.editForm.remark),
}));
const __VLS_154 = __VLS_153({
    modelValue: (__VLS_ctx.editForm.remark),
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
var __VLS_151;
var __VLS_119;
var __VLS_111;
const __VLS_156 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.createVisible),
    header: "新增需求",
    width: "500px",
}));
const __VLS_158 = __VLS_157({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.createVisible),
    header: "新增需求",
    width: "500px",
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
let __VLS_160;
let __VLS_161;
let __VLS_162;
const __VLS_163 = {
    onConfirm: (__VLS_ctx.onSaveCreate)
};
__VLS_159.slots.default;
const __VLS_164 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    data: (__VLS_ctx.createForm),
    labelWidth: "100px",
}));
const __VLS_166 = __VLS_165({
    data: (__VLS_ctx.createForm),
    labelWidth: "100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
__VLS_167.slots.default;
const __VLS_168 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    label: "姓名",
}));
const __VLS_170 = __VLS_169({
    label: "姓名",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
__VLS_171.slots.default;
const __VLS_172 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    modelValue: (__VLS_ctx.createForm.name),
}));
const __VLS_174 = __VLS_173({
    modelValue: (__VLS_ctx.createForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
var __VLS_171;
const __VLS_176 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    label: "手机号",
}));
const __VLS_178 = __VLS_177({
    label: "手机号",
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
__VLS_179.slots.default;
const __VLS_180 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    modelValue: (__VLS_ctx.createForm.phone),
}));
const __VLS_182 = __VLS_181({
    modelValue: (__VLS_ctx.createForm.phone),
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
var __VLS_179;
const __VLS_184 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    label: "城市",
}));
const __VLS_186 = __VLS_185({
    label: "城市",
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
const __VLS_188 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    modelValue: (__VLS_ctx.createForm.city),
    placeholder: "默认上海",
}));
const __VLS_190 = __VLS_189({
    modelValue: (__VLS_ctx.createForm.city),
    placeholder: "默认上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
var __VLS_187;
const __VLS_192 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    label: "购房用途",
}));
const __VLS_194 = __VLS_193({
    label: "购房用途",
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
__VLS_195.slots.default;
const __VLS_196 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    modelValue: (__VLS_ctx.createForm.purpose),
}));
const __VLS_198 = __VLS_197({
    modelValue: (__VLS_ctx.createForm.purpose),
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
__VLS_199.slots.default;
const __VLS_200 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    value: "自住",
    label: "自住",
}));
const __VLS_202 = __VLS_201({
    value: "自住",
    label: "自住",
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
const __VLS_204 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    value: "投资",
    label: "投资",
}));
const __VLS_206 = __VLS_205({
    value: "投资",
    label: "投资",
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
const __VLS_208 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    value: "自住+投资",
    label: "自住+投资",
}));
const __VLS_210 = __VLS_209({
    value: "自住+投资",
    label: "自住+投资",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
var __VLS_199;
var __VLS_195;
const __VLS_212 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    label: "预算",
}));
const __VLS_214 = __VLS_213({
    label: "预算",
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
__VLS_215.slots.default;
const __VLS_216 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    modelValue: (__VLS_ctx.createForm.budget),
    placeholder: "如：300-500万",
}));
const __VLS_218 = __VLS_217({
    modelValue: (__VLS_ctx.createForm.budget),
    placeholder: "如：300-500万",
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
var __VLS_215;
const __VLS_220 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    label: "意向区域",
}));
const __VLS_222 = __VLS_221({
    label: "意向区域",
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
__VLS_223.slots.default;
const __VLS_224 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    modelValue: (__VLS_ctx.createForm.target_district),
    placeholder: "如：浦东新区",
}));
const __VLS_226 = __VLS_225({
    modelValue: (__VLS_ctx.createForm.target_district),
    placeholder: "如：浦东新区",
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
var __VLS_223;
var __VLS_167;
var __VLS_159;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['search-bar']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            list: list,
            filters: filters,
            pagination: pagination,
            columns: columns,
            editVisible: editVisible,
            editForm: editForm,
            createVisible: createVisible,
            createForm: createForm,
            loadData: loadData,
            onSearch: onSearch,
            onPageChange: onPageChange,
            onEdit: onEdit,
            onSaveEdit: onSaveEdit,
            onCreate: onCreate,
            onSaveCreate: onSaveCreate,
            onDelete: onDelete,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
