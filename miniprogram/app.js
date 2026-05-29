"use strict";
App({
    globalData: {
        token: '',
        refreshToken: '',
        userInfo: null,
        currentCityId: 310000,
        currentCityName: '上海',
    },
    onLaunch() {
        const token = wx.getStorageSync('access_token');
        if (token) {
            this.globalData.token = token;
            this.globalData.refreshToken = wx.getStorageSync('refresh_token') || '';
        }
        const systemInfo = wx.getSystemInfoSync();
        this.globalData.systemInfo = systemInfo;
    },
    setToken(accessToken, refreshToken) {
        this.globalData.token = accessToken;
        this.globalData.refreshToken = refreshToken;
        wx.setStorageSync('access_token', accessToken);
        wx.setStorageSync('refresh_token', refreshToken);
    },
    clearToken() {
        this.globalData.token = '';
        this.globalData.refreshToken = '';
        wx.removeStorageSync('access_token');
        wx.removeStorageSync('refresh_token');
    },
    isLoggedIn() {
        return !!this.globalData.token;
    },
});
