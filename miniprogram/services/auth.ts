// 登录认证服务
import { request } from '../utils/request';

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_info: UserInfo;
}

export async function login(
  code: string,
  profile?: { nickname?: string; avatarUrl?: string },
): Promise<LoginResult> {
  const payload: Record<string, string> = { code };
  if (profile?.nickname) payload.nickname = profile.nickname;
  if (profile?.avatarUrl) payload.avatar_url = profile.avatarUrl;

  const data = await request<LoginResult>({
    url: '/auth/login',
    method: 'POST',
    data: payload,
    auth: false,
  });

  // 存储令牌
  const app = getApp<IAppOption>();
  app.setToken(data.access_token, data.refresh_token);
  return data;
}
