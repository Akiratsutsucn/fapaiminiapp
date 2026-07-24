/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { listProperties } from '@/api/properties';
import logoUrl from '@/assets/logo.png';
const SH_DISTRICTS = ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'];
const NB_DISTRICTS = ['海曙区', '江北区', '江东区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'];
const HZ_DISTRICTS = ['上城区', '下城区', '江干区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'];
const LY_DISTRICTS = ['兰山区', '罗庄区', '河东区', '沂南县', '郯城县', '沂水县', '兰陵县', '费县', '平邑县', '莒南县', '蒙阴县', '临沭县'];
const CITY_NAMES = { 310000: '上海', 330200: '宁波', 330100: '杭州', 371300: '临沂' };
const filters = reactive({
    city_id: 0,
    district: '',
    statusLive: true, // 拍卖中(进行中)
    statusUpcoming: true, // 即将开拍
});
const list = ref([]);
const loading = ref(false);
const exporting = ref(false);
const digestRef = ref(null);
const exportRef = ref(null);
const exportHolderRef = ref(null);
const exportRows = ref([]); // 导出用:筛选出的全部房源(单表测量高度)
const exportChunks = ref([]); // 按实测行高动态分页的结果
const measuringRef = ref(null);
// 每页表格行累计高度上限(px @820宽)。A4比例总高1160,减去页眉+表头+内边距开销后,
// 实测满页开销约345px(页眉/表头/padding),故行区上限取 780 确保满页总高≤1160不裁切。
const PAGE_CONTENT_PX = 780;
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const districtOptions = computed(() => {
    if (filters.city_id === 310000)
        return SH_DISTRICTS;
    if (filters.city_id === 330200)
        return NB_DISTRICTS;
    if (filters.city_id === 330100)
        return HZ_DISTRICTS;
    if (filters.city_id === 371300)
        return LY_DISTRICTS;
    return [...SH_DISTRICTS, ...NB_DISTRICTS, ...HZ_DISTRICTS, ...LY_DISTRICTS];
});
const cityLabel = computed(() => filters.city_id ? CITY_NAMES[filters.city_id] || '' : '全部城市');
const rangeLabel = computed(() => {
    const parts = [];
    if (filters.statusLive)
        parts.push('拍卖中');
    if (filters.statusUpcoming)
        parts.push('即将开拍');
    return parts.join('/');
});
function cityName(id) { return CITY_NAMES[id] || '-'; }
function cityNameForFile() { return filters.city_id ? (CITY_NAMES[filters.city_id] || '') : '全部城市'; }
function fmtArea(a) { return a ? String(Math.round(a)) : '-'; }
function fmtWan(price) {
    if (!price || price <= 0)
        return '-';
    const wan = price / 10000;
    return wan >= 10000 ? (wan / 10000).toFixed(2) + '亿' : wan.toFixed(1);
}
function fmtDate(s) {
    if (!s)
        return '-';
    const d = new Date(s.replace(' ', 'T'));
    if (isNaN(d.getTime()))
        return '-';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function buildBaseParams() {
    const params = { sort_by: 'digest' };
    if (filters.city_id)
        params.city_id = filters.city_id;
    if (filters.district)
        params.district = filters.district;
    // 状态复选 → auction_status(逗号分隔多值)。都不选时默认两者都要(仍限可参拍)
    const statuses = [];
    if (filters.statusLive)
        statuses.push('进行中');
    if (filters.statusUpcoming)
        statuses.push('即将开拍');
    params.auction_status = (statuses.length ? statuses : ['进行中', '即将开拍']).join(',');
    return params;
}
async function loadData() {
    loading.value = true;
    try {
        const params = { ...buildBaseParams(), page: pagination.current, page_size: pagination.pageSize };
        const data = await listProperties(params);
        list.value = data.items || [];
        pagination.total = data.total || 0;
    }
    catch (e) {
        MessagePlugin.error('加载失败,请重试');
    }
    finally {
        loading.value = false;
    }
}
function onSearch() { pagination.current = 1; loadData(); }
function onReset() { filters.city_id = 0; filters.district = ''; filters.statusLive = true; filters.statusUpcoming = true; pagination.current = 1; loadData(); }
function onCityChange() { filters.district = ''; onSearch(); }
function onPageChange(pageInfo) {
    pagination.current = pageInfo.current;
    if (pageInfo.pageSize && pageInfo.pageSize !== pagination.pageSize) {
        pagination.pageSize = pageInfo.pageSize;
        pagination.current = 1;
    }
    loadData();
}
// 拉取筛选条件下的全部房源(翻遍所有页)
async function fetchAllRows() {
    const base = buildBaseParams();
    const pageSize = 100;
    const all = [];
    let page = 1;
    let total = Infinity;
    // 上限保护:最多 100 页(1万条),避免异常无限循环
    while (all.length < total && page <= 100) {
        const data = await listProperties({ ...base, page, page_size: pageSize });
        const items = data.items || [];
        all.push(...items);
        total = data.total || 0;
        if (items.length === 0)
            break;
        page += 1;
    }
    return all;
}
async function onExportPdf() {
    if (pagination.total === 0) {
        MessagePlugin.warning('当前无数据可导出');
        return;
    }
    exporting.value = true;
    const loadingMsg = MessagePlugin.loading('正在生成 PDF,请稍候...', 0);
    try {
        // 1. 拉取筛选出的全部房源
        exportRows.value = await fetchAllRows();
        if (exportRows.value.length === 0) {
            MessagePlugin.warning('当前无数据可导出');
            return;
        }
        // 2. 先渲染测量表,按实测行高动态分页(保证每页内容不超过A4高度,长标题也不溢出)
        exportChunks.value = [];
        await nextTick();
        await new Promise(r => setTimeout(r, 30));
        const mrows = Array.from(measuringRef.value?.querySelectorAll('tr[data-mrow]') || []);
        const rows = exportRows.value;
        const chunks = [];
        let cur = [];
        let curH = 0;
        for (let i = 0; i < rows.length; i++) {
            const h = mrows[i]?.offsetHeight || 40;
            if (cur.length > 0 && curH + h > PAGE_CONTENT_PX) {
                chunks.push(cur);
                cur = [];
                curH = 0;
            }
            cur.push(rows[i]);
            curH += h;
        }
        if (cur.length)
            chunks.push(cur);
        exportChunks.value = chunks;
        // 3. 等待分页后的导出页渲染完成,并把它临时置于视口内(html2canvas对离屏元素渲染不稳定)
        await nextTick();
        exportHolderRef.value?.classList.add('exporting-visible');
        // 等待logo图片加载完成,否则截图缺图
        const imgs = Array.from(exportRef.value?.querySelectorAll('img') || []);
        await Promise.all(imgs.map(img => (img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = () => res(null); }))));
        await new Promise(r => setTimeout(r, 120));
        const pages = exportRef.value?.querySelectorAll('.export-page');
        if (!pages || pages.length === 0)
            throw new Error('no export pages');
        // 3. 逐块(每块=1个PDF页)截图,行不会被从中间切断
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth(); // 210mm
        const pageH = pdf.internal.pageSize.getHeight(); // 297mm
        const marginX = 10;
        const marginY = 10;
        const maxW = pageW - marginX * 2;
        for (let i = 0; i < pages.length; i++) {
            const el = pages[i];
            const canvas = await html2canvas(el, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: el.offsetWidth,
                height: el.offsetHeight,
                windowWidth: el.offsetWidth,
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            // 每页导出块均为固定 A4 比例(820x1160),始终按满宽放置 → 各页宽度完全一致
            const imgW = maxW;
            const imgH = (canvas.height * imgW) / canvas.width;
            if (i > 0)
                pdf.addPage();
            pdf.addImage(imgData, 'JPEG', marginX, marginY, imgW, imgH);
        }
        exportHolderRef.value?.classList.remove('exporting-visible');
        const today = new Date().toISOString().slice(0, 10);
        pdf.save(`最新法拍房源捡漏清单_${cityNameForFile()}_${today}.pdf`);
        MessagePlugin.success(`PDF 已导出(共 ${exportRows.value.length} 套 / ${pages.length} 页)`);
    }
    catch (e) {
        MessagePlugin.error('导出失败,请重试');
    }
    finally {
        exportHolderRef.value?.classList.remove('exporting-visible');
        loadingMsg.then((m) => m.close?.()).catch(() => { });
        exportRows.value = [];
        exportChunks.value = [];
        exporting.value = false;
    }
}
onMounted(() => loadData());
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['search-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['export-holder']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-table']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-table']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-table']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-table']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-table']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-table']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-table']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "digest-page" },
});
const __VLS_0 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "filter-card" },
    bordered: (false),
}));
const __VLS_2 = __VLS_1({
    ...{ class: "filter-card" },
    bordered: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "search-bar" },
});
const __VLS_4 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.city_id),
    placeholder: "城市",
    ...{ style: {} },
}));
const __VLS_6 = __VLS_5({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.city_id),
    placeholder: "城市",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
let __VLS_8;
let __VLS_9;
let __VLS_10;
const __VLS_11 = {
    onChange: (__VLS_ctx.onCityChange)
};
__VLS_7.slots.default;
const __VLS_12 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    value: (0),
    label: "全部城市",
}));
const __VLS_14 = __VLS_13({
    value: (0),
    label: "全部城市",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
const __VLS_16 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    value: (310000),
    label: "上海",
}));
const __VLS_18 = __VLS_17({
    value: (310000),
    label: "上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const __VLS_20 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    value: (330200),
    label: "宁波",
}));
const __VLS_22 = __VLS_21({
    value: (330200),
    label: "宁波",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_24 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    value: (330100),
    label: "杭州",
}));
const __VLS_26 = __VLS_25({
    value: (330100),
    label: "杭州",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
const __VLS_28 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    value: (371300),
    label: "临沂",
}));
const __VLS_30 = __VLS_29({
    value: (371300),
    label: "临沂",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
var __VLS_7;
const __VLS_32 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.district),
    placeholder: "区县",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_34 = __VLS_33({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.district),
    placeholder: "区县",
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
    value: (''),
    label: "全部区县",
}));
const __VLS_42 = __VLS_41({
    value: (''),
    label: "全部区县",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
for (const [d] of __VLS_getVForSourceType((__VLS_ctx.districtOptions))) {
    const __VLS_44 = {}.TOption;
    /** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        key: (d),
        value: (d),
        label: (d),
    }));
    const __VLS_46 = __VLS_45({
        key: (d),
        value: (d),
        label: (d),
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
}
var __VLS_35;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-filter" },
});
const __VLS_48 = {}.TCheckbox;
/** @type {[typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.statusLive),
}));
const __VLS_50 = __VLS_49({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.statusLive),
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
let __VLS_52;
let __VLS_53;
let __VLS_54;
const __VLS_55 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_51.slots.default;
var __VLS_51;
const __VLS_56 = {}.TCheckbox;
/** @type {[typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.statusUpcoming),
}));
const __VLS_58 = __VLS_57({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.statusUpcoming),
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
let __VLS_60;
let __VLS_61;
let __VLS_62;
const __VLS_63 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_59.slots.default;
var __VLS_59;
const __VLS_64 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_66 = __VLS_65({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
let __VLS_68;
let __VLS_69;
let __VLS_70;
const __VLS_71 = {
    onClick: (__VLS_ctx.onSearch)
};
__VLS_67.slots.default;
var __VLS_67;
const __VLS_72 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_74 = __VLS_73({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
let __VLS_76;
let __VLS_77;
let __VLS_78;
const __VLS_79 = {
    onClick: (__VLS_ctx.onReset)
};
__VLS_75.slots.default;
var __VLS_75;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "spacer" },
});
const __VLS_80 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    ...{ 'onClick': {} },
    theme: "primary",
    loading: (__VLS_ctx.exporting),
}));
const __VLS_82 = __VLS_81({
    ...{ 'onClick': {} },
    theme: "primary",
    loading: (__VLS_ctx.exporting),
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
let __VLS_84;
let __VLS_85;
let __VLS_86;
const __VLS_87 = {
    onClick: (__VLS_ctx.onExportPdf)
};
__VLS_83.slots.default;
var __VLS_83;
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "digestRef",
    ...{ class: "digest-sheet" },
});
/** @type {typeof __VLS_ctx.digestRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sheet-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sheet-title-wrap" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sheet-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sheet-subtitle" },
});
if (__VLS_ctx.cityLabel) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.cityLabel);
}
if (__VLS_ctx.filters.district) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.filters.district);
}
if (__VLS_ctx.rangeLabel) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.rangeLabel);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "sheet-count" },
});
(__VLS_ctx.pagination.total);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand-box" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
    ...{ class: "brand-logo" },
    src: (__VLS_ctx.logoUrl),
    alt: "法拍者联盟",
    crossorigin: "anonymous",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "brand-name" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "digest-table" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [row, i] of __VLS_getVForSourceType((__VLS_ctx.list))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (row.id),
        ...{ class: ({ 'row-alt': i % 2 === 1 }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.cityName(row.city_id));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (row.district || '-');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "td-title" },
    });
    (row.title || '-');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (row.community_name || '-');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.fmtArea(row.area));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "td-price" },
    });
    (__VLS_ctx.fmtWan(row.starting_price));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.fmtWan(row.appraisal_price));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "td-time" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.fmtDate(row.auction_start_time));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "td-time-end" },
    });
    (__VLS_ctx.fmtDate(row.auction_end_time));
}
if (!__VLS_ctx.loading && __VLS_ctx.list.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "8",
        ...{ class: "empty-row" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "export-holder" },
    ref: "exportHolderRef",
    'aria-hidden': "true",
});
/** @type {typeof __VLS_ctx.exportHolderRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "digest-table measuring-table" },
    ref: "measuringRef",
});
/** @type {typeof __VLS_ctx.measuringRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [row] of __VLS_getVForSourceType((__VLS_ctx.exportRows))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: ('m' + row.id),
        'data-mrow': true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ style: {} },
    });
    (__VLS_ctx.cityName(row.city_id));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ style: {} },
    });
    (row.district || '-');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "td-title" },
        ...{ style: {} },
    });
    (row.title || '-');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ style: {} },
    });
    (row.community_name || '-');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ style: {} },
    });
    (__VLS_ctx.fmtArea(row.area));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "td-price" },
        ...{ style: {} },
    });
    (__VLS_ctx.fmtWan(row.starting_price));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ style: {} },
    });
    (__VLS_ctx.fmtWan(row.appraisal_price));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "td-time" },
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.fmtDate(row.auction_start_time));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "td-time-end" },
    });
    (__VLS_ctx.fmtDate(row.auction_end_time));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "exportRef",
});
/** @type {typeof __VLS_ctx.exportRef} */ ;
for (const [chunk, ci] of __VLS_getVForSourceType((__VLS_ctx.exportChunks))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (ci),
        ...{ class: "export-page digest-sheet" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sheet-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sheet-title-wrap" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sheet-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sheet-subtitle" },
    });
    if (__VLS_ctx.cityLabel) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.cityLabel);
    }
    if (__VLS_ctx.filters.district) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.filters.district);
    }
    if (__VLS_ctx.rangeLabel) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.rangeLabel);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "sheet-count" },
    });
    (__VLS_ctx.exportRows.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "sheet-page" },
    });
    (ci + 1);
    (__VLS_ctx.exportChunks.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "brand-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
        ...{ class: "brand-logo" },
        src: (__VLS_ctx.logoUrl),
        alt: "法拍者联盟",
        crossorigin: "anonymous",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "brand-name" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
        ...{ class: "digest-table" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
    for (const [row, i] of __VLS_getVForSourceType((chunk))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            key: (row.id),
            ...{ class: ({ 'row-alt': i % 2 === 1 }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (__VLS_ctx.cityName(row.city_id));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (row.district || '-');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "td-title" },
        });
        (row.title || '-');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (row.community_name || '-');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (__VLS_ctx.fmtArea(row.area));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "td-price" },
        });
        (__VLS_ctx.fmtWan(row.starting_price));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (__VLS_ctx.fmtWan(row.appraisal_price));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "td-time" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        (__VLS_ctx.fmtDate(row.auction_start_time));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "td-time-end" },
        });
        (__VLS_ctx.fmtDate(row.auction_end_time));
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pager" },
});
const __VLS_88 = {}.TPagination;
/** @type {[typeof __VLS_components.TPagination, typeof __VLS_components.tPagination, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.pagination.current),
    pageSize: (__VLS_ctx.pagination.pageSize),
    total: (__VLS_ctx.pagination.total),
    pageSizeOptions: ([20, 50, 100]),
}));
const __VLS_90 = __VLS_89({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.pagination.current),
    pageSize: (__VLS_ctx.pagination.pageSize),
    total: (__VLS_ctx.pagination.total),
    pageSizeOptions: ([20, 50, 100]),
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
let __VLS_92;
let __VLS_93;
let __VLS_94;
const __VLS_95 = {
    onChange: (__VLS_ctx.onPageChange)
};
var __VLS_91;
/** @type {__VLS_StyleScopedClasses['digest-page']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-card']} */ ;
/** @type {__VLS_StyleScopedClasses['search-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['status-filter']} */ ;
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-sheet']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-header']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-title-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-title']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-count']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-box']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-name']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-table']} */ ;
/** @type {__VLS_StyleScopedClasses['td-title']} */ ;
/** @type {__VLS_StyleScopedClasses['td-price']} */ ;
/** @type {__VLS_StyleScopedClasses['td-time']} */ ;
/** @type {__VLS_StyleScopedClasses['td-time-end']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-row']} */ ;
/** @type {__VLS_StyleScopedClasses['export-holder']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-table']} */ ;
/** @type {__VLS_StyleScopedClasses['measuring-table']} */ ;
/** @type {__VLS_StyleScopedClasses['td-title']} */ ;
/** @type {__VLS_StyleScopedClasses['td-price']} */ ;
/** @type {__VLS_StyleScopedClasses['td-time']} */ ;
/** @type {__VLS_StyleScopedClasses['td-time-end']} */ ;
/** @type {__VLS_StyleScopedClasses['export-page']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-sheet']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-header']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-title-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-title']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-count']} */ ;
/** @type {__VLS_StyleScopedClasses['sheet-page']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-box']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-name']} */ ;
/** @type {__VLS_StyleScopedClasses['digest-table']} */ ;
/** @type {__VLS_StyleScopedClasses['td-title']} */ ;
/** @type {__VLS_StyleScopedClasses['td-price']} */ ;
/** @type {__VLS_StyleScopedClasses['td-time']} */ ;
/** @type {__VLS_StyleScopedClasses['td-time-end']} */ ;
/** @type {__VLS_StyleScopedClasses['pager']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            logoUrl: logoUrl,
            filters: filters,
            list: list,
            loading: loading,
            exporting: exporting,
            digestRef: digestRef,
            exportRef: exportRef,
            exportHolderRef: exportHolderRef,
            exportRows: exportRows,
            exportChunks: exportChunks,
            measuringRef: measuringRef,
            pagination: pagination,
            districtOptions: districtOptions,
            cityLabel: cityLabel,
            rangeLabel: rangeLabel,
            cityName: cityName,
            fmtArea: fmtArea,
            fmtWan: fmtWan,
            fmtDate: fmtDate,
            onSearch: onSearch,
            onReset: onReset,
            onCityChange: onCityChange,
            onPageChange: onPageChange,
            onExportPdf: onExportPdf,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
