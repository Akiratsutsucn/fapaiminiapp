/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getSettings, updateSettings, listCities, addCity } from '@/api/settings';
import http from '@/utils/request';
const saving = ref(false);
const exporting = ref(false);
const loadingArchives = ref(false);
const cities = ref([]);
const archives = ref([]);
const newCityId = ref(0);
const newCityName = ref('');
const basicForm = reactive({
    service_phone: '400-007-6786',
    service_text: '周一至周六 8:00~18:00',
});
const cityColumns = [
    { colKey: 'city_id', title: '城市ID', width: 100 },
    { colKey: 'city_name', title: '城市名称', width: 100 },
    { colKey: 'is_active', title: '状态', width: 80 },
];
const archiveColumns = [
    { colKey: 'filename', title: '文件名', ellipsis: true },
    { colKey: 'size', title: '大小', width: 100 },
    { colKey: 'created_at', title: '生成时间', width: 180 },
    { colKey: 'op', title: '操作', width: 80 },
];
onMounted(async () => {
    try {
        const data = await getSettings();
        if (data)
            Object.assign(basicForm, data);
    }
    catch { /* skip */ }
    try {
        const data = await listCities();
        cities.value = data || [];
    }
    catch { /* skip */ }
    loadArchives();
});
async function onSaveBasic() {
    saving.value = true;
    try {
        await updateSettings({ ...basicForm });
        MessagePlugin.success('已保存');
    }
    finally {
        saving.value = false;
    }
}
async function onAddCity() {
    if (!newCityId.value || !newCityName.value) {
        MessagePlugin.warning('请填写城市ID和名称');
        return;
    }
    try {
        await addCity({ city_id: newCityId.value, city_name: newCityName.value });
        MessagePlugin.success('已添加');
        newCityId.value = 0;
        newCityName.value = '';
        const data = await listCities();
        cities.value = data || [];
    }
    catch { /* skip */ }
}
async function loadArchives() {
    loadingArchives.value = true;
    try {
        const { data } = await http.get('/settings/archive/list');
        archives.value = data || [];
    }
    catch {
        archives.value = [];
    }
    finally {
        loadingArchives.value = false;
    }
}
async function onManualExport() {
    exporting.value = true;
    try {
        const res = await http.post('/settings/archive/export', {}, { responseType: 'blob', params: { format: 'xlsx' } });
        const disposition = res.headers['content-disposition'] || '';
        const match = disposition.match(/filename=(.+)/);
        const fname = match ? decodeURIComponent(match[1]) : '房源归档.xlsx';
        const url = URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        a.click();
        MessagePlugin.success('归档已生成并下载');
        loadArchives();
    }
    catch {
        MessagePlugin.error('导出失败');
    }
    finally {
        exporting.value = false;
    }
}
async function onDownloadArchive(filename) {
    try {
        const res = await http.get(`/settings/archive/download/${encodeURIComponent(filename)}`, { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    }
    catch {
        MessagePlugin.error('下载失败');
    }
}
function formatSize(bytes) {
    if (bytes < 1024)
        return bytes + 'B';
    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
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
}));
const __VLS_2 = __VLS_1({
    gutter: (16),
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
    title: "基础配置",
}));
const __VLS_10 = __VLS_9({
    title: "基础配置",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onSubmit': {} },
    data: (__VLS_ctx.basicForm),
    labelWidth: "120px",
}));
const __VLS_14 = __VLS_13({
    ...{ 'onSubmit': {} },
    data: (__VLS_ctx.basicForm),
    labelWidth: "120px",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onSubmit: (__VLS_ctx.onSaveBasic)
};
__VLS_15.slots.default;
const __VLS_20 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    label: "客服电话",
}));
const __VLS_22 = __VLS_21({
    label: "客服电话",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
const __VLS_24 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    modelValue: (__VLS_ctx.basicForm.service_phone),
}));
const __VLS_26 = __VLS_25({
    modelValue: (__VLS_ctx.basicForm.service_phone),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
var __VLS_23;
const __VLS_28 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    label: "客服文案",
}));
const __VLS_30 = __VLS_29({
    label: "客服文案",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    modelValue: (__VLS_ctx.basicForm.service_text),
}));
const __VLS_34 = __VLS_33({
    modelValue: (__VLS_ctx.basicForm.service_text),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
var __VLS_31;
const __VLS_36 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    type: "submit",
    theme: "primary",
    loading: (__VLS_ctx.saving),
}));
const __VLS_38 = __VLS_37({
    type: "submit",
    theme: "primary",
    loading: (__VLS_ctx.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
var __VLS_39;
var __VLS_15;
var __VLS_11;
var __VLS_7;
const __VLS_40 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    span: (6),
}));
const __VLS_42 = __VLS_41({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
const __VLS_44 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    title: "城市配置",
}));
const __VLS_46 = __VLS_45({
    title: "城市配置",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
const __VLS_48 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    data: (__VLS_ctx.cities),
    columns: (__VLS_ctx.cityColumns),
    rowKey: "city_id",
}));
const __VLS_50 = __VLS_49({
    data: (__VLS_ctx.cities),
    columns: (__VLS_ctx.cityColumns),
    rowKey: "city_id",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
{
    const { is_active: __VLS_thisSlot } = __VLS_51.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_52 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        theme: (row.is_active ? 'success' : 'default'),
    }));
    const __VLS_54 = __VLS_53({
        theme: (row.is_active ? 'success' : 'default'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    __VLS_55.slots.default;
    (row.is_active ? '启用' : '停用');
    var __VLS_55;
}
var __VLS_51;
const __VLS_56 = {}.TDivider;
/** @type {[typeof __VLS_components.TDivider, typeof __VLS_components.tDivider, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({}));
const __VLS_58 = __VLS_57({}, ...__VLS_functionalComponentArgsRest(__VLS_57));
const __VLS_60 = {}.TSpace;
/** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({}));
const __VLS_62 = __VLS_61({}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
const __VLS_64 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    modelValue: (__VLS_ctx.newCityId),
    placeholder: "城市ID",
    ...{ style: {} },
}));
const __VLS_66 = __VLS_65({
    modelValue: (__VLS_ctx.newCityId),
    placeholder: "城市ID",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
const __VLS_68 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    modelValue: (__VLS_ctx.newCityName),
    placeholder: "城市名称",
    ...{ style: {} },
}));
const __VLS_70 = __VLS_69({
    modelValue: (__VLS_ctx.newCityName),
    placeholder: "城市名称",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
const __VLS_72 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_74 = __VLS_73({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
let __VLS_76;
let __VLS_77;
let __VLS_78;
const __VLS_79 = {
    onClick: (__VLS_ctx.onAddCity)
};
__VLS_75.slots.default;
var __VLS_75;
var __VLS_63;
var __VLS_47;
var __VLS_43;
var __VLS_3;
const __VLS_80 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    title: "房源数据归档",
    ...{ style: {} },
}));
const __VLS_82 = __VLS_81({
    title: "房源数据归档",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
const __VLS_84 = {}.TAlert;
/** @type {[typeof __VLS_components.TAlert, typeof __VLS_components.tAlert, typeof __VLS_components.TAlert, typeof __VLS_components.tAlert, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    theme: "info",
    ...{ style: {} },
}));
const __VLS_86 = __VLS_85({
    theme: "info",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
{
    const { message: __VLS_thisSlot } = __VLS_87.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
}
var __VLS_87;
const __VLS_88 = {}.TSpace;
/** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({}));
const __VLS_90 = __VLS_89({}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_91.slots.default;
const __VLS_92 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    ...{ 'onClick': {} },
    theme: "primary",
    loading: (__VLS_ctx.exporting),
}));
const __VLS_94 = __VLS_93({
    ...{ 'onClick': {} },
    theme: "primary",
    loading: (__VLS_ctx.exporting),
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
let __VLS_96;
let __VLS_97;
let __VLS_98;
const __VLS_99 = {
    onClick: (__VLS_ctx.onManualExport)
};
__VLS_95.slots.default;
var __VLS_95;
const __VLS_100 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    ...{ 'onClick': {} },
    variant: "outline",
    loading: (__VLS_ctx.loadingArchives),
}));
const __VLS_102 = __VLS_101({
    ...{ 'onClick': {} },
    variant: "outline",
    loading: (__VLS_ctx.loadingArchives),
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
let __VLS_104;
let __VLS_105;
let __VLS_106;
const __VLS_107 = {
    onClick: (__VLS_ctx.loadArchives)
};
__VLS_103.slots.default;
var __VLS_103;
var __VLS_91;
if (__VLS_ctx.archives.length) {
    const __VLS_108 = {}.TTable;
    /** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        data: (__VLS_ctx.archives),
        columns: (__VLS_ctx.archiveColumns),
        rowKey: "filename",
        ...{ style: {} },
        bordered: true,
    }));
    const __VLS_110 = __VLS_109({
        data: (__VLS_ctx.archives),
        columns: (__VLS_ctx.archiveColumns),
        rowKey: "filename",
        ...{ style: {} },
        bordered: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    __VLS_111.slots.default;
    {
        const { size: __VLS_thisSlot } = __VLS_111.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (__VLS_ctx.formatSize(row.size));
    }
    {
        const { op: __VLS_thisSlot } = __VLS_111.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_112 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
        }));
        const __VLS_114 = __VLS_113({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_113));
        let __VLS_116;
        let __VLS_117;
        let __VLS_118;
        const __VLS_119 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.archives.length))
                    return;
                __VLS_ctx.onDownloadArchive(row.filename);
            }
        };
        __VLS_115.slots.default;
        var __VLS_115;
    }
    var __VLS_111;
}
else if (!__VLS_ctx.loadingArchives) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty-archives" },
    });
}
var __VLS_83;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-archives']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            saving: saving,
            exporting: exporting,
            loadingArchives: loadingArchives,
            cities: cities,
            archives: archives,
            newCityId: newCityId,
            newCityName: newCityName,
            basicForm: basicForm,
            cityColumns: cityColumns,
            archiveColumns: archiveColumns,
            onSaveBasic: onSaveBasic,
            onAddCity: onAddCity,
            loadArchives: loadArchives,
            onManualExport: onManualExport,
            onDownloadArchive: onDownloadArchive,
            formatSize: formatSize,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
