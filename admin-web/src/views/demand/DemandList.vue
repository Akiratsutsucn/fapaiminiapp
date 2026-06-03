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
            <t-button variant="text" size="small" theme="primary" @click="onRecommend(row)">推荐房源</t-button>
            <t-popconfirm content="确定删除该需求？" @confirm="onDelete(row)">
              <t-button variant="text" size="small" theme="danger">删除</t-button>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <t-dialog v-model:visible="editVisible" header="处理需求" width="500px" @confirm="onSaveEdit">
      <t-form :data="editForm" label-width="100px">
        <t-form-item label="分配对接人">
          <t-select v-model="editForm.assigned_user_id" placeholder="选择业务员或代理商" clearable filterable>
            <t-option-group label="业务员（本公司）">
              <t-option v-for="u in salespersons" :key="u.id" :value="u.id" :label="`${u.name}（${u.phone || '无手机'}）`" />
            </t-option-group>
            <t-option-group label="代理商">
              <t-option v-for="u in agents" :key="u.id" :value="u.id" :label="`${u.name}（${u.region || u.phone || ''}）`" />
            </t-option-group>
          </t-select>
        </t-form-item>
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

    <t-dialog v-model:visible="recVisible" header="定向推荐房源" width="720px" :confirm-btn="{ content: '推荐给该用户', loading: recommending }" @confirm="onConfirmRecommend">
      <div class="rec-target" v-if="recTarget">推荐对象：{{ recTarget.name || '用户' }}（{{ recTarget.phone }}）· 意向 {{ recTarget.target_district || '不限' }} · 预算 {{ recTarget.budget || '不限' }}</div>
      <div class="rec-search">
        <t-input v-model="recKeyword" placeholder="搜索房源标题/小区关键词" clearable style="width:260px" @enter="loadRecProps" />
        <t-select v-model="recCity" placeholder="城市" style="width:120px" @change="loadRecProps">
          <t-option :value="0" label="全部" /><t-option :value="310000" label="上海" /><t-option :value="330200" label="宁波" /><t-option :value="330100" label="杭州" />
        </t-select>
        <t-button theme="primary" @click="loadRecProps">查询房源</t-button>
      </div>
      <div class="rec-hint">仅展示「即将开拍」「进行中」的可参拍房源，已结束/已成交房源不可推荐</div>
      <t-table :data="recProps" :columns="recCols" row-key="id" :loading="recLoading" max-height="320" size="small">
        <template #pick="{ row }">
          <t-radio :checked="recSelected && recSelected.id === row.id" @click="recSelected = row" />
        </template>
        <template #starting_price="{ row }">{{ row.starting_price ? (row.starting_price/10000).toFixed(0) + '万' : '-' }}</template>
        <template #auction_status="{ row }">
          <t-tag size="small" :theme="row.auction_status === '进行中' ? 'danger' : 'primary'" variant="light">{{ row.auction_status }}</t-tag>
        </template>
      </t-table>
      <div class="rec-selected" v-if="recSelected">已选：{{ recSelected.title }}</div>
      <t-textarea v-model="recMessage" placeholder="推荐语（选填），如：该房源临近地铁，起拍价低于评估价两成，符合您的预算" :autosize="{ minRows: 2, maxRows: 4 }" style="margin-top:12px" />
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listDemands, createDemand, updateDemand, deleteDemand, recommendProperty, listAssignableUsers } from '@/api/demands'
import { listProperties } from '@/api/properties'

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
  { colKey: 'assigned_name', title: '对接人', width: 120 },
  { colKey: 'status', title: '状态', width: 80 },
  { colKey: 'created_at', title: '提交时间', width: 160 },
  { colKey: 'op', title: '操作', width: 220 },
]

const editVisible = ref(false)
const editForm = reactive({ id: 0, assigned_user_id: undefined as number | undefined, status: '待处理', remark: '' })

// 可分配对接人
const assignableUsers = ref<any[]>([])
const salespersons = computed(() => assignableUsers.value.filter((u: any) => u.role === 'salesperson'))
const agents = computed(() => assignableUsers.value.filter((u: any) => u.role === 'agent'))

