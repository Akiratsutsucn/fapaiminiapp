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
export function getCookiesStatus() {
    return http.get('/crawler/cookies').then(r => r.data);
}
export function updateCookie(platform, cookie) {
    return http.post('/crawler/cookies', { platform, cookie }).then(r => r.data);
}
export function getTaskDetails(taskId) {
    return http.get(`/crawler/tasks/${taskId}/details`).then(r => r.data);
}
