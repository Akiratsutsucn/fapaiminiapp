import { getPropertyDetail, getDistrictAnalysis, getPropertyAmenities } from '../../services/property';
import { addFavorite, removeFavorite, getFavorites } from '../../services/user';
import { getSettings } from '../../services/settings';
import { addBrowseHistory } from '../../utils/storage';
import { formatPriceWan, formatDiscount, formatDate, formatCountdown, statusLabel, statusTagClass } from '../../utils/format';

const app = getApp<IAppOption>();

Page({
  data: {
    property: {} as PropertyDetail,
    activeTab: 'basic',
    isFavorited: false,
    favoriteId: 0,
    statusLabel: '',
    statusTagClass: '',
    startingPriceWan: '',
    appraisalPriceWan: '',
    depositWan: '',
    discount: '',
    discountLabel: '折扣',
    countdown: '',
    auctionTimeFull: '',
    showAnalysis: false,
    analysis: null as DistrictAnalysis | null,
    amenities: null as PropertyAmenities | null,
    amenityLabels: {
      school: '学校', hospital: '医院', transit: '交通',
      shopping: '购物', food: '餐饮', bank: '银行',
    } as Record<string, string>,
    analysisUrl: '',
    safeAuctionUrl: '',
    // 新增字段
    regionInfo: '',          // 区域信息：district + sub_district + ring_road
    incrementAmountText: '', // 加价幅度文本（5万元/0.5万元）
    biddingTime: '',         // 竞标时间区间
    noticeExpanded: false,   // 公告全文是否展开
    commentary: null as { priceInsight?: string; bargainInsight?: string; locationInsight?: string } | null,
    blockIntro: '',          // 板块介绍
    mapMarkers: [] as any[], // 地图标记
    // 小区详情衍生字段
    communityAvgPriceWan: '',
    communityAvgUnitPriceWan: '',
    communityGreenRatePct: '',
    startingUnitPriceWan: '',
    communityDiscountText: '',
    // 同房型成交参考（deal_reference 兜底：贝壳缺失时用平台市场成交价）
    dealRefUnitPriceWan: '',   // 参考成交单价（万/㎡）
    dealRefSourceLabel: '',    // 来源标签：贝壳近30天/贝壳均价/市场参考/平台成交价
    dealRefDiscountText: '',   // 起拍价相对参考价的折扣
    dealRefBargainDelta: '',   // 按面积估算捡漏空间（万）
  },

  onLoad(options: any) {
    const id = parseInt(options.id);
    if (id) {
      this.loadProperty(id);
      this.loadSettings();
      addBrowseHistory('property', id);
    }
  },

  async loadSettings() {
    try {
      const settings = await getSettings();
      this.setData({
        analysisUrl: settings.analysis_url || '',
        safeAuctionUrl: settings.safe_url || '',
      });
    } catch (_) {
      // Keep defaults
    }
  },

  async loadProperty(id: number) {
    try {
      const property = await getPropertyDetail(id);
      const beikePriceWan = property.beike_latest_deal_unit_price
        ? formatPriceWan(property.beike_latest_deal_unit_price * (property.area || 100)) : '';
      const beikeUnitPrice = property.beike_latest_deal_unit_price
        ? property.beike_latest_deal_unit_price.toLocaleString() : '';
      const bargainDelta = property.bargain_potential > 0
        ? (property.bargain_potential / 10000).toFixed(0) : '';

      // 区域信息：district + sub_district + ring_road
      const regionParts = [property.district, property.sub_district, property.ring_road].filter(Boolean);
      const regionInfo = regionParts.join(' - ');

      // 加价幅度文本
      let incrementAmountText = '--';
      if (property.increment_amount && property.increment_amount > 0) {
        if (property.increment_amount >= 10000) {
          incrementAmountText = (property.increment_amount / 10000).toFixed(property.increment_amount % 10000 === 0 ? 0 : 1) + '万元及其倍数';
        } else {
          incrementAmountText = property.increment_amount.toLocaleString() + '元及其倍数';
        }
      }

      // 竞标时间区间
      let biddingTime = '';
      if (property.auction_start_time) {
        const start = formatDate(property.auction_start_time, 'YYYY-MM-DD HH:mm');
        if (property.auction_end_time) {
          const end = formatDate(property.auction_end_time, 'MM-DD HH:mm');
          biddingTime = `${start} 至 ${end}`;
        } else {
          biddingTime = `${start} 起`;
        }
      }

      // 价差点评、捡漏分析、板块优劣
      const commentary = this.buildCommentary(property);
      // 板块介绍
      const blockIntro = this.buildBlockIntro(property);
      // 地图标记
      const mapMarkers = (property.lat && property.lng) ? [{
        id: 1,
        latitude: property.lat,
        longitude: property.lng,
        width: 32,
        height: 32,
        callout: {
          content: property.community_name || property.title || '房源位置',
          color: '#fff',
          fontSize: 12,
          borderRadius: 4,
          bgColor: '#2563EB',
          padding: 6,
          display: 'ALWAYS',
        },
      }] : [];

      // 小区详情：富文本介绍 + 数据格式化
      let communityAvgPriceWan = '';
      let communityAvgUnitPriceWan = '';
      let communityGreenRatePct = '';
      let startingUnitPriceWan = '';
      let communityDiscountText = '';

      const ci = property.community_info;
      if (ci) {
        if (ci.avg_price) {
          communityAvgPriceWan = ci.avg_price.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
          communityAvgUnitPriceWan = (ci.avg_price / 10000).toFixed(2);
        }
        if (ci.green_rate) {
          communityGreenRatePct = (ci.green_rate * 100).toFixed(0) + '%';
        }
        if (property.starting_unit_price) {
          startingUnitPriceWan = (property.starting_unit_price / 10000).toFixed(2);
        }
        if (ci.avg_price && property.starting_unit_price) {
          const ratio = property.starting_unit_price / ci.avg_price;
          const off = (1 - ratio) * 10;
          if (off > 0) {
            communityDiscountText = off.toFixed(1) + ' 折';
          } else {
            communityDiscountText = '高于市场价';
          }
        }
      }

      // 同房型成交参考（后端 deal_reference 已按优先级兜底好：
      // 贝壳近30天 → 贝壳均价 → 平台市场成交单价 → 平台最新成交单价）
      let dealRefUnitPriceWan = '';
      let dealRefSourceLabel = '';
      let dealRefDiscountText = '';
      let dealRefBargainDelta = '';
      const dr = property.deal_reference;
      if (dr && dr.unit_price > 0) {
        dealRefUnitPriceWan = (dr.unit_price / 10000).toFixed(2);
        dealRefSourceLabel = dr.source_label || '市场参考';
        if (property.starting_unit_price) {
          const off = (1 - property.starting_unit_price / dr.unit_price) * 10;
          dealRefDiscountText = off > 0 ? off.toFixed(1) + ' 折' : '高于市场价';
          if (off > 0 && property.area) {
            const delta = (dr.unit_price - property.starting_unit_price) * property.area / 10000;
            if (delta > 0) dealRefBargainDelta = delta.toFixed(1);
          }
        }
      }

      this.setData({
        property,
        statusLabel: statusLabel(property.auction_status),
        statusTagClass: statusTagClass(property.auction_status),
        startingPriceWan: formatPriceWan(property.starting_price),
        appraisalPriceWan: formatPriceWan(property.appraisal_price),
        depositWan: formatPriceWan(property.deposit),
        discount: (property.court_discount_rate && property.court_discount_rate < 1) ? formatDiscount(property.court_discount_rate) : (property.court_discount_rate >= 1 ? '超人气' : '--'),
        discountLabel: (property.court_discount_rate && property.court_discount_rate >= 1) ? '人气' : '折扣',
        countdown: formatCountdown(property.auction_start_time),
        auctionTimeFull: property.auction_start_time ? formatDate(property.auction_start_time, 'YYYY-MM-DD HH:mm') : '时间待定',
        beikePriceWan,
        beikeUnitPrice,
        bargainDelta,
        regionInfo,
        incrementAmountText,
        biddingTime,
        commentary,
        blockIntro,
        mapMarkers,
        communityAvgPriceWan,
        communityAvgUnitPriceWan,
        communityGreenRatePct,
        startingUnitPriceWan,
        communityDiscountText,
        dealRefUnitPriceWan,
        dealRefSourceLabel,
        dealRefDiscountText,
        dealRefBargainDelta,
      });
      this.checkFavoriteStatus(id);
    } catch (e) {
      console.error('加载房源详情失败:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /** 构建独家解读：价差/捡漏/板块文案 */
  buildCommentary(p: any): { priceInsight?: string; bargainInsight?: string; locationInsight?: string } | null {
    const out: { priceInsight?: string; bargainInsight?: string; locationInsight?: string } = {};

    // 价差点评：起拍价 vs 评估价
    if (p.starting_price && p.appraisal_price && p.appraisal_price > 0) {
      const startWan = (p.starting_price / 10000).toFixed(1);
      const apprWan = (p.appraisal_price / 10000).toFixed(1);
      const ratio = p.starting_price / p.appraisal_price;
      const discount = ((1 - ratio) * 10).toFixed(1); // 几折
      const diff = ((p.appraisal_price - p.starting_price) / 10000).toFixed(1);
      let level = '';
      if (ratio < 0.65) level = '远低于评估价，捡漏空间显著';
      else if (ratio < 0.8) level = '低于评估价，价格优势明显';
      else if (ratio < 0.95) level = '接近评估价，仍有一定折扣';
      else level = '基本贴近评估价';
      out.priceInsight = `起拍总价 ${startWan} 万元，较评估价 ${apprWan} 万元低 ${diff} 万元（约 ${discount} 折），${level}。`;
    } else if (p.starting_price) {
      const startWan = (p.starting_price / 10000).toFixed(1);
      out.priceInsight = `起拍总价 ${startWan} 万元。`;
    }

    // 捡漏分析：起拍价 vs 贝壳挂牌价
    if (p.starting_price && p.beike_latest_deal_unit_price && p.area) {
      const beikeTotal = p.beike_latest_deal_unit_price * p.area;
      if (beikeTotal > 0) {
        const beikeWan = (beikeTotal / 10000).toFixed(0);
        const startWan = (p.starting_price / 10000).toFixed(0);
        const diffWan = ((beikeTotal - p.starting_price) / 10000).toFixed(0);
        if (parseFloat(diffWan) > 0) {
          out.bargainInsight = `起拍价 ${startWan} 万元，较同小区贝壳近成交单价 ${p.beike_latest_deal_unit_price.toLocaleString()} 元/㎡推算总价 ${beikeWan} 万元低 ${diffWan} 万元，价差显著，建议关注。`;
        } else {
          out.bargainInsight = `起拍价 ${startWan} 万元已接近或高于贝壳近成交参考价，性价比一般，需谨慎评估。`;
        }
      }
    }

    // 板块优劣（基于 district 和 sub_district 的提示）
    if (p.district || p.sub_district) {
      const loc = p.sub_district || p.district;
      if (p.ring_road === '内环内' || p.ring_road === '内环') {
        out.locationInsight = `${loc} 位于上海内环内核心区域，区位优势明显，配套成熟，保值性较强。`;
      } else if (p.ring_road === '中环内') {
        out.locationInsight = `${loc} 位于上海中环以内，交通便利，生活配套较为完善。`;
      } else if (p.ring_road === '外环内') {
        out.locationInsight = `${loc} 位于上海外环以内，发展潜力较好，价格相对中环更具性价比。`;
      } else if (p.ring_road === '外环外') {
        out.locationInsight = `${loc} 位于上海外环以外，价格门槛较低，适合刚需或投资关注。`;
      }
    }

    if (!out.priceInsight && !out.bargainInsight && !out.locationInsight) return null;
    return out;
  },

  /** 板块介绍（静态词典占位，后续从后端拿） */
  buildBlockIntro(p: any): string {
    if (!p.sub_district) return '';
    // 极简静态词典（后续可由后端配置）
    const dict: Record<string, string> = {
      '西藏北路': '西藏北路板块在并入静安之前隶属于闸北区，地处苏州河北岸、南北高架以东，区位优势明显。轨交 1/8/12 号线交汇，紧临大悦城商圈、月星环球港，生活配套完善。',
      '陆家嘴': '陆家嘴板块为上海金融核心区，集中了上海最高端的写字楼与豪宅，地铁 2 号线贯穿全境，浦东机场、虹桥枢纽往返便捷。',
      '徐家汇': '徐家汇板块为上海传统市级商圈，地铁 1/9/11 号线交汇，港汇恒隆、太平洋百货、徐家汇商城等大型商业体林立。',
      '人民广场': '人民广场板块位于上海市中心，地铁 1/2/8 号线汇聚，周边市政公共配套齐全，文化场馆密集。',
      '中山公园': '中山公园板块位于长宁与普陀交界，地铁 2/3/4 号线交汇，龙之梦购物中心、来福士、玫瑰坊等商业辐射半径大。',
    };
    return dict[p.sub_district] || '';
  },

  /** 切换公告全文展开 */
  onToggleNotice() {
    this.setData({ noticeExpanded: !this.data.noticeExpanded });
  },

  async checkFavoriteStatus(propertyId: number) {
    if (!app.isLoggedIn()) return;
    try {
      const res = await getFavorites('property', 1, 100);
      const fav = (res.items || []).find((f: any) => f.target_id === propertyId);
      if (fav) {
        this.setData({ isFavorited: true, favoriteId: fav.id });
      }
    } catch (_) {
      // Non-critical
    }
  },

  async onToggleFavorite() {
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    const propertyId = this.data.property.id;
    const newState = !this.data.isFavorited;
    this.setData({ isFavorited: newState });

    try {
      if (newState) {
        const res = await addFavorite('property', propertyId);
        if (res && res.id) this.setData({ favoriteId: res.id });
      } else {
        await removeFavorite(this.data.favoriteId);
        this.setData({ favoriteId: 0 });
      }
      wx.showToast({ title: newState ? '已收藏' : '已取消收藏', icon: 'none' });
    } catch (e) {
      this.setData({ isFavorited: !newState });
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onShare() {
    // 分享菜单已通过 button open-type="share" 触发，此事件保留以避免组件报错
  },

  onShareAppMessage() {
    const p = this.data.property;
    return {
      title: p.title || '法拍者联盟 房源信息',
      path: `/pages/property-detail/property-detail?id=${p.id}`,
      imageUrl: (this.data as any).images?.[0] || '',
    };
  },

  onContact() {
    wx.navigateTo({ url: '/pages/customer-service/customer-service' });
  },

  async onAnalysis() {
    if (this.data.analysisUrl) {
      this.openExternalLink(this.data.analysisUrl);
      return;
    }
    if (this.data.analysis) {
      this.setData({ showAnalysis: true });
      return;
    }
    try {
      wx.showLoading({ title: '加载中...' });
      const analysis = await getDistrictAnalysis(this.data.property.id);
      const priceMinWan = (analysis.min_starting_price / 10000).toFixed(0);
      const priceMaxWan = (analysis.max_starting_price / 10000).toFixed(0);
      (analysis as any).priceRangeText = priceMinWan + '万 - ' + priceMaxWan + '万';
      this.setData({ analysis, showAnalysis: true });
    } catch (e) {
      wx.showToast({ title: '加载板块数据失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onSafeAuction() {
    if (this.data.safeAuctionUrl) {
      this.openExternalLink(this.data.safeAuctionUrl);
    } else {
      wx.showToast({ title: '暂无内容', icon: 'none' });
    }
  },

  openExternalLink(url: string) {
    if (url.startsWith('http')) {
      wx.showModal({
        title: '查看公众号文章',
        content: '由于小程序无法直接打开外部链接，链接将复制到剪贴板，请在微信内粘贴打开。',
        confirmText: '复制链接',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({
              data: url,
              success: () => wx.showToast({ title: '已复制', icon: 'success' }),
            });
          }
        },
      });
    } else {
      wx.navigateTo({ url, fail: () => {
        wx.showToast({ title: '页面不存在', icon: 'none' });
      }});
    }
  },

  onCloseAnalysis() {
    this.setData({ showAnalysis: false });
  },

  onCalc() {
    wx.navigateTo({ url: '/pages/mortgage-calculator/mortgage-calculator' });
  },

  onTabSwitch(e: any) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'around' && !this.data.amenities) {
      this.loadAmenities();
    }
  },

  async loadAmenities() {
    try {
      const amenities = await getPropertyAmenities(this.data.property.id);
      if (amenities && amenities.amenities) {
        for (const cat of Object.values(amenities.amenities)) {
          for (const poi of cat as any[]) {
            if (poi.distance < 1000) {
              poi.distanceText = poi.distance + 'm';
            } else {
              poi.distanceText = (poi.distance / 1000).toFixed(1) + 'km';
            }
          }
        }
      }
      this.setData({ amenities });
    } catch (e) {
      console.error('加载周边配套失败:', e);
    }
  },
});
