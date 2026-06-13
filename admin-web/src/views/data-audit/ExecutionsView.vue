<template>
  <div class="page">
    <h2 class="page-title">审核历史</h2>

    <!-- 统计图表 -->
    <t-row :gutter="16" style="margin-bottom: 20px">
      <t-col :span="6">
        <t-card>
          <div class="stat-label">最近7天执行次数</div>
          <div class="stat-value">{{ stats7Days.execution_count }}</div>
        </t-card>
      </t-col>
      <t-col :span="6">
        <t-card>
          <div class="stat-label">最近7天违规数</div>
          <div class="stat-value">{{ stats7Days.total_violations }}</div>
        </t-card>
      </t-col>
      <t-col :span="6">
        <t-card>
          <div class="stat-label">最近7天清理数</div>
          <div class="stat-value">{{ stats7Days.cleaned_count }}</div>
        </t-card>
      </t-col>
      <t-col :span="6">
        <t-card>
          <div class="stat-label">最近7天修复数</div>
          <div class="stat-value">{{ stats7Days.fixed_count }}</div>
        </t-card>
      </t-col>
    </t-row>

    <!-- 时间轴列表 -->
    <t-card title="执行记录">
      <div class="filter-bar">
        <t-select v-model="dayFilter" style="width: 150px" @change="loadExecutions">
          <t-option :value="7" label="最近7天" />
          <t-option :value="30" label="最近30天" />
          <t-option :value="90" label="最近90天" />
        </t-select>
      </div>

      <div class="timeline-container">
        <div v-if="executions.length === 0" class="empty-state">
          <t-icon name="inbox" style="font-size: 48px; color: #ccc; margin-bottom: 12px" />
          <div style="color: #999">暂无审核记录</div>
        </div>

        <div v-for="execution in executions" :key="execution.id" class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-card">
            <div class="card-header">
              <div class="execution-time">{{ formatDateTime(execution.execution_time) }}</div>
              <t-tag :theme="execution.status === 'completed' ? 'success' : 'danger'" size="small">
                {{ execution.status }}
              </t-tag>
            </div>

            <div class="card-summary">
              <div class="summary-item">
                <span class="summary-label">审核规则:</span>
                <span class="summary-value">{{ execution.total_rules }}条</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">发现违规:</span>
                <span class="summary-value warning">{{ execution.total_violations }}条</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">已清理:</span>
                <span class="summary-value success">{{ execution.cleaned_count }}条</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">已修复:</span>
                <span class="summary-value primary">{{ execution.fixed_count }}条</span>
              </div>
            </div>

            <t-space style="margin-top: 12px">
              <t-button size="small" variant="outline" @click="onViewDetail(execution.id)">
                <template #icon><t-icon name="view-list" /></template>
                查看详情
              </t-button>
            </t-space>
          </div>
        </div>
      </div>

      <div v-if="pagination.total > pagination.pageSize" style="margin-top: 20px; text-align: center">
        <t-pagination
          :total="pagination.total"
          :current="pagination.current"
          :page-size="pagination.pageSize"
          @change="onPageChange"
        />
      </div>
    </t-card>

    <!-- 详情弹窗 -->
    <t-dialog v-model:visible="detailVisible" header="审核详情" width="900px" :footer="false">
      <t-loading v-if="detailLoading" size="large" />
      <div v-else-if="currentDetail">
        <div class="detail-summary">
          <div class="detail-item">
            <div class="detail-label">执行时间</div>
            <div class="detail-value">{{ formatDateTime(currentDetail.execution_time) }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">状态</div>
            <div class="detail-value">
              <t-tag :theme="currentDetail.status === 'completed' ? 'success' : 'danger'">
                {{ currentDetail.status }}
              </t-tag>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">检查房源数</div>
            <div class="detail-value">{{ currentDetail.properties_checked }}条</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">执行耗时</div>
            <div class="detail-value">{{ currentDetail.execution_duration }}秒</div>
          </div>
        </div>

        <t-divider />

        <!-- 应用的审核规则 -->
        <div class="rules-section">
          <h4 class="section-title">应用的审核规则</h4>
          <div class="rules-list">
            <div v-for="rule in currentDetail.rules_applied" :key="rule.rule_id" class="rule-item">
              <div class="rule-info">
                <span class="rule-name">{{ rule.rule_name }}</span>
                <t-tag size="small" :theme="getActionTheme(rule.action)">{{ getActionLabel(rule.action) }}</t-tag>
              </div>
              <div class="rule-code">规则代码: {{ rule.rule_code }}</div>
            </div>
          </div>
        </div>

        <t-divider />

        <!-- 详细操作记录 -->
        <div class="actions-section">
          <h4 class="section-title">详细操作记录</h4>
          <div v-if="currentDetail.detailed_actions && currentDetail.detailed_actions.length > 0" class="actions-list">
            <div v-for="(action, index) in currentDetail.detailed_actions" :key="index" class="action-item">
              <t-icon name="check-circle" class="action-icon" />
              <span class="action-text">{{ action }}</span>
            </div>
          </div>
          <div v-else class="empty-actions">
            <t-icon name="info-circle" style="margin-right: 8px; color: #999" />
            <span style="color: #999">本次审核未发现违规数据</span>
          </div>
        </div>

        <t-divider />

        <!-- 操作统计 -->
        <div class="stats-section">
          <h4 class="section-title">操作统计</h4>
          <t-row :gutter="16">
            <t-col :span="4">
              <div class="stat-box">
                <div class="stat-number deleted">{{ currentDetail.properties_deleted }}</div>
                <div class="stat-label">已删除</div>
              </div>
            </t-col>
            <t-col :span="4">
              <div class="stat-box">
                <div class="stat-number fixed">{{ currentDetail.properties_fixed }}</div>
                <div class="stat-label">已修复</div>
              </div>
            </t-col>
            <t-col :span="4">
              <div class="stat-box">
                <div class="stat-number flagged">{{ currentDetail.action_statistics?.flagged_count || 0 }}</div>
                <div class="stat-label">已标记</div>
              </div>
            </t-col>
          </t-row>
        </div>

        <!-- 违规详情统计 -->
        <div v-if="currentDetail.violations_found && Object.keys(currentDetail.violations_found).length > 0" class="violations-section">
          <t-divider />
          <h4 class="section-title">违规详情统计</h4>
          <p class="section-hint">每条规则的违规数及处理方式（删除 / 标记 / 修复），避免歧义</p>
          <div class="violations-list">
            <div v-for="(count, ruleName) in currentDetail.violations_found" :key="ruleName" class="violation-item">
              <span class="violation-rule">{{ ruleName }}</span>
              <div class="violation-actions">
                <t-tag theme="default" size="small">违规 {{ count }}条</t-tag>
                <template v-if="currentDetail.rule_action_summary && currentDetail.rule_action_summary[ruleName]">
                  <t-tag v-if="currentDetail.rule_action_summary[ruleName].deleted > 0" theme="danger" size="small">
                    已删除 {{ currentDetail.rule_action_summary[ruleName].deleted }}
                  </t-tag>
                  <t-tag v-if="currentDetail.rule_action_summary[ruleName].fixed > 0" theme="success" size="small">
                    已修复 {{ currentDetail.rule_action_summary[ruleName].fixed }}
                  </t-tag>
                  <t-tag v-if="currentDetail.rule_action_summary[ruleName].flagged > 0" theme="warning" size="small">
                    已标记 {{ currentDetail.rule_action_summary[ruleName].flagged }}
                  </t-tag>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listAuditExecutions, getAuditExecutionDetail, getAuditStats } from '@/api/dataAudit'

