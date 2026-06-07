import { getUserProfile, getUserStats, updateUserProfile, getRecommendationUnread, getMyDemandsUnread } from '../../services/user';

const app = getApp<IAppOption>();

const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RjZThmMiIvPjxjaXJjbGUgY3g9IjEwMCIgY3k9Ijc4IiByPSIzOCIgZmlsbD0iIzlmYjZjZiIvPjxwYXRoIGQ9Ik00MCAxODRjMC0zNiAyOC01OCA2MC01OHM2MCAyMiA2MCA1OHoiIGZpbGw9IiM5ZmI2Y2YiLz48L3N2Zz4=';

const AVATAR_UPLOAD_URL = 'https://xcxapi.fapaizhelianmeng.cn/api/v1/user/avatar';

Page({
  data: {
    isLoggedIn: false,
    userInfo: { nickname: '', avatar_url: null, phone: null, role: 'customer' } as UserInfo,
    stats: { favorite_count: 0, participated_count: 0, won_count: 0 },
    showEdit: false,
    editNickname: '',
    editPhone: '',
    saving: false,
    recUnread: 0,
    demandUnread: 0,
    defaultAvatar: DEFAULT_AVATAR,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.checkLoginAndLoad();
  },

  checkLoginAndLoad() {
    if (app.isLoggedIn()) {
      this.setData({ isLoggedIn: true });
      this.loadUserData();
    } else {
      this.setData({ isLoggedIn: false });
    }
  },

  // 微信头像选择：拿到临时图片后上传到后端，写回 avatar_url
  onChooseAvatar(e: any) {
    const avatarUrl = e.detail && e.detail.avatarUrl;
    if (!avatarUrl) return;
    // 先本地预览
    this.setData({ 'userInfo.avatar_url': avatarUrl } as any);
    wx.showLoading({ title: '上传中...', mask: true });
    wx.uploadFile({
      url: AVATAR_UPLOAD_URL,
      filePath: avatarUrl,
      name: 'file',
      header: { Authorization: `Bearer ${app.globalData.token || wx.getStorageSync('access_token') || ''}` },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data && data.avatar_url) {
            this.setData({ 'userInfo.avatar_url': data.avatar_url } as any);
            wx.showToast({ title: '头像已更新', icon: 'success' });
          } else {
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        } catch (_) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '上传失败', icon: 'none' }),
      complete: () => wx.hideLoading(),
    });
  },

  async loadUserData() {
    try {
      const [userInfo, stats] = await Promise.all([
        getUserProfile().catch(() => null),
        getUserStats().catch(() => ({ favorite_count: 0, participated_count: 0, won_count: 0 })),
      ]);
      if (userInfo) this.setData({ userInfo });
      if (stats) this.setData({ stats });
      getRecommendationUnread().then((r: any) => this.setData({ recUnread: (r && r.unread) || 0 })).catch(() => {});
      const role = (userInfo && (userInfo as any).role) || '';
      if (role === 'agent' || role === 'salesperson') {
        getMyDemandsUnread().then((r: any) => this.setData({ demandUnread: (r && r.unread) || 0 })).catch(() => {});
      }
    } catch (e) {
      console.error('加载用户数据失败:', e);
    }
  },

  onGoLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onNav(e: any) {
    const url = e.currentTarget.dataset.url;
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url });
  },

  onStatTap(e: any) {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    const key = e.currentTarget.dataset.key;
    if (key === 'favorite' || key === 'favorites') {
      wx.navigateTo({ url: '/subpackages/user/favorites/favorites' });
    } else {
      wx.showToast({ title: '该统计暂未开放跳转', icon: 'none' });
    }
  },

  onEditProfile() {
    this.setData({
      showEdit: true,
      editNickname: this.data.userInfo.nickname || '',
      editPhone: this.data.userInfo.phone || '',
    });
  },

  preventMove() {},
  preventBubble() {},

  onCloseEdit() {
    this.setData({ showEdit: false });
  },

  onNicknameInput(e: any) {
    this.setData({ editNickname: e.detail.value });
  },

  onPhoneInput(e: any) {
    this.setData({ editPhone: e.detail.value });
  },

  async onSaveProfile() {
    const nickname = this.data.editNickname.trim();
    const phone = this.data.editPhone.trim();
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (phone && phone.length !== 11) {
      wx.showToast({ title: '手机号格式错误', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      const data: any = { nickname };
      if (phone) data.phone = phone;
      const updated = await updateUserProfile(data);
      this.setData({ userInfo: updated, showEdit: false, saving: false });
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (e) {
      this.setData({ saving: false });
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
});
