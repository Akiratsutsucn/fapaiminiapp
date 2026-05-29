"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("../../../utils/request");
const format_1 = require("../../../utils/format");
Page({
    data: {
        list: [],
        loading: true,
    },
    onShow() {
        this.loadList();
    },
    async loadList() {
        this.setData({ loading: true });
        try {
            const data = await (0, request_1.request)({ url: '/agent/invite-list' });
            this.setData({
                list: (data || []).map((u) => ({
                    ...u,
                    created_at: u.created_at ? (0, format_1.formatDate)(u.created_at, 'YYYY-MM-DD HH:mm') : '',
                })),
                loading: false,
            });
        }
        catch (e) {
            console.error('加载邀请列表失败:', e);
            this.setData({ loading: false });
        }
    },
    onCreatePoster() {
        wx.navigateTo({ url: '/subpackages/agent/invite-poster/invite-poster' });
    },
});
