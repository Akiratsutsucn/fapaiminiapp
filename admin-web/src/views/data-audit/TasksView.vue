<!-- 审核任务管理页 -->
<template>
  <div class="audit-tasks">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>审核任务管理</span>
        </div>
      </template>

      <!-- 筛选 -->
      <div class="filter-bar">
        <el-select v-model="filterStatus" placeholder="任务状态" clearable style="width: 150px;">
          <el-option label="待执行" value="pending" />
          <el-option label="执行中" value="running" />
          <el-option label="已完成" value="completed" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-button type="primary" @click="loadTasks" style="margin-left: 10px;">查询</el-button>
        <el-button @click="loadTasks" style="margin-left: 10px;">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>

      <!-- 任务列表 -->
      <el-table :data="tasks" style="margin-top: 20px;" v-loading="loading">
        <el-table-column prop="id" label="任务ID" width="80" />
        <el-table-column prop="task_name" label="任务名称" min-width="200" />
        <el-table-column prop="task_type" label="任务类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.task_type === 'scheduled' ? 'success' : 'info'">
              {{ row.task_type === 'scheduled' ? '定时任务' : '手动执行' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="150">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.round(row.progress)"
              :status="row.status === 'failed' ? 'exception' : (row.status === 'completed' ? 'success' : '')"
            />
          </template>
        </el-table-column>
        <el-table-column label="统计" width="200">
          <template #default="{ row }">
            <div style="font-size: 12px;">
              <div>总数: {{ row.total_records }} | 通过: {{ row.passed_count }}</div>
              <div>
                标记: {{ row.flagged_count }} |
                修复: {{ row.fixed_count }} |
                删除: {{ row.deleted_count }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="duration_seconds" label="耗时" width="100">
          <template #default="{ row }">
            {{ row.duration_seconds ? formatDuration(row.duration_seconds) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleViewDetail(row)">
              查看详情
            </el-button>
            <el-button
              type="success"
              link
              size="small"
              @click="handleViewReport(row)"
              :disabled="row.status !== 'completed'"
            >
              查看报告
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 任务详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="任务详情" width="800px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="任务ID">{{ taskDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="任务名称">{{ taskDetail.task_name }}</el-descriptions-item>
        <el-descriptions-item label="任务类型">
          <el-tag size="small" :type="taskDetail.task_type === 'scheduled' ? 'success' : 'info'">
            {{ taskDetail.task_type === 'scheduled' ? '定时任务' : '手动执行' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="任务状态">
          <el-tag :type="getStatusType(taskDetail.status)" size="small">
            {{ getStatusText(taskDetail.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="执行进度">
          <el-progress :percentage="Math.round(taskDetail.progress)" />
        </el-descriptions-item>
        <el-descriptions-item label="执行耗时">
          {{ taskDetail.duration_seconds ? formatDuration(taskDetail.duration_seconds) : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="总检查记录数">{{ taskDetail.total_records }}</el-descriptions-item>
        <el-descriptions-item label="通过数量">
          <el-tag type="success" size="small">{{ taskDetail.passed_count }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="标记数量">
          <el-tag type="warning" size="small">{{ taskDetail.flagged_count }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="修复数量">
          <el-tag type="info" size="small">{{ taskDetail.fixed_count }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="删除数量">
          <el-tag type="danger" size="small">{{ taskDetail.deleted_count }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ taskDetail.created_at }}</el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ taskDetail.started_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="完成时间">{{ taskDetail.completed_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="使用规则" :span="2">
          <el-tag v-for="ruleId in taskDetail.rule_ids" :key="ruleId" size="small" style="margin-right: 5px;">
            规则ID: {{ ruleId }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="审核范围" :span="2">
          <pre v-if="taskDetail.scope" style="background: #f5f7fa; padding: 10px; border-radius: 4px;">{{ JSON.stringify(taskDetail.scope, null, 2) }}</pre>
          <span v-else>全部数据</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="taskDetail.error_message" label="错误信息" :span="2">
          <div style="color: #f56c6c;">{{ taskDetail.error_message }}</div>
        </el-descriptions-item>
      </el-descriptions>

      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button
          type="primary"
          @click="handleViewReport(taskDetail)"
          :disabled="taskDetail.status !== 'completed'"
        >
          查看报告
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getTaskList, getTaskDetail } from '@/api/dataAudit'

const router = useRouter()

const loading = ref(false)
const tasks = ref([])
const filterStatus = ref('')

const detailDialogVisible = ref(false)
const taskDetail = ref({
  id: null,
  task_name: '',
  task_type: '',
  status: '',
  progress: 0,
  total_records: 0,
  passed_count: 0,
  flagged_count: 0,
  fixed_count: 0,
  deleted_count: 0,
  rule_ids: [],
  scope: null,
  created_at: '',
  started_at: '',
  completed_at: '',
  duration_seconds: null,
  error_message: ''
})

// 加载任务列表
const loadTasks = async () => {
  loading.value = true
  try {
    const params = { limit: 100 }
    if (filterStatus.value) params.status = filterStatus.value

    const res = await getTaskList(params)
    tasks.value = res
  } catch (error) {
    ElMessage.error('加载任务列表失败')
  } finally {
    loading.value = false
  }
}

// 查看详情
const handleViewDetail = async (row) => {
  try {
    const res = await getTaskDetail(row.id)
    taskDetail.value = res
    detailDialogVisible.value = true
  } catch (error) {
    ElMessage.error('加载任务详情失败')
  }
}

// 查看报告
const handleViewReport = (row) => {
  router.push(`/data-audit/reports/${row.id}`)
}

// 辅助函数
const getStatusType = (status) => {
  const map = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待执行',
    running: '执行中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  return `${minutes}分${remainSeconds}秒`
}

onMounted(() => {
  loadTasks()

  // 如果有running状态的任务，定时刷新
  const interval = setInterval(() => {
    const hasRunning = tasks.value.some(t => t.status === 'running')
    if (hasRunning) {
      loadTasks()
    }
  }, 10000) // 每10秒刷新一次

  // 组件卸载时清除定时器
  onBeforeUnmount(() => {
    clearInterval(interval)
  })
})
</script>

<script>
import { onBeforeUnmount } from 'vue'
</script>

<style scoped lang="scss">
.audit-tasks {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-bar {
  display: flex;
  align-items: center;
}
</style>
