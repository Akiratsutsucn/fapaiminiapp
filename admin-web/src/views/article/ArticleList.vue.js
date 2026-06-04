/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { listArticles, createArticle, updateArticle, deleteArticle, syncArticlesFromMp, importArticleFromUrl, refetchArticleContent } from '@/api/articles';
const loading = ref(false);
const syncing = ref(false);
const refetchingId = ref(0);
const list = ref([]);
const filters = reactive({ keyword: '' });
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const columns = [
    { colKey: 'id', title: 'ID', width: 70 },
    { colKey: 'cover_image', title: '封面', width: 90 },
    { colKey: 'title', title: '标题', ellipsis: true, width: 220 },
    { colKey: 'source', title: '来源', width: 80 },
    { colKey: 'has_content', title: '正文', width: 80 },
    { colKey: 'sort_order', title: '排序', width: 70 },
    { colKey: 'is_home_show', title: '首页展示', width: 90 },
    { colKey: 'published_at', title: '发布日期', width: 120 },
    { colKey: 'op', title: '操作', width: 180 },
];
const formVisible = ref(false);
const isEdit = ref(false);
const formData = reactive({ id: 0, title: '', summary: '', content: '', cover_image: '', mp_url: '', published_at: '', is_home_show: false, sort_order: 0 });
const importVisible = ref(false);
const importing = ref(false);
const importUrls = ref('');
const importFailed = ref([]);
onMounted(() => loadData());
async function loadData() {
    loading.value = true;
    try {
        const params = { page: pagination.current, page_size: pagination.pageSize };
        if (filters.keyword)
            params.keyword = filters.keyword;
        const data = await listArticles(params);
        list.value = data.items;
        pagination.total = data.total;
    }
    finally {
        loading.value = false;
    }
}
function onSearch() { pagination.current = 1; loadData(); }
function onPageChange(p) { pagination.current = p.current; loadData(); }
function onAdd() { isEdit.value = false; Object.assign(formData, { id: 0, title: '', summary: '', content: '', cover_image: '', mp_url: '', published_at: '', is_home_show: false, sort_order: 0 }); formVisible.value = true; }
function onEdit(row) { isEdit.value = true; Object.assign(formData, { content: '', ...row }); formVisible.value = true; }
async function onRefetch(row) {
    refetchingId.value = row.id;
    try {
        const res = await refetchArticleContent(row.id);
        if (res.has_content)
            MessagePlugin.success(`正文抓取成功（${res.content_length} 字）`);
        else
            MessagePlugin.warning(res.message || '未抓取到正文');
        loadData();
    }
    catch { /* skip */ }
    finally {
        refetchingId.value = 0;
    }
}
async function onSave() {
    const payload = { ...formData };
    delete payload.id;
    try {
        if (isEdit.value)
            await updateArticle(formData.id, payload);
        else
            await createArticle(payload);
        MessagePlugin.success('保存成功');
        formVisible.value = false;
        loadData();
    }
    catch { /* skip */ }
}
async function onDelete(id) {
    await deleteArticle(id);
    MessagePlugin.success('已删除');
    loadData();
}
async function onSyncFromMp() {
    syncing.value = true;
    try {
        const res = await syncArticlesFromMp(40);
        MessagePlugin.success(res.message || '同步完成');
        pagination.current = 1;
        loadData();
    }
    catch (e) {
        MessagePlugin.error(e?.response?.data?.detail || '同步失败，请检查公众号配置与 IP 白名单');
    }
    finally {
        syncing.value = false;
    }
}
function onImportDialog() {
    importUrls.value = '';
    importFailed.value = [];
    importVisible.value = true;
}
async function onImportConfirm() {
    const text = importUrls.value.trim();
    if (!text) {
        MessagePlugin.warning('请粘贴至少一条文章链接');
        return;
    }
    importing.value = true;
    importFailed.value = [];
    try {
        const res = await importArticleFromUrl(text);
        importFailed.value = res.failed || [];
        if (importFailed.value.length) {
            MessagePlugin.warning(res.message || '部分导入失败');
        }
        else {
            MessagePlugin.success(res.message || '导入完成');
            importVisible.value = false;
        }
        pagination.current = 1;
        loadData();
    }
    catch (e) {
        MessagePlugin.error(e?.response?.data?.detail || '导入失败');
    }
    finally {
        importing.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['import-failed']} */ ;
/** @type {__VLS_StyleScopedClasses['import-failed']} */ ;
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
    placeholder: "搜索标题",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_6 = __VLS_5({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.keyword),
    placeholder: "搜索标题",
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
const __VLS_12 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_14 = __VLS_13({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onClick: (__VLS_ctx.onSearch)
};
__VLS_15.slots.default;
var __VLS_15;
const __VLS_20 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_22 = __VLS_21({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_24;
let __VLS_25;
let __VLS_26;
const __VLS_27 = {
    onClick: (__VLS_ctx.onAdd)
};
__VLS_23.slots.default;
var __VLS_23;
const __VLS_28 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    ...{ 'onClick': {} },
    theme: "success",
    loading: (__VLS_ctx.syncing),
}));
const __VLS_30 = __VLS_29({
    ...{ 'onClick': {} },
    theme: "success",
    loading: (__VLS_ctx.syncing),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_32;
let __VLS_33;
let __VLS_34;
const __VLS_35 = {
    onClick: (__VLS_ctx.onSyncFromMp)
};
__VLS_31.slots.default;
var __VLS_31;
const __VLS_36 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    ...{ 'onClick': {} },
    theme: "primary",
    variant: "outline",
}));
const __VLS_38 = __VLS_37({
    ...{ 'onClick': {} },
    theme: "primary",
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
let __VLS_40;
let __VLS_41;
let __VLS_42;
const __VLS_43 = {
    onClick: (__VLS_ctx.onImportDialog)
};
__VLS_39.slots.default;
var __VLS_39;
const __VLS_44 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.columns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
    pagination: (__VLS_ctx.pagination),
}));
const __VLS_46 = __VLS_45({
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.columns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
    pagination: (__VLS_ctx.pagination),
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_48;
let __VLS_49;
let __VLS_50;
const __VLS_51 = {
    onPageChange: (__VLS_ctx.onPageChange)
};
__VLS_47.slots.default;
{
    const { cover_image: __VLS_thisSlot } = __VLS_47.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    if (row.cover_image) {
        const __VLS_52 = {}.TImage;
        /** @type {[typeof __VLS_components.TImage, typeof __VLS_components.tImage, ]} */ ;
        // @ts-ignore
        const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
            src: (row.cover_image),
            fit: "cover",
            ...{ style: {} },
        }));
        const __VLS_54 = __VLS_53({
            src: (row.cover_image),
            fit: "cover",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "no-img" },
        });
    }
}
{
    const { is_home_show: __VLS_thisSlot } = __VLS_47.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_56 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        theme: (row.is_home_show ? 'success' : 'default'),
    }));
    const __VLS_58 = __VLS_57({
        theme: (row.is_home_show ? 'success' : 'default'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    __VLS_59.slots.default;
    (row.is_home_show ? '是' : '否');
    var __VLS_59;
}
{
    const { source: __VLS_thisSlot } = __VLS_47.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_60 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        theme: (row.source === 'wechat_mp' ? 'primary' : 'default'),
        variant: "light",
    }));
    const __VLS_62 = __VLS_61({
        theme: (row.source === 'wechat_mp' ? 'primary' : 'default'),
        variant: "light",
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_63.slots.default;
    (row.source === 'wechat_mp' ? '公众号' : '手工');
    var __VLS_63;
}
{
    const { has_content: __VLS_thisSlot } = __VLS_47.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_64 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        theme: (row.has_content ? 'success' : 'warning'),
        variant: "light",
    }));
    const __VLS_66 = __VLS_65({
        theme: (row.has_content ? 'success' : 'warning'),
        variant: "light",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    __VLS_67.slots.default;
    (row.has_content ? '已抓' : '无正文');
    var __VLS_67;
}
{
    const { op: __VLS_thisSlot } = __VLS_47.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_68 = {}.TSpace;
    /** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({}));
    const __VLS_70 = __VLS_69({}, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
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
            __VLS_ctx.onEdit(row);
        }
    };
    __VLS_75.slots.default;
    var __VLS_75;
    if (row.mp_url) {
        const __VLS_80 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
            theme: "primary",
            loading: (__VLS_ctx.refetchingId === row.id),
        }));
        const __VLS_82 = __VLS_81({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
            theme: "primary",
            loading: (__VLS_ctx.refetchingId === row.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_81));
        let __VLS_84;
        let __VLS_85;
        let __VLS_86;
        const __VLS_87 = {
            onClick: (...[$event]) => {
                if (!(row.mp_url))
                    return;
                __VLS_ctx.onRefetch(row);
            }
        };
        __VLS_83.slots.default;
        var __VLS_83;
    }
    const __VLS_88 = {}.TPopconfirm;
    /** @type {[typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        ...{ 'onConfirm': {} },
        content: "确定删除？",
    }));
    const __VLS_90 = __VLS_89({
        ...{ 'onConfirm': {} },
        content: "确定删除？",
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    let __VLS_92;
    let __VLS_93;
    let __VLS_94;
    const __VLS_95 = {
        onConfirm: (...[$event]) => {
            __VLS_ctx.onDelete(row.id);
        }
    };
    __VLS_91.slots.default;
    const __VLS_96 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        variant: "text",
        size: "small",
        theme: "danger",
    }));
    const __VLS_98 = __VLS_97({
        variant: "text",
        size: "small",
        theme: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    var __VLS_99;
    var __VLS_91;
    var __VLS_71;
}
var __VLS_47;
var __VLS_3;
const __VLS_100 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.formVisible),
    header: (__VLS_ctx.isEdit ? '编辑文章' : '添加文章'),
    width: "560px",
}));
const __VLS_102 = __VLS_101({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.formVisible),
    header: (__VLS_ctx.isEdit ? '编辑文章' : '添加文章'),
    width: "560px",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
let __VLS_104;
let __VLS_105;
let __VLS_106;
const __VLS_107 = {
    onConfirm: (__VLS_ctx.onSave)
};
__VLS_103.slots.default;
const __VLS_108 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    data: (__VLS_ctx.formData),
    labelWidth: "100px",
}));
const __VLS_110 = __VLS_109({
    data: (__VLS_ctx.formData),
    labelWidth: "100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
__VLS_111.slots.default;
const __VLS_112 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    label: "标题",
}));
const __VLS_114 = __VLS_113({
    label: "标题",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
const __VLS_116 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    modelValue: (__VLS_ctx.formData.title),
}));
const __VLS_118 = __VLS_117({
    modelValue: (__VLS_ctx.formData.title),
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
var __VLS_115;
const __VLS_120 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    label: "简介",
}));
const __VLS_122 = __VLS_121({
    label: "简介",
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
const __VLS_124 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    modelValue: (__VLS_ctx.formData.summary),
}));
const __VLS_126 = __VLS_125({
    modelValue: (__VLS_ctx.formData.summary),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
var __VLS_123;
const __VLS_128 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    label: "正文(HTML)",
}));
const __VLS_130 = __VLS_129({
    label: "正文(HTML)",
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
const __VLS_132 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    modelValue: (__VLS_ctx.formData.content),
    autosize: ({ minRows: 4, maxRows: 12 }),
    placeholder: "公众号原文正文HTML，可点列表「抓正文」自动填充，也可手工编辑",
}));
const __VLS_134 = __VLS_133({
    modelValue: (__VLS_ctx.formData.content),
    autosize: ({ minRows: 4, maxRows: 12 }),
    placeholder: "公众号原文正文HTML，可点列表「抓正文」自动填充，也可手工编辑",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
var __VLS_131;
const __VLS_136 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    label: "封面图",
}));
const __VLS_138 = __VLS_137({
    label: "封面图",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
const __VLS_140 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    modelValue: (__VLS_ctx.formData.cover_image),
    placeholder: "图片URL",
}));
const __VLS_142 = __VLS_141({
    modelValue: (__VLS_ctx.formData.cover_image),
    placeholder: "图片URL",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
var __VLS_139;
const __VLS_144 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    label: "公众号链接",
}));
const __VLS_146 = __VLS_145({
    label: "公众号链接",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
__VLS_147.slots.default;
const __VLS_148 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    modelValue: (__VLS_ctx.formData.mp_url),
}));
const __VLS_150 = __VLS_149({
    modelValue: (__VLS_ctx.formData.mp_url),
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
var __VLS_147;
const __VLS_152 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    label: "发布日期",
}));
const __VLS_154 = __VLS_153({
    label: "发布日期",
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
__VLS_155.slots.default;
const __VLS_156 = {}.TDatePicker;
/** @type {[typeof __VLS_components.TDatePicker, typeof __VLS_components.tDatePicker, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    modelValue: (__VLS_ctx.formData.published_at),
}));
const __VLS_158 = __VLS_157({
    modelValue: (__VLS_ctx.formData.published_at),
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
var __VLS_155;
const __VLS_160 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    label: "首页展示",
}));
const __VLS_162 = __VLS_161({
    label: "首页展示",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
__VLS_163.slots.default;
const __VLS_164 = {}.TSwitch;
/** @type {[typeof __VLS_components.TSwitch, typeof __VLS_components.tSwitch, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    modelValue: (__VLS_ctx.formData.is_home_show),
}));
const __VLS_166 = __VLS_165({
    modelValue: (__VLS_ctx.formData.is_home_show),
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
var __VLS_163;
const __VLS_168 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    label: "排序",
}));
const __VLS_170 = __VLS_169({
    label: "排序",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
__VLS_171.slots.default;
const __VLS_172 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    modelValue: (__VLS_ctx.formData.sort_order),
    min: (0),
}));
const __VLS_174 = __VLS_173({
    modelValue: (__VLS_ctx.formData.sort_order),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
var __VLS_171;
var __VLS_111;
var __VLS_103;
const __VLS_176 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.importVisible),
    header: "粘贴公众号文章链接导入",
    width: "600px",
    confirmBtn: ({ content: '开始导入', loading: __VLS_ctx.importing }),
}));
const __VLS_178 = __VLS_177({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.importVisible),
    header: "粘贴公众号文章链接导入",
    width: "600px",
    confirmBtn: ({ content: '开始导入', loading: __VLS_ctx.importing }),
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
let __VLS_180;
let __VLS_181;
let __VLS_182;
const __VLS_183 = {
    onConfirm: (__VLS_ctx.onImportConfirm)
};
__VLS_179.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "import-tip" },
});
const __VLS_184 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    modelValue: (__VLS_ctx.importUrls),
    autosize: ({ minRows: 6, maxRows: 12 }),
    placeholder: "https://mp.weixin.qq.com/s/xxxxxxxx&#10;https://mp.weixin.qq.com/s/yyyyyyyy",
}));
const __VLS_186 = __VLS_185({
    modelValue: (__VLS_ctx.importUrls),
    autosize: ({ minRows: 6, maxRows: 12 }),
    placeholder: "https://mp.weixin.qq.com/s/xxxxxxxx&#10;https://mp.weixin.qq.com/s/yyyyyyyy",
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
if (__VLS_ctx.importFailed.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "import-failed" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
    for (const [f, i] of __VLS_getVForSourceType((__VLS_ctx.importFailed))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            key: (i),
        });
        (f.url);
        (f.reason);
    }
}
var __VLS_179;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['search-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['no-img']} */ ;
/** @type {__VLS_StyleScopedClasses['import-tip']} */ ;
/** @type {__VLS_StyleScopedClasses['import-failed']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            syncing: syncing,
            refetchingId: refetchingId,
            list: list,
            filters: filters,
            pagination: pagination,
            columns: columns,
            formVisible: formVisible,
            isEdit: isEdit,
            formData: formData,
            importVisible: importVisible,
            importing: importing,
            importUrls: importUrls,
            importFailed: importFailed,
            onSearch: onSearch,
            onPageChange: onPageChange,
            onAdd: onAdd,
            onEdit: onEdit,
            onRefetch: onRefetch,
            onSave: onSave,
            onDelete: onDelete,
            onSyncFromMp: onSyncFromMp,
            onImportDialog: onImportDialog,
            onImportConfirm: onImportConfirm,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
