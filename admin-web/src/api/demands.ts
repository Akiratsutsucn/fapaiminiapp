import http from '@/utils/request'

export interface DemandListParams {
  page?: number
  page_size?: number
  phone?: string
  target_district?: string
  status?: string
}

export interface DemandUpdate {
  agent_wechat?: string
  status?: string
  remark?: string
}

export function listDemands(params: DemandListParams = {}) {
  return http.get('/demands', { params }).then(r => r.data)
}

export function createDemand(data: Record<string, any>) {
  return http.post('/demands', data).then(r => r.data)
}

export function updateDemand(id: number, data: DemandUpdate) {
  return http.put(`/demands/${id}`, data).then(r => r.data)
}

export function deleteDemand(id: number) {
  return http.delete(`/demands/${id}`).then(r => r.data)
}
