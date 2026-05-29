import http from '@/utils/request';
export function getCrawlerStatus() {
    return http.get('/crawler/status').then(r => r.data);
}
export function listCrawlerTasks() {
    return http.get('/crawler/tasks').then(r => r.data);
}
export function triggerCrawler(body = {}) {
    return http.post('/crawler/trigger', body).then(r => r.data);
}
