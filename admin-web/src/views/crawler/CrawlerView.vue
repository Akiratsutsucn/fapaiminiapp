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
      <t-col :span="12">
        <t-card title="Cookie管理">
          <t-space direction="vertical" style="width:100%">
            <div v-for="platform in platforms" :key="platform.key" style="margin-bottom:20px;padding:12px;border:1px solid #e7e7e7;border-radius:6px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <div>
                  <span style="font-weight:600;font-size:15px;margin-right:8px">{{ platform.name }}</span>
                  <t-tag :theme="cookiesStatus[platform.key]?.configured ? 'success' : 'warning'" size="small">
                    {{ cookiesStatus[platform.key]?.configured ? '已配置' : '未配置' }}
                  </t-tag>
                </div>
              </div>

              <t-space direction="vertical" style="width:100%">
                <div style="background:#f5f5f5;padding:10px;border-radius:4px;font-size:13px;color:#666">
                  <div style="margin-bottom:6px">1. 点击"登录{{ platform.name }}"按钮，在新窗口完成登录</div>
                  <div>2. 登录成功后，回到本页点击"提取Cookie"按钮</div>
                </div>

                <t-space>
                  <t-button
                    size="small"
                    variant="outline"
                    @click="onOpenLoginPage(platform)"
                  >
                    <template #icon><t-icon name="login" /></template>
                    登录{{ platform.name }}
                  </t-button>

                  <t-button
                    size="small"
                    theme="primary"
                    @click="onExtractCookie(platform.key)"
                    :loading="extractLoading[platform.key]"
                  >
                    <template #icon><t-icon name="precise-monitor" /></template>
                    提取Cookie
                  </t-button>
                </t-space>

                <t-divider style="margin:8px 0" />

                <div style="font-size:12px;color:#999">或手动粘贴Cookie：</div>
                <t-textarea
                  v-model="cookieInputs[platform.key]"
                  :placeholder="`手动粘贴${platform.name}的Cookie字符串`"
                  :autosize="{ minRows: 2, maxRows: 3 }"
                  style="font-size:12px"
                />
                <t-button
                  size="small"
                  variant="base"
                  @click="onUpdateCookie(platform.key)"
                  :loading="cookieLoading[platform.key]"
                >
                  保存手动输入的Cookie
                </t-button>
              </t-space>
            </div>
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
import { getCrawlerStatus, listCrawlerTasks, triggerCrawler, getCookiesStatus, updateCookie } from '@/api/crawler'

const triggerLoading = ref(false)
const taskLoading = ref(false)
const tasks = ref<any[]>([])
const statsVisible = ref(false)
const currentStats = ref<any>(null)

const platforms = [
  { key: 'taobao', name: '淘宝拍卖', url: 'https://sf.taobao.com/', domain: '.taobao.com' },
  { key: 'jd', name: '京东拍卖', url: 'https://auction.jd.com/', domain: '.jd.com' },
  { key: 'gpai', name: '公拍网', url: 'https://www.gpai.net/', domain: '.gpai.net' },
]

const cookiesStatus = ref<any>({})
const cookieInputs = ref<any>({
  taobao: '',
  jd: '',
  gpai: '',
})
const cookieLoading = ref<any>({
  taobao: false,
  jd: false,
  gpai: false,
})
const extractLoading = ref<any>({
  taobao: false,
  jd: false,
  gpai: false,
})

let loginWindow: Window | null = null

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

onMounted(() => { loadStatus(); loadTasks(); loadCookiesStatus() })

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

async function loadCookiesStatus() {
  try {
    const data: any = await getCookiesStatus()
    cookiesStatus.value = data
  } catch (err) {
    console.error('加载Cookie状态失败:', err)
  }
}

function onOpenLoginPage(platform: any) {
  const width = 1000
  const height = 700
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2

  loginWindow = window.open(
    platform.url,
    `login_${platform.key}`,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  )

  if (loginWindow) {
    MessagePlugin.info(`已打开${platform.name}登录页面，请在新窗口完成登录`)
  } else {
    MessagePlugin.error('无法打开新窗口，请检查浏览器是否阻止了弹窗')
  }
}

async function onExtractCookie(platformKey: string) {
  const platform = platforms.find(p => p.key === platformKey)
  if (!platform) return

  MessagePlugin.warning({
    content: `由于浏览器安全限制，请手动获取Cookie：
1. 在登录窗口按F12打开开发者工具
2. 进入Application标签 > Cookies > ${platform.domain}
3. 复制所有Cookie的键值对（格式：key1=value1; key2=value2）
4. 粘贴到下方文本框中并点击保存`,
    duration: 10000,
  })
}

async function onUpdateCookie(platform: string) {
  const cookie = cookieInputs.value[platform]?.trim()
  if (!cookie) {
    MessagePlugin.warning('请输入Cookie内容')
    return
  }

  cookieLoading.value[platform] = true
  try {
    await updateCookie(platform, cookie)
    MessagePlugin.success('Cookie已保存')
    cookieInputs.value[platform] = ''
    await loadCookiesStatus()
  } catch (err: any) {
    MessagePlugin.error(err.message || 'Cookie保存失败')
  } finally {
    cookieLoading.value[platform] = false
  }
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
