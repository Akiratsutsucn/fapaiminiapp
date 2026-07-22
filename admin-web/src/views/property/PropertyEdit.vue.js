/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getProperty, createProperty, updateProperty, getPropertyCommunity, refreshPropertyCommunity, toggleImageHidden } from '@/api/properties';
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
    has_attachments: null,
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
const junkLabels = {
    qrcode: '二维码', banner: '广告条幅', logo: 'logo广告', solid: '纯色图', manual: '手动隐藏',
};
function junkLabel(reason) {
    return junkLabels[reason] || '广告';
}
async function toggleHidden(img) {
    if (!img.id) {
        MessagePlugin.warning('该图片尚未保存，无法切换');
        return;
    }
    try {
        const res = await toggleImageHidden(img.id);
        img.hidden = res.hidden;
        if (!res.hidden)
            img.hide_reason = null;
        MessagePlugin.success(res.hidden ? '已隐藏（前台不展示）' : '已恢复显示');
    }
    catch {
        MessagePlugin.error('操作失败');
    }
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
/** @type {__VLS_StyleScopedClasses['file-item']} */ ;
/** @type {__VLS_StyleScopedClasses['file-item']} */ ;
/** @type {__VLS_StyleScopedClasses['is-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['gallery-img']} */ ;
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
const __VLS_44 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    value: (330100),
    label: "杭州",
}));
const __VLS_46 = __VLS_45({
    value: (330100),
    label: "杭州",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
const __VLS_48 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    value: (371300),
    label: "临沂",
}));
const __VLS_50 = __VLS_49({
    value: (371300),
    label: "临沂",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
var __VLS_35;
var __VLS_31;
var __VLS_27;
const __VLS_52 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    span: (4),
}));
const __VLS_54 = __VLS_53({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
__VLS_55.slots.default;
const __VLS_56 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    label: "区",
}));
const __VLS_58 = __VLS_57({
    label: "区",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
const __VLS_60 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.form.district),
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.form.district),
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
var __VLS_59;
var __VLS_55;
const __VLS_64 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    span: (4),
}));
const __VLS_66 = __VLS_65({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
const __VLS_68 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    label: "板块",
}));
const __VLS_70 = __VLS_69({
    label: "板块",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
const __VLS_72 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    modelValue: (__VLS_ctx.form.sub_district),
}));
const __VLS_74 = __VLS_73({
    modelValue: (__VLS_ctx.form.sub_district),
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
var __VLS_71;
var __VLS_67;
const __VLS_76 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    span: (4),
}));
const __VLS_78 = __VLS_77({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
__VLS_79.slots.default;
const __VLS_80 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    label: "环线",
}));
const __VLS_82 = __VLS_81({
    label: "环线",
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
const __VLS_84 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    modelValue: (__VLS_ctx.form.ring_road),
}));
const __VLS_86 = __VLS_85({
    modelValue: (__VLS_ctx.form.ring_road),
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
var __VLS_83;
var __VLS_79;
const __VLS_88 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    span: (8),
}));
const __VLS_90 = __VLS_89({
    span: (8),
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_91.slots.default;
const __VLS_92 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    label: "地址",
}));
const __VLS_94 = __VLS_93({
    label: "地址",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
const __VLS_96 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    modelValue: (__VLS_ctx.form.address),
}));
const __VLS_98 = __VLS_97({
    modelValue: (__VLS_ctx.form.address),
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
var __VLS_95;
var __VLS_91;
const __VLS_100 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    span: (4),
}));
const __VLS_102 = __VLS_101({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
__VLS_103.slots.default;
const __VLS_104 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    label: "小区名",
}));
const __VLS_106 = __VLS_105({
    label: "小区名",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_107.slots.default;
const __VLS_108 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    modelValue: (__VLS_ctx.form.community_name),
}));
const __VLS_110 = __VLS_109({
    modelValue: (__VLS_ctx.form.community_name),
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
var __VLS_107;
var __VLS_103;
const __VLS_112 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    span: (4),
}));
const __VLS_114 = __VLS_113({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
const __VLS_116 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    label: "省市",
}));
const __VLS_118 = __VLS_117({
    label: "省市",
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
__VLS_119.slots.default;
const __VLS_120 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    modelValue: (__VLS_ctx.form.province_city),
}));
const __VLS_122 = __VLS_121({
    modelValue: (__VLS_ctx.form.province_city),
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
var __VLS_119;
var __VLS_115;
const __VLS_124 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    span: (4),
}));
const __VLS_126 = __VLS_125({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
__VLS_127.slots.default;
const __VLS_128 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    label: "是否可以贷款",
}));
const __VLS_130 = __VLS_129({
    label: "是否可以贷款",
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
const __VLS_132 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    modelValue: (__VLS_ctx.form.loan_support),
    clearable: (true),
}));
const __VLS_134 = __VLS_133({
    modelValue: (__VLS_ctx.form.loan_support),
    clearable: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
const __VLS_136 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    value: (true),
    label: "是",
}));
const __VLS_138 = __VLS_137({
    value: (true),
    label: "是",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
const __VLS_140 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    value: (false),
    label: "否",
}));
const __VLS_142 = __VLS_141({
    value: (false),
    label: "否",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
var __VLS_135;
var __VLS_131;
var __VLS_127;
const __VLS_144 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    span: (4),
}));
const __VLS_146 = __VLS_145({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
__VLS_147.slots.default;
const __VLS_148 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    label: "是否有附件",
}));
const __VLS_150 = __VLS_149({
    label: "是否有附件",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
__VLS_151.slots.default;
const __VLS_152 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    modelValue: (__VLS_ctx.form.has_attachments),
    clearable: (true),
}));
const __VLS_154 = __VLS_153({
    modelValue: (__VLS_ctx.form.has_attachments),
    clearable: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
__VLS_155.slots.default;
const __VLS_156 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    value: (true),
    label: "是",
}));
const __VLS_158 = __VLS_157({
    value: (true),
    label: "是",
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
const __VLS_160 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    value: (false),
    label: "否",
}));
const __VLS_162 = __VLS_161({
    value: (false),
    label: "否",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
var __VLS_155;
var __VLS_151;
var __VLS_147;
var __VLS_11;
var __VLS_7;
var __VLS_3;
const __VLS_164 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    title: "建筑信息",
    ...{ style: {} },
}));
const __VLS_166 = __VLS_165({
    title: "建筑信息",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
__VLS_167.slots.default;
const __VLS_168 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}));
const __VLS_170 = __VLS_169({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
__VLS_171.slots.default;
const __VLS_172 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    gutter: (24),
}));
const __VLS_174 = __VLS_173({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
__VLS_175.slots.default;
const __VLS_176 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    span: (3),
}));
const __VLS_178 = __VLS_177({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
__VLS_179.slots.default;
const __VLS_180 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    label: "物业类型",
}));
const __VLS_182 = __VLS_181({
    label: "物业类型",
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
__VLS_183.slots.default;
const __VLS_184 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    modelValue: (__VLS_ctx.form.property_type),
}));
const __VLS_186 = __VLS_185({
    modelValue: (__VLS_ctx.form.property_type),
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
const __VLS_188 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    value: "住宅",
}));
const __VLS_190 = __VLS_189({
    value: "住宅",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
const __VLS_192 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    value: "商铺",
}));
const __VLS_194 = __VLS_193({
    value: "商铺",
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
const __VLS_196 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    value: "写字楼",
}));
const __VLS_198 = __VLS_197({
    value: "写字楼",
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
const __VLS_200 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    value: "商住房",
}));
const __VLS_202 = __VLS_201({
    value: "商住房",
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
const __VLS_204 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    value: "其他商用",
}));
const __VLS_206 = __VLS_205({
    value: "其他商用",
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
const __VLS_208 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    value: "工业",
}));
const __VLS_210 = __VLS_209({
    value: "工业",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
const __VLS_212 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    value: "土地",
}));
const __VLS_214 = __VLS_213({
    value: "土地",
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
var __VLS_187;
var __VLS_183;
var __VLS_179;
const __VLS_216 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    span: (3),
}));
const __VLS_218 = __VLS_217({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
__VLS_219.slots.default;
const __VLS_220 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    label: "面积(m2)",
}));
const __VLS_222 = __VLS_221({
    label: "面积(m2)",
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
__VLS_223.slots.default;
const __VLS_224 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    modelValue: (__VLS_ctx.form.area),
    min: (0),
    decimalPlaces: (2),
}));
const __VLS_226 = __VLS_225({
    modelValue: (__VLS_ctx.form.area),
    min: (0),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
var __VLS_223;
var __VLS_219;
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
    label: "户型",
}));
const __VLS_234 = __VLS_233({
    label: "户型",
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
__VLS_235.slots.default;
const __VLS_236 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    modelValue: (__VLS_ctx.form.layout),
}));
const __VLS_238 = __VLS_237({
    modelValue: (__VLS_ctx.form.layout),
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
    label: "楼层",
}));
const __VLS_246 = __VLS_245({
    label: "楼层",
}, ...__VLS_functionalComponentArgsRest(__VLS_245));
__VLS_247.slots.default;
const __VLS_248 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
    modelValue: (__VLS_ctx.form.floor_info),
}));
const __VLS_250 = __VLS_249({
    modelValue: (__VLS_ctx.form.floor_info),
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
    label: "总楼层",
}));
const __VLS_258 = __VLS_257({
    label: "总楼层",
}, ...__VLS_functionalComponentArgsRest(__VLS_257));
__VLS_259.slots.default;
const __VLS_260 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
    modelValue: (__VLS_ctx.form.total_floors),
    min: (0),
}));
const __VLS_262 = __VLS_261({
    modelValue: (__VLS_ctx.form.total_floors),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_261));
