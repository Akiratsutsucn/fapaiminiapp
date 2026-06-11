/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted } from 'vue';
import { getDashboard } from '@/api/dashboard';
const cityId = ref(0); // 0=全部, 310000=上海, 330200=宁波
const cards = ref([
    { label: '入数据库总房源数', value: 0, cityBreakdown: [] },
    { label: '今日入库房源数', value: 0, cityBreakdown: [] },
    { label: '即将开拍（与小程序同步）', value: 0, cityBreakdown: [] },
    { label: '捡漏房源（与小程序同步）', value: 0, cityBreakdown: [] },
    { label: '昨日上架（与小程序同步）', value: 0, cityBreakdown: [] },
    { label: '昨日成交（与小程序同步）', value: 0, cityBreakdown: [] },
    { label: '累计已成交', value: 0, cityBreakdown: [] },
    { label: '拍卖进行中数量', value: 0, cityBreakdown: [] },
    { label: '待处理需求', value: 0, cityBreakdown: [] },
    { label: '待处理留言', value: 0, cityBreakdown: [] },
    { label: '注册用户', value: 0, cityBreakdown: [] },
    { label: '总文章数', value: 0, cityBreakdown: [] },
]);
async function loadDashboard() {
    try {
        const data = await getDashboard(cityId.value || undefined);
        // 城市key映射
        const cityKeyNames = {
            shanghai: '上海',
            ningbo: '宁波',
            hangzhou: '杭州'
        };
        // 辅助函数：从后端返回的数据中提取值和城市分项
        function parseMetric(metricData) {
            if (typeof metricData === 'object' && metricData.total !== undefined) {
                // 带 by_city 的指标：{ total: xxx, by_city: { shanghai: xxx, ningbo: xxx, hangzhou: xxx } }
                const cityBreakdown = metricData.by_city ? Object.keys(metricData.by_city).map(cityKey => ({
                    name: cityKeyNames[cityKey] || cityKey,
                    value: metricData.by_city[cityKey]
                })) : [];
                return { value: metricData.total, cityBreakdown };
            }
            else {
                // 不带 by_city 的指标：直接是数字
                return { value: metricData || 0, cityBreakdown: [] };
            }
        }
        // 更新卡片数据（顺序须与上方 cards 定义一一对应）
        const metrics = [
            parseMetric(data.total_properties), // 如数据库总房源数
            parseMetric(data.today_new), // 今日入库房源数
            parseMetric(data.upcoming), // 即将开拍（与小程序同步）
            parseMetric(data.bargain_count), // 捡漏房源（与小程序同步）
            parseMetric(data.yesterday_listed), // 昨日上架（与小程序同步）
            parseMetric(data.yesterday_sold), // 昨日成交（与小程序同步）
            parseMetric(data.sold), // 累计已成交
            parseMetric(data.in_progress), // 拍卖进行中数量
            parseMetric(data.pending_demands), // 待处理需求
            parseMetric(data.pending_messages), // 待处理留言
            parseMetric(data.total_users), // 注册用户
            parseMetric(data.total_articles), // 总文章数
        ];
        metrics.forEach((metric, index) => {
            cards.value[index].value = metric.value;
            cards.value[index].cityBreakdown = metric.cityBreakdown;
        });
    }
    catch { /* skip */ }
}
onMounted(async () => {
    loadDashboard();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "dashboard" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "page-title" },
});
const __VLS_0 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.cityId),
    ...{ style: {} },
}));
const __VLS_2 = __VLS_1({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.cityId),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onChange: (__VLS_ctx.loadDashboard)
};
__VLS_3.slots.default;
const __VLS_8 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    value: (0),
    label: "全部",
}));
const __VLS_10 = __VLS_9({
    value: (0),
    label: "全部",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
const __VLS_12 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    value: (310000),
    label: "上海",
}));
const __VLS_14 = __VLS_13({
    value: (310000),
    label: "上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
const __VLS_16 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    value: (330200),
    label: "宁波",
}));
const __VLS_18 = __VLS_17({
    value: (330200),
    label: "宁波",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const __VLS_20 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    value: (330100),
    label: "杭州",
}));
const __VLS_22 = __VLS_21({
    value: (330100),
    label: "杭州",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
var __VLS_3;
const __VLS_24 = {}.TRow;
/** @type {[typeof __VLS_components.TRow, typeof __VLS_components.tRow, typeof __VLS_components.TRow, typeof __VLS_components.tRow, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    gutter: (16),
    ...{ class: "stat-cards" },
}));
const __VLS_26 = __VLS_25({
    gutter: (16),
    ...{ class: "stat-cards" },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
for (const [card] of __VLS_getVForSourceType((__VLS_ctx.cards))) {
    const __VLS_28 = {}.TCol;
    /** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        span: (3),
        key: (card.label),
    }));
    const __VLS_30 = __VLS_29({
        span: (3),
        key: (card.label),
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_31.slots.default;
    const __VLS_32 = {}.TCard;
    /** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        title: (card.label),
        hoverShadow: true,
    }));
    const __VLS_34 = __VLS_33({
        title: (card.label),
        hoverShadow: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_35.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-value" },
    });
    (card.value);
    if (card.cityBreakdown && card.cityBreakdown.length > 0 && __VLS_ctx.cityId === 0) {
        const __VLS_36 = {}.TCollapse;
        /** @type {[typeof __VLS_components.TCollapse, typeof __VLS_components.tCollapse, typeof __VLS_components.TCollapse, typeof __VLS_components.tCollapse, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
            ...{ style: {} },
        }));
        const __VLS_38 = __VLS_37({
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
        __VLS_39.slots.default;
        const __VLS_40 = {}.TCollapsePanel;
        /** @type {[typeof __VLS_components.TCollapsePanel, typeof __VLS_components.tCollapsePanel, typeof __VLS_components.TCollapsePanel, typeof __VLS_components.tCollapsePanel, ]} */ ;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
            header: "城市明细",
        }));
        const __VLS_42 = __VLS_41({
            header: "城市明细",
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
        __VLS_43.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "city-breakdown" },
        });
        for (const [city] of __VLS_getVForSourceType((card.cityBreakdown))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (city.name),
                ...{ class: "city-item" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "city-name" },
            });
            (city.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "city-value" },
            });
            (city.value);
        }
        var __VLS_43;
        var __VLS_39;
    }
    var __VLS_35;
    var __VLS_31;
}
var __VLS_27;
/** @type {__VLS_StyleScopedClasses['dashboard']} */ ;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-cards']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['city-breakdown']} */ ;
/** @type {__VLS_StyleScopedClasses['city-item']} */ ;
/** @type {__VLS_StyleScopedClasses['city-name']} */ ;
/** @type {__VLS_StyleScopedClasses['city-value']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            cityId: cityId,
            cards: cards,
            loadDashboard: loadDashboard,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
