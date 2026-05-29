"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInviteList = getInviteList;
exports.getPoster = getPoster;
const request_1 = require("../utils/request");
async function getInviteList() {
    return (0, request_1.request)({ url: '/agent/invite-list', method: 'GET' });
}
async function getPoster() {
    return (0, request_1.request)({ url: '/agent/poster', method: 'GET' });
}
