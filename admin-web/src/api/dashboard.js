import http from '@/utils/request';
export function getDashboard(cityId) {
    const params = cityId ? { city_id: cityId } : {};
    return http.get('/dashboard', { params }).then(r => r.data);
}
