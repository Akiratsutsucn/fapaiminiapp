import http from '@/utils/request';
export function getSettings() {
    return http.get('/settings').then(r => r.data);
}
export function updateSettings(data) {
    return http.put('/settings', data).then(r => r.data);
}
export function listCities() {
    return http.get('/settings/cities').then(r => r.data);
}
export function addCity(data) {
    return http.post('/settings/cities', data).then(r => r.data);
}
