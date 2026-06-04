import { login } from '../../services/auth';
import { getHomeSummary } from '../../services/property';

Page({
  data: {
    loading: false,
    agreed: false,
    summary: {
      onAuctionText: '--',
      bargain: '--' as any,
      discountText: '--',
    },
  },

  onLoad() {
    this.loadSummary();
  },

  async loadSummary() {
    try {
      const s = await getHomeSummary();
      const onAuction = s.on_auction || 0;
      const onAuctionText = onAuction >= 1000 ? (onAuction / 1000).toFixed(1) + 'K+' : String(onAuction);
      this.setData({
        summary: {
          onAuctionText,
          bargain: s.bargain || 0,
          discountText: s.avg_discount ? s.avg_discount + '折' : '--',
        },
      });
    } catch (e) {
      // 拉取失败时保留占位符，不阻塞登录
    }
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
