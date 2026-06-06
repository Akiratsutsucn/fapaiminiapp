"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../../services/auth");
const property_1 = require("../../services/property");
// 备案号（工信部 + 公安）。小程序备案号对应"小程序"主体备案。
const ICP_NUMBER = "浙ICP备2026034931号-1X";
const POLICE_NUMBER = "浙公网安备33010202005787号";
Page({
    data: {
        loading: false,
        agreed: false,
        icpNumber: ICP_NUMBER,
        policeNumber: POLICE_NUMBER,
        summary: {
            onAuctionText: '--',
            bargain: '--',
            discountText: '--',
        },
    },
    onLoad() {
        this.loadSummary();
    },
    async loadSummary() {
        try {
            const s = await (0, property_1.getHomeSummary)();
            const onAuction = s.on_auction || 0;
            const onAuctionText = onAuction >= 1000 ? (onAuction / 1000).toFixed(1) + 'K+' : String(onAuction);
            this.setData({
                summary: {
                    onAuctionText,
                    bargain: s.bargain || 0,
                    discountText: s.avg_discount ? s.avg_discount + '折' : '--',
                },
            });
        }
        catch (e) {
        }
    },
    async onLogin() {
        if (!this.data.agreed) {
            wx.showToast({ title: '请先阅读并同意用户协议', icon: 'none' });
            return;
        }
        this.setData({ loading: true });
        try {
            const { code } = await wx.login();
            if (!code) {
                wx.showToast({ title: '获取登录凭证失败', icon: 'none' });
                this.setData({ loading: false });
                return;
            }
            await (0, auth_1.login)(code);
            wx.switchTab({ url: '/pages/index/index' });
        }
        catch (e) {
            console.error('登录失败:', e);
            wx.showToast({ title: '登录失败，请重试', icon: 'none' });
        }
        finally {
            this.setData({ loading: false });
        }
    },
    onAgreeToggle() {
        this.setData({ agreed: !this.data.agreed });
    },
    onViewTerms() {
        wx.navigateTo({ url: '/pages/agreement/agreement' });
    },
    onViewPrivacy() {
        wx.navigateTo({ url: '/pages/privacy/privacy' });
    },
    onViewICP() {
        // 备案号公示：点击复制，便于用户到 beian.miit.gov.cn 核验
        wx.setClipboardData({
            data: this.data.icpNumber,
            success: () => wx.showToast({ title: '备案号已复制', icon: 'none' }),
        });
    },
    onViewPolice() {
        // 公安网安备号公示：点击复制，便于用户到 beian.mps.gov.cn 核验
        wx.setClipboardData({
            data: this.data.policeNumber,
            success: () => wx.showToast({ title: '网安备号已复制', icon: 'none' }),
        });
    },
});
