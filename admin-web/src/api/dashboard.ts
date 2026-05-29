import http from '@/utils/request'

export interface DashboardData {
  total_properties: number
  today_new: number
  upcoming: number
  finished: number
  total_users: number
  total_agents: number
  pending_demands: number
  assigned_demands: number
  [key: string]: any
}

export function getDashboard(cityId?: number) {
  const params = cityId ? { city_id: cityId } : {}
  return http.get<DashboardData>('/dashboard', { params }).then(r => r.data)
}
