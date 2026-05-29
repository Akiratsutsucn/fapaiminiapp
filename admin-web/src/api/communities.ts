import http from '@/utils/request'

export interface CommunityListParams {
  page?: number
  page_size?: number
  keyword?: string
  city_id?: number
  district?: string
}

export function listCommunities(params: CommunityListParams = {}) {
  return http.get('/communities', { params }).then(r => r.data)
}

export function createCommunity(data: Record<string, any>) {
  return http.post('/communities', data).then(r => r.data)
}

export function updateCommunity(id: number, data: Record<string, any>) {
  return http.put(`/communities/${id}`, data).then(r => r.data)
}

export function deleteCommunity(id: number) {
  return http.delete(`/communities/${id}`).then(r => r.data)
}

export function batchImportCommunities(communities: Record<string, any>[]) {
  return http.post('/communities/batch-import', { communities }).then(r => r.data)
}
