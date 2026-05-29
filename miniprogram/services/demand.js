"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitDemand = submitDemand;
const request_1 = require("../utils/request");
async function submitDemand(data) {
    return (0, request_1.request)({ url: '/demands', method: 'POST', data });
}
