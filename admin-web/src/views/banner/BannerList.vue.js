/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { listBanners, createBanner, updateBanner, deleteBanner } from '@/api/banners';
const loading = ref(false);
const list = ref([]);
const columns = [
    { colKey: 'id', title: 'ID', width: 70 },
    { colKey: 'image_url', title: '图片', width: 140 },
    { colKey: 'title', title: '标题', width: 150 },
    { colKey: 'category', title: '分类', width: 100 },
    { colKey: 'city_id', title: '城市', width: 80 },
    { colKey: 'sort_order', title: '排序', width: 70 },
    { colKey: 'is_active', title: '状态', width: 80 },
    { colKey: 'op', title: '操作', width: 130 },
];
const formVisible = ref(false);
const isEdit = ref(false);
const formData = reactive({ id: 0, title: '', image_url: '', category: '', link_url: '', article_id: 0, city_id: 310000, sort_order: 0, is_active: true });
const CITY_MAP = { 0: '全部', 310000: '上海', 330200: '宁波', 330100: '杭州' };
function cityLabel(id) { return CITY_MAP[id] ?? '上海'; }
onMounted(() => loadData());
async function loadData() {
    loading.value = true;
    try {
        const data = await listBanners();
        list.value = data;
    }
    finally {
        loading.value = false;
    }
}
function onAdd() { isEdit.value = false; Object.assign(formData, { id: 0, title: '', image_url: '', category: '', link_url: '', article_id: 0, city_id: 310000, sort_order: 0, is_active: true }); formVisible.value = true; }
function onEdit(row) { isEdit.value = true; Object.assign(formData, { article_id: 0, ...row }); formVisible.value = true; }
async function onSave() {
    const payload = { ...formData };
    delete payload.id;
    try {
        if (isEdit.value)
            await updateBanner(formData.id, payload);
        else
            await createBanner(payload);
        MessagePlugin.success('保存成功');
        formVisible.value = false;
        loadData();
    }
    catch { /* skip */ }
}
async function onDelete(id) {
    await deleteBanner(id);
    MessagePlugin.success('已删除');
    loadData();
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
const __VLS_4 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_6 = __VLS_5({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
let __VLS_8;
let __VLS_9;
let __VLS_10;
const __VLS_11 = {
    onClick: (__VLS_ctx.onAdd)
};
__VLS_7.slots.default;
var __VLS_7;
const __VLS_12 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.columns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
}));
const __VLS_14 = __VLS_13({
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.columns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
{
    const { image_url: __VLS_thisSlot } = __VLS_15.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    if (row.image_url) {
        const __VLS_16 = {}.TImage;
        /** @type {[typeof __VLS_components.TImage, typeof __VLS_components.tImage, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            src: (row.image_url),
            fit: "cover",
            ...{ style: {} },
        }));
        const __VLS_18 = __VLS_17({
            src: (row.image_url),
            fit: "cover",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    }
}
{
    const { is_active: __VLS_thisSlot } = __VLS_15.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_20 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        theme: (row.is_active ? 'success' : 'default'),
    }));
    const __VLS_22 = __VLS_21({
        theme: (row.is_active ? 'success' : 'default'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_23.slots.default;
    (row.is_active ? '启用' : '停用');
    var __VLS_23;
}
{
    const { city_id: __VLS_thisSlot } = __VLS_15.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (__VLS_ctx.cityLabel(row.city_id));
}
{
    const { op: __VLS_thisSlot } = __VLS_15.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_24 = {}.TSpace;
    /** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({}));
    const __VLS_26 = __VLS_25({}, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_27.slots.default;
    const __VLS_28 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
    }));
    const __VLS_30 = __VLS_29({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    let __VLS_32;
    let __VLS_33;
    let __VLS_34;
    const __VLS_35 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onEdit(row);
        }
    };
    __VLS_31.slots.default;
    var __VLS_31;
    const __VLS_36 = {}.TPopconfirm;
    /** @type {[typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        ...{ 'onConfirm': {} },
        content: "确定删除？",
    }));
    const __VLS_38 = __VLS_37({
        ...{ 'onConfirm': {} },
        content: "确定删除？",
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    let __VLS_40;
    let __VLS_41;
    let __VLS_42;
    const __VLS_43 = {
        onConfirm: (...[$event]) => {
            __VLS_ctx.onDelete(row.id);
        }
    };
    __VLS_39.slots.default;
    const __VLS_44 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        variant: "text",
        size: "small",
        theme: "danger",
    }));
    const __VLS_46 = __VLS_45({
        variant: "text",
        size: "small",
        theme: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    __VLS_47.slots.default;
    var __VLS_47;
    var __VLS_39;
    var __VLS_27;
}
var __VLS_15;
var __VLS_3;
const __VLS_48 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.formVisible),
    header: (__VLS_ctx.isEdit ? '编辑横幅' : '添加横幅'),
    width: "500px",
}));
const __VLS_50 = __VLS_49({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.formVisible),
    header: (__VLS_ctx.isEdit ? '编辑横幅' : '添加横幅'),
    width: "500px",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
let __VLS_52;
let __VLS_53;
let __VLS_54;
const __VLS_55 = {
    onConfirm: (__VLS_ctx.onSave)
};
__VLS_51.slots.default;
const __VLS_56 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    data: (__VLS_ctx.formData),
    labelWidth: "80px",
}));
const __VLS_58 = __VLS_57({
    data: (__VLS_ctx.formData),
    labelWidth: "80px",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
const __VLS_60 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    label: "标题",
}));
const __VLS_62 = __VLS_61({
    label: "标题",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
const __VLS_64 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    modelValue: (__VLS_ctx.formData.title),
}));
const __VLS_66 = __VLS_65({
    modelValue: (__VLS_ctx.formData.title),
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
var __VLS_63;
const __VLS_68 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    label: "图片URL",
}));
const __VLS_70 = __VLS_69({
    label: "图片URL",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
const __VLS_72 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    modelValue: (__VLS_ctx.formData.image_url),
}));
const __VLS_74 = __VLS_73({
    modelValue: (__VLS_ctx.formData.image_url),
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
var __VLS_71;
const __VLS_76 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    label: "分类",
}));
const __VLS_78 = __VLS_77({
    label: "分类",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
__VLS_79.slots.default;
const __VLS_80 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    modelValue: (__VLS_ctx.formData.category),
}));
const __VLS_82 = __VLS_81({
    modelValue: (__VLS_ctx.formData.category),
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
var __VLS_79;
const __VLS_84 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    label: "关联文章ID",
}));
const __VLS_86 = __VLS_85({
    label: "关联文章ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
const __VLS_88 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    modelValue: (__VLS_ctx.formData.article_id),
    min: (0),
    placeholder: "填写文章ID，点击横幅直接进该文章",
}));
const __VLS_90 = __VLS_89({
    modelValue: (__VLS_ctx.formData.article_id),
    min: (0),
    placeholder: "填写文章ID，点击横幅直接进该文章",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ style: {} },
});
var __VLS_87;
const __VLS_92 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    label: "链接",
}));
const __VLS_94 = __VLS_93({
    label: "链接",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
const __VLS_96 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    modelValue: (__VLS_ctx.formData.link_url),
    placeholder: "无关联文章时用：站内路径或外部链接",
}));
const __VLS_98 = __VLS_97({
    modelValue: (__VLS_ctx.formData.link_url),
    placeholder: "无关联文章时用：站内路径或外部链接",
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
var __VLS_95;
const __VLS_100 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    label: "城市",
}));
const __VLS_102 = __VLS_101({
    label: "城市",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
__VLS_103.slots.default;
const __VLS_104 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    modelValue: (__VLS_ctx.formData.city_id),
}));
const __VLS_106 = __VLS_105({
    modelValue: (__VLS_ctx.formData.city_id),
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_107.slots.default;
const __VLS_108 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    value: (0),
    label: "全部",
}));
const __VLS_110 = __VLS_109({
    value: (0),
    label: "全部",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
const __VLS_112 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    value: (310000),
    label: "上海",
}));
const __VLS_114 = __VLS_113({
    value: (310000),
    label: "上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
const __VLS_116 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    value: (330200),
    label: "宁波",
}));
const __VLS_118 = __VLS_117({
    value: (330200),
    label: "宁波",
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
const __VLS_120 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    value: (330100),
    label: "杭州",
}));
const __VLS_122 = __VLS_121({
    value: (330100),
    label: "杭州",
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
var __VLS_107;
var __VLS_103;
const __VLS_124 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    label: "排序",
}));
const __VLS_126 = __VLS_125({
    label: "排序",
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
__VLS_127.slots.default;
const __VLS_128 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    modelValue: (__VLS_ctx.formData.sort_order),
    min: (0),
}));
const __VLS_130 = __VLS_129({
    modelValue: (__VLS_ctx.formData.sort_order),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
var __VLS_127;
const __VLS_132 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    label: "启用",
}));
const __VLS_134 = __VLS_133({
    label: "启用",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
const __VLS_136 = {}.TSwitch;
/** @type {[typeof __VLS_components.TSwitch, typeof __VLS_components.tSwitch, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    modelValue: (__VLS_ctx.formData.is_active),
}));
const __VLS_138 = __VLS_137({
    modelValue: (__VLS_ctx.formData.is_active),
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
var __VLS_135;
var __VLS_59;
var __VLS_51;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['search-bar']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            list: list,
            columns: columns,
            formVisible: formVisible,
            isEdit: isEdit,
            formData: formData,
            cityLabel: cityLabel,
            onAdd: onAdd,
            onEdit: onEdit,
            onSave: onSave,
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
