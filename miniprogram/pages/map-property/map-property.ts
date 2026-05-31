import { getMapMarkers } from '../../services/property';

const CITY_CENTERS: Record<number, { lat: number; lng: number }> = {
  310000: { lat: 31.2304, lng: 121.4737 },
  330200: { lat: 29.8683, lng: 121.5440 },
  330100: { lat: 30.2741, lng: 120.1551 },
};

Page({
  data: {
    latitude: 31.2304,
    longitude: 121.4737,
    scale: 12,
    markers: [] as any[],
    properties: [] as any[],
    selectedProperty: null as any,
    loading: false,
  },

  onLoad() {
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
      const app = getApp<IAppOption>();
      const cityId = app.globalData.currentCityId || 310000;
      const items = await getMapMarkers(cityId);

      // Fall back to city center if no user location
      const center = CITY_CENTERS[cityId];
      if (center && !this.data.latitude) {
        this.setData({ latitude: center.lat, longitude: center.lng });
      }

      this.setData({ properties: items });
      this.updateMarkers(items);
    } catch (e) {
      console.error('加载地图标记失败:', e);
    } finally {
      this.setData({ loading: false });
    }
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
