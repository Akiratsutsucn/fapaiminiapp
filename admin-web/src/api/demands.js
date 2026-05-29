import http from '@/utils/request';
export function listDemands(params = {}) {
    return http.get('/demands', { params }).then(r => r.data);
}
export function createDemand(data) {
    return http.post('/demands', data).then(r => r.data);
}
export function updateDemand(id, data) {
    return http.put(`/demands/${id}`, data).then(r => r.data);
}
export function deleteDemand(id) {
    return http.delete(`/demands/${id}`).then(r => r.data);
}
