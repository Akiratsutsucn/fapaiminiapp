"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = require("../../../services/user");
const property_1 = require("../../../services/property");
const article_1 = require("../../../services/article");
Page({
    data: { activeTab: 'property', propertyList: [], articleList: [] },
    onShow() {
        if (this.data.activeTab === 'property')
            this.loadPropertyFavorites();
        else
            this.loadArticleFavorites();
    },
    onTabSwitch(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({ activeTab: tab });
        if (tab === 'property')
            this.loadPropertyFavorites();
        else
            this.loadArticleFavorites();
    },
    async loadPropertyFavorites() {
        try {
            const res = await (0, user_1.getFavorites)('property');
            const ids = res.items.map((i) => i.target_id);
            const details = await Promise.all(ids.map((id) => (0, property_1.getPropertyDetail)(id).catch(() => null)));
            // 收藏列表用 house-card 展示，需要 cover_image；详情接口可能只返回 images 数组，做兜底
            const list = details.filter(Boolean).map((p) => {
                if (!p.cover_image && p.images && p.images.length > 0) {
                    const first = p.images.find((img) => img && img.image_url);
                    if (first)
                        p.cover_image = first.image_url;
                }
                return p;
            });
            this.setData({ propertyList: list });
        }
        catch (e) {
            console.error('加载收藏失败:', e);
        }
    },
    async loadArticleFavorites() {
        try {
            const res = await (0, user_1.getFavorites)('article');
            const ids = res.items.map((i) => i.target_id);
            const details = await Promise.all(ids.map((id) => (0, article_1.getArticleDetail)(id).catch(() => null)));
            this.setData({ articleList: details.filter(Boolean) });
        }
        catch (e) {
            console.error('加载文章收藏失败:', e);
        }
    },
    onArticleTap(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: `/pages/article/article?id=${id}` });
    },
});
