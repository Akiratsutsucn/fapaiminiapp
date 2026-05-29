import http from '@/utils/request'

export function listBanners() {
  return http.get('/banners').then(r => r.data)
}

export function createBanner(data: Record<string, any>) {
  return http.post('/banners', data).then(r => r.data)
}

export function updateBanner(id: number, data: Record<string, any>) {
  return http.put(`/banners/${id}`, data).then(r => r.data)
}

export function deleteBanner(id: number) {
  return http.delete(`/banners/${id}`).then(r => r.data)
}
