// 代理商服务
import { request } from '../utils/request';

export interface InviteUser {
  id: number;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
}

export interface PosterInfo {
  qr_url: string;
  agent_nickname: string;
  share_link: string;
}

export async function getInviteList() {
  return request<InviteUser[]>({ url: '/agent/invite-list', method: 'GET' });
}

export async function getPoster() {
  return request<PosterInfo>({ url: '/agent/poster', method: 'GET' });
}
