"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = require("../../../services/user");
const property_1 = require("../../../services/property");
Page({
    data: {
        activeTab: 'property',
        propertyList: [],
        loading: false,
    },
    onShow() {
        if (this.data.activeTab === 'property')
            this.loadPropertyFavorites();
    },
    onTabSwitch(e) {
        this.setData({ activeTab: e.currentTarget.dataset.tab });
    },
    async loadPropertyFavorites() {
        this.setData({ loading: true });
        try {
            const res = await (0, user_1.getFavorites)('property');
            const ids = res.items.map((i) => i.target_id);
            const details = await Promise.all(ids.map((id) => (0, property_1.getPropertyDetail)(id)
                .then((detail) => {
                if (!detail)
                    return null;
                if (!detail.cover_image || detail.cover_image.length === 0) {
                    detail.cover_image = 'https://via.placeholder.com/400x300?text=暂无图片';
                }
                if (detail.status === 'sold' || detail.status === 'removed') {
                    detail.isOffline = true;
                }
                return detail;
            })
                .catch((err) => {
                console.error(`获取房源详情失败 (ID: ${id}):`, err);
                return {
                    id,
                    title: '该房源已下架',
                    cover_image: 'https://via.placeholder.com/400x300?text=房源已下架',
                    isOffline: true,
                    status: 'removed',
                };
            })));
            this.setData({
                propertyList: details.filter(Boolean),
                loading: false,
            });
        }
        catch (e) {
            console.error('加载收藏失败:', e);
            this.setData({ loading: false });
            wx.showToast({
                title: '加载失败，请重试',
                icon: 'none'
            });
        }
    },
});
