"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const article_1 = require("../../services/article");
const user_1 = require("../../services/user");
const storage_1 = require("../../utils/storage");
const app = getApp();
Page({
    data: {
        article: {},
        contentNodes: '',
        liked: false,
        likeCount: 0,
        isFavorited: false,
        favoriteId: 0,
    },
    onLoad(options) {
        const id = parseInt(options.id);
        if (id) {
            this.loadArticle(id);
            this.loadLikeState(id);
            this.checkFavoriteStatus(id);
            (0, storage_1.addBrowseHistory)('article', id);
        }
    },
    async loadArticle(id) {
        try {
            const article = await (0, article_1.getArticleDetail)(id);
            this.setData({
                article,
                contentNodes: this.normalizeContent((article && article.content) || ''),
            });
        }
        catch (e) {
            wx.showToast({ title: '加载失败', icon: 'none' });
        }
    },
    normalizeContent(html) {
        if (!html)
            return '';
        let s = html;
        s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
        // 去掉图片上会撑破屏幕的固定宽高属性与内联宽高样式
        s = s.replace(/<img[^>]*>/gi, (tag) => {
            let t = tag;
            // 移除 width/height 属性（含 data-w/data-width 等常见公众号属性）
            t = t.replace(/\s(?:width|height|data-w|data-width|data-ratio)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
            // 移除内联样式里的 width/height/max-width，避免覆盖自适应
            t = t.replace(/style\s*=\s*("|')([^"']*)\1/gi, (m, q, css) => {
                const cleaned = css.replace(/(?:max-)?width\s*:[^;]+;?/gi, '').replace(/height\s*:[^;]+;?/gi, '');
                return `style=${q}${cleaned}${q}`;
            });
            return t;
        });
        // 统一加上自适应样式
        s = s.replace(/<img/gi, '<img style="max-width:100%;width:100%;height:auto;display:block;margin:12px auto;"');
        return s;
    },
    loadLikeState(id) {
        const stored = wx.getStorageSync(`article_like_${id}`);
        if (stored) {
            this.setData({ liked: !!stored.liked, likeCount: stored.count || 0 });
        }
        else {
            this.setData({ likeCount: Math.floor(Math.random() * 50) + 10 });
        }
    },
    onLike() {
        const id = this.data.article.id;
        if (!id)
            return;
        const newLiked = !this.data.liked;
        const newCount = newLiked ? this.data.likeCount + 1 : Math.max(0, this.data.likeCount - 1);
        this.setData({ liked: newLiked, likeCount: newCount });
        wx.setStorageSync(`article_like_${id}`, { liked: newLiked, count: newCount });
        wx.showToast({ title: newLiked ? '已点赞' : '已取消', icon: 'none' });
    },
    onLeaveMessage() {
        wx.navigateTo({ url: '/pages/customer-service/customer-service' });
    },
    onFollowMp() {
        wx.showModal({
            title: '关注公众号',
            content: '请在微信中搜索"拍来盟科技"并关注，第一时间获取法拍房资讯。',
            confirmText: '我知道了',
            showCancel: false,
        });
    },
    onOpenMp() {
        const url = this.data.article.mp_url;
        if (!url) {
            wx.showToast({ title: '暂无原文链接', icon: 'none' });
            return;
        }
        wx.showModal({
            title: '查看公众号原文',
            content: '由于小程序无法直接打开外部链接，链接将复制到剪贴板，请在微信内粘贴打开。',
            confirmText: '复制链接',
            cancelText: '取消',
            success: (res) => {
                if (res.confirm) {
                    wx.setClipboardData({
                        data: url,
                        success: () => wx.showToast({ title: '已复制', icon: 'success' }),
                    });
                }
            },
        });
    },
    onShare() {
    },
    async checkFavoriteStatus(articleId) {
        if (!app.isLoggedIn || !app.isLoggedIn())
            return;
        try {
            const res = await (0, user_1.getFavorites)('article', 1, 100);
            const fav = (res.items || []).find((f) => f.target_id === articleId);
            if (fav) {
                this.setData({ isFavorited: true, favoriteId: fav.id });
            }
        }
        catch (_) {
        }
    },
    async onToggleFavorite() {
        if (!app.isLoggedIn || !app.isLoggedIn()) {
            wx.navigateTo({ url: '/pages/login/login' });
            return;
        }
        const articleId = this.data.article.id;
        if (!articleId)
            return;
        const newState = !this.data.isFavorited;
        this.setData({ isFavorited: newState });
        try {
            if (newState) {
                const res = await (0, user_1.addFavorite)('article', articleId);
                if (res && res.id)
                    this.setData({ favoriteId: res.id });
            }
            else {
                await (0, user_1.removeFavorite)(this.data.favoriteId);
                this.setData({ favoriteId: 0 });
            }
            wx.showToast({ title: newState ? '已收藏' : '已取消收藏', icon: 'none' });
        }
        catch (e) {
            this.setData({ isFavorited: !newState });
            wx.showToast({ title: '操作失败', icon: 'none' });
        }
    },
    onShareAppMessage() {
        const a = this.data.article;
        return {
            title: a.title || '法拍者联盟文章',
            path: `/pages/article/article?id=${a.id}`,
            imageUrl: a.cover_image || '',
        };
    },
    onContact() { wx.navigateTo({ url: '/pages/customer-service/customer-service' }); },
});
