"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = require("../../../services/user");
const article_1 = require("../../../services/article");
const format_1 = require("../../../utils/format");
Page({
    data: {
        articles: [],
        loading: true,
    },
    async onShow() {
        await this.loadArticleFavorites();
    },
    async loadArticleFavorites() {
        this.setData({ loading: true });
        try {
            const res = await (0, user_1.getFavorites)('article', 1, 200);
            const items = res.items || [];
            const articles = [];
            for (const fav of items) {
                try {
                    const article = await (0, article_1.getArticleDetail)(fav.target_id);
                    articles.push({
                        ...article,
                        fav_id: fav.id,
                        fav_time: (0, format_1.formatDate)(fav.created_at, 'YYYY-MM-DD'),
                    });
                }
                catch (_) {
                }
            }
            this.setData({ articles, loading: false });
        }
        catch (e) {
            console.error('加载文章收藏失败:', e);
            this.setData({ loading: false });
        }
    },
    onTapArticle(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: `/pages/article/article?id=${id}` });
    },
});
