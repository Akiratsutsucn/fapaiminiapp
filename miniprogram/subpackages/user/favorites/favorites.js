"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = require("../../../services/user");
const property_1 = require("../../../services/property");
Page({
    data: { activeTab: 'property', propertyList: [] },
    onShow() { if (this.data.activeTab === 'property')
        this.loadPropertyFavorites(); },
    onTabSwitch(e) { this.setData({ activeTab: e.currentTarget.dataset.tab }); },
    async loadPropertyFavorites() {
        try {
            const res = await (0, user_1.getFavorites)('property');
            const ids = res.items.map((i) => i.target_id);
            // 批量加载，每批最多5个，避免触发限流
            const batchSize = 5;
            const allDetails = [];
            for (let i = 0; i < ids.length; i += batchSize) {
                const batchIds = ids.slice(i, i + batchSize);
                const details = await Promise.all(batchIds.map((id) => (0, property_1.getPropertyDetail)(id).catch((err) => {
                    console.warn(`房源 ${id} 加载失败:`, err.message);
                    return null;
                })));
                allDetails.push(...details.filter(Boolean));
                // 批次之间延迟，避免并发过高
                if (i + batchSize < ids.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            this.setData({ propertyList: allDetails });
        }
        catch (e) {
            console.error('加载收藏失败:', e);
            wx.showToast({ title: '加载收藏失败', icon: 'none' });
        }
    },
});
