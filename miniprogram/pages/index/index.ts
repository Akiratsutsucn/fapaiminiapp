import { getBanners, getRecommendedProperties, getMarketStats, getCities, getProperties } from '../../services/property';
import { getRecommendedArticles } from '../../services/article';

const DISTRICTS_BY_CITY: Record<number, string[]> = {
  310000: ['浦东新区', '静安区', '徐汇区', '黄浦区', '长宁区', '虹口区', '杨浦区', '普陀区', '宝山区', '闵行区', '嘉定区', '松江区', '青浦区', '奉贤区', '金山区', '崇明区'],
  330200: ['海曙区', '江北区', '江东区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'],
  330100: ['上城区', '下城区', '江干区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'],
};

function districtsForCity(cityId: number): string[] {
  return DISTRICTS_BY_CITY[cityId] || DISTRICTS_BY_CITY[310000];
}

// 城市菜单兜底：/cities 接口偶发失败时，仍保证选择面板可用、可切回上海。
const DEFAULT_CITIES: CityItem[] = [
  { city_id: 310000, city_name: '上海', is_active: true } as CityItem,
  { city_id: 330200, city_name: '宁波', is_active: true } as CityItem,
  { city_id: 330100, city_name: '杭州', is_active: true } as CityItem,
];

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
    cities: DEFAULT_CITIES,
    currentCityId: 310000,
    currentCityName: '上海',
    activeFilter: '',
    selectedDistrict: '',
    selectedPriceLabel: '',
    selectedPriceRange: '',
    districts: districtsForCity(310000),
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
        districts: districtsForCity(app.globalData.currentCityId),
        // 跨城切换时清掉旧城市的区域/价格筛选，避免用上海的区县去查宁波导致列表空白
        selectedDistrict: '',
        selectedPriceLabel: '',
        selectedPriceRange: '',
        activeFilter: '',
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

      // 城市列表为空时保留现有/默认列表，绝不让选择面板变空白（否则无法切回上海）
      const safeCities = (cities && cities.length > 0) ? cities : (this.data.cities.length > 0 ? this.data.cities : DEFAULT_CITIES);
      this.setData({ banners, stats, articles, cities: safeCities });
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
      // 列表为空时兜底用推荐房源，避免「头条捡漏」整块空白
      if (result.items && result.items.length > 0) {
        this.setData({ properties: result.items });
      } else {
        const props = await getRecommendedProperties(cityId).catch(() => [] as PropertyItem[]);
        this.setData({ properties: props });
      }
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
    this.setData({
      currentCityId: city.city_id,
      currentCityName: city.city_name,
      districts: districtsForCity(city.city_id),
      // 切城市清空筛选条件，保证新城市房源正常加载
      selectedDistrict: '',
      selectedPriceLabel: '',
      selectedPriceRange: '',
      activeFilter: '',
    });
    const app = getApp<IAppOption>();
    app.globalData.currentCityId = city.city_id;
    app.globalData.currentCityName = city.city_name;
    this.loadData();
  },

  onStatTap(e: any) {
    const type = e.currentTarget.dataset.type;
    // 四按钮各自精确过滤 + 强制带当前城市，列表页对应展示捡漏/即将开拍/昨日上架/昨日成交。
    const cityId = this.data.currentCityId || getApp<IAppOption>().globalData.currentCityId || 310000;
    const parts: string[] = [`city_id=${cityId}`];
    if (type === 'bargain') {
      // 捡漏：折扣 1折~6.5折 + 可参拍（即将开拍/进行中），与首屏 bargain_count 同口径
      parts.push('discount_min=0.1', 'discount_max=0.65', 'auction_status=即将开拍,进行中');
      parts.push('sort_by=starting_price', 'sort_order=asc');
    } else if (type === 'upcoming') {
      parts.push('auction_status=即将开拍');
    } else if (type === 'listed') {
      parts.push('listed_day=yesterday');
    } else if (type === 'sold') {
      parts.push('sold_day=yesterday');
    }
    wx.navigateTo({ url: `/pages/property-list/property-list?${parts.join('&')}` });
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

  onViewAllArticles() {
    wx.navigateTo({ url: '/pages/article-list/article-list' });
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
