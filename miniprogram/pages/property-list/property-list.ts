import { getProperties, PropertyListParams } from '../../services/property';

const PRICE_LABELS: Record<string, string> = {
  '0-1000000': '100万以下',
  '1000000-3000000': '100-300万',
  '3000000-5000000': '300-500万',
  '5000000-': '500万以上',
};

// 各城市区县表（与管理后台 PropertyList.vue 保持一致）
// 注意：杭州的「下城区」「江干区」、宁波的「江东区」是合并前的旧区，按用户要求保留在筛选项中。
const DISTRICTS_BY_CITY: Record<number, string[]> = {
  310000: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'],
  330200: ['海曙区', '江北区', '江东区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'],
  330100: ['上城区', '下城区', '江干区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'],
};

function districtsForCity(cityId: number | undefined): string[] {
  if (cityId && DISTRICTS_BY_CITY[cityId]) return DISTRICTS_BY_CITY[cityId];
  return DISTRICTS_BY_CITY[310000];
}

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
    districtOptions: [] as string[],
    currentCityId: 0,
    priceRange: '',
    priceLabel: '',
    // 多选筛选：物业类型/拍卖状态/拍卖轮次都改为字符串数组
    selectedPropertyTypes: [] as string[],
    selectedAuctionStatuses: [] as string[],
    selectedAuctionRounds: [] as string[],
    // 「更多」面板的暂存值（点确认前不应用），避免每次切换都触发请求
    pendingPropertyTypes: [] as string[],
    pendingAuctionStatuses: [] as string[],
    pendingAuctionRounds: [] as string[],
    // 入口附带的固定过滤（捡漏/昨日上架/昨日成交），用户不能在面板里清掉，只能换入口
    presetTitle: '',
    presetDiscountMin: 0,
    presetDiscountMax: 0,
    presetListedDay: '',
    presetSoldDay: '',
    sortBy: 'default',
    sortOrder: 'asc',
    // 搜索历史
    showHistory: false,
    searchHistory: [] as string[],
  },

  onLoad(options: any) {
    // 从 URL 解析所有可能的入口参数
    const init: any = {};
    if (options.auction_status) {
      // 兼容多状态（逗号分隔）
      init.selectedAuctionStatuses = String(options.auction_status).split(',').filter(Boolean);
      init.pendingAuctionStatuses = [...init.selectedAuctionStatuses];
    }
    if (options.keyword) init.keyword = options.keyword;
    if (options.discount_min) init.presetDiscountMin = parseFloat(options.discount_min);
    if (options.discount_max) init.presetDiscountMax = parseFloat(options.discount_max);
    if (options.listed_day) init.presetListedDay = options.listed_day;
    if (options.sold_day) init.presetSoldDay = options.sold_day;
    if (options.sort_by) init.sortBy = options.sort_by;
    if (options.sort_order) init.sortOrder = options.sort_order;

    // 入口标题：用于结果区上方提示「捡漏房源」「昨日上架房源」等
    if (init.presetDiscountMin || init.presetDiscountMax) init.presetTitle = '捡漏房源';
    else if (init.presetListedDay === 'yesterday') init.presetTitle = '昨日上架房源';
    else if (init.presetSoldDay === 'yesterday') init.presetTitle = '昨日成交房源';
    else if (init.selectedAuctionStatuses && init.selectedAuctionStatuses.length === 1 && init.selectedAuctionStatuses[0] === '即将开拍') {
      init.presetTitle = '即将开拍房源';
    }

    // city_id 优先取 URL，再取 globalData，保证从首页四按钮跳进来时强制按所选城市过滤
    const app = getApp<IAppOption>();
    const cityId = parseInt(options.city_id) || app.globalData.currentCityId || 0;
    if (cityId && cityId !== app.globalData.currentCityId) {
      // 同步首页选中城市，避免用户回到首页看到的是旧城市
      app.globalData.currentCityId = cityId;
      const cityNameMap: Record<number, string> = { 310000: '上海', 330200: '宁波', 330100: '杭州' };
      if (cityNameMap[cityId]) app.globalData.currentCityName = cityNameMap[cityId];
    }
    init.currentCityId = cityId;
    init.districtOptions = districtsForCity(cityId);

    this.setData(init);
    this.loadSearchHistory();
    this.loadList();
  },

  // 加载搜索历史
  loadSearchHistory() {
    const history = wx.getStorageSync('property_search_history') || [];
    this.setData({ searchHistory: history.slice(0, 5) });
  },

  // 保存搜索历史
  saveSearchHistory(keyword: string) {
    if (!keyword || keyword.trim() === '') return;
    const trimmed = keyword.trim();
    let history: string[] = wx.getStorageSync('property_search_history') || [];
    // 去重：移除已存在的
    history = history.filter(h => h !== trimmed);
    // 添加到最前面
    history.unshift(trimmed);
    // 只保留最近 5 条
    history = history.slice(0, 5);
    wx.setStorageSync('property_search_history', history);
    this.setData({ searchHistory: history });
  },

  onShow() {
    // 城市可能在首页被切换：同步区县选项，并清掉不属于新城市的已选区县
    const app = getApp<IAppOption>();
    const cityId = app.globalData.currentCityId || 0;
    if (cityId === this.data.currentCityId) return;

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
    // 筛选耗时时显示 loading，加载完成自动消失（首页跳转/换条件触发的场景都会经过这里）
    wx.showLoading({ title: '加载中', mask: true });
    try {
      const params: PropertyListParams = {
        page: this.data.page,
        page_size: this.data.pageSize,
      };

      // 优先用本页 currentCityId（来自 URL 入口），再退到 globalData
      const app = getApp<IAppOption>();
      const cityId = this.data.currentCityId || app.globalData.currentCityId;
      if (cityId) params.city_id = cityId;
      if (this.data.keyword) params.keyword = this.data.keyword;
      if (this.data.selectedDistrict) params.district = this.data.selectedDistrict;
      // 多选 → 逗号分隔，后端 _multi() 已兼容
      if (this.data.selectedPropertyTypes.length) params.property_type = this.data.selectedPropertyTypes.join(',');
      if (this.data.selectedAuctionStatuses.length) params.auction_status = this.data.selectedAuctionStatuses.join(',');
      if (this.data.selectedAuctionRounds.length) params.auction_round = this.data.selectedAuctionRounds.join(',');
      // 入口附带的固定过滤
      if (this.data.presetDiscountMin) (params as any).discount_min = this.data.presetDiscountMin;
      if (this.data.presetDiscountMax) (params as any).discount_max = this.data.presetDiscountMax;
      if (this.data.presetListedDay) (params as any).listed_day = this.data.presetListedDay;
      if (this.data.presetSoldDay) (params as any).sold_day = this.data.presetSoldDay;
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
      if (this.data.page === 1) {
        this.setData({
          list: result.items,
          total: result.total,
          hasMore: this.data.page < result.total_pages,
          loading: false,
        });
      } else {
        // 上拉加载只下发新增的一页（路径语法增量追加），避免把已渲染的
        // 全量列表重复 setData。列表越长收益越大，显著缓解滚动/切换跳帧。
        const start = this.data.list.length;
        const patch: Record<string, any> = {
          total: result.total,
          hasMore: this.data.page < result.total_pages,
          loading: false,
        };
        result.items.forEach((it: any, i: number) => { patch[`list[${start + i}]`] = it; });
        this.setData(patch);
      }
    } catch (e) {
      this.setData({ loading: false });
    } finally {
      wx.hideLoading();
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
    const keyword = this.data.keyword.trim();
    if (keyword) {
      this.saveSearchHistory(keyword);
    }
    this.setData({ page: 1, list: [], showHistory: false });
    this.loadList();
  },

  // 搜索框聚焦
  onSearchFocus() {
    this.setData({ showHistory: true });
  },

  // 搜索框失焦
  onSearchBlur() {
    // 延迟关闭，让点击历史标签的事件能触发
    setTimeout(() => {
      this.setData({ showHistory: false });
    }, 200);
  },

  // 点击搜索历史
  onTapHistory(e: any) {
    const kw = e.currentTarget.dataset.kw;
    this.setData({ keyword: kw, showHistory: false, page: 1, list: [] });
    this.loadList();
  },

  // 清空搜索历史
  onClearHistory() {
    wx.removeStorageSync('property_search_history');
    this.setData({ searchHistory: [], showHistory: false });
  },

  // 清空搜索关键词
  onClearKeyword() {
    this.setData({ keyword: '', page: 1, list: [] });
    this.loadList();
  },

  onClearKeyword() {
    this.setData({ keyword: '', page: 1, list: [] });
    this.loadList();
  },

  // 筛选面板
  onTogglePanel(e: any) {
    const panel = e.currentTarget.dataset.panel;
    // 进入「更多」面板时，把当前已应用值同步到 pending，关闭即可弃用
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

  // 多选切换：物业类型/拍卖状态/拍卖轮次
  onTogglePropertyType(e: any) {
    const val = e.currentTarget.dataset.value;
    const cur = [...this.data.pendingPropertyTypes];
    const idx = cur.indexOf(val);
    if (idx >= 0) cur.splice(idx, 1); else cur.push(val);
    this.setData({ pendingPropertyTypes: cur });
  },

  // 物业类型「全部」：只清空物业类型，不影响拍卖状态/轮次的已选
  onClearPropertyTypes() {
    this.setData({ pendingPropertyTypes: [] });
  },

  onToggleAuctionStatus(e: any) {
    const val = e.currentTarget.dataset.value;
    const cur = [...this.data.pendingAuctionStatuses];
    const idx = cur.indexOf(val);
    if (idx >= 0) cur.splice(idx, 1); else cur.push(val);
    this.setData({ pendingAuctionStatuses: cur });
  },

  onToggleAuctionRound(e: any) {
    const val = e.currentTarget.dataset.value;
    const cur = [...this.data.pendingAuctionRounds];
    const idx = cur.indexOf(val);
    if (idx >= 0) cur.splice(idx, 1); else cur.push(val);
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
