"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserProfile = getUserProfile;
exports.updateUserProfile = updateUserProfile;
exports.getUserStats = getUserStats;
exports.getFavorites = getFavorites;
exports.addFavorite = addFavorite;
exports.removeFavorite = removeFavorite;
exports.getBrowseHistory = getBrowseHistory;
const request_1 = require("../utils/request");
async function getUserProfile() {
    return (0, request_1.request)({ url: '/user/profile' });
}
async function updateUserProfile(data) {
    return (0, request_1.request)({ url: '/user/profile', method: 'PUT', data });
}
async function getUserStats() {
    return (0, request_1.request)({ url: '/user/stats' });
}
async function getFavorites(type, page = 1, pageSize = 20) {
    let url = `/user/favorites?page=${page}&page_size=${pageSize}`;
    if (type)
        url += `&favorite_type=${type}`;
    return (0, request_1.request)({ url });
}
async function addFavorite(favoriteType, targetId) {
    return (0, request_1.request)({
        url: `/user/favorites?favorite_type=${favoriteType}&target_id=${targetId}`,
        method: 'POST',
    });
}
async function removeFavorite(id) {
    return (0, request_1.request)({ url: `/user/favorites/${id}`, method: 'DELETE' });
}
async function getBrowseHistory(page = 1, pageSize = 20) {
    return (0, request_1.request)({
        url: `/user/browse-history?page=${page}&page_size=${pageSize}`,
    });
}
