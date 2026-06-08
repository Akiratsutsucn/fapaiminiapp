import http from '@/utils/request'

export interface CrawlerStatus {
  is_running: boolean
  last_run_at: string | null
  last_run_result: string | null
  next_scheduled_at: string | null
  [key: string]: any
}

export interface CookieStatus {
  configured: boolean
  preview: string
}

export interface CookiesStatusResponse {
  taobao: CookieStatus
  jd: CookieStatus
  gpai: CookieStatus
}

export function getCrawlerStatus() {
  return http.get<CrawlerStatus>('/crawler/status').then(r => r.data)
}

export function listCrawlerTasks() {
  return http.get('/crawler/tasks').then(r => r.data)
}

export function triggerCrawler(body: { platform?: string } = {}) {
  return http.post('/crawler/trigger', body).then(r => r.data)
}

export function getCookiesStatus() {
  return http.get<CookiesStatusResponse>('/crawler/cookies').then(r => r.data)
}

export function updateCookie(platform: string, cookie: string) {
  return http.post('/crawler/cookies', { platform, cookie }).then(r => r.data)
}

export interface TaskDetailCell {
  success_count: number
  new_count: number
  updated_count: number
  failed_count: number
  error_message?: string | null
}

export interface TaskDetailGrid {
  [platform: string]: {
    [city: string]: TaskDetailCell
  }
}

export function getTaskDetails(taskId: number) {
  return http.get<TaskDetailGrid>(`/crawler/tasks/${taskId}/details`).then(r => r.data)
}
