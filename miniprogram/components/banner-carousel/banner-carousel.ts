Component({
  properties: {
    banners: { type: Array, value: [] as BannerItem[] },
  },
  methods: {
    onBannerTap(e: any) {
      const item = e.currentTarget.dataset.item as BannerItem;
      if (item.link_url) {
        const articleId = this._extractArticleId(item.link_url);
        if (articleId) {
          wx.navigateTo({ url: `/pages/article/article?id=${articleId}` });
        }
      }
    },
    _extractArticleId(url: string): string {
      return url;
    },
  },
});
