import http from '@/utils/request'

export function getSettings() {
  return http.get('/settings').then(r => r.data)
}

export function updateSettings(data: Record<string, any>) {
  return http.put('/settings', data).then(r => r.data)
}

export function listCities() {
  return http.get('/settings/cities').then(r => r.data)
}

export function addCity(data: { city_id: number; city_name: string }) {
  return http.post('/settings/cities', data).then(r => r.data)
}
