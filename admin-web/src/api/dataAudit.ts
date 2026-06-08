import http from '@/utils/request'

export interface AuditExecution {
  id: number
  execution_time: string
  total_rules: number
  total_violations: number
  cleaned_count: number
  fixed_count: number
  status: string
}

export interface AuditExecutionDetail {
  id: number
  execution_time: string
  rules_applied: AuditRuleApplied[]
  properties_checked: number
  properties_deleted: number
  properties_fixed: number
  violations_found: Record<string, number>
  detailed_actions: string[]
  action_statistics: {
    deleted_count: number
    fixed_count: number
    flagged_count: number
  }
  execution_duration: number
  status: string
  error_message?: string
  created_at: string
}

export interface AuditRuleApplied {
  rule_id: number
  rule_name: string
  rule_code: string
  enabled: boolean
  action: string
}

export interface AuditStatsResponse {
  recent_7_days: AuditDailyStat[]
  recent_30_days: AuditDailyStat[]
}

export interface AuditDailyStat {
  id: number
  execution_time: string
  total_violations: number
  cleaned_count: number
  fixed_count: number
}

export function listAuditExecutions(params?: { page?: number; page_size?: number; days?: number }) {
  return http.get<{ items: AuditExecution[]; total: number }>('/data-audit/executions', { params }).then(r => r.data)
}

export function getAuditExecutionDetail(id: number) {
  return http.get<AuditExecutionDetail>(`/data-audit/executions/${id}`).then(r => r.data)
}

export function getAuditStats() {
  return http.get<AuditStatsResponse>('/data-audit/executions/stats/summary').then(r => r.data)
}
