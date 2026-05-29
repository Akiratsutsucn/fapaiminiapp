/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { listCommunities, createCommunity, updateCommunity, deleteCommunity, batchImportCommunities } from '@/api/communities';
const loading = ref(false);
const list = ref([]);
const filters = reactive({ keyword: '', city_id: null });
const columns = [
    { colKey: 'id', title: 'ID', width: 60 },
    { colKey: 'name', title: '小区名称', ellipsis: true, width: 180 },
    { colKey: 'district', title: '区域', width: 100 },
    { colKey: 'sub_district', title: '板块', width: 90 },
    { colKey: 'avg_price', title: '参考均价', width: 120 },
    { colKey: 'price_update_at', title: '价格更新', width: 110 },
    { colKey: 'source', title: '来源', width: 80 },
    { colKey: 'op', title: '操作', width: 130 },
];
const formVisible = ref(false);
const isEdit = ref(false);
const formData = reactive({
    id: 0, name: '', district: '', sub_district: '', city_id: 310000,
    avg_price: undefined,
    build_year_start: undefined,
    build_year_end: undefined,
    property_type: '', total_buildings: undefined,
    total_units: undefined, developer: '',
    source: '', remark: '',
});
const importVisible = ref(false);
const importText = ref('');
onMounted(() => loadData());
async function loadData() {
    loading.value = true;
    try {
        const params = {};
        if (filters.keyword)
            params.keyword = filters.keyword;
        if (filters.city_id)
            params.city_id = filters.city_id;
        const data = await listCommunities(params);
        list.value = Array.isArray(data) ? data : (data.items || []);
    }
    finally {
        loading.value = false;
    }
}
function onSearch() { loadData(); }
function onPageChange(_p) { }
function onAdd() {
    isEdit.value = false;
    Object.assign(formData, {
        id: 0, name: '', district: '', sub_district: '', city_id: 310000,
        avg_price: undefined, build_year_start: undefined, build_year_end: undefined,
        property_type: '', total_buildings: undefined, total_units: undefined,
        developer: '', source: '', remark: '',
    });
    formVisible.value = true;
}
function onEdit(row) {
    isEdit.value = true;
    Object.assign(formData, {
        id: row.id, name: row.name, district: row.district || '',
        sub_district: row.sub_district || '', city_id: row.city_id || 310000,
        avg_price: row.avg_price, build_year_start: row.build_year_start,
        build_year_end: row.build_year_end,
        property_type: row.property_type || '',
        total_buildings: row.total_buildings, total_units: row.total_units,
        developer: row.developer || '', source: row.source || '',
        remark: row.remark || '',
    });
    formVisible.value = true;
}
async function onSave() {
    const payload = { ...formData };
    delete payload.id;
    // Clean empty optional fields
    Object.keys(payload).forEach(k => {
        if (payload[k] === '' || payload[k] === undefined)
            delete payload[k];
    });
    try {
        if (isEdit.value) {
            await updateCommunity(formData.id, payload);
        }
        else {
            if (!formData.name) {
                MessagePlugin.warning('请填写小区名称');
                return;
            }
            await createCommunity(payload);
        }
        MessagePlugin.success('保存成功');
        formVisible.value = false;
        loadData();
    }
    catch (e) {
        const msg = e?.response?.data?.detail || '保存失败';
        MessagePlugin.error(msg);
    }
}
async function onDelete(id) {
    await deleteCommunity(id);
    MessagePlugin.success('已删除');
    loadData();
}
function onBatchImport() { importText.value = ''; importVisible.value = true; }
async function onImportSubmit() {
    if (!importText.value.trim()) {
        MessagePlugin.warning('请粘贴数据');
        return;
    }
    const lines = importText.value.trim().split('\n').filter(l => l.trim());
    const communities = [];
    for (const line of lines) {
        try {
            communities.push(JSON.parse(line.trim()));
        }
        catch {
            MessagePlugin.error(`JSON 解析失败: ${line.substring(0, 50)}`);
            return;
        }
    }
    try {
        const data = await batchImportCommunities(communities);
        MessagePlugin.success(data.message || `导入完成：新增 ${data.added}，跳过 ${data.skipped}`);
        importVisible.value = false;
        loadData();
    }
    catch (e) {
        MessagePlugin.error(e?.response?.data?.detail || '导入失败');
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
    modelValue: (__VLS_ctx.filters.keyword),
    placeholder: "搜索小区名称",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_6 = __VLS_5({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.keyword),
    placeholder: "搜索小区名称",
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
    modelValue: (__VLS_ctx.filters.city_id),
    placeholder: "城市",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_14 = __VLS_13({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.city_id),
    placeholder: "城市",
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
    value: (310000),
    label: "上海",
}));
const __VLS_22 = __VLS_21({
    value: (310000),
    label: "上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_24 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    value: (330200),
    label: "宁波",
}));
const __VLS_26 = __VLS_25({
    value: (330200),
    label: "宁波",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
var __VLS_15;
const __VLS_28 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_30 = __VLS_29({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_32;
let __VLS_33;
let __VLS_34;
const __VLS_35 = {
    onClick: (__VLS_ctx.onSearch)
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
    onClick: (__VLS_ctx.onAdd)
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
    onClick: (__VLS_ctx.onBatchImport)
};
__VLS_47.slots.default;
var __VLS_47;
const __VLS_52 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.columns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
}));
const __VLS_54 = __VLS_53({
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.columns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_56;
let __VLS_57;
let __VLS_58;
const __VLS_59 = {
    onPageChange: (__VLS_ctx.onPageChange)
};
__VLS_55.slots.default;
{
    const { avg_price: __VLS_thisSlot } = __VLS_55.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    if (row.avg_price) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        ((row.avg_price / 10000).toFixed(2));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "no-data" },
        });
    }
}
{
    const { price_update_at: __VLS_thisSlot } = __VLS_55.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (row.price_update_at || '--');
}
{
    const { op: __VLS_thisSlot } = __VLS_55.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_60 = {}.TSpace;
    /** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({}));
    const __VLS_62 = __VLS_61({}, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_63.slots.default;
    const __VLS_64 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
    }));
    const __VLS_66 = __VLS_65({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    let __VLS_68;
    let __VLS_69;
    let __VLS_70;
    const __VLS_71 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onEdit(row);
        }
    };
    __VLS_67.slots.default;
    var __VLS_67;
    const __VLS_72 = {}.TPopconfirm;
    /** @type {[typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        ...{ 'onConfirm': {} },
        content: "确定删除？",
    }));
    const __VLS_74 = __VLS_73({
        ...{ 'onConfirm': {} },
        content: "确定删除？",
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    let __VLS_76;
    let __VLS_77;
    let __VLS_78;
    const __VLS_79 = {
        onConfirm: (...[$event]) => {
            __VLS_ctx.onDelete(row.id);
        }
    };
    __VLS_75.slots.default;
    const __VLS_80 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        variant: "text",
        size: "small",
        theme: "danger",
    }));
    const __VLS_82 = __VLS_81({
        variant: "text",
        size: "small",
        theme: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    __VLS_83.slots.default;
    var __VLS_83;
    var __VLS_75;
    var __VLS_63;
}
var __VLS_55;
var __VLS_3;
const __VLS_84 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.formVisible),
    header: (__VLS_ctx.isEdit ? '编辑小区' : '添加小区'),
    width: "620px",
}));
const __VLS_86 = __VLS_85({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.formVisible),
    header: (__VLS_ctx.isEdit ? '编辑小区' : '添加小区'),
    width: "620px",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
let __VLS_88;
let __VLS_89;
let __VLS_90;
const __VLS_91 = {
    onConfirm: (__VLS_ctx.onSave)
};
__VLS_87.slots.default;
const __VLS_92 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    data: (__VLS_ctx.formData),
    labelWidth: "100px",
}));
const __VLS_94 = __VLS_93({
    data: (__VLS_ctx.formData),
    labelWidth: "100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
const __VLS_96 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    label: "小区名称",
}));
const __VLS_98 = __VLS_97({
    label: "小区名称",
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
__VLS_99.slots.default;
const __VLS_100 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    modelValue: (__VLS_ctx.formData.name),
}));
const __VLS_102 = __VLS_101({
    modelValue: (__VLS_ctx.formData.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
var __VLS_99;
const __VLS_104 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    label: "区域",
}));
const __VLS_106 = __VLS_105({
    label: "区域",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_107.slots.default;
const __VLS_108 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    modelValue: (__VLS_ctx.formData.district),
    placeholder: "如：浦东新区",
}));
const __VLS_110 = __VLS_109({
    modelValue: (__VLS_ctx.formData.district),
    placeholder: "如：浦东新区",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
var __VLS_107;
const __VLS_112 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    label: "板块",
}));
const __VLS_114 = __VLS_113({
    label: "板块",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
const __VLS_116 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    modelValue: (__VLS_ctx.formData.sub_district),
    placeholder: "如：陆家嘴",
}));
const __VLS_118 = __VLS_117({
    modelValue: (__VLS_ctx.formData.sub_district),
    placeholder: "如：陆家嘴",
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
var __VLS_115;
const __VLS_120 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    label: "城市",
}));
const __VLS_122 = __VLS_121({
    label: "城市",
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
const __VLS_124 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    modelValue: (__VLS_ctx.formData.city_id),
}));
const __VLS_126 = __VLS_125({
    modelValue: (__VLS_ctx.formData.city_id),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
__VLS_127.slots.default;
const __VLS_128 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    value: (310000),
    label: "上海",
}));
const __VLS_130 = __VLS_129({
    value: (310000),
    label: "上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
const __VLS_132 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    value: (330200),
    label: "宁波",
}));
const __VLS_134 = __VLS_133({
    value: (330200),
    label: "宁波",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
var __VLS_127;
var __VLS_123;
const __VLS_136 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    label: "均价（元/㎡）",
}));
const __VLS_138 = __VLS_137({
    label: "均价（元/㎡）",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
const __VLS_140 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    modelValue: (__VLS_ctx.formData.avg_price),
    min: (0),
    placeholder: "如：85000",
}));
const __VLS_142 = __VLS_141({
    modelValue: (__VLS_ctx.formData.avg_price),
    min: (0),
    placeholder: "如：85000",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
var __VLS_139;
const __VLS_144 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    label: "建成年份",
}));
const __VLS_146 = __VLS_145({
    label: "建成年份",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
__VLS_147.slots.default;
const __VLS_148 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    modelValue: (__VLS_ctx.formData.build_year_start),
    min: (1980),
    max: (2030),
    placeholder: "起",
    ...{ style: {} },
}));
const __VLS_150 = __VLS_149({
    modelValue: (__VLS_ctx.formData.build_year_start),
    min: (1980),
    max: (2030),
    placeholder: "起",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ style: {} },
});
const __VLS_152 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    modelValue: (__VLS_ctx.formData.build_year_end),
    min: (1980),
    max: (2030),
    placeholder: "止",
    ...{ style: {} },
}));
const __VLS_154 = __VLS_153({
    modelValue: (__VLS_ctx.formData.build_year_end),
    min: (1980),
    max: (2030),
    placeholder: "止",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
var __VLS_147;
const __VLS_156 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    label: "物业类型",
}));
const __VLS_158 = __VLS_157({
    label: "物业类型",
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
__VLS_159.slots.default;
const __VLS_160 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    modelValue: (__VLS_ctx.formData.property_type),
    placeholder: "住宅/商业/工业",
}));
const __VLS_162 = __VLS_161({
    modelValue: (__VLS_ctx.formData.property_type),
    placeholder: "住宅/商业/工业",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
var __VLS_159;
const __VLS_164 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    label: "总栋数",
}));
const __VLS_166 = __VLS_165({
    label: "总栋数",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
__VLS_167.slots.default;
const __VLS_168 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    modelValue: (__VLS_ctx.formData.total_buildings),
    min: (0),
}));
const __VLS_170 = __VLS_169({
    modelValue: (__VLS_ctx.formData.total_buildings),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
var __VLS_167;
const __VLS_172 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    label: "总户数",
}));
const __VLS_174 = __VLS_173({
    label: "总户数",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
__VLS_175.slots.default;
const __VLS_176 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    modelValue: (__VLS_ctx.formData.total_units),
    min: (0),
}));
const __VLS_178 = __VLS_177({
    modelValue: (__VLS_ctx.formData.total_units),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
var __VLS_175;
const __VLS_180 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    label: "开发商",
}));
const __VLS_182 = __VLS_181({
    label: "开发商",
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
__VLS_183.slots.default;
const __VLS_184 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    modelValue: (__VLS_ctx.formData.developer),
}));
const __VLS_186 = __VLS_185({
    modelValue: (__VLS_ctx.formData.developer),
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
var __VLS_183;
const __VLS_188 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    label: "数据来源",
}));
const __VLS_190 = __VLS_189({
    label: "数据来源",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
__VLS_191.slots.default;
const __VLS_192 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    modelValue: (__VLS_ctx.formData.source),
    placeholder: "manual/beike/anjuke",
}));
const __VLS_194 = __VLS_193({
    modelValue: (__VLS_ctx.formData.source),
    placeholder: "manual/beike/anjuke",
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
var __VLS_191;
const __VLS_196 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    label: "备注",
}));
const __VLS_198 = __VLS_197({
    label: "备注",
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
__VLS_199.slots.default;
const __VLS_200 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    modelValue: (__VLS_ctx.formData.remark),
}));
const __VLS_202 = __VLS_201({
    modelValue: (__VLS_ctx.formData.remark),
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
var __VLS_199;
var __VLS_95;
var __VLS_87;
const __VLS_204 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.importVisible),
    header: "批量导入小区",
    width: "560px",
}));
const __VLS_206 = __VLS_205({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.importVisible),
    header: "批量导入小区",
    width: "560px",
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
let __VLS_208;
let __VLS_209;
let __VLS_210;
const __VLS_211 = {
    onConfirm: (__VLS_ctx.onImportSubmit)
};
__VLS_207.slots.default;
const __VLS_212 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    labelWidth: "80px",
}));
const __VLS_214 = __VLS_213({
    labelWidth: "80px",
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
__VLS_215.slots.default;
const __VLS_216 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    label: "导入格式",
}));
const __VLS_218 = __VLS_217({
    label: "导入格式",
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
__VLS_219.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.br)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.br)({});
var __VLS_219;
const __VLS_220 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    label: "数据",
}));
const __VLS_222 = __VLS_221({
    label: "数据",
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
__VLS_223.slots.default;
const __VLS_224 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    modelValue: (__VLS_ctx.importText),
    autosize: ({ minRows: 8, maxRows: 16 }),
    placeholder: '{"name":"万科城市花园","avg_price":65000}',
}));
const __VLS_226 = __VLS_225({
    modelValue: (__VLS_ctx.importText),
    autosize: ({ minRows: 8, maxRows: 16 }),
    placeholder: '{"name":"万科城市花园","avg_price":65000}',
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
var __VLS_223;
var __VLS_215;
var __VLS_207;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['search-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['no-data']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            list: list,
            filters: filters,
            columns: columns,
            formVisible: formVisible,
            isEdit: isEdit,
            formData: formData,
            importVisible: importVisible,
            importText: importText,
            onSearch: onSearch,
            onPageChange: onPageChange,
            onAdd: onAdd,
            onEdit: onEdit,
            onSave: onSave,
            onDelete: onDelete,
            onBatchImport: onBatchImport,
            onImportSubmit: onImportSubmit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
