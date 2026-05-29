import http from '@/utils/request'

export interface CrawlerStatus {
  is_running: boolean
  last_run_at: string | null
  last_run_result: string | null
  next_scheduled_at: string | null
  [key: string]: any
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
