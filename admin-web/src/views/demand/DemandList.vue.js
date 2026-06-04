/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, onMounted, computed } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { listDemands, createDemand, updateDemand, deleteDemand, recommendProperty, listAssignableUsers } from '@/api/demands';
import { listProperties } from '@/api/properties';
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
    { colKey: 'assigned_name', title: '对接人', width: 120 },
    { colKey: 'status', title: '状态', width: 80 },
    { colKey: 'created_at', title: '提交时间', width: 160 },
    { colKey: 'op', title: '操作', width: 220 },
];
const editVisible = ref(false);
const editForm = reactive({ id: 0, assigned_user_id: undefined, status: '待处理', remark: '' });
// 可分配对接人
const assignableUsers = ref([]);
const salespersons = computed(() => assignableUsers.value.filter((u) => u.role === 'salesperson'));
const agents = computed(() => assignableUsers.value.filter((u) => u.role === 'agent'));
const createVisible = ref(false);
const createForm = reactive({ name: '', phone: '', city: '上海', purpose: '自住', budget: '', target_district: '' });
// 推荐房源
const recVisible = ref(false);
const recommending = ref(false);
const recLoading = ref(false);
const recTarget = ref(null);
const recKeyword = ref('');
const recCity = ref(0);
const recProps = ref([]);
const recSelected = ref(null);
const recMessage = ref('');
const recCols = [
    { colKey: 'pick', title: '', width: 50 },
    { colKey: 'title', title: '房源标题', ellipsis: true },
    { colKey: 'district', title: '区域', width: 90 },
    { colKey: 'area', title: '面积㎡', width: 80 },
    { colKey: 'starting_price', title: '起拍价', width: 90 },
    { colKey: 'auction_status', title: '状态', width: 90 },
];
onMounted(() => {
    loadData();
    loadAssignableUsers();
});
async function loadAssignableUsers() {
    try {
        assignableUsers.value = await listAssignableUsers() || [];
    }
    catch {
        assignableUsers.value = [];
    }
}
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
    Object.assign(editForm, {
        id: row.id,
        assigned_user_id: row.assigned_user_id || undefined,
        status: row.status,
        remark: row.remark || '',
    });
    editVisible.value = true;
}
async function onSaveEdit() {
    try {
        const payload = { status: editForm.status, remark: editForm.remark };
        if (editForm.assigned_user_id) {
            const u = assignableUsers.value.find((x) => x.id === editForm.assigned_user_id);
            payload.assigned_user_id = editForm.assigned_user_id;
            payload.assigned_role = u?.role || '';
            payload.assigned_name = u ? `${u.name}（${u.role_label}）` : '';
        }
        else {
            payload.assigned_user_id = null;
            payload.assigned_name = '';
            payload.assigned_role = '';
        }
        await updateDemand(editForm.id, payload);
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
function onRecommend(row) {
    if (!row.user_id) {
        MessagePlugin.warning('该需求未关联小程序用户，无法定向推荐');
        return;
    }
    recTarget.value = row;
    recSelected.value = null;
    recMessage.value = '';
    recKeyword.value = row.target_district || '';
    recCity.value = row.city === '宁波' ? 330200 : row.city === '杭州' ? 330100 : 310000;
    recVisible.value = true;
    loadRecProps();
}
async function loadRecProps() {
    recLoading.value = true;
    try {
        const params = { page: 1, page_size: 100 };
        if (recKeyword.value)
            params.keyword = recKeyword.value;
        if (recCity.value)
            params.city_id = recCity.value;
        const data = await listProperties(params);
        // 只允许推荐「即将开拍」或「进行中」的房源，过滤掉已结束/已成交/已撤回等
        const RECOMMENDABLE = ['即将开拍', '进行中'];
        recProps.value = (data.items || []).filter((p) => RECOMMENDABLE.includes(p.auction_status)).slice(0, 30);
        if (recSelected.value && !recProps.value.some((p) => p.id === recSelected.value.id)) {
            recSelected.value = null;
        }
    }
    catch {
        recProps.value = [];
    }
    finally {
        recLoading.value = false;
    }
}
async function onConfirmRecommend() {
    if (!recSelected.value) {
        MessagePlugin.warning('请先选择一套房源');
        return;
    }
    recommending.value = true;
    try {
        const res = await recommendProperty({
            user_id: recTarget.value.user_id,
            property_id: recSelected.value.id,
            message: recMessage.value || undefined,
            demand_id: recTarget.value.id,
        });
        MessagePlugin.success(res.message || '推荐成功');
        recVisible.value = false;
    }
    catch (e) {
        MessagePlugin.error(e?.response?.data?.detail || '推荐失败');
    }
    finally {
        recommending.value = false;
    }
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
    const __VLS_96 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
        theme: "primary",
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
        theme: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_100;
    let __VLS_101;
    let __VLS_102;
    const __VLS_103 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onRecommend(row);
        }
    };
    __VLS_99.slots.default;
    var __VLS_99;
    const __VLS_104 = {}.TPopconfirm;
    /** @type {[typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        ...{ 'onConfirm': {} },
        content: "确定删除该需求？",
    }));
    const __VLS_106 = __VLS_105({
        ...{ 'onConfirm': {} },
        content: "确定删除该需求？",
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    let __VLS_108;
    let __VLS_109;
    let __VLS_110;
    const __VLS_111 = {
        onConfirm: (...[$event]) => {
            __VLS_ctx.onDelete(row);
        }
    };
    __VLS_107.slots.default;
    const __VLS_112 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
        variant: "text",
        size: "small",
        theme: "danger",
    }));
    const __VLS_114 = __VLS_113({
        variant: "text",
        size: "small",
        theme: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_113));
    __VLS_115.slots.default;
    var __VLS_115;
    var __VLS_107;
    var __VLS_87;
}
var __VLS_67;
var __VLS_3;
const __VLS_116 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.editVisible),
    header: "处理需求",
    width: "500px",
}));
const __VLS_118 = __VLS_117({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.editVisible),
    header: "处理需求",
    width: "500px",
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
let __VLS_120;
let __VLS_121;
let __VLS_122;
const __VLS_123 = {
    onConfirm: (__VLS_ctx.onSaveEdit)
};
__VLS_119.slots.default;
const __VLS_124 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    data: (__VLS_ctx.editForm),
    labelWidth: "100px",
}));
const __VLS_126 = __VLS_125({
    data: (__VLS_ctx.editForm),
    labelWidth: "100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
__VLS_127.slots.default;
const __VLS_128 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    label: "分配对接人",
}));
const __VLS_130 = __VLS_129({
    label: "分配对接人",
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
const __VLS_132 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    modelValue: (__VLS_ctx.editForm.assigned_user_id),
    placeholder: "选择业务员或代理商",
    clearable: true,
    filterable: true,
}));
const __VLS_134 = __VLS_133({
    modelValue: (__VLS_ctx.editForm.assigned_user_id),
    placeholder: "选择业务员或代理商",
    clearable: true,
    filterable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
const __VLS_136 = {}.TOptionGroup;
/** @type {[typeof __VLS_components.TOptionGroup, typeof __VLS_components.tOptionGroup, typeof __VLS_components.TOptionGroup, typeof __VLS_components.tOptionGroup, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    label: "业务员（本公司）",
}));
const __VLS_138 = __VLS_137({
    label: "业务员（本公司）",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
for (const [u] of __VLS_getVForSourceType((__VLS_ctx.salespersons))) {
    const __VLS_140 = {}.TOption;
    /** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        key: (u.id),
        value: (u.id),
        label: (`${u.name}（${u.phone || '无手机'}）`),
    }));
    const __VLS_142 = __VLS_141({
        key: (u.id),
        value: (u.id),
        label: (`${u.name}（${u.phone || '无手机'}）`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
}
var __VLS_139;
const __VLS_144 = {}.TOptionGroup;
/** @type {[typeof __VLS_components.TOptionGroup, typeof __VLS_components.tOptionGroup, typeof __VLS_components.TOptionGroup, typeof __VLS_components.tOptionGroup, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    label: "代理商",
}));
const __VLS_146 = __VLS_145({
    label: "代理商",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
__VLS_147.slots.default;
for (const [u] of __VLS_getVForSourceType((__VLS_ctx.agents))) {
    const __VLS_148 = {}.TOption;
    /** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        key: (u.id),
        value: (u.id),
        label: (`${u.name}（${u.region || u.phone || ''}）`),
    }));
    const __VLS_150 = __VLS_149({
        key: (u.id),
        value: (u.id),
        label: (`${u.name}（${u.region || u.phone || ''}）`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
}
var __VLS_147;
var __VLS_135;
var __VLS_131;
const __VLS_152 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    label: "状态",
}));
const __VLS_154 = __VLS_153({
    label: "状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
__VLS_155.slots.default;
const __VLS_156 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    modelValue: (__VLS_ctx.editForm.status),
}));
const __VLS_158 = __VLS_157({
    modelValue: (__VLS_ctx.editForm.status),
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
__VLS_159.slots.default;
const __VLS_160 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    value: "待处理",
    label: "待处理",
}));
const __VLS_162 = __VLS_161({
    value: "待处理",
    label: "待处理",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
const __VLS_164 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    value: "已分配",
    label: "已分配",
}));
const __VLS_166 = __VLS_165({
    value: "已分配",
    label: "已分配",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
const __VLS_168 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    value: "已完成",
    label: "已完成",
}));
const __VLS_170 = __VLS_169({
    value: "已完成",
    label: "已完成",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
var __VLS_159;
var __VLS_155;
const __VLS_172 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    label: "备注",
}));
const __VLS_174 = __VLS_173({
    label: "备注",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
__VLS_175.slots.default;
const __VLS_176 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    modelValue: (__VLS_ctx.editForm.remark),
}));
const __VLS_178 = __VLS_177({
    modelValue: (__VLS_ctx.editForm.remark),
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
var __VLS_175;
var __VLS_127;
var __VLS_119;
const __VLS_180 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.createVisible),
    header: "新增需求",
    width: "500px",
}));
const __VLS_182 = __VLS_181({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.createVisible),
    header: "新增需求",
    width: "500px",
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
let __VLS_184;
let __VLS_185;
let __VLS_186;
const __VLS_187 = {
    onConfirm: (__VLS_ctx.onSaveCreate)
};
__VLS_183.slots.default;
const __VLS_188 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    data: (__VLS_ctx.createForm),
    labelWidth: "100px",
}));
const __VLS_190 = __VLS_189({
    data: (__VLS_ctx.createForm),
    labelWidth: "100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
__VLS_191.slots.default;
const __VLS_192 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    label: "姓名",
}));
const __VLS_194 = __VLS_193({
    label: "姓名",
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
__VLS_195.slots.default;
const __VLS_196 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    modelValue: (__VLS_ctx.createForm.name),
}));
const __VLS_198 = __VLS_197({
    modelValue: (__VLS_ctx.createForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
var __VLS_195;
const __VLS_200 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    label: "手机号",
}));
const __VLS_202 = __VLS_201({
    label: "手机号",
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
__VLS_203.slots.default;
const __VLS_204 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    modelValue: (__VLS_ctx.createForm.phone),
}));
const __VLS_206 = __VLS_205({
    modelValue: (__VLS_ctx.createForm.phone),
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
var __VLS_203;
const __VLS_208 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    label: "城市",
}));
const __VLS_210 = __VLS_209({
    label: "城市",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
__VLS_211.slots.default;
const __VLS_212 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    modelValue: (__VLS_ctx.createForm.city),
    placeholder: "默认上海",
}));
const __VLS_214 = __VLS_213({
    modelValue: (__VLS_ctx.createForm.city),
    placeholder: "默认上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
var __VLS_211;
const __VLS_216 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    label: "购房用途",
}));
const __VLS_218 = __VLS_217({
    label: "购房用途",
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
__VLS_219.slots.default;
const __VLS_220 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    modelValue: (__VLS_ctx.createForm.purpose),
}));
const __VLS_222 = __VLS_221({
    modelValue: (__VLS_ctx.createForm.purpose),
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
__VLS_223.slots.default;
const __VLS_224 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    value: "自住",
    label: "自住",
}));
const __VLS_226 = __VLS_225({
    value: "自住",
    label: "自住",
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
const __VLS_228 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    value: "投资",
    label: "投资",
}));
const __VLS_230 = __VLS_229({
    value: "投资",
    label: "投资",
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
const __VLS_232 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    value: "自住+投资",
    label: "自住+投资",
}));
const __VLS_234 = __VLS_233({
    value: "自住+投资",
    label: "自住+投资",
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
var __VLS_223;
var __VLS_219;
const __VLS_236 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    label: "预算",
}));
const __VLS_238 = __VLS_237({
    label: "预算",
}, ...__VLS_functionalComponentArgsRest(__VLS_237));
__VLS_239.slots.default;
const __VLS_240 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
    modelValue: (__VLS_ctx.createForm.budget),
    placeholder: "如：300-500万",
}));
const __VLS_242 = __VLS_241({
    modelValue: (__VLS_ctx.createForm.budget),
    placeholder: "如：300-500万",
}, ...__VLS_functionalComponentArgsRest(__VLS_241));
var __VLS_239;
const __VLS_244 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
    label: "意向区域",
}));
const __VLS_246 = __VLS_245({
    label: "意向区域",
}, ...__VLS_functionalComponentArgsRest(__VLS_245));
__VLS_247.slots.default;
const __VLS_248 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
    modelValue: (__VLS_ctx.createForm.target_district),
    placeholder: "如：浦东新区",
}));
const __VLS_250 = __VLS_249({
    modelValue: (__VLS_ctx.createForm.target_district),
    placeholder: "如：浦东新区",
}, ...__VLS_functionalComponentArgsRest(__VLS_249));
var __VLS_247;
var __VLS_191;
var __VLS_183;
const __VLS_252 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.recVisible),
    header: "定向推荐房源",
    width: "720px",
    confirmBtn: ({ content: '推荐给该用户', loading: __VLS_ctx.recommending }),
}));
const __VLS_254 = __VLS_253({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.recVisible),
    header: "定向推荐房源",
    width: "720px",
    confirmBtn: ({ content: '推荐给该用户', loading: __VLS_ctx.recommending }),
}, ...__VLS_functionalComponentArgsRest(__VLS_253));
let __VLS_256;
let __VLS_257;
let __VLS_258;
const __VLS_259 = {
    onConfirm: (__VLS_ctx.onConfirmRecommend)
};
__VLS_255.slots.default;
if (__VLS_ctx.recTarget) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "rec-target" },
    });
    (__VLS_ctx.recTarget.name || '用户');
    (__VLS_ctx.recTarget.phone);
    (__VLS_ctx.recTarget.target_district || '不限');
    (__VLS_ctx.recTarget.budget || '不限');
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "rec-search" },
});
const __VLS_260 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
    ...{ 'onEnter': {} },
    modelValue: (__VLS_ctx.recKeyword),
    placeholder: "搜索房源标题/小区关键词",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_262 = __VLS_261({
    ...{ 'onEnter': {} },
    modelValue: (__VLS_ctx.recKeyword),
    placeholder: "搜索房源标题/小区关键词",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_261));
let __VLS_264;
let __VLS_265;
let __VLS_266;
const __VLS_267 = {
    onEnter: (__VLS_ctx.loadRecProps)
};
var __VLS_263;
const __VLS_268 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.recCity),
    placeholder: "城市",
    ...{ style: {} },
}));
const __VLS_270 = __VLS_269({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.recCity),
    placeholder: "城市",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_269));
let __VLS_272;
let __VLS_273;
let __VLS_274;
const __VLS_275 = {
    onChange: (__VLS_ctx.loadRecProps)
};
__VLS_271.slots.default;
const __VLS_276 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
    value: (0),
    label: "全部",
}));
const __VLS_278 = __VLS_277({
    value: (0),
    label: "全部",
}, ...__VLS_functionalComponentArgsRest(__VLS_277));
const __VLS_280 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
    value: (310000),
    label: "上海",
}));
const __VLS_282 = __VLS_281({
    value: (310000),
    label: "上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_281));
const __VLS_284 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
    value: (330200),
    label: "宁波",
}));
const __VLS_286 = __VLS_285({
    value: (330200),
    label: "宁波",
}, ...__VLS_functionalComponentArgsRest(__VLS_285));
const __VLS_288 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
    value: (330100),
    label: "杭州",
}));
const __VLS_290 = __VLS_289({
    value: (330100),
    label: "杭州",
}, ...__VLS_functionalComponentArgsRest(__VLS_289));
var __VLS_271;
const __VLS_292 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_294 = __VLS_293({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_293));
let __VLS_296;
let __VLS_297;
let __VLS_298;
const __VLS_299 = {
    onClick: (__VLS_ctx.loadRecProps)
};
__VLS_295.slots.default;
var __VLS_295;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "rec-hint" },
});
const __VLS_300 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
    data: (__VLS_ctx.recProps),
    columns: (__VLS_ctx.recCols),
    rowKey: "id",
    loading: (__VLS_ctx.recLoading),
    maxHeight: "320",
    size: "small",
}));
const __VLS_302 = __VLS_301({
    data: (__VLS_ctx.recProps),
    columns: (__VLS_ctx.recCols),
    rowKey: "id",
    loading: (__VLS_ctx.recLoading),
    maxHeight: "320",
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_301));
__VLS_303.slots.default;
{
    const { pick: __VLS_thisSlot } = __VLS_303.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_304 = {}.TRadio;
    /** @type {[typeof __VLS_components.TRadio, typeof __VLS_components.tRadio, ]} */ ;
    // @ts-ignore
    const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
        ...{ 'onClick': {} },
        checked: (__VLS_ctx.recSelected && __VLS_ctx.recSelected.id === row.id),
    }));
    const __VLS_306 = __VLS_305({
        ...{ 'onClick': {} },
        checked: (__VLS_ctx.recSelected && __VLS_ctx.recSelected.id === row.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_305));
    let __VLS_308;
    let __VLS_309;
    let __VLS_310;
    const __VLS_311 = {
        onClick: (...[$event]) => {
            __VLS_ctx.recSelected = row;
        }
    };
    var __VLS_307;
}
{
    const { starting_price: __VLS_thisSlot } = __VLS_303.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (row.starting_price ? (row.starting_price / 10000).toFixed(0) + '万' : '-');
}
{
    const { auction_status: __VLS_thisSlot } = __VLS_303.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_312 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
        size: "small",
        theme: (row.auction_status === '进行中' ? 'danger' : 'primary'),
        variant: "light",
    }));
    const __VLS_314 = __VLS_313({
        size: "small",
        theme: (row.auction_status === '进行中' ? 'danger' : 'primary'),
        variant: "light",
    }, ...__VLS_functionalComponentArgsRest(__VLS_313));
    __VLS_315.slots.default;
    (row.auction_status);
    var __VLS_315;
}
var __VLS_303;
if (__VLS_ctx.recSelected) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "rec-selected" },
    });
    (__VLS_ctx.recSelected.title);
}
const __VLS_316 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
    modelValue: (__VLS_ctx.recMessage),
    placeholder: "推荐语（选填），如：该房源临近地铁，起拍价低于评估价两成，符合您的预算",
    autosize: ({ minRows: 2, maxRows: 4 }),
    ...{ style: {} },
}));
const __VLS_318 = __VLS_317({
    modelValue: (__VLS_ctx.recMessage),
    placeholder: "推荐语（选填），如：该房源临近地铁，起拍价低于评估价两成，符合您的预算",
    autosize: ({ minRows: 2, maxRows: 4 }),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_317));
var __VLS_255;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['search-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['rec-target']} */ ;
/** @type {__VLS_StyleScopedClasses['rec-search']} */ ;
/** @type {__VLS_StyleScopedClasses['rec-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['rec-selected']} */ ;
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
            salespersons: salespersons,
            agents: agents,
            createVisible: createVisible,
            createForm: createForm,
            recVisible: recVisible,
            recommending: recommending,
            recLoading: recLoading,
            recTarget: recTarget,
            recKeyword: recKeyword,
            recCity: recCity,
            recProps: recProps,
            recSelected: recSelected,
            recMessage: recMessage,
            recCols: recCols,
            loadData: loadData,
            onSearch: onSearch,
            onPageChange: onPageChange,
            onEdit: onEdit,
            onSaveEdit: onSaveEdit,
            onCreate: onCreate,
            onSaveCreate: onSaveCreate,
            onDelete: onDelete,
            onRecommend: onRecommend,
            loadRecProps: loadRecProps,
            onConfirmRecommend: onConfirmRecommend,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
