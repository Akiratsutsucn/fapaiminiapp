import http from '@/utils/request';
export function listAuditExecutions(params) {
    return http.get('/data-audit/executions', { params }).then(r => r.data);
}
export function getAuditExecutionDetail(id) {
    return http.get(`/data-audit/executions/${id}`).then(r => r.data);
}
export function getAuditStats() {
    return http.get('/data-audit/executions/stats/summary').then(r => r.data);
}
