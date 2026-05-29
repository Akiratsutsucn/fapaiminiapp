import http from '@/utils/request';
export function listCommunities(params = {}) {
    return http.get('/communities', { params }).then(r => r.data);
}
export function createCommunity(data) {
    return http.post('/communities', data).then(r => r.data);
}
export function updateCommunity(id, data) {
    return http.put(`/communities/${id}`, data).then(r => r.data);
}
export function deleteCommunity(id) {
    return http.delete(`/communities/${id}`).then(r => r.data);
}
export function batchImportCommunities(communities) {
    return http.post('/communities/batch-import', { communities }).then(r => r.data);
}
