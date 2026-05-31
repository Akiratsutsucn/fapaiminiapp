import http from '@/utils/request';
export function listArticles(params = {}) {
    return http.get('/articles', { params }).then(r => r.data);
}
export function createArticle(data) {
    return http.post('/articles', data).then(r => r.data);
}
export function updateArticle(id, data) {
    return http.put(`/articles/${id}`, data).then(r => r.data);
}
export function deleteArticle(id) {
    return http.delete(`/articles/${id}`).then(r => r.data);
}
export function syncArticlesFromMp(limit = 40) {
    return http.post('/articles/sync-from-mp', { limit }).then(r => r.data);
}
