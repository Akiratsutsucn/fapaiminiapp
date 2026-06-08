import { getFavorites } from '../../../services/user';
import { getPropertyDetail } from '../../../services/property';

Page({
  data: {
    activeTab: 'property',
    propertyList: [] as PropertyItem[],
    loading: false,
  },

  onShow() {
    if (this.data.activeTab === 'property') this.loadPropertyFavorites();
  },

  onTabSwitch(e: any) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  async loadPropertyFavorites() {
    this.setData({ loading: true });
    try {
      const res = await getFavorites('property');
      const ids = res.items.map((i: any) => i.target_id);

      // 并发请求所有房源详情，失败的返回占位对象
      const details = await Promise.all(
        ids.map((id: number) =>
          getPropertyDetail(id)
            .then((detail: any) => {
              // 确保房源有必要的字段
              if (!detail) return null;

              // 如果房源没有图片，添加占位图
              if (!detail.cover_image || detail.cover_image.length === 0) {
                detail.cover_image = 'https://via.placeholder.com/400x300?text=暂无图片';
              }

              // 标记房源状态
              if (detail.status === 'sold' || detail.status === 'removed') {
                detail.isOffline = true;
              }

              return detail;
            })
            .catch((err) => {
              console.error(`获取房源详情失败 (ID: ${id}):`, err);
              // 返回一个占位对象，表示已下架
              return {
                id,
                title: '该房源已下架',
                cover_image: 'https://via.placeholder.com/400x300?text=房源已下架',
                isOffline: true,
                status: 'removed',
              };
            })
        )
      );

      // 过滤掉null值，保留已下架的占位对象
      this.setData({
        propertyList: details.filter(Boolean) as PropertyItem[],
        loading: false,
      });
    } catch (e) {
      console.error('加载收藏失败:', e);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
  },
});
