<!-- 违规记录管理页 -->
<template>
  <div class="audit-violations">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>违规记录管理</span>
        </div>
      </template>

      <!-- 筛选 -->
      <div class="filter-bar">
        <el-input
          v-model="filterTaskId"
          placeholder="任务ID"
          clearable
          style="width: 150px;"
        />
        <el-select v-model="filterStatus" placeholder="处理状态" clearable style="width: 150px; margin-left: 10px;">
          <el-option label="待处理" value="open" />
          <el-option label="已解决" value="resolved" />
          <el-option label="已忽略" value="ignored" />
        </el-select>
        <el-select v-model="filterSeverity" placeholder="严重级别" clearable style="width: 150px; margin-left: 10px;">
          <el-option label="信息" value="info" />
          <el-option label="警告" value="warning" />
          <el-option label="错误" value="error" />
          <el-option label="严重" value="critical" />
        </el-select>
        <el-button type="primary" @click="loadViolations" style="margin-left: 10px;">查询</el-button>
      </div>

      <!-- 违规列表 -->
      <el-table :data="violations" style="margin-top: 20px;" v-loading="loading">
        <el-table-column prop="id" label="记录ID" width="80" />
        <el-table-column prop="task_id" label="任务ID" width="80" />
        <el-table-column prop="property_id" label="房源ID" width="80">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewProperty(row.property_id)">
              {{ row.property_id }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="rule_name" label="违规规则" min-width="150" />
        <el-table-column prop="severity" label="严重级别" width="100">
          <template #default="{ row }">
            <el-tag :type="getSeverityType(row.severity)" size="small">
              {{ getSeverityText(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="违规详情" min-width="250">
          <template #default="{ row }">
            <div style="font-size: 12px;">
              {{ getViolationMessage(row.violation_detail) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="action_taken" label="执行动作" width="100">
          <template #default="{ row }">
            <el-tag :type="getActionType(row.action_taken)" size="small">
              {{ getActionText(row.action_taken) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="处理状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">
              查看详情
            </el-button>
            <el-button
              type="success"
              link
              size="small"
              @click="handleResolve(row)"
              :disabled="row.status !== 'open'"
            >
              标记解决
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end;"
        @size-change="loadViolations"
        @current-change="loadViolations"
      />
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="违规记录详情" width="700px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="记录ID">{{ violationDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="任务ID">{{ violationDetail.task_id }}</el-descriptions-item>
        <el-descriptions-item label="房源ID">
          <el-button type="primary" link size="small" @click="viewProperty(violationDetail.property_id)">
            {{ violationDetail.property_id }}
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item label="规则ID">{{ violationDetail.rule_id }}</el-descriptions-item>
        <el-descriptions-item label="规则代码">{{ violationDetail.rule_code }}</el-descriptions-item>
        <el-descriptions-item label="规则名称">{{ violationDetail.rule_name }}</el-descriptions-item>
        <el-descriptions-item label="严重级别">
          <el-tag :type="getSeverityType(violationDetail.severity)" size="small">
            {{ getSeverityText(violationDetail.severity) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="执行动作">
          <el-tag :type="getActionType(violationDetail.action_taken)" size="small">
            {{ getActionText(violationDetail.action_taken) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="处理状态">
          <el-tag :type="getStatusType(violationDetail.status)" size="small">
            {{ getStatusText(violationDetail.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ violationDetail.created_at }}</el-descriptions-item>
        <el-descriptions-item label="修复时间">{{ violationDetail.fixed_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="修复人">{{ violationDetail.fixed_by || '-' }}</el-descriptions-item>
        <el-descriptions-item label="违规详情" :span="2">
          <pre style="background: #f5f7fa; padding: 10px; border-radius: 4px; max-height: 300px; overflow-y: auto;">{{ JSON.stringify(violationDetail.violation_detail, null, 2) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item v-if="violationDetail.fix_note" label="修复说明" :span="2">
          {{ violationDetail.fix_note }}
        </el-descriptions-item>
      </el-descriptions>

      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button
          type="success"
          @click="handleResolve(violationDetail)"
          :disabled="violationDetail.status !== 'open'"
        >
          标记解决
        </el-button>
      </template>
    </el-dialog>

    <!-- 标记解决对话框 -->
    <el-dialog v-model="resolveDialogVisible" title="标记解决" width="500px">
      <el-form :model="resolveForm" label-width="100px">
        <el-form-item label="处理状态">
          <el-radio-group v-model="resolveForm.status">
            <el-radio label="resolved">已解决</el-radio>
            <el-radio label="ignored">已忽略</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="修复说明">
          <el-input
            v-model="resolveForm.fix_note"
            type="textarea"
            :rows="4"
            placeholder="请输入修复说明或处理备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitResolve" :loading="submitting">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getViolationList, updateViolation } from '@/api/dataAudit'

const router = useRouter()

const loading = ref(false)
const violations = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const filterTaskId = ref('')
const filterStatus = ref('')
const filterSeverity = ref('')

const detailDialogVisible = ref(false)
const violationDetail = ref({})

const resolveDialogVisible = ref(false)
const currentViolationId = ref(null)
const resolveForm = ref({
  status: 'resolved',
  fix_note: ''
})
const submitting = ref(false)

// 加载违规记录列表
const loadViolations = async () => {
  loading.value = true
  try {
    const params = {
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value
    }
    if (filterTaskId.value) params.task_id = parseInt(filterTaskId.value)
    if (filterStatus.value) params.status = filterStatus.value
    if (filterSeverity.value) params.severity = filterSeverity.value

    const res = await getViolationList(params)
    violations.value = res.items
    total.value = res.total
  } catch (error) {
    ElMessage.error('加载违规记录失败')
  } finally {
    loading.value = false
  }
}

// 查看详情
const handleView = (row) => {
  violationDetail.value = row
  detailDialogVisible.value = true
}

// 打开标记解决对话框
const handleResolve = (row) => {
  currentViolationId.value = row.id
  resolveForm.value = {
    status: 'resolved',
    fix_note: ''
  }
  resolveDialogVisible.value = true
}

// 提交标记解决
const submitResolve = async () => {
  submitting.value = true
  try {
    await updateViolation(currentViolationId.value, resolveForm.value)
    ElMessage.success('更新成功')
    resolveDialogVisible.value = false
    detailDialogVisible.value = false
    loadViolations()
  } catch (error) {
    ElMessage.error('更新失败')
  } finally {
    submitting.value = false
  }
}

// 查看房源
const viewProperty = (propertyId) => {
  router.push(`/property/${propertyId}`)
}

// 获取违规详情消息
const getViolationMessage = (detail) => {
  if (!detail) return '-'
  return detail.message || JSON.stringify(detail)
}

// 辅助函数
const getSeverityType = (severity) => {
  const map = {
    info: 'info',
    warning: 'warning',
    error: 'danger',
    critical: 'danger'
  }
  return map[severity] || 'info'
}

const getSeverityText = (severity) => {
  const map = {
    info: '信息',
    warning: '警告',
    error: '错误',
    critical: '严重'
  }
  return map[severity] || severity
}

const getActionType = (action) => {
  const map = {
    flagged: 'warning',
    deleted: 'danger',
    fixed: 'success',
    ignored: 'info'
  }
  return map[action] || 'info'
}

const getActionText = (action) => {
  const map = {
    flagged: '已标记',
    deleted: '已删除',
    fixed: '已修复',
    ignored: '已忽略'
  }
  return map[action] || action
}

const getStatusType = (status) => {
  const map = {
    open: 'warning',
    resolved: 'success',
    ignored: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    open: '待处理',
    resolved: '已解决',
    ignored: '已忽略'
  }
  return map[status] || status
}

onMounted(() => {
  loadViolations()
})
</script>

<style scoped lang="scss">
.audit-violations {
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
