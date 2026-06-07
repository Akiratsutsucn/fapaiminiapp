<template>
  <div class="page">
    <h2 class="page-title">爬虫管理</h2>
    <t-row :gutter="16" style="margin-bottom:20px">
      <t-col :span="6">
        <t-card title="运行状态">
          <t-descriptions :items="statusItems" />
          <t-divider style="margin:12px 0" />
          <t-link
            theme="primary"
            href="https://u.yunjingl2tp.com/sk5line/index"
            target="_blank"
            hover="color"
          >
            <template #prefix-icon><t-icon name="swap" /></template>
            住宅IP切换（登录云镜手动换IP）
          </t-link>
        </t-card>
      </t-col>
      <t-col :span="6">
        <t-card title="手动操作">
          <t-space direction="vertical">
            <t-button theme="primary" @click="onTriggerAll" :loading="triggerLoading">全量抓取（所有平台）</t-button>
            <t-button variant="outline" @click="onTriggerPlatform('阿里拍卖')">仅淘宝拍卖</t-button>
            <t-button variant="outline" @click="onTriggerPlatform('京东拍卖')">仅京东拍卖</t-button>
            <t-button variant="outline" @click="onTriggerPlatform('公拍网')">仅公拍网</t-button>
          </t-space>
        </t-card>
      </t-col>
    </t-row>

    <t-card title="任务记录">
      <t-table :data="tasks" :columns="taskColumns" :loading="taskLoading" row-key="id">
        <template #status="{ row }">
          <t-tag :theme="row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'running' ? 'primary' : 'default'">
            {{ row.status }}
          </t-tag>
        </template>
        <template #op="{ row }">
          <t-button v-if="row.stats_summary" variant="text" size="small" @click="showStats(row)">查看</t-button>
          <span v-else style="color:#999">-</span>
        </template>
      </t-table>
    </t-card>

    <t-dialog v-model:visible="statsVisible" header="本轮爬取详情" width="600px" :footer="false">
      <pre v-if="currentStats" style="white-space:pre-wrap;font-size:12px">{{ JSON.stringify(currentStats, null, 2) }}</pre>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { getCrawlerStatus, listCrawlerTasks, triggerCrawler } from '@/api/crawler'

const triggerLoading = ref(false)
const taskLoading = ref(false)
const tasks = ref<any[]>([])
const statsVisible = ref(false)
const currentStats = ref<any>(null)

function showStats(row: any) {
  currentStats.value = row.stats_summary
  statsVisible.value = true
}
const statusItems = ref([{ label: '最近运行', value: '--' }, { label: '当前状态', value: '--' }])

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
]

onMounted(() => { loadStatus(); loadTasks() })

async function loadStatus() {
  try {
    const data: any = await getCrawlerStatus()
    statusItems.value = [
      { label: '最近运行', value: data.last_run_at || '--' },
      { label: '当前状态', value: data.is_running ? '运行中' : data.last_status || '--' },
    ]
  } catch { /* skip */ }
}

async function loadTasks() {
  taskLoading.value = true
  try {
    const data: any = await listCrawlerTasks()
    tasks.value = data
  } finally { taskLoading.value = false }
}

async function onTriggerAll() {
  triggerLoading.value = true
  try { await triggerCrawler(); MessagePlugin.success('任务已创建') } finally { triggerLoading.value = false }
}

async function onTriggerPlatform(platform: string) {
  try { await triggerCrawler({ platform }); MessagePlugin.success(`${platform} 任务已创建`) } catch { /* skip */ }
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
</style>