var __VLS_259;
var __VLS_255;
const __VLS_264 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
    span: (3),
}));
const __VLS_266 = __VLS_265({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_265));
__VLS_267.slots.default;
const __VLS_268 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
    label: "电梯",
}));
const __VLS_270 = __VLS_269({
    label: "电梯",
}, ...__VLS_functionalComponentArgsRest(__VLS_269));
__VLS_271.slots.default;
const __VLS_272 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
    modelValue: (__VLS_ctx.form.has_elevator),
    clearable: (true),
}));
const __VLS_274 = __VLS_273({
    modelValue: (__VLS_ctx.form.has_elevator),
    clearable: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_273));
__VLS_275.slots.default;
const __VLS_276 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
    value: (true),
    label: "有",
}));
const __VLS_278 = __VLS_277({
    value: (true),
    label: "有",
}, ...__VLS_functionalComponentArgsRest(__VLS_277));
const __VLS_280 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
    value: (false),
    label: "无",
}));
const __VLS_282 = __VLS_281({
    value: (false),
    label: "无",
}, ...__VLS_functionalComponentArgsRest(__VLS_281));
var __VLS_275;
var __VLS_271;
var __VLS_267;
const __VLS_284 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
    span: (3),
}));
const __VLS_286 = __VLS_285({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_285));
__VLS_287.slots.default;
const __VLS_288 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
    label: "朝向",
}));
const __VLS_290 = __VLS_289({
    label: "朝向",
}, ...__VLS_functionalComponentArgsRest(__VLS_289));
__VLS_291.slots.default;
const __VLS_292 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
    modelValue: (__VLS_ctx.form.orientation),
}));
const __VLS_294 = __VLS_293({
    modelValue: (__VLS_ctx.form.orientation),
}, ...__VLS_functionalComponentArgsRest(__VLS_293));
var __VLS_291;
var __VLS_287;
const __VLS_296 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
    span: (3),
}));
const __VLS_298 = __VLS_297({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_297));
__VLS_299.slots.default;
const __VLS_300 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
    label: "装修",
}));
const __VLS_302 = __VLS_301({
    label: "装修",
}, ...__VLS_functionalComponentArgsRest(__VLS_301));
__VLS_303.slots.default;
const __VLS_304 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
    modelValue: (__VLS_ctx.form.decoration),
}));
const __VLS_306 = __VLS_305({
    modelValue: (__VLS_ctx.form.decoration),
}, ...__VLS_functionalComponentArgsRest(__VLS_305));
var __VLS_303;
var __VLS_299;
const __VLS_308 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
    span: (3),
}));
const __VLS_310 = __VLS_309({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_309));
__VLS_311.slots.default;
const __VLS_312 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
    label: "建筑年代",
}));
const __VLS_314 = __VLS_313({
    label: "建筑年代",
}, ...__VLS_functionalComponentArgsRest(__VLS_313));
__VLS_315.slots.default;
const __VLS_316 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
    modelValue: (__VLS_ctx.form.build_year),
    min: (1900),
    max: (2030),
}));
const __VLS_318 = __VLS_317({
    modelValue: (__VLS_ctx.form.build_year),
    min: (1900),
    max: (2030),
}, ...__VLS_functionalComponentArgsRest(__VLS_317));
var __VLS_315;
var __VLS_311;
var __VLS_175;
var __VLS_171;
var __VLS_167;
const __VLS_320 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
    title: "拍卖价格",
    ...{ style: {} },
}));
const __VLS_322 = __VLS_321({
    title: "拍卖价格",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_321));
