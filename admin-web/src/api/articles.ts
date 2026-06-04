import http from '@/utils/request'

export interface ArticleListParams {
  page?: number
  page_size?: number
  keyword?: string
}

export function listArticles(params: ArticleListParams = {}) {
  return http.get('/articles', { params }).then(r => r.data)
}

export function createArticle(data: Record<string, any>) {
  return http.post('/articles', data).then(r => r.data)
}

export function updateArticle(id: number, data: Record<string, any>) {
  return http.put(`/articles/${id}`, data).then(r => r.data)
}

export function deleteArticle(id: number) {
  return http.delete(`/articles/${id}`).then(r => r.data)
}

export function syncArticlesFromMp(limit = 40) {
  return http.post('/articles/sync-from-mp', { limit }).then(r => r.data)
}

export function importArticleFromUrl(urls: string) {
  return http.post('/articles/import-from-url', { urls }).then(r => r.data)
}

export function refetchArticleContent(id: number) {
  return http.post(`/articles/${id}/refetch-content`).then(r => r.data)
}
