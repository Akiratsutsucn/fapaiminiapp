/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getProperty, createProperty, updateProperty, getPropertyCommunity, refreshPropertyCommunity } from '@/api/properties';
import { uploadImage } from '@/api/upload';
const router = useRouter();
const route = useRoute();
const isEdit = ref(false);
const submitting = ref(false);
const images = ref([]);
const attachments = ref([]);
const imageInput = ref();
const docInput = ref();
const community = reactive({ info: null });
const refreshingCommunity = ref(false);
function formatPriceCN(n) {
    if (!n)
        return '—';
    return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}
async function loadCommunity() {
    if (!isEdit.value)
        return;
    try {
        const data = await getPropertyCommunity(route.params.id);
        community.info = data.info;
    }
    catch (e) {
        community.info = null;
    }
}
async function refreshCommunity() {
    if (!form.community_name) {
        MessagePlugin.warning('请先在基本信息中填入小区名');
        return;
    }
    refreshingCommunity.value = true;
    MessagePlugin.loading({ content: '正在从贝壳抓取，预计 5-15 秒…', duration: 0 });
    try {
        const r = await refreshPropertyCommunity(route.params.id);
        MessagePlugin.closeAll();
        if (r.matched) {
            MessagePlugin.success('小区详情已更新');
            await loadCommunity();
        }
        else {
            MessagePlugin.warning('未在贝壳找到匹配的小区，请检查小区名是否准确');
        }
    }
    catch (err) {
        MessagePlugin.closeAll();
        MessagePlugin.error(err.response?.data?.detail || '抓取失败');
    }
    finally {
        refreshingCommunity.value = false;
    }
}
const form = reactive({
    title: '', province_city: '', city_id: 310000,
    district: '', sub_district: '', ring_road: '', address: '', community_name: '',
    property_type: '住宅', area: 0, layout: '', floor_info: '', total_floors: null,
    has_elevator: null, orientation: '', decoration: '', build_year: null,
    starting_price: 0, starting_unit_price: 0, appraisal_price: 0, court_discount_rate: 0,
    deposit: 0, increment_amount: 0,
    market_deal_price: 0, market_deal_unit_price: 0, market_discount_rate: 0,
    listing_min_price: 0, latest_deal_unit_price: 0, latest_total_price: 0, bargain_potential: 0,
    beike_latest_deal_unit_price: 0, beike_latest_deal_total_price: 0, beike_latest_deal_time: '',
    auction_round: '一拍', auction_status: '即将开拍',
    auction_start_time: '', auction_end_time: '',
    court_name: '', case_number: '',
    view_count: 0, participant_count: 0, loan_support: null,
    description: '',
});
onMounted(async () => {
    const id = route.params.id;
    if (id) {
        isEdit.value = true;
        try {
            const data = await getProperty(id);
            Object.assign(form, data);
            images.value = data.images || [];
            attachments.value = JSON.parse(localStorage.getItem(`prop_att_${id}`) || '[]');
            await loadCommunity();
        }
        catch {
            router.push('/properties');
        }
    }
});
function triggerUpload(type) {
    if (type === 'image')
        imageInput.value?.click();
    else
        docInput.value?.click();
}
async function onFileChange(e, type) {
    const file = e.target.files?.[0];
    if (!file)
        return;
    const fd = new FormData();
    fd.append('file', file);
    try {
        MessagePlugin.loading('上传中…');
        const data = await uploadImage(fd);
        if (type === 'image') {
            images.value.push({
                image_url: data.url, thumb_url: data.url,
                is_cover: images.value.length === 0, sort_order: images.value.length,
            });
            await updateProperty(route.params.id, { images: images.value.map((img, i) => ({ ...img, sort_order: i })) });
            MessagePlugin.success('图片上传成功');
        }
        else {
            attachments.value.push({ url: data.url, filename: data.filename || file.name, size: file.size });
            localStorage.setItem(`prop_att_${route.params.id}`, JSON.stringify(attachments.value));
            await updateProperty(route.params.id, { has_attachments: true });
            MessagePlugin.success('附件上传成功');
        }
    }
    catch (err) {
        MessagePlugin.error(err.response?.data?.detail || '上传失败');
    }
    e.target.value = '';
}
function removeImage(idx) {
    images.value.splice(idx, 1);
    updateProperty(route.params.id, { images: images.value.map((img, i) => ({ ...img, sort_order: i, is_cover: i === 0 })) });
    MessagePlugin.success('图片已删除');
}
function removeAttachment(idx) {
    attachments.value.splice(idx, 1);
    localStorage.setItem(`prop_att_${route.params.id}`, JSON.stringify(attachments.value));
    if (attachments.value.length === 0) {
        updateProperty(route.params.id, { has_attachments: false });
    }
    MessagePlugin.success('附件已删除');
}
function formatSize(bytes) {
    if (bytes < 1024)
        return bytes + 'B';
    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}
