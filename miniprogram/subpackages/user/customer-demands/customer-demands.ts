// 客户需求管理（业务员/代理商）
import { getMyDemands, markMyDemandRead, updateMyDemandStatus } from '../../../services/user';

Page({
  data: { list: [] as any[] },
  onShow() { this.loadData(); },
  async loadData() {
    try {
      const res = await getMyDemands(1, 50);
      const statusMap: Record<string, string> = { '待处理': 'pending', '已分配': 'assigned', '已完成': 'done' };
      const list = (res.items || []).map((d: any) => ({ ...d, statusClass: statusMap[d.status] || 'pending' }));
      this.setData({ list });
      const unread = (res.items || []).filter((d: any) => !d.assign_read);
      for (const d of unread) {
        markMyDemandRead(d.id).catch(() => {});
      }
    } catch (e) {
      console.error('加载客户需求失败:', e);
    }
  },
  onCall(e: any) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) wx.makePhoneCall({ phoneNumber: String(phone) });
  },
  onComplete(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认',
      content: '将该客户需求标记为已完成？',
      success: (r) => {
        if (r.confirm) {
          updateMyDemandStatus(id, '已完成').then(() => {
            wx.showToast({ title: '已标记完成', icon: 'success' });
            this.loadData();
          }).catch(() => {
            wx.showToast({ title: '操作失败', icon: 'none' });
          });
        }
      },
    });
  },
});
