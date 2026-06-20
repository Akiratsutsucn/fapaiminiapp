"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const property_1 = require("../../services/property");
const request_1 = require("../../utils/request");
const user_1 = require("../../services/user");
const plugin = requirePlugin('WechatSI');
const manager = plugin.getRecordRecognitionManager();
Page({
    data: {
        query: '',
        parsed: {},
        priceText: '',
        areaText: '',
        searching: false,
        searched: false,
        recording: false,
        list: [],
        total: 0,
        contactReady: false,
        showContactModal: false,
        contactForm: { surname: '', phone: '' },
        savingContact: false,
        pendingAction: '',
    },
    onLoad() {
        this.initVoice();
        this.refreshContactStatus();
    },
    async refreshContactStatus() {
        const app = getApp();
        if (!app.isLoggedIn()) {
            this.setData({ contactReady: false });
            return;
        }
        try {
            const profile = await (0, user_1.getUserProfile)();
            const ready = !!(profile && profile.phone && profile.nickname);
            this.setData({
                contactReady: ready,
                'contactForm.surname': (profile === null || profile === void 0 ? void 0 : profile.nickname) || '',
                'contactForm.phone': (profile === null || profile === void 0 ? void 0 : profile.phone) || '',
            });
        }
        catch (e) {
            this.setData({ contactReady: false });
        }
    },
    ensureContact(action) {
        const app = getApp();
        if (!app.isLoggedIn()) {
            wx.showModal({
                title: '请先登录',
                content: '使用 AI 找房需要先登录',
                confirmText: '去登录',
                success: (res) => {
                    if (res.confirm)
                        wx.navigateTo({ url: '/pages/login/login' });
                },
            });
            return false;
        }
        if (this.data.contactReady)
            return true;
        this.setData({ showContactModal: true, pendingAction: action });
        return false;
    },
    onContactInput(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({ [`contactForm.${field}`]: e.detail.value });
    },
    onCloseContactModal() {
        this.setData({ showContactModal: false, pendingAction: '' });
    },
    async onSubmitContact() {
        const surname = (this.data.contactForm.surname || '').trim();
        const phone = (this.data.contactForm.phone || '').trim();
        if (!surname) {
            wx.showToast({ title: '请填写姓氏', icon: 'none' });
            return;
        }
        if (!/^1\d{10}$/.test(phone)) {
            wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
            return;
        }
        this.setData({ savingContact: true });
        try {
            await (0, user_1.updateUserProfile)({ nickname: surname, phone });
            this.setData({
                contactReady: true,
                showContactModal: false,
                savingContact: false,
            });
            wx.showToast({ title: '已保存', icon: 'success' });
            const action = this.data.pendingAction;
            this.setData({ pendingAction: '' });
            if (action === 'voice')
                this.startVoiceFlow();
            else if (action === 'search')
                this.onSearch();
        }
        catch (e) {
            console.error('保存联系方式失败:', e);
            wx.showToast({ title: '保存失败,请重试', icon: 'none' });
            this.setData({ savingContact: false });
        }
    },
    initVoice() {
        manager.onRecognize = (res) => {
            console.log('实时识别:', res.result);
        };
        manager.onStop = (res) => {
            console.log('识别结果:', res.result);
            this.setData({
                query: res.result,
                recording: false,
            });
        };
        manager.onError = (res) => {
            console.error('语音识别错误:', res);
            wx.showToast({ title: '识别失败', icon: 'none' });
            this.setData({ recording: false });
        };
    },
    onQueryInput(e) {
        this.setData({ query: e.detail.value });
    },
    onTapExample(e) {
        const text = e.currentTarget.dataset.text;
        this.setData({ query: text });
    },
    onVoiceInput() {
        if (!this.ensureContact('voice'))
            return;
        this.startVoiceFlow();
    },
    startVoiceFlow() {
        wx.authorize({
            scope: 'scope.record',
            success: () => {
                this.startRecord();
            },
            fail: () => {
                wx.showModal({
                    title: '需要录音权限',
                    content: '请在设置中开启录音权限',
                    confirmText: '去设置',
                    success: (res) => {
                        if (res.confirm) {
                            wx.openSetting();
                        }
                    },
                });
            },
        });
    },
    startRecord() {
        this.setData({ recording: true });
        manager.start({ lang: 'zh_CN' });
    },
    onStopRecord() {
        manager.stop();
    },
    async onSearch() {
        const query = this.data.query.trim();
        if (!query) {
            wx.showToast({ title: '请输入或说出您的需求', icon: 'none' });
            return;
        }
        if (!this.ensureContact('search'))
            return;
        this.setData({ searching: true });
        try {
            const parseResult = await (0, request_1.request)({
                url: '/ai-search/parse',
                method: 'GET',
                data: { query },
            });
            const parsed = parseResult.parsed || {};
            const priceText = this.formatPrice(parsed);
            const areaText = this.formatArea(parsed);
            this.setData({
                parsed,
                priceText,
                areaText,
            });
            await this.searchProperties(parsed);
            this.setData({
                searched: true,
                searching: false,
            });
        }
        catch (e) {
            console.error('搜索失败:', e);
            wx.showToast({ title: '搜索失败，请重试', icon: 'none' });
            this.setData({ searching: false });
        }
    },
    async searchProperties(parsed) {
        const app = getApp();
        const params = {
            city_id: app.globalData.currentCityId || 310000,
            page: 1,
            page_size: 20,
        };
        if (parsed.district)
            params.district = parsed.district;
        if (parsed.layout)
            params.layout = parsed.layout;
        if (parsed.price_min)
            params.price_min = parsed.price_min;
        if (parsed.price_max)
            params.price_max = parsed.price_max;
        if (parsed.area_min)
            params.area_min = parsed.area_min;
        if (parsed.area_max)
            params.area_max = parsed.area_max;
        if (parsed.property_type)
            params.property_type = parsed.property_type;
        if (parsed.auction_status)
            params.auction_status = parsed.auction_status;
        if (parsed.discount_min) {
            params.discount_min = parsed.discount_min;
            params.discount_max = parsed.discount_max;
        }
        const result = await (0, property_1.getProperties)(params);
        this.setData({
            list: result.items || [],
            total: result.total || 0,
        });
    },
    formatPrice(parsed) {
        const min = parsed.price_min;
        const max = parsed.price_max;
        if (min && max) {
            return `${min / 10000}万 - ${max / 10000}万`;
        }
        else if (min) {
            return `${min / 10000}万以上`;
        }
        else if (max) {
            return `${max / 10000}万以下`;
        }
        return '';
    },
    formatArea(parsed) {
        const min = parsed.area_min;
        const max = parsed.area_max;
        if (min && max) {
            return `${min} - ${max}㎡`;
        }
        else if (min) {
            return `${min}㎡以上`;
        }
        else if (max) {
            return `${max}㎡以下`;
        }
        return '';
    },
});
