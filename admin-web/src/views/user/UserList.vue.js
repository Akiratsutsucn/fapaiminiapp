/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { listUsers, createUser, updateUser, deleteUser, updateUserRole } from '@/api/users';
const loading = ref(false);
const list = ref([]);
const filters = reactive({ keyword: '', role: '' });
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
function roleLabel(r) {
    const labels = {
        admin: '最高管理员',
        leader: '领导',
        content_manager: '内容管理员',
        agent: '代理商',
        salesperson: '业务员',
        customer: '客户'
    };
    return labels[r] || '客户';
}
function roleTheme(r) {
    if (r === 'admin')
        return 'primary';
    if (r === 'leader')
        return 'warning';
    if (r === 'content_manager')
        return 'success';
    if (r === 'agent')
        return 'warning';
    if (r === 'salesperson')
        return 'success';
    return 'default';
}
const columns = [
    { colKey: 'id', title: 'ID', width: 80 },
    { colKey: 'nickname', title: '昵称', width: 120 },
    { colKey: 'phone', title: '手机号', width: 130 },
    { colKey: 'role', title: '角色', width: 180 },
    { colKey: 'region', title: '负责地区', width: 160 },
    { colKey: 'inviter_id', title: '邀请人ID', width: 100 },
    { colKey: 'created_at', title: '注册时间', width: 180 },
    { colKey: 'op', title: '操作', width: 140 },
];
const editVisible = ref(false);
const editForm = reactive({ id: 0, nickname: '', phone: '', role: 'customer', city_id: '310000', region: '', inviter_id: 0 });
const createVisible = ref(false);
const createForm = reactive({ nickname: '', phone: '', role: 'customer', password: '', region: '', inviter_id: 0 });
const roleChangeVisible = ref(false);
const roleChangeForm = reactive({ userId: 0, nickname: '', currentRole: '', newRole: '' });
onMounted(() => loadData());
async function loadData() {
    loading.value = true;
    try {
        const params = { page: pagination.current, page_size: pagination.pageSize };
        if (filters.keyword)
            params.keyword = filters.keyword;
        if (filters.role)
            params.role = filters.role;
        const data = await listUsers(params);
        list.value = data.items;
        pagination.total = data.total;
    }
    finally {
        loading.value = false;
    }
}
function onSearch() { pagination.current = 1; loadData(); }
function onPageChange(p) { pagination.current = p.current; loadData(); }
function onCreate() {
    createForm.nickname = '';
    createForm.phone = '';
    createForm.role = 'customer';
    createForm.password = '';
    createForm.region = '';
    createForm.inviter_id = null;
    createVisible.value = true;
}
async function onSaveCreate() {
    try {
        const body = { ...createForm };
        if (!body.region)
            delete body.region;
        if (!body.inviter_id)
            delete body.inviter_id;
        if (!body.password)
            delete body.password;
        await createUser(body);
        MessagePlugin.success('创建成功');
        createVisible.value = false;
        loadData();
    }
    catch { /* skip */ }
}
function onEdit(row) {
    Object.assign(editForm, {
        id: row.id, nickname: row.nickname || '', phone: row.phone || '', role: row.role,
        city_id: String(row.city_id || 310000),
        region: row.region || '',
        inviter_id: row.inviter_id || null,
    });
    editVisible.value = true;
}
async function onSaveEdit() {
    try {
        const body = {
            nickname: editForm.nickname,
            phone: editForm.phone,
            role: editForm.role,
            city_id: parseInt(editForm.city_id) || 310000,
        };
        if (editForm.role === 'agent' || editForm.role === 'salesperson')
            body.region = editForm.region || '';
        if (editForm.role === 'customer')
            body.inviter_id = editForm.inviter_id || null;
        await updateUser(editForm.id, body);
        MessagePlugin.success('更新成功');
        editVisible.value = false;
        loadData();
    }
    catch { /* skip */ }
}
function onChangeRole(row) {
    roleChangeForm.userId = row.id;
    roleChangeForm.nickname = row.nickname;
    roleChangeForm.currentRole = row.role;
    roleChangeForm.newRole = row.role;
    roleChangeVisible.value = true;
}
async function onSaveRoleChange() {
    if (roleChangeForm.newRole === roleChangeForm.currentRole) {
        MessagePlugin.warning('新角色与当前角色相同');
        return;
    }
    try {
        await updateUserRole(roleChangeForm.userId, roleChangeForm.newRole);
        MessagePlugin.success('角色修改成功');
        roleChangeVisible.value = false;
        loadData();
    }
    catch { /* skip */ }
}
async function onDelete(row) {
    try {
        await deleteUser(row.id);
        MessagePlugin.success('删除成功');
        loadData();
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
    placeholder: "搜索昵称",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_6 = __VLS_5({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.keyword),
    placeholder: "搜索昵称",
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
const __VLS_12 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.role),
    placeholder: "角色筛选",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_14 = __VLS_13({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.filters.role),
    placeholder: "角色筛选",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onChange: (__VLS_ctx.onSearch)
};
__VLS_15.slots.default;
const __VLS_20 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    value: "customer",
    label: "客户",
}));
const __VLS_22 = __VLS_21({
    value: "customer",
    label: "客户",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_24 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    value: "salesperson",
    label: "业务员",
}));
const __VLS_26 = __VLS_25({
    value: "salesperson",
    label: "业务员",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
const __VLS_28 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    value: "agent",
    label: "代理商",
}));
const __VLS_30 = __VLS_29({
    value: "agent",
    label: "代理商",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
const __VLS_32 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    value: "content_manager",
    label: "内容管理员",
}));
const __VLS_34 = __VLS_33({
    value: "content_manager",
    label: "内容管理员",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
const __VLS_36 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    value: "leader",
    label: "领导",
}));
const __VLS_38 = __VLS_37({
    value: "leader",
    label: "领导",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
const __VLS_40 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    value: "admin",
    label: "最高管理员",
}));
const __VLS_42 = __VLS_41({
    value: "admin",
    label: "最高管理员",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
var __VLS_15;
const __VLS_44 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onClick': {} },
    theme: "primary",
}));
const __VLS_46 = __VLS_45({
    ...{ 'onClick': {} },
    theme: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_48;
let __VLS_49;
let __VLS_50;
const __VLS_51 = {
    onClick: (__VLS_ctx.loadData)
};
__VLS_47.slots.default;
var __VLS_47;
const __VLS_52 = {}.TButton;
/** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ 'onClick': {} },
    theme: "primary",
    variant: "outline",
}));
const __VLS_54 = __VLS_53({
    ...{ 'onClick': {} },
    theme: "primary",
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_56;
let __VLS_57;
let __VLS_58;
const __VLS_59 = {
    onClick: (__VLS_ctx.onCreate)
};
__VLS_55.slots.default;
var __VLS_55;
const __VLS_60 = {}.TTable;
/** @type {[typeof __VLS_components.TTable, typeof __VLS_components.tTable, typeof __VLS_components.TTable, typeof __VLS_components.tTable, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.columns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
    pagination: (__VLS_ctx.pagination),
}));
const __VLS_62 = __VLS_61({
    ...{ 'onPageChange': {} },
    data: (__VLS_ctx.list),
    columns: (__VLS_ctx.columns),
    loading: (__VLS_ctx.loading),
    rowKey: "id",
    pagination: (__VLS_ctx.pagination),
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
let __VLS_64;
let __VLS_65;
let __VLS_66;
const __VLS_67 = {
    onPageChange: (__VLS_ctx.onPageChange)
};
__VLS_63.slots.default;
{
    const { role: __VLS_thisSlot } = __VLS_63.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_68 = {}.TTag;
    /** @type {[typeof __VLS_components.TTag, typeof __VLS_components.tTag, typeof __VLS_components.TTag, typeof __VLS_components.tTag, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        theme: (__VLS_ctx.roleTheme(row.role)),
    }));
    const __VLS_70 = __VLS_69({
        theme: (__VLS_ctx.roleTheme(row.role)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
    (__VLS_ctx.roleLabel(row.role));
    var __VLS_71;
    if (row.role !== 'admin') {
        const __VLS_72 = {}.TButton;
        /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
            ...{ style: {} },
        }));
        const __VLS_74 = __VLS_73({
            ...{ 'onClick': {} },
            variant: "text",
            size: "small",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_73));
        let __VLS_76;
        let __VLS_77;
        let __VLS_78;
        const __VLS_79 = {
            onClick: (...[$event]) => {
                if (!(row.role !== 'admin'))
                    return;
                __VLS_ctx.onChangeRole(row);
            }
        };
        __VLS_75.slots.default;
        {
            const { icon: __VLS_thisSlot } = __VLS_75.slots;
            const __VLS_80 = {}.TIcon;
            /** @type {[typeof __VLS_components.TIcon, typeof __VLS_components.tIcon, ]} */ ;
            // @ts-ignore
            const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
                name: "edit",
            }));
            const __VLS_82 = __VLS_81({
                name: "edit",
            }, ...__VLS_functionalComponentArgsRest(__VLS_81));
        }
        var __VLS_75;
    }
}
{
    const { region: __VLS_thisSlot } = __VLS_63.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    if (row.role === 'agent' || row.role === 'salesperson') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (row.region || '--');
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
    }
}
{
    const { inviter_id: __VLS_thisSlot } = __VLS_63.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    if (row.role === 'customer' && row.inviter_id) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (row.inviter_id);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
    }
}
{
    const { op: __VLS_thisSlot } = __VLS_63.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_84 = {}.TSpace;
    /** @type {[typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, typeof __VLS_components.TSpace, typeof __VLS_components.tSpace, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({}));
    const __VLS_86 = __VLS_85({}, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    const __VLS_88 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
    }));
    const __VLS_90 = __VLS_89({
        ...{ 'onClick': {} },
        variant: "text",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    let __VLS_92;
    let __VLS_93;
    let __VLS_94;
    const __VLS_95 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onEdit(row);
        }
    };
    __VLS_91.slots.default;
    var __VLS_91;
    const __VLS_96 = {}.TPopconfirm;
    /** @type {[typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, typeof __VLS_components.TPopconfirm, typeof __VLS_components.tPopconfirm, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ 'onConfirm': {} },
        content: "确定删除该用户？",
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onConfirm': {} },
        content: "确定删除该用户？",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_100;
    let __VLS_101;
    let __VLS_102;
    const __VLS_103 = {
        onConfirm: (...[$event]) => {
            __VLS_ctx.onDelete(row);
        }
    };
    __VLS_99.slots.default;
    const __VLS_104 = {}.TButton;
    /** @type {[typeof __VLS_components.TButton, typeof __VLS_components.tButton, typeof __VLS_components.TButton, typeof __VLS_components.tButton, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        variant: "text",
        size: "small",
        theme: "danger",
    }));
    const __VLS_106 = __VLS_105({
        variant: "text",
        size: "small",
        theme: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_107.slots.default;
    var __VLS_107;
    var __VLS_99;
    var __VLS_87;
}
var __VLS_63;
var __VLS_3;
const __VLS_108 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.editVisible),
    header: "编辑用户",
    width: "500px",
}));
const __VLS_110 = __VLS_109({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.editVisible),
    header: "编辑用户",
    width: "500px",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
let __VLS_112;
let __VLS_113;
let __VLS_114;
const __VLS_115 = {
    onConfirm: (__VLS_ctx.onSaveEdit)
};
__VLS_111.slots.default;
const __VLS_116 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    data: (__VLS_ctx.editForm),
    labelWidth: "90px",
}));
const __VLS_118 = __VLS_117({
    data: (__VLS_ctx.editForm),
    labelWidth: "90px",
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
__VLS_119.slots.default;
const __VLS_120 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    label: "昵称",
}));
const __VLS_122 = __VLS_121({
    label: "昵称",
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
const __VLS_124 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    modelValue: (__VLS_ctx.editForm.nickname),
}));
const __VLS_126 = __VLS_125({
    modelValue: (__VLS_ctx.editForm.nickname),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
var __VLS_123;
const __VLS_128 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    label: "手机号",
}));
const __VLS_130 = __VLS_129({
    label: "手机号",
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
const __VLS_132 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    modelValue: (__VLS_ctx.editForm.phone),
}));
const __VLS_134 = __VLS_133({
    modelValue: (__VLS_ctx.editForm.phone),
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
var __VLS_131;
const __VLS_136 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    label: "角色",
}));
const __VLS_138 = __VLS_137({
    label: "角色",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
const __VLS_140 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    modelValue: (__VLS_ctx.editForm.role),
}));
const __VLS_142 = __VLS_141({
    modelValue: (__VLS_ctx.editForm.role),
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
__VLS_143.slots.default;
const __VLS_144 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    value: "customer",
    label: "客户",
}));
const __VLS_146 = __VLS_145({
    value: "customer",
    label: "客户",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
const __VLS_148 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    value: "salesperson",
    label: "业务员",
}));
const __VLS_150 = __VLS_149({
    value: "salesperson",
    label: "业务员",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
const __VLS_152 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    value: "agent",
    label: "代理商",
}));
const __VLS_154 = __VLS_153({
    value: "agent",
    label: "代理商",
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
const __VLS_156 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    value: "admin",
    label: "管理员",
}));
const __VLS_158 = __VLS_157({
    value: "admin",
    label: "管理员",
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
var __VLS_143;
var __VLS_139;
const __VLS_160 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    label: "城市",
}));
const __VLS_162 = __VLS_161({
    label: "城市",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
__VLS_163.slots.default;
const __VLS_164 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    modelValue: (__VLS_ctx.editForm.city_id),
}));
const __VLS_166 = __VLS_165({
    modelValue: (__VLS_ctx.editForm.city_id),
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
__VLS_167.slots.default;
const __VLS_168 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    value: "310000",
    label: "上海",
}));
const __VLS_170 = __VLS_169({
    value: "310000",
    label: "上海",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
const __VLS_172 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    value: "330200",
    label: "宁波",
}));
const __VLS_174 = __VLS_173({
    value: "330200",
    label: "宁波",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
const __VLS_176 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    value: "330100",
    label: "杭州",
}));
const __VLS_178 = __VLS_177({
    value: "330100",
    label: "杭州",
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
var __VLS_167;
var __VLS_163;
if (__VLS_ctx.editForm.role === 'agent' || __VLS_ctx.editForm.role === 'salesperson') {
    const __VLS_180 = {}.TFormItem;
    /** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        label: "负责地区",
    }));
    const __VLS_182 = __VLS_181({
        label: "负责地区",
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    __VLS_183.slots.default;
    const __VLS_184 = {}.TInput;
    /** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
    // @ts-ignore
    const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
        modelValue: (__VLS_ctx.editForm.region),
        placeholder: "如：上海市长宁区",
    }));
    const __VLS_186 = __VLS_185({
        modelValue: (__VLS_ctx.editForm.region),
        placeholder: "如：上海市长宁区",
    }, ...__VLS_functionalComponentArgsRest(__VLS_185));
    var __VLS_183;
}
if (__VLS_ctx.editForm.role === 'customer') {
    const __VLS_188 = {}.TFormItem;
    /** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
        label: "邀请人ID",
    }));
    const __VLS_190 = __VLS_189({
        label: "邀请人ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_189));
    __VLS_191.slots.default;
    const __VLS_192 = {}.TInputNumber;
    /** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
        modelValue: (__VLS_ctx.editForm.inviter_id),
        placeholder: "邀请该客户的代理商 ID",
        min: (0),
    }));
    const __VLS_194 = __VLS_193({
        modelValue: (__VLS_ctx.editForm.inviter_id),
        placeholder: "邀请该客户的代理商 ID",
        min: (0),
    }, ...__VLS_functionalComponentArgsRest(__VLS_193));
    var __VLS_191;
}
var __VLS_119;
var __VLS_111;
const __VLS_196 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.createVisible),
    header: "新增用户",
    width: "500px",
}));
const __VLS_198 = __VLS_197({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.createVisible),
    header: "新增用户",
    width: "500px",
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
let __VLS_200;
let __VLS_201;
let __VLS_202;
const __VLS_203 = {
    onConfirm: (__VLS_ctx.onSaveCreate)
};
__VLS_199.slots.default;
const __VLS_204 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    data: (__VLS_ctx.createForm),
    labelWidth: "90px",
}));
const __VLS_206 = __VLS_205({
    data: (__VLS_ctx.createForm),
    labelWidth: "90px",
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
__VLS_207.slots.default;
const __VLS_208 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    label: "昵称",
}));
const __VLS_210 = __VLS_209({
    label: "昵称",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
__VLS_211.slots.default;
const __VLS_212 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    modelValue: (__VLS_ctx.createForm.nickname),
}));
const __VLS_214 = __VLS_213({
    modelValue: (__VLS_ctx.createForm.nickname),
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
var __VLS_211;
const __VLS_216 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    label: "手机号",
}));
const __VLS_218 = __VLS_217({
    label: "手机号",
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
__VLS_219.slots.default;
const __VLS_220 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    modelValue: (__VLS_ctx.createForm.phone),
}));
const __VLS_222 = __VLS_221({
    modelValue: (__VLS_ctx.createForm.phone),
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
var __VLS_219;
const __VLS_224 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    label: "角色",
}));
const __VLS_226 = __VLS_225({
    label: "角色",
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
__VLS_227.slots.default;
const __VLS_228 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    modelValue: (__VLS_ctx.createForm.role),
}));
const __VLS_230 = __VLS_229({
    modelValue: (__VLS_ctx.createForm.role),
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
__VLS_231.slots.default;
const __VLS_232 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    value: "customer",
    label: "客户",
}));
const __VLS_234 = __VLS_233({
    value: "customer",
    label: "客户",
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
const __VLS_236 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    value: "salesperson",
    label: "业务员",
}));
const __VLS_238 = __VLS_237({
    value: "salesperson",
    label: "业务员",
}, ...__VLS_functionalComponentArgsRest(__VLS_237));
const __VLS_240 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
    value: "agent",
    label: "代理商",
}));
const __VLS_242 = __VLS_241({
    value: "agent",
    label: "代理商",
}, ...__VLS_functionalComponentArgsRest(__VLS_241));
const __VLS_244 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
    value: "content_manager",
    label: "内容管理员",
}));
const __VLS_246 = __VLS_245({
    value: "content_manager",
    label: "内容管理员",
}, ...__VLS_functionalComponentArgsRest(__VLS_245));
const __VLS_248 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
    value: "leader",
    label: "领导",
}));
const __VLS_250 = __VLS_249({
    value: "leader",
    label: "领导",
}, ...__VLS_functionalComponentArgsRest(__VLS_249));
const __VLS_252 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
    value: "admin",
    label: "最高管理员",
}));
const __VLS_254 = __VLS_253({
    value: "admin",
    label: "最高管理员",
}, ...__VLS_functionalComponentArgsRest(__VLS_253));
var __VLS_231;
var __VLS_227;
if (__VLS_ctx.createForm.role === 'agent' || __VLS_ctx.createForm.role === 'salesperson') {
    const __VLS_256 = {}.TFormItem;
    /** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
        label: "负责地区",
    }));
    const __VLS_258 = __VLS_257({
        label: "负责地区",
    }, ...__VLS_functionalComponentArgsRest(__VLS_257));
    __VLS_259.slots.default;
    const __VLS_260 = {}.TInput;
    /** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
    // @ts-ignore
    const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
        modelValue: (__VLS_ctx.createForm.region),
        placeholder: "如：上海市长宁区",
    }));
    const __VLS_262 = __VLS_261({
        modelValue: (__VLS_ctx.createForm.region),
        placeholder: "如：上海市长宁区",
    }, ...__VLS_functionalComponentArgsRest(__VLS_261));
    var __VLS_259;
}
if (__VLS_ctx.createForm.role === 'customer') {
    const __VLS_264 = {}.TFormItem;
    /** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
        label: "邀请人ID",
    }));
    const __VLS_266 = __VLS_265({
        label: "邀请人ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_265));
    __VLS_267.slots.default;
    const __VLS_268 = {}.TInputNumber;
    /** @type {[typeof __VLS_components.TInputNumber, typeof __VLS_components.tInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
        modelValue: (__VLS_ctx.createForm.inviter_id),
        placeholder: "邀请该客户的代理商 ID",
        min: (0),
    }));
    const __VLS_270 = __VLS_269({
        modelValue: (__VLS_ctx.createForm.inviter_id),
        placeholder: "邀请该客户的代理商 ID",
        min: (0),
    }, ...__VLS_functionalComponentArgsRest(__VLS_269));
    var __VLS_267;
}
const __VLS_272 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
    label: "初始密码",
}));
const __VLS_274 = __VLS_273({
    label: "初始密码",
}, ...__VLS_functionalComponentArgsRest(__VLS_273));
__VLS_275.slots.default;
const __VLS_276 = {}.TInput;
/** @type {[typeof __VLS_components.TInput, typeof __VLS_components.tInput, ]} */ ;
// @ts-ignore
const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
    modelValue: (__VLS_ctx.createForm.password),
    type: "password",
    placeholder: "留空则默认 123456",
}));
const __VLS_278 = __VLS_277({
    modelValue: (__VLS_ctx.createForm.password),
    type: "password",
    placeholder: "留空则默认 123456",
}, ...__VLS_functionalComponentArgsRest(__VLS_277));
var __VLS_275;
var __VLS_207;
var __VLS_199;
const __VLS_280 = {}.TDialog;
/** @type {[typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, typeof __VLS_components.TDialog, typeof __VLS_components.tDialog, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.roleChangeVisible),
    header: "修改角色",
    width: "400px",
}));
const __VLS_282 = __VLS_281({
    ...{ 'onConfirm': {} },
    visible: (__VLS_ctx.roleChangeVisible),
    header: "修改角色",
    width: "400px",
}, ...__VLS_functionalComponentArgsRest(__VLS_281));
let __VLS_284;
let __VLS_285;
let __VLS_286;
const __VLS_287 = {
    onConfirm: (__VLS_ctx.onSaveRoleChange)
};
__VLS_283.slots.default;
const __VLS_288 = {}.TForm;
/** @type {[typeof __VLS_components.TForm, typeof __VLS_components.tForm, typeof __VLS_components.TForm, typeof __VLS_components.tForm, ]} */ ;
// @ts-ignore
const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
    labelWidth: "80px",
}));
const __VLS_290 = __VLS_289({
    labelWidth: "80px",
}, ...__VLS_functionalComponentArgsRest(__VLS_289));
__VLS_291.slots.default;
const __VLS_292 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
    label: "当前用户",
}));
const __VLS_294 = __VLS_293({
    label: "当前用户",
}, ...__VLS_functionalComponentArgsRest(__VLS_293));
__VLS_295.slots.default;
(__VLS_ctx.roleChangeForm.nickname);
var __VLS_295;
const __VLS_296 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
    label: "当前角色",
}));
const __VLS_298 = __VLS_297({
    label: "当前角色",
}, ...__VLS_functionalComponentArgsRest(__VLS_297));
__VLS_299.slots.default;
(__VLS_ctx.roleLabel(__VLS_ctx.roleChangeForm.currentRole));
var __VLS_299;
const __VLS_300 = {}.TFormItem;
/** @type {[typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, typeof __VLS_components.TFormItem, typeof __VLS_components.tFormItem, ]} */ ;
// @ts-ignore
const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
    label: "新角色",
}));
const __VLS_302 = __VLS_301({
    label: "新角色",
}, ...__VLS_functionalComponentArgsRest(__VLS_301));
__VLS_303.slots.default;
const __VLS_304 = {}.TSelect;
/** @type {[typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, typeof __VLS_components.TSelect, typeof __VLS_components.tSelect, ]} */ ;
// @ts-ignore
const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
    modelValue: (__VLS_ctx.roleChangeForm.newRole),
}));
const __VLS_306 = __VLS_305({
    modelValue: (__VLS_ctx.roleChangeForm.newRole),
}, ...__VLS_functionalComponentArgsRest(__VLS_305));
__VLS_307.slots.default;
const __VLS_308 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
    value: "customer",
    label: "客户",
}));
const __VLS_310 = __VLS_309({
    value: "customer",
    label: "客户",
}, ...__VLS_functionalComponentArgsRest(__VLS_309));
const __VLS_312 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
    value: "salesperson",
    label: "业务员",
}));
const __VLS_314 = __VLS_313({
    value: "salesperson",
    label: "业务员",
}, ...__VLS_functionalComponentArgsRest(__VLS_313));
const __VLS_316 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
    value: "agent",
    label: "代理商",
}));
const __VLS_318 = __VLS_317({
    value: "agent",
    label: "代理商",
}, ...__VLS_functionalComponentArgsRest(__VLS_317));
const __VLS_320 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
    value: "content_manager",
    label: "内容管理员",
}));
const __VLS_322 = __VLS_321({
    value: "content_manager",
    label: "内容管理员",
}, ...__VLS_functionalComponentArgsRest(__VLS_321));
const __VLS_324 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
    value: "leader",
    label: "领导",
}));
const __VLS_326 = __VLS_325({
    value: "leader",
    label: "领导",
}, ...__VLS_functionalComponentArgsRest(__VLS_325));
const __VLS_328 = {}.TOption;
/** @type {[typeof __VLS_components.TOption, typeof __VLS_components.tOption, ]} */ ;
// @ts-ignore
const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
    value: "admin",
    label: "最高管理员",
}));
const __VLS_330 = __VLS_329({
    value: "admin",
    label: "最高管理员",
}, ...__VLS_functionalComponentArgsRest(__VLS_329));
var __VLS_307;
var __VLS_303;
var __VLS_291;
var __VLS_283;
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['search-bar']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            list: list,
            filters: filters,
            pagination: pagination,
            roleLabel: roleLabel,
            roleTheme: roleTheme,
            columns: columns,
            editVisible: editVisible,
            editForm: editForm,
            createVisible: createVisible,
            createForm: createForm,
            roleChangeVisible: roleChangeVisible,
            roleChangeForm: roleChangeForm,
            loadData: loadData,
            onSearch: onSearch,
            onPageChange: onPageChange,
            onCreate: onCreate,
            onSaveCreate: onSaveCreate,
            onEdit: onEdit,
            onSaveEdit: onSaveEdit,
            onChangeRole: onChangeRole,
            onSaveRoleChange: onSaveRoleChange,
            onDelete: onDelete,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
