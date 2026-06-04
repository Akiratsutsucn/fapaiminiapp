// 为你推荐页面
import { getRecommendations, markRecommendationRead } from '../../../services/user';

Page({
  data: { list: [] as any[] },
  onShow() { this.loadData(); },
  async loadData() {
    try {
      const res = await getRecommendations(1, 50);
      this.setData({ list: res.items || [] });
    } catch (e) {
      console.error('加载推荐失败:', e);
    }
  },
  onTapItem(e: any) {
    const id = e.currentTarget.dataset.id;
    const recId = e.currentTarget.dataset.rec;
    if (recId) markRecommendationRead(recId).catch(() => {});
    wx.navigateTo({ url: `/pages/property-detail/property-detail?id=${id}` });
  },
});
