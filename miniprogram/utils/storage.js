"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorage = getStorage;
exports.setStorage = setStorage;
exports.removeStorage = removeStorage;
exports.addBrowseHistory = addBrowseHistory;
exports.getBrowseHistory = getBrowseHistory;
function getStorage(key) {
    try {
        const value = wx.getStorageSync(key);
        return value;
    }
    catch (_a) {
        return null;
    }
}
function setStorage(key, value) {
    try {
        wx.setStorageSync(key, value);
    }
    catch (e) {
        console.error('Storage set error:', e);
    }
}
function removeStorage(key) {
    try {
        wx.removeStorageSync(key);
    }
    catch (e) {
        console.error('Storage remove error:', e);
    }
}
const HISTORY_KEY = 'browse_history';
const MAX_HISTORY = 100;
function addBrowseHistory(type, targetId) {
    const list = getStorage(HISTORY_KEY) || [];
    const idx = list.findIndex(item => item.type === type && item.targetId === targetId);
    if (idx >= 0)
        list.splice(idx, 1);
    list.unshift({ type, targetId, time: Date.now() });
    if (list.length > MAX_HISTORY)
        list.length = MAX_HISTORY;
    setStorage(HISTORY_KEY, list);
}
function getBrowseHistory() {
    return getStorage(HISTORY_KEY) || [];
}
