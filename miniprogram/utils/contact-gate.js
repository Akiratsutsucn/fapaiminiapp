"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkContactStatus = checkContactStatus;
exports.saveContact = saveContact;
const user_1 = require("../services/user");
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
