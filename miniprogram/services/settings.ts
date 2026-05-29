import { request } from '../utils/request';

export async function getSettings(): Promise<Record<string, string>> {
  return request<Record<string, string>>({ url: '/settings' });
}