const executions = ref<any[]>([])
const dayFilter = ref(7)
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const detailVisible = ref(false)
const detailLoading = ref(false)
const currentDetail = ref<any>(null)

const statsData = ref<any>({ recent_7_days: [], recent_30_days: [] })

const stats7Days = computed(() => {
  const data = statsData.value.recent_7_days || []
  return {
    execution_count: data.length,
    total_violations: data.reduce((sum: number, item: any) => sum + item.total_violations, 0),
    cleaned_count: data.reduce((sum: number, item: any) => sum + item.cleaned_count, 0),
    fixed_count: data.reduce((sum: number, item: any) => sum + item.fixed_count, 0),
  }
})

const ruleColumns = [
  { colKey: 'rule_name', title: '规则名称', width: 200 },
  { colKey: 'rule_description', title: '规则说明', width: 300 },
  { colKey: 'violation_count', title: '违规数', width: 100 },
  { colKey: 'cleaned_count', title: '清理数', width: 100 },
  { colKey: 'fixed_count', title: '修复数', width: 100 },
]

onMounted(() => {
  loadExecutions()
  loadStats()
})

async function loadExecutions() {
  try {
    const params = {
      page: pagination.current,
      page_size: pagination.pageSize,
      days: dayFilter.value,
    }
    const data = await listAuditExecutions(params)
    executions.value = data.items
    pagination.total = data.total
  } catch (err) {
    MessagePlugin.error('加载审核记录失败')
  }
}

