"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const format_1 = require("../../utils/format");
const user_1 = require("../../services/user");
async function checkContactStatus() {
    const app = getApp();
    if (!app.isLoggedIn())
        return 'nologin';
    try {
        const profile = await (0, user_1.getUserProfile)();
        return profile && profile.phone && profile.nickname ? 'ok' : 'need';
    }
    catch (e) {
        return 'need';
    }
}
async function saveContact(surname, phone) {
    const s = (surname || '').trim();
    const p = (phone || '').trim();
    if (!s) {
        wx.showToast({ title: '请填写姓氏', icon: 'none' });
        return false;
    }
    if (!/^1\d{10}$/.test(p)) {
        wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
        return false;
    }
    try {
        await (0, user_1.updateUserProfile)({ nickname: s, phone: p });
        return true;
    }
    catch (e) {
        wx.showToast({ title: '保存失败,请重试', icon: 'none' });
        return false;
    }
}
function priceNumberOnly(price) {
    if (!price || price === 0)
        return '--';
    const wan = price / 10000;
    if (wan >= 10000)
        return (wan / 10000).toFixed(2);
    return wan.toFixed(0);
}
const PLATFORM_KEY_MAP = {
    '京东拍卖': 'jd',
    '阿里拍卖': 'ali',
    '公拍网': 'gpai',
};
function toAccessUrl(sourceUrl, platform) {
    if (!sourceUrl)
        return '';
    if (platform && (platform.indexOf('阿里') >= 0 || platform.indexOf('淘宝') >= 0)) {
        const m = sourceUrl.match(/itemId=(\d+)/);
        if (m)
            return `https://sf-item.taobao.com/sf_item/${m[1]}.htm`;
    }
    return sourceUrl;
}
Component({
    properties: {
        property: {
            type: Object,
            value: {},
        },
    },
    computed: {},
    observers: {
        property(p) {
            if (!p)
                return;
            const startingNum = priceNumberOnly(p.starting_price);
            const wan = (p.starting_price || 0) / 10000;
            const showAsYi = wan >= 10000;
            const saving = (p.appraisal_price || 0) - (p.starting_price || 0);
            const savingWan = saving > 0 ? priceNumberOnly(saving) : '';
            const rate = p.court_discount_rate || 0;
            const discount = rate > 0 && rate < 1 ? (0, format_1.formatDiscount)(rate) : '';
            this.setData({
                coverImage: p.cover_image || '/images/default-house.png',
                statusLabel: (0, format_1.statusLabel)(p.auction_status),
                statusTagClass: (0, format_1.statusTagClass)(p.auction_status),
                startingPriceWan: startingNum,
                startingUnit: showAsYi ? '亿起' : '万起',
                appraisalPriceWan: priceNumberOnly(p.appraisal_price),
                district: p.district || '',
                subDistrict: p.sub_district || '',
                propertyType: p.property_type || '',
                auctionRound: p.auction_round || '',
                area: p.area ? String(Math.round(p.area)) : '',
                layout: p.layout || '',
                title: p.title || '',
                discount,
                savingWan,
                auctionTime: p.auction_start_time ? (0, format_1.formatDate)(p.auction_start_time, 'MM-DD HH:mm') : '',
                platformLabel: p.auction_platform || '',
                platformKey: PLATFORM_KEY_MAP[p.auction_platform || ''] || '',
            });
        },
    },
    data: {
        coverImage: '',
        statusLabel: '',
        statusTagClass: '',
        startingPriceWan: '',
        startingUnit: '万起',
        appraisalPriceWan: '',
        district: '',
        subDistrict: '',
        propertyType: '',
        auctionRound: '',
        area: '',
        layout: '',
        title: '',
        discount: '',
        savingWan: '',
        auctionTime: '',
        platformLabel: '',
        platformKey: '',
        showContactModal: false,
        contactForm: { surname: '', phone: '' },
        savingContact: false,
    },
    methods: {
        onTap() {
            const p = this.properties.property;
            if (p && p.id) {
                wx.navigateTo({ url: `/pages/property-detail/property-detail?id=${p.id}` });
            }
        },
        async onTapPlatform() {
            const p = this.properties.property;
            if (!p || !p.source_url) {
                wx.showToast({ title: '暂无平台链接', icon: 'none' });
                return;
            }
            const status = await checkContactStatus();
            if (status === 'nologin') {
                wx.showModal({
                    title: '请先登录',
                    content: '查看房源在拍卖平台的链接需要先登录',
                    confirmText: '去登录',
                    success: (res) => {
                        if (res.confirm)
                            wx.navigateTo({ url: '/pages/login/login' });
                    },
                });
                return;
            }
            if (status === 'need') {
                this.setData({ showContactModal: true });
                return;
            }
            this.openPlatformLink();
        },
        onContactInput(e) {
            const field = e.currentTarget.dataset.field;
            this.setData({ [`contactForm.${field}`]: e.detail.value });
        },
        onCloseContactModal() {
            this.setData({ showContactModal: false });
        },
        noop() { },
        async onSubmitContact() {
            this.setData({ savingContact: true });
            const ok = await saveContact(this.data.contactForm.surname, this.data.contactForm.phone);
            this.setData({ savingContact: false });
            if (ok) {
                this.setData({ showContactModal: false });
                this.openPlatformLink();
            }
        },
        openPlatformLink() {
            const p = this.properties.property;
            const url = toAccessUrl(p.source_url, p.auction_platform);
            if (!url) {
                wx.showToast({ title: '暂无平台链接', icon: 'none' });
                return;
            }
            wx.setClipboardData({
                data: url,
                success: () => {
                    wx.showModal({
                        title: '链接已复制',
                        content: '应微信官方安全规范要求,小程序无法直接跳转到外部网站。链接已为您复制,请打开手机浏览器粘贴访问,即可查看该房源在拍卖平台的页面。',
                        showCancel: false,
                        confirmText: '我知道了',
                    });
                },
            });
        },
    },
});
