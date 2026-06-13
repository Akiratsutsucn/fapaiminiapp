<template>
  <div class="page">
    <h2 class="page-title">小区数据管理</h2>
    <t-card>
      <div class="search-bar">
        <t-input v-model="filters.keyword" placeholder="搜索小区名称" clearable style="width:220px" @change="onSearch" />
        <t-select v-model="filters.city_id" placeholder="城市" clearable style="width:120px" @change="onSearch">
          <t-option :value="310000" label="上海" />
          <t-option :value="330200" label="宁波" />
          <t-option :value="330100" label="杭州" />
        </t-select>
        <t-button theme="primary" @click="onSearch">查询</t-button>
        <t-button v-if="!auth.isReadonly" variant="outline" @click="onAdd">添加小区</t-button>
        <t-button v-if="!auth.isReadonly" variant="outline" @click="onBatchImport">批量导入</t-button>
      </div>
      <t-table
        :data="list" :columns="columns" :loading="loading"
        row-key="id" @page-change="onPageChange"
      >
        <template #avg_price="{ row }">
          <span v-if="row.avg_price">{{ (row.avg_price / 10000).toFixed(2) }}万/㎡</span>
          <span v-else class="no-data">暂无</span>
        </template>
        <template #price_update_at="{ row }">
          {{ row.price_update_at || '--' }}
        </template>
        <template #op="{ row }">
          <t-space>
            <t-button v-if="!auth.isReadonly" variant="text" size="small" @click="onEdit(row)">编辑</t-button>
            <t-popconfirm v-if="!auth.isReadonly" content="确定删除？" @confirm="onDelete(row.id)">
              <t-button variant="text" size="small" theme="danger">删除</t-button>
            </t-popconfirm>
            <span v-if="auth.isReadonly" style="color:#999">只读</span>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <!-- Edit / Create Dialog -->
    <t-dialog
      v-model:visible="formVisible"
      :header="isEdit ? '编辑小区' : '添加小区'"
      width="620px"
      @confirm="onSave"
    >
      <t-form :data="formData" label-width="100px">
        <t-form-item label="小区名称"><t-input v-model="formData.name" /></t-form-item>
        <t-form-item label="区域"><t-input v-model="formData.district" placeholder="如：浦东新区" /></t-form-item>
        <t-form-item label="板块"><t-input v-model="formData.sub_district" placeholder="如：陆家嘴" /></t-form-item>
        <t-form-item label="城市">
          <t-select v-model="formData.city_id">
            <t-option :value="310000" label="上海" />
            <t-option :value="330200" label="宁波" />
          </t-select>
        </t-form-item>
        <t-form-item label="均价（元/㎡）"><t-input-number v-model="formData.avg_price" :min="0" placeholder="如：85000" /></t-form-item>
        <t-form-item label="建成年份"><t-input-number v-model="formData.build_year_start" :min="1980" :max="2030" placeholder="起" style="width:45%" /> <span style="margin:0 8px">—</span> <t-input-number v-model="formData.build_year_end" :min="1980" :max="2030" placeholder="止" style="width:45%" /></t-form-item>
        <t-form-item label="物业类型"><t-input v-model="formData.property_type" placeholder="住宅/商业/工业" /></t-form-item>
        <t-form-item label="总栋数"><t-input-number v-model="formData.total_buildings" :min="0" /></t-form-item>
        <t-form-item label="总户数"><t-input-number v-model="formData.total_units" :min="0" /></t-form-item>
        <t-form-item label="开发商"><t-input v-model="formData.developer" /></t-form-item>
        <t-form-item label="数据来源"><t-input v-model="formData.source" placeholder="manual/beike/anjuke" /></t-form-item>
        <t-form-item label="备注"><t-textarea v-model="formData.remark" /></t-form-item>
      </t-form>
    </t-dialog>

    <!-- Batch Import Dialog -->
    <t-dialog
      v-model:visible="importVisible"
      header="批量导入小区"
      width="560px"
      @confirm="onImportSubmit"
    >
      <t-form label-width="80px">
        <t-form-item label="导入格式">
          <div style="font-size:12px;color:#999;line-height:1.8">
            每行一个小区，JSON 格式：<br/>
            {"name":"小区名","district":"浦东新区","avg_price":85000,"city_id":310000}<br/>
            必填：name；选填：district, avg_price, sub_district, city_id, lat, lng
          </div>
        </t-form-item>
        <t-form-item label="数据">
          <t-textarea v-model="importText" :autosize="{ minRows: 8, maxRows: 16 }" placeholder='{"name":"万科城市花园","avg_price":65000}' />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listCommunities, createCommunity, updateCommunity, deleteCommunity, batchImportCommunities } from '@/api/communities'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const list = ref<any[]>([])
