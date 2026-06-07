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
            const details = await Promise.all(ids.map((id) => (0, property_1.getPropertyDetail)(id).catch(() => null)));
            this.setData({ propertyList: details.filter(Boolean) });
        }
        catch (e) {
            console.error('加载收藏失败:', e);
        }
    },
});