async function loadStats() {
  try {
    const data = await getAuditStats()
    statsData.value = data
  } catch (err) {
    console.error('加载统计数据失败:', err)
  }
}

async function onViewDetail(id: number) {
  detailVisible.value = true
  detailLoading.value = true
  currentDetail.value = null

  try {
    const data = await getAuditExecutionDetail(id)
    currentDetail.value = data
  } catch (err) {
    MessagePlugin.error('加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

function onPageChange(pageInfo: any) {
  pagination.current = pageInfo.current
  loadExecutions()
}

function formatDateTime(isoTime: string) {
  if (!isoTime) return '--'
  const date = new Date(isoTime)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getActionTheme(action: string) {
  const themeMap: Record<string, string> = {
    delete: 'danger',
    fix: 'success',
    flag: 'warning'
  }
  return themeMap[action] || 'default'
}

function getActionLabel(action: string) {
  const labelMap: Record<string, string> = {
    delete: '删除',
    fix: '修复',
    flag: '标记'
  }
  return labelMap[action] || action
}
</script>

<style scoped>
.page-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 20px;
}

.stat-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #0052d9;
}

.filter-bar {
  margin-bottom: 20px;
}

.timeline-container {
  position: relative;
  padding-left: 30px;
}

.timeline-item {
  position: relative;
  padding-bottom: 30px;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -24px;
  top: 12px;
  bottom: -18px;
  width: 2px;
  background: #e7e7e7;
}

.timeline-item:last-child::before {
  display: none;
}

.timeline-dot {
  position: absolute;
  left: -30px;
  top: 8px;
  width: 12px;
  height: 12px;
  background: #0052d9;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 2px #e7e7e7;
}

.timeline-card {
  background: #fafafa;
  border: 1px solid #e7e7e7;
  border-radius: 8px;
  padding: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.execution-time {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.card-summary {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.summary-item {
  font-size: 13px;
}

.summary-label {
  color: #666;
  margin-right: 4px;
}

.summary-value {
  font-weight: 600;
  color: #1a1a1a;
}

.summary-value.warning {
  color: #e37318;
}

.summary-value.success {
  color: #00a870;
}

.summary-value.primary {
  color: #0052d9;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
}

/* 详情弹窗样式 */
.detail-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.detail-item {
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.detail-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
}

.detail-value {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.rules-section,
.actions-section,
.stats-section,
.violations-section {
  margin-top: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1a1a1a;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-item {
  padding: 12px;
  background: #f8f8f8;
  border: 1px solid #e7e7e7;
  border-radius: 6px;
}

.rule-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.rule-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.rule-code {
  font-size: 12px;
  color: #999;
}

.actions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: #f0f9ff;
  border-left: 3px solid #0052d9;
  border-radius: 4px;
}

.action-icon {
  color: #00a870;
  font-size: 16px;
  margin-right: 10px;
}

.action-text {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

.empty-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  background: #f8f8f8;
  border-radius: 6px;
}

.stat-box {
  text-align: center;
  padding: 16px;
  background: #f8f8f8;
  border-radius: 6px;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 6px;
}

.stat-number.deleted {
  color: #e34d59;
}

.stat-number.fixed {
  color: #00a870;
}

.stat-number.flagged {
  color: #e37318;
}

.stat-label {
  font-size: 13px;
  color: #666;
}

.violations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.violation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fff9e6;
  border: 1px solid #ffe6b3;
  border-radius: 4px;
}

.violation-rule {
  font-size: 14px;
  color: #333;
}

.violation-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.section-hint {
  font-size: 12px;
  color: #999;
  margin: -4px 0 10px;
}

.text-warning {
  color: #e37318;
  font-weight: 600;
}

.text-success {
  color: #00a870;
  font-weight: 600;
}

.text-primary {
  color: #0052d9;
  font-weight: 600;
}
</style>
