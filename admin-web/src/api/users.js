import http from '@/utils/request';
export function listUsers(params = {}) {
    return http.get('/users', { params }).then(r => r.data);
}
export function createUser(data) {
    return http.post('/users', data).then(r => r.data);
}
export function updateUser(id, data) {
    return http.put(`/users/${id}`, data).then(r => r.data);
}
export function deleteUser(id) {
    return http.delete(`/users/${id}`).then(r => r.data);
}
export function updateUserRole(id, role) {
    return http.put(`/users/${id}/role`, { role }).then(r => r.data);
}
