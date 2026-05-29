"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const settings_1 = require("../../services/settings");
const demand_1 = require("../../services/demand");
const app = getApp();
Page({
    data: {
        phoneNumber: '400-007-6786',
        serviceText: '周一至周六 8:00~18:00',
        form: { name: '', phone: '', remark: '' },
        submitting: false,
    },
    onLoad() {
        this.loadSettings();
        if (app.isLoggedIn() && app.globalData.userInfo) {
            const u = app.globalData.userInfo;
            this.setData({
                'form.name': u.nickname || '',
                'form.phone': u.phone || '',
            });
        }
    },
    async loadSettings() {
        try {
            const settings = await (0, settings_1.getSettings)();
            this.setData({
                phoneNumber: settings.service_phone || '400-007-6786',
                serviceText: settings.service_text || '周一至周六 8:00~18:00',
            });
        }
        catch (_) {
        }
    },
    onCallPhone() {
        wx.makePhoneCall({ phoneNumber: this.data.phoneNumber });
    },
    onInput(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({ [`form.${field}`]: e.detail.value });
    },
    async onSubmitMessage() {
        const f = this.data.form;
        if (!f.name.trim()) {
            wx.showToast({ title: '请输入姓名', icon: 'none' });
            return;
        }
        if (!/^1\d{10}$/.test(f.phone)) {
            wx.showToast({ title: '手机号格式不正确', icon: 'none' });
            return;
        }
        if (!f.remark.trim()) {
            wx.showToast({ title: '请填写留言内容', icon: 'none' });
            return;
        }
        if (!app.isLoggedIn()) {
            wx.showToast({ title: '请先登录后再留言', icon: 'none' });
            setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 1500);
            return;
        }
        this.setData({ submitting: true });
        try {
            await (0, demand_1.submitDemand)({
                name: f.name.trim(),
                phone: f.phone,
                remark: f.remark.trim(),
                source: 'message',
            });
            wx.showToast({ title: '留言已提交，客服稍后联系', icon: 'success' });
            this.setData({ form: { name: f.name, phone: f.phone, remark: '' } });
            setTimeout(() => wx.navigateBack(), 1500);
        }
        catch (e) {
            wx.showToast({ title: '提交失败，请重试', icon: 'none' });
        }
        finally {
            this.setData({ submitting: false });
        }
    },
    onCancel() {
        wx.navigateBack();
    },
});
