<!-- 审核规则管理页 -->
<template>
  <div class="audit-rules">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>审核规则管理</span>
          <el-button type="primary" size="small" @click="handleCreate">
            新增规则
          </el-button>
        </div>
      </template>

      <!-- 筛选 -->
      <div class="filter-bar">
        <el-select v-model="filterCategory" placeholder="规则分类" clearable style="width: 200px;">
          <el-option label="必填字段检查" value="field_required" />
          <el-option label="字段范围检查" value="field_range" />
          <el-option label="字段格式检查" value="field_format" />
          <el-option label="地区过滤" value="region_filter" />
          <el-option label="房产类型过滤" value="property_type_filter" />
        </el-select>
        <el-select v-model="filterEnabled" placeholder="启用状态" clearable style="width: 150px; margin-left: 10px;">
          <el-option label="已启用" :value="true" />
          <el-option label="已禁用" :value="false" />
        </el-select>
        <el-button type="primary" @click="loadRules" style="margin-left: 10px;">查询</el-button>
      </div>

      <!-- 规则列表 -->
      <el-table :data="rules" style="margin-top: 20px;" v-loading="loading">
        <el-table-column prop="rule_name" label="规则名称" min-width="180" />
        <el-table-column prop="rule_code" label="规则代码" width="200" />
        <el-table-column prop="category" label="分类" width="140">
          <template #default="{ row }">
            <el-tag size="small">{{ getCategoryText(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="严重级别" width="100">
          <template #default="{ row }">
            <el-tag :type="getSeverityType(row.severity)" size="small">
              {{ getSeverityText(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="action" label="执行动作" width="100">
          <template #default="{ row }">
            {{ getActionText(row.action) }}
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="状态" width="80">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              @change="handleToggleEnabled(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="统计" width="150">
          <template #default="{ row }">
            <div style="font-size: 12px;">
              <div>检查: {{ row.total_checked }}</div>
              <div>违规: {{ row.total_violations }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">
              查看
            </el-button>
            <el-button type="primary" link size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="700px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="规则名称" prop="rule_name">
          <el-input v-model="form.rule_name" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="规则代码" prop="rule_code">
          <el-input
            v-model="form.rule_code"
            placeholder="请输入规则唯一标识码"
            :disabled="isEdit"
          />
        </el-form-item>
        <el-form-item label="规则分类" prop="category">
          <el-select v-model="form.category" placeholder="请选择规则分类" style="width: 100%;">
            <el-option label="必填字段检查" value="field_required" />
            <el-option label="字段范围检查" value="field_range" />
            <el-option label="字段格式检查" value="field_format" />
            <el-option label="地区过滤" value="region_filter" />
            <el-option label="房产类型过滤" value="property_type_filter" />
          </el-select>
        </el-form-item>
        <el-form-item label="规则描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入规则描述"
          />
        </el-form-item>
        <el-form-item label="规则配置" prop="config">
          <el-input
            v-model="configJson"
            type="textarea"
            :rows="8"
            placeholder='请输入JSON格式的配置，例如：{"fields": ["starting_price", "deposit"]}'
          />
          <div style="font-size: 12px; color: #909399; margin-top: 5px;">
            配置格式请参考文档或已有规则示例
          </div>
        </el-form-item>
        <el-form-item label="执行动作" prop="action">
          <el-radio-group v-model="form.action">
            <el-radio label="flag">仅标记</el-radio>
            <el-radio label="fix">尝试修复</el-radio>
            <el-radio label="delete">删除数据</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="严重级别" prop="severity">
          <el-radio-group v-model="form.severity">
            <el-radio label="info">信息</el-radio>
            <el-radio label="warning">警告</el-radio>
            <el-radio label="error">错误</el-radio>
            <el-radio label="critical">严重</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="自动修复">
          <el-switch v-model="form.auto_fix" />
          <div style="font-size: 12px; color: #909399; margin-top: 5px;">
            仅当执行动作为"尝试修复"时生效
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 查看详情对话框 -->
    <el-dialog v-model="viewDialogVisible" title="规则详情" width="700px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="规则名称">{{ viewRule.rule_name }}</el-descriptions-item>
        <el-descriptions-item label="规则代码">{{ viewRule.rule_code }}</el-descriptions-item>
        <el-descriptions-item label="规则分类">{{ getCategoryText(viewRule.category) }}</el-descriptions-item>
        <el-descriptions-item label="严重级别">
          <el-tag :type="getSeverityType(viewRule.severity)" size="small">
            {{ getSeverityText(viewRule.severity) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="执行动作">{{ getActionText(viewRule.action) }}</el-descriptions-item>
        <el-descriptions-item label="启用状态">
          <el-tag :type="viewRule.enabled ? 'success' : 'info'" size="small">
            {{ viewRule.enabled ? '已启用' : '已禁用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="自动修复">
          {{ viewRule.auto_fix ? '是' : '否' }}
        </el-descriptions-item>
        <el-descriptions-item label="累计检查次数">{{ viewRule.total_checked }}</el-descriptions-item>
        <el-descriptions-item label="累计违规次数">{{ viewRule.total_violations }}</el-descriptions-item>
        <el-descriptions-item label="最后执行时间">
          {{ viewRule.last_executed_at || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="规则描述" :span="2">
          {{ viewRule.description || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="规则配置" :span="2">
          <pre style="background: #f5f7fa; padding: 10px; border-radius: 4px;">{{ JSON.stringify(viewRule.config, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRuleList, createRule, updateRule, deleteRule, getRuleDetail } from '@/api/dataAudit'

const loading = ref(false)
const rules = ref([])
const filterCategory = ref('')
const filterEnabled = ref(null)

const dialogVisible = ref(false)
const dialogTitle = computed(() => isEdit.value ? '编辑规则' : '新增规则')
const isEdit = ref(false)
const currentRuleId = ref(null)
const submitting = ref(false)

const formRef = ref(null)
const form = ref({
  rule_name: '',
  rule_code: '',
  category: '',
  description: '',
  config: {},
  action: 'flag',
  severity: 'warning',
  enabled: true,
  auto_fix: false
})

const configJson = ref('')

const formRules = {
  rule_name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  rule_code: [{ required: true, message: '请输入规则代码', trigger: 'blur' }],
  category: [{ required: true, message: '请选择规则分类', trigger: 'change' }],
  action: [{ required: true, message: '请选择执行动作', trigger: 'change' }],
  severity: [{ required: true, message: '请选择严重级别', trigger: 'change' }]
}

const viewDialogVisible = ref(false)
const viewRule = ref({})

// 加载规则列表
const loadRules = async () => {
  loading.value = true
  try {
    const params = {}
    if (filterCategory.value) params.category = filterCategory.value
    if (filterEnabled.value !== null) params.enabled = filterEnabled.value

    const res = await getRuleList(params)
    rules.value = res
  } catch (error) {
    ElMessage.error('加载规则列表失败')
  } finally {
    loading.value = false
  }
}

// 新增规则
const handleCreate = () => {
  isEdit.value = false
  currentRuleId.value = null
  form.value = {
    rule_name: '',
    rule_code: '',
    category: '',
    description: '',
    config: {},
    action: 'flag',
    severity: 'warning',
    enabled: true,
    auto_fix: false
  }
  configJson.value = ''
  dialogVisible.value = true
}

// 编辑规则
const handleEdit = (row) => {
  isEdit.value = true
  currentRuleId.value = row.id
  form.value = {
    rule_name: row.rule_name,
    rule_code: row.rule_code,
    category: row.category,
    description: row.description,
    config: row.config,
    action: row.action,
    severity: row.severity,
    enabled: row.enabled,
    auto_fix: row.auto_fix
  }
  configJson.value = JSON.stringify(row.config, null, 2)
  dialogVisible.value = true
}

// 查看规则
const handleView = async (row) => {
  try {
    const res = await getRuleDetail(row.id)
    viewRule.value = res
    viewDialogVisible.value = true
  } catch (error) {
    ElMessage.error('加载规则详情失败')
  }
}

// 删除规则
const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除规则"${row.rule_name}"吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteRule(row.id)
      ElMessage.success('删除成功')
      loadRules()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// 切换启用状态
const handleToggleEnabled = async (row) => {
  try {
    await updateRule(row.id, { enabled: row.enabled })
    ElMessage.success('更新成功')
  } catch (error) {
    ElMessage.error('更新失败')
    row.enabled = !row.enabled // 回滚
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    // 解析配置JSON
    try {
      form.value.config = JSON.parse(configJson.value)
    } catch (error) {
      ElMessage.error('规则配置格式错误，请输入有效的JSON')
      return
    }

    submitting.value = true
    try {
      if (isEdit.value) {
        await updateRule(currentRuleId.value, form.value)
        ElMessage.success('更新成功')
      } else {
        await createRule(form.value)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      loadRules()
    } catch (error) {
      ElMessage.error(isEdit.value ? '更新失败' : '创建失败')
    } finally {
      submitting.value = false
    }
  })
}

// 辅助函数
const getCategoryText = (category) => {
  const map = {
    field_required: '必填字段检查',
    field_range: '字段范围检查',
    field_format: '字段格式检查',
    region_filter: '地区过滤',
    property_type_filter: '房产类型过滤'
  }
  return map[category] || category
}

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

const getActionText = (action) => {
  const map = {
    flag: '仅标记',
    fix: '尝试修复',
    delete: '删除数据'
  }
  return map[action] || action
}

onMounted(() => {
  loadRules()
})
</script>

<style scoped lang="scss">
.audit-rules {
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
