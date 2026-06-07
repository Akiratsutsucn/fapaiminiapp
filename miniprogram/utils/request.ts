// 封装 wx.request，支持 JWT 自动续期
// 域名已备案通过 + HTTPS 证书有效，使用 https 域名（小程序要求 https）
const BASE_URL = 'https://xcxapi.fapaizhelianmeng.cn/api/v1';

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
  auth?: boolean;
  showLoading?: boolean;
}

// 请求队列: 令牌刷新期间暂存请求
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

function getAppToken(): string {
  const app = getApp<IAppOption>();
  return app.globalData.token || wx.getStorageSync('access_token') || '';
}

function getRefreshToken(): string {
  const app = getApp<IAppOption>();
  return app.globalData.refreshToken || wx.getStorageSync('refresh_token') || '';
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('无刷新令牌');
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}/auth/refresh`,
      method: 'POST',
      data: { refresh_token: refreshToken },
      success(res: any) {
        if (res.statusCode === 200 && res.data?.access_token) {
          const newToken = res.data.access_token;
          const newRefreshToken = res.data.refresh_token || refreshToken;
          const app = getApp<IAppOption>();
          app.setToken(newToken, newRefreshToken);
          resolve(newToken);
        } else {
          const app = getApp<IAppOption>();
          app.clearToken();
          reject(new Error('令牌刷新失败'));
        }
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

export function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, auth = true, showLoading = false } = options;

  if (showLoading) {
    wx.showLoading({ title: '加载中...', mask: true });
  }

  return new Promise((resolve, reject) => {
    const doRequest = (token: string, retriesLeft = 2) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...header };
      if (auth && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

      wx.request({
        url: fullUrl,
        method,
        data,
        header: headers,
        timeout: 15000,
        success(res: any) {
          if (showLoading) wx.hideLoading();

          if (res.statusCode === 200) {
            resolve(res.data as T);
          } else if (res.statusCode === 401) {
            // 令牌过期，尝试刷新
            const token = getAppToken();
            if (token && !isRefreshing) {
              isRefreshing = true;
              refreshAccessToken()
                .then(newToken => {
                  isRefreshing = false;
                  onTokenRefreshed(newToken);
                  doRequest(newToken);
                })
                .catch(() => {
                  isRefreshing = false;
                  refreshSubscribers = [];
                  wx.navigateTo({ url: '/pages/login/login' });
                  reject(new Error('登录已过期'));
                });
            } else if (isRefreshing) {
              // 等待刷新完成
              subscribeTokenRefresh((newToken: string) => {
                doRequest(newToken);
              });
            } else {
              wx.navigateTo({ url: '/pages/login/login' });
              reject(new Error('请先登录'));
            }
          } else {
            const msg = res.data?.detail || res.data?.message || '请求失败';
            wx.showToast({ title: msg, icon: 'none' });
            reject(new Error(msg));
          }
        },
        fail(err) {
          // 网络瞬时抖动（超时/断流）自动重试，最多 2 次，间隔递增。
          // 大幅降低「请求失败/网络异常」的偶发弹窗。
          if (retriesLeft > 0) {
            setTimeout(() => doRequest(token, retriesLeft - 1), (3 - retriesLeft) * 400);
            return;
          }
          if (showLoading) wx.hideLoading();
          wx.showToast({ title: '网络异常', icon: 'none' });
          reject(err);
        },
      });
    };

    doRequest(getAppToken());
  });
}
