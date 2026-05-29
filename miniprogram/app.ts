// app.ts — 法拍者联盟小程序
App<IAppOption>({
  globalData: {
    token: '',
    refreshToken: '',
    userInfo: null,
    currentCityId: 310000,
    currentCityName: '上海',
  },

  onLaunch() {
    // 检查登录态
    const token = wx.getStorageSync('access_token');
    if (token) {
      this.globalData.token = token;
      this.globalData.refreshToken = wx.getStorageSync('refresh_token') || '';
    }

    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    this.globalData.systemInfo = systemInfo;
  },

  // 全局登录态管理
  setToken(accessToken: string, refreshToken: string) {
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

  isLoggedIn(): boolean {
    return !!this.globalData.token;
  },
});
