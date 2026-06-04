import http from '@/utils/request';
export function listProperties(params = {}) {
    return http.get('/properties', { params }).then(r => r.data);
}
export function getProperty(id) {
    return http.get(`/properties/${id}`).then(r => r.data);
}
export function createProperty(data) {
    return http.post('/properties', data).then(r => r.data);
}
export function updateProperty(id, data) {
    return http.put(`/properties/${id}`, data).then(r => r.data);
}
export function deleteProperty(id) {
    return http.delete(`/properties/${id}`).then(r => r.data);
}
export function toggleImageHidden(imageId) {
    return http.post(`/properties/images/${imageId}/toggle-hidden`).then(r => r.data);
}
export function exportProperties(params = {}) {
    return http.get('/properties/export', { params, responseType: 'blob' });
}
export function getPropertyCommunity(id) {
    return http.get(`/properties/${id}/community`).then(r => r.data);
}
export function refreshPropertyCommunity(id) {
    // 抓取最长 30s
    return http.post(`/properties/${id}/refresh-community`, undefined, { timeout: 60000 }).then(r => r.data);
}
