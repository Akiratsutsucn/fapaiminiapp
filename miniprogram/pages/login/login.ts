import { login } from '../../services/auth';

Page({
  data: {
    loading: false,
    agreed: false,
  },

  async onLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意用户协议', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const { code } = await wx.login();
      if (!code) {
        wx.showToast({ title: '获取登录凭证失败', icon: 'none' });
        this.setData({ loading: false });
        return;
      }

      await login(code);
      wx.switchTab({ url: '/pages/index/index' });
    } catch (e) {
      console.error('登录失败:', e);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onAgreeToggle() {
    this.setData({ agreed: !this.data.agreed });
  },

  onViewTerms() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  onViewPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },
});
