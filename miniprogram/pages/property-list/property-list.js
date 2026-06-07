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
    330200: ['海曙区', '江北区', '江东区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'],
    330100: ['上城区', '下城区', '江干区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'],
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
        selectedPropertyTypes: [],
        selectedAuctionStatuses: [],
        selectedAuctionRounds: [],
        pendingPropertyTypes: [],
        pendingAuctionStatuses: [],
        pendingAuctionRounds: [],
        presetTitle: '',
        presetDiscountMin: 0,
        presetDiscountMax: 0,
        presetListedDay: '',
        presetSoldDay: '',
        sortBy: 'default',
        sortOrder: 'asc',
        showHistory: false,
        searchHistory: [],
    },
    onLoad(options) {
        const init = {};
        if (options.auction_status) {
            init.selectedAuctionStatuses = String(options.auction_status).split(',').filter(Boolean);
            init.pendingAuctionStatuses = [...init.selectedAuctionStatuses];
        }
        if (options.keyword)
            init.keyword = options.keyword;
        if (options.discount_min)
            init.presetDiscountMin = parseFloat(options.discount_min);
        if (options.discount_max)
            init.presetDiscountMax = parseFloat(options.discount_max);
        if (options.listed_day)
            init.presetListedDay = options.listed_day;
        if (options.sold_day)
            init.presetSoldDay = options.sold_day;
        if (options.sort_by)
            init.sortBy = options.sort_by;
        if (options.sort_order)
            init.sortOrder = options.sort_order;
        if (init.presetDiscountMin || init.presetDiscountMax)
            init.presetTitle = '捡漏房源';
        else if (init.presetListedDay === 'yesterday')
            init.presetTitle = '昨日上架房源';
        else if (init.presetSoldDay === 'yesterday')
            init.presetTitle = '昨日成交房源';
        else if (init.selectedAuctionStatuses && init.selectedAuctionStatuses.length === 1 && init.selectedAuctionStatuses[0] === '即将开拍') {
            init.presetTitle = '即将开拍房源';
        }
        const app = getApp();
        const cityId = parseInt(options.city_id) || app.globalData.currentCityId || 0;
        if (cityId && cityId !== app.globalData.currentCityId) {
            app.globalData.currentCityId = cityId;
            const cityNameMap = { 310000: '上海', 330200: '宁波', 330100: '杭州' };
            if (cityNameMap[cityId])
                app.globalData.currentCityName = cityNameMap[cityId];
        }
        init.currentCityId = cityId;
        init.districtOptions = districtsForCity(cityId);
        this.setData(init);
        this.loadSearchHistory();
        this.loadList();
    },
    loadSearchHistory() {
        const history = wx.getStorageSync('property_search_history') || [];
        this.setData({ searchHistory: history.slice(0, 5) });
    },
    saveSearchHistory(keyword) {
        if (!keyword || keyword.trim() === '')
            return;
        const trimmed = keyword.trim();
        let history = wx.getStorageSync('property_search_history') || [];
        history = history.filter(h => h !== trimmed);
        history.unshift(trimmed);
        history = history.slice(0, 5);
        wx.setStorageSync('property_search_history', history);
        this.setData({ searchHistory: history });
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
        wx.showLoading({ title: '加载中', mask: true });
        try {
            const params = {
                page: this.data.page,
                page_size: this.data.pageSize,
            };
            const app = getApp();
            const cityId = this.data.currentCityId || app.globalData.currentCityId;
            if (cityId)
                params.city_id = cityId;
            if (this.data.keyword)
                params.keyword = this.data.keyword;
            if (this.data.selectedDistrict)
                params.district = this.data.selectedDistrict;
            if (this.data.selectedPropertyTypes.length)
                params.property_type = this.data.selectedPropertyTypes.join(',');
            if (this.data.selectedAuctionStatuses.length)
                params.auction_status = this.data.selectedAuctionStatuses.join(',');
            if (this.data.selectedAuctionRounds.length)
                params.auction_round = this.data.selectedAuctionRounds.join(',');
            if (this.data.presetDiscountMin)
                params.discount_min = this.data.presetDiscountMin;
            if (this.data.presetDiscountMax)
                params.discount_max = this.data.presetDiscountMax;
            if (this.data.presetListedDay)
                params.listed_day = this.data.presetListedDay;
            if (this.data.presetSoldDay)
                params.sold_day = this.data.presetSoldDay;
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
            if (this.data.page === 1) {
                this.setData({
                    list: result.items,
                    total: result.total,
                    hasMore: this.data.page < result.total_pages,
                    loading: false,
                });
            }
            else {
                const start = this.data.list.length;
                const patch = {
                    total: result.total,
                    hasMore: this.data.page < result.total_pages,
                    loading: false,
                };
                result.items.forEach((it, i) => { patch[`list[${start + i}]`] = it; });
                this.setData(patch);
            }
        }
        catch (e) {
            this.setData({ loading: false });
        }
        finally {
            wx.hideLoading();
        }
    },
    onLoadMore() {
        this.setData({ page: this.data.page + 1 }, () => this.loadList());
    },
    onKeywordInput(e) {
        this.setData({ keyword: e.detail.value });
    },
    onSearch() {
        const keyword = this.data.keyword.trim();
        if (keyword) {
            this.saveSearchHistory(keyword);
        }
        this.setData({ page: 1, list: [], showHistory: false });
        this.loadList();
    },
    onSearchFocus() {
        this.setData({ showHistory: true });
    },
    onSearchBlur() {
        setTimeout(() => {
            this.setData({ showHistory: false });
        }, 200);
    },
    onTapHistory(e) {
        const kw = e.currentTarget.dataset.kw;
        this.setData({ keyword: kw, showHistory: false, page: 1, list: [] });
        this.loadList();
    },
    onClearHistory() {
        wx.removeStorageSync('property_search_history');
        this.setData({ searchHistory: [], showHistory: false });
    },
    onClearKeyword() {
        this.setData({ keyword: '', page: 1, list: [] });
        this.loadList();
    },
    onClearKeyword() {
        this.setData({ keyword: '', page: 1, list: [] });
        this.loadList();
    },
    onTogglePanel(e) {
        const panel = e.currentTarget.dataset.panel;
        if (panel === 'more' && this.data.activeFilterPanel !== 'more') {
            this.setData({
                pendingPropertyTypes: [...this.data.selectedPropertyTypes],
                pendingAuctionStatuses: [...this.data.selectedAuctionStatuses],
                pendingAuctionRounds: [...this.data.selectedAuctionRounds],
            });
        }
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
    onTogglePropertyType(e) {
        const val = e.currentTarget.dataset.value;
        const cur = [...this.data.pendingPropertyTypes];
        const idx = cur.indexOf(val);
        if (idx >= 0)
            cur.splice(idx, 1);
        else
            cur.push(val);
        this.setData({ pendingPropertyTypes: cur });
    },
    onClearPropertyTypes() {
        this.setData({ pendingPropertyTypes: [] });
    },
    onToggleAuctionStatus(e) {
        const val = e.currentTarget.dataset.value;
        const cur = [...this.data.pendingAuctionStatuses];
        const idx = cur.indexOf(val);
        if (idx >= 0)
            cur.splice(idx, 1);
        else
            cur.push(val);
        this.setData({ pendingAuctionStatuses: cur });
    },
    onToggleAuctionRound(e) {
        const val = e.currentTarget.dataset.value;
        const cur = [...this.data.pendingAuctionRounds];
        const idx = cur.indexOf(val);
        if (idx >= 0)
            cur.splice(idx, 1);
        else
            cur.push(val);
        this.setData({ pendingAuctionRounds: cur });
    },
    onResetMore() {
        this.setData({
            pendingPropertyTypes: [],
            pendingAuctionStatuses: [],
            pendingAuctionRounds: [],
        });
    },
    onConfirmMore() {
        this.setData({
            selectedPropertyTypes: [...this.data.pendingPropertyTypes],
            selectedAuctionStatuses: [...this.data.pendingAuctionStatuses],
            selectedAuctionRounds: [...this.data.pendingAuctionRounds],
            activeFilterPanel: '',
            page: 1,
            list: [],
        });
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
