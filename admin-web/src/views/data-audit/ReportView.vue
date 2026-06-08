<!-- 审核报告详情页 -->
<template>
  <div class="audit-report">
    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>审核报告详情</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>

      <div v-if="report.id">
        <!-- 报告基本信息 -->
        <el-descriptions :column="3" border>
          <el-descriptions-item label="报告ID">{{ report.id }}</el-descriptions-item>
          <el-descriptions-item label="任务ID">{{ report.task_id }}</el-descriptions-item>
          <el-descriptions-item label="报告日期">{{ report.report_date }}</el-descriptions-item>
          <el-descriptions-item label="数据质量评分" :span="3">
            <div style="display: flex; align-items: center;">
              <el-progress
                type="circle"
                :percentage="Math.round(report.quality_score)"
                :color="getScoreColor(report.quality_score)"
                :width="100"
              />
              <div style="margin-left: 20px; font-size: 14px; color: #606266;">
                <div>评分: <span :style="{ color: getScoreColor(report.quality_score), fontSize: '24px', fontWeight: 'bold' }">{{ report.quality_score.toFixed(1) }}</span></div>
                <div style="margin-top: 5px;">{{ getScoreLevel(report.quality_score) }}</div>
              </div>
            </div>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 总体统计 -->
        <el-divider content-position="left">总体统计</el-divider>
        <el-row :gutter="20">
          <el-col :span="6">
            <div class="stat-card">
              <div class="stat-value">{{ report.summary.total_checked }}</div>
              <div class="stat-label">总检查数</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card success">
              <div class="stat-value">{{ report.summary.total_passed }}</div>
              <div class="stat-label">通过数</div>
              <div class="stat-rate">{{ report.summary.pass_rate }}%</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card warning">
              <div class="stat-value">{{ report.summary.total_violations }}</div>
              <div class="stat-label">违规数</div>
              <div class="stat-rate">{{ report.summary.violation_rate }}%</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card info">
              <div class="stat-value">{{ report.quality_score.toFixed(1) }}</div>
              <div class="stat-label">质量评分</div>
            </div>
          </el-col>
        </el-row>

        <!-- Top违规规则 -->
        <el-divider content-position="left">Top违规规则</el-divider>
        <el-table :data="report.summary.top_violations" border>
          <el-table-column type="index" label="排名" width="80" />
          <el-table-column prop="rule_name" label="规则名称" min-width="200" />
          <el-table-column prop="rule" label="规则代码" width="200" />
          <el-table-column prop="count" label="违规次数" width="120">
            <template #default="{ row }">
              <el-tag type="danger">{{ row.count }}</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <!-- 规则统计 -->
        <el-divider content-position="left">规则统计</el-divider>
        <el-table :data="report.rule_statistics" border>
          <el-table-column prop="rule_name" label="规则名称" min-width="200" />
          <el-table-column prop="rule_code" label="规则代码" width="200" />
          <el-table-column prop="checked" label="检查数" width="120" />
          <el-table-column prop="violations" label="违规数" width="120">
            <template #default="{ row }">
              <el-tag :type="row.violations > 0 ? 'warning' : 'success'">
                {{ row.violations }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="violation_rate" label="违规率" width="120">
            <template #default="{ row }">
              {{ row.violation_rate }}%
            </template>
          </el-table-column>
          <el-table-column label="违规率可视化" min-width="200">
            <template #default="{ row }">
              <el-progress
                :percentage="row.violation_rate"
                :color="getViolationRateColor(row.violation_rate)"
              />
            </template>
          </el-table-column>
        </el-table>

        <!-- 平台统计 -->
        <el-divider content-position="left" v-if="report.platform_statistics && Object.keys(report.platform_statistics).length > 0">
          平台统计
        </el-divider>
        <el-row :gutter="20" v-if="report.platform_statistics && Object.keys(report.platform_statistics).length > 0">
          <el-col :span="8" v-for="(stats, platform) in report.platform_statistics" :key="platform">
            <el-card shadow="hover">
              <div style="text-align: center;">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">{{ platform }}</div>
                <div style="font-size: 14px; color: #606266;">
                  <div>检查数: {{ stats.checked }}</div>
                  <div style="margin-top: 5px;">违规数: <el-tag type="warning" size="small">{{ stats.violations }}</el-tag></div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 城市统计 -->
        <el-divider content-position="left" v-if="report.city_statistics && Object.keys(report.city_statistics).length > 0">
          城市统计
        </el-divider>
        <el-row :gutter="20" v-if="report.city_statistics && Object.keys(report.city_statistics).length > 0">
          <el-col :span="8" v-for="(stats, city) in report.city_statistics" :key="city">
            <el-card shadow="hover">
              <div style="text-align: center;">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">{{ city }}</div>
                <div style="font-size: 14px; color: #606266;">
                  <div>检查数: {{ stats.checked }}</div>
                  <div style="margin-top: 5px;">违规数: <el-tag type="warning" size="small">{{ stats.violations }}</el-tag></div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <el-empty v-else description="暂无报告数据" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getReportByTask } from '@/api/dataAudit'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const report = ref({
  id: null,
  task_id: null,
  report_date: '',
  summary: {
    total_checked: 0,
    total_passed: 0,
    total_violations: 0,
    pass_rate: 0,
    violation_rate: 0,
    top_violations: []
  },
  rule_statistics: [],
  platform_statistics: {},
  city_statistics: {},
  quality_score: 0,
  trend_comparison: null
})

const loadReport = async () => {
  loading.value = true
  try {
    const taskId = route.params.taskId
    const res = await getReportByTask(taskId)
    report.value = res
  } catch (error) {
    ElMessage.error('加载报告失败')
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.back()
}

const getScoreColor = (score) => {
  if (score >= 90) return '#67c23a'
  if (score >= 70) return '#e6a23c'
  return '#f56c6c'
}

const getScoreLevel = (score) => {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '中等'
  if (score >= 60) return '及格'
  return '需改进'
}

const getViolationRateColor = (rate) => {
  if (rate < 5) return '#67c23a'
  if (rate < 15) return '#e6a23c'
  return '#f56c6c'
}

onMounted(() => {
  loadReport()
})
</script>

<style scoped lang="scss">
.audit-report {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-card {
  background: #f5f7fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  border-left: 4px solid #409eff;

  &.success {
    border-left-color: #67c23a;
    background: #f0f9ff;
  }

  &.warning {
    border-left-color: #e6a23c;
    background: #fef0e6;
  }

  &.info {
    border-left-color: #909399;
    background: #f4f4f5;
  }

  .stat-value {
    font-size: 32px;
    font-weight: bold;
    color: #303133;
    margin-bottom: 8px;
  }

  .stat-label {
    font-size: 14px;
    color: #606266;
    margin-bottom: 4px;
  }

  .stat-rate {
    font-size: 12px;
    color: #909399;
  }
}

.el-divider {
  margin: 30px 0 20px 0;
}
</style>
