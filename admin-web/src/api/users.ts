import http from '@/utils/request'

export interface UserListParams {
  page?: number
  page_size?: number
  keyword?: string
  role?: string
  phone?: string
  inviter?: string
}

export interface UserItem {
  id: number
  nickname: string
  avatar_url: string | null
  phone: string | null
  role: string
  city_id: number
  inviter_id: number | null
  created_at: string
}

export interface PaginatedUsers {
  items: UserItem[]
  total: number
  page: number
  page_size: number
}

export interface UserCreate {
  nickname: string
  phone?: string
  password?: string
  role?: string
  city_id?: number
}

export interface UserUpdate {
  nickname?: string
  phone?: string
  role?: string
  city_id?: number
}

export function listUsers(params: UserListParams = {}) {
  return http.get<PaginatedUsers>('/users', { params }).then(r => r.data)
}

export function createUser(data: UserCreate) {
  return http.post('/users', data).then(r => r.data)
}

export function updateUser(id: number, data: UserUpdate) {
  return http.put(`/users/${id}`, data).then(r => r.data)
}

export function deleteUser(id: number) {
  return http.delete(`/users/${id}`).then(r => r.data)
}

export function updateUserRole(id: number, role: string) {
  return http.put(`/users/${id}/role`, { role }).then(r => r.data)
}

export function resetUserPassword(id: number, password: string) {
  return http.post(`/users/${id}/reset-password`, { password }).then(r => r.data)
}
