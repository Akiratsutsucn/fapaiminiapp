"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.request = request;
// 域名已备案通过 + HTTPS 证书有效，使用 https 域名（小程序要求 https）
const BASE_URL = 'https://xcxapi.fapaizhelianmeng.cn/api/v1';
let isRefreshing = false;
let refreshSubscribers = [];
function subscribeTokenRefresh(cb) {
    refreshSubscribers.push(cb);
}
function onTokenRefreshed(token) {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
}
function getAppToken() {
    const app = getApp();
    return app.globalData.token || wx.getStorageSync('access_token') || '';
}
function getRefreshToken() {
    const app = getApp();
    return app.globalData.refreshToken || wx.getStorageSync('refresh_token') || '';
}
async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        throw new Error('无刷新令牌');
    }
    return new Promise((resolve, reject) => {
        wx.request({
            url: `${BASE_URL}/auth/refresh`,
            method: 'POST',
            data: { refresh_token: refreshToken },
            success(res) {
                var _a;
                if (res.statusCode === 200 && ((_a = res.data) === null || _a === void 0 ? void 0 : _a.access_token)) {
                    const newToken = res.data.access_token;
                    const newRefreshToken = res.data.refresh_token || refreshToken;
                    const app = getApp();
                    app.setToken(newToken, newRefreshToken);
                    resolve(newToken);
                }
                else {
                    const app = getApp();
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
function request(options) {
    const { url, method = 'GET', data, header = {}, auth = true, showLoading = false } = options;
    if (showLoading) {
        wx.showLoading({ title: '加载中...', mask: true });
    }
    return new Promise((resolve, reject) => {
        const doRequest = (token) => {
            const headers = { 'Content-Type': 'application/json', ...header };
            if (auth && token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
            wx.request({
                url: fullUrl,
                method,
                data,
                header: headers,
                success(res) {
                    var _a, _b;
                    if (showLoading)
                        wx.hideLoading();
                    if (res.statusCode === 200) {
                        resolve(res.data);
                    }
                    else if (res.statusCode === 401) {
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
                        }
                        else if (isRefreshing) {
                            subscribeTokenRefresh((newToken) => {
                                doRequest(newToken);
                            });
                        }
                        else {
                            wx.navigateTo({ url: '/pages/login/login' });
                            reject(new Error('请先登录'));
                        }
                    }
                    else {
                        const msg = ((_a = res.data) === null || _a === void 0 ? void 0 : _a.detail) || ((_b = res.data) === null || _b === void 0 ? void 0 : _b.message) || '请求失败';
                        wx.showToast({ title: msg, icon: 'none' });
                        reject(new Error(msg));
                    }
                },
                fail(err) {
                    if (showLoading)
                        wx.hideLoading();
                    wx.showToast({ title: '网络异常', icon: 'none' });
                    reject(err);
                },
            });
        };
        doRequest(getAppToken());
    });
}
