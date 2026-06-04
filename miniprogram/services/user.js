"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserProfile = getUserProfile;
exports.updateUserProfile = updateUserProfile;
exports.getUserStats = getUserStats;
exports.getFavorites = getFavorites;
exports.addFavorite = addFavorite;
exports.removeFavorite = removeFavorite;
exports.getBrowseHistory = getBrowseHistory;
exports.getRecommendations = getRecommendations;
exports.getRecommendationUnread = getRecommendationUnread;
exports.markRecommendationRead = markRecommendationRead;
exports.getMyDemands = getMyDemands;
exports.getMyDemandsUnread = getMyDemandsUnread;
exports.markMyDemandRead = markMyDemandRead;
exports.updateMyDemandStatus = updateMyDemandStatus;
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
async function getRecommendations(page = 1, pageSize = 20) {
    return (0, request_1.request)({
        url: `/user/recommendations?page=${page}&page_size=${pageSize}`,
    });
}
async function getRecommendationUnread() {
    return (0, request_1.request)({ url: '/user/recommendations/unread-count' });
}
async function markRecommendationRead(recId) {
    return (0, request_1.request)({ url: `/user/recommendations/${recId}/read`, method: 'POST' });
}
async function getMyDemands(page = 1, pageSize = 50) {
    return (0, request_1.request)({ url: `/user/my-demands?page=${page}&page_size=${pageSize}` });
}
async function getMyDemandsUnread() {
    return (0, request_1.request)({ url: '/user/my-demands/unread-count' });
}
async function markMyDemandRead(demandId) {
    return (0, request_1.request)({ url: `/user/my-demands/${demandId}/read`, method: 'POST' });
}
async function updateMyDemandStatus(demandId, status) {
    return (0, request_1.request)({ url: `/user/my-demands/${demandId}/status?status=${encodeURIComponent(status)}`, method: 'POST' });
}
