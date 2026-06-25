import { getMapMarkers, getMapAggregate, MapFilterParams } from '../../services/property';

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

const AREA_RANGES = [
  { label: '50㎡以下', value: '0-50' },
  { label: '50-90㎡', value: '50-90' },
  { label: '90-140㎡', value: '90-140' },
  { label: '140㎡以上', value: '140-' },
];

// 类型筛选。property_type 已细分入库(住宅/商铺/写字楼/商住房/其他商用/工业),直接按值筛。
const TYPE_OPTIONS = [
  { label: '住宅', value: '住宅', ptype: '住宅' },
  { label: '商铺', value: '商铺', ptype: '商铺' },
  { label: '写字楼', value: '写字楼', ptype: '写字楼' },
  { label: '商住房', value: '商住房', ptype: '商住房' },
  { label: '其他商用', value: '其他商用', ptype: '其他商用' },
  { label: '工业用房', value: '工业', ptype: '工业' },
];

// scale 阈值:决定显示哪一级。微信地图 scale 3~20,放大手势约每次+1。
const SCALE_DISTRICT = 11;   // < 11 区县气泡
const SCALE_SUBDIST = 13;    // 11~12 商圈气泡; >=13 房源点(放大到13即切具体房源)

Page({
  data: {
    latitude: 31.2304,
    longitude: 121.4737,
    scale: 11,
    markers: [] as any[],
    properties: [] as any[],       // 当前房源点(scale>13时)
    selectedProperty: null as any,
    loading: false,
    viewLevel: 'district' as 'district' | 'sub_district' | 'property',
    // 筛选
    activePanel: '',               // district | price | type | area | ''
    districtOptions: [] as string[],
    selectedDistrict: '',
    priceRanges: PRICE_RANGES,
    priceRange: '',
    priceLabel: '',
    areaRanges: AREA_RANGES,
    areaRange: '',
    areaLabel: '',
    typeOptions: TYPE_OPTIONS,
    selectedType: '',
    typeLabel: '',
    keyword: '',
  },

  _cityId: 310000,

  onLoad() {
    const app = getApp<IAppOption>();
    const cityId = app.globalData.currentCityId || 310000;
    this._cityId = cityId;
    const center = CITY_CENTERS[cityId] || CITY_CENTERS[310000];
    this.setData({
      latitude: center.lat,
      longitude: center.lng,
      districtOptions: DISTRICTS_BY_CITY[cityId] || DISTRICTS_BY_CITY[310000],
    });
    this.refresh();
  },

  // 组装当前筛选参数(传给后端)
  buildFilters(): MapFilterParams {
    const { selectedDistrict, priceRange, areaRange, selectedType, keyword } = this.data;
    const f: MapFilterParams = { city_id: this._cityId };
    if (selectedDistrict) f.district = selectedDistrict;
    if (priceRange) {
      const [mn, mx] = priceRange.split('-');
      if (mn) f.price_min = parseInt(mn);
      if (mx) f.price_max = parseInt(mx);
    }
    if (areaRange) {
      const [mn, mx] = areaRange.split('-');
      if (mn) f.area_min = parseInt(mn);
      if (mx) f.area_max = parseInt(mx);
    }
    if (selectedType) {
      const t = TYPE_OPTIONS.find(o => o.value === selectedType);
      if (t) f.property_type = t.ptype;
    }
    if (keyword) f.keyword = keyword;
    return f;
  },

  // 根据 scale 决定层级并刷新(显式传 scale,避免依赖异步的 this.data.scale)
  refresh(scale?: number) {
    const s = scale !== undefined ? scale : this.data.scale;
    if (s < SCALE_DISTRICT) {
      this.loadAggregate('district');
    } else if (s < SCALE_SUBDIST) {
      this.loadAggregate('sub_district');
    } else {
      this.loadProperties();
    }
  },

  // 加载聚合气泡(区县 / 商圈)
  async loadAggregate(level: 'district' | 'sub_district') {
    this.setData({ loading: true, viewLevel: level });
    try {
      const filters = this.buildFilters();
      // 商圈级:若已选区县,限定该区县;否则按当前选中区县或全部
      if (level === 'sub_district' && this.data.selectedDistrict) {
        filters.district = this.data.selectedDistrict;
      }
      const groups = await getMapAggregate(level, filters);
      const bg = level === 'district' ? '#009688' : '#FF8A00';
      const markers = groups
        .filter(g => g.center_lat && g.center_lng)
        .map((g, idx) => ({
          id: 1000000 + idx,         // 聚合marker用大id区分,避免和房源id冲突
          latitude: g.center_lat,
          longitude: g.center_lng,
          iconPath: '/images/marker-blank.png',  // 透明占位,气泡本体由label实色背景呈现
          width: 1,
          height: 1,
          anchor: { x: 0.5, y: 0.5 },
          _aggName: g.name,
          _aggLevel: level,
          label: {
            content: `${g.name} ${g.count}套`,
            color: '#FFFFFF',
            fontSize: 12,
            bgColor: bg,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            textAlign: 'center',
            padding: 10,
            anchorX: -36,   // 横向左移,使气泡大致以坐标点为中心
            anchorY: -16,
          },
        }));
      this.setData({ markers, properties: [], selectedProperty: null });
    } catch (e) {
      console.error('加载聚合失败:', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载具体房源点(scale > 13)
  async loadProperties() {
    this.setData({ loading: true, viewLevel: 'property' });
    try {
      const items = await getMapMarkers(this.buildFilters());
      this.setData({ properties: items });
      this.updatePropertyMarkers(items);
    } catch (e) {
      console.error('加载房源点失败:', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 商业蓝 / 住宅红 / 其他灰
  markerIcon(ptype: string): string {
    if (ptype === '住宅') return '/images/marker-residential.png';
    // 商用各细分(商铺/写字楼/商住房/其他商用)+ 旧值商业/办公 → 蓝色
    if (['商铺', '写字楼', '商住房', '其他商用', '商业', '办公'].indexOf(ptype) >= 0) {
      return '/images/marker-commercial.png';
    }
    return '/images/marker-other.png';
  },

  updatePropertyMarkers(items: any[]) {
    const markers = items
      .filter(p => p.lat && p.lng)
      .map(p => ({
        id: p.id,
        latitude: p.lat,
        longitude: p.lng,
        iconPath: this.markerIcon(p.property_type),
        width: 30,
        height: 36,
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
    // 聚合marker:点击下钻
    if (id >= 1000000) {
      const m = this.data.markers.find((x: any) => x.id === id);
      if (!m) return;
      if (m._aggLevel === 'district') {
        // 下钻到该区县的商圈级
        this.setData({
          selectedDistrict: m._aggName,
          latitude: m.latitude,
          longitude: m.longitude,
          scale: SCALE_DISTRICT + 1,
        });
        this.loadAggregate('sub_district');
      } else {
        // 商圈级 → 房源点
        this.setData({ latitude: m.latitude, longitude: m.longitude, scale: SCALE_SUBDIST + 1 });
        this.loadProperties();
      }
      return;
    }
    // 房源点:显示底部卡片
    const prop = this.data.properties.find((p: any) => p.id === id);
    if (prop) {
      this.setData({
        selectedProperty: { ...prop, starting_price: (prop.starting_price / 10000).toFixed(0) },
      });
    }
  },

  onCloseCard() { this.setData({ selectedProperty: null }); },

  onCardTap() {
    if (this.data.selectedProperty) {
      wx.navigateTo({ url: `/pages/property-detail/property-detail?id=${this.data.selectedProperty.id}` });
    }
  },

  // scale → 层级
  levelOf(scale: number): 'district' | 'sub_district' | 'property' {
    return scale < SCALE_DISTRICT ? 'district' : scale < SCALE_SUBDIST ? 'sub_district' : 'property';
  },

  // 地图移动/缩放(含手势)结束:只读取真实 scale 判断层级,层级变了才重载 markers。
  // 关键:绝不在这里 setData(scale/latitude/longitude)——map 的这些是绑定属性,
  // 回写会强制地图跳到该值,与用户手势冲突,造成"放大又自动缩小、不平滑"。
  // 当前 scale/中心由地图自身维护;只把它们记到非渲染的内部变量供下钻/筛选时用。
  _curScale: 11 as number,
  onRegionChange(e: any) {
    if (e.type !== 'end') return;
    const handle = (scale: number) => {
      if (!scale || isNaN(scale)) return;
      this._curScale = scale;
      const level = this.levelOf(scale);
      if (level !== this.data.viewLevel) {
        this.refresh(scale);   // 只重载 markers,不动 scale/中心(避免打断手势)
      }
    };
    const evScale = e.detail && e.detail.scale;
    if (evScale && !isNaN(evScale)) {
      handle(evScale);
      return;
    }
    wx.createMapContext('propertyMap').getScale({
      success: (sr: any) => handle(sr.scale),
      fail: () => {},
    } as any);
  },

  // ===== 筛选交互 =====
  onTogglePanel(e: any) {
    const panel = e.currentTarget.dataset.panel;
    this.setData({ activePanel: this.data.activePanel === panel ? '' : panel });
  },
  onClosePanel() { this.setData({ activePanel: '' }); },

  onSelectDistrict(e: any) {
    this.setData({ selectedDistrict: e.currentTarget.dataset.value, activePanel: '' });
    this.refresh();
  },
  onSelectPrice(e: any) {
    this.setData({ priceRange: e.currentTarget.dataset.value, priceLabel: e.currentTarget.dataset.label, activePanel: '' });
    this.refresh();
  },
  onSelectArea(e: any) {
    this.setData({ areaRange: e.currentTarget.dataset.value, areaLabel: e.currentTarget.dataset.label, activePanel: '' });
    this.refresh();
  },
  onSelectType(e: any) {
    this.setData({ selectedType: e.currentTarget.dataset.value, typeLabel: e.currentTarget.dataset.label, activePanel: '' });
    this.refresh();
  },
  onKeywordInput(e: any) { this.setData({ keyword: e.detail.value }); },
  onKeywordConfirm() { this.refresh(); },
  onKeywordClear() { this.setData({ keyword: '' }); this.refresh(); },
});
