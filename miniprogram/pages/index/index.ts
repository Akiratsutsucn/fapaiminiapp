import { getBanners, getRecommendedProperties, getMarketStats, getCities, getProperties } from '../../services/property';
import { getRecommendedArticles } from '../../services/article';

const DISTRICTS = ['浦东新区', '静安区', '徐汇区', '黄浦区', '长宁区', '虹口区', '杨浦区', '普陀区', '宝山区', '闵行区', '嘉定区', '松江区', '青浦区', '奉贤区', '金山区', '崇明区'];

interface PriceRange { label: string; value: string }

const PRICE_RANGES: PriceRange[] = [
  { label: '100万以下', value: '0-1000000' },
  { label: '100-300万', value: '1000000-3000000' },
  { label: '300-500万', value: '3000000-5000000' },
  { label: '500万以上', value: '5000000-' },
];

Page({
  data: {
    banners: [] as BannerItem[],
    stats: { bargain_count: 0, upcoming_count: 0, yesterday_listed: 0, yesterday_sold: 0 } as MarketStats,
    articles: [] as ArticleItem[],
    properties: [] as PropertyItem[],
    cities: [] as CityItem[],
    currentCityId: 310000,
    currentCityName: '上海',
    activeFilter: '',
    selectedDistrict: '',
    selectedPriceLabel: '',
    selectedPriceRange: '',
    districts: DISTRICTS,
    priceRanges: PRICE_RANGES,
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    const app = getApp<IAppOption>();
    if (app.globalData.currentCityId !== this.data.currentCityId) {
      this.setData({
        currentCityId: app.globalData.currentCityId,
        currentCityName: app.globalData.currentCityName,
      });
      this.loadData();
    }
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    const cityId = this.data.currentCityId;

    try {
      const [banners, stats, articles, cities] = await Promise.all([
        getBanners(cityId).catch(() => [] as BannerItem[]),
        getMarketStats(cityId).catch(() => ({ bargain_count: 0, upcoming_count: 0, yesterday_listed: 0, yesterday_sold: 0 })),
        getRecommendedArticles().catch(() => [] as ArticleItem[]),
        getCities().catch(() => [] as CityItem[]),
      ]);

      this.setData({ banners, stats, articles, cities });
      this.loadProperties();
    } catch (e) {
      console.error('首页数据加载失败:', e);
    }
  },

  async loadProperties() {
    const cityId = this.data.currentCityId;
    const params: any = { city_id: cityId, page: 1, page_size: 6 };
    if (this.data.selectedDistrict) params.district = this.data.selectedDistrict;
    if (this.data.selectedPriceRange) {
      const [min, max] = this.data.selectedPriceRange.split('-');
      if (min) params.price_min = parseInt(min);
      if (max) params.price_max = parseInt(max);
    }
    try {
      const result = await getProperties(params);
      this.setData({ properties: result.items });
    } catch (e) {
      try {
        const props = await getRecommendedProperties(cityId);
        this.setData({ properties: props });
      } catch (_) {
        this.setData({ properties: [] });
      }
    }
  },

  onCityChange(e: any) {
    const { city } = e.detail;
    this.setData({ currentCityId: city.city_id, currentCityName: city.city_name });
    const app = getApp<IAppOption>();
    app.globalData.currentCityId = city.city_id;
    app.globalData.currentCityName = city.city_name;
    this.loadData();
  },

  onStatTap(e: any) {
    const type = e.currentTarget.dataset.type;
    let params = '';
    if (type === 'bargain') params = 'sort_by=starting_price&sort_order=asc';
    else if (type === 'upcoming') params = 'auction_status=即将开拍';
    wx.navigateTo({ url: `/pages/property-list/property-list?${params}` });
  },

  onViewAll() {
    let params = '';
    if (this.data.selectedDistrict) params += `&district=${this.data.selectedDistrict}`;
    wx.navigateTo({ url: `/pages/property-list/property-list${params ? '?' + params.substring(1) : ''}` });
  },

  onMapFind() {
    wx.navigateTo({ url: '/pages/map-property/map-property' });
  },

  onArticleTap(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/article/article?id=${id}` });
  },

  onQuickFilter(e: any) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ activeFilter: this.data.activeFilter === filter ? '' : filter });
  },

  onSelectDistrict(e: any) {
    const val = e.currentTarget.dataset.value;
    this.setData({
      selectedDistrict: val,
      activeFilter: '',
    });
    this.loadProperties();
  },

  onSelectPriceRange(e: any) {
    const val = e.currentTarget.dataset.value;
    const range = PRICE_RANGES.find(r => r.value === val);
    this.setData({
      selectedPriceRange: val,
      selectedPriceLabel: range ? range.label : '',
      activeFilter: '',
    });
    this.loadProperties();
  },

  onContact() {
    wx.navigateTo({ url: '/pages/customer-service/customer-service' });
  },

  onScrollTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },
});
