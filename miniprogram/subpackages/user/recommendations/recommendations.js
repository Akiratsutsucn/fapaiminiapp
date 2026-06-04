"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = require("../../../services/user");
Page({
    data: { list: [] },
    onShow() { this.loadData(); },
    async loadData() {
        try {
            const res = await (0, user_1.getRecommendations)(1, 50);
            this.setData({ list: res.items || [] });
        }
        catch (e) {
            console.error('加载推荐失败:', e);
        }
    },
    onTapItem(e) {
        const id = e.currentTarget.dataset.id;
        const recId = e.currentTarget.dataset.rec;
        // 标记已读（静默）
        if (recId)
            (0, user_1.markRecommendationRead)(recId).catch(() => { });
        wx.navigateTo({ url: `/pages/property-detail/property-detail?id=${id}` });
    },
});
