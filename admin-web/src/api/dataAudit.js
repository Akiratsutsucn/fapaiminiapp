/**
 * 数据审核管理API
 */
import request from '@/utils/request'

// ==================== 审核规则 ====================

/**
 * 获取审核规则列表
 */
export function getRuleList(params) {
  return request({
    url: '/api/admin/data-audit/rules',
    method: 'get',
    params
  })
}

/**
 * 获取规则详情
 */
export function getRuleDetail(ruleId) {
  return request({
    url: `/api/admin/data-audit/rules/${ruleId}`,
    method: 'get'
  })
}

/**
 * 创建审核规则
 */
export function createRule(data) {
  return request({
    url: '/api/admin/data-audit/rules',
    method: 'post',
    data
  })
}

/**
 * 更新审核规则
 */
export function updateRule(ruleId, data) {
  return request({
    url: `/api/admin/data-audit/rules/${ruleId}`,
    method: 'put',
    data
  })
}

/**
 * 删除审核规则
 */
export function deleteRule(ruleId) {
  return request({
    url: `/api/admin/data-audit/rules/${ruleId}`,
    method: 'delete'
  })
}

// ==================== 审核任务 ====================

/**
 * 获取审核任务列表
 */
export function getTaskList(params) {
  return request({
    url: '/api/admin/data-audit/tasks',
    method: 'get',
    params
  })
}

/**
 * 获取任务详情
 */
export function getTaskDetail(taskId) {
  return request({
    url: `/api/admin/data-audit/tasks/${taskId}`,
    method: 'get'
  })
}

/**
 * 创建审核任务
 */
export function createTask(data) {
  return request({
    url: '/api/admin/data-audit/tasks',
    method: 'post',
    data
  })
}

// ==================== 违规记录 ====================

/**
 * 获取违规记录列表
 */
export function getViolationList(params) {
  return request({
    url: '/api/admin/data-audit/violations',
    method: 'get',
    params
  })
}

/**
 * 更新违规记录
 */
export function updateViolation(violationId, data) {
  return request({
    url: `/api/admin/data-audit/violations/${violationId}`,
    method: 'put',
    data
  })
}

// ==================== 审核报告 ====================

/**
 * 获取审核报告列表
 */
export function getReportList(params) {
  return request({
    url: '/api/admin/data-audit/reports',
    method: 'get',
    params
  })
}

/**
 * 获取报告详情
 */
export function getReportDetail(reportId) {
  return request({
    url: `/api/admin/data-audit/reports/${reportId}`,
    method: 'get'
  })
}

/**
 * 根据任务ID获取报告
 */
export function getReportByTask(taskId) {
  return request({
    url: `/api/admin/data-audit/reports/task/${taskId}`,
    method: 'get'
  })
}

// ==================== 统计数据 ====================

/**
 * 获取仪表板统计
 */
export function getDashboardStats() {
  return request({
    url: '/api/admin/data-audit/dashboard/stats',
    method: 'get'
  })
}
