<template>
  <div class="page">
    <h2 class="page-title">需求管理</h2>
    <t-card>
      <div class="search-bar">
        <t-input v-model="filters.phone" placeholder="搜索手机号" clearable style="width:180px" @change="onSearch" />
        <t-select v-model="filters.status" placeholder="处理状态" clearable style="width:140px" @change="onSearch">
          <t-option value="待处理" label="待处理" />
          <t-option value="已分配" label="已分配" />
          <t-option value="已完成" label="已完成" />
        </t-select>
        <t-select v-model="filters.source" placeholder="来源" clearable style="width:140px" @change="onSearch">
          <t-option value="demand-form" label="选房需求" />
          <t-option value="message" label="客服留言" />
        </t-select>
        <t-button theme="primary" @click="loadData">查询</t-button>
        <t-button theme="primary" variant="outline" @click="onCreate">新增需求</t-button>
      </div>
      <t-table :data="list" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @page-change="onPageChange">
        <template #source="{ row }">
          <t-tag :theme="row.source === 'message' ? 'warning' : 'primary'" variant="light">
            {{ row.source === 'message' ? '客服留言' : '选房需求' }}
          </t-tag>
        </template>
        <template #status="{ row }">
          <t-tag :theme="row.status === '待处理' ? 'warning' : row.status === '已分配' ? 'primary' : 'success'">{{ row.status }}</t-tag>
        </template>
        <template #remark="{ row }">
          <t-tooltip :content="row.remark" v-if="row.remark">
            <div style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ row.remark }}</div>
          </t-tooltip>
        </template>
        <template #op="{ row }">
          <t-space>
            <t-button variant="text" size="small" @click="onEdit(row)">处理</t-button>
            <t-popconfirm content="确定删除该需求？" @confirm="onDelete(row)">
              <t-button variant="text" size="small" theme="danger">删除</t-button>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <t-dialog v-model:visible="editVisible" header="编辑需求" width="500px" @confirm="onSaveEdit">
      <t-form :data="editForm" label-width="100px">
        <t-form-item label="分配业务员"><t-input v-model="editForm.agent_wechat" placeholder="业务员微信号" /></t-form-item>
        <t-form-item label="状态">
          <t-select v-model="editForm.status">
            <t-option value="待处理" label="待处理" /><t-option value="已分配" label="已分配" /><t-option value="已完成" label="已完成" />
          </t-select>
        </t-form-item>
        <t-form-item label="备注"><t-textarea v-model="editForm.remark" /></t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog v-model:visible="createVisible" header="新增需求" width="500px" @confirm="onSaveCreate">
      <t-form :data="createForm" label-width="100px">
        <t-form-item label="姓名"><t-input v-model="createForm.name" /></t-form-item>
        <t-form-item label="手机号"><t-input v-model="createForm.phone" /></t-form-item>
        <t-form-item label="城市"><t-input v-model="createForm.city" placeholder="默认上海" /></t-form-item>
        <t-form-item label="购房用途">
          <t-select v-model="createForm.purpose">
            <t-option value="自住" label="自住" />
            <t-option value="投资" label="投资" />
            <t-option value="自住+投资" label="自住+投资" />
          </t-select>
        </t-form-item>
        <t-form-item label="预算"><t-input v-model="createForm.budget" placeholder="如：300-500万" /></t-form-item>
        <t-form-item label="意向区域"><t-input v-model="createForm.target_district" placeholder="如：浦东新区" /></t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listDemands, createDemand, updateDemand, deleteDemand } from '@/api/demands'

const loading = ref(false)
const list = ref<any[]>([])
const filters = reactive({ phone: '', status: '', source: '' })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

const columns = [
  { colKey: 'id', title: 'ID', width: 70 },
  { colKey: 'source', title: '来源', width: 100 },
  { colKey: 'name', title: '姓名', width: 80 },
  { colKey: 'phone', title: '手机号', width: 130 },
  { colKey: 'city', title: '城市', width: 80 },
  { colKey: 'purpose', title: '用途', width: 70 },
  { colKey: 'budget', title: '预算', width: 100 },
  { colKey: 'target_district', title: '意向区域', width: 120 },
  { colKey: 'remark', title: '留言/备注', width: 220 },
  { colKey: 'agent_wechat', title: '业务员', width: 120 },
  { colKey: 'status', title: '状态', width: 80 },
  { colKey: 'created_at', title: '提交时间', width: 160 },
  { colKey: 'op', title: '操作', width: 140 },
]

const editVisible = ref(false)
const editForm = reactive({ id: 0, agent_wechat: '', status: '待处理', remark: '' })

const createVisible = ref(false)
const createForm = reactive({ name: '', phone: '', city: '上海', purpose: '自住', budget: '', target_district: '' })

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: pagination.current, page_size: pagination.pageSize }
    if (filters.phone) params.phone = filters.phone
    if (filters.status) params.status = filters.status
    if (filters.source) params.source = filters.source
    const data: any = await listDemands(params)
    list.value = data.items
    pagination.total = data.total
  } finally { loading.value = false }
}

function onSearch() { pagination.current = 1; loadData() }
function onPageChange(p: any) { pagination.current = p.current; loadData() }

function onEdit(row: any) {
  Object.assign(editForm, { id: row.id, agent_wechat: row.agent_wechat || '', status: row.status, remark: row.remark || '' })
  editVisible.value = true
}

async function onSaveEdit() {
  try {
    await updateDemand(editForm.id, { agent_wechat: editForm.agent_wechat, status: editForm.status, remark: editForm.remark })
    MessagePlugin.success('更新成功')
    editVisible.value = false
    loadData()
  } catch { /* skip */ }
}

function onCreate() {
  createForm.name = ''; createForm.phone = ''; createForm.city = '上海'; createForm.purpose = '自住'; createForm.budget = ''; createForm.target_district = ''
  createVisible.value = true
}

async function onSaveCreate() {
  try {
    await createDemand({ ...createForm })
    MessagePlugin.success('创建成功')
    createVisible.value = false
    loadData()
  } catch { /* skip */ }
}

async function onDelete(row: any) {
  try {
    await deleteDemand(row.id)
    MessagePlugin.success('删除成功')
    loadData()
  } catch { /* skip */ }
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; }
</style>
