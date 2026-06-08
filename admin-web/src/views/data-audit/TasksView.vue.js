/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { getTaskList, getTaskDetail } from '@/api/dataAudit';
import { onBeforeUnmount } from 'vue';
debugger; /* PartiallyEnd: #3632/both.vue */
export default await (async () => {
    const router = useRouter();
    const loading = ref(false);
    const tasks = ref([]);
    const filterStatus = ref('');
    const detailDialogVisible = ref(false);
    const taskDetail = ref({
        id: null,
        task_name: '',
        task_type: '',
        status: '',
        progress: 0,
        total_records: 0,
        passed_count: 0,
        flagged_count: 0,
        fixed_count: 0,
        deleted_count: 0,
        rule_ids: [],
        scope: null,
        created_at: '',
        started_at: '',
        completed_at: '',
        duration_seconds: null,
        error_message: ''
    });
    // 加载任务列表
    const loadTasks = async () => {
        loading.value = true;
        try {
            const params = { limit: 100 };
            if (filterStatus.value)
                params.status = filterStatus.value;
            const res = await getTaskList(params);
            tasks.value = res;
        }
        catch (error) {
            ElMessage.error('加载任务列表失败');
        }
        finally {
            loading.value = false;
        }
    };
    // 查看详情
    const handleViewDetail = async (row) => {
        try {
            const res = await getTaskDetail(row.id);
            taskDetail.value = res;
            detailDialogVisible.value = true;
        }
        catch (error) {
            ElMessage.error('加载任务详情失败');
        }
    };
    // 查看报告
    const handleViewReport = (row) => {
        router.push(`/data-audit/reports/${row.id}`);
    };
    // 辅助函数
    const getStatusType = (status) => {
        const map = {
            pending: 'info',
            running: 'warning',
            completed: 'success',
            failed: 'danger'
        };
        return map[status] || 'info';
    };
    const getStatusText = (status) => {
        const map = {
            pending: '待执行',
            running: '执行中',
            completed: '已完成',
            failed: '失败'
        };
        return map[status] || status;
    };
    const formatDuration = (seconds) => {
        if (seconds < 60)
            return `${seconds}秒`;
        const minutes = Math.floor(seconds / 60);
        const remainSeconds = seconds % 60;
        return `${minutes}分${remainSeconds}秒`;
    };
    onMounted(() => {
        loadTasks();
        // 如果有running状态的任务，定时刷新
        const interval = setInterval(() => {
            const hasRunning = tasks.value.some(t => t.status === 'running');
            if (hasRunning) {
                loadTasks();
            }
        }, 10000); // 每10秒刷新一次
        // 组件卸载时清除定时器
        onBeforeUnmount(() => {
            clearInterval(interval);
        });
    });
    debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
    const __VLS_ctx = {};
    let __VLS_components;
    let __VLS_directives;
    // CSS variable injection 
    // CSS variable injection end 
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "audit-tasks" },
    });
    const __VLS_0 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_3.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_3.slots;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card-header" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "filter-bar" },
    });
    const __VLS_4 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        modelValue: (__VLS_ctx.filterStatus),
        placeholder: "任务状态",
        clearable: true,
        ...{ style: {} },
    }));
    const __VLS_6 = __VLS_5({
        modelValue: (__VLS_ctx.filterStatus),
        placeholder: "任务状态",
        clearable: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_7.slots.default;
    const __VLS_8 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        label: "待执行",
        value: "pending",
    }));
    const __VLS_10 = __VLS_9({
        label: "待执行",
        value: "pending",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    const __VLS_12 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        label: "执行中",
        value: "running",
    }));
    const __VLS_14 = __VLS_13({
        label: "执行中",
        value: "running",
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    const __VLS_16 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        label: "已完成",
        value: "completed",
    }));
    const __VLS_18 = __VLS_17({
        label: "已完成",
        value: "completed",
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    const __VLS_20 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        label: "失败",
        value: "failed",
    }));
    const __VLS_22 = __VLS_21({
        label: "失败",
        value: "failed",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    var __VLS_7;
    const __VLS_24 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        ...{ 'onClick': {} },
        type: "primary",
        ...{ style: {} },
    }));
    const __VLS_26 = __VLS_25({
        ...{ 'onClick': {} },
        type: "primary",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    let __VLS_28;
    let __VLS_29;
    let __VLS_30;
    const __VLS_31 = {
        onClick: (__VLS_ctx.loadTasks)
    };
    __VLS_27.slots.default;
    var __VLS_27;
    const __VLS_32 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        ...{ 'onClick': {} },
        ...{ style: {} },
    }));
    const __VLS_34 = __VLS_33({
        ...{ 'onClick': {} },
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    let __VLS_36;
    let __VLS_37;
    let __VLS_38;
    const __VLS_39 = {
        onClick: (__VLS_ctx.loadTasks)
    };
    __VLS_35.slots.default;
    const __VLS_40 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
    const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_43.slots.default;
    const __VLS_44 = {}.Refresh;
    /** @type {[typeof __VLS_components.Refresh, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({}));
    const __VLS_46 = __VLS_45({}, ...__VLS_functionalComponentArgsRest(__VLS_45));
    var __VLS_43;
    var __VLS_35;
    const __VLS_48 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        data: (__VLS_ctx.tasks),
        ...{ style: {} },
    }));
    const __VLS_50 = __VLS_49({
        data: (__VLS_ctx.tasks),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
    __VLS_51.slots.default;
    const __VLS_52 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        prop: "id",
        label: "任务ID",
        width: "80",
    }));
    const __VLS_54 = __VLS_53({
        prop: "id",
        label: "任务ID",
        width: "80",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    const __VLS_56 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        prop: "task_name",
        label: "任务名称",
        minWidth: "200",
    }));
    const __VLS_58 = __VLS_57({
        prop: "task_name",
        label: "任务名称",
        minWidth: "200",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    const __VLS_60 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        prop: "task_type",
        label: "任务类型",
        width: "100",
    }));
    const __VLS_62 = __VLS_61({
        prop: "task_type",
        label: "任务类型",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_63.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_63.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_64 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
            size: "small",
            type: (row.task_type === 'scheduled' ? 'success' : 'info'),
        }));
        const __VLS_66 = __VLS_65({
            size: "small",
            type: (row.task_type === 'scheduled' ? 'success' : 'info'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
        __VLS_67.slots.default;
        (row.task_type === 'scheduled' ? '定时任务' : '手动执行');
        var __VLS_67;
    }
    var __VLS_63;
    const __VLS_68 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        prop: "status",
        label: "状态",
        width: "100",
    }));
    const __VLS_70 = __VLS_69({
        prop: "status",
        label: "状态",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_71.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_72 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
            type: (__VLS_ctx.getStatusType(row.status)),
            size: "small",
        }));
        const __VLS_74 = __VLS_73({
            type: (__VLS_ctx.getStatusType(row.status)),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_73));
        __VLS_75.slots.default;
        (__VLS_ctx.getStatusText(row.status));
        var __VLS_75;
    }
    var __VLS_71;
    const __VLS_76 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        label: "进度",
        width: "150",
    }));
    const __VLS_78 = __VLS_77({
        label: "进度",
        width: "150",
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    __VLS_79.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_79.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_80 = {}.ElProgress;
        /** @type {[typeof __VLS_components.ElProgress, typeof __VLS_components.elProgress, ]} */ ;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
            percentage: (Math.round(row.progress)),
            status: (row.status === 'failed' ? 'exception' : (row.status === 'completed' ? 'success' : '')),
        }));
        const __VLS_82 = __VLS_81({
            percentage: (Math.round(row.progress)),
            status: (row.status === 'failed' ? 'exception' : (row.status === 'completed' ? 'success' : '')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    }
    var __VLS_79;
    const __VLS_84 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        label: "统计",
        width: "200",
    }));
    const __VLS_86 = __VLS_85({
        label: "统计",
        width: "200",
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_87.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        (row.total_records);
        (row.passed_count);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        (row.flagged_count);
        (row.fixed_count);
        (row.deleted_count);
    }
    var __VLS_87;
    const __VLS_88 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        prop: "duration_seconds",
        label: "耗时",
        width: "100",
    }));
    const __VLS_90 = __VLS_89({
        prop: "duration_seconds",
        label: "耗时",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    __VLS_91.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_91.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.duration_seconds ? __VLS_ctx.formatDuration(row.duration_seconds) : '-');
    }
    var __VLS_91;
    const __VLS_92 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
        prop: "created_at",
        label: "创建时间",
        width: "160",
    }));
    const __VLS_94 = __VLS_93({
        prop: "created_at",
        label: "创建时间",
        width: "160",
    }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    const __VLS_96 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        label: "操作",
        width: "200",
        fixed: "right",
    }));
    const __VLS_98 = __VLS_97({
        label: "操作",
        width: "200",
        fixed: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_99.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_100 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            ...{ 'onClick': {} },
            type: "primary",
            link: true,
            size: "small",
        }));
        const __VLS_102 = __VLS_101({
            ...{ 'onClick': {} },
            type: "primary",
            link: true,
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
        let __VLS_104;
        let __VLS_105;
        let __VLS_106;
        const __VLS_107 = {
            onClick: (...[$event]) => {
                __VLS_ctx.handleViewDetail(row);
            }
        };
        __VLS_103.slots.default;
        var __VLS_103;
        const __VLS_108 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
            ...{ 'onClick': {} },
            type: "success",
            link: true,
            size: "small",
            disabled: (row.status !== 'completed'),
        }));
        const __VLS_110 = __VLS_109({
            ...{ 'onClick': {} },
            type: "success",
            link: true,
            size: "small",
            disabled: (row.status !== 'completed'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_109));
        let __VLS_112;
        let __VLS_113;
        let __VLS_114;
        const __VLS_115 = {
            onClick: (...[$event]) => {
                __VLS_ctx.handleViewReport(row);
            }
        };
        __VLS_111.slots.default;
        var __VLS_111;
    }
    var __VLS_99;
    var __VLS_51;
    var __VLS_3;
    const __VLS_116 = {}.ElDialog;
    /** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        modelValue: (__VLS_ctx.detailDialogVisible),
        title: "任务详情",
        width: "800px",
    }));
    const __VLS_118 = __VLS_117({
        modelValue: (__VLS_ctx.detailDialogVisible),
        title: "任务详情",
        width: "800px",
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    __VLS_119.slots.default;
    const __VLS_120 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        column: (2),
        border: true,
    }));
    const __VLS_122 = __VLS_121({
        column: (2),
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    __VLS_123.slots.default;
    const __VLS_124 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        label: "任务ID",
    }));
    const __VLS_126 = __VLS_125({
        label: "任务ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_127.slots.default;
    (__VLS_ctx.taskDetail.id);
    var __VLS_127;
    const __VLS_128 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        label: "任务名称",
    }));
    const __VLS_130 = __VLS_129({
        label: "任务名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    __VLS_131.slots.default;
    (__VLS_ctx.taskDetail.task_name);
    var __VLS_131;
    const __VLS_132 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        label: "任务类型",
    }));
    const __VLS_134 = __VLS_133({
        label: "任务类型",
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    const __VLS_136 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        size: "small",
        type: (__VLS_ctx.taskDetail.task_type === 'scheduled' ? 'success' : 'info'),
    }));
    const __VLS_138 = __VLS_137({
        size: "small",
        type: (__VLS_ctx.taskDetail.task_type === 'scheduled' ? 'success' : 'info'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    __VLS_139.slots.default;
    (__VLS_ctx.taskDetail.task_type === 'scheduled' ? '定时任务' : '手动执行');
    var __VLS_139;
    var __VLS_135;
    const __VLS_140 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        label: "任务状态",
    }));
    const __VLS_142 = __VLS_141({
        label: "任务状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    __VLS_143.slots.default;
    const __VLS_144 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        type: (__VLS_ctx.getStatusType(__VLS_ctx.taskDetail.status)),
        size: "small",
    }));
    const __VLS_146 = __VLS_145({
        type: (__VLS_ctx.getStatusType(__VLS_ctx.taskDetail.status)),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    __VLS_147.slots.default;
    (__VLS_ctx.getStatusText(__VLS_ctx.taskDetail.status));
    var __VLS_147;
    var __VLS_143;
    const __VLS_148 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        label: "执行进度",
    }));
    const __VLS_150 = __VLS_149({
        label: "执行进度",
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    __VLS_151.slots.default;
    const __VLS_152 = {}.ElProgress;
    /** @type {[typeof __VLS_components.ElProgress, typeof __VLS_components.elProgress, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        percentage: (Math.round(__VLS_ctx.taskDetail.progress)),
    }));
    const __VLS_154 = __VLS_153({
        percentage: (Math.round(__VLS_ctx.taskDetail.progress)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    var __VLS_151;
    const __VLS_156 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
        label: "执行耗时",
    }));
    const __VLS_158 = __VLS_157({
        label: "执行耗时",
    }, ...__VLS_functionalComponentArgsRest(__VLS_157));
    __VLS_159.slots.default;
    (__VLS_ctx.taskDetail.duration_seconds ? __VLS_ctx.formatDuration(__VLS_ctx.taskDetail.duration_seconds) : '-');
    var __VLS_159;
    const __VLS_160 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        label: "总检查记录数",
    }));
    const __VLS_162 = __VLS_161({
        label: "总检查记录数",
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    __VLS_163.slots.default;
    (__VLS_ctx.taskDetail.total_records);
    var __VLS_163;
    const __VLS_164 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
        label: "通过数量",
    }));
    const __VLS_166 = __VLS_165({
        label: "通过数量",
    }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    __VLS_167.slots.default;
    const __VLS_168 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
        type: "success",
        size: "small",
    }));
    const __VLS_170 = __VLS_169({
        type: "success",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    __VLS_171.slots.default;
    (__VLS_ctx.taskDetail.passed_count);
    var __VLS_171;
    var __VLS_167;
    const __VLS_172 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
        label: "标记数量",
    }));
    const __VLS_174 = __VLS_173({
        label: "标记数量",
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
    __VLS_175.slots.default;
    const __VLS_176 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
        type: "warning",
        size: "small",
    }));
    const __VLS_178 = __VLS_177({
        type: "warning",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_177));
    __VLS_179.slots.default;
    (__VLS_ctx.taskDetail.flagged_count);
    var __VLS_179;
    var __VLS_175;
    const __VLS_180 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        label: "修复数量",
    }));
    const __VLS_182 = __VLS_181({
        label: "修复数量",
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    __VLS_183.slots.default;
    const __VLS_184 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
        type: "info",
        size: "small",
    }));
    const __VLS_186 = __VLS_185({
        type: "info",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_185));
    __VLS_187.slots.default;
    (__VLS_ctx.taskDetail.fixed_count);
    var __VLS_187;
    var __VLS_183;
    const __VLS_188 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
        label: "删除数量",
    }));
    const __VLS_190 = __VLS_189({
        label: "删除数量",
    }, ...__VLS_functionalComponentArgsRest(__VLS_189));
    __VLS_191.slots.default;
    const __VLS_192 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
        type: "danger",
        size: "small",
    }));
    const __VLS_194 = __VLS_193({
        type: "danger",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_193));
    __VLS_195.slots.default;
    (__VLS_ctx.taskDetail.deleted_count);
    var __VLS_195;
    var __VLS_191;
    const __VLS_196 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        label: "创建时间",
    }));
    const __VLS_198 = __VLS_197({
        label: "创建时间",
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    __VLS_199.slots.default;
    (__VLS_ctx.taskDetail.created_at);
    var __VLS_199;
    const __VLS_200 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
        label: "开始时间",
    }));
    const __VLS_202 = __VLS_201({
        label: "开始时间",
    }, ...__VLS_functionalComponentArgsRest(__VLS_201));
    __VLS_203.slots.default;
    (__VLS_ctx.taskDetail.started_at || '-');
    var __VLS_203;
    const __VLS_204 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
        label: "完成时间",
    }));
    const __VLS_206 = __VLS_205({
        label: "完成时间",
    }, ...__VLS_functionalComponentArgsRest(__VLS_205));
    __VLS_207.slots.default;
    (__VLS_ctx.taskDetail.completed_at || '-');
    var __VLS_207;
    const __VLS_208 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
        label: "使用规则",
        span: (2),
    }));
    const __VLS_210 = __VLS_209({
        label: "使用规则",
        span: (2),
    }, ...__VLS_functionalComponentArgsRest(__VLS_209));
    __VLS_211.slots.default;
    for (const [ruleId] of __VLS_getVForSourceType((__VLS_ctx.taskDetail.rule_ids))) {
        const __VLS_212 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
            key: (ruleId),
            size: "small",
            ...{ style: {} },
        }));
        const __VLS_214 = __VLS_213({
            key: (ruleId),
            size: "small",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_213));
        __VLS_215.slots.default;
        (ruleId);
        var __VLS_215;
    }
    var __VLS_211;
    const __VLS_216 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
        label: "审核范围",
        span: (2),
    }));
    const __VLS_218 = __VLS_217({
        label: "审核范围",
        span: (2),
    }, ...__VLS_functionalComponentArgsRest(__VLS_217));
    __VLS_219.slots.default;
    if (__VLS_ctx.taskDetail.scope) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
            ...{ style: {} },
        });
        (JSON.stringify(__VLS_ctx.taskDetail.scope, null, 2));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    var __VLS_219;
    if (__VLS_ctx.taskDetail.error_message) {
        const __VLS_220 = {}.ElDescriptionsItem;
        /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
        // @ts-ignore
        const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
            label: "错误信息",
            span: (2),
        }));
        const __VLS_222 = __VLS_221({
            label: "错误信息",
            span: (2),
        }, ...__VLS_functionalComponentArgsRest(__VLS_221));
        __VLS_223.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ style: {} },
        });
        (__VLS_ctx.taskDetail.error_message);
        var __VLS_223;
    }
    var __VLS_123;
    {
        const { footer: __VLS_thisSlot } = __VLS_119.slots;
        const __VLS_224 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
            ...{ 'onClick': {} },
        }));
        const __VLS_226 = __VLS_225({
            ...{ 'onClick': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_225));
        let __VLS_228;
        let __VLS_229;
        let __VLS_230;
        const __VLS_231 = {
            onClick: (...[$event]) => {
                __VLS_ctx.detailDialogVisible = false;
            }
        };
        __VLS_227.slots.default;
        var __VLS_227;
        const __VLS_232 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
            ...{ 'onClick': {} },
            type: "primary",
            disabled: (__VLS_ctx.taskDetail.status !== 'completed'),
        }));
        const __VLS_234 = __VLS_233({
            ...{ 'onClick': {} },
            type: "primary",
            disabled: (__VLS_ctx.taskDetail.status !== 'completed'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_233));
        let __VLS_236;
        let __VLS_237;
        let __VLS_238;
        const __VLS_239 = {
            onClick: (...[$event]) => {
                __VLS_ctx.handleViewReport(__VLS_ctx.taskDetail);
            }
        };
        __VLS_235.slots.default;
        var __VLS_235;
    }
    var __VLS_119;
    /** @type {__VLS_StyleScopedClasses['audit-tasks']} */ ;
    /** @type {__VLS_StyleScopedClasses['card-header']} */ ;
    /** @type {__VLS_StyleScopedClasses['filter-bar']} */ ;
    var __VLS_dollars;
    const __VLS_self = (await import('vue')).defineComponent({
        setup() {
            return {
                Refresh: Refresh,
                loading: loading,
                tasks: tasks,
                filterStatus: filterStatus,
                detailDialogVisible: detailDialogVisible,
                taskDetail: taskDetail,
                loadTasks: loadTasks,
                handleViewDetail: handleViewDetail,
                handleViewReport: handleViewReport,
                getStatusType: getStatusType,
                getStatusText: getStatusText,
                formatDuration: formatDuration,
            };
        },
    });
    return (await import('vue')).defineComponent({
        setup() {
            return {};
        },
    });
})(); /* PartiallyEnd: #4569/main.vue */
