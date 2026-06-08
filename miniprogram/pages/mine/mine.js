"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = require("../../services/user");
const app = getApp();
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RjZThmMiIvPjxjaXJjbGUgY3g9IjEwMCIgY3k9Ijc4IiByPSIzOCIgZmlsbD0iIzlmYjZjZiIvPjxwYXRoIGQ9Ik00MCAxODRjMC0zNiAyOC01OCA2MC01OHM2MCAyMiA2MCA1OHoiIGZpbGw9IiM5ZmI2Y2YiLz48L3N2Zz4=';
const AVATAR_UPLOAD_URL = 'https://xcxapi.fapaizhelianmeng.cn/api/v1/user/avatar';
Page({
    data: {
        isLoggedIn: false,
        userInfo: { nickname: '', avatar_url: null, phone: null, role: 'customer' },
        stats: { favorite_count: 0, participated_count: 0, won_count: 0 },
        showEdit: false,
        editNickname: '',
        editPhone: '',
        saving: false,
        recUnread: 0,
        demandUnread: 0,
        defaultAvatar: DEFAULT_AVATAR,
    },
    onShow() {
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().setData({ selected: 1 });
        }
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
    onChooseAvatar(e) {
        const avatarUrl = e.detail && e.detail.avatarUrl;
        if (!avatarUrl)
            return;
        this.setData({ 'userInfo.avatar_url': avatarUrl });
        wx.showLoading({ title: '上传中...', mask: true });
        wx.uploadFile({
            url: AVATAR_UPLOAD_URL,
            filePath: avatarUrl,
            name: 'file',
            header: { Authorization: `Bearer ${app.globalData.token || wx.getStorageSync('access_token') || ''}` },
            success: (res) => {
                try {
                    const data = JSON.parse(res.data);
                    if (data && data.avatar_url) {
                        this.setData({ 'userInfo.avatar_url': data.avatar_url });
                        wx.showToast({ title: '头像已更新', icon: 'success' });
                    }
                    else {
                        wx.showToast({ title: '上传失败', icon: 'none' });
                    }
                }
                catch (_) {
                    wx.showToast({ title: '上传失败', icon: 'none' });
                }
            },
            fail: () => wx.showToast({ title: '上传失败', icon: 'none' }),
            complete: () => wx.hideLoading(),
        });
    },
    async loadUserData() {
        try {
            const [userInfo, stats] = await Promise.all([
                (0, user_1.getUserProfile)().catch(err => {
                    console.error('获取用户信息失败:', err);
                    return null;
                }),
                (0, user_1.getUserStats)().catch(err => {
                    console.error('获取统计数据失败:', err);
                    return { favorite_count: 0, participated_count: 0, won_count: 0 };
                }),
            ]);
            if (userInfo) {
                this.setData({ userInfo });
            }
            if (stats) {
                this.setData({ stats });
            }
            const role = (userInfo && userInfo.role) || '';
            // 延迟加载非关键数据，避免并发请求触发限流
            setTimeout(() => {
                (0, user_1.getRecommendationUnread)()
                    .then((r) => this.setData({ recUnread: (r && r.unread) || 0 }))
                    .catch(err => {
                    console.error('获取推荐未读数失败:', err);
                    this.setData({ recUnread: 0 });
                });
            }, 300);
            if (role === 'agent' || role === 'salesperson') {
                setTimeout(() => {
                    (0, user_1.getMyDemandsUnread)()
                        .then((r) => this.setData({ demandUnread: (r && r.unread) || 0 }))
                        .catch(err => {
                        console.error('获取需求未读数失败:', err);
                        this.setData({ demandUnread: 0 });
                    });
                }, 600);
            }
        }
        catch (e) {
            console.error('加载用户数据失败:', e);
            wx.showToast({ title: '加载失败，请稍后重试', icon: 'none', duration: 2000 });
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
