"use strict";
Component({
    properties: {
        banners: { type: Array, value: [] },
    },
    methods: {
        onBannerTap(e) {
            const item = e.currentTarget.dataset.item;
            if (item.link_url) {
                const articleId = this._extractArticleId(item.link_url);
                if (articleId) {
                    wx.navigateTo({ url: `/pages/article/article?id=${articleId}` });
                }
            }
        },
        _extractArticleId(url) {
            return url;
        },
    },
});