const filters = reactive({ keyword: '', city_id: null as number | null })

const columns = [
  { colKey: 'id', title: 'ID', width: 60 },
  { colKey: 'name', title: '小区名称', ellipsis: true, width: 180 },
  { colKey: 'district', title: '区域', width: 100 },
  { colKey: 'sub_district', title: '板块', width: 90 },
  { colKey: 'avg_price', title: '参考均价', width: 120 },
  { colKey: 'price_update_at', title: '价格更新', width: 110 },
  { colKey: 'source', title: '来源', width: 80 },
  { colKey: 'op', title: '操作', width: 130 },
]

const formVisible = ref(false)
const isEdit = ref(false)
const formData = reactive({
  id: 0, name: '', district: '', sub_district: '', city_id: 310000,
  avg_price: undefined as number | undefined,
  build_year_start: undefined as number | undefined,
  build_year_end: undefined as number | undefined,
  property_type: '', total_buildings: undefined as number | undefined,
  total_units: undefined as number | undefined, developer: '',
  source: '', remark: '',
})

const importVisible = ref(false)
const importText = ref('')

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const params: any = {}
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.city_id) params.city_id = filters.city_id
    const data: any = await listCommunities(params)
    list.value = Array.isArray(data) ? data : (data.items || [])
  } finally { loading.value = false }
}

function onSearch() { loadData() }
function onPageChange(_p: any) {}

function onAdd() {
  isEdit.value = false
  Object.assign(formData, {
    id: 0, name: '', district: '', sub_district: '', city_id: 310000,
    avg_price: undefined, build_year_start: undefined, build_year_end: undefined,
    property_type: '', total_buildings: undefined, total_units: undefined,
    developer: '', source: '', remark: '',
  })
  formVisible.value = true
}

function onEdit(row: any) {
  isEdit.value = true
  Object.assign(formData, {
    id: row.id, name: row.name, district: row.district || '',
    sub_district: row.sub_district || '', city_id: row.city_id || 310000,
    avg_price: row.avg_price, build_year_start: row.build_year_start,
    build_year_end: row.build_year_end,
    property_type: row.property_type || '',
    total_buildings: row.total_buildings, total_units: row.total_units,
    developer: row.developer || '', source: row.source || '',
    remark: row.remark || '',
  })
  formVisible.value = true
}

async function onSave() {
  const payload: any = { ...formData }
  delete payload.id
  // Clean empty optional fields
  Object.keys(payload).forEach(k => {
    if (payload[k] === '' || payload[k] === undefined) delete payload[k]
  })
  try {
    if (isEdit.value) {
      await updateCommunity(formData.id, payload)
    } else {
      if (!formData.name) { MessagePlugin.warning('请填写小区名称'); return }
      await createCommunity(payload)
    }
    MessagePlugin.success('保存成功')
    formVisible.value = false
    loadData()
  } catch (e: any) {
    const msg = e?.response?.data?.detail || '保存失败'
    MessagePlugin.error(msg)
  }
}

async function onDelete(id: number) {
  await deleteCommunity(id)
  MessagePlugin.success('已删除')
  loadData()
}

function onBatchImport() { importText.value = ''; importVisible.value = true }

async function onImportSubmit() {
  if (!importText.value.trim()) { MessagePlugin.warning('请粘贴数据'); return }
  const lines = importText.value.trim().split('\n').filter(l => l.trim())
  const communities: any[] = []
  for (const line of lines) {
    try { communities.push(JSON.parse(line.trim())) }
    catch { MessagePlugin.error(`JSON 解析失败: ${line.substring(0, 50)}`); return }
  }
  try {
    const data: any = await batchImportCommunities(communities)
    MessagePlugin.success(data.message || `导入完成：新增 ${data.added}，跳过 ${data.skipped}`)
    importVisible.value = false
    loadData()
  } catch (e: any) {
    MessagePlugin.error(e?.response?.data?.detail || '导入失败')
  }
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.no-data { color: #bbb; }
</style>