__VLS_323.slots.default;
const __VLS_324 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}));
const __VLS_326 = __VLS_325({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}, ...__VLS_functionalComponentArgsRest(__VLS_325));
__VLS_327.slots.default;
const __VLS_328 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
    gutter: (24),
}));
const __VLS_330 = __VLS_329({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_329));
__VLS_331.slots.default;
const __VLS_332 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
    span: (4),
}));
const __VLS_334 = __VLS_333({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_333));
__VLS_335.slots.default;
const __VLS_336 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_337 = __VLS_asFunctionalComponent(__VLS_336, new __VLS_336({
    label: "起拍价(元)",
}));
const __VLS_338 = __VLS_337({
    label: "起拍价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_337));
__VLS_339.slots.default;
const __VLS_340 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_341 = __VLS_asFunctionalComponent(__VLS_340, new __VLS_340({
    modelValue: (__VLS_ctx.form.starting_price),
    min: (0),
    theme: "normal",
}));
const __VLS_342 = __VLS_341({
    modelValue: (__VLS_ctx.form.starting_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_341));
var __VLS_339;
var __VLS_335;
const __VLS_344 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_345 = __VLS_asFunctionalComponent(__VLS_344, new __VLS_344({
    span: (4),
}));
const __VLS_346 = __VLS_345({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_345));
__VLS_347.slots.default;
const __VLS_348 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_349 = __VLS_asFunctionalComponent(__VLS_348, new __VLS_348({
    label: "起拍单价",
}));
const __VLS_350 = __VLS_349({
    label: "起拍单价",
}, ...__VLS_functionalComponentArgsRest(__VLS_349));
__VLS_351.slots.default;
const __VLS_352 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
    modelValue: (__VLS_ctx.form.starting_unit_price),
    min: (0),
    decimalPlaces: (2),
    theme: "normal",
}));
const __VLS_354 = __VLS_353({
    modelValue: (__VLS_ctx.form.starting_unit_price),
    min: (0),
    decimalPlaces: (2),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_353));
