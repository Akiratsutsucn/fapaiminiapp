import { getBrowseHistory } from '../../../utils/storage';
Page({
  data: { list: [] as any[] },
  onShow() {
    const raw = getBrowseHistory();
    this.setData({ list: raw.slice(0, 50).map(item => ({ ...item, unique: `${item.type}_${item.targetId}_${item.time}`, timeStr: this._formatTime(item.time) })) });
  },
  _formatTime(ts: number): string {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  },
  onItemTap(e: any) {
    const item = e.currentTarget.dataset.item;
    if (item.type === 'property') wx.navigateTo({ url: `/pages/property-detail/property-detail?id=${item.targetId}` });
    else wx.navigateTo({ url: `/pages/article/article?id=${item.targetId}` });
  },
});
