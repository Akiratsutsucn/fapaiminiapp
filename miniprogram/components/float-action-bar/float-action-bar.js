"use strict";
Component({
    properties: {
        primaryText: { type: String, value: '联系客服' },
        showCalc: { type: Boolean, value: true },
        showAnalysis: { type: Boolean, value: false },
        showSafeAuction: { type: Boolean, value: false },
    },
    methods: {
        onShare() { this.triggerEvent('share'); },
        onCalc() { this.triggerEvent('calc'); },
        onContact() { this.triggerEvent('contact'); },
        onAnalysis() { this.triggerEvent('analysis'); },
        onSafeAuction() { this.triggerEvent('safeauction'); },
        onPrimaryTap() { this.triggerEvent('primary'); },
    },
});
