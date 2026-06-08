/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getCrawlerStatus, listCrawlerTasks, triggerCrawler, getCookiesStatus, updateCookie } from '@/api/crawler';
const triggerLoading = ref(false);
const taskLoading = ref(false);
const tasks = ref([]);
const statsVisible = ref(false);
const currentStats = ref(null);
const platforms = [
    { key: 'taobao', name: '淘宝拍卖', url: 'https://sf.taobao.com/', domain: '.taobao.com' },
    { key: 'jd', name: '京东拍卖', url: 'https://auction.jd.com/', domain: '.jd.com' },
    { key: 'gpai', name: '公拍网', url: 'https://www.gpai.net/', domain: '.gpai.net' },
];
const cookiesStatus = ref({});
const cookieInputs = ref({
    taobao: '',
    jd: '',
    gpai: '',
});
const cookieLoading = ref({
    taobao: false,
    jd: false,
    gpai: false,
});
const extractLoading = ref({
    taobao: false,
    jd: false,
    gpai: false,
});
let loginWindow = null;
function showStats(row) {
    currentStats.value = row.stats_summary;
    statsVisible.value = true;
}
const statusItems = ref([{ label: '最近运行', value: '--' }, { label: '当前状态', value: '--' }]);
const taskColumns = [
    { colKey: 'id', title: 'ID', width: 70 },
    { colKey: 'platform', title: '平台', width: 100 },
    { colKey: 'city', title: '城市', width: 80 },
    { colKey: 'status', title: '状态', width: 90 },
    { colKey: 'total_count', title: '抓取数', width: 80 },
    { colKey: 'new_count', title: '新增', width: 70 },
    { colKey: 'updated_count', title: '更新', width: 70 },
    { colKey: 'success_count', title: '成功', width: 80 },
    { colKey: 'last_run_at', title: '运行时间', width: 180 },
    { colKey: 'op', title: '详情', width: 80 },
];
onMounted(() => { loadStatus(); loadTasks(); loadCookiesStatus(); });
async function loadStatus() {
    try {
        const data = await getCrawlerStatus();
        statusItems.value = [
            { label: '最近运行', value: data.last_run_at || '--' },
            { label: '当前状态', value: data.is_running ? '运行中' : data.last_status || '--' },
        ];
    }
    catch { /* skip */ }
}
async function loadTasks() {
    taskLoading.value = true;
    try {
        const data = await listCrawlerTasks();
        tasks.value = data;
    }
    finally {
        taskLoading.value = false;
    }
}
async function loadCookiesStatus() {
    try {
        const data = await getCookiesStatus();
        cookiesStatus.value = data;
    }
    catch (err) {
        console.error('加载Cookie状态失败:', err);
    }
}
function onOpenLoginPage(platform) {
    const width = 1000;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    loginWindow = window.open(platform.url, `login_${platform.key}`, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    if (loginWindow) {
        MessagePlugin.info(`已打开${platform.name}登录页面，请在新窗口完成登录`);
    }
    else {
        MessagePlugin.error('无法打开新窗口，请检查浏览器是否阻止了弹窗');
    }
}
async function onExtractCookie(platformKey) {
    const platform = platforms.find(p => p.key === platformKey);
    if (!platform)
        return;
    MessagePlugin.warning({
        content: `由于浏览器安全限制，请手动获取Cookie：
1. 在登录窗口按F12打开开发者工具
2. 进入Application标签 > Cookies > ${platform.domain}
3. 复制所有Cookie的键值对（格式：key1=value1; key2=value2）
4. 粘贴到下方文本框中并点击保存`,
        duration: 10000,
    });
}
async function onUpdateCookie(platform) {
    const cookie = cookieInputs.value[platform]?.trim();
    if (!cookie) {
        MessagePlugin.warning('请输入Cookie内容');
        return;
    }
    cookieLoading.value[platform] = true;
    try {
        await updateCookie(platform, cookie);
        MessagePlugin.success('Cookie已保存');
        cookieInputs.value[platform] = '';
        await loadCookiesStatus();
    }
    catch (err) {
        MessagePlugin.error(err.message || 'Cookie保存失败');
    }
    finally {
        cookieLoading.value[platform] = false;
    }
}
async function onTriggerAll() {
    triggerLoading.value = true;
    try {
        await triggerCrawler();
        MessagePlugin.success('任务已创建');
    }
    finally {
        triggerLoading.value = false;
    }
}
async function onTriggerPlatform(platform) {
    try {
        await triggerCrawler({ platform });
        MessagePlugin.success(`${platform} 任务已创建`);
    }
    catch { /* skip */ }
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
    ...{ style: {} },
}));
const __VLS_2 = __VLS_1({
    gutter: (16),
    ...{ style: {} },
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
    title: "运行状态",
}));
const __VLS_10 = __VLS_9({
    title: "运行状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.TDescriptions;
/** @type {[typeof __VLS_components.TDescriptions, typeof __VLS_components.tDescriptions, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    items: (__VLS_ctx.statusItems),
}));
const __VLS_14 = __VLS_13({
    items: (__VLS_ctx.statusItems),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
const __VLS_16 = {}.TDivider;
/** @type {[typeof __VLS_components.TDivider, typeof __VLS_components.tDivider, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    ...{ style: {} },
}));
const __VLS_18 = __VLS_17({
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const __VLS_20 = {}.TLink;
/** @type {[typeof __VLS_components.TLink, typeof __VLS_components.tLink, typeof __VLS_components.TLink, typeof __VLS_components.tLink, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    theme: "primary",
    href: "https://u.yunjingl2tp.com/sk5line/index",
    target: "_blank",
    hover: "color",
}));
const __VLS_22 = __VLS_21({
    theme: "primary",
    href: "https://u.yunjingl2tp.com/sk5line/index",
    target: "_blank",
    hover: "color",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
{
    const { 'prefix-icon': __VLS_thisSlot } = __VLS_23.slots;
    const __VLS_24 = {}.TIcon;
    /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        name: "swap",
    }));
    const __VLS_26 = __VLS_25({
        name: "swap",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
}
var __VLS_23;
var __VLS_11;
var __VLS_7;
const __VLS_28 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    span: (6),
}));
const __VLS_30 = __VLS_29({
    span: (6),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    title: "手动操作",
}));
const __VLS_34 = __VLS_33({
    title: "手动操作",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
const __VLS_36 = {}.TSpace;
/** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    direction: "vertical",
}));
const __VLS_38 = __VLS_37({
    direction: "vertical",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
const __VLS_40 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    ...{ 'onClick': {} },
    theme: "primary",
    loading: (__VLS_ctx.triggerLoading),
}));
const __VLS_42 = __VLS_41({
    ...{ 'onClick': {} },
    theme: "primary",
    loading: (__VLS_ctx.triggerLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
let __VLS_44;
let __VLS_45;
let __VLS_46;
const __VLS_47 = {
    onClick: (__VLS_ctx.onTriggerAll)
};
__VLS_43.slots.default;
var __VLS_43;
const __VLS_48 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_50 = __VLS_49({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
let __VLS_52;
let __VLS_53;
let __VLS_54;
const __VLS_55 = {
    onClick: (...[$event]) => {
        __VLS_ctx.onTriggerPlatform('阿里拍卖');
    }
};
__VLS_51.slots.default;
var __VLS_51;
const __VLS_56 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_58 = __VLS_57({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
let __VLS_60;
let __VLS_61;
let __VLS_62;
const __VLS_63 = {
    onClick: (...[$event]) => {
        __VLS_ctx.onTriggerPlatform('京东拍卖');
    }
};
__VLS_59.slots.default;
var __VLS_59;
const __VLS_64 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    ...{ 'onClick': {} },
    variant: "outline",
}));
const __VLS_66 = __VLS_65({
    ...{ 'onClick': {} },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
let __VLS_68;
let __VLS_69;
let __VLS_70;
const __VLS_71 = {
    onClick: (...[$event]) => {
        __VLS_ctx.onTriggerPlatform('公拍网');
    }
};
__VLS_67.slots.default;
var __VLS_67;
var __VLS_39;
var __VLS_35;
var __VLS_31;
const __VLS_72 = {}.TCol;
/** @type {[typeof __VLS_components.TCol, typeof __VLS_components.tCol, typeof __VLS_components.TCol, typeof __VLS_components.tCol, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    span: (12),
}));
const __VLS_74 = __VLS_73({
    span: (12),
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
const __VLS_76 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    title: "Cookie管理",
}));
const __VLS_78 = __VLS_77({
    title: "Cookie管理",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
__VLS_79.slots.default;
const __VLS_80 = {}.TSpace;
/** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    direction: "vertical",
    ...{ style: {} },
}));
const __VLS_82 = __VLS_81({
    direction: "vertical",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
for (const [platform] of __VLS_getVForSourceType((__VLS_ctx.platforms))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (platform.key),
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ style: {} },
    });
    (platform.name);
    const __VLS_84 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        theme: (__VLS_ctx.cookiesStatus[platform.key]?.configured ? 'success' : 'warning'),
        size: "small",
    }));
    const __VLS_86 = __VLS_85({
        theme: (__VLS_ctx.cookiesStatus[platform.key]?.configured ? 'success' : 'warning'),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    (__VLS_ctx.cookiesStatus[platform.key]?.configured ? '已配置' : '未配置');
    var __VLS_87;
    const __VLS_88 = {}.TSpace;
    /** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        direction: "vertical",
        ...{ style: {} },
    }));
    const __VLS_90 = __VLS_89({
        direction: "vertical",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    __VLS_91.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    (platform.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    const __VLS_92 = {}.TSpace;
    /** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({}));
    const __VLS_94 = __VLS_93({}, ...__VLS_functionalComponentArgsRest(__VLS_93));
    __VLS_95.slots.default;
    const __VLS_96 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ 'onClick': {} },
        size: "small",
        variant: "outline",
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onClick': {} },
        size: "small",
        variant: "outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_100;
    let __VLS_101;
    let __VLS_102;
    const __VLS_103 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onOpenLoginPage(platform);
        }
    };
    __VLS_99.slots.default;
    {
        const { icon: __VLS_thisSlot } = __VLS_99.slots;
        const __VLS_104 = {}.TIcon;
        /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
        // @ts-ignore
        const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
            name: "login",
        }));
        const __VLS_106 = __VLS_105({
            name: "login",
        }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    }
    (platform.name);
    var __VLS_99;
    const __VLS_108 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        ...{ 'onClick': {} },
        size: "small",
        theme: "primary",
        loading: (__VLS_ctx.extractLoading[platform.key]),
    }));
    const __VLS_110 = __VLS_109({
        ...{ 'onClick': {} },
        size: "small",
        theme: "primary",
        loading: (__VLS_ctx.extractLoading[platform.key]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    let __VLS_112;
    let __VLS_113;
    let __VLS_114;
    const __VLS_115 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onExtractCookie(platform.key);
        }
    };
    __VLS_111.slots.default;
    {
        const { icon: __VLS_thisSlot } = __VLS_111.slots;
        const __VLS_116 = {}.TIcon;
        /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
        // @ts-ignore
        const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
            name: "precise-monitor",
        }));
        const __VLS_118 = __VLS_117({
            name: "precise-monitor",
        }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    }
    var __VLS_111;
    var __VLS_95;
    const __VLS_120 = {}.TDivider;
    /** @type {[typeof __VLS_components.TDivider, typeof __VLS_components.tDivider, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        ...{ style: {} },
    }));
    const __VLS_122 = __VLS_121({
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    const __VLS_124 = {}.TTextarea;
    /** @type {[typeof __VLS_components.TTextarea, typeof __VLS_components.tTextarea, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        modelValue: (__VLS_ctx.cookieInputs[platform.key]),
        placeholder: (`手动粘贴${platform.name}的Cookie字符串`),
        autosize: ({ minRows: 2, maxRows: 3 }),
        ...{ style: {} },
    }));
    const __VLS_126 = __VLS_125({
        modelValue: (__VLS_ctx.cookieInputs[platform.key]),
        placeholder: (`手动粘贴${platform.name}的Cookie字符串`),
        autosize: ({ minRows: 2, maxRows: 3 }),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    const __VLS_128 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        ...{ 'onClick': {} },
        size: "small",
        variant: "base",
        loading: (__VLS_ctx.cookieLoading[platform.key]),
    }));
    const __VLS_130 = __VLS_129({
        ...{ 'onClick': {} },
        size: "small",
        variant: "base",
        loading: (__VLS_ctx.cookieLoading[platform.key]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    let __VLS_132;
    let __VLS_133;
    let __VLS_134;
    const __VLS_135 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onUpdateCookie(platform.key);
        }
    };
    __VLS_131.slots.default;
    var __VLS_131;
    var __VLS_91;
}
var __VLS_83;
var __VLS_79;
var __VLS_75;
var __VLS_3;
const __VLS_136 = {}.TCard;
/** @type {[typeof __VLS_components.TCard, typeof __VLS_components.tCard, typeof __VLS_components.TCard, typeof __VLS_components.tCard, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    title: "任务记录",
}));
const __VLS_138 = __VLS_137({
    title: "任务记录",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
const __VLS_140 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    data: (__VLS_ctx.tasks),
    columns: (__VLS_ctx.taskColumns),
    loading: (__VLS_ctx.taskLoading),
    rowKey: "id",
}));
const __VLS_142 = __VLS_141({
    data: (__VLS_ctx.tasks),
    columns: (__VLS_ctx.taskColumns),
    loading: (__VLS_ctx.taskLoading),
    rowKey: "id",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
__VLS_143.slots.default;
{
    const { status: __VLS_thisSlot } = __VLS_143.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_144 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        theme: (row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'running' ? 'primary' : 'default'),
    }));
    const __VLS_146 = __VLS_145({
        theme: (row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'running' ? 'primary' : 'default'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    __VLS_147.slots.default;
    (row.status);
    var __VLS_147;
}
{
    const { op: __VLS_thisSlot } = __VLS_143.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    if (row.stats_summary) {
        const __VLS_148 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
        }));
        const __VLS_150 = __VLS_149({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_149));
        let __VLS_152;
        let __VLS_153;
        let __VLS_154;
        const __VLS_155 = {
            onClick: (...[$event]) => {
                if (!(row.stats_summary))
                    return;
                __VLS_ctx.showStats(row);
            }
        };
        __VLS_151.slots.default;
        var __VLS_151;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
    }
}
var __VLS_143;
var __VLS_139;
const __VLS_156 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    visible: (__VLS_ctx.statsVisible),
    header: "本轮爬取详情",
    width: "600px",
    footer: (false),
}));
const __VLS_158 = __VLS_157({
    visible: (__VLS_ctx.statsVisible),
    header: "本轮爬取详情",
    width: "600px",
    footer: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
__VLS_159.slots.default;
if (__VLS_ctx.currentStats) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
        ...{ style: {} },
    });
    (JSON.stringify(__VLS_ctx.currentStats, null, 2));
}
var __VLS_159;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            triggerLoading: triggerLoading,
            taskLoading: taskLoading,
            tasks: tasks,
            statsVisible: statsVisible,
            currentStats: currentStats,
            platforms: platforms,
            cookiesStatus: cookiesStatus,
            cookieInputs: cookieInputs,
            cookieLoading: cookieLoading,
            extractLoading: extractLoading,
            showStats: showStats,
            statusItems: statusItems,
            taskColumns: taskColumns,
            onOpenLoginPage: onOpenLoginPage,
            onExtractCookie: onExtractCookie,
            onUpdateCookie: onUpdateCookie,
            onTriggerAll: onTriggerAll,
            onTriggerPlatform: onTriggerPlatform,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
