/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { listProperties, deleteProperty, exportProperties } from '@/api/properties';
const router = useRouter();
const loading = ref(false);
const list = ref([]);
const filters = reactive({
    keyword: '', auction_status: '', property_type: '', city_id: 0,
    district: '', auction_round: '',
    area_range: '', area_min: undefined, area_max: undefined,
    price_range: '', price_min: undefined, price_max: undefined,
});
// 区市下拉：根据当前城市动态切换
const SH_DISTRICTS = ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'];
const NB_DISTRICTS = ['海曙区', '江北区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'];
const districtOptions = computed(() => {
    if (filters.city_id === 310000)
        return SH_DISTRICTS;
    if (filters.city_id === 330200)
        return NB_DISTRICTS;
    return [...SH_DISTRICTS, ...NB_DISTRICTS];
});
const pagination = reactive({
    current: 1,
    pageSize: 20,
    total: 0,
    pageSizeOptions: [20, 50, 100],
    showPageSize: true,
});
// 全部 45 列定义（colKey 对应 Property 模型字段）
const ALL_COLUMNS = [
    { colKey: 'id', title: 'ID', width: 70 },
    { colKey: 'title', title: '标题', ellipsis: true, width: 240 },
    { colKey: 'source_link', title: '网站链接', width: 80 },
    { colKey: 'auction_platform', title: '拍卖平台', width: 100 },
    { colKey: 'city_id', title: '城市ID', width: 80 },
    { colKey: 'province_city', title: '省市', width: 80 },
    { colKey: 'district', title: '区', width: 80 },
    { colKey: 'sub_district', title: '板块', width: 90 },
    { colKey: 'ring_road', title: '环线', width: 80 },
    { colKey: 'address', title: '地址', ellipsis: true, width: 200 },
    { colKey: 'community_name', title: '小区名', ellipsis: true, width: 140 },
    { colKey: 'property_type', title: '物业类型', width: 90 },
    { colKey: 'area', title: '面积(m2)', width: 90 },
    { colKey: 'layout', title: '户型', width: 80 },
    { colKey: 'floor_info', title: '楼层', width: 70 },
    { colKey: 'total_floors', title: '总楼层', width: 70 },
    { colKey: 'has_elevator', title: '电梯', width: 60 },
    { colKey: 'orientation', title: '朝向', width: 70 },
    { colKey: 'decoration', title: '装修', width: 70 },
    { colKey: 'build_year', title: '建筑年代', width: 80 },
    { colKey: 'starting_price_wan', title: '起拍价(万)', width: 100 },
    { colKey: 'starting_unit_price', title: '起拍单价', width: 90 },
    { colKey: 'appraisal_price_wan', title: '评估价(万)', width: 100 },
    { colKey: 'court_discount_rate', title: '法院折扣率', width: 90 },
    { colKey: 'deposit_wan', title: '保证金(万)', width: 90 },
    { colKey: 'increment_amount', title: '加价幅度', width: 90 },
    { colKey: 'market_deal_price_wan', title: '市场成交价(万)', width: 110 },
    { colKey: 'market_deal_unit_price', title: '市场成交单价', width: 100 },
    { colKey: 'market_discount_rate', title: '市场折扣率', width: 90 },
    { colKey: 'listing_min_price_wan', title: '挂牌最低价(万)', width: 110 },
    { colKey: 'latest_deal_unit_price', title: '最新成交单价', width: 100 },
    { colKey: 'latest_total_price_wan', title: '最新总价(万)', width: 100 },
    { colKey: 'bargain_potential_wan', title: '捡漏空间(万)', width: 100 },
    { colKey: 'beike_latest_deal_unit_price', title: '贝壳成交单价', width: 100 },
    { colKey: 'beike_latest_deal_total_price_wan', title: '贝壳成交总价(万)', width: 120 },
    { colKey: 'beike_latest_deal_time', title: '贝壳成交时间', width: 130 },
    { colKey: 'auction_round', title: '拍卖轮次', width: 80 },
    { colKey: 'auction_status', title: '拍卖状态', width: 90 },
    { colKey: 'auction_start_time', title: '开拍时间', width: 160 },
    { colKey: 'auction_end_time', title: '结束时间', width: 160 },
    { colKey: 'court_name', title: '拍卖法院', ellipsis: true, width: 140 },
    { colKey: 'case_number', title: '案号', width: 120 },
    { colKey: 'view_count', title: '围观人数', width: 80 },
    { colKey: 'participant_count', title: '参拍人数', width: 80 },
    { colKey: 'loan_support', title: '支持贷款', width: 80 },
    { colKey: 'publish_date', title: '发布时间', width: 130 },
    { colKey: 'created_at', title: '入库时间', width: 160 },
    { colKey: 'op', title: '操作', width: 130, fixed: 'right' },
];
const DEFAULT_COLS = ['id', 'title', 'source_link', 'district', 'area', 'starting_price_wan', 'appraisal_price_wan', 'auction_round', 'auction_status', 'auction_start_time', 'op'];
const STORAGE_KEY = 'fapai_prop_cols';
const showColumnPicker = ref(false);
const selectedCols = ref(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || [...DEFAULT_COLS]);
const visibleColumns = computed(() => ALL_COLUMNS.filter(c => selectedCols.value.includes(c.colKey)));
function toggleCol(key, checked) {
    const val = typeof checked === 'boolean' ? checked : checked?.valueOf?.() ?? false;
    if (val) {
        if (!selectedCols.value.includes(key))
            selectedCols.value.push(key);
    }
    else {
        selectedCols.value = selectedCols.value.filter(k => k !== key);
    }
}
function resetCols() {
    selectedCols.value = [...DEFAULT_COLS];
}
watch(selectedCols, (v) => { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }, { deep: true });
function statusTheme(s) {
    const m = { '即将开拍': 'primary', '进行中': 'danger', '已结束': 'default', '已成交': 'success', '中止': 'warning', '撤回': 'warning' };
    return m[s] || 'default';
}
function platformShort(p) {
    if (p?.includes('阿里') || p?.includes('淘宝'))
        return '阿里';
    if (p?.includes('京东'))
        return '京东';
    if (p?.includes('公拍'))
        return '公拍';
    return p || '--';
}
function platformKey(p) {
    if (p?.includes('阿里') || p?.includes('淘宝'))
        return 'ali';
    if (p?.includes('京东'))
        return 'jd';
    if (p?.includes('公拍'))
        return 'gpai';
    return 'default';
}
function toPcUrl(sourceUrl, platform) {
    if (!sourceUrl)
        return '';
    // 阿里拍卖：移动端 → PC端
    if (platform?.includes('阿里') || platform?.includes('淘宝')) {
        const m = sourceUrl.match(/itemId=(\d+)/);
        if (m)
            return `https://sf-item.taobao.com/sf_item/${m[1]}.htm`;
    }
    // 京东/公拍网本身就是 PC 链接，直接用
    return sourceUrl;
}
onMounted(() => loadData());
async function loadData() {
    loading.value = true;
    try {
        const params = { page: pagination.current, page_size: pagination.pageSize };
        if (filters.keyword)
            params.keyword = filters.keyword;
        if (filters.auction_status)
            params.auction_status = filters.auction_status;
        if (filters.property_type)
            params.property_type = filters.property_type;
        if (filters.city_id)
            params.city_id = filters.city_id;
        if (filters.district)
            params.district = filters.district;
        if (filters.auction_round)
            params.auction_round = filters.auction_round;
        if (filters.area_min !== undefined)
            params.area_min = filters.area_min;
        if (filters.area_max !== undefined)
            params.area_max = filters.area_max;
        if (filters.price_min !== undefined)
            params.price_min = filters.price_min;
        if (filters.price_max !== undefined)
            params.price_max = filters.price_max;
        const data = await listProperties(params);
        list.value = data.items.map((p) => ({
            ...p,
            starting_price_wan: p.starting_price ? (p.starting_price / 10000).toFixed(1) : '--',
            appraisal_price_wan: p.appraisal_price ? (p.appraisal_price / 10000).toFixed(1) : '--',
            deposit_wan: p.deposit ? (p.deposit / 10000).toFixed(1) : '--',
            market_deal_price_wan: p.market_deal_price ? (p.market_deal_price / 10000).toFixed(1) : '--',
            listing_min_price_wan: p.listing_min_price ? (p.listing_min_price / 10000).toFixed(1) : '--',
            latest_total_price_wan: p.latest_total_price ? (p.latest_total_price / 10000).toFixed(1) : '--',
            bargain_potential_wan: p.bargain_potential ? (p.bargain_potential / 10000).toFixed(1) : '--',
            beike_latest_deal_total_price_wan: p.beike_latest_deal_total_price ? (p.beike_latest_deal_total_price / 10000).toFixed(1) : '--',
            has_elevator: p.has_elevator === true ? '有' : p.has_elevator === false ? '无' : '--',
            loan_support: p.loan_support === true ? '是' : p.loan_support === false ? '否' : '--',
        }));
        pagination.total = data.total;
    }
    finally {
        loading.value = false;
    }
}
function onSearch() { pagination.current = 1; loadData(); }
// 切换城市时清掉「区市」选择，避免出现宁波下选了上海的区
function onCityChange() {
    filters.district = '';
    onSearch();
}
// 解析「面积区间」select 值（"50-90"）为 area_min/area_max
function onAreaRangeChange() {
    if (!filters.area_range) {
        filters.area_min = undefined;
        filters.area_max = undefined;
    }
    else {
        const [a, b] = filters.area_range.split('-').map(Number);
        filters.area_min = a;
        filters.area_max = b;
    }
    onSearch();
}
// 解析「起拍价区间」（元为单位）
function onPriceRangeChange() {
    if (!filters.price_range) {
        filters.price_min = undefined;
        filters.price_max = undefined;
    }
    else {
        const [a, b] = filters.price_range.split('-').map(Number);
        filters.price_min = a;
        filters.price_max = b;
    }
    onSearch();
}
function onPageChange(p) {
    pagination.current = p.current;
    if (p.pageSize && p.pageSize !== pagination.pageSize) {
        pagination.pageSize = p.pageSize;
        pagination.current = 1;
    }
    loadData();
}
async function onDelete(id) {
    await deleteProperty(id);
    MessagePlugin.success('已删除');
    loadData();
}
function onExport(format = 'xlsx') {
    const params = { format };
    if (filters.city_id)
        params.city_id = filters.city_id;
    if (filters.auction_status)
        params.auction_status = filters.auction_status;
    if (filters.keyword)
        params.keyword = filters.keyword;
    if (filters.property_type)
        params.property_type = filters.property_type;
    if (filters.district)
        params.district = filters.district;
    if (filters.auction_round)
        params.auction_round = filters.auction_round;
    if (filters.area_min !== undefined)
        params.area_min = filters.area_min;
    if (filters.area_max !== undefined)
        params.area_max = filters.area_max;
    if (filters.price_min !== undefined)
        params.price_min = filters.price_min;
    if (filters.price_max !== undefined)
        params.price_max = filters.price_max;
    exportProperties(params).then(res => {
        const url = URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `properties.${format}`;
        a.click();
    }).catch(() => { });
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['source-link']} */ ;
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
var __VLS_7;
const __VLS_24 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.district),
    placeholder: "区市",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_26 = __VLS_25({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.district),
    placeholder: "区市",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_28;
let __VLS_29;
let __VLS_30;
const __VLS_31 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_27.slots.default;
for (const [d] of __VLS_getVForSourceType((__VLS_ctx.districtOptions))) {
    const __VLS_32 = {}.TOption;
    /** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        key: (d),
        value: (d),
        label: (d),
    }));
    const __VLS_34 = __VLS_33({
        key: (d),
        value: (d),
        label: (d),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
}
var __VLS_27;
const __VLS_36 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.keyword),
    placeholder: "搜索标题",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_38 = __VLS_37({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.keyword),
    placeholder: "搜索标题",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
let __VLS_40;
let __VLS_41;
let __VLS_42;
const __VLS_43 = {
    onChange: (__VLS_ctx.onSearch)
};
var __VLS_39;
const __VLS_44 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.auction_status),
    placeholder: "拍卖状态",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_46 = __VLS_45({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.auction_status),
    placeholder: "拍卖状态",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_48;
let __VLS_49;
let __VLS_50;
const __VLS_51 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_47.slots.default;
const __VLS_52 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    value: "即将开拍",
    label: "即将开拍",
}));
const __VLS_54 = __VLS_53({
    value: "即将开拍",
    label: "即将开拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
const __VLS_56 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    value: "进行中",
    label: "进行中",
}));
const __VLS_58 = __VLS_57({
    value: "进行中",
    label: "进行中",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
const __VLS_60 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    value: "已结束",
    label: "已结束",
}));
const __VLS_62 = __VLS_61({
    value: "已结束",
    label: "已结束",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
const __VLS_64 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    value: "已成交",
    label: "已成交",
}));
const __VLS_66 = __VLS_65({
    value: "已成交",
    label: "已成交",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
const __VLS_68 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    value: "中止",
    label: "中止",
}));
const __VLS_70 = __VLS_69({
    value: "中止",
    label: "中止",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
const __VLS_72 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    value: "撤回",
    label: "撤回",
}));
const __VLS_74 = __VLS_73({
    value: "撤回",
    label: "撤回",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
var __VLS_47;
const __VLS_76 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.property_type),
    placeholder: "物业类型",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_78 = __VLS_77({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.property_type),
    placeholder: "物业类型",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
let __VLS_80;
let __VLS_81;
let __VLS_82;
const __VLS_83 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_79.slots.default;
const __VLS_84 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    value: "住宅",
    label: "住宅",
}));
const __VLS_86 = __VLS_85({
    value: "住宅",
    label: "住宅",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
const __VLS_88 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    value: "商业",
    label: "商业",
}));
const __VLS_90 = __VLS_89({
    value: "商业",
    label: "商业",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
const __VLS_92 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    value: "工业",
    label: "工业",
}));
const __VLS_94 = __VLS_93({
    value: "工业",
    label: "工业",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
var __VLS_79;
const __VLS_96 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.auction_round),
    placeholder: "拍卖轮次",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_98 = __VLS_97({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.auction_round),
    placeholder: "拍卖轮次",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
let __VLS_100;
let __VLS_101;
let __VLS_102;
const __VLS_103 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_99.slots.default;
const __VLS_104 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    value: "一拍",
    label: "一拍",
}));
const __VLS_106 = __VLS_105({
    value: "一拍",
    label: "一拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
const __VLS_108 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    value: "二拍",
    label: "二拍",
}));
const __VLS_110 = __VLS_109({
    value: "二拍",
    label: "二拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
const __VLS_112 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    value: "变卖",
    label: "变卖",
}));
const __VLS_114 = __VLS_113({
    value: "变卖",
    label: "变卖",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
const __VLS_116 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    value: "再次拍卖",
    label: "再次拍卖",
}));
const __VLS_118 = __VLS_117({
    value: "再次拍卖",
    label: "再次拍卖",
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
var __VLS_99;
const __VLS_120 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.area_range),
    placeholder: "面积",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_122 = __VLS_121({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.area_range),
    placeholder: "面积",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
let __VLS_124;
let __VLS_125;
let __VLS_126;
const __VLS_127 = {
    onChange: (__VLS_ctx.onAreaRangeChange)
};
__VLS_123.slots.default;
const __VLS_128 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    value: "0-50",
    label: "50㎡以下",
}));
const __VLS_130 = __VLS_129({
    value: "0-50",
    label: "50㎡以下",
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
const __VLS_132 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    value: "50-90",
    label: "50-90㎡",
}));
const __VLS_134 = __VLS_133({
    value: "50-90",
    label: "50-90㎡",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
const __VLS_136 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    value: "90-120",
    label: "90-120㎡",
}));
const __VLS_138 = __VLS_137({
    value: "90-120",
    label: "90-120㎡",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
const __VLS_140 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    value: "120-200",
    label: "120-200㎡",
}));
const __VLS_142 = __VLS_141({
    value: "120-200",
    label: "120-200㎡",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
const __VLS_144 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    value: "200-99999",
    label: "200㎡以上",
}));
const __VLS_146 = __VLS_145({
    value: "200-99999",
    label: "200㎡以上",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
var __VLS_123;
const __VLS_148 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.price_range),
    placeholder: "起拍价",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_150 = __VLS_149({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.price_range),
    placeholder: "起拍价",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
let __VLS_152;
let __VLS_153;
let __VLS_154;
const __VLS_155 = {
    onChange: (__VLS_ctx.onPriceRangeChange)
};
__VLS_151.slots.default;
const __VLS_156 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    value: "0-1000000",
    label: "100万以下",
}));
const __VLS_158 = __VLS_157({
    value: "0-1000000",
    label: "100万以下",
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
const __VLS_160 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    value: "1000000-3000000",
    label: "100-300万",
}));
const __VLS_162 = __VLS_161({
    value: "1000000-3000000",
    label: "100-300万",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
const __VLS_164 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    value: "3000000-5000000",
    label: "300-500万",
}));
const __VLS_166 = __VLS_165({
    value: "3000000-5000000",
    label: "300-500万",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
const __VLS_168 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    value: "5000000-10000000",
    label: "500-1000万",
}));
const __VLS_170 = __VLS_169({
    value: "5000000-10000000",
    label: "500-1000万",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
const __VLS_172 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    value: "10000000-99999999999",
    label: "1000万以上",
}));
const __VLS_174 = __VLS_173({
    value: "10000000-99999999999",
    label: "1000万以上",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
var __VLS_151;
const __VLS_176 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_178 = __VLS_177({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
let __VLS_180;
let __VLS_181;
let __VLS_182;
const __VLS_183 = {
    onClick: (__VLS_ctx.loadData)
};
__VLS_179.slots.default;
var __VLS_179;
const __VLS_184 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_186 = __VLS_185({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
let __VLS_188;
let __VLS_189;
let __VLS_190;
const __VLS_191 = {
    onClick: (...[$event]) => {
        __VLS_ctx.router.push('/properties/edit');
    }
};
__VLS_187.slots.default;
var __VLS_187;
const __VLS_192 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_194 = __VLS_193({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
let __VLS_196;
let __VLS_197;
let __VLS_198;
const __VLS_199 = {
    onClick: (() => __VLS_ctx.onExport('xlsx'))
};
__VLS_195.slots.default;
var __VLS_195;
const __VLS_200 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_202 = __VLS_201({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
let __VLS_204;
let __VLS_205;
let __VLS_206;
const __VLS_207 = {
    onClick: (() => __VLS_ctx.onExport('csv'))
};
__VLS_203.slots.default;
var __VLS_203;
const __VLS_208 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_210 = __VLS_209({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
let __VLS_212;
let __VLS_213;
let __VLS_214;
const __VLS_215 = {
    onClick: (...[$event]) => {
        __VLS_ctx.showColumnPicker = true;
    }
};
__VLS_211.slots.default;
var __VLS_211;
const __VLS_216 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.visibleColumns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
    pagination: (__VLS_ctx.pagination),
    maxHeight: (680),
    bordered: true,
}));
const __VLS_218 = __VLS_217({
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.visibleColumns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
    pagination: (__VLS_ctx.pagination),
    maxHeight: (680),
    bordered: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
let __VLS_220;
let __VLS_221;
let __VLS_222;
const __VLS_223 = {
    onPageChange: (__VLS_ctx.onPageChange)
};
__VLS_219.slots.default;
{
    const { source_link: __VLS_thisSlot } = __VLS_219.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    if (row.source_url) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            href: (__VLS_ctx.toPcUrl(row.source_url, row.auction_platform)),
            target: "_blank",
            ...{ class: "source-link" },
            ...{ class: ('link-' + __VLS_ctx.platformKey(row.auction_platform)) },
        });
        (__VLS_ctx.platformShort(row.auction_platform));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "no-link" },
        });
    }
}
{
    const { auction_status: __VLS_thisSlot } = __VLS_219.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_224 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
        theme: (__VLS_ctx.statusTheme(row.auction_status)),
    }));
    const __VLS_226 = __VLS_225({
        theme: (__VLS_ctx.statusTheme(row.auction_status)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_225));
    __VLS_227.slots.default;
    (row.auction_status);
    var __VLS_227;
}
{
    const { op: __VLS_thisSlot } = __VLS_219.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_228 = {}.TSpace;
    /** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
    // @ts-ignore
    const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({}));
    const __VLS_230 = __VLS_229({}, ...__VLS_functionalComponentArgsRest(__VLS_229));
    __VLS_231.slots.default;
    const __VLS_232 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
    }));
    const __VLS_234 = __VLS_233({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_233));
    let __VLS_236;
    let __VLS_237;
    let __VLS_238;
    const __VLS_239 = {
        onClick: (...[$event]) => {
            __VLS_ctx.router.push('/properties/edit/' + row.id);
        }
    };
    __VLS_235.slots.default;
    var __VLS_235;
    const __VLS_240 = {}.TPopconfirm;
    /** @type {[typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, ]} */ ;
    // @ts-ignore
    const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
        ...{ 'onConfirm': {} },
        content: "确定删除？",
    }));
    const __VLS_242 = __VLS_241({
        ...{ 'onConfirm': {} },
        content: "确定删除？",
    }, ...__VLS_functionalComponentArgsRest(__VLS_241));
    let __VLS_244;
    let __VLS_245;
    let __VLS_246;
    const __VLS_247 = {
        onConfirm: (...[$event]) => {
            __VLS_ctx.onDelete(row.id);
        }
    };
    __VLS_243.slots.default;
    const __VLS_248 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
        variant: "text",
        size: "small",
        theme: "danger",
    }));
    const __VLS_250 = __VLS_249({
        variant: "text",
        size: "small",
        theme: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_249));
    __VLS_251.slots.default;
    var __VLS_251;
    var __VLS_243;
    var __VLS_231;
}
var __VLS_219;
var __VLS_3;
const __VLS_252 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
    visible: (__VLS_ctx.showColumnPicker),
    header: "列设置 — 勾选要显示的列",
    width: "560px",
    footer: (false),
}));
const __VLS_254 = __VLS_253({
    visible: (__VLS_ctx.showColumnPicker),
    header: "列设置 — 勾选要显示的列",
    width: "560px",
    footer: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_253));
