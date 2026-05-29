// 文章服务
import { request } from '../utils/request';

export async function getArticles(page: number = 1, pageSize: number = 20): Promise<PaginatedResponse<ArticleItem>> {
  return request<PaginatedResponse<ArticleItem>>({
    url: `/articles?page=${page}&page_size=${pageSize}`,
  });
}

export async function getRecommendedArticles(limit: number = 5): Promise<ArticleItem[]> {
  return request<ArticleItem[]>({ url: `/articles/recommend?limit=${limit}` });
}

export async function getArticleDetail(id: number): Promise<ArticleItem> {
  return request<ArticleItem>({ url: `/articles/${id}` });
}