async function onSubmit() {
    submitting.value = true;
    try {
        if (isEdit.value) {
            await updateProperty(route.params.id, form);
        }
        else {
            await createProperty(form);
        }
        MessagePlugin.success('保存成功');
        router.push('/properties');
    }
    finally {
        submitting.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['upload-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-num']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "page-title" },
});
(__VLS_ctx.isEdit ? '编辑房源' : '添加房源');
const __VLS_0 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    title: "基本信息",
}));
const __VLS_2 = __VLS_1({
    title: "基本信息",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
const __VLS_4 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}));
const __VLS_6 = __VLS_5({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
const __VLS_8 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    gutter: (24),
}));
const __VLS_10 = __VLS_9({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    span: (8),
}));
const __VLS_14 = __VLS_13({
    span: (8),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
const __VLS_16 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    label: "标题",
}));
const __VLS_18 = __VLS_17({
    label: "标题",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
const __VLS_20 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.form.title),
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.form.title),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
var __VLS_19;
var __VLS_15;
const __VLS_24 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    span: (4),
}));
const __VLS_26 = __VLS_25({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    label: "城市",
}));
const __VLS_30 = __VLS_29({
    label: "城市",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    modelValue: (__VLS_ctx.form.city_id),
}));
const __VLS_34 = __VLS_33({
    modelValue: (__VLS_ctx.form.city_id),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
const __VLS_36 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    value: (310000),
    label: "上海",
}));
const __VLS_38 = __VLS_37({
    value: (310000),
    label: "上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
const __VLS_40 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    value: (330200),
    label: "宁波",
}));
const __VLS_42 = __VLS_41({
    value: (330200),
    label: "宁波",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
var __VLS_35;
var __VLS_31;
var __VLS_27;
const __VLS_44 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    span: (4),
}));
const __VLS_46 = __VLS_45({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
const __VLS_48 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    label: "区",
}));
const __VLS_50 = __VLS_49({
    label: "区",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
const __VLS_52 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    modelValue: (__VLS_ctx.form.district),
}));
const __VLS_54 = __VLS_53({
    modelValue: (__VLS_ctx.form.district),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
var __VLS_51;
var __VLS_47;
const __VLS_56 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    span: (4),
}));
const __VLS_58 = __VLS_57({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
const __VLS_60 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    label: "板块",
}));
const __VLS_62 = __VLS_61({
    label: "板块",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
const __VLS_64 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    modelValue: (__VLS_ctx.form.sub_district),
}));
const __VLS_66 = __VLS_65({
    modelValue: (__VLS_ctx.form.sub_district),
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
var __VLS_63;
var __VLS_59;
const __VLS_68 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    span: (4),
}));
const __VLS_70 = __VLS_69({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
const __VLS_72 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    label: "环线",
}));
const __VLS_74 = __VLS_73({
    label: "环线",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
const __VLS_76 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    modelValue: (__VLS_ctx.form.ring_road),
}));
const __VLS_78 = __VLS_77({
    modelValue: (__VLS_ctx.form.ring_road),
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
var __VLS_75;
var __VLS_71;
const __VLS_80 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    span: (8),
}));
const __VLS_82 = __VLS_81({
    span: (8),
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
const __VLS_84 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    label: "地址",
}));
const __VLS_86 = __VLS_85({
    label: "地址",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
const __VLS_88 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    modelValue: (__VLS_ctx.form.address),
}));
const __VLS_90 = __VLS_89({
    modelValue: (__VLS_ctx.form.address),
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
var __VLS_87;
var __VLS_83;
const __VLS_92 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    span: (4),
}));
const __VLS_94 = __VLS_93({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
const __VLS_96 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    label: "小区名",
}));
const __VLS_98 = __VLS_97({
    label: "小区名",
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
__VLS_99.slots.default;
const __VLS_100 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    modelValue: (__VLS_ctx.form.community_name),
}));
const __VLS_102 = __VLS_101({
    modelValue: (__VLS_ctx.form.community_name),
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
var __VLS_99;
var __VLS_95;
const __VLS_104 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    span: (4),
}));
const __VLS_106 = __VLS_105({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_107.slots.default;
const __VLS_108 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    label: "省市",
}));
const __VLS_110 = __VLS_109({
    label: "省市",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
__VLS_111.slots.default;
const __VLS_112 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    modelValue: (__VLS_ctx.form.province_city),
}));
const __VLS_114 = __VLS_113({
    modelValue: (__VLS_ctx.form.province_city),
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
var __VLS_111;
var __VLS_107;
var __VLS_11;
var __VLS_7;
var __VLS_3;
const __VLS_116 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    title: "建筑信息",
    ...{ style: {} },
}));
const __VLS_118 = __VLS_117({
    title: "建筑信息",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
__VLS_119.slots.default;
const __VLS_120 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}));
const __VLS_122 = __VLS_121({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
const __VLS_124 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    gutter: (24),
}));
const __VLS_126 = __VLS_125({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
__VLS_127.slots.default;
const __VLS_128 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    span: (3),
}));
const __VLS_130 = __VLS_129({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
const __VLS_132 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    label: "物业类型",
}));
const __VLS_134 = __VLS_133({
    label: "物业类型",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
const __VLS_136 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    modelValue: (__VLS_ctx.form.property_type),
}));
const __VLS_138 = __VLS_137({
    modelValue: (__VLS_ctx.form.property_type),
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
const __VLS_140 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    value: "住宅",
}));
const __VLS_142 = __VLS_141({
    value: "住宅",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
const __VLS_144 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    value: "商业",
}));
const __VLS_146 = __VLS_145({
    value: "商业",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
const __VLS_148 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    value: "工业",
}));
const __VLS_150 = __VLS_149({
    value: "工业",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
const __VLS_152 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    value: "办公",
}));
const __VLS_154 = __VLS_153({
    value: "办公",
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
const __VLS_156 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    value: "土地",
}));
const __VLS_158 = __VLS_157({
    value: "土地",
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
var __VLS_139;
var __VLS_135;
var __VLS_131;
const __VLS_160 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    span: (3),
}));
const __VLS_162 = __VLS_161({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
__VLS_163.slots.default;
const __VLS_164 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    label: "面积(m2)",
}));
const __VLS_166 = __VLS_165({
    label: "面积(m2)",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
__VLS_167.slots.default;
const __VLS_168 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    modelValue: (__VLS_ctx.form.area),
    min: (0),
    decimalPlaces: (2),
}));
const __VLS_170 = __VLS_169({
    modelValue: (__VLS_ctx.form.area),
    min: (0),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
var __VLS_167;
var __VLS_163;
const __VLS_172 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    span: (3),
}));
const __VLS_174 = __VLS_173({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
__VLS_175.slots.default;
const __VLS_176 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    label: "户型",
}));
const __VLS_178 = __VLS_177({
    label: "户型",
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
__VLS_179.slots.default;
const __VLS_180 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    modelValue: (__VLS_ctx.form.layout),
}));
const __VLS_182 = __VLS_181({
    modelValue: (__VLS_ctx.form.layout),
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
var __VLS_179;
var __VLS_175;
const __VLS_184 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    span: (3),
}));
const __VLS_186 = __VLS_185({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
const __VLS_188 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    label: "楼层",
}));
const __VLS_190 = __VLS_189({
    label: "楼层",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
__VLS_191.slots.default;
const __VLS_192 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    modelValue: (__VLS_ctx.form.floor_info),
}));
const __VLS_194 = __VLS_193({
    modelValue: (__VLS_ctx.form.floor_info),
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
var __VLS_191;
var __VLS_187;
const __VLS_196 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    span: (3),
}));
const __VLS_198 = __VLS_197({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
__VLS_199.slots.default;
const __VLS_200 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    label: "总楼层",
}));
const __VLS_202 = __VLS_201({
    label: "总楼层",
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
__VLS_203.slots.default;
const __VLS_204 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    modelValue: (__VLS_ctx.form.total_floors),
    min: (0),
}));
const __VLS_206 = __VLS_205({
    modelValue: (__VLS_ctx.form.total_floors),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
var __VLS_203;
var __VLS_199;
const __VLS_208 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    span: (3),
}));
const __VLS_210 = __VLS_209({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
__VLS_211.slots.default;
const __VLS_212 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    label: "电梯",
}));
const __VLS_214 = __VLS_213({
    label: "电梯",
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
__VLS_215.slots.default;
const __VLS_216 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    modelValue: (__VLS_ctx.form.has_elevator),
    clearable: (true),
}));
const __VLS_218 = __VLS_217({
    modelValue: (__VLS_ctx.form.has_elevator),
    clearable: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
__VLS_219.slots.default;
const __VLS_220 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    value: (true),
    label: "有",
}));
const __VLS_222 = __VLS_221({
    value: (true),
    label: "有",
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
const __VLS_224 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    value: (false),
    label: "无",
}));
const __VLS_226 = __VLS_225({
    value: (false),
    label: "无",
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
var __VLS_219;
var __VLS_215;
var __VLS_211;
const __VLS_228 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    span: (3),
}));
const __VLS_230 = __VLS_229({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
__VLS_231.slots.default;
const __VLS_232 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    label: "朝向",
}));
const __VLS_234 = __VLS_233({
    label: "朝向",
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
__VLS_235.slots.default;
const __VLS_236 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    modelValue: (__VLS_ctx.form.orientation),
}));
const __VLS_238 = __VLS_237({
    modelValue: (__VLS_ctx.form.orientation),
}, ...__VLS_functionalComponentArgsRest(__VLS_237));
var __VLS_235;
var __VLS_231;
const __VLS_240 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
    span: (3),
}));
const __VLS_242 = __VLS_241({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_241));
__VLS_243.slots.default;
const __VLS_244 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
    label: "装修",
}));
const __VLS_246 = __VLS_245({
    label: "装修",
}, ...__VLS_functionalComponentArgsRest(__VLS_245));
__VLS_247.slots.default;
const __VLS_248 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
    modelValue: (__VLS_ctx.form.decoration),
}));
const __VLS_250 = __VLS_249({
    modelValue: (__VLS_ctx.form.decoration),
}, ...__VLS_functionalComponentArgsRest(__VLS_249));
var __VLS_247;
var __VLS_243;
const __VLS_252 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
    span: (3),
}));
const __VLS_254 = __VLS_253({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_253));
__VLS_255.slots.default;
const __VLS_256 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
    label: "建筑年代",
}));
const __VLS_258 = __VLS_257({
    label: "建筑年代",
}, ...__VLS_functionalComponentArgsRest(__VLS_257));
__VLS_259.slots.default;
const __VLS_260 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
    modelValue: (__VLS_ctx.form.build_year),
    min: (1900),
    max: (2030),
}));
const __VLS_262 = __VLS_261({
    modelValue: (__VLS_ctx.form.build_year),
    min: (1900),
    max: (2030),
}, ...__VLS_functionalComponentArgsRest(__VLS_261));
var __VLS_259;
var __VLS_255;
var __VLS_127;
var __VLS_123;
var __VLS_119;
const __VLS_264 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
    title: "拍卖价格",
    ...{ style: {} },
}));
const __VLS_266 = __VLS_265({
    title: "拍卖价格",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_265));
