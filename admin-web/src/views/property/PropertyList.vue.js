/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { listProperties, deleteProperty, exportProperties } from '@/api/properties';
import { useAuthStore } from '@/stores/auth';
const auth = useAuthStore();
const router = useRouter();
const loading = ref(false);
const list = ref([]);
const filters = reactive({
    keyword: '', auction_status: '', property_type: '', city_id: 0,
    district: '', auction_round: '',
    auction_platform: '', has_elevator: '',
    area_range: '', area_min: undefined, area_max: undefined,
    price_range: '', price_min: undefined, price_max: undefined,
});
// 排序状态(传给后端 sort_by/sort_order;后端白名单:area/build_year/starting_price/auction_start_time/created_at)
const sortState = reactive({ sort_by: '', sort_order: 'desc' });
// 区市下拉：根据当前城市动态切换
// 注意：杭州的「下城区」「江干区」、宁波的「江东区」是合并前的旧区，按用户要求保留在筛选项中。
const SH_DISTRICTS = ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'];
const NB_DISTRICTS = ['海曙区', '江北区', '江东区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'];
const HZ_DISTRICTS = ['上城区', '下城区', '江干区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'];
const LY_DISTRICTS = ['兰山区', '罗庄区', '河东区', '沂南县', '郯城县', '沂水县', '兰陵县', '费县', '平邑县', '莒南县', '蒙阴县', '临沭县'];
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
    { colKey: 'area', title: '面积(m2)', width: 90, sorter: true },
    { colKey: 'layout', title: '户型', width: 80 },
    { colKey: 'floor_info', title: '楼层', width: 70 },
    { colKey: 'total_floors', title: '总楼层', width: 70 },
    { colKey: 'has_elevator', title: '电梯', width: 60 },
    { colKey: 'orientation', title: '朝向', width: 70 },
    { colKey: 'decoration', title: '装修', width: 70 },
    { colKey: 'build_year', title: '建筑年代', width: 80, sorter: true },
    { colKey: 'starting_price_wan', title: '起拍价(万)', width: 100, sorter: true, sortKey: 'starting_price' },
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
    { colKey: 'auction_start_time', title: '开拍时间', width: 160, sorter: true },
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
        if (filters.auction_platform)
            params.auction_platform = filters.auction_platform;
        if (filters.has_elevator !== '')
            params.has_elevator = filters.has_elevator;
        if (sortState.sort_by) {
            params.sort_by = sortState.sort_by;
            params.sort_order = sortState.sort_order;
        }
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
// TDesign t-table 的 sort 双向绑定:把后端 sort_by(可能是 sortKey 映射后的值)反查回列的 colKey
const tableSort = computed(() => {
    if (!sortState.sort_by || sortState.sort_by === 'created_at')
        return undefined;
    const col = ALL_COLUMNS.find((c) => (c.sortKey || c.colKey) === sortState.sort_by);
    return col ? { sortBy: col.colKey, descending: sortState.sort_order === 'desc' } : undefined;
});
// 表头点击排序:sortInfo = { sortBy: colKey, descending } 或 null(取消排序)
function onSortChange(sortInfo) {
    if (!sortInfo || !sortInfo.sortBy) {
        sortState.sort_by = '';
    }
    else {
        const col = ALL_COLUMNS.find((c) => c.colKey === sortInfo.sortBy);
        sortState.sort_by = (col && col.sortKey) ? col.sortKey : sortInfo.sortBy;
        sortState.sort_order = sortInfo.descending ? 'desc' : 'asc';
    }
    pagination.current = 1;
    loadData();
}
// 入库时间排序按钮:首次点降序,再点升序,第三次取消
function onSortByCreatedAt() {
    if (sortState.sort_by !== 'created_at') {
        sortState.sort_by = 'created_at';
        sortState.sort_order = 'desc';
    }
    else if (sortState.sort_order === 'desc') {
        sortState.sort_order = 'asc';
    }
    else {
        sortState.sort_by = '';
    }
    pagination.current = 1;
    loadData();
}
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
    placeholder: "区市",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_34 = __VLS_33({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.district),
    placeholder: "区市",
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
for (const [d] of __VLS_getVForSourceType((__VLS_ctx.districtOptions))) {
    const __VLS_40 = {}.TOption;
    /** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        key: (d),
        value: (d),
        label: (d),
    }));
    const __VLS_42 = __VLS_41({
        key: (d),
        value: (d),
        label: (d),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
}
var __VLS_35;
const __VLS_44 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.keyword),
    placeholder: "搜索标题",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_46 = __VLS_45({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.keyword),
    placeholder: "搜索标题",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_48;
let __VLS_49;
let __VLS_50;
const __VLS_51 = {
    onChange: (__VLS_ctx.onSearch)
};
var __VLS_47;
const __VLS_52 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.auction_status),
    placeholder: "拍卖状态",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_54 = __VLS_53({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.auction_status),
    placeholder: "拍卖状态",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_56;
let __VLS_57;
let __VLS_58;
const __VLS_59 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_55.slots.default;
const __VLS_60 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    value: "即将开拍",
    label: "即将开拍",
}));
const __VLS_62 = __VLS_61({
    value: "即将开拍",
    label: "即将开拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
const __VLS_64 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    value: "进行中",
    label: "进行中",
}));
const __VLS_66 = __VLS_65({
    value: "进行中",
    label: "进行中",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
const __VLS_68 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    value: "已结束",
    label: "已结束",
}));
const __VLS_70 = __VLS_69({
    value: "已结束",
    label: "已结束",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
const __VLS_72 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    value: "已成交",
    label: "已成交",
}));
const __VLS_74 = __VLS_73({
    value: "已成交",
    label: "已成交",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
const __VLS_76 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    value: "中止",
    label: "中止",
}));
const __VLS_78 = __VLS_77({
    value: "中止",
    label: "中止",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
const __VLS_80 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    value: "撤回",
    label: "撤回",
}));
const __VLS_82 = __VLS_81({
    value: "撤回",
    label: "撤回",
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
var __VLS_55;
const __VLS_84 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.property_type),
    placeholder: "物业类型",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_86 = __VLS_85({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.property_type),
    placeholder: "物业类型",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
let __VLS_88;
let __VLS_89;
let __VLS_90;
const __VLS_91 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_87.slots.default;
const __VLS_92 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    value: "住宅",
    label: "住宅",
}));
const __VLS_94 = __VLS_93({
    value: "住宅",
    label: "住宅",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
const __VLS_96 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    value: "商铺",
    label: "商铺",
}));
const __VLS_98 = __VLS_97({
    value: "商铺",
    label: "商铺",
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
const __VLS_100 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    value: "写字楼",
    label: "写字楼",
}));
const __VLS_102 = __VLS_101({
    value: "写字楼",
    label: "写字楼",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
const __VLS_104 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    value: "商住房",
    label: "商住房",
}));
const __VLS_106 = __VLS_105({
    value: "商住房",
    label: "商住房",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
const __VLS_108 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    value: "其他商用",
    label: "其他商用",
}));
const __VLS_110 = __VLS_109({
    value: "其他商用",
    label: "其他商用",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
const __VLS_112 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    value: "工业",
    label: "工业",
}));
const __VLS_114 = __VLS_113({
    value: "工业",
    label: "工业",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
var __VLS_87;
const __VLS_116 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.auction_platform),
    placeholder: "平台",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_118 = __VLS_117({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.auction_platform),
    placeholder: "平台",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
let __VLS_120;
let __VLS_121;
let __VLS_122;
const __VLS_123 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_119.slots.default;
const __VLS_124 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    value: "阿里拍卖",
    label: "阿里",
}));
const __VLS_126 = __VLS_125({
    value: "阿里拍卖",
    label: "阿里",
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
const __VLS_128 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    value: "京东拍卖",
    label: "京东",
}));
const __VLS_130 = __VLS_129({
    value: "京东拍卖",
    label: "京东",
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
const __VLS_132 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    value: "公拍网",
    label: "公拍",
}));
const __VLS_134 = __VLS_133({
    value: "公拍网",
    label: "公拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
var __VLS_119;
const __VLS_136 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.has_elevator),
    placeholder: "电梯",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_138 = __VLS_137({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.has_elevator),
    placeholder: "电梯",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
let __VLS_140;
let __VLS_141;
let __VLS_142;
const __VLS_143 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_139.slots.default;
const __VLS_144 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    value: "1",
    label: "有电梯",
}));
const __VLS_146 = __VLS_145({
    value: "1",
    label: "有电梯",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
const __VLS_148 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    value: "0",
    label: "无电梯",
}));
const __VLS_150 = __VLS_149({
    value: "0",
    label: "无电梯",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
var __VLS_139;
const __VLS_152 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.auction_round),
    placeholder: "拍卖轮次",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_154 = __VLS_153({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.auction_round),
    placeholder: "拍卖轮次",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
let __VLS_156;
let __VLS_157;
let __VLS_158;
const __VLS_159 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_155.slots.default;
const __VLS_160 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    value: "一拍",
    label: "一拍",
}));
const __VLS_162 = __VLS_161({
    value: "一拍",
    label: "一拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
const __VLS_164 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    value: "二拍",
    label: "二拍",
}));
const __VLS_166 = __VLS_165({
    value: "二拍",
    label: "二拍",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
const __VLS_168 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    value: "变卖",
    label: "变卖",
}));
const __VLS_170 = __VLS_169({
    value: "变卖",
    label: "变卖",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
const __VLS_172 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    value: "再次拍卖",
    label: "再次拍卖",
}));
const __VLS_174 = __VLS_173({
    value: "再次拍卖",
    label: "再次拍卖",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
var __VLS_155;
const __VLS_176 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.area_range),
    placeholder: "面积",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_178 = __VLS_177({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.area_range),
    placeholder: "面积",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
let __VLS_180;
let __VLS_181;
let __VLS_182;
const __VLS_183 = {
    onChange: (__VLS_ctx.onAreaRangeChange)
};
__VLS_179.slots.default;
const __VLS_184 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    value: "0-50",
    label: "50㎡以下",
}));
const __VLS_186 = __VLS_185({
    value: "0-50",
    label: "50㎡以下",
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
const __VLS_188 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    value: "50-90",
    label: "50-90㎡",
}));
const __VLS_190 = __VLS_189({
    value: "50-90",
    label: "50-90㎡",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
const __VLS_192 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    value: "90-120",
    label: "90-120㎡",
}));
const __VLS_194 = __VLS_193({
    value: "90-120",
    label: "90-120㎡",
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
const __VLS_196 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    value: "120-200",
    label: "120-200㎡",
}));
const __VLS_198 = __VLS_197({
    value: "120-200",
    label: "120-200㎡",
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
const __VLS_200 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    value: "200-99999",
    label: "200㎡以上",
}));
const __VLS_202 = __VLS_201({
    value: "200-99999",
    label: "200㎡以上",
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
var __VLS_179;
const __VLS_204 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.price_range),
    placeholder: "起拍价",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_206 = __VLS_205({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.price_range),
    placeholder: "起拍价",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
let __VLS_208;
let __VLS_209;
let __VLS_210;
const __VLS_211 = {
    onChange: (__VLS_ctx.onPriceRangeChange)
};
__VLS_207.slots.default;
const __VLS_212 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    value: "0-1000000",
    label: "100万以下",
}));
const __VLS_214 = __VLS_213({
    value: "0-1000000",
    label: "100万以下",
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
const __VLS_216 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    value: "1000000-3000000",
    label: "100-300万",
}));
const __VLS_218 = __VLS_217({
    value: "1000000-3000000",
    label: "100-300万",
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
const __VLS_220 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    value: "3000000-5000000",
    label: "300-500万",
}));
const __VLS_222 = __VLS_221({
    value: "3000000-5000000",
    label: "300-500万",
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
const __VLS_224 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    value: "5000000-10000000",
    label: "500-1000万",
}));
const __VLS_226 = __VLS_225({
    value: "5000000-10000000",
    label: "500-1000万",
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
const __VLS_228 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    value: "10000000-99999999999",
    label: "1000万以上",
}));
const __VLS_230 = __VLS_229({
    value: "10000000-99999999999",
    label: "1000万以上",
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
var __VLS_207;
const __VLS_232 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_234 = __VLS_233({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
let __VLS_236;
let __VLS_237;
let __VLS_238;
const __VLS_239 = {
    onClick: (__VLS_ctx.loadData)
};
__VLS_235.slots.default;
var __VLS_235;
if (!__VLS_ctx.auth.isReadonly) {
    const __VLS_240 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
        ...{ 'onClick': {} },
        variant: "outline",
    }));
    const __VLS_242 = __VLS_241({
        ...{ 'onClick': {} },
        variant: "outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_241));
    let __VLS_244;
    let __VLS_245;
    let __VLS_246;
    const __VLS_247 = {
        onClick: (...[$event]) => {
            if (!(!__VLS_ctx.auth.isReadonly))
                return;
            __VLS_ctx.router.push('/properties/edit');
        }
    };
    __VLS_243.slots.default;
    var __VLS_243;
}
const __VLS_248 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_250 = __VLS_249({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_249));
let __VLS_252;
let __VLS_253;
let __VLS_254;
const __VLS_255 = {
    onClick: (() => __VLS_ctx.onExport('xlsx'))
};
__VLS_251.slots.default;
var __VLS_251;
const __VLS_256 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_258 = __VLS_257({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_257));
let __VLS_260;
let __VLS_261;
let __VLS_262;
const __VLS_263 = {
    onClick: (() => __VLS_ctx.onExport('csv'))
};
__VLS_259.slots.default;
var __VLS_259;
const __VLS_264 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_266 = __VLS_265({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_265));
let __VLS_268;
let __VLS_269;
let __VLS_270;
const __VLS_271 = {
    onClick: (...[$event]) => {
        __VLS_ctx.showColumnPicker = true;
    }
};
__VLS_267.slots.default;
var __VLS_267;
const __VLS_272 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
    ...{ 'onClick': {} },
    variant: "outline",
    theme: (__VLS_ctx.sortState.sort_by === 'created_at' ? 'primary' : 'default'),
}));
const __VLS_274 = __VLS_273({
    ...{ 'onClick': {} },
    variant: "outline",
    theme: (__VLS_ctx.sortState.sort_by === 'created_at' ? 'primary' : 'default'),
}, ...__VLS_functionalComponentArgsRest(__VLS_273));
let __VLS_276;
let __VLS_277;
let __VLS_278;
const __VLS_279 = {
    onClick: (__VLS_ctx.onSortByCreatedAt)
};
__VLS_275.slots.default;
(__VLS_ctx.sortState.sort_by === 'created_at' ? (__VLS_ctx.sortState.sort_order === 'desc' ? ' ↓' : ' ↑') : '');
var __VLS_275;
const __VLS_280 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
    ...{ 'onSortChange': {} },
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.visibleColumns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
    pagination: (__VLS_ctx.pagination),
    sort: (__VLS_ctx.tableSort),
    maxHeight: (680),
    bordered: true,
}));
const __VLS_282 = __VLS_281({
    ...{ 'onSortChange': {} },
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.visibleColumns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
    pagination: (__VLS_ctx.pagination),
    sort: (__VLS_ctx.tableSort),
    maxHeight: (680),
    bordered: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_281));
let __VLS_284;
let __VLS_285;
let __VLS_286;
const __VLS_287 = {
    onSortChange: (__VLS_ctx.onSortChange)
};
const __VLS_288 = {
    onPageChange: (__VLS_ctx.onPageChange)
};
__VLS_283.slots.default;
{
    const { source_link: __VLS_thisSlot } = __VLS_283.slots;
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
    const { auction_status: __VLS_thisSlot } = __VLS_283.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_289 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_290 = __VLS_asFunctionalComponent(__VLS_289, new __VLS_289({
        theme: (__VLS_ctx.statusTheme(row.auction_status)),
    }));
    const __VLS_291 = __VLS_290({
        theme: (__VLS_ctx.statusTheme(row.auction_status)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_290));
    __VLS_292.slots.default;
    (row.auction_status);
    var __VLS_292;
}
{
    const { op: __VLS_thisSlot } = __VLS_283.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_293 = {}.TSpace;
    /** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
    // @ts-ignore
    const __VLS_294 = __VLS_asFunctionalComponent(__VLS_293, new __VLS_293({}));
    const __VLS_295 = __VLS_294({}, ...__VLS_functionalComponentArgsRest(__VLS_294));
    __VLS_296.slots.default;
    if (!__VLS_ctx.auth.isReadonly) {
        const __VLS_297 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_298 = __VLS_asFunctionalComponent(__VLS_297, new __VLS_297({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
        }));
        const __VLS_299 = __VLS_298({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_298));
        let __VLS_301;
        let __VLS_302;
        let __VLS_303;
        const __VLS_304 = {
            onClick: (...[$event]) => {
                if (!(!__VLS_ctx.auth.isReadonly))
                    return;
                __VLS_ctx.router.push('/properties/edit/' + row.id);
            }
        };
        __VLS_300.slots.default;
        var __VLS_300;
    }
    if (!__VLS_ctx.auth.isReadonly) {
        const __VLS_305 = {}.TPopconfirm;
        /** @type {[typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, ]} */ ;
        // @ts-ignore
        const __VLS_306 = __VLS_asFunctionalComponent(__VLS_305, new __VLS_305({
            ...{ 'onConfirm': {} },
            content: "确定删除？",
        }));
        const __VLS_307 = __VLS_306({
            ...{ 'onConfirm': {} },
            content: "确定删除？",
        }, ...__VLS_functionalComponentArgsRest(__VLS_306));
        let __VLS_309;
        let __VLS_310;
        let __VLS_311;
        const __VLS_312 = {
            onConfirm: (...[$event]) => {
                if (!(!__VLS_ctx.auth.isReadonly))
                    return;
                __VLS_ctx.onDelete(row.id);
            }
        };
        __VLS_308.slots.default;
        const __VLS_313 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_314 = __VLS_asFunctionalComponent(__VLS_313, new __VLS_313({
            variant: "text",
            size: "small",
            theme: "danger",
        }));
        const __VLS_315 = __VLS_314({
            variant: "text",
            size: "small",
            theme: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_314));
        __VLS_316.slots.default;
        var __VLS_316;
        var __VLS_308;
    }
    if (__VLS_ctx.auth.isReadonly) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
    }
    var __VLS_296;
}
var __VLS_283;
var __VLS_3;
const __VLS_317 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_318 = __VLS_asFunctionalComponent(__VLS_317, new __VLS_317({
    visible: (__VLS_ctx.showColumnPicker),
    header: "列设置 — 勾选要显示的列",
    width: "560px",
    footer: (false),
}));
const __VLS_319 = __VLS_318({
    visible: (__VLS_ctx.showColumnPicker),
    header: "列设置 — 勾选要显示的列",
    width: "560px",
    footer: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_318));
