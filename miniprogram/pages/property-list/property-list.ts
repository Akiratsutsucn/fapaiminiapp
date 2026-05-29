import { getProperties, PropertyListParams } from '../../services/property';

const PRICE_LABELS: Record<string, string> = {
  '0-1000000': '100万以下',
  '1000000-3000000': '100-300万',
  '3000000-5000000': '300-500万',
  '5000000-': '500万以上',
};

Page({
  data: {
    list: [] as PropertyItem[],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
    loading: false,
    activeFilterPanel: '',
    keyword: '',
    selectedDistrict: '',
    priceRange: '',
    priceLabel: '',
    selectedPropertyType: '',
    selectedAuctionStatus: '',
    selectedAuctionRound: '',
    sortBy: 'default',
    sortOrder: 'asc',
  },

  onLoad(options: any) {
    if (options.auction_status) {
      this.setData({ selectedAuctionStatus: options.auction_status });
    }
    if (options.keyword) {
      this.setData({ keyword: options.keyword });
    }
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
      const params: PropertyListParams = {
        page: this.data.page,
        page_size: this.data.pageSize,
      };

      const app = getApp<IAppOption>();
      if (app.globalData.currentCityId) params.city_id = app.globalData.currentCityId;
      if (this.data.keyword) params.keyword = this.data.keyword;
      if (this.data.selectedDistrict) params.district = this.data.selectedDistrict;
      if (this.data.selectedPropertyType) params.property_type = this.data.selectedPropertyType;
      if (this.data.selectedAuctionStatus) params.auction_status = this.data.selectedAuctionStatus;
      if (this.data.selectedAuctionRound) params.auction_round = this.data.selectedAuctionRound;
      if (this.data.sortBy !== 'default') {
        params.sort_by = this.data.sortBy;
        params.sort_order = this.data.sortOrder;
      }
      if (this.data.priceRange) {
        const [min, max] = this.data.priceRange.split('-');
        if (min) params.price_min = parseInt(min);
        if (max) params.price_max = parseInt(max);
      }

      const result = await getProperties(params);
      const list = this.data.page === 1 ? result.items : [...this.data.list, ...result.items];
      this.setData({
        list,
        total: result.total,
        hasMore: this.data.page < result.total_pages,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onLoadMore() {
    this.setData({ page: this.data.page + 1 }, () => this.loadList());
  },

  // 搜索
  onKeywordInput(e: any) {
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

  // 筛选面板
  onTogglePanel(e: any) {
    const panel = e.currentTarget.dataset.panel;
    this.setData({
      activeFilterPanel: this.data.activeFilterPanel === panel ? '' : panel,
    });
  },

  onClosePanel() {
    this.setData({ activeFilterPanel: '' });
  },

  onSelectDistrict(e: any) {
    const val = e.currentTarget.dataset.value;
    this.setData({ selectedDistrict: val, activeFilterPanel: '', page: 1, list: [] });
    this.loadList();
  },

  onSelectPriceRange(e: any) {
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

  onSelectPropertyType(e: any) {
    const val = e.currentTarget.dataset.value;
    this.setData({ selectedPropertyType: val, activeFilterPanel: '', page: 1, list: [] });
    this.loadList();
  },

  onSelectAuctionStatus(e: any) {
    const val = e.currentTarget.dataset.value;
    this.setData({ selectedAuctionStatus: val, activeFilterPanel: '', page: 1, list: [] });
    this.loadList();
  },

  onSelectAuctionRound(e: any) {
    const val = e.currentTarget.dataset.value;
    this.setData({ selectedAuctionRound: val, activeFilterPanel: '', page: 1, list: [] });
    this.loadList();
  },

  // 排序
  onSort(e: any) {
    const sort = e.currentTarget.dataset.sort;
    if (sort === 'default') {
      this.setData({ sortBy: 'default', sortOrder: 'asc', page: 1, list: [] });
    } else if (this.data.sortBy === sort) {
      const newOrder = this.data.sortOrder === 'asc' ? 'desc' : 'asc';
      this.setData({ sortOrder: newOrder, page: 1, list: [] });
    } else {
      this.setData({ sortBy: sort, sortOrder: 'asc', page: 1, list: [] });
    }
    this.loadList();
  },
});
