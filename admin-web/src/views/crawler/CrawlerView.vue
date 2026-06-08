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
      <div class="info-banner">
        <t-icon name="info-circle" style="color:#0052d9;margin-right:8px" />
        <span>详情功能已上线（2026-06-08），触发新的爬虫任务将显示完整的3×3详细统计（平台×城市）</span>
      </div>
      <t-table :data="tasks" :columns="taskColumns" :loading="taskLoading" row-key="id" :expanded-row-keys="expandedRowKeys">
        <template #status="{ row }">
          <t-tag :theme="row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'running' ? 'primary' : 'default'">
            {{ row.status }}
          </t-tag>
        </template>
        <template #op="{ row }">
          <t-button variant="text" size="small" @click="toggleDetail(row.id)">
            <template #icon><t-icon :name="expandedRowKeys.includes(row.id) ? 'chevron-up' : 'chevron-down'" /></template>
            {{ expandedRowKeys.includes(row.id) ? '收起' : '详情' }}
          </t-button>
        </template>
        <template #expanded-row="{ row }">
          <div class="detail-grid-container">
            <t-loading v-if="detailLoading[row.id]" size="small" />
            <div v-else-if="taskDetails[row.id]" class="detail-grid">
              <table class="grid-table">
                <thead>
                  <tr>
                    <th class="corner-cell">平台 / 城市</th>
                    <th>上海</th>
                    <th>宁波</th>
                    <th>杭州</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="platform in platforms" :key="platform.key">
                    <td class="platform-cell">{{ platform.name }}</td>
                    <td v-for="city in cities" :key="city.id"
                        :class="getCellClass(taskDetails[row.id][platform.name]?.[city.name])">
                      <div v-if="taskDetails[row.id][platform.name]?.[city.name]" class="cell-content">
                        <div class="cell-stats">
                          <span class="stat-item success-stat">成功: {{ taskDetails[row.id][platform.name][city.name].success_count }}</span>
                          <span class="stat-item new-stat">新增: {{ taskDetails[row.id][platform.name][city.name].new_count }}</span>
                          <span class="stat-item update-stat">更新: {{ taskDetails[row.id][platform.name][city.name].updated_count }}</span>
                          <span v-if="taskDetails[row.id][platform.name][city.name].failed_count > 0" class="stat-item fail-stat">
                            失败: {{ taskDetails[row.id][platform.name][city.name].failed_count }}
                          </span>
                        </div>
                        <div v-if="taskDetails[row.id][platform.name][city.name].error_message" class="error-msg">
                          {{ taskDetails[row.id][platform.name][city.name].error_message }}
                        </div>
                      </div>
                      <span v-else class="no-data">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="no-detail">
              <t-icon name="file-search" style="font-size:36px;color:#ddd;margin-bottom:12px" />
              <div class="no-detail-text">{{ getEmptyDetailMessage(row) }}</div>
            </div>
          </div>
        </template>
      </t-table>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { getCrawlerStatus, listCrawlerTasks, triggerCrawler, getCookiesStatus, updateCookie, getTaskDetails } from '@/api/crawler'

const triggerLoading = ref(false)
const taskLoading = ref(false)
const tasks = ref<any[]>([])
const expandedRowKeys = ref<number[]>([])
const taskDetails = ref<Record<number, any>>({})
const detailLoading = ref<Record<number, boolean>>({})

const platforms = [
  { key: 'taobao', name: '阿里拍卖', url: 'https://sf.taobao.com/', domain: '.taobao.com' },
  { key: 'jd', name: '京东拍卖', url: 'https://auction.jd.com/', domain: '.jd.com' },
  { key: 'gpai', name: '公拍网', url: 'https://www.gpai.net/', domain: '.gpai.net' },
]

const cities = [
  { id: 310000, name: '上海' },
  { id: 330200, name: '宁波' },
  { id: 330100, name: '杭州' },
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

const statusItems = ref([{ label: '最近运行', value: '--' }, { label: '当前状态', value: '--' }])

const taskColumns = [
  { colKey: 'id', title: 'ID', width: 70 },
  { colKey: 'created_at', title: '创建时间', width: 180 },
  { colKey: 'status', title: '状态', width: 100 },
  { colKey: 'total_count', title: '总抓取数', width: 100 },
  { colKey: 'new_count', title: '新增', width: 80 },
  { colKey: 'updated_count', title: '更新', width: 80 },
  { colKey: 'op', title: '操作', width: 100 },
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

async function toggleDetail(taskId: number) {
  const index = expandedRowKeys.value.indexOf(taskId)
  if (index > -1) {
    expandedRowKeys.value.splice(index, 1)
  } else {
    expandedRowKeys.value.push(taskId)
    if (!taskDetails.value[taskId]) {
      await loadTaskDetail(taskId)
    }
  }
}

async function loadTaskDetail(taskId: number) {
  detailLoading.value[taskId] = true
  try {
    const data = await getTaskDetails(taskId)
    taskDetails.value[taskId] = data
  } catch (err) {
    MessagePlugin.error('加载任务详情失败')
  } finally {
    detailLoading.value[taskId] = false
  }
}

function getCellClass(cell: any) {
  if (!cell) return ''
  if (cell.failed_count > 0) return 'cell-error'
  return ''
}

function getEmptyDetailMessage(task: any) {
  const DETAIL_FEATURE_DATE = '2026-06-08'
  const taskDate = task.created_at?.split(' ')[0] || ''

  if (taskDate && taskDate < DETAIL_FEATURE_DATE) {
    return '此任务运行于详情功能上线前，暂无详细统计'
  }

  return '暂无详细数据，请等待任务执行完成'
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

.detail-grid-container {
  padding: 20px;
  background: #f8f8f8;
}

.detail-grid {
  overflow-x: auto;
}

.grid-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.grid-table th,
.grid-table td {
  padding: 12px;
  text-align: center;
  border: 1px solid #e7e7e7;
}

.grid-table th {
  background: #f5f5f5;
  font-weight: 600;
  color: #1a1a1a;
}

.corner-cell {
  background: #e8e8e8;
}

.platform-cell {
  background: #fafafa;
  font-weight: 600;
  text-align: left;
}

.cell-content {
  text-align: left;
}

.cell-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}

.stat-item {
  display: inline-block;
}

.success-stat {
  color: #00a870;
}

.new-stat {
  color: #0052d9;
}

.update-stat {
  color: #029cd4;
}

.fail-stat {
  color: #e34d59;
  font-weight: 600;
}

.cell-error {
  background: #fff1f0;
}

.error-msg {
  margin-top: 8px;
  padding: 6px;
  background: #ffe9e9;
  border-radius: 4px;
  font-size: 12px;
  color: #d9001b;
}

.no-data {
  color: #999;
  font-size: 14px;
}

.no-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.no-detail-text {
  color: #999;
  font-size: 14px;
  line-height: 1.6;
}

.info-banner {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: #f2f8ff;
  border: 1px solid #d4e8ff;
  border-radius: 6px;
  font-size: 13px;
  color: #333;
}
</style>
