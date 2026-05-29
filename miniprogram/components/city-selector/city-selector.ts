Component({
  properties: {
    cities: { type: Array, value: [] as CityItem[] },
    currentCityId: { type: Number, value: 310000 },
    currentCityName: { type: String, value: '上海' },
  },
  data: { visible: false },
  methods: {
    onToggle() { this.setData({ visible: true }); },
    onClose() { this.setData({ visible: false }); },
    noop() {},
    onSelect(e: any) {
      const ds = e.currentTarget.dataset;
      const cityId = Number(ds.cityId);
      const cityName = ds.cityName || '';
      this.setData({
        currentCityId: cityId,
        currentCityName: cityName,
        visible: false,
      });
      this.triggerEvent('change', { city: { city_id: cityId, city_name: cityName } });
    },
  },
});
