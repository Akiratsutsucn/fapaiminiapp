"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const article_1 = require("../../services/article");
Page({
    data: {
        list: [],
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
    async loadList() {
        this.setData({ loading: true });
        try {
            const items = await (0, article_1.getArticles)(this.data.page, this.data.pageSize);
            const arr = Array.isArray(items) ? items : [];
            const list = this.data.page === 1 ? arr : [...this.data.list, ...arr];
            this.setData({
                list,
                hasMore: arr.length >= this.data.pageSize,
                loading: false,
            });
        }
        catch (e) {
            this.setData({ loading: false });
        }
    },
    onLoadMore() {
        this.setData({ page: this.data.page + 1 }, () => this.loadList());
    },
    onTapArticle(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: `/pages/article/article?id=${id}` });
    },
});
