Component({
  properties: {
    banners: { type: Array, value: [] as BannerItem[] },
  },
  methods: {
    onBannerTap(e: any) {
      const item = (e.currentTarget.dataset.item || {}) as any;
      // 1. 优先关联文章 id（后台可直接绑定文章，点击进站内文章详情，含全文）
      if (item.article_id) {
        wx.navigateTo({ url: `/pages/article/article?id=${item.article_id}` });
        return;
      }
      const link: string = item.link_url || '';
      if (!link) return;
      // 2. 纯数字 / article:N → 文章详情
      const articleId = this._extractArticleId(link);
      if (articleId) {
        wx.navigateTo({ url: `/pages/article/article?id=${articleId}` });
        return;
      }
      // 3. 站内页面路径
      if (link.startsWith('/pages/') || link.startsWith('/subpackages/')) {
        wx.navigateTo({ url: link });
        return;
      }
      // 4. 外链：小程序不能直开，复制到剪贴板
      if (link.startsWith('http')) {
        wx.setClipboardData({
          data: link,
          success: () => wx.showToast({ title: '链接已复制，请在微信打开', icon: 'none' }),
        });
      }
    },
    _extractArticleId(url: string): number {
      if (/^\d+$/.test(url)) return parseInt(url, 10);
      const m = /^article:(\d+)$/.exec(url);
      if (m) return parseInt(m[1], 10);
      return 0;
    },
  },
});
