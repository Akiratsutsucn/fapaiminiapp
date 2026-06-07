"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = require("../../../services/user");
Page({
    data: { list: [] },
    onShow() { this.loadData(); },
    async loadData() {
        try {
            const res = await (0, user_1.getMyDemands)(1, 50);
            const statusMap = { '待处理': 'pending', '已分配': 'assigned', '已完成': 'done' };
            const list = (res.items || []).map((d) => ({ ...d, statusClass: statusMap[d.status] || 'pending' }));
            this.setData({ list });
            const unread = (res.items || []).filter((d) => !d.assign_read);
            for (const d of unread) {
                (0, user_1.markMyDemandRead)(d.id).catch(() => { });
            }
        }
        catch (e) {
            console.error('加载客户需求失败:', e);
        }
    },
    onCall(e) {
        const phone = e.currentTarget.dataset.phone;
        if (phone)
            wx.makePhoneCall({ phoneNumber: String(phone) });
    },
    onComplete(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '确认',
            content: '将该客户需求标记为已完成？',
            success: (r) => {
                if (r.confirm) {
                    (0, user_1.updateMyDemandStatus)(id, '已完成').then(() => {
                        wx.showToast({ title: '已标记完成', icon: 'success' });
                        this.loadData();
                    }).catch(() => {
                        wx.showToast({ title: '操作失败', icon: 'none' });
                    });
                }
            },
        });
    },
});
