import { formatPriceWan, formatDiscount, formatDate, statusLabel, statusTagClass } from '../../utils/format';

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
  },

  methods: {
    onTap() {
      const p = this.properties.property as PropertyItem;
      if (p && p.id) {
        wx.navigateTo({ url: `/pages/property-detail/property-detail?id=${p.id}` });
      }
    },
  },
});
