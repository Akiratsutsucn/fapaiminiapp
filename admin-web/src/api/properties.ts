import http from '@/utils/request'
import type { AxiosResponse } from 'axios'

export interface PropertyListParams {
  page?: number
  page_size?: number
  city_id?: number
  district?: string
  price_min?: number
  price_max?: number
  area_min?: number
  area_max?: number
  keyword?: string
  property_type?: string
  auction_status?: string
  auction_round?: string
  sort_by?: string
  sort_order?: string
}

export interface PropertyItem {
  id: number
  title: string
  district: string | null
  auction_platform: string | null
  auction_round: string | null
  auction_status: string | null
  area: number | null
  starting_price: number | null
  appraisal_price: number | null
  auction_start_time: string | null
  cover_image: string | null
  city_id: number
  created_at: string
}

export interface PaginatedProperties {
  items: PropertyItem[]
  total: number
  page: number
  page_size: number
}

export function listProperties(params: PropertyListParams = {}) {
  return http.get<PaginatedProperties>('/properties', { params }).then(r => r.data)
}

export function getProperty(id: number | string) {
  return http.get(`/properties/${id}`).then(r => r.data)
}

export function createProperty(data: Record<string, any>) {
  return http.post('/properties', data).then(r => r.data)
}

export function updateProperty(id: number | string, data: Record<string, any>) {
  return http.put(`/properties/${id}`, data).then(r => r.data)
}

export function deleteProperty(id: number) {
  return http.delete(`/properties/${id}`).then(r => r.data)
}

export function exportProperties(params: Record<string, any> = {}): Promise<AxiosResponse<Blob>> {
  return http.get('/properties/export', { params, responseType: 'blob' })
}

export function getPropertyCommunity(id: number | string) {
  return http.get(`/properties/${id}/community`).then(r => r.data)
}

export function refreshPropertyCommunity(id: number | string) {
  // 抓取最长 30s
  return http.post(`/properties/${id}/refresh-community`, undefined, { timeout: 60000 }).then(r => r.data)
}
