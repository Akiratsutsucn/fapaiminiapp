import { getMapMarkers } from '../../services/property';

const CITY_CENTERS: Record<number, { lat: number; lng: number }> = {
  310000: { lat: 31.2304, lng: 121.4737 },
  330200: { lat: 29.8683, lng: 121.5440 },
  330100: { lat: 30.2741, lng: 120.1551 },
};

const DISTRICTS_BY_CITY: Record<number, string[]> = {
  310000: ['浦东新区', '静安区', '徐汇区', '黄浦区', '长宁区', '虹口区', '杨浦区', '普陀区', '宝山区', '闵行区', '嘉定区', '松江区', '青浦区', '奉贤区', '金山区', '崇明区'],
  330200: ['海曙区', '江北区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'],
  330100: ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'],
};

const PRICE_RANGES = [
  { label: '100万以下', value: '0-1000000' },
  { label: '100-300万', value: '1000000-3000000' },
  { label: '300-500万', value: '3000000-5000000' },
  { label: '500万以上', value: '5000000-' },
];

Page({
  data: {
    latitude: 31.2304,
    longitude: 121.4737,
    scale: 12,
    markers: [] as any[],
    properties: [] as any[],
    allProperties: [] as any[], // 保存全部数据用于筛选
    selectedProperty: null as any,
    loading: false,
    // 筛选相关
    activePanel: '', // 'district' | 'price' | ''
    districtOptions: [] as string[],
    selectedDistrict: '',
    priceRanges: PRICE_RANGES,
    priceRange: '',
    priceLabel: '',
  },

  onLoad() {
    const app = getApp<IAppOption>();
    const cityId = app.globalData.currentCityId || 310000;
    this.setData({
      districtOptions: DISTRICTS_BY_CITY[cityId] || DISTRICTS_BY_CITY[310000]
    });
    this.loadMarkers();
  },

  async loadMarkers() {
    this.setData({ loading: true });
    try {
      const app = getApp<IAppOption>();
      const cityId = app.globalData.currentCityId || 310000;
      const items = await getMapMarkers(cityId);

      // 不再获取用户定位，地图始终居中到当前所选城市中心
      const center = CITY_CENTERS[cityId];
      if (center) {
        this.setData({ latitude: center.lat, longitude: center.lng });
      }

      this.setData({
        allProperties: items,
        properties: items,
      });
      this.updateMarkers(items);
    } catch (e) {
      console.error('加载地图标记失败:', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 应用筛选条件
  applyFilters() {
    const { allProperties, selectedDistrict, priceRange } = this.data;
    let filtered = allProperties;

    // 区县筛选
    if (selectedDistrict) {
      filtered = filtered.filter((p: any) => p.district === selectedDistrict);
    }

    // 价格筛选
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(s => s ? parseInt(s) : null);
      filtered = filtered.filter((p: any) => {
        const price = p.starting_price || 0;
        if (min && price < min) return false;
        if (max && price > max) return false;
        return true;
      });
    }

    this.setData({ properties: filtered });
    this.updateMarkers(filtered);
  },

  // 切换筛选面板
  onTogglePanel(e: any) {
    const panel = e.currentTarget.dataset.panel;
    this.setData({ activePanel: this.data.activePanel === panel ? '' : panel });
  },

  // 关闭筛选面板
  onClosePanel() {
    this.setData({ activePanel: '' });
  },

  // 选择区县
  onSelectDistrict(e: any) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      selectedDistrict: value,
      activePanel: '',
    });
    this.applyFilters();
  },

  // 选择价格
  onSelectPrice(e: any) {
    const value = e.currentTarget.dataset.value;
    const label = e.currentTarget.dataset.label;
    this.setData({
      priceRange: value,
      priceLabel: label,
      activePanel: '',
    });
    this.applyFilters();
  },

  updateMarkers(items: any[]) {
    const markers = items
      .filter(p => p.lat && p.lng)
      .map(p => ({
        id: p.id,
        latitude: p.lat,
        longitude: p.lng,
        width: 32,
        height: 32,
        iconPath: p.auction_status === '进行中' ? '/images/marker-active.png' : '/images/marker-default.png',
        title: p.title,
        callout: {
          content: `${p.title}\n${(p.starting_price / 10000).toFixed(0)}万`,
          fontSize: 12,
          borderRadius: 8,
          padding: 8,
          display: 'BYCLICK',
        },
      }));
    this.setData({ markers });
  },

  onMarkerTap(e: any) {
    const id = e.detail.markerId;
    const prop = this.data.properties.find(p => p.id === id);
    if (prop) {
      this.setData({
        selectedProperty: {
          ...prop,
          starting_price: (prop.starting_price / 10000).toFixed(0),
        },
      });
    }
  },

  onCloseCard() {
    this.setData({ selectedProperty: null });
  },

  onCardTap() {
    if (this.data.selectedProperty) {
      wx.navigateTo({ url: `/pages/property-detail/property-detail?id=${this.data.selectedProperty.id}` });
    }
  },

  onZoomIn() {
    this.setData({ scale: Math.min(20, this.data.scale + 2) });
  },

  onZoomOut() {
    this.setData({ scale: Math.max(3, this.data.scale - 2) });
  },

  onLocate() {
    const mapCtx = wx.createMapContext('propertyMap');
    mapCtx.moveToLocation();
  },

  onRegionChange(e: any) {
    if (e.type === 'end' && e.causedBy === 'drag') {
      // future: reload properties in new viewport
    }
  },
});
