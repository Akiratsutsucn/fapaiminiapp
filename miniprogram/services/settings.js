"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
const request_1 = require("../utils/request");
async function getSettings() {
    return (0, request_1.request)({ url: '/settings' });
}
