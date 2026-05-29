import { getFavorites } from '../../../services/user';
import { getArticleDetail } from '../../../services/article';
import { formatDate } from '../../../utils/format';

Page({
  data: {
    articles: [] as any[],
    loading: true,
  },

  async onShow() {
    await this.loadArticleFavorites();
  },

  async loadArticleFavorites() {
    this.setData({ loading: true });
    try {
      const res = await getFavorites('article', 1, 200);
      const items = res.items || [];
      const articles: any[] = [];
      for (const fav of items) {
        try {
          const article = await getArticleDetail(fav.target_id);
          articles.push({
            ...article,
            fav_id: fav.id,
            fav_time: formatDate(fav.created_at, 'YYYY-MM-DD'),
          });
        } catch (_) {
          // Skip articles that no longer exist
        }
      }
      this.setData({ articles, loading: false });
    } catch (e) {
      console.error('加载文章收藏失败:', e);
      this.setData({ loading: false });
    }
  },

  onTapArticle(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/article/article?id=${id}` });
  },
});
