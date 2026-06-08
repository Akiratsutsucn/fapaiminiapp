<!-- 数据审核管理 - 概览页 -->
<template>
  <div class="data-audit-dashboard">
    <el-card class="stats-card">
      <template #header>
        <div class="card-header">
          <span>数据审核概览</span>
          <el-button type="primary" size="small" @click="handleCreateTask">
            立即审核
          </el-button>
        </div>
      </template>

      <!-- 统计卡片 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value">{{ stats.total_rules || 0 }}</div>
            <div class="stat-label">审核规则总数</div>
            <div class="stat-meta">启用: {{ stats.enabled_rules || 0 }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value">{{ stats.total_tasks || 0 }}</div>
            <div class="stat-label">执行任务总数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value" :class="getScoreClass(stats.latest_quality_score)">
              {{ stats.latest_quality_score !== null ? stats.latest_quality_score.toFixed(1) : '-' }}
            </div>
            <div class="stat-label">最新数据质量评分</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value text-warning">{{ stats.open_violations || 0 }}</div>
            <div class="stat-label">待处理违规</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 最新任务 -->
    <el-card class="latest-task-card" v-if="stats.latest_task">
      <template #header>
        <span>最新审核任务</span>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="任务名称">
          {{ stats.latest_task.task_name }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getTaskStatusType(stats.latest_task.status)">
            {{ getTaskStatusText(stats.latest_task.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="质量评分">
          <span :class="getScoreClass(stats.latest_task.quality_score)">
            {{ stats.latest_task.quality_score !== null ? stats.latest_task.quality_score.toFixed(1) : '-' }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="完成时间" :span="3">
          {{ stats.latest_task.completed_at || '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <div style="margin-top: 15px;">
        <el-button size="small" @click="viewTaskDetail(stats.latest_task.id)">
          查看详情
        </el-button>
        <el-button size="small" @click="viewTaskReport(stats.latest_task.id)">
          查看报告
        </el-button>
      </div>
    </el-card>

    <!-- 功能入口 -->
    <el-row :gutter="20" class="function-cards">
      <el-col :span="8">
        <el-card class="function-card" shadow="hover" @click="navigateTo('rules')">
          <div class="function-icon">
            <el-icon :size="40"><Setting /></el-icon>
          </div>
          <div class="function-title">审核规则管理</div>
          <div class="function-desc">配置和管理数据审核规则</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="function-card" shadow="hover" @click="navigateTo('tasks')">
          <div class="function-icon">
            <el-icon :size="40"><List /></el-icon>
          </div>
          <div class="function-title">审核任务管理</div>
          <div class="function-desc">查看和管理审核任务执行记录</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="function-card" shadow="hover" @click="navigateTo('violations')">
          <div class="function-icon">
            <el-icon :size="40"><Warning /></el-icon>
          </div>
          <div class="function-title">违规记录管理</div>
          <div class="function-desc">查看和处理数据违规记录</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 创建任务对话框 -->
    <el-dialog v-model="createTaskVisible" title="创建审核任务" width="600px">
      <el-form :model="taskForm" label-width="100px">
        <el-form-item label="任务名称">
          <el-input v-model="taskForm.task_name" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="选择规则">
          <el-checkbox-group v-model="taskForm.rule_ids">
            <el-checkbox v-for="rule in enabledRules" :key="rule.id" :label="rule.id">
              {{ rule.rule_name }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="审核范围">
          <el-radio-group v-model="scopeType">
            <el-radio label="all">全部数据</el-radio>
            <el-radio label="custom">自定义范围</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="scopeType === 'custom'" label="平台">
          <el-checkbox-group v-model="taskForm.scope.platforms">
            <el-checkbox label="阿里拍卖">阿里拍卖</el-checkbox>
            <el-checkbox label="京东拍卖">京东拍卖</el-checkbox>
            <el-checkbox label="公拍网">公拍网</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createTaskVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreateTask" :loading="submitting">
          创建并执行
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Setting, List, Warning } from '@element-plus/icons-vue'
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
const submitting = ref(false)

// 加载统计数据
const loadStats = async () => {
  try {
    const res = await getDashboardStats()
    stats.value = res
  } catch (error) {
    ElMessage.error('加载统计数据失败')
  }
}

// 加载启用的规则
const loadEnabledRules = async () => {
  try {
    const res = await getRuleList({ enabled: true })
    enabledRules.value = res
  } catch (error) {
    ElMessage.error('加载规则列表失败')
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
    ElMessage.warning('请输入任务名称')
    return
  }
  if (taskForm.value.rule_ids.length === 0) {
    ElMessage.warning('请至少选择一个规则')
    return
  }

  submitting.value = true
  try {
    const data = {
      task_name: taskForm.value.task_name,
      task_type: taskForm.value.task_type,
      rule_ids: taskForm.value.rule_ids,
      scope: scopeType.value === 'all' ? null : taskForm.value.scope
    }
    await createTask(data)
    ElMessage.success('审核任务已创建，正在后台执行')
    createTaskVisible.value = false
    // 1秒后刷新统计
    setTimeout(loadStats, 1000)
  } catch (error) {
    ElMessage.error('创建任务失败')
  } finally {
    submitting.value = false
  }
}

// 导航到子页面
const navigateTo = (page) => {
  router.push(`/data-audit/${page}`)
}

// 查看任务详情
const viewTaskDetail = (taskId) => {
  router.push(`/data-audit/tasks/${taskId}`)
}

// 查看任务报告
const viewTaskReport = (taskId) => {
  router.push(`/data-audit/reports/${taskId}`)
}

// 获取任务状态类型
const getTaskStatusType = (status) => {
  const map = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return map[status] || 'info'
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

<style scoped lang="scss">
.data-audit-dashboard {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats-card {
  margin-bottom: 20px;
}

.stats-row {
  margin-top: 10px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 8px;

  &.text-success {
    color: #67c23a;
  }

  &.text-warning {
    color: #e6a23c;
  }

  &.text-danger {
    color: #f56c6c;
  }
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

.latest-task-card {
  margin-bottom: 20px;
}

.function-cards {
  margin-top: 20px;
}

.function-card {
  cursor: pointer;
  text-align: center;
  padding: 30px 20px;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-5px);
  }
}

.function-icon {
  color: #409eff;
  margin-bottom: 15px;
}

.function-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #303133;
}

.function-desc {
  font-size: 14px;
  color: #909399;
}
</style>
