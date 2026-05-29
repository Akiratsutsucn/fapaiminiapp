import http from '@/utils/request'

export interface AdminLoginResp {
  access_token: string
  refresh_token?: string
  user_info: { id: number; nickname: string; role: string }
}

export function adminLogin(username: string, password: string) {
  return http.post<AdminLoginResp>('/auth/login', { username, password }).then(r => r.data)
}
