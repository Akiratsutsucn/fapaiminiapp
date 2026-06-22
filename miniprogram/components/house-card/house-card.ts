import { formatPriceWan, formatDiscount, formatDate, statusLabel, statusTagClass } from '../../utils/format';
import { checkContactStatus, saveContact } from '../../utils/contact-gate';

function priceNumberOnly(price: number): string {
  if (!price || price === 0) return '--';
  const wan = price / 10000;
  if (wan >= 10000) return (wan / 10000).toFixed(2);
  return wan.toFixed(0);
}

const PLATFORM_KEY_MAP: Record<string, string> = {
  '京东拍卖': 'jd',
  '阿里拍卖': 'ali',
  '公拍网': 'gpai',
};

// 把抓取用的 source_url 转成用户可访问的链接(阿里移动端→PC端;京东/公拍直接用)
function toAccessUrl(sourceUrl: string, platform: string): string {
  if (!sourceUrl) return '';
  if (platform && (platform.indexOf('阿里') >= 0 || platform.indexOf('淘宝') >= 0)) {
    const m = sourceUrl.match(/itemId=(\d+)/);
    if (m) return `https://sf-item.taobao.com/sf_item/${m[1]}.htm`;
  }
  return sourceUrl;
}

Component({
  properties: {
    property: {
      type: Object,
      value: {} as PropertyItem,
    },
  },

  computed: {},

  observers: {
    property(p: PropertyItem) {
      if (!p) return;
      const startingNum = priceNumberOnly(p.starting_price);
      const wan = (p.starting_price || 0) / 10000;
      const showAsYi = wan >= 10000;
      const saving = (p.appraisal_price || 0) - (p.starting_price || 0);
      const savingWan = saving > 0 ? priceNumberOnly(saving) : '';
      // 有折扣空间就显示折扣率（含 6.5 折以上，如 7 折、8 折）；rate>=1（起拍价不低于评估价）不显示折扣。
      const rate = p.court_discount_rate || 0;
      const discount = rate > 0 && rate < 1 ? formatDiscount(rate) : '';
      this.setData({
        coverImage: p.cover_image || '/images/default-house.png',
        statusLabel: statusLabel(p.auction_status),
        statusTagClass: statusTagClass(p.auction_status),
        startingPriceWan: startingNum,
        startingUnit: showAsYi ? '亿起' : '万起',
        appraisalPriceWan: priceNumberOnly(p.appraisal_price),
        district: p.district || '',
        propertyType: p.property_type || '',
        auctionRound: p.auction_round || '',
        area: p.area ? String(Math.round(p.area)) : '',
        layout: p.layout || '',
        title: p.title || '',
        discount,
        savingWan,
        auctionTime: p.auction_start_time ? formatDate(p.auction_start_time, 'MM-DD HH:mm') : '',
        platformLabel: p.auction_platform || '',
        platformKey: PLATFORM_KEY_MAP[p.auction_platform || ''] || '',
      });
    },
  },

  data: {
    coverImage: '',
    statusLabel: '',
    statusTagClass: '',
    startingPriceWan: '',
    startingUnit: '万起',
    appraisalPriceWan: '',
    district: '',
    propertyType: '',
    auctionRound: '',
    area: '',
    layout: '',
    title: '',
    discount: '',
    savingWan: '',
    auctionTime: '',
    platformLabel: '',
    platformKey: '',
    // 平台标记点击门禁:未填手机号+姓氏时弹窗
    showContactModal: false,
    contactForm: { surname: '', phone: '' },
    savingContact: false,
  },

  methods: {
    onTap() {
      const p = this.properties.property as PropertyItem;
      if (p && p.id) {
        wx.navigateTo({ url: `/pages/property-detail/property-detail?id=${p.id}` });
      }
    },

    // 点击平台标记:门禁(未填手机号+姓氏先弹窗),通过后复制链接引导浏览器打开
    async onTapPlatform() {
      const p = this.properties.property as PropertyItem;
      if (!p || !p.source_url) {
        wx.showToast({ title: '暂无平台链接', icon: 'none' });
        return;
      }
      const status = await checkContactStatus();
      if (status === 'nologin') {
        wx.showModal({
          title: '请先登录',
          content: '查看房源在拍卖平台的链接需要先登录',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) wx.navigateTo({ url: '/pages/login/login' });
          },
        });
        return;
      }
      if (status === 'need') {
        this.setData({ showContactModal: true });
        return;
      }
      this.openPlatformLink();
    },

    onContactInput(e: any) {
      const field = e.currentTarget.dataset.field;
      this.setData({ [`contactForm.${field}`]: e.detail.value });
    },

    onCloseContactModal() {
      this.setData({ showContactModal: false });
    },

    noop() {},

    async onSubmitContact() {
      this.setData({ savingContact: true });
      const ok = await saveContact(this.data.contactForm.surname, this.data.contactForm.phone);
      this.setData({ savingContact: false });
      if (ok) {
        this.setData({ showContactModal: false });
        this.openPlatformLink();
      }
    },

    // 复制平台链接 + 委婉提示(微信无法直接打开外部网站,只能手动到浏览器粘贴)
    openPlatformLink() {
      const p = this.properties.property as PropertyItem;
      const url = toAccessUrl(p.source_url, p.auction_platform);
      if (!url) {
        wx.showToast({ title: '暂无平台链接', icon: 'none' });
        return;
      }
      wx.setClipboardData({
        data: url,
        success: () => {
          wx.showModal({
            title: '链接已复制',
            content: '应微信官方安全规范要求,小程序无法直接跳转到外部网站。链接已为您复制,请打开手机浏览器粘贴访问,即可查看该房源在拍卖平台的页面。',
            showCancel: false,
            confirmText: '我知道了',
          });
        },
      });
    },
  },
});
