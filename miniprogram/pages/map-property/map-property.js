"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const property_1 = require("../../services/property");
const CITY_CENTERS = {
    310000: { lat: 31.2304, lng: 121.4737 },
    330200: { lat: 29.8683, lng: 121.5440 },
    330100: { lat: 30.2741, lng: 120.1551 },
};
const DISTRICTS_BY_CITY = {
    310000: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'],
    330200: ['海曙区', '江北区', '江东区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'],
    330100: ['上城区', '下城区', '江干区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'],
};
const PRICE_RANGES = [
    { label: '100万以下', value: '0-1000000' },
    { label: '100-300万', value: '1000000-3000000' },
    { label: '300-500万', value: '3000000-5000000' },
    { label: '500万以上', value: '5000000-' },
];
function districtsForCity(cityId) {
    return DISTRICTS_BY_CITY[cityId] || DISTRICTS_BY_CITY[310000];
}
Page({
    data: {
        latitude: 31.2304,
        longitude: 121.4737,
        scale: 12,
        markers: [],
        properties: [],
        selectedProperty: null,
        loading: false,
        activePanel: '',
        districtOptions: districtsForCity(310000),
        selectedDistrict: '',
        priceRanges: PRICE_RANGES,
        priceRange: '',
        priceLabel: '',
    },
    onLoad() {
        const app = getApp();
        const cityId = app.globalData.currentCityId || 310000;
        this.setData({ districtOptions: districtsForCity(cityId) });
        this.getLocation();
    },
    getLocation() {
        wx.getLocation({
            type: 'gcj02',
            success: (res) => {
                this.setData({ latitude: res.latitude, longitude: res.longitude });
                this.loadMarkers();
            },
            fail: () => {
                this.loadMarkers();
            },
        });
    },
    async loadMarkers() {
        this.setData({ loading: true });
        try {
            const app = getApp();
            const cityId = app.globalData.currentCityId || 310000;
            const items = await (0, property_1.getMapMarkers)(cityId);
            const center = CITY_CENTERS[cityId];
            if (center && !this.data.latitude) {
                this.setData({ latitude: center.lat, longitude: center.lng });
            }
            this.allProperties = items;
            const filtered = this.applyFilters(items);
            this.setData({ properties: filtered });
            this.updateMarkers(filtered);
        }
        catch (e) {
            console.error('加载地图标记失败:', e);
        }
        finally {
            this.setData({ loading: false });
        }
    },
    applyFilters(items) {
        let result = items || [];
        const district = this.data.selectedDistrict;
        if (district) {
            result = result.filter(p => p.district === district);
        }
        const range = this.data.priceRange;
        if (range) {
            const [min, max] = range.split('-');
            const minV = min ? parseInt(min) : 0;
            const maxV = max ? parseInt(max) : Infinity;
            result = result.filter(p => {
                const price = p.starting_price || 0;
                return price >= minV && price <= maxV;
            });
        }
        return result;
    },
    refreshMarkers() {
        const filtered = this.applyFilters(this.allProperties || []);
        this.setData({ properties: filtered });
        this.updateMarkers(filtered);
    },
    onTogglePanel(e) {
        const panel = e.currentTarget.dataset.panel;
        this.setData({ activePanel: this.data.activePanel === panel ? '' : panel });
    },
    onClosePanel() {
        this.setData({ activePanel: '' });
    },
    onSelectDistrict(e) {
        const val = e.currentTarget.dataset.value;
        this.setData({ selectedDistrict: val, activePanel: '' });
        this.refreshMarkers();
    },
    onSelectPrice(e) {
        const val = e.currentTarget.dataset.value;
        const label = e.currentTarget.dataset.label;
        this.setData({ priceRange: val, priceLabel: label, activePanel: '' });
        this.refreshMarkers();
    },
    updateMarkers(items) {
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
    onMarkerTap(e) {
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
    onRegionChange(e) {
        if (e.type === 'end' && e.causedBy === 'drag') {
        }
    },
});
