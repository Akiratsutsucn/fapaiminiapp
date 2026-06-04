"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const agent_1 = require("../services/agent");
const app = getApp();
Page({
    data: {
        agentId: 0,
        agentNickname: '',
        qrUrl: '',
        qrError: false,
        shareLink: '',
    },
    onLoad() {
        if (app.isLoggedIn() && app.globalData.userInfo) {
            this.setData({
                agentId: app.globalData.userInfo.id,
                agentNickname: app.globalData.userInfo.nickname || '法拍经纪人',
            });
        }
        this.loadPoster();
    },
    async loadPoster() {
        try {
            const info = await (0, agent_1.getPoster)();
            this.setData({
                qrUrl: info.qr_url,
                agentNickname: info.agent_nickname,
                shareLink: info.share_link,
                qrError: false,
            });
        }
        catch (e) {
            this.setData({ qrError: true });
        }
    },
    onShareAppMessage() {
        const path = this.data.agentId
            ? `/pages/index/index?inviter=${this.data.agentId}`
            : '/pages/index/index';
        return {
            title: '法拍者联盟 — 专业法拍房信息服务平台',
            path,
        };
    },
    onCopyLink() {
        const link = this.data.shareLink || `https://xcxapi.fapaizhelianmeng.cn?inviter=${this.data.agentId}`;
        wx.setClipboardData({
            data: link,
            success: () => wx.showToast({ title: '链接已复制', icon: 'none' }),
        });
    },
});
