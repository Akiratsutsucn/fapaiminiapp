"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const property_1 = require("../../services/property");
const CITY_CENTERS = {
    310000: { lat: 31.2304, lng: 121.4737 },
    330200: { lat: 29.8683, lng: 121.5440 },
    330100: { lat: 30.2741, lng: 120.1551 },
};
const DISTRICTS_BY_CITY = {
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
const TYPE_OPTIONS = [
    { label: '住宅', value: 'zhuzhai', ptype: '住宅' },
    { label: '商铺', value: 'shangpu', ptype: '商业', sub: ['商铺', '店铺', '门面', '门市', '档口', '底商'] },
    { label: '写字楼', value: 'xiezilou', ptype: '商业,办公', sub: ['写字楼', '写字间', '办公'] },
    { label: '商住房', value: 'shangzhu', ptype: '商业', sub: ['商住', '公寓', 'loft', 'LOFT', '酒店式'] },
    { label: '工业用房', value: 'gongye', ptype: '工业' },
    { label: '其他商用', value: 'qita', ptype: '商业,办公,其他' },
];
const SCALE_DISTRICT = 11;
const SCALE_SUBDIST = 13;
Page({
    data: {
        latitude: 31.2304,
        longitude: 121.4737,
        scale: 11,
        markers: [],
        properties: [],
        selectedProperty: null,
        loading: false,
        viewLevel: 'district',
        activePanel: '',
        districtOptions: [],
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
        const app = getApp();
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
    buildFilters() {
        const { selectedDistrict, priceRange, areaRange, selectedType, keyword } = this.data;
        const f = { city_id: this._cityId };
        if (selectedDistrict)
            f.district = selectedDistrict;
        if (priceRange) {
            const [mn, mx] = priceRange.split('-');
            if (mn)
                f.price_min = parseInt(mn);
            if (mx)
                f.price_max = parseInt(mx);
        }
        if (areaRange) {
            const [mn, mx] = areaRange.split('-');
            if (mn)
                f.area_min = parseInt(mn);
            if (mx)
                f.area_max = parseInt(mx);
        }
        if (selectedType) {
            const t = TYPE_OPTIONS.find(o => o.value === selectedType);
            if (t)
                f.property_type = t.ptype;
        }
        if (keyword)
            f.keyword = keyword;
        return f;
    },
    refresh() {
        const scale = this.data.scale;
        if (scale < SCALE_DISTRICT) {
            this.loadAggregate('district');
        }
        else if (scale < SCALE_SUBDIST) {
            this.loadAggregate('sub_district');
        }
        else {
            this.loadProperties();
        }
    },
    async loadAggregate(level) {
        this.setData({ loading: true, viewLevel: level });
        try {
            const filters = this.buildFilters();
            if (level === 'sub_district' && this.data.selectedDistrict) {
                filters.district = this.data.selectedDistrict;
            }
            const groups = await (0, property_1.getMapAggregate)(level, filters);
            const bg = level === 'district' ? '#009688' : '#FF8A00';
            const markers = groups
                .filter(g => g.center_lat && g.center_lng)
                .map((g, idx) => ({
                id: 1000000 + idx,
                latitude: g.center_lat,
                longitude: g.center_lng,
                iconPath: '/images/marker-blank.png',
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
                    anchorX: -36,
                    anchorY: -16,
                },
            }));
            this.setData({ markers, properties: [], selectedProperty: null });
        }
        catch (e) {
            console.error('加载聚合失败:', e);
        }
        finally {
            this.setData({ loading: false });
        }
    },
    async loadProperties() {
        this.setData({ loading: true, viewLevel: 'property' });
        try {
            const items = await (0, property_1.getMapMarkers)(this.buildFilters());
            const filtered = this.applySubtypeFilter(items);
            this.setData({ properties: filtered });
            this.updatePropertyMarkers(filtered);
        }
        catch (e) {
            console.error('加载房源点失败:', e);
        }
        finally {
            this.setData({ loading: false });
        }
    },
    applySubtypeFilter(items) {
        const t = TYPE_OPTIONS.find(o => o.value === this.data.selectedType);
        if (!t || !t.sub)
            return items;
        const subs = t.sub;
        return items.filter(p => {
            const text = `${p.title || ''}`;
            return subs.some(k => text.includes(k));
        });
    },
    markerIcon(ptype) {
        if (ptype === '住宅')
            return '/images/marker-residential.png';
        if (ptype === '商业' || ptype === '办公')
            return '/images/marker-commercial.png';
        return '/images/marker-other.png';
    },
    updatePropertyMarkers(items) {
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
    onMarkerTap(e) {
        const id = e.detail.markerId;
        if (id >= 1000000) {
            const m = this.data.markers.find((x) => x.id === id);
            if (!m)
                return;
            if (m._aggLevel === 'district') {
                this.setData({
                    selectedDistrict: m._aggName,
                    latitude: m.latitude,
                    longitude: m.longitude,
                    scale: SCALE_DISTRICT + 1,
                });
                this.loadAggregate('sub_district');
            }
            else {
                this.setData({ latitude: m.latitude, longitude: m.longitude, scale: SCALE_SUBDIST + 1 });
                this.loadProperties();
            }
            return;
        }
        const prop = this.data.properties.find((p) => p.id === id);
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
    _applyScale(scale) {
        wx.createMapContext('propertyMap').getCenterLocation({
            success: (res) => {
                this.setData({ scale, latitude: res.latitude, longitude: res.longitude });
                this.onScaleChanged(scale);
            },
            fail: () => {
                this.setData({ scale });
                this.onScaleChanged(scale);
            },
        });
    },
    onZoomIn() {
        this._applyScale(Math.min(20, this.data.scale + 2));
    },
    onZoomOut() {
        this._applyScale(Math.max(3, this.data.scale - 2));
    },
    onLocate() {
        wx.createMapContext('propertyMap').moveToLocation({});
    },
    _lastLevel: '',
    onScaleChanged(scale) {
        const level = scale < SCALE_DISTRICT ? 'district' : scale < SCALE_SUBDIST ? 'sub_district' : 'property';
        if (level !== this.data.viewLevel) {
            this.refresh();
        }
    },
    onRegionChange(e) {
        if (e.type === 'end') {
            wx.createMapContext('propertyMap').getCenterLocation({
                success: (res) => {
                    const scale = e.detail && e.detail.scale ? Math.round(e.detail.scale) : this.data.scale;
                    const patch = { latitude: res.latitude, longitude: res.longitude };
                    if (scale !== this.data.scale)
                        patch.scale = scale;
                    this.setData(patch);
                    if (scale !== this.data.scale)
                        this.onScaleChanged(scale);
                },
                fail: () => {
                    const scale = e.detail && e.detail.scale ? Math.round(e.detail.scale) : this.data.scale;
                    if (scale !== this.data.scale) {
                        this.setData({ scale });
                        this.onScaleChanged(scale);
                    }
                },
            });
        }
    },
    onTogglePanel(e) {
        const panel = e.currentTarget.dataset.panel;
        this.setData({ activePanel: this.data.activePanel === panel ? '' : panel });
    },
    onClosePanel() { this.setData({ activePanel: '' }); },
    onSelectDistrict(e) {
        this.setData({ selectedDistrict: e.currentTarget.dataset.value, activePanel: '' });
        this.refresh();
    },
    onSelectPrice(e) {
        this.setData({ priceRange: e.currentTarget.dataset.value, priceLabel: e.currentTarget.dataset.label, activePanel: '' });
        this.refresh();
    },
    onSelectArea(e) {
        this.setData({ areaRange: e.currentTarget.dataset.value, areaLabel: e.currentTarget.dataset.label, activePanel: '' });
        this.refresh();
    },
    onSelectType(e) {
        this.setData({ selectedType: e.currentTarget.dataset.value, typeLabel: e.currentTarget.dataset.label, activePanel: '' });
        this.refresh();
    },
    onKeywordInput(e) { this.setData({ keyword: e.detail.value }); },
    onKeywordConfirm() { this.refresh(); },
    onKeywordClear() { this.setData({ keyword: '' }); this.refresh(); },
});
