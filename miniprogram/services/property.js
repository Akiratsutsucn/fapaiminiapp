"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProperties = getProperties;
exports.getPropertyDetail = getPropertyDetail;
exports.getRecommendedProperties = getRecommendedProperties;
exports.getMarketStats = getMarketStats;
exports.getBanners = getBanners;
exports.getCities = getCities;
exports.getMapMarkers = getMapMarkers;
exports.getDistrictAnalysis = getDistrictAnalysis;
exports.getPropertyAmenities = getPropertyAmenities;
const request_1 = require("../utils/request");
async function getProperties(params) {
    const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
    return (0, request_1.request)({ url: `/properties?${qs}` });
}
async function getPropertyDetail(id) {
    return (0, request_1.request)({ url: `/properties/${id}` });
}
async function getRecommendedProperties(cityId, pageSize = 6) {
    let url = `/properties/recommend?page_size=${pageSize}`;
    if (cityId)
        url += `&city_id=${cityId}`;
    return (0, request_1.request)({ url });
}
async function getMarketStats(cityId) {
    let url = '/market-stats';
    if (cityId)
        url += `?city_id=${cityId}`;
    return (0, request_1.request)({ url });
}
async function getBanners(cityId) {
    let url = '/banners';
    if (cityId)
        url += `?city_id=${cityId}`;
    return (0, request_1.request)({ url });
}
async function getCities() {
    return (0, request_1.request)({ url: '/cities' });
}
async function getMapMarkers(cityId = 310000) {
    return (0, request_1.request)({ url: `/properties/map-markers?city_id=${cityId}` });
}
async function getDistrictAnalysis(propertyId) {
    return (0, request_1.request)({ url: `/properties/${propertyId}/analysis` });
}
async function getPropertyAmenities(propertyId) {
    return (0, request_1.request)({ url: `/properties/${propertyId}/amenities` });
}
