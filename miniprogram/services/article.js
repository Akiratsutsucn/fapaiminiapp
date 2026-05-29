"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArticles = getArticles;
exports.getRecommendedArticles = getRecommendedArticles;
exports.getArticleDetail = getArticleDetail;
const request_1 = require("../utils/request");
async function getArticles(page = 1, pageSize = 20) {
    return (0, request_1.request)({
        url: `/articles?page=${page}&page_size=${pageSize}`,
    });
}
async function getRecommendedArticles(limit = 5) {
    return (0, request_1.request)({ url: `/articles/recommend?limit=${limit}` });
}
async function getArticleDetail(id) {
    return (0, request_1.request)({ url: `/articles/${id}` });
}
