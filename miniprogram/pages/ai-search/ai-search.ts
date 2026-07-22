import { getProperties } from '../../services/property';
import { getUserProfile, updateUserProfile } from '../../services/user';

Page({
  data: {
    query: '',
    searching: false,
    searched: false,
    list: [] as PropertyItem[],
    total: 0,
    // 联系方式门禁:使用搜索前必须填写手机号+姓氏(关联用户表)
    contactReady: false,        // 用户资料是否已含手机号+昵称
    showContactModal: false,    // 是否显示填写弹窗
    contactForm: { surname: '', phone: '' },
    savingContact: false,
  },

  onLoad() {
    this.refreshContactStatus();
  },

  // 读取用户资料,判断是否已填手机号+昵称(姓氏)
  async refreshContactStatus() {
    const app = getApp<IAppOption>();
    if (!app.isLoggedIn()) {
      this.setData({ contactReady: false });
      return;
    }
    try {
      const profile = await getUserProfile();
      const ready = !!(profile && profile.phone && profile.nickname);
      this.setData({
        contactReady: ready,
        'contactForm.surname': profile?.nickname || '',
        'contactForm.phone': profile?.phone || '',
      });
    } catch (e) {
      this.setData({ contactReady: false });
    }
  },

  // 门禁:确保已填手机号+姓氏。已填→返回 true;未填→弹窗,返回 false
  ensureContact(): boolean {
    const app = getApp<IAppOption>();
    if (!app.isLoggedIn()) {
      wx.showModal({
        title: '请先登录',
        content: '使用选房需要先登录',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/login' });
        },
      });
      return false;
    }
    if (this.data.contactReady) return true;
    // 未填手机号/姓氏 → 弹窗
    this.setData({ showContactModal: true });
    return false;
  },

  onContactInput(e: any) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`contactForm.${field}`]: e.detail.value });
  },

  onCloseContactModal() {
    this.setData({ showContactModal: false });
  },

  // 提交手机号+姓氏 → 存入用户表(关联管理后台用户管理)
  async onSubmitContact() {
    const surname = (this.data.contactForm.surname || '').trim();
    const phone = (this.data.contactForm.phone || '').trim();
    if (!surname) {
      wx.showToast({ title: '请填写姓氏', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }
    this.setData({ savingContact: true });
    try {
      await updateUserProfile({ nickname: surname, phone } as any);
      this.setData({
        contactReady: true,
        showContactModal: false,
        savingContact: false,
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      // 继续之前被拦截的搜索
      this.onSearch();
    } catch (e) {
      console.error('保存联系方式失败:', e);
      wx.showToast({ title: '保存失败,请重试', icon: 'none' });
      this.setData({ savingContact: false });
    }
  },

  onQueryInput(e: any) {
    this.setData({ query: e.detail.value });
  },

  onTapExample(e: any) {
    const text = e.currentTarget.dataset.text;
    this.setData({ query: text }, () => this.onSearch());
  },

  async onSearch() {
    const query = this.data.query.trim();
    if (!query) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }
    // 门禁:使用搜索前必须先填手机号+姓氏
    if (!this.ensureContact()) return;

    this.setData({ searching: true });
    try {
      await this.searchProperties(query);
      this.setData({ searched: true, searching: false });
    } catch (e) {
      console.error('搜索失败:', e);
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' });
      this.setData({ searching: false });
    }
  },

  async searchProperties(keyword: string) {
    const app = getApp<IAppOption>();
    const params: any = {
      city_id: app.globalData.currentCityId || 310000,
      keyword,
      page: 1,
      page_size: 20,
    };
    const result = await getProperties(params);
    this.setData({
      list: result.items || [],
      total: result.total || 0,
    });
  },

  // 转发给好友
  onShareAppMessage() {
    return { title: '法拍者联盟 — 找法拍房', path: '/pages/ai-search/ai-search' };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return { title: '法拍者联盟 — 找法拍房' };
  },
});
