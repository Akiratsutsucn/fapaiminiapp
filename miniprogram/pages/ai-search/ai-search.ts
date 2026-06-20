import { getProperties } from '../../services/property';
import { request } from '../../utils/request';
import { getUserProfile, updateUserProfile } from '../../services/user';

const plugin = requirePlugin('WechatSI');
const manager = plugin.getRecordRecognitionManager();

Page({
  data: {
    query: '',
    parsed: {} as any,
    priceText: '',
    areaText: '',
    searching: false,
    searched: false,
    recording: false,
    list: [] as PropertyItem[],
    total: 0,
    // 联系方式门禁:使用语音/搜索前必须填写手机号+姓氏(关联用户表)
    contactReady: false,        // 用户资料是否已含手机号+昵称
    showContactModal: false,    // 是否显示填写弹窗
    contactForm: { surname: '', phone: '' },
    savingContact: false,
    pendingAction: '' as '' | 'voice' | 'search',  // 填完后要继续执行的动作
  },

  onLoad() {
    this.initVoice();
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

  // 门禁:确保已填手机号+姓氏。已填→返回 true;未填→弹窗并暂存待执行动作,返回 false
  ensureContact(action: 'voice' | 'search'): boolean {
    const app = getApp<IAppOption>();
    if (!app.isLoggedIn()) {
      wx.showModal({
        title: '请先登录',
        content: '使用 AI 找房需要先登录',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/login' });
        },
      });
      return false;
    }
    if (this.data.contactReady) return true;
    // 未填手机号/姓氏 → 弹窗
    this.setData({ showContactModal: true, pendingAction: action });
    return false;
  },

  onContactInput(e: any) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`contactForm.${field}`]: e.detail.value });
  },

  onCloseContactModal() {
    this.setData({ showContactModal: false, pendingAction: '' });
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
      // 继续之前被拦截的动作
      const action = this.data.pendingAction;
      this.setData({ pendingAction: '' });
      if (action === 'voice') this.startVoiceFlow();
      else if (action === 'search') this.onSearch();
    } catch (e) {
      console.error('保存联系方式失败:', e);
      wx.showToast({ title: '保存失败,请重试', icon: 'none' });
      this.setData({ savingContact: false });
    }
  },

  initVoice() {
    manager.onRecognize = (res: any) => {
      console.log('实时识别:', res.result);
    };

    manager.onStop = (res: any) => {
      console.log('识别结果:', res.result);
      this.setData({
        query: res.result,
        recording: false,
      });
    };

    manager.onError = (res: any) => {
      console.error('语音识别错误:', res);
      wx.showToast({ title: '识别失败', icon: 'none' });
      this.setData({ recording: false });
    };
  },

  onQueryInput(e: any) {
    this.setData({ query: e.detail.value });
  },

  onTapExample(e: any) {
    const text = e.currentTarget.dataset.text;
    this.setData({ query: text });
  },

  onVoiceInput() {
    // 门禁:使用语音输入前必须先填手机号+姓氏
    if (!this.ensureContact('voice')) return;
    this.startVoiceFlow();
  },

  startVoiceFlow() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.startRecord();
      },
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: '请在设置中开启录音权限',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          },
        });
      },
    });
  },

  startRecord() {
    this.setData({ recording: true });
    manager.start({ lang: 'zh_CN' });
  },

  onStopRecord() {
    manager.stop();
  },

  async onSearch() {
    const query = this.data.query.trim();
    if (!query) {
      wx.showToast({ title: '请输入或说出您的需求', icon: 'none' });
      return;
    }
    // 门禁:使用搜索前必须先填手机号+姓氏
    if (!this.ensureContact('search')) return;

    this.setData({ searching: true });

    try {
      // 1. 调用 AI 解析接口
      const parseResult: any = await request({
        url: '/ai-search/parse',
        method: 'GET',
        data: { query },
      });

      const parsed = parseResult.parsed || {};

      // 2. 格式化显示文本
      const priceText = this.formatPrice(parsed);
      const areaText = this.formatArea(parsed);

      this.setData({
        parsed,
        priceText,
        areaText,
      });

      // 3. 调用房源列表接口
      await this.searchProperties(parsed);

      this.setData({
        searched: true,
        searching: false,
      });
    } catch (e) {
      console.error('搜索失败:', e);
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' });
      this.setData({ searching: false });
    }
  },

  async searchProperties(parsed: any) {
    const app = getApp<IAppOption>();
    const params: any = {
      city_id: app.globalData.currentCityId || 310000,
      page: 1,
      page_size: 20,
    };

    if (parsed.district) params.district = parsed.district;
    if (parsed.layout) params.layout = parsed.layout;
    if (parsed.price_min) params.price_min = parsed.price_min;
    if (parsed.price_max) params.price_max = parsed.price_max;
    if (parsed.area_min) params.area_min = parsed.area_min;
    if (parsed.area_max) params.area_max = parsed.area_max;
    if (parsed.property_type) params.property_type = parsed.property_type;
    if (parsed.auction_status) params.auction_status = parsed.auction_status;
    if (parsed.discount_min) {
      params.discount_min = parsed.discount_min;
      params.discount_max = parsed.discount_max;
    }

    const result = await getProperties(params);
    this.setData({
      list: result.items || [],
      total: result.total || 0,
    });
  },

  formatPrice(parsed: any): string {
    const min = parsed.price_min;
    const max = parsed.price_max;
    if (min && max) {
      return `${min / 10000}万 - ${max / 10000}万`;
    } else if (min) {
      return `${min / 10000}万以上`;
    } else if (max) {
      return `${max / 10000}万以下`;
    }
    return '';
  },

  formatArea(parsed: any): string {
    const min = parsed.area_min;
    const max = parsed.area_max;
    if (min && max) {
      return `${min} - ${max}㎡`;
    } else if (min) {
      return `${min}㎡以上`;
    } else if (max) {
      return `${max}㎡以下`;
    }
    return '';
  },
});
