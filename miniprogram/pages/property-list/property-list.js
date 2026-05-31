"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const property_1 = require("../../services/property");
const PRICE_LABELS = {
    '0-1000000': '100万以下',
    '1000000-3000000': '100-300万',
    '3000000-5000000': '300-500万',
    '5000000-': '500万以上',
};
const DISTRICTS_BY_CITY = {
    310000: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'],
    330200: ['海曙区', '江北区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'],
    330100: ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'],
};
function districtsForCity(cityId) {
    if (cityId && DISTRICTS_BY_CITY[cityId])
        return DISTRICTS_BY_CITY[cityId];
    return DISTRICTS_BY_CITY[310000];
}
Page({
    data: {
        list: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
        loading: false,
        activeFilterPanel: '',
        keyword: '',
        selectedDistrict: '',
        districtOptions: [],
        currentCityId: 0,
        priceRange: '',
        priceLabel: '',
        selectedPropertyType: '',
        selectedAuctionStatus: '',
        selectedAuctionRound: '',
        sortBy: 'default',
        sortOrder: 'asc',
    },
    onLoad(options) {
        if (options.auction_status) {
            this.setData({ selectedAuctionStatus: options.auction_status });
        }
        if (options.keyword) {
            this.setData({ keyword: options.keyword });
        }
        const app = getApp();
        const cityId = app.globalData.currentCityId || 0;
        this.setData({ currentCityId: cityId, districtOptions: districtsForCity(cityId) });
        this.loadList();
    },
    onShow() {
        const app = getApp();
        const cityId = app.globalData.currentCityId || 0;
        if (cityId === this.data.currentCityId)
            return;
        const options = districtsForCity(cityId);
        const stillValid = this.data.selectedDistrict && options.indexOf(this.data.selectedDistrict) >= 0;
        this.setData({
            currentCityId: cityId,
            districtOptions: options,
            selectedDistrict: stillValid ? this.data.selectedDistrict : '',
            page: 1,
            list: [],
        });
        this.loadList();
    },
    onPullDownRefresh() {
        this.setData({ page: 1, list: [] });
        this.loadList().finally(() => wx.stopPullDownRefresh());
    },
    onReachBottom() {
        if (this.data.hasMore && !this.data.loading) {
            this.onLoadMore();
        }
    },
    async loadList() {
        this.setData({ loading: true });
        try {
            const params = {
                page: this.data.page,
                page_size: this.data.pageSize,
            };
            const app = getApp();
            if (app.globalData.currentCityId)
                params.city_id = app.globalData.currentCityId;
            if (this.data.keyword)
                params.keyword = this.data.keyword;
            if (this.data.selectedDistrict)
                params.district = this.data.selectedDistrict;
            if (this.data.selectedPropertyType)
                params.property_type = this.data.selectedPropertyType;
            if (this.data.selectedAuctionStatus)
                params.auction_status = this.data.selectedAuctionStatus;
            if (this.data.selectedAuctionRound)
                params.auction_round = this.data.selectedAuctionRound;
            if (this.data.sortBy !== 'default') {
                params.sort_by = this.data.sortBy;
                params.sort_order = this.data.sortOrder;
            }
            if (this.data.priceRange) {
                const [min, max] = this.data.priceRange.split('-');
                if (min)
                    params.price_min = parseInt(min);
                if (max)
                    params.price_max = parseInt(max);
            }
            const result = await (0, property_1.getProperties)(params);
            const list = this.data.page === 1 ? result.items : [...this.data.list, ...result.items];
            this.setData({
                list,
                total: result.total,
                hasMore: this.data.page < result.total_pages,
                loading: false,
            });
        }
        catch (e) {
            this.setData({ loading: false });
        }
    },
    onLoadMore() {
        this.setData({ page: this.data.page + 1 }, () => this.loadList());
    },
    onKeywordInput(e) {
        this.setData({ keyword: e.detail.value });
    },
    onSearch() {
        this.setData({ page: 1, list: [] });
        this.loadList();
    },
    onClearKeyword() {
        this.setData({ keyword: '', page: 1, list: [] });
        this.loadList();
    },
    onTogglePanel(e) {
        const panel = e.currentTarget.dataset.panel;
        this.setData({
            activeFilterPanel: this.data.activeFilterPanel === panel ? '' : panel,
        });
    },
    onClosePanel() {
        this.setData({ activeFilterPanel: '' });
    },
    onSelectDistrict(e) {
        const val = e.currentTarget.dataset.value;
        this.setData({ selectedDistrict: val, activeFilterPanel: '', page: 1, list: [] });
        this.loadList();
    },
    onSelectPriceRange(e) {
        const val = e.currentTarget.dataset.value;
        this.setData({
            priceRange: val,
            priceLabel: PRICE_LABELS[val] || '',
            activeFilterPanel: '',
            page: 1,
            list: [],
        });
        this.loadList();
    },
    onSelectPropertyType(e) {
        const val = e.currentTarget.dataset.value;
        this.setData({ selectedPropertyType: val, activeFilterPanel: '', page: 1, list: [] });
        this.loadList();
    },
    onSelectAuctionStatus(e) {
        const val = e.currentTarget.dataset.value;
        this.setData({ selectedAuctionStatus: val, activeFilterPanel: '', page: 1, list: [] });
        this.loadList();
    },
    onSelectAuctionRound(e) {
        const val = e.currentTarget.dataset.value;
        this.setData({ selectedAuctionRound: val, activeFilterPanel: '', page: 1, list: [] });
        this.loadList();
    },
    onSort(e) {
        const sort = e.currentTarget.dataset.sort;
        if (sort === 'default') {
            this.setData({ sortBy: 'default', sortOrder: 'asc', page: 1, list: [] });
        }
        else if (this.data.sortBy === sort) {
            const newOrder = this.data.sortOrder === 'asc' ? 'desc' : 'asc';
            this.setData({ sortOrder: newOrder, page: 1, list: [] });
        }
        else {
            this.setData({ sortBy: sort, sortOrder: 'asc', page: 1, list: [] });
        }
        this.loadList();
    },
});
