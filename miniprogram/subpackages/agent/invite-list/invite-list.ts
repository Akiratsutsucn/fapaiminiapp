import { request } from '../../../utils/request';
import { formatDate } from '../../../utils/format';

Page({
  data: {
    list: [] as any[],
    loading: true,
  },

  onShow() {
    this.loadList();
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const data = await request<any[]>({ url: '/agent/invite-list' });
      this.setData({
        list: (data || []).map((u: any) => ({
          ...u,
          created_at: u.created_at ? formatDate(u.created_at, 'YYYY-MM-DD HH:mm') : '',
        })),
        loading: false,
      });
    } catch (e) {
      console.error('加载邀请列表失败:', e);
      this.setData({ loading: false });
    }
  },

  onCreatePoster() {
    wx.navigateTo({ url: '/subpackages/agent/invite-poster/invite-poster' });
  },
});
