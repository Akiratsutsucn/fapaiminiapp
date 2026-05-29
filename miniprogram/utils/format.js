"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPriceWan = formatPriceWan;
exports.formatPriceYuan = formatPriceYuan;
exports.formatArea = formatArea;
exports.formatUnitPrice = formatUnitPrice;
exports.formatDiscount = formatDiscount;
exports.formatDate = formatDate;
exports.formatCountdown = formatCountdown;
exports.statusLabel = statusLabel;
exports.statusTagClass = statusTagClass;
function formatPriceWan(price) {
    if (!price || price === 0)
        return '--';
    const wan = price / 10000;
    if (wan >= 10000)
        return `${(wan / 10000).toFixed(2)}亿`;
    return `${wan.toFixed(0)}万`;
}
function formatPriceYuan(price) {
    if (!price)
        return '--';
    return price.toLocaleString('zh-CN') + '元';
}
function formatArea(area) {
    if (!area || area === 0)
        return '--';
    return `${area.toFixed(2)}m²`;
}
function formatUnitPrice(price) {
    if (!price || price === 0)
        return '--';
    return `${price.toLocaleString('zh-CN')}元/m²`;
}
function formatDiscount(rate) {
    if (!rate || rate === 0)
        return '--';
    return `${(rate * 10).toFixed(1)}折`;
}
function formatDate(dateStr, fmt = 'YYYY-MM-DD') {
    if (!dateStr)
        return '--';
    const d = new Date(dateStr);
    const year = d.getFullYear().toString();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hour = d.getHours().toString().padStart(2, '0');
    const minute = d.getMinutes().toString().padStart(2, '0');
    return fmt
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hour)
        .replace('mm', minute);
}
function formatCountdown(dateStr) {
    if (!dateStr)
        return '--';
    const target = new Date(dateStr).getTime();
    const now = Date.now();
    const diff = target - now;
    if (diff <= 0)
        return '已开拍';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (days > 0)
        return `${days}天${hours}小时${minutes}分钟`;
    if (hours > 0)
        return `${hours}小时${minutes}分钟`;
    return `${minutes}分钟`;
}
function statusLabel(status) {
    const map = {
        '即将开拍': '即将开拍',
        '进行中': '正在拍卖',
        '已结束': '已结束',
        '已成交': '已成交',
        '中止': '中止',
        '撤回': '撤回',
    };
    return map[status] || status;
}
function statusTagClass(status) {
    const map = {
        '即将开拍': 'tag-blue',
        '进行中': 'tag-red',
        '已结束': 'tag-red',
        '已成交': 'tag-green',
        '中止': 'tag-orange',
        '撤回': 'tag-orange',
    };
    return map[status] || 'tag-blue';
}
