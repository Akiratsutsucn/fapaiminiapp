"use strict";
Component({
    properties: {
        banners: { type: Array, value: [] },
    },
    methods: {
        onBannerTap(e) {
            const item = (e.currentTarget.dataset.item || {});
            if (item.article_id) {
                wx.navigateTo({ url: `/pages/article/article?id=${item.article_id}` });
                return;
            }
            const link = item.link_url || '';
            if (!link)
                return;
            const articleId = this._extractArticleId(link);
            if (articleId) {
                wx.navigateTo({ url: `/pages/article/article?id=${articleId}` });
                return;
            }
            if (link.startsWith('/pages/') || link.startsWith('/subpackages/')) {
                wx.navigateTo({ url: link });
                return;
            }
            if (link.startsWith('http')) {
                wx.setClipboardData({
                    data: link,
                    success: () => wx.showToast({ title: '链接已复制，请在微信打开', icon: 'none' }),
                });
            }
        },
        _extractArticleId(url) {
            if (/^\d+$/.test(url))
                return parseInt(url, 10);
            const m = /^article:(\d+)$/.exec(url);
            if (m)
                return parseInt(m[1], 10);
            return 0;
        },
    },
});
