"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const property_1 = require("../../services/property");
const article_1 = require("../../services/article");
const DISTRICTS_BY_CITY = {
    310000: ['浦东新区', '静安区', '徐汇区', '黄浦区', '长宁区', '虹口区', '杨浦区', '普陀区', '宝山区', '闵行区', '嘉定区', '松江区', '青浦区', '奉贤区', '金山区', '崇明区'],
    330200: ['海曙区', '江北区', '江东区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'],
    330100: ['上城区', '下城区', '江干区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'],
};
function districtsForCity(cityId) {
    return DISTRICTS_BY_CITY[cityId] || DISTRICTS_BY_CITY[310000];
}
const DEFAULT_CITIES = [
    { city_id: 310000, city_name: '上海', is_active: true },
    { city_id: 330200, city_name: '宁波', is_active: true },
    { city_id: 330100, city_name: '杭州', is_active: true },
];
const PRICE_RANGES = [
    { label: '100万以下', value: '0-1000000' },
    { label: '100-300万', value: '1000000-3000000' },
    { label: '300-500万', value: '3000000-5000000' },
    { label: '500万以上', value: '5000000-' },
];
Page({
    data: {
        banners: [],
        stats: { bargain_count: 0, upcoming_count: 0, yesterday_listed: 0, yesterday_sold: 0 },
        articles: [],
        properties: [],
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
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().setData({ selected: 0 });
        }
        const app = getApp();
        if (app.globalData.currentCityId !== this.data.currentCityId) {
            this.setData({
                currentCityId: app.globalData.currentCityId,
                currentCityName: app.globalData.currentCityName,
                districts: districtsForCity(app.globalData.currentCityId),
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
                (0, property_1.getBanners)(cityId).catch(() => []),
                (0, property_1.getMarketStats)(cityId).catch(() => ({ bargain_count: 0, upcoming_count: 0, yesterday_listed: 0, yesterday_sold: 0 })),
                (0, article_1.getRecommendedArticles)().catch(() => []),
                (0, property_1.getCities)().catch(() => []),
            ]);
            const safeCities = (cities && cities.length > 0) ? cities : (this.data.cities.length > 0 ? this.data.cities : DEFAULT_CITIES);
            this.setData({ banners, stats, articles, cities: safeCities });
            this.loadProperties();
        }
        catch (e) {
            console.error('首页数据加载失败:', e);
        }
    },
    async loadProperties() {
        const cityId = this.data.currentCityId;
        const params = { city_id: cityId, page: 1, page_size: 6 };
        if (this.data.selectedDistrict)
            params.district = this.data.selectedDistrict;
        if (this.data.selectedPriceRange) {
            const [min, max] = this.data.selectedPriceRange.split('-');
            if (min)
                params.price_min = parseInt(min);
            if (max)
                params.price_max = parseInt(max);
        }
        try {
            const result = await (0, property_1.getProperties)(params);
            if (result.items && result.items.length > 0) {
                this.setData({ properties: result.items });
            }
            else {
                const props = await (0, property_1.getRecommendedProperties)(cityId).catch(() => []);
                this.setData({ properties: props });
            }
        }
        catch (e) {
            try {
                const props = await (0, property_1.getRecommendedProperties)(cityId);
                this.setData({ properties: props });
            }
            catch (_) {
                this.setData({ properties: [] });
            }
        }
    },
    onCityChange(e) {
        const { city } = e.detail;
        this.setData({
            currentCityId: city.city_id,
            currentCityName: city.city_name,
            districts: districtsForCity(city.city_id),
            selectedDistrict: '',
            selectedPriceLabel: '',
            selectedPriceRange: '',
            activeFilter: '',
        });
        const app = getApp();
        app.globalData.currentCityId = city.city_id;
        app.globalData.currentCityName = city.city_name;
        this.loadData();
    },
    onStatTap(e) {
        const type = e.currentTarget.dataset.type;
        const cityId = this.data.currentCityId || getApp().globalData.currentCityId || 310000;
        const parts = [`city_id=${cityId}`];
        if (type === 'bargain') {
            parts.push('discount_min=0.1', 'discount_max=0.65', 'auction_status=即将开拍,进行中');
            parts.push('sort_by=starting_price', 'sort_order=asc');
        }
        else if (type === 'upcoming') {
            parts.push('auction_status=即将开拍');
        }
        else if (type === 'listed') {
            parts.push('listed_day=yesterday');
        }
        else if (type === 'sold') {
            parts.push('sold_day=yesterday');
        }
        wx.navigateTo({ url: `/pages/property-list/property-list?${parts.join('&')}` });
    },
    onViewAll() {
        let params = '';
        if (this.data.selectedDistrict)
            params += `&district=${this.data.selectedDistrict}`;
        wx.navigateTo({ url: `/pages/property-list/property-list${params ? '?' + params.substring(1) : ''}` });
    },
    onMapFind() {
        wx.navigateTo({ url: '/pages/map-property/map-property' });
    },
    onArticleTap(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: `/pages/article/article?id=${id}` });
    },
    onViewAllArticles() {
        wx.navigateTo({ url: '/pages/article-list/article-list' });
    },
    onQuickFilter(e) {
        const filter = e.currentTarget.dataset.filter;
        this.setData({ activeFilter: this.data.activeFilter === filter ? '' : filter });
    },
    onSelectDistrict(e) {
        const val = e.currentTarget.dataset.value;
        this.setData({
            selectedDistrict: val,
            activeFilter: '',
        });
        this.loadProperties();
    },
    onSelectPriceRange(e) {
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
