"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const request_1 = require("../utils/request");
async function login(code, profile) {
    const payload = { code };
    if (profile === null || profile === void 0 ? void 0 : profile.nickname)
        payload.nickname = profile.nickname;
    if (profile === null || profile === void 0 ? void 0 : profile.avatarUrl)
        payload.avatar_url = profile.avatarUrl;
    const data = await (0, request_1.request)({
        url: '/auth/login',
        method: 'POST',
        data: payload,
        auth: false,
    });
    const app = getApp();
    app.setToken(data.access_token, data.refresh_token);
    return data;
}
