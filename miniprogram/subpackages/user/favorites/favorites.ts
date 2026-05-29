import { getFavorites } from '../../../services/user';
import { getPropertyDetail } from '../../../services/property';

Page({
  data: { activeTab: 'property', propertyList: [] as PropertyItem[] },
  onShow() { if (this.data.activeTab === 'property') this.loadPropertyFavorites(); },
  onTabSwitch(e: any) { this.setData({ activeTab: e.currentTarget.dataset.tab }); },

  async loadPropertyFavorites() {
    try {
      const res = await getFavorites('property');
      const ids = res.items.map((i: any) => i.target_id);
      const details = await Promise.all(ids.map((id: number) => getPropertyDetail(id).catch(() => null)));
      this.setData({ propertyList: details.filter(Boolean) as PropertyItem[] });
    } catch (e) {
      console.error('加载收藏失败:', e);
    }
  },
});
