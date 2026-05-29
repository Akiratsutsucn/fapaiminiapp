// 用户服务
import { request } from '../utils/request';

export async function getUserProfile(): Promise<UserInfo> {
  return request<UserInfo>({ url: '/user/profile' });
}

export async function updateUserProfile(data: Partial<UserInfo>): Promise<UserInfo> {
  return request<UserInfo>({ url: '/user/profile', method: 'PUT', data });
}

export async function getUserStats(): Promise<{
  favorite_count: number;
  participated_count: number;
  won_count: number;
}> {
  return request({ url: '/user/stats' });
}

export async function getFavorites(type?: string, page: number = 1, pageSize: number = 20) {
  let url = `/user/favorites?page=${page}&page_size=${pageSize}`;
  if (type) url += `&favorite_type=${type}`;
  return request<{ items: any[]; total: number }>({ url });
}

export async function addFavorite(favoriteType: string, targetId: number) {
  return request({
    url: `/user/favorites?favorite_type=${favoriteType}&target_id=${targetId}`,
    method: 'POST',
  });
}

export async function removeFavorite(id: number) {
  return request({ url: `/user/favorites/${id}`, method: 'DELETE' });
}

export async function getBrowseHistory(page: number = 1, pageSize: number = 20) {
  return request<{ items: any[]; total: number }>({
    url: `/user/browse-history?page=${page}&page_size=${pageSize}`,
  });
}