var __VLS_351;
var __VLS_347;
const __VLS_356 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_357 = __VLS_asFunctionalComponent(__VLS_356, new __VLS_356({
    span: (4),
}));
const __VLS_358 = __VLS_357({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_357));
__VLS_359.slots.default;
const __VLS_360 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_361 = __VLS_asFunctionalComponent(__VLS_360, new __VLS_360({
    label: "评估价(元)",
}));
const __VLS_362 = __VLS_361({
    label: "评估价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_361));
__VLS_363.slots.default;
const __VLS_364 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_365 = __VLS_asFunctionalComponent(__VLS_364, new __VLS_364({
    modelValue: (__VLS_ctx.form.appraisal_price),
    min: (0),
    theme: "normal",
}));
const __VLS_366 = __VLS_365({
    modelValue: (__VLS_ctx.form.appraisal_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_365));
var __VLS_363;
var __VLS_359;
const __VLS_368 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({
    span: (4),
}));
const __VLS_370 = __VLS_369({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_369));
__VLS_371.slots.default;
const __VLS_372 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_373 = __VLS_asFunctionalComponent(__VLS_372, new __VLS_372({
    label: "法院折扣率",
}));
const __VLS_374 = __VLS_373({
    label: "法院折扣率",
}, ...__VLS_functionalComponentArgsRest(__VLS_373));
__VLS_375.slots.default;
const __VLS_376 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_377 = __VLS_asFunctionalComponent(__VLS_376, new __VLS_376({
    modelValue: (__VLS_ctx.form.court_discount_rate),
    min: (0),
    max: (1),
    step: (0.01),
    decimalPlaces: (2),
}));
const __VLS_378 = __VLS_377({
    modelValue: (__VLS_ctx.form.court_discount_rate),
    min: (0),
    max: (1),
    step: (0.01),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_377));
var __VLS_375;
var __VLS_371;
const __VLS_380 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_381 = __VLS_asFunctionalComponent(__VLS_380, new __VLS_380({
    span: (4),
}));
const __VLS_382 = __VLS_381({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_381));
__VLS_383.slots.default;
const __VLS_384 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_385 = __VLS_asFunctionalComponent(__VLS_384, new __VLS_384({
    label: "保证金(元)",
}));
const __VLS_386 = __VLS_385({
    label: "保证金(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_385));
__VLS_387.slots.default;
const __VLS_388 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_389 = __VLS_asFunctionalComponent(__VLS_388, new __VLS_388({
    modelValue: (__VLS_ctx.form.deposit),
    min: (0),
    theme: "normal",
}));
const __VLS_390 = __VLS_389({
    modelValue: (__VLS_ctx.form.deposit),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_389));
var __VLS_387;
var __VLS_383;
const __VLS_392 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_393 = __VLS_asFunctionalComponent(__VLS_392, new __VLS_392({
    span: (4),
}));
const __VLS_394 = __VLS_393({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_393));
__VLS_395.slots.default;
const __VLS_396 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_397 = __VLS_asFunctionalComponent(__VLS_396, new __VLS_396({
    label: "加价幅度(元)",
}));
const __VLS_398 = __VLS_397({
    label: "加价幅度(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_397));
__VLS_399.slots.default;
const __VLS_400 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_401 = __VLS_asFunctionalComponent(__VLS_400, new __VLS_400({
    modelValue: (__VLS_ctx.form.increment_amount),
    min: (0),
    theme: "normal",
}));
const __VLS_402 = __VLS_401({
    modelValue: (__VLS_ctx.form.increment_amount),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_401));
var __VLS_399;
var __VLS_395;
var __VLS_331;
var __VLS_327;
var __VLS_323;
const __VLS_404 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_405 = __VLS_asFunctionalComponent(__VLS_404, new __VLS_404({
    title: "市场价格",
    ...{ style: {} },
}));
const __VLS_406 = __VLS_405({
    title: "市场价格",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_405));
__VLS_407.slots.default;
const __VLS_408 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_409 = __VLS_asFunctionalComponent(__VLS_408, new __VLS_408({
    data: (__VLS_ctx.form),
    labelWidth: "130px",
}));
const __VLS_410 = __VLS_409({
    data: (__VLS_ctx.form),
    labelWidth: "130px",
}, ...__VLS_functionalComponentArgsRest(__VLS_409));
__VLS_411.slots.default;
const __VLS_412 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_413 = __VLS_asFunctionalComponent(__VLS_412, new __VLS_412({
    gutter: (24),
}));
const __VLS_414 = __VLS_413({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_413));
__VLS_415.slots.default;
const __VLS_416 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_417 = __VLS_asFunctionalComponent(__VLS_416, new __VLS_416({
    span: (4),
}));
const __VLS_418 = __VLS_417({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_417));
__VLS_419.slots.default;
const __VLS_420 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_421 = __VLS_asFunctionalComponent(__VLS_420, new __VLS_420({
    label: "市场成交价(元)",
}));
const __VLS_422 = __VLS_421({
    label: "市场成交价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_421));
__VLS_423.slots.default;
const __VLS_424 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_425 = __VLS_asFunctionalComponent(__VLS_424, new __VLS_424({
    modelValue: (__VLS_ctx.form.market_deal_price),
    min: (0),
    theme: "normal",
}));
const __VLS_426 = __VLS_425({
    modelValue: (__VLS_ctx.form.market_deal_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_425));
var __VLS_423;
var __VLS_419;
const __VLS_428 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_429 = __VLS_asFunctionalComponent(__VLS_428, new __VLS_428({
    span: (4),
}));
const __VLS_430 = __VLS_429({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_429));
__VLS_431.slots.default;
const __VLS_432 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({
    label: "市场成交单价",
}));
const __VLS_434 = __VLS_433({
    label: "市场成交单价",
}, ...__VLS_functionalComponentArgsRest(__VLS_433));
__VLS_435.slots.default;
const __VLS_436 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_437 = __VLS_asFunctionalComponent(__VLS_436, new __VLS_436({
    modelValue: (__VLS_ctx.form.market_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}));
const __VLS_438 = __VLS_437({
    modelValue: (__VLS_ctx.form.market_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_437));
var __VLS_435;
var __VLS_431;
const __VLS_440 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_441 = __VLS_asFunctionalComponent(__VLS_440, new __VLS_440({
    span: (4),
}));
const __VLS_442 = __VLS_441({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_441));
__VLS_443.slots.default;
const __VLS_444 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_445 = __VLS_asFunctionalComponent(__VLS_444, new __VLS_444({
    label: "市场折扣率",
}));
const __VLS_446 = __VLS_445({
    label: "市场折扣率",
}, ...__VLS_functionalComponentArgsRest(__VLS_445));
__VLS_447.slots.default;
const __VLS_448 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_449 = __VLS_asFunctionalComponent(__VLS_448, new __VLS_448({
    modelValue: (__VLS_ctx.form.market_discount_rate),
    min: (0),
    max: (1),
    step: (0.01),
    decimalPlaces: (2),
}));
const __VLS_450 = __VLS_449({
    modelValue: (__VLS_ctx.form.market_discount_rate),
    min: (0),
    max: (1),
    step: (0.01),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_449));
var __VLS_447;
var __VLS_443;
const __VLS_452 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_453 = __VLS_asFunctionalComponent(__VLS_452, new __VLS_452({
    span: (4),
}));
const __VLS_454 = __VLS_453({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_453));
__VLS_455.slots.default;
const __VLS_456 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_457 = __VLS_asFunctionalComponent(__VLS_456, new __VLS_456({
    label: "挂牌最低价(元)",
}));
const __VLS_458 = __VLS_457({
    label: "挂牌最低价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_457));
__VLS_459.slots.default;
const __VLS_460 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_461 = __VLS_asFunctionalComponent(__VLS_460, new __VLS_460({
    modelValue: (__VLS_ctx.form.listing_min_price),
    min: (0),
    theme: "normal",
}));
const __VLS_462 = __VLS_461({
    modelValue: (__VLS_ctx.form.listing_min_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_461));
var __VLS_459;
var __VLS_455;
const __VLS_464 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_465 = __VLS_asFunctionalComponent(__VLS_464, new __VLS_464({
    span: (4),
}));
const __VLS_466 = __VLS_465({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_465));
__VLS_467.slots.default;
const __VLS_468 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_469 = __VLS_asFunctionalComponent(__VLS_468, new __VLS_468({
    label: "最新成交单价",
}));
const __VLS_470 = __VLS_469({
    label: "最新成交单价",
}, ...__VLS_functionalComponentArgsRest(__VLS_469));
__VLS_471.slots.default;
const __VLS_472 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_473 = __VLS_asFunctionalComponent(__VLS_472, new __VLS_472({
    modelValue: (__VLS_ctx.form.latest_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}));
const __VLS_474 = __VLS_473({
    modelValue: (__VLS_ctx.form.latest_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_473));
var __VLS_471;
var __VLS_467;
const __VLS_476 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_477 = __VLS_asFunctionalComponent(__VLS_476, new __VLS_476({
    span: (4),
}));
const __VLS_478 = __VLS_477({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_477));
__VLS_479.slots.default;
const __VLS_480 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_481 = __VLS_asFunctionalComponent(__VLS_480, new __VLS_480({
    label: "最新总价(元)",
}));
const __VLS_482 = __VLS_481({
    label: "最新总价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_481));
__VLS_483.slots.default;
const __VLS_484 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_485 = __VLS_asFunctionalComponent(__VLS_484, new __VLS_484({
    modelValue: (__VLS_ctx.form.latest_total_price),
    min: (0),
    theme: "normal",
}));
const __VLS_486 = __VLS_485({
    modelValue: (__VLS_ctx.form.latest_total_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_485));
var __VLS_483;
var __VLS_479;
const __VLS_488 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_489 = __VLS_asFunctionalComponent(__VLS_488, new __VLS_488({
    span: (4),
}));
const __VLS_490 = __VLS_489({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_489));
__VLS_491.slots.default;
const __VLS_492 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_493 = __VLS_asFunctionalComponent(__VLS_492, new __VLS_492({
    label: "捡漏空间(元)",
}));
const __VLS_494 = __VLS_493({
    label: "捡漏空间(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_493));
__VLS_495.slots.default;
const __VLS_496 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_497 = __VLS_asFunctionalComponent(__VLS_496, new __VLS_496({
    modelValue: (__VLS_ctx.form.bargain_potential),
    min: (0),
    theme: "normal",
}));
const __VLS_498 = __VLS_497({
    modelValue: (__VLS_ctx.form.bargain_potential),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_497));
var __VLS_495;
var __VLS_491;
var __VLS_415;
var __VLS_411;
var __VLS_407;
const __VLS_500 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_501 = __VLS_asFunctionalComponent(__VLS_500, new __VLS_500({
    title: "贝壳参考",
    ...{ style: {} },
}));
const __VLS_502 = __VLS_501({
    title: "贝壳参考",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_501));
__VLS_503.slots.default;
const __VLS_504 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_505 = __VLS_asFunctionalComponent(__VLS_504, new __VLS_504({
    data: (__VLS_ctx.form),
    labelWidth: "130px",
}));
const __VLS_506 = __VLS_505({
    data: (__VLS_ctx.form),
    labelWidth: "130px",
}, ...__VLS_functionalComponentArgsRest(__VLS_505));
__VLS_507.slots.default;
const __VLS_508 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_509 = __VLS_asFunctionalComponent(__VLS_508, new __VLS_508({
    gutter: (24),
}));
const __VLS_510 = __VLS_509({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_509));
__VLS_511.slots.default;
const __VLS_512 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_513 = __VLS_asFunctionalComponent(__VLS_512, new __VLS_512({
    span: (4),
}));
const __VLS_514 = __VLS_513({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_513));
__VLS_515.slots.default;
const __VLS_516 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_517 = __VLS_asFunctionalComponent(__VLS_516, new __VLS_516({
    label: "贝壳成交单价",
}));
const __VLS_518 = __VLS_517({
    label: "贝壳成交单价",
}, ...__VLS_functionalComponentArgsRest(__VLS_517));
__VLS_519.slots.default;
const __VLS_520 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_521 = __VLS_asFunctionalComponent(__VLS_520, new __VLS_520({
    modelValue: (__VLS_ctx.form.beike_latest_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}));
const __VLS_522 = __VLS_521({
    modelValue: (__VLS_ctx.form.beike_latest_deal_unit_price),
    min: (0),
    decimalPlaces: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_521));
var __VLS_519;
var __VLS_515;
const __VLS_524 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_525 = __VLS_asFunctionalComponent(__VLS_524, new __VLS_524({
    span: (4),
}));
const __VLS_526 = __VLS_525({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_525));
__VLS_527.slots.default;
const __VLS_528 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_529 = __VLS_asFunctionalComponent(__VLS_528, new __VLS_528({
    label: "贝壳成交总价(元)",
}));
const __VLS_530 = __VLS_529({
    label: "贝壳成交总价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_529));
__VLS_531.slots.default;
const __VLS_532 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_533 = __VLS_asFunctionalComponent(__VLS_532, new __VLS_532({
    modelValue: (__VLS_ctx.form.beike_latest_deal_total_price),
    min: (0),
    theme: "normal",
}));
const __VLS_534 = __VLS_533({
    modelValue: (__VLS_ctx.form.beike_latest_deal_total_price),
    min: (0),
    theme: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_533));
var __VLS_531;
var __VLS_527;
const __VLS_536 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_537 = __VLS_asFunctionalComponent(__VLS_536, new __VLS_536({
    span: (4),
}));
const __VLS_538 = __VLS_537({
    span: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_537));
__VLS_539.slots.default;
const __VLS_540 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_541 = __VLS_asFunctionalComponent(__VLS_540, new __VLS_540({
    label: "贝壳成交时间",
}));
const __VLS_542 = __VLS_541({
    label: "贝壳成交时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_541));
__VLS_543.slots.default;
const __VLS_544 = {}.TDatePicker;
/** @type {[typeof __VLS_components.TDatePicker, typeof __VLS_components.tDatePicker, ]} */ ;
// @ts-ignore
const __VLS_545 = __VLS_asFunctionalComponent(__VLS_544, new __VLS_544({
    modelValue: (__VLS_ctx.form.beike_latest_deal_time),
    enableTimePicker: true,
}));
const __VLS_546 = __VLS_545({
    modelValue: (__VLS_ctx.form.beike_latest_deal_time),
    enableTimePicker: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_545));
var __VLS_543;
var __VLS_539;
var __VLS_511;
var __VLS_507;
var __VLS_503;
const __VLS_548 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_549 = __VLS_asFunctionalComponent(__VLS_548, new __VLS_548({
    title: "拍卖信息",
    ...{ style: {} },
}));
const __VLS_550 = __VLS_549({
    title: "拍卖信息",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_549));
__VLS_551.slots.default;
const __VLS_552 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_553 = __VLS_asFunctionalComponent(__VLS_552, new __VLS_552({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}));
const __VLS_554 = __VLS_553({
    data: (__VLS_ctx.form),
    labelWidth: "110px",
}, ...__VLS_functionalComponentArgsRest(__VLS_553));
__VLS_555.slots.default;
const __VLS_556 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_557 = __VLS_asFunctionalComponent(__VLS_556, new __VLS_556({
    gutter: (24),
}));
const __VLS_558 = __VLS_557({
    gutter: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_557));
__VLS_559.slots.default;
const __VLS_560 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_561 = __VLS_asFunctionalComponent(__VLS_560, new __VLS_560({
    span: (3),
}));
const __VLS_562 = __VLS_561({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_561));
__VLS_563.slots.default;
const __VLS_564 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_565 = __VLS_asFunctionalComponent(__VLS_564, new __VLS_564({
    label: "拍卖轮次",
}));
const __VLS_566 = __VLS_565({
    label: "拍卖轮次",
}, ...__VLS_functionalComponentArgsRest(__VLS_565));
__VLS_567.slots.default;
const __VLS_568 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_569 = __VLS_asFunctionalComponent(__VLS_568, new __VLS_568({
    modelValue: (__VLS_ctx.form.auction_round),
}));
const __VLS_570 = __VLS_569({
    modelValue: (__VLS_ctx.form.auction_round),
}, ...__VLS_functionalComponentArgsRest(__VLS_569));
__VLS_571.slots.default;
const __VLS_572 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_573 = __VLS_asFunctionalComponent(__VLS_572, new __VLS_572({
    value: "一拍",
}));
const __VLS_574 = __VLS_573({
    value: "一拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_573));
const __VLS_576 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_577 = __VLS_asFunctionalComponent(__VLS_576, new __VLS_576({
    value: "二拍",
}));
const __VLS_578 = __VLS_577({
    value: "二拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_577));
const __VLS_580 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_581 = __VLS_asFunctionalComponent(__VLS_580, new __VLS_580({
    value: "变卖",
}));
const __VLS_582 = __VLS_581({
    value: "变卖",
}, ...__VLS_functionalComponentArgsRest(__VLS_581));
var __VLS_571;
var __VLS_567;
var __VLS_563;
const __VLS_584 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_585 = __VLS_asFunctionalComponent(__VLS_584, new __VLS_584({
    span: (3),
}));
const __VLS_586 = __VLS_585({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_585));
__VLS_587.slots.default;
const __VLS_588 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_589 = __VLS_asFunctionalComponent(__VLS_588, new __VLS_588({
    label: "拍卖状态",
}));
const __VLS_590 = __VLS_589({
    label: "拍卖状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_589));
__VLS_591.slots.default;
const __VLS_592 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_593 = __VLS_asFunctionalComponent(__VLS_592, new __VLS_592({
    modelValue: (__VLS_ctx.form.auction_status),
}));
const __VLS_594 = __VLS_593({
    modelValue: (__VLS_ctx.form.auction_status),
}, ...__VLS_functionalComponentArgsRest(__VLS_593));
__VLS_595.slots.default;
const __VLS_596 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_597 = __VLS_asFunctionalComponent(__VLS_596, new __VLS_596({
    value: "即将开拍",
}));
const __VLS_598 = __VLS_597({
    value: "即将开拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_597));
const __VLS_600 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_601 = __VLS_asFunctionalComponent(__VLS_600, new __VLS_600({
    value: "进行中",
}));
const __VLS_602 = __VLS_601({
    value: "进行中",
}, ...__VLS_functionalComponentArgsRest(__VLS_601));
const __VLS_604 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_605 = __VLS_asFunctionalComponent(__VLS_604, new __VLS_604({
    value: "已结束",
}));
const __VLS_606 = __VLS_605({
    value: "已结束",
}, ...__VLS_functionalComponentArgsRest(__VLS_605));
const __VLS_608 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_609 = __VLS_asFunctionalComponent(__VLS_608, new __VLS_608({
    value: "已成交",
}));
const __VLS_610 = __VLS_609({
    value: "已成交",
}, ...__VLS_functionalComponentArgsRest(__VLS_609));
const __VLS_612 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_613 = __VLS_asFunctionalComponent(__VLS_612, new __VLS_612({
    value: "中止",
}));
const __VLS_614 = __VLS_613({
    value: "中止",
}, ...__VLS_functionalComponentArgsRest(__VLS_613));
const __VLS_616 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_617 = __VLS_asFunctionalComponent(__VLS_616, new __VLS_616({
    value: "撤回",
}));
const __VLS_618 = __VLS_617({
    value: "撤回",
}, ...__VLS_functionalComponentArgsRest(__VLS_617));
var __VLS_595;
var __VLS_591;
var __VLS_587;
const __VLS_620 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_621 = __VLS_asFunctionalComponent(__VLS_620, new __VLS_620({
    span: (3),
}));
const __VLS_622 = __VLS_621({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_621));
__VLS_623.slots.default;
const __VLS_624 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_625 = __VLS_asFunctionalComponent(__VLS_624, new __VLS_624({
    label: "开拍时间",
}));
const __VLS_626 = __VLS_625({
    label: "开拍时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_625));
__VLS_627.slots.default;
const __VLS_628 = {}.TDatePicker;
/** @type {[typeof __VLS_components.TDatePicker, typeof __VLS_components.tDatePicker, ]} */ ;
// @ts-ignore
const __VLS_629 = __VLS_asFunctionalComponent(__VLS_628, new __VLS_628({
    modelValue: (__VLS_ctx.form.auction_start_time),
    enableTimePicker: true,
}));
const __VLS_630 = __VLS_629({
    modelValue: (__VLS_ctx.form.auction_start_time),
    enableTimePicker: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_629));
var __VLS_627;
var __VLS_623;
const __VLS_632 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_633 = __VLS_asFunctionalComponent(__VLS_632, new __VLS_632({
    span: (3),
}));
const __VLS_634 = __VLS_633({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_633));
__VLS_635.slots.default;
const __VLS_636 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_637 = __VLS_asFunctionalComponent(__VLS_636, new __VLS_636({
    label: "结束时间",
}));
const __VLS_638 = __VLS_637({
    label: "结束时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_637));
__VLS_639.slots.default;
const __VLS_640 = {}.TDatePicker;
/** @type {[typeof __VLS_components.TDatePicker, typeof __VLS_components.tDatePicker, ]} */ ;
// @ts-ignore
const __VLS_641 = __VLS_asFunctionalComponent(__VLS_640, new __VLS_640({
    modelValue: (__VLS_ctx.form.auction_end_time),
    enableTimePicker: true,
}));
const __VLS_642 = __VLS_641({
    modelValue: (__VLS_ctx.form.auction_end_time),
    enableTimePicker: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_641));
var __VLS_639;
var __VLS_635;
const __VLS_644 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_645 = __VLS_asFunctionalComponent(__VLS_644, new __VLS_644({
    span: (6),
}));
const __VLS_646 = __VLS_645({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_645));
__VLS_647.slots.default;
const __VLS_648 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_649 = __VLS_asFunctionalComponent(__VLS_648, new __VLS_648({
    label: "拍卖法院",
}));
const __VLS_650 = __VLS_649({
    label: "拍卖法院",
}, ...__VLS_functionalComponentArgsRest(__VLS_649));
__VLS_651.slots.default;
const __VLS_652 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_653 = __VLS_asFunctionalComponent(__VLS_652, new __VLS_652({
    modelValue: (__VLS_ctx.form.court_name),
}));
const __VLS_654 = __VLS_653({
    modelValue: (__VLS_ctx.form.court_name),
}, ...__VLS_functionalComponentArgsRest(__VLS_653));
var __VLS_651;
var __VLS_647;
const __VLS_656 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_657 = __VLS_asFunctionalComponent(__VLS_656, new __VLS_656({
    span: (3),
}));
const __VLS_658 = __VLS_657({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_657));
__VLS_659.slots.default;
const __VLS_660 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_661 = __VLS_asFunctionalComponent(__VLS_660, new __VLS_660({
    label: "案号",
}));
const __VLS_662 = __VLS_661({
    label: "案号",
}, ...__VLS_functionalComponentArgsRest(__VLS_661));
__VLS_663.slots.default;
const __VLS_664 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_665 = __VLS_asFunctionalComponent(__VLS_664, new __VLS_664({
    modelValue: (__VLS_ctx.form.case_number),
}));
const __VLS_666 = __VLS_665({
    modelValue: (__VLS_ctx.form.case_number),
}, ...__VLS_functionalComponentArgsRest(__VLS_665));
var __VLS_663;
var __VLS_659;
const __VLS_668 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_669 = __VLS_asFunctionalComponent(__VLS_668, new __VLS_668({
    span: (3),
}));
const __VLS_670 = __VLS_669({
    span: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_669));
__VLS_671.slots.default;
const __VLS_672 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_673 = __VLS_asFunctionalComponent(__VLS_672, new __VLS_672({
    label: "围观人数",
}));
const __VLS_674 = __VLS_673({
    label: "围观人数",
}, ...__VLS_functionalComponentArgsRest(__VLS_673));
__VLS_675.slots.default;
const __VLS_676 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_677 = __VLS_asFunctionalComponent(__VLS_676, new __VLS_676({
    modelValue: (__VLS_ctx.form.view_count),
    min: (0),
}));
const __VLS_678 = __VLS_677({
    modelValue: (__VLS_ctx.form.view_count),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_677));
var __VLS_675;
var __VLS_671;
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
const __VLS_684 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_685 = __VLS_asFunctionalComponent(__VLS_684, new __VLS_684({
    label: "参拍人数",
}));
const __VLS_686 = __VLS_685({
    label: "参拍人数",
}, ...__VLS_functionalComponentArgsRest(__VLS_685));
__VLS_687.slots.default;
const __VLS_688 = {}.TInputNumber;
/** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
// @ts-ignore
const __VLS_689 = __VLS_asFunctionalComponent(__VLS_688, new __VLS_688({
    modelValue: (__VLS_ctx.form.participant_count),
    min: (0),
}));
const __VLS_690 = __VLS_689({
    modelValue: (__VLS_ctx.form.participant_count),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_689));
var __VLS_687;
var __VLS_683;
var __VLS_559;
var __VLS_555;
var __VLS_551;
const __VLS_692 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_693 = __VLS_asFunctionalComponent(__VLS_692, new __VLS_692({
    title: "描述",
    ...{ style: {} },
}));
const __VLS_694 = __VLS_693({
    title: "描述",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_693));
__VLS_695.slots.default;
const __VLS_696 = {}.TTextarea;
/** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
// @ts-ignore
const __VLS_697 = __VLS_asFunctionalComponent(__VLS_696, new __VLS_696({
    modelValue: (__VLS_ctx.form.description),
    maxlength: (2000),
    autosize: ({ minRows: 3, maxRows: 8 }),
}));
const __VLS_698 = __VLS_697({
    modelValue: (__VLS_ctx.form.description),
    maxlength: (2000),
    autosize: ({ minRows: 3, maxRows: 8 }),
}, ...__VLS_functionalComponentArgsRest(__VLS_697));
var __VLS_695;
if (__VLS_ctx.isEdit) {
    const __VLS_700 = {}.TCard;
    /** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
    // @ts-ignore
    const __VLS_701 = __VLS_asFunctionalComponent(__VLS_700, new __VLS_700({
        ...{ style: {} },
    }));
    const __VLS_702 = __VLS_701({
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_701));
    __VLS_703.slots.default;
    {
        const { title: __VLS_thisSlot } = __VLS_703.slots;
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
        const { actions: __VLS_thisSlot } = __VLS_703.slots;
        const __VLS_704 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_705 = __VLS_asFunctionalComponent(__VLS_704, new __VLS_704({
            ...{ 'onClick': {} },
            size: "small",
            theme: "primary",
            loading: (__VLS_ctx.refreshingCommunity),
        }));
        const __VLS_706 = __VLS_705({
            ...{ 'onClick': {} },
            size: "small",
            theme: "primary",
            loading: (__VLS_ctx.refreshingCommunity),
        }, ...__VLS_functionalComponentArgsRest(__VLS_705));
        let __VLS_708;
        let __VLS_709;
        let __VLS_710;
        const __VLS_711 = {
            onClick: (__VLS_ctx.refreshCommunity)
        };
        __VLS_707.slots.default;
        var __VLS_707;
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
        const __VLS_712 = {}.TRow;
        /** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
        // @ts-ignore
        const __VLS_713 = __VLS_asFunctionalComponent(__VLS_712, new __VLS_712({
            gutter: (16),
            ...{ style: {} },
        }));
        const __VLS_714 = __VLS_713({
            gutter: (16),
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_713));
        __VLS_715.slots.default;
        const __VLS_716 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_717 = __VLS_asFunctionalComponent(__VLS_716, new __VLS_716({
            span: (3),
        }));
        const __VLS_718 = __VLS_717({
            span: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_717));
        __VLS_719.slots.default;
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
        var __VLS_719;
        const __VLS_720 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_721 = __VLS_asFunctionalComponent(__VLS_720, new __VLS_720({
            span: (3),
        }));
        const __VLS_722 = __VLS_721({
            span: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_721));
        __VLS_723.slots.default;
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
        var __VLS_723;
        const __VLS_724 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_725 = __VLS_asFunctionalComponent(__VLS_724, new __VLS_724({
            span: (3),
        }));
        const __VLS_726 = __VLS_725({
            span: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_725));
        __VLS_727.slots.default;
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
        var __VLS_727;
        const __VLS_728 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_729 = __VLS_asFunctionalComponent(__VLS_728, new __VLS_728({
            span: (3),
        }));
        const __VLS_730 = __VLS_729({
            span: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_729));
        __VLS_731.slots.default;
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
        var __VLS_731;
        var __VLS_715;
        if (__VLS_ctx.community.info.description) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "ci-desc" },
            });
            (__VLS_ctx.community.info.description);
        }
        const __VLS_732 = {}.TRow;
        /** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
        // @ts-ignore
        const __VLS_733 = __VLS_asFunctionalComponent(__VLS_732, new __VLS_732({
            gutter: (24),
        }));
        const __VLS_734 = __VLS_733({
            gutter: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_733));
        __VLS_735.slots.default;
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
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-v" },
        });
        (__VLS_ctx.community.info.address_full || '—');
        var __VLS_739;
        const __VLS_740 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_741 = __VLS_asFunctionalComponent(__VLS_740, new __VLS_740({
            span: (6),
        }));
        const __VLS_742 = __VLS_741({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_741));
        __VLS_743.slots.default;
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
        var __VLS_743;
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
        (__VLS_ctx.community.info.developer || '—');
        var __VLS_747;
        const __VLS_748 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_749 = __VLS_asFunctionalComponent(__VLS_748, new __VLS_748({
            span: (6),
        }));
        const __VLS_750 = __VLS_749({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_749));
        __VLS_751.slots.default;
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
        var __VLS_751;
        const __VLS_752 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_753 = __VLS_asFunctionalComponent(__VLS_752, new __VLS_752({
            span: (6),
        }));
        const __VLS_754 = __VLS_753({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_753));
        __VLS_755.slots.default;
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
        var __VLS_755;
        const __VLS_756 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_757 = __VLS_asFunctionalComponent(__VLS_756, new __VLS_756({
            span: (6),
        }));
        const __VLS_758 = __VLS_757({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_757));
        __VLS_759.slots.default;
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
        var __VLS_759;
        const __VLS_760 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_761 = __VLS_asFunctionalComponent(__VLS_760, new __VLS_760({
            span: (6),
        }));
        const __VLS_762 = __VLS_761({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_761));
        __VLS_763.slots.default;
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
        var __VLS_763;
        const __VLS_764 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_765 = __VLS_asFunctionalComponent(__VLS_764, new __VLS_764({
            span: (6),
        }));
        const __VLS_766 = __VLS_765({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_765));
        __VLS_767.slots.default;
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
        var __VLS_767;
        const __VLS_768 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_769 = __VLS_asFunctionalComponent(__VLS_768, new __VLS_768({
            span: (12),
        }));
        const __VLS_770 = __VLS_769({
            span: (12),
        }, ...__VLS_functionalComponentArgsRest(__VLS_769));
        __VLS_771.slots.default;
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
        var __VLS_771;
        const __VLS_772 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_773 = __VLS_asFunctionalComponent(__VLS_772, new __VLS_772({
            span: (6),
        }));
        const __VLS_774 = __VLS_773({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_773));
        __VLS_775.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "ci-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ci-k" },
        });
        if (__VLS_ctx.community.info.beike_url) {
            const __VLS_776 = {}.TLink;
            /** @type {[typeof __VLS_components.TLink, typeof __VLS_components.tLink, typeof __VLS_components.TLink, typeof __VLS_components.tLink, ]} */ ;
            // @ts-ignore
            const __VLS_777 = __VLS_asFunctionalComponent(__VLS_776, new __VLS_776({
                href: (__VLS_ctx.community.info.beike_url),
                target: "_blank",
                theme: "primary",
            }));
            const __VLS_778 = __VLS_777({
                href: (__VLS_ctx.community.info.beike_url),
                target: "_blank",
                theme: "primary",
            }, ...__VLS_functionalComponentArgsRest(__VLS_777));
            __VLS_779.slots.default;
            var __VLS_779;
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "ci-v" },
            });
        }
        var __VLS_775;
        const __VLS_780 = {}.TCol;
        /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
        // @ts-ignore
        const __VLS_781 = __VLS_asFunctionalComponent(__VLS_780, new __VLS_780({
            span: (6),
        }));
        const __VLS_782 = __VLS_781({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_781));
        __VLS_783.slots.default;
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
        var __VLS_783;
        var __VLS_735;
    }
    var __VLS_703;
}
if (__VLS_ctx.isEdit) {
    const __VLS_784 = {}.TCard;
    /** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
    // @ts-ignore
    const __VLS_785 = __VLS_asFunctionalComponent(__VLS_784, new __VLS_784({
        title: "房源图片",
        ...{ style: {} },
    }));
    const __VLS_786 = __VLS_785({
        title: "房源图片",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_785));
    __VLS_787.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "file-gallery" },
    });
    for (const [img, idx] of __VLS_getVForSourceType((__VLS_ctx.images))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "file-item" },
            ...{ class: ({ 'is-hidden': img.hidden }) },
            key: (idx),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (img.image_url),
            ...{ class: "gallery-img" },
        });
        if (img.hidden) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "junk-badge" },
            });
            (__VLS_ctx.junkLabel(img.hide_reason));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "img-ops" },
        });
        const __VLS_788 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_789 = __VLS_asFunctionalComponent(__VLS_788, new __VLS_788({
            ...{ 'onClick': {} },
            size: "small",
            theme: (img.hidden ? 'success' : 'warning'),
            variant: "text",
        }));
        const __VLS_790 = __VLS_789({
            ...{ 'onClick': {} },
            size: "small",
            theme: (img.hidden ? 'success' : 'warning'),
            variant: "text",
        }, ...__VLS_functionalComponentArgsRest(__VLS_789));
        let __VLS_792;
        let __VLS_793;
        let __VLS_794;
        const __VLS_795 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.isEdit))
                    return;
                __VLS_ctx.toggleHidden(img);
            }
        };
        __VLS_791.slots.default;
        (img.hidden ? '恢复显示' : '隐藏');
        var __VLS_791;
        const __VLS_796 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_797 = __VLS_asFunctionalComponent(__VLS_796, new __VLS_796({
            ...{ 'onClick': {} },
            size: "small",
            theme: "danger",
            variant: "text",
        }));
        const __VLS_798 = __VLS_797({
            ...{ 'onClick': {} },
            size: "small",
            theme: "danger",
            variant: "text",
        }, ...__VLS_functionalComponentArgsRest(__VLS_797));
        let __VLS_800;
        let __VLS_801;
        let __VLS_802;
        const __VLS_803 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.isEdit))
                    return;
                __VLS_ctx.removeImage(idx);
            }
        };
        __VLS_799.slots.default;
        var __VLS_799;
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
    var __VLS_787;
}
if (__VLS_ctx.isEdit) {
    const __VLS_804 = {}.TCard;
    /** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
    // @ts-ignore
    const __VLS_805 = __VLS_asFunctionalComponent(__VLS_804, new __VLS_804({
        title: "附件文档",
        ...{ style: {} },
    }));
    const __VLS_806 = __VLS_805({
        title: "附件文档",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_805));
    __VLS_807.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "attachment-list" },
    });
    for (const [att, idx] of __VLS_getVForSourceType((__VLS_ctx.attachments))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "attachment-item" },
            key: (idx),
        });
        const __VLS_808 = {}.TLink;
        /** @type {[typeof __VLS_components.TLink, typeof __VLS_components.tLink, typeof __VLS_components.TLink, typeof __VLS_components.tLink, ]} */ ;
        // @ts-ignore
        const __VLS_809 = __VLS_asFunctionalComponent(__VLS_808, new __VLS_808({
            href: (att.url),
            target: "_blank",
        }));
        const __VLS_810 = __VLS_809({
            href: (att.url),
            target: "_blank",
        }, ...__VLS_functionalComponentArgsRest(__VLS_809));
        __VLS_811.slots.default;
        (att.filename);
        var __VLS_811;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "att-size" },
        });
        (__VLS_ctx.formatSize(att.size));
        const __VLS_812 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_813 = __VLS_asFunctionalComponent(__VLS_812, new __VLS_812({
            ...{ 'onClick': {} },
            size: "small",
            theme: "danger",
            variant: "text",
        }));
        const __VLS_814 = __VLS_813({
            ...{ 'onClick': {} },
            size: "small",
            theme: "danger",
            variant: "text",
        }, ...__VLS_functionalComponentArgsRest(__VLS_813));
        let __VLS_816;
        let __VLS_817;
        let __VLS_818;
        const __VLS_819 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.isEdit))
                    return;
                __VLS_ctx.removeAttachment(idx);
            }
        };
        __VLS_815.slots.default;
        var __VLS_815;
    }
    if (!__VLS_ctx.attachments.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-att" },
        });
    }
    const __VLS_820 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_821 = __VLS_asFunctionalComponent(__VLS_820, new __VLS_820({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ style: {} },
    }));
    const __VLS_822 = __VLS_821({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_821));
    let __VLS_824;
    let __VLS_825;
    let __VLS_826;
    const __VLS_827 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.isEdit))
                return;
            __VLS_ctx.triggerUpload('doc');
        }
    };
    __VLS_823.slots.default;
    var __VLS_823;
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
    var __VLS_807;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-actions" },
});
const __VLS_828 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_829 = __VLS_asFunctionalComponent(__VLS_828, new __VLS_828({
    ...{ 'onClick': {} },
    theme: "primary",
    size: "large",
    loading: (__VLS_ctx.submitting),
}));
const __VLS_830 = __VLS_829({
    ...{ 'onClick': {} },
    theme: "primary",
    size: "large",
    loading: (__VLS_ctx.submitting),
}, ...__VLS_functionalComponentArgsRest(__VLS_829));
let __VLS_832;
let __VLS_833;
let __VLS_834;
const __VLS_835 = {
    onClick: (__VLS_ctx.onSubmit)
};
__VLS_831.slots.default;
var __VLS_831;
const __VLS_836 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_837 = __VLS_asFunctionalComponent(__VLS_836, new __VLS_836({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "large",
}));
const __VLS_838 = __VLS_837({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_837));
let __VLS_840;
let __VLS_841;
let __VLS_842;
const __VLS_843 = {
    onClick: (...[$event]) => {
        __VLS_ctx.router.back();
    }
};
__VLS_839.slots.default;
var __VLS_839;
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
/** @type {__VLS_StyleScopedClasses['junk-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['img-ops']} */ ;
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
            junkLabel: junkLabel,
            toggleHidden: toggleHidden,
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