__VLS_255.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "col-picker" },
});
for (const [col] of __VLS_getVForSourceType((__VLS_ctx.ALL_COLUMNS))) {
    const __VLS_256 = {}.TCheckbox;
    /** @type {[typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
        ...{ 'onChange': {} },
        key: (col.colKey),
        checked: (__VLS_ctx.selectedCols.includes(col.colKey)),
    }));
    const __VLS_258 = __VLS_257({
        ...{ 'onChange': {} },
        key: (col.colKey),
        checked: (__VLS_ctx.selectedCols.includes(col.colKey)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_257));
    let __VLS_260;
    let __VLS_261;
    let __VLS_262;
    const __VLS_263 = {
        onChange: ((v) => __VLS_ctx.toggleCol(col.colKey, v))
    };
    __VLS_259.slots.default;
    (col.title);
    var __VLS_259;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
const __VLS_264 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
    ...{ 'onClick': {} },
    size: "small",
    variant: "text",
}));
const __VLS_266 = __VLS_265({
    ...{ 'onClick': {} },
    size: "small",
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_265));
let __VLS_268;
let __VLS_269;
let __VLS_270;
const __VLS_271 = {
    onClick: (__VLS_ctx.resetCols)
};
__VLS_267.slots.default;
var __VLS_267;
var __VLS_255;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['search-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['source-link']} */ ;
/** @type {__VLS_StyleScopedClasses['no-link']} */ ;
/** @type {__VLS_StyleScopedClasses['col-picker']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            router: router,
            loading: loading,
            list: list,
            filters: filters,
            districtOptions: districtOptions,
            pagination: pagination,
            ALL_COLUMNS: ALL_COLUMNS,
            showColumnPicker: showColumnPicker,
            selectedCols: selectedCols,
            visibleColumns: visibleColumns,
            toggleCol: toggleCol,
            resetCols: resetCols,
            statusTheme: statusTheme,
            platformShort: platformShort,
            platformKey: platformKey,
            toPcUrl: toPcUrl,
            loadData: loadData,
            onSearch: onSearch,
            onCityChange: onCityChange,
            onAreaRangeChange: onAreaRangeChange,
            onPriceRangeChange: onPriceRangeChange,
            onPageChange: onPageChange,
            onDelete: onDelete,
            onExport: onExport,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
