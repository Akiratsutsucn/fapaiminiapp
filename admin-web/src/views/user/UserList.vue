<template>
  <div class="page">
    <h2 class="page-title">用户管理</h2>
    <t-card>
      <div class="search-bar">
        <t-input v-model="filters.keyword" placeholder="搜索昵称" clearable style="width:200px" @change="onSearch" />
        <t-select v-model="filters.role" placeholder="角色筛选" clearable style="width:150px" @change="onSearch">
          <t-option value="customer" label="客户" />
          <t-option value="agent" label="代理商" />
          <t-option value="admin" label="管理员" />
        </t-select>
        <t-button theme="primary" @click="loadData">查询</t-button>
        <t-button theme="primary" variant="outline" @click="onCreate">新增用户</t-button>
      </div>
      <t-table :data="list" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @page-change="onPageChange">
        <template #role="{ row }">
          <t-tag :theme="row.role === 'admin' ? 'primary' : row.role === 'agent' ? 'warning' : 'default'">
            {{ row.role === 'admin' ? '管理员' : row.role === 'agent' ? '代理商' : '客户' }}
          </t-tag>
        </template>
        <template #region="{ row }">
          <span v-if="row.role === 'agent'">{{ row.region || '--' }}</span>
          <span v-else style="color:#999">--</span>
        </template>
        <template #inviter_id="{ row }">
          <span v-if="row.role === 'customer' && row.inviter_id">{{ row.inviter_id }}</span>
          <span v-else style="color:#999">--</span>
        </template>
        <template #op="{ row }">
          <t-space>
            <t-button variant="text" size="small" @click="onEdit(row)">编辑</t-button>
            <t-popconfirm content="确定删除该用户？" @confirm="onDelete(row)">
              <t-button variant="text" size="small" theme="danger">删除</t-button>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <t-dialog v-model:visible="editVisible" header="编辑用户" width="500px" @confirm="onSaveEdit">
      <t-form :data="editForm" label-width="90px">
        <t-form-item label="昵称"><t-input v-model="editForm.nickname" /></t-form-item>
        <t-form-item label="手机号"><t-input v-model="editForm.phone" /></t-form-item>
        <t-form-item label="角色">
          <t-select v-model="editForm.role">
            <t-option value="customer" label="客户" />
            <t-option value="agent" label="代理商" />
            <t-option value="admin" label="管理员" />
          </t-select>
        </t-form-item>
        <t-form-item label="城市">
          <t-select v-model="editForm.city_id">
            <t-option value="310000" label="上海" />
            <t-option value="330200" label="宁波" />
          </t-select>
        </t-form-item>
        <t-form-item label="负责地区" v-if="editForm.role === 'agent'">
          <t-input v-model="editForm.region" placeholder="如：上海市长宁区" />
        </t-form-item>
        <t-form-item label="邀请人ID" v-if="editForm.role === 'customer'">
          <t-input-number v-model="editForm.inviter_id" placeholder="邀请该客户的代理商 ID" :min="0" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog v-model:visible="createVisible" header="新增用户" width="500px" @confirm="onSaveCreate">
      <t-form :data="createForm" label-width="90px">
        <t-form-item label="昵称"><t-input v-model="createForm.nickname" /></t-form-item>
        <t-form-item label="手机号"><t-input v-model="createForm.phone" /></t-form-item>
        <t-form-item label="角色">
          <t-select v-model="createForm.role">
            <t-option value="customer" label="客户" />
            <t-option value="agent" label="代理商" />
            <t-option value="admin" label="管理员" />
          </t-select>
        </t-form-item>
        <t-form-item label="负责地区" v-if="createForm.role === 'agent'">
          <t-input v-model="createForm.region" placeholder="如：上海市长宁区" />
        </t-form-item>
        <t-form-item label="邀请人ID" v-if="createForm.role === 'customer'">
          <t-input-number v-model="createForm.inviter_id" placeholder="邀请该客户的代理商 ID" :min="0" />
        </t-form-item>
        <t-form-item label="密码"><t-input v-model="createForm.password" type="password" placeholder="默认 123456" /></t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listUsers, createUser, updateUser, deleteUser } from '@/api/users'

const loading = ref(false)
const list = ref<any[]>([])
const filters = reactive({ keyword: '', role: '' })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

const columns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'nickname', title: '昵称', width: 120 },
  { colKey: 'phone', title: '手机号', width: 130 },
  { colKey: 'role', title: '角色', width: 100 },
  { colKey: 'region', title: '负责地区', width: 160 },
  { colKey: 'inviter_id', title: '邀请人ID', width: 100 },
  { colKey: 'created_at', title: '注册时间', width: 180 },
  { colKey: 'op', title: '操作', width: 140 },
]

const editVisible = ref(false)
const editForm = reactive({ id: 0, nickname: '', phone: '', role: 'customer', city_id: '310000', region: '', inviter_id: 0 as number | null })

const createVisible = ref(false)
const createForm = reactive({ nickname: '', phone: '', role: 'customer', password: '', region: '', inviter_id: 0 as number | null })

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: pagination.current, page_size: pagination.pageSize }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.role) params.role = filters.role
    const data = await listUsers(params)
    list.value = data.items
    pagination.total = data.total
  } finally { loading.value = false }
}

function onSearch() { pagination.current = 1; loadData() }
function onPageChange(p: any) { pagination.current = p.current; loadData() }

function onCreate() {
  createForm.nickname = ''; createForm.phone = ''; createForm.role = 'customer'; createForm.password = ''
  createForm.region = ''; createForm.inviter_id = null
  createVisible.value = true
}

async function onSaveCreate() {
  try {
    const body: any = { ...createForm }
    if (!body.region) delete body.region
    if (!body.inviter_id) delete body.inviter_id
    await createUser(body)
    MessagePlugin.success('创建成功')
    createVisible.value = false
    loadData()
  } catch { /* skip */ }
}

function onEdit(row: any) {
  Object.assign(editForm, {
    id: row.id, nickname: row.nickname || '', phone: row.phone || '', role: row.role,
    city_id: String(row.city_id || 310000),
    region: row.region || '',
    inviter_id: row.inviter_id || null,
  })
  editVisible.value = true
}

async function onSaveEdit() {
  try {
    const body: any = {
      nickname: editForm.nickname,
      phone: editForm.phone,
      role: editForm.role,
      city_id: parseInt(editForm.city_id) || 310000,
    }
    if (editForm.role === 'agent') body.region = editForm.region || ''
    if (editForm.role === 'customer') body.inviter_id = editForm.inviter_id || null
    await updateUser(editForm.id, body)
    MessagePlugin.success('更新成功')
    editVisible.value = false
    loadData()
  } catch { /* skip */ }
}

async function onDelete(row: any) {
  try {
    await deleteUser(row.id)
    MessagePlugin.success('删除成功')
    loadData()
  } catch { /* skip */ }
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; }
</style>