__VLS_267.slots.default;
const __VLS_268 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}));
const __VLS_270 = __VLS_269({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}, ...__VLS_functionalComponentArgsRest(__VLS_269));
__VLS_271.slots.default;
const __VLS_272 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
    gutter: (24),
}));
const __VLS_274 = __VLS_273({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_273));
__VLS_275.slots.default;
const __VLS_276 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
    span: (4),
}));
const __VLS_278 = __VLS_277({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_277));
__VLS_279.slots.default;
const __VLS_280 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
    label: "起拍价(元)",
}));
const __VLS_282 = __VLS_281({
    label: "起拍价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_281));
__VLS_283.slots.default;
const __VLS_284 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
    modelValue: (__VLS_ctx.form.starting_price),
    min: (0),
    theme: "normal",
}));
const __VLS_286 = __VLS_285({
    modelValue: (__VLS_ctx.form.starting_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_285));
var __VLS_283;
var __VLS_279;
const __VLS_288 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
    span: (4),
}));
const __VLS_290 = __VLS_289({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_289));
__VLS_291.slots.default;
const __VLS_292 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
    label: "起拍单价",
}));
const __VLS_294 = __VLS_293({
    label: "起拍单价",
}, ...__VLS_functionalComponentArgsRest(__VLS_293));
__VLS_295.slots.default;
const __VLS_296 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
    modelValue: (__VLS_ctx.form.starting_unit_price),
    min: (0),
    decimalPlaces: (2),
    theme: "normal",
}));
const __VLS_298 = __VLS_297({
    modelValue: (__VLS_ctx.form.starting_unit_price),
    min: (0),
    decimalPlaces: (2),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_297));
var __VLS_295;
var __VLS_291;
const __VLS_300 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
    span: (4),
}));
const __VLS_302 = __VLS_301({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_301));
__VLS_303.slots.default;
const __VLS_304 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
    label: "评估价(元)",
}));
const __VLS_306 = __VLS_305({
    label: "评估价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_305));
__VLS_307.slots.default;
const __VLS_308 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
    modelValue: (__VLS_ctx.form.appraisal_price),
    min: (0),
    theme: "normal",
}));
const __VLS_310 = __VLS_309({
    modelValue: (__VLS_ctx.form.appraisal_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_309));
var __VLS_307;
var __VLS_303;
const __VLS_312 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
    span: (4),
}));
const __VLS_314 = __VLS_313({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_313));
__VLS_315.slots.default;
const __VLS_316 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
    label: "法院折扣率",
}));
const __VLS_318 = __VLS_317({
    label: "法院折扣率",
}, ...__VLS_functionalComponentArgsRest(__VLS_317));
__VLS_319.slots.default;
const __VLS_320 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
    modelValue: (__VLS_ctx.form.court_discount_rate),
    min: (0),
    max: (1),
    step: (0.01),
    decimalPlaces: (2),
}));
const __VLS_322 = __VLS_321({
    modelValue: (__VLS_ctx.form.court_discount_rate),
    min: (0),
    max: (1),
    step: (0.01),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_321));
var __VLS_319;
var __VLS_315;
const __VLS_324 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
    span: (4),
}));
const __VLS_326 = __VLS_325({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_325));
__VLS_327.slots.default;
const __VLS_328 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
    label: "保证金(元)",
}));
const __VLS_330 = __VLS_329({
    label: "保证金(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_329));
__VLS_331.slots.default;
const __VLS_332 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
    modelValue: (__VLS_ctx.form.deposit),
    min: (0),
    theme: "normal",
}));
const __VLS_334 = __VLS_333({
    modelValue: (__VLS_ctx.form.deposit),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_333));
