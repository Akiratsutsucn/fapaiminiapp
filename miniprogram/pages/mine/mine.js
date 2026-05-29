"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = require("../../services/user");
const app = getApp();
Page({
    data: {
        isLoggedIn: false,
        userInfo: { nickname: '', avatar_url: null, phone: null, role: 'customer' },
        stats: { favorite_count: 0, participated_count: 0, won_count: 0 },
        showEdit: false,
        editNickname: '',
        editPhone: '',
        saving: false,
    },
    onShow() {
        this.checkLoginAndLoad();
    },
    checkLoginAndLoad() {
        if (app.isLoggedIn()) {
            this.setData({ isLoggedIn: true });
            this.loadUserData();
        }
        else {
            this.setData({ isLoggedIn: false });
        }
    },
    async loadUserData() {
        try {
            const [userInfo, stats] = await Promise.all([
                (0, user_1.getUserProfile)().catch(() => null),
                (0, user_1.getUserStats)().catch(() => ({ favorite_count: 0, participated_count: 0, won_count: 0 })),
            ]);
            if (userInfo)
                this.setData({ userInfo });
            if (stats)
                this.setData({ stats });
        }
        catch (e) {
            console.error('加载用户数据失败:', e);
        }
    },
    onGoLogin() {
        wx.navigateTo({ url: '/pages/login/login' });
    },
    onNav(e) {
        const url = e.currentTarget.dataset.url;
        if (!this.data.isLoggedIn) {
            wx.navigateTo({ url: '/pages/login/login' });
            return;
        }
        wx.navigateTo({ url });
    },
    onStatTap(e) {
        if (!this.data.isLoggedIn) {
            wx.navigateTo({ url: '/pages/login/login' });
            return;
        }
        const key = e.currentTarget.dataset.key;
        if (key === 'favorite' || key === 'favorites') {
            wx.navigateTo({ url: '/subpackages/user/favorites/favorites' });
        }
        else {
            wx.showToast({ title: '该统计暂未开放跳转', icon: 'none' });
        }
    },
    onEditProfile() {
        this.setData({
            showEdit: true,
            editNickname: this.data.userInfo.nickname || '',
            editPhone: this.data.userInfo.phone || '',
        });
    },
    preventMove() { },
    preventBubble() { },
    onCloseEdit() {
        this.setData({ showEdit: false });
    },
    onNicknameInput(e) {
        this.setData({ editNickname: e.detail.value });
    },
    onPhoneInput(e) {
        this.setData({ editPhone: e.detail.value });
    },
    async onSaveProfile() {
        const nickname = this.data.editNickname.trim();
        const phone = this.data.editPhone.trim();
        if (!nickname) {
            wx.showToast({ title: '请输入昵称', icon: 'none' });
            return;
        }
        if (phone && phone.length !== 11) {
            wx.showToast({ title: '手机号格式错误', icon: 'none' });
            return;
        }
        this.setData({ saving: true });
        try {
            const data = { nickname };
            if (phone)
                data.phone = phone;
            const updated = await (0, user_1.updateUserProfile)(data);
            this.setData({ userInfo: updated, showEdit: false, saving: false });
            wx.showToast({ title: '保存成功', icon: 'success' });
        }
        catch (e) {
            this.setData({ saving: false });
            wx.showToast({ title: '保存失败', icon: 'none' });
        }
    },
});
