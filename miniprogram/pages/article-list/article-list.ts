import { getArticles } from '../../services/article';

Page({
  data: {
    list: [] as ArticleItem[],
    page: 1,
    pageSize: 20,
    hasMore: false,
    loading: false,
  },

  onLoad() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, list: [] });
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.onLoadMore();
    }
  },

  async loadList(): Promise<void> {
    this.setData({ loading: true });
    try {
      const items = await getArticles(this.data.page, this.data.pageSize);
      const arr = Array.isArray(items) ? items : [];
      const list = this.data.page === 1 ? arr : [...this.data.list, ...arr];
      this.setData({
        list,
        hasMore: arr.length >= this.data.pageSize,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onLoadMore() {
    this.setData({ page: this.data.page + 1 }, () => this.loadList());
  },

  onTapArticle(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/article/article?id=${id}` });
  },
});
