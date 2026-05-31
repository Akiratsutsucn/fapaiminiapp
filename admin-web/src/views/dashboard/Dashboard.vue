<template>
  <div class="dashboard">
    <div class="page-header">
      <h2 class="page-title">数据看板</h2>
      <t-select v-model="cityId" style="width: 160px" @change="loadDashboard">
        <t-option :value="0" label="全部" />
        <t-option :value="310000" label="上海" />
        <t-option :value="330200" label="宁波" />
        <t-option :value="330100" label="杭州" />
      </t-select>
    </div>
    <t-row :gutter="16" class="stat-cards">
      <t-col :span="3" v-for="card in cards" :key="card.label">
        <t-card :title="card.label" hover-shadow>
          <div class="stat-value">{{ card.value }}</div>
        </t-card>
      </t-col>
    </t-row>
    <t-row :gutter="16" style="margin-top:16px">
      <t-col :span="6">
        <t-card title="爬虫运行状态">
          <t-descriptions :items="crawlerItems" />
          <t-button theme="primary" size="small" @click="onTriggerCrawl" :loading="triggerLoading" style="margin-top:12px">手动触发抓取</t-button>
        </t-card>
      </t-col>
      <t-col :span="6">
        <t-card title="快速入口">
          <t-space direction="vertical" style="width:100%">
            <t-button variant="outline" block @click="router.push('/properties')">房源管理</t-button>
            <t-button variant="outline" block @click="router.push('/demands')">需求管理</t-button>
            <t-button variant="outline" block @click="router.push('/articles')">文章管理</t-button>
          </t-space>
        </t-card>
      </t-col>
    </t-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { getDashboard } from '@/api/dashboard'
import { getCrawlerStatus, triggerCrawler } from '@/api/crawler'

const router = useRouter()
const triggerLoading = ref(false)
const cityId = ref(0)  // 0=全部, 310000=上海, 330200=宁波
const cards = ref([
  { label: '总房源数', value: 0 },
  { label: '今日新增', value: 0 },
  { label: '即将开拍', value: 0 },
  { label: '捡漏房源', value: 0 },
  { label: '昨日上架', value: 0 },
  { label: '昨日成交', value: 0 },
  { label: '注册用户', value: 0 },
  { label: '代理商', value: 0 },
  { label: '待处理需求', value: 0 },
  { label: '待处理留言', value: 0 },
  { label: '已成交', value: 0 },
  { label: '总文章数', value: 0 },
])

const crawlerItems = ref([
  { label: '最近运行', value: '--' },
  { label: '运行状态', value: '--' },
])

async function loadDashboard() {
  try {
    const data: any = await getDashboard(cityId.value || undefined)
    cards.value[0].value = data.total_properties || 0
    cards.value[1].value = data.today_new || 0
    cards.value[2].value = data.upcoming || 0
    cards.value[3].value = data.bargain_count || 0
    cards.value[4].value = data.yesterday_listed || 0
    cards.value[5].value = data.yesterday_sold || 0
    cards.value[6].value = data.total_users || 0
    cards.value[7].value = data.agent_count || 0
    cards.value[8].value = data.pending_demands || 0
    cards.value[9].value = data.pending_messages || 0
    cards.value[10].value = data.sold || 0
    cards.value[11].value = data.total_articles || 0
  } catch { /* skip */ }
}

onMounted(async () => {
  loadDashboard()
  try {
    const status = await getCrawlerStatus()
    crawlerItems.value = [
      { label: '最近运行', value: status.last_run_at || '--' },
      { label: '运行状态', value: status.is_running ? '运行中' : ((status as any).last_status || '--') },
    ]
  } catch { /* skip */ }
})

async function onTriggerCrawl() {
  triggerLoading.value = true
  try {
    await triggerCrawler()
    MessagePlugin.success('爬取任务已创建')
  } finally { triggerLoading.value = false }
}
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0; }
.stat-value { font-size: 32px; font-weight: 700; color: #2d4a7a; text-align: center; padding: 16px 0; }
</style>
