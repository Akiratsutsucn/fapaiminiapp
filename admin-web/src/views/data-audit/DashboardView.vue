<!-- 数据审核管理 - 概览页 -->
<template>
  <div class="data-audit-dashboard">
    <div class="page-header">
      <h2 class="page-title">数据审核概览</h2>
      <t-button theme="primary" @click="handleCreateTask">立即审核</t-button>
    </div>

    <!-- 统计卡片 -->
    <t-row :gutter="16" class="stats-row">
      <t-col :span="3">
        <t-card hover-shadow>
          <div class="stat-item">
            <div class="stat-value">{{ stats.total_rules || 0 }}</div>
            <div class="stat-label">审核规则总数</div>
            <div class="stat-meta">启用: {{ stats.enabled_rules || 0 }}</div>
          </div>
        </t-card>
      </t-col>
      <t-col :span="3">
        <t-card hover-shadow>
          <div class="stat-item">
            <div class="stat-value">{{ stats.total_tasks || 0 }}</div>
            <div class="stat-label">执行任务总数</div>
          </div>
        </t-card>
      </t-col>
      <t-col :span="3">
        <t-card hover-shadow>
          <div class="stat-item">
            <div class="stat-value" :class="getScoreClass(stats.latest_quality_score)">
              {{ stats.latest_quality_score !== null ? stats.latest_quality_score.toFixed(1) : '-' }}
            </div>
            <div class="stat-label">最新数据质量评分</div>
          </div>
        </t-card>
      </t-col>
      <t-col :span="3">
        <t-card hover-shadow>
          <div class="stat-item">
            <div class="stat-value text-warning">{{ stats.open_violations || 0 }}</div>
            <div class="stat-label">待处理违规</div>
          </div>
        </t-card>
      </t-col>
    </t-row>

    <!-- 最新任务 -->
    <t-card title="最新审核任务" style="margin-top: 16px" v-if="stats.latest_task">
      <t-descriptions :items="taskDescItems" />
      <div style="margin-top: 15px;">
        <t-button size="small" @click="navigateTo('tasks')">查看详情</t-button>
        <t-button size="small" @click="navigateTo('tasks')" style="margin-left: 8px">查看报告</t-button>
      </div>
    </t-card>

    <!-- 功能入口 -->
    <t-row :gutter="16" class="function-cards">
      <t-col :span="4">
        <t-card hover-shadow class="function-card" @click="navigateTo('rules')">
          <div class="function-content">
            <div class="function-title">审核规则管理</div>
            <div class="function-desc">配置和管理数据审核规则</div>
          </div>
        </t-card>
      </t-col>
      <t-col :span="4">
        <t-card hover-shadow class="function-card" @click="navigateTo('tasks')">
          <div class="function-content">
            <div class="function-title">审核任务管理</div>
            <div class="function-desc">查看和管理审核任务执行记录</div>
          </div>
        </t-card>
      </t-col>
      <t-col :span="4">
        <t-card hover-shadow class="function-card" @click="navigateTo('violations')">
          <div class="function-content">
            <div class="function-title">违规记录管理</div>
            <div class="function-desc">查看和处理数据违规记录</div>
          </div>
        </t-card>
      </t-col>
    </t-row>

    <!-- 创建任务对话框 -->
    <t-dialog v-model:visible="createTaskVisible" header="创建审核任务" width="600px" @confirm="submitCreateTask">
      <t-form :data="taskForm" label-width="100px">
        <t-form-item label="任务名称">
          <t-input v-model="taskForm.task_name" placeholder="请输入任务名称" />
        </t-form-item>
        <t-form-item label="选择规则">
          <t-checkbox-group v-model="taskForm.rule_ids">
            <t-checkbox v-for="rule in enabledRules" :key="rule.id" :value="rule.id">
              {{ rule.rule_name }}
            </t-checkbox>
          </t-checkbox-group>
        </t-form-item>
        <t-form-item label="审核范围">
          <t-radio-group v-model="scopeType">
            <t-radio value="all">全部数据</t-radio>
            <t-radio value="custom">自定义范围</t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item v-if="scopeType === 'custom'" label="平台">
          <t-checkbox-group v-model="taskForm.scope.platforms">
            <t-checkbox value="阿里拍卖">阿里拍卖</t-checkbox>
            <t-checkbox value="京东拍卖">京东拍卖</t-checkbox>
            <t-checkbox value="公拍网">公拍网</t-checkbox>
          </t-checkbox-group>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { getDashboardStats, getRuleList, createTask } from '@/api/dataAudit'