__VLS_320.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "col-picker" },
});
for (const [col] of __VLS_getVForSourceType((__VLS_ctx.ALL_COLUMNS))) {
    const __VLS_321 = {}.TCheckbox;
    /** @type {[typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, typeof __VLS_components.TCheckbox, typeof __VLS_components.tCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_322 = __VLS_asFunctionalComponent(__VLS_321, new __VLS_321({
        ...{ 'onChange': {} },
        key: (col.colKey),
        checked: (__VLS_ctx.selectedCols.includes(col.colKey)),
    }));
    const __VLS_323 = __VLS_322({
        ...{ 'onChange': {} },
        key: (col.colKey),
        checked: (__VLS_ctx.selectedCols.includes(col.colKey)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_322));
    let __VLS_325;
    let __VLS_326;
    let __VLS_327;
    const __VLS_328 = {
        onChange: ((v) => __VLS_ctx.toggleCol(col.colKey, v))
    };
    __VLS_324.slots.default;
    (col.title);
    var __VLS_324;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
const __VLS_329 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_330 = __VLS_asFunctionalComponent(__VLS_329, new __VLS_329({
    ...{ 'onClick': {} },
    size: "small",
    variant: "text",
}));
const __VLS_331 = __VLS_330({
    ...{ 'onClick': {} },
    size: "small",
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_330));
let __VLS_333;
let __VLS_334;
let __VLS_335;
const __VLS_336 = {
    onClick: (__VLS_ctx.resetCols)
};
__VLS_332.slots.default;
var __VLS_332;
var __VLS_320;
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
            auth: auth,
            router: router,
            loading: loading,
            list: list,
            filters: filters,
            sortState: sortState,
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
            tableSort: tableSort,
            onSortChange: onSortChange,
            onSortByCreatedAt: onSortByCreatedAt,
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