const createVisible = ref(false)
const createForm = reactive({ name: '', phone: '', city: '上海', purpose: '自住', budget: '', target_district: '' })

// 推荐房源
const recVisible = ref(false)
const recommending = ref(false)
const recLoading = ref(false)
const recTarget = ref<any>(null)
const recKeyword = ref('')
const recCity = ref(0)
const recProps = ref<any[]>([])
const recSelected = ref<any>(null)
const recMessage = ref('')
const recCols = [
  { colKey: 'pick', title: '', width: 50 },
  { colKey: 'title', title: '房源标题', ellipsis: true },
  { colKey: 'district', title: '区域', width: 90 },
  { colKey: 'area', title: '面积㎡', width: 80 },
  { colKey: 'starting_price', title: '起拍价', width: 90 },
  { colKey: 'auction_status', title: '状态', width: 90 },
]

onMounted(() => {
  loadData()
  loadAssignableUsers()
})

async function loadAssignableUsers() {
  try {
    assignableUsers.value = await listAssignableUsers() || []
  } catch { assignableUsers.value = [] }
}

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
  Object.assign(editForm, {
    id: row.id,
    assigned_user_id: row.assigned_user_id || undefined,
    status: row.status,
    remark: row.remark || '',
  })
  editVisible.value = true
}

async function onSaveEdit() {
  try {
    const payload: any = { status: editForm.status, remark: editForm.remark }
    if (editForm.assigned_user_id) {
      const u = assignableUsers.value.find((x: any) => x.id === editForm.assigned_user_id)
      payload.assigned_user_id = editForm.assigned_user_id
      payload.assigned_role = u?.role || ''
      payload.assigned_name = u ? `${u.name}（${u.role_label}）` : ''
    } else {
      payload.assigned_user_id = null
      payload.assigned_name = ''
      payload.assigned_role = ''
    }
    await updateDemand(editForm.id, payload)
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

function onRecommend(row: any) {
  if (!row.user_id) {
    MessagePlugin.warning('该需求未关联小程序用户，无法定向推荐')
    return
  }
  recTarget.value = row
  recSelected.value = null
  recMessage.value = ''
  recKeyword.value = row.target_district || ''
  recCity.value = row.city === '宁波' ? 330200 : row.city === '杭州' ? 330100 : 310000
  recVisible.value = true
  loadRecProps()
}

async function loadRecProps() {
  recLoading.value = true
  try {
    const params: any = { page: 1, page_size: 100 }
    if (recKeyword.value) params.keyword = recKeyword.value
    if (recCity.value) params.city_id = recCity.value
    const data: any = await listProperties(params)
    // 只允许推荐「即将开拍」或「进行中」的房源，过滤掉已结束/已成交/已撤回等
    const RECOMMENDABLE = ['即将开拍', '进行中']
    recProps.value = (data.items || []).filter((p: any) => RECOMMENDABLE.includes(p.auction_status)).slice(0, 30)
    if (recSelected.value && !recProps.value.some((p: any) => p.id === recSelected.value.id)) {
      recSelected.value = null
    }
  } catch { recProps.value = [] }
  finally { recLoading.value = false }
}

async function onConfirmRecommend() {
  if (!recSelected.value) {
    MessagePlugin.warning('请先选择一套房源')
    return
  }
  recommending.value = true
  try {
    const res: any = await recommendProperty({
      user_id: recTarget.value.user_id,
      property_id: recSelected.value.id,
      message: recMessage.value || undefined,
      demand_id: recTarget.value.id,
    })
    MessagePlugin.success(res.message || '推荐成功')
    recVisible.value = false
  } catch (e: any) {
    MessagePlugin.error(e?.response?.data?.detail || '推荐失败')
  } finally { recommending.value = false }
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.rec-target { background: #f3f6fb; padding: 10px 14px; border-radius: 6px; font-size: 13px; color: #44557a; margin-bottom: 14px; }
.rec-search { display: flex; gap: 12px; margin-bottom: 14px; }
.rec-hint { font-size: 12px; color: #8a94a6; margin-bottom: 10px; }
.rec-selected { margin-top: 12px; font-size: 13px; color: #1a2f52; font-weight: 600; }
</style>