var __VLS_331;
var __VLS_327;
const __VLS_336 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_337 = __VLS_asFunctionalComponent(__VLS_336, new __VLS_336({
    span: (4),
}));
const __VLS_338 = __VLS_337({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_337));
__VLS_339.slots.default;
const __VLS_340 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_341 = __VLS_asFunctionalComponent(__VLS_340, new __VLS_340({
    label: "加价幅度(元)",
}));
const __VLS_342 = __VLS_341({
    label: "加价幅度(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_341));
__VLS_343.slots.default;
const __VLS_344 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_345 = __VLS_asFunctionalComponent(__VLS_344, new __VLS_344({
    modelValue: (__VLS_ctx.form.increment_amount),
    min: (0),
    theme: "normal",
}));
const __VLS_346 = __VLS_345({
    modelValue: (__VLS_ctx.form.increment_amount),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_345));
var __VLS_343;
var __VLS_339;
var __VLS_275;
var __VLS_271;
var __VLS_267;
const __VLS_348 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_349 = __VLS_asFunctionalComponent(__VLS_348, new __VLS_348({
    title: "市场价格",
    ...{ style: {} },
}));
const __VLS_350 = __VLS_349({
    title: "市场价格",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_349));
__VLS_351.slots.default;
const __VLS_352 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
    data: (__VLS_ctx.form),
    labelWidth: "130px",
}));
const __VLS_354 = __VLS_353({
    data: (__VLS_ctx.form),
    labelWidth: "130px",
}, ...__VLS_functionalComponentArgsRest(__VLS_353));
__VLS_355.slots.default;
const __VLS_356 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_357 = __VLS_asFunctionalComponent(__VLS_356, new __VLS_356({
    gutter: (24),
}));
const __VLS_358 = __VLS_357({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_357));
__VLS_359.slots.default;
const __VLS_360 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_361 = __VLS_asFunctionalComponent(__VLS_360, new __VLS_360({
    span: (4),
}));
const __VLS_362 = __VLS_361({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_361));
__VLS_363.slots.default;
const __VLS_364 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_365 = __VLS_asFunctionalComponent(__VLS_364, new __VLS_364({
    label: "市场成交价(元)",
}));
const __VLS_366 = __VLS_365({
    label: "市场成交价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_365));
__VLS_367.slots.default;
const __VLS_368 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({
    modelValue: (__VLS_ctx.form.market_deal_price),
    min: (0),
    theme: "normal",
}));
const __VLS_370 = __VLS_369({
    modelValue: (__VLS_ctx.form.market_deal_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_369));
var __VLS_367;
var __VLS_363;
const __VLS_372 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_373 = __VLS_asFunctionalComponent(__VLS_372, new __VLS_372({
    span: (4),
}));
const __VLS_374 = __VLS_373({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_373));
__VLS_375.slots.default;
const __VLS_376 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_377 = __VLS_asFunctionalComponent(__VLS_376, new __VLS_376({
    label: "市场成交单价",
}));
const __VLS_378 = __VLS_377({
    label: "市场成交单价",
}, ...__VLS_functionalComponentArgsRest(__VLS_377));
__VLS_379.slots.default;
const __VLS_380 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_381 = __VLS_asFunctionalComponent(__VLS_380, new __VLS_380({
    modelValue: (__VLS_ctx.form.market_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}));
const __VLS_382 = __VLS_381({
    modelValue: (__VLS_ctx.form.market_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_381));
var __VLS_379;
var __VLS_375;
const __VLS_384 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_385 = __VLS_asFunctionalComponent(__VLS_384, new __VLS_384({
    span: (4),
}));
const __VLS_386 = __VLS_385({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_385));
__VLS_387.slots.default;
const __VLS_388 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_389 = __VLS_asFunctionalComponent(__VLS_388, new __VLS_388({
    label: "市场折扣率",
}));
const __VLS_390 = __VLS_389({
    label: "市场折扣率",
}, ...__VLS_functionalComponentArgsRest(__VLS_389));
__VLS_391.slots.default;
const __VLS_392 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_393 = __VLS_asFunctionalComponent(__VLS_392, new __VLS_392({
    modelValue: (__VLS_ctx.form.market_discount_rate),
    min: (0),
    max: (1),
    step: (0.01),
    decimalPlaces: (2),
}));
const __VLS_394 = __VLS_393({
    modelValue: (__VLS_ctx.form.market_discount_rate),
    min: (0),
    max: (1),
    step: (0.01),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_393));
var __VLS_391;
var __VLS_387;
const __VLS_396 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_397 = __VLS_asFunctionalComponent(__VLS_396, new __VLS_396({
    span: (4),
}));
const __VLS_398 = __VLS_397({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_397));
__VLS_399.slots.default;
const __VLS_400 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_401 = __VLS_asFunctionalComponent(__VLS_400, new __VLS_400({
    label: "挂牌最低价(元)",
}));
const __VLS_402 = __VLS_401({
    label: "挂牌最低价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_401));
__VLS_403.slots.default;
const __VLS_404 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_405 = __VLS_asFunctionalComponent(__VLS_404, new __VLS_404({
    modelValue: (__VLS_ctx.form.listing_min_price),
    min: (0),
    theme: "normal",
}));
const __VLS_406 = __VLS_405({
    modelValue: (__VLS_ctx.form.listing_min_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_405));
var __VLS_403;
var __VLS_399;
const __VLS_408 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_409 = __VLS_asFunctionalComponent(__VLS_408, new __VLS_408({
    span: (4),
}));
const __VLS_410 = __VLS_409({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_409));
__VLS_411.slots.default;
const __VLS_412 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_413 = __VLS_asFunctionalComponent(__VLS_412, new __VLS_412({
    label: "最新成交单价",
}));
const __VLS_414 = __VLS_413({
    label: "最新成交单价",
}, ...__VLS_functionalComponentArgsRest(__VLS_413));
__VLS_415.slots.default;
const __VLS_416 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_417 = __VLS_asFunctionalComponent(__VLS_416, new __VLS_416({
    modelValue: (__VLS_ctx.form.latest_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}));
const __VLS_418 = __VLS_417({
    modelValue: (__VLS_ctx.form.latest_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_417));
var __VLS_415;
var __VLS_411;
const __VLS_420 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_421 = __VLS_asFunctionalComponent(__VLS_420, new __VLS_420({
    span: (4),
}));
const __VLS_422 = __VLS_421({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_421));
__VLS_423.slots.default;
const __VLS_424 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_425 = __VLS_asFunctionalComponent(__VLS_424, new __VLS_424({
    label: "最新总价(元)",
}));
const __VLS_426 = __VLS_425({
    label: "最新总价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_425));
__VLS_427.slots.default;
const __VLS_428 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_429 = __VLS_asFunctionalComponent(__VLS_428, new __VLS_428({
    modelValue: (__VLS_ctx.form.latest_total_price),
    min: (0),
    theme: "normal",
}));
const __VLS_430 = __VLS_429({
    modelValue: (__VLS_ctx.form.latest_total_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_429));
var __VLS_427;
var __VLS_423;
const __VLS_432 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({
    span: (4),
}));
const __VLS_434 = __VLS_433({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_433));
__VLS_435.slots.default;
const __VLS_436 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_437 = __VLS_asFunctionalComponent(__VLS_436, new __VLS_436({
    label: "捡漏空间(元)",
}));
const __VLS_438 = __VLS_437({
    label: "捡漏空间(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_437));
__VLS_439.slots.default;
const __VLS_440 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_441 = __VLS_asFunctionalComponent(__VLS_440, new __VLS_440({
    modelValue: (__VLS_ctx.form.bargain_potential),
    min: (0),
    theme: "normal",
}));
const __VLS_442 = __VLS_441({
    modelValue: (__VLS_ctx.form.bargain_potential),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_441));
var __VLS_439;
var __VLS_435;
var __VLS_359;
var __VLS_355;
var __VLS_351;
const __VLS_444 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_445 = __VLS_asFunctionalComponent(__VLS_444, new __VLS_444({
    title: "贝壳参考",
    ...{ style: {} },
}));
const __VLS_446 = __VLS_445({
    title: "贝壳参考",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_445));
__VLS_447.slots.default;
const __VLS_448 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_449 = __VLS_asFunctionalComponent(__VLS_448, new __VLS_448({
    data: (__VLS_ctx.form),
    labelWidth: "130px",
}));
const __VLS_450 = __VLS_449({
    data: (__VLS_ctx.form),
    labelWidth: "130px",
}, ...__VLS_functionalComponentArgsRest(__VLS_449));
__VLS_451.slots.default;
const __VLS_452 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_453 = __VLS_asFunctionalComponent(__VLS_452, new __VLS_452({
    gutter: (24),
}));
const __VLS_454 = __VLS_453({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_453));
__VLS_455.slots.default;
const __VLS_456 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_457 = __VLS_asFunctionalComponent(__VLS_456, new __VLS_456({
    span: (4),
}));
const __VLS_458 = __VLS_457({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_457));
__VLS_459.slots.default;
const __VLS_460 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_461 = __VLS_asFunctionalComponent(__VLS_460, new __VLS_460({
    label: "贝壳成交单价",
}));
const __VLS_462 = __VLS_461({
    label: "贝壳成交单价",
}, ...__VLS_functionalComponentArgsRest(__VLS_461));
__VLS_463.slots.default;
const __VLS_464 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_465 = __VLS_asFunctionalComponent(__VLS_464, new __VLS_464({
    modelValue: (__VLS_ctx.form.beike_latest_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}));
const __VLS_466 = __VLS_465({
    modelValue: (__VLS_ctx.form.beike_latest_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_465));
var __VLS_463;
var __VLS_459;
const __VLS_468 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_469 = __VLS_asFunctionalComponent(__VLS_468, new __VLS_468({
    span: (4),
}));
const __VLS_470 = __VLS_469({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_469));
__VLS_471.slots.default;
const __VLS_472 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_473 = __VLS_asFunctionalComponent(__VLS_472, new __VLS_472({
    label: "贝壳成交总价(元)",
}));
const __VLS_474 = __VLS_473({
    label: "贝壳成交总价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_473));
__VLS_475.slots.default;
const __VLS_476 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_477 = __VLS_asFunctionalComponent(__VLS_476, new __VLS_476({
    modelValue: (__VLS_ctx.form.beike_latest_deal_total_price),
    min: (0),
    theme: "normal",
}));
const __VLS_478 = __VLS_477({
    modelValue: (__VLS_ctx.form.beike_latest_deal_total_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_477));
var __VLS_475;
var __VLS_471;
const __VLS_480 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_481 = __VLS_asFunctionalComponent(__VLS_480, new __VLS_480({
    span: (4),
}));
const __VLS_482 = __VLS_481({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_481));
__VLS_483.slots.default;
const __VLS_484 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_485 = __VLS_asFunctionalComponent(__VLS_484, new __VLS_484({
    label: "贝壳成交时间",
}));
const __VLS_486 = __VLS_485({
    label: "贝壳成交时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_485));
__VLS_487.slots.default;
const __VLS_488 = {}.TDatePicker;
/** @type {[typeof __VLS_components.TDatePicker, typeof __VLS_components.tDatePicker, ]} */ ;
// @ts-ignore
const __VLS_489 = __VLS_asFunctionalComponent(__VLS_488, new __VLS_488({
    modelValue: (__VLS_ctx.form.beike_latest_deal_time),
    enableTimePicker: true,
}));
const __VLS_490 = __VLS_489({
    modelValue: (__VLS_ctx.form.beike_latest_deal_time),
    enableTimePicker: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_489));
var __VLS_487;
var __VLS_483;
var __VLS_455;
var __VLS_451;
var __VLS_447;
const __VLS_492 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_493 = __VLS_asFunctionalComponent(__VLS_492, new __VLS_492({
    title: "拍卖信息",
    ...{ style: {} },
}));
const __VLS_494 = __VLS_493({
    title: "拍卖信息",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_493));
__VLS_495.slots.default;
const __VLS_496 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_497 = __VLS_asFunctionalComponent(__VLS_496, new __VLS_496({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}));
const __VLS_498 = __VLS_497({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}, ...__VLS_functionalComponentArgsRest(__VLS_497));
__VLS_499.slots.default;
const __VLS_500 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_501 = __VLS_asFunctionalComponent(__VLS_500, new __VLS_500({
    gutter: (24),
}));
const __VLS_502 = __VLS_501({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_501));
__VLS_503.slots.default;
const __VLS_504 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_505 = __VLS_asFunctionalComponent(__VLS_504, new __VLS_504({
    span: (3),
}));
const __VLS_506 = __VLS_505({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_505));
__VLS_507.slots.default;
const __VLS_508 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_509 = __VLS_asFunctionalComponent(__VLS_508, new __VLS_508({
    label: "拍卖轮次",
}));
const __VLS_510 = __VLS_509({
    label: "拍卖轮次",
}, ...__VLS_functionalComponentArgsRest(__VLS_509));
__VLS_511.slots.default;
const __VLS_512 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_513 = __VLS_asFunctionalComponent(__VLS_512, new __VLS_512({
    modelValue: (__VLS_ctx.form.auction_round),
}));
const __VLS_514 = __VLS_513({
    modelValue: (__VLS_ctx.form.auction_round),
}, ...__VLS_functionalComponentArgsRest(__VLS_513));
__VLS_515.slots.default;
const __VLS_516 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_517 = __VLS_asFunctionalComponent(__VLS_516, new __VLS_516({
    value: "一拍",
}));
const __VLS_518 = __VLS_517({
    value: "一拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_517));
const __VLS_520 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_521 = __VLS_asFunctionalComponent(__VLS_520, new __VLS_520({
    value: "二拍",
}));
const __VLS_522 = __VLS_521({
    value: "二拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_521));
const __VLS_524 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_525 = __VLS_asFunctionalComponent(__VLS_524, new __VLS_524({
    value: "变卖",
}));
const __VLS_526 = __VLS_525({
    value: "变卖",
}, ...__VLS_functionalComponentArgsRest(__VLS_525));
var __VLS_515;
var __VLS_511;
var __VLS_507;
const __VLS_528 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_529 = __VLS_asFunctionalComponent(__VLS_528, new __VLS_528({
    span: (3),
}));
const __VLS_530 = __VLS_529({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_529));
__VLS_531.slots.default;
const __VLS_532 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_533 = __VLS_asFunctionalComponent(__VLS_532, new __VLS_532({
    label: "拍卖状态",
}));
const __VLS_534 = __VLS_533({
    label: "拍卖状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_533));
__VLS_535.slots.default;
const __VLS_536 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_537 = __VLS_asFunctionalComponent(__VLS_536, new __VLS_536({
    modelValue: (__VLS_ctx.form.auction_status),
}));
const __VLS_538 = __VLS_537({
    modelValue: (__VLS_ctx.form.auction_status),
}, ...__VLS_functionalComponentArgsRest(__VLS_537));
__VLS_539.slots.default;
const __VLS_540 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_541 = __VLS_asFunctionalComponent(__VLS_540, new __VLS_540({
    value: "即将开拍",
}));
const __VLS_542 = __VLS_541({
    value: "即将开拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_541));
const __VLS_544 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_545 = __VLS_asFunctionalComponent(__VLS_544, new __VLS_544({
    value: "进行中",
}));
const __VLS_546 = __VLS_545({
    value: "进行中",
}, ...__VLS_functionalComponentArgsRest(__VLS_545));
const __VLS_548 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_549 = __VLS_asFunctionalComponent(__VLS_548, new __VLS_548({
    value: "已结束",
}));
const __VLS_550 = __VLS_549({
    value: "已结束",
}, ...__VLS_functionalComponentArgsRest(__VLS_549));
const __VLS_552 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_553 = __VLS_asFunctionalComponent(__VLS_552, new __VLS_552({
    value: "已成交",
}));
const __VLS_554 = __VLS_553({
    value: "已成交",
}, ...__VLS_functionalComponentArgsRest(__VLS_553));
const __VLS_556 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_557 = __VLS_asFunctionalComponent(__VLS_556, new __VLS_556({
    value: "中止",
}));
const __VLS_558 = __VLS_557({
    value: "中止",
}, ...__VLS_functionalComponentArgsRest(__VLS_557));
const __VLS_560 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_561 = __VLS_asFunctionalComponent(__VLS_560, new __VLS_560({
    value: "撤回",
}));
const __VLS_562 = __VLS_561({
    value: "撤回",
}, ...__VLS_functionalComponentArgsRest(__VLS_561));
var __VLS_539;
var __VLS_535;
var __VLS_531;
const __VLS_564 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_565 = __VLS_asFunctionalComponent(__VLS_564, new __VLS_564({
    span: (3),
}));
const __VLS_566 = __VLS_565({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_565));
__VLS_567.slots.default;
const __VLS_568 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_569 = __VLS_asFunctionalComponent(__VLS_568, new __VLS_568({
    label: "开拍时间",
}));
const __VLS_570 = __VLS_569({
    label: "开拍时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_569));
__VLS_571.slots.default;
const __VLS_572 = {}.TDatePicker;
/** @type {[typeof __VLS_components.TDatePicker, typeof __VLS_components.tDatePicker, ]} */ ;
// @ts-ignore
const __VLS_573 = __VLS_asFunctionalComponent(__VLS_572, new __VLS_572({
    modelValue: (__VLS_ctx.form.auction_start_time),
    enableTimePicker: true,
}));
const __VLS_574 = __VLS_573({
    modelValue: (__VLS_ctx.form.auction_start_time),
    enableTimePicker: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_573));
var __VLS_571;
var __VLS_567;
const __VLS_576 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_577 = __VLS_asFunctionalComponent(__VLS_576, new __VLS_576({
    span: (3),
}));
const __VLS_578 = __VLS_577({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_577));
__VLS_579.slots.default;
const __VLS_580 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_581 = __VLS_asFunctionalComponent(__VLS_580, new __VLS_580({
    label: "结束时间",
}));
const __VLS_582 = __VLS_581({
    label: "结束时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_581));
__VLS_583.slots.default;
const __VLS_584 = {}.TDatePicker;
/** @type {[typeof __VLS_components.TDatePicker, typeof __VLS_components.tDatePicker, ]} */ ;
// @ts-ignore
const __VLS_585 = __VLS_asFunctionalComponent(__VLS_584, new __VLS_584({
    modelValue: (__VLS_ctx.form.auction_end_time),
    enableTimePicker: true,
}));
const __VLS_586 = __VLS_585({
    modelValue: (__VLS_ctx.form.auction_end_time),
    enableTimePicker: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_585));
var __VLS_583;
var __VLS_579;
const __VLS_588 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_589 = __VLS_asFunctionalComponent(__VLS_588, new __VLS_588({
    span: (6),
}));
const __VLS_590 = __VLS_589({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_589));
__VLS_591.slots.default;
const __VLS_592 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_593 = __VLS_asFunctionalComponent(__VLS_592, new __VLS_592({
    label: "拍卖法院",
}));
const __VLS_594 = __VLS_593({
    label: "拍卖法院",
}, ...__VLS_functionalComponentArgsRest(__VLS_593));
__VLS_595.slots.default;
const __VLS_596 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_597 = __VLS_asFunctionalComponent(__VLS_596, new __VLS_596({
    modelValue: (__VLS_ctx.form.court_name),
}));
const __VLS_598 = __VLS_597({
    modelValue: (__VLS_ctx.form.court_name),
}, ...__VLS_functionalComponentArgsRest(__VLS_597));
var __VLS_595;
var __VLS_591;
const __VLS_600 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_601 = __VLS_asFunctionalComponent(__VLS_600, new __VLS_600({
    span: (3),
}));
const __VLS_602 = __VLS_601({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_601));
__VLS_603.slots.default;
const __VLS_604 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_605 = __VLS_asFunctionalComponent(__VLS_604, new __VLS_604({
    label: "案号",
}));
const __VLS_606 = __VLS_605({
    label: "案号",
}, ...__VLS_functionalComponentArgsRest(__VLS_605));
__VLS_607.slots.default;
const __VLS_608 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_609 = __VLS_asFunctionalComponent(__VLS_608, new __VLS_608({
    modelValue: (__VLS_ctx.form.case_number),
}));
const __VLS_610 = __VLS_609({
    modelValue: (__VLS_ctx.form.case_number),
}, ...__VLS_functionalComponentArgsRest(__VLS_609));
var __VLS_607;
var __VLS_603;
const __VLS_612 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_613 = __VLS_asFunctionalComponent(__VLS_612, new __VLS_612({
    span: (3),
}));
const __VLS_614 = __VLS_613({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_613));
__VLS_615.slots.default;
const __VLS_616 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_617 = __VLS_asFunctionalComponent(__VLS_616, new __VLS_616({
    label: "围观人数",
}));
const __VLS_618 = __VLS_617({
    label: "围观人数",
}, ...__VLS_functionalComponentArgsRest(__VLS_617));
__VLS_619.slots.default;
const __VLS_620 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_621 = __VLS_asFunctionalComponent(__VLS_620, new __VLS_620({
    modelValue: (__VLS_ctx.form.view_count),
    min: (0),
}));
const __VLS_622 = __VLS_621({
    modelValue: (__VLS_ctx.form.view_count),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_621));
var __VLS_619;
var __VLS_615;
const __VLS_624 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_625 = __VLS_asFunctionalComponent(__VLS_624, new __VLS_624({
    span: (3),
}));
const __VLS_626 = __VLS_625({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_625));
__VLS_627.slots.default;
const __VLS_628 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_629 = __VLS_asFunctionalComponent(__VLS_628, new __VLS_628({
    label: "参拍人数",
}));
const __VLS_630 = __VLS_629({
    label: "参拍人数",
}, ...__VLS_functionalComponentArgsRest(__VLS_629));
__VLS_631.slots.default;
const __VLS_632 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_633 = __VLS_asFunctionalComponent(__VLS_632, new __VLS_632({
    modelValue: (__VLS_ctx.form.participant_count),
    min: (0),
}));
const __VLS_634 = __VLS_633({
    modelValue: (__VLS_ctx.form.participant_count),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_633));
var __VLS_631;
var __VLS_627;
const __VLS_636 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_637 = __VLS_asFunctionalComponent(__VLS_636, new __VLS_636({
    span: (3),
}));
const __VLS_638 = __VLS_637({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_637));
__VLS_639.slots.default;
const __VLS_640 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_641 = __VLS_asFunctionalComponent(__VLS_640, new __VLS_640({
    label: "支持贷款",
}));
const __VLS_642 = __VLS_641({
    label: "支持贷款",
}, ...__VLS_functionalComponentArgsRest(__VLS_641));
__VLS_643.slots.default;
const __VLS_644 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_645 = __VLS_asFunctionalComponent(__VLS_644, new __VLS_644({
    modelValue: (__VLS_ctx.form.loan_support),
    clearable: (true),
}));
const __VLS_646 = __VLS_645({
    modelValue: (__VLS_ctx.form.loan_support),
    clearable: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_645));
__VLS_647.slots.default;
const __VLS_648 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_649 = __VLS_asFunctionalComponent(__VLS_648, new __VLS_648({
    value: (true),
    label: "是",
}));
const __VLS_650 = __VLS_649({
    value: (true),
    label: "是",
}, ...__VLS_functionalComponentArgsRest(__VLS_649));
const __VLS_652 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_653 = __VLS_asFunctionalComponent(__VLS_652, new __VLS_652({
    value: (false),
    label: "否",
}));
const __VLS_654 = __VLS_653({
    value: (false),
    label: "否",
}, ...__VLS_functionalComponentArgsRest(__VLS_653));
var __VLS_647;
var __VLS_643;
var __VLS_639;
var __VLS_503;
var __VLS_499;
var __VLS_495;
const __VLS_656 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_657 = __VLS_asFunctionalComponent(__VLS_656, new __VLS_656({
    title: "描述",
    ...{ style: {} },
}));
const __VLS_658 = __VLS_657({
    title: "描述",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_657));
__VLS_659.slots.default;
const __VLS_660 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_661 = __VLS_asFunctionalComponent(__VLS_660, new __VLS_660({
    modelValue: (__VLS_ctx.form.description),
    maxlength: (2000),
    autosize: ({ minRows: 3, maxRows: 8 }),
}));
const __VLS_662 = __VLS_661({
    modelValue: (__VLS_ctx.form.description),
    maxlength: (2000),
    autosize: ({ minRows: 3, maxRows: 8 }),
}, ...__VLS_functionalComponentArgsRest(__VLS_661));
var __VLS_659;
if (__VLS_ctx.isEdit) {
    const __VLS_664 = {}.TCard;
    /** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
    // @ts-ignore
    const __VLS_665 = __VLS_asFunctionalComponent(__VLS_664, new __VLS_664({
        ...{ style: {} },
    }));
    const __VLS_666 = __VLS_665({
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_665));
    __VLS_667.slots.default;
    {
        const { title: __VLS_thisSlot } = __VLS_667.slots;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-title-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        if (__VLS_ctx.community.info) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "ci-source" },
            });
            (__VLS_ctx.community.info.source || '手工');
        }
    }
    {
        const { actions: __VLS_thisSlot } = __VLS_667.slots;
        const __VLS_668 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_669 = __VLS_asFunctionalComponent(__VLS_668, new __VLS_668({
            ...{ 'onClick': {} },
            size: "small",
            theme: "primary",
            loading: (__VLS_ctx.refreshingCommunity),
        }));
        const __VLS_670 = __VLS_669({
            ...{ 'onClick': {} },
            size: "small",
            theme: "primary",
            loading: (__VLS_ctx.refreshingCommunity),
        }, ...__VLS_functionalComponentArgsRest(__VLS_669));
        let __VLS_672;
        let __VLS_673;
        let __VLS_674;
        const __VLS_675 = {
            onClick: (__VLS_ctx.refreshCommunity)
        };
        __VLS_671.slots.default;
        var __VLS_671;
    }
    if (!__VLS_ctx.form.community_name) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-empty" },
        });
    }
    else if (!__VLS_ctx.community.info) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-empty" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
        (__VLS_ctx.form.community_name);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        const __VLS_676 = {}.TRow;
        /** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
        // @ts-ignore
        const __VLS_677 = __VLS_asFunctionalComponent(__VLS_676, new __VLS_676({
            gutter: (16),
            ...{ style: {} },
        }));
        const __VLS_678 = __VLS_677({
            gutter: (16),
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_677));
        __VLS_679.slots.default;
        const __VLS_680 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_681 = __VLS_asFunctionalComponent(__VLS_680, new __VLS_680({
            span: (3),
        }));
        const __VLS_682 = __VLS_681({
            span: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_681));
        __VLS_683.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-num accent" },
        });
        (__VLS_ctx.formatPriceCN(__VLS_ctx.community.info.avg_price));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-label" },
        });
        var __VLS_683;
        const __VLS_684 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_685 = __VLS_asFunctionalComponent(__VLS_684, new __VLS_684({
            span: (3),
        }));
        const __VLS_686 = __VLS_685({
            span: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_685));
        __VLS_687.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-num" },
        });
        (__VLS_ctx.community.info.build_year_start || '—');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-label" },
        });
        var __VLS_687;
        const __VLS_688 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_689 = __VLS_asFunctionalComponent(__VLS_688, new __VLS_688({
            span: (3),
        }));
        const __VLS_690 = __VLS_689({
            span: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_689));
        __VLS_691.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-num" },
        });
        (__VLS_ctx.community.info.total_units || '—');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-label" },
        });
        var __VLS_691;
        const __VLS_692 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_693 = __VLS_asFunctionalComponent(__VLS_692, new __VLS_692({
            span: (3),
        }));
        const __VLS_694 = __VLS_693({
            span: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_693));
        __VLS_695.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-num" },
        });
        (__VLS_ctx.community.info.on_sale_count || '—');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-label" },
        });
        var __VLS_695;
        var __VLS_679;
        if (__VLS_ctx.community.info.description) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "ci-desc" },
            });
            (__VLS_ctx.community.info.description);
        }
        const __VLS_696 = {}.TRow;
        /** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
        // @ts-ignore
        const __VLS_697 = __VLS_asFunctionalComponent(__VLS_696, new __VLS_696({
            gutter: (24),
        }));
        const __VLS_698 = __VLS_697({
            gutter: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_697));
        __VLS_699.slots.default;
        const __VLS_700 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_701 = __VLS_asFunctionalComponent(__VLS_700, new __VLS_700({
            span: (6),
        }));
        const __VLS_702 = __VLS_701({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_701));
        __VLS_703.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.address_full || '—');
        var __VLS_703;
        const __VLS_704 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_705 = __VLS_asFunctionalComponent(__VLS_704, new __VLS_704({
            span: (6),
        }));
        const __VLS_706 = __VLS_705({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_705));
        __VLS_707.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.property_type || '—');
        var __VLS_707;
        const __VLS_708 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_709 = __VLS_asFunctionalComponent(__VLS_708, new __VLS_708({
            span: (6),
        }));
        const __VLS_710 = __VLS_709({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_709));
        __VLS_711.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.developer || '—');
        var __VLS_711;
        const __VLS_712 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_713 = __VLS_asFunctionalComponent(__VLS_712, new __VLS_712({
            span: (6),
        }));
        const __VLS_714 = __VLS_713({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_713));
        __VLS_715.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.property_company || '—');
        var __VLS_715;
        const __VLS_716 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_717 = __VLS_asFunctionalComponent(__VLS_716, new __VLS_716({
            span: (6),
        }));
        const __VLS_718 = __VLS_717({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_717));
        __VLS_719.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.property_fee || '—');
        var __VLS_719;
        const __VLS_720 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_721 = __VLS_asFunctionalComponent(__VLS_720, new __VLS_720({
            span: (6),
        }));
        const __VLS_722 = __VLS_721({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_721));
        __VLS_723.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.plot_ratio || '—');
        var __VLS_723;
        const __VLS_724 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_725 = __VLS_asFunctionalComponent(__VLS_724, new __VLS_724({
            span: (6),
        }));
        const __VLS_726 = __VLS_725({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_725));
        __VLS_727.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.green_rate ? (__VLS_ctx.community.info.green_rate * 100).toFixed(0) + '%' : '—');
        var __VLS_727;
        const __VLS_728 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_729 = __VLS_asFunctionalComponent(__VLS_728, new __VLS_728({
            span: (6),
        }));
        const __VLS_730 = __VLS_729({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_729));
        __VLS_731.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.total_buildings || '—');
        var __VLS_731;
        const __VLS_732 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_733 = __VLS_asFunctionalComponent(__VLS_732, new __VLS_732({
            span: (12),
        }));
        const __VLS_734 = __VLS_733({
            span: (12),
        }, ...__VLS_functionalComponentArgsRest(__VLS_733));
        __VLS_735.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.huxing_summary || '—');
        var __VLS_735;
        const __VLS_736 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_737 = __VLS_asFunctionalComponent(__VLS_736, new __VLS_736({
            span: (6),
        }));
        const __VLS_738 = __VLS_737({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_737));
        __VLS_739.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        if (__VLS_ctx.community.info.beike_url) {
            const __VLS_740 = {}.TLink;
            /** @type {[typeof __VLS_components.TLink, typeof __VLS_components.tLink, typeof __VLS_components.TLink, typeof __VLS_components.tLink, ]} */ ;
            // @ts-ignore
            const __VLS_741 = __VLS_asFunctionalComponent(__VLS_740, new __VLS_740({
                href: (__VLS_ctx.community.info.beike_url),
                target: "_blank",
                theme: "primary",
            }));
            const __VLS_742 = __VLS_741({
                href: (__VLS_ctx.community.info.beike_url),
                target: "_blank",
                theme: "primary",
            }, ...__VLS_functionalComponentArgsRest(__VLS_741));
            __VLS_743.slots.default;
            var __VLS_743;
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "ci-v" },
            });
        }
        var __VLS_739;
        const __VLS_744 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_745 = __VLS_asFunctionalComponent(__VLS_744, new __VLS_744({
            span: (6),
        }));
        const __VLS_746 = __VLS_745({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_745));
        __VLS_747.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.last_crawled_at || '—');
        var __VLS_747;
        var __VLS_699;
    }
    var __VLS_667;
}
if (__VLS_ctx.isEdit) {
    const __VLS_748 = {}.TCard;
    /** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
    // @ts-ignore
    const __VLS_749 = __VLS_asFunctionalComponent(__VLS_748, new __VLS_748({
        title: "房源图片",
        ...{ style: {} },
    }));
    const __VLS_750 = __VLS_749({
        title: "房源图片",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_749));
    __VLS_751.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "file-gallery" },
    });
    for (const [img, idx] of __VLS_getVForSourceType((__VLS_ctx.images))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "file-item" },
            key: (idx),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (img.image_url),
            ...{ class: "gallery-img" },
        });
        const __VLS_752 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_753 = __VLS_asFunctionalComponent(__VLS_752, new __VLS_752({
            ...{ 'onClick': {} },
            size: "small",
            theme: "danger",
            variant: "text",
        }));
        const __VLS_754 = __VLS_753({
            ...{ 'onClick': {} },
            size: "small",
            theme: "danger",
            variant: "text",
        }, ...__VLS_functionalComponentArgsRest(__VLS_753));
        let __VLS_756;
        let __VLS_757;
        let __VLS_758;
        const __VLS_759 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.isEdit))
                    return;
                __VLS_ctx.removeImage(idx);
            }
        };
        __VLS_755.slots.default;
        var __VLS_755;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isEdit))
                    return;
                __VLS_ctx.triggerUpload('image');
            } },
        ...{ class: "upload-trigger" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "upload-icon" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (...[$event]) => {
                if (!(__VLS_ctx.isEdit))
                    return;
                __VLS_ctx.onFileChange($event, 'image');
            } },
        ref: "imageInput",
        type: "file",
        accept: "image/*",
        ...{ style: {} },
    });
    /** @type {typeof __VLS_ctx.imageInput} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "upload-tip" },
    });
    var __VLS_751;
}
if (__VLS_ctx.isEdit) {
    const __VLS_760 = {}.TCard;
    /** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
    // @ts-ignore
    const __VLS_761 = __VLS_asFunctionalComponent(__VLS_760, new __VLS_760({
        title: "附件文档",
        ...{ style: {} },
    }));
    const __VLS_762 = __VLS_761({
        title: "附件文档",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_761));
    __VLS_763.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "attachment-list" },
    });
    for (const [att, idx] of __VLS_getVForSourceType((__VLS_ctx.attachments))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "attachment-item" },
            key: (idx),
        });
        const __VLS_764 = {}.TLink;
        /** @type {[typeof __VLS_components.TLink, typeof __VLS_components.tLink, typeof __VLS_components.TLink, typeof __VLS_components.tLink, ]} */ ;
        // @ts-ignore
        const __VLS_765 = __VLS_asFunctionalComponent(__VLS_764, new __VLS_764({
            href: (att.url),
            target: "_blank",
        }));
        const __VLS_766 = __VLS_765({
            href: (att.url),
            target: "_blank",
        }, ...__VLS_functionalComponentArgsRest(__VLS_765));
        __VLS_767.slots.default;
        (att.filename);
        var __VLS_767;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "att-size" },
        });
        (__VLS_ctx.formatSize(att.size));
        const __VLS_768 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_769 = __VLS_asFunctionalComponent(__VLS_768, new __VLS_768({
            ...{ 'onClick': {} },
            size: "small",
            theme: "danger",
            variant: "text",
        }));
        const __VLS_770 = __VLS_769({
            ...{ 'onClick': {} },
            size: "small",
            theme: "danger",
            variant: "text",
        }, ...__VLS_functionalComponentArgsRest(__VLS_769));
        let __VLS_772;
        let __VLS_773;
        let __VLS_774;
        const __VLS_775 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.isEdit))
                    return;
                __VLS_ctx.removeAttachment(idx);
            }
        };
        __VLS_771.slots.default;
        var __VLS_771;
    }
    if (!__VLS_ctx.attachments.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-att" },
        });
    }
    const __VLS_776 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_777 = __VLS_asFunctionalComponent(__VLS_776, new __VLS_776({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ style: {} },
    }));
    const __VLS_778 = __VLS_777({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_777));
    let __VLS_780;
    let __VLS_781;
    let __VLS_782;
    const __VLS_783 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.isEdit))
                return;
            __VLS_ctx.triggerUpload('doc');
        }
    };
    __VLS_779.slots.default;
    var __VLS_779;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (...[$event]) => {
                if (!(__VLS_ctx.isEdit))
                    return;
                __VLS_ctx.onFileChange($event, 'doc');
            } },
        ref: "docInput",
        type: "file",
        accept: ".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt",
        ...{ style: {} },
    });
    /** @type {typeof __VLS_ctx.docInput} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "upload-tip" },
    });
    var __VLS_763;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-actions" },
});
const __VLS_784 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_785 = __VLS_asFunctionalComponent(__VLS_784, new __VLS_784({
    ...{ 'onClick': {} },
    theme: "primary",
    size: "large",
    loading: (__VLS_ctx.submitting),
}));
const __VLS_786 = __VLS_785({
    ...{ 'onClick': {} },
    theme: "primary",
    size: "large",
    loading: (__VLS_ctx.submitting),
}, ...__VLS_functionalComponentArgsRest(__VLS_785));
let __VLS_788;
let __VLS_789;
let __VLS_790;
const __VLS_791 = {
    onClick: (__VLS_ctx.onSubmit)
};
__VLS_787.slots.default;
var __VLS_787;
const __VLS_792 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_793 = __VLS_asFunctionalComponent(__VLS_792, new __VLS_792({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "large",
}));
const __VLS_794 = __VLS_793({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_793));
let __VLS_796;
let __VLS_797;
let __VLS_798;
const __VLS_799 = {
    onClick: (...[$event]) => {
        __VLS_ctx.router.back();
    }
};
__VLS_795.slots.default;
var __VLS_795;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-title-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-source']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-stat']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-num']} */ ;
/** @type {__VLS_StyleScopedClasses['accent']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-label']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-stat']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-num']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-label']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-stat']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-num']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-label']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-stat']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-num']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-label']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-k']} */ ;
/** @type {__VLS_StyleScopedClasses['ci-v']} */ ;
/** @type {__VLS_StyleScopedClasses['file-gallery']} */ ;
/** @type {__VLS_StyleScopedClasses['file-item']} */ ;
/** @type {__VLS_StyleScopedClasses['gallery-img']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-tip']} */ ;
/** @type {__VLS_StyleScopedClasses['attachment-list']} */ ;
/** @type {__VLS_StyleScopedClasses['attachment-item']} */ ;
/** @type {__VLS_StyleScopedClasses['att-size']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-att']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-tip']} */ ;
/** @type {__VLS_StyleScopedClasses['form-actions']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            router: router,
            isEdit: isEdit,
            submitting: submitting,
            images: images,
            attachments: attachments,
            imageInput: imageInput,
            docInput: docInput,
            community: community,
            refreshingCommunity: refreshingCommunity,
            formatPriceCN: formatPriceCN,
            refreshCommunity: refreshCommunity,
            form: form,
            triggerUpload: triggerUpload,
            onFileChange: onFileChange,
            removeImage: removeImage,
            removeAttachment: removeAttachment,
            formatSize: formatSize,
            onSubmit: onSubmit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
