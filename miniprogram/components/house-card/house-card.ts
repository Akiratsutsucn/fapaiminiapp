import { formatPriceWan, formatDiscount, formatDate, statusLabel, statusTagClass } from '../../utils/format';

function priceNumberOnly(price: number): string {
  if (!price || price === 0) return '--';
  const wan = price / 10000;
  if (wan >= 10000) return (wan / 10000).toFixed(2);
  return wan.toFixed(0);
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
      // 「捡漏」折扣率定义为 1折~6.5折（rate 0.1~0.65）才显示橙色折扣率；
      // rate>=1（起拍价不低于评估价，无折扣空间）用「超人气」替代
      const rate = p.court_discount_rate || 0;
      const discount = rate >= 0.1 && rate <= 0.65 ? formatDiscount(rate) : '';
      const hotTag = rate >= 1 ? '超人气' : '';
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
        area: p.area ? p.area.toFixed(2) : '',
        layout: p.layout || '',
        title: p.title || '',
        discount,
        hotTag,
        savingWan,
        auctionTime: p.auction_start_time ? formatDate(p.auction_start_time, 'MM-DD HH:mm') : '',
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
    hotTag: '',
    savingWan: '',
    auctionTime: '',
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