const router = useRouter()

const stats = ref({
  total_rules: 0,
  enabled_rules: 0,
  total_tasks: 0,
  open_violations: 0,
  latest_task: null,
  latest_quality_score: null
})

const createTaskVisible = ref(false)
const enabledRules = ref([])
const taskForm = ref({
  task_name: '',
  task_type: 'manual',
  rule_ids: [],
  scope: {
    platforms: []
  }
})
const scopeType = ref('all')

// 最新任务描述项
const taskDescItems = computed(() => {
  if (!stats.value.latest_task) return []
  return [
    { label: '任务名称', content: stats.value.latest_task.task_name },
    { label: '状态', content: getTaskStatusText(stats.value.latest_task.status) },
    { label: '质量评分', content: stats.value.latest_task.quality_score !== null ? stats.value.latest_task.quality_score.toFixed(1) : '-' },
    { label: '完成时间', content: stats.value.latest_task.completed_at || '-' }
  ]
})

// 加载统计数据
const loadStats = async () => {
  try {
    const res = await getDashboardStats()
    stats.value = res
  } catch (error) {
    MessagePlugin.error('加载统计数据失败')
  }
}

// 加载启用的规则
const loadEnabledRules = async () => {
  try {
    const res = await getRuleList({ enabled: true })
    enabledRules.value = res
  } catch (error) {
    MessagePlugin.error('加载规则列表失败')
  }
}

// 打开创建任务对话框
const handleCreateTask = () => {
  taskForm.value = {
    task_name: `手动审核_${new Date().toLocaleDateString()}`,
    task_type: 'manual',
    rule_ids: [],
    scope: {
      platforms: []
    }
  }
  scopeType.value = 'all'
  createTaskVisible.value = true
  loadEnabledRules()
}

// 提交创建任务
const submitCreateTask = async () => {
  if (!taskForm.value.task_name) {
    MessagePlugin.warning('请输入任务名称')
    return
  }
  if (taskForm.value.rule_ids.length === 0) {
    MessagePlugin.warning('请至少选择一个规则')
    return
  }

  try {
    const data = {
      task_name: taskForm.value.task_name,
      task_type: taskForm.value.task_type,
      rule_ids: taskForm.value.rule_ids,
      scope: scopeType.value === 'all' ? null : taskForm.value.scope
    }
    await createTask(data)
    MessagePlugin.success('审核任务已创建，正在后台执行')
    createTaskVisible.value = false
    setTimeout(loadStats, 1000)
  } catch (error) {
    MessagePlugin.error('创建任务失败')
  }
}

// 导航到子页面
const navigateTo = (page) => {
  router.push(`/data-audit/${page}`)
}

// 获取任务状态文本
const getTaskStatusText = (status) => {
  const map = {
    pending: '待执行',
    running: '执行中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

// 获取评分样式类
const getScoreClass = (score) => {
  if (score === null || score === undefined) return ''
  if (score >= 90) return 'text-success'
  if (score >= 70) return 'text-warning'
  return 'text-danger'
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.data-audit-dashboard {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.stats-row {
  margin-bottom: 16px;
}

.stat-item {
  text-align: center;
  padding: 20px 10px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #0052d9;
  margin-bottom: 8px;
}

.stat-value.text-success {
  color: #00a870;
}

.stat-value.text-warning {
  color: #e37318;
}

.stat-value.text-danger {
  color: #d54941;
}

.stat-label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 4px;
}

.stat-meta {
  font-size: 12px;
  color: #909399;
}

.function-cards {
  margin-top: 16px;
}

.function-card {
  cursor: pointer;
  transition: all 0.3s;
}

.function-card:hover {
  transform: translateY(-3px);
}

.function-content {
  text-align: center;
  padding: 30px 20px;
}

.function-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #303133;
}

.function-desc {
  font-size: 13px;
  color: #909399;
}
</style>
