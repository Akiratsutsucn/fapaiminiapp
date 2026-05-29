<template>
  <div class="page">
    <h2 class="page-title">系统设置</h2>
    <t-row :gutter="16">
      <t-col :span="6">
        <t-card title="基础配置">
          <t-form :data="basicForm" label-width="120px" @submit="onSaveBasic">
            <t-form-item label="客服电话"><t-input v-model="basicForm.service_phone" /></t-form-item>
            <t-form-item label="客服文案"><t-input v-model="basicForm.service_text" /></t-form-item>
            <t-button type="submit" theme="primary" :loading="saving">保存</t-button>
          </t-form>
        </t-card>
      </t-col>
      <t-col :span="6">
        <t-card title="城市配置">
          <t-table :data="cities" :columns="cityColumns" row-key="city_id">
            <template #is_active="{ row }">
              <t-tag :theme="row.is_active ? 'success' : 'default'">{{ row.is_active ? '启用' : '停用' }}</t-tag>
            </template>
          </t-table>
          <t-divider />
          <t-space>
            <t-input-number v-model="newCityId" placeholder="城市ID" style="width:120px" />
            <t-input v-model="newCityName" placeholder="城市名称" style="width:120px" />
            <t-button theme="primary" @click="onAddCity">添加城市</t-button>
          </t-space>
        </t-card>
      </t-col>
    </t-row>

    <t-card title="房源数据归档" style="margin-top:16px">
      <t-alert theme="info" style="margin-bottom:16px">
        <template #message>
          <div>系统将于每年 12 月 31 日 23:59 自动生成全年房源数据归档（CSV 格式，含全部 45 个字段）。您也可以随时手动导出。</div>
        </template>
      </t-alert>
      <t-space>
        <t-button theme="primary" :loading="exporting" @click="onManualExport">立即导出全量归档</t-button>
        <t-button variant="outline" :loading="loadingArchives" @click="loadArchives">刷新归档列表</t-button>
      </t-space>

      <t-table v-if="archives.length" :data="archives" :columns="archiveColumns" row-key="filename" style="margin-top:16px" bordered>
        <template #size="{ row }">{{ formatSize(row.size) }}</template>
        <template #op="{ row }">
          <t-button variant="text" size="small" @click="onDownloadArchive(row.filename)">下载</t-button>
        </template>
      </t-table>
      <div v-else-if="!loadingArchives" class="empty-archives">暂无归档文件</div>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { getSettings, updateSettings, listCities, addCity } from '@/api/settings'
import http from '@/utils/request'

const saving = ref(false)
const exporting = ref(false)
const loadingArchives = ref(false)
const cities = ref<any[]>([])
const archives = ref<any[]>([])
const newCityId = ref(0)
const newCityName = ref('')

const basicForm = reactive({
  service_phone: '400-007-6786',
  service_text: '周一至周六 8:00~18:00',
})

const cityColumns = [
  { colKey: 'city_id', title: '城市ID', width: 100 },
  { colKey: 'city_name', title: '城市名称', width: 100 },
  { colKey: 'is_active', title: '状态', width: 80 },
]

const archiveColumns = [
  { colKey: 'filename', title: '文件名', ellipsis: true },
  { colKey: 'size', title: '大小', width: 100 },
  { colKey: 'created_at', title: '生成时间', width: 180 },
  { colKey: 'op', title: '操作', width: 80 },
]

onMounted(async () => {
  try {
    const data: any = await getSettings()
    if (data) Object.assign(basicForm, data)
  } catch { /* skip */ }
  try {
    const data: any = await listCities()
    cities.value = data || []
  } catch { /* skip */ }
  loadArchives()
})

async function onSaveBasic() {
  saving.value = true
  try {
    await updateSettings({ ...basicForm })
    MessagePlugin.success('已保存')
  } finally { saving.value = false }
}

async function onAddCity() {
  if (!newCityId.value || !newCityName.value) {
    MessagePlugin.warning('请填写城市ID和名称')
    return
  }
  try {
    await addCity({ city_id: newCityId.value, city_name: newCityName.value })
    MessagePlugin.success('已添加')
    newCityId.value = 0
    newCityName.value = ''
    const data: any = await listCities()
    cities.value = data || []
  } catch { /* skip */ }
}

async function loadArchives() {
  loadingArchives.value = true
  try {
    const { data } = await http.get('/settings/archive/list')
    archives.value = data || []
  } catch { archives.value = [] }
  finally { loadingArchives.value = false }
}

async function onManualExport() {
  exporting.value = true
  try {
    const res = await http.post('/settings/archive/export', {}, { responseType: 'blob', params: { format: 'xlsx' } })
    const disposition = res.headers['content-disposition'] || ''
    const match = disposition.match(/filename=(.+)/)
    const fname = match ? decodeURIComponent(match[1]) : '房源归档.xlsx'
    const url = URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url; a.download = fname; a.click()
    MessagePlugin.success('归档已生成并下载')
    loadArchives()
  } catch {
    MessagePlugin.error('导出失败')
  } finally { exporting.value = false }
}

async function onDownloadArchive(filename: string) {
  try {
    const res = await http.get(`/settings/archive/download/${encodeURIComponent(filename)}`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
  } catch {
    MessagePlugin.error('下载失败')
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.empty-archives { color: #bbb; font-size: 13px; margin-top: 16px; }
</style>
