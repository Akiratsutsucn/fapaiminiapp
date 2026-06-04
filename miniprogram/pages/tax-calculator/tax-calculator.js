"use strict";
// 法拍房税费 / 上岸成本计算器
// 规则为沪甬杭常见口径，仅供参考，最终以税务/不动产登记部门核定为准。
Page({
    data: {
        dealPrice: '',
        area: '',
        isFirstHome: true,
        overTwoYears: true,
        isUnique: true,
        agentRatePct: '1',
        calculated: false,
        result: {},
    },
    onLoad(options) {
        if (options.price) {
            const wan = (parseFloat(options.price) / 10000).toFixed(1);
            this.setData({ dealPrice: wan });
        }
        if (options.area)
            this.setData({ area: options.area });
        if (options.price)
            this.doCalc();
    },
    onDealPriceInput(e) { this.setData({ dealPrice: e.detail.value }); if (this.data.calculated) this.doCalc(); },
    onAreaInput(e) { this.setData({ area: e.detail.value }); if (this.data.calculated) this.doCalc(); },
    onAgentRateInput(e) { this.setData({ agentRatePct: e.detail.value }); if (this.data.calculated) this.doCalc(); },
    onToggleFirstHome(e) { this.setData({ isFirstHome: e.currentTarget.dataset.value === 'true' }); if (this.data.calculated) this.doCalc(); },
    onToggleYears(e) { this.setData({ overTwoYears: e.currentTarget.dataset.value === 'true' }); if (this.data.calculated) this.doCalc(); },
    onToggleUnique(e) { this.setData({ isUnique: e.currentTarget.dataset.value === 'true' }); if (this.data.calculated) this.doCalc(); },
    onCalculate() {
        const price = parseFloat(this.data.dealPrice);
        if (isNaN(price) || price <= 0) {
            wx.showToast({ title: '请输入成交价', icon: 'none' });
            return;
        }
        this.doCalc();
    },
    doCalc() {
        const priceWan = parseFloat(this.data.dealPrice);
        if (isNaN(priceWan) || priceWan <= 0)
            return;
        const price = priceWan * 10000;
        const area = parseFloat(this.data.area) || 0;
        let deedRate;
        if (!this.data.isFirstHome) {
            deedRate = 0.03;
        }
        else {
            deedRate = (area > 0 && area <= 90) ? 0.01 : 0.015;
        }
        const deedTax = price * deedRate;
        const vat = this.data.overTwoYears ? 0 : price * 0.053;
        const personalTax = (this.data.overTwoYears && this.data.isUnique) ? 0 : price * 0.01;
        const agentRate = (parseFloat(this.data.agentRatePct) || 0) / 100;
        const agentFee = price * agentRate;
        const otherTax = 500;
        const totalTax = deedTax + vat + personalTax + agentFee + otherTax;
        const landing = price + totalTax;
        const toWan = (v) => (v / 10000).toFixed(2);
        this.setData({
            calculated: true,
            result: {
                deedTax: toWan(deedTax),
                vat: toWan(vat),
                personalTax: toWan(personalTax),
                agentFee: toWan(agentFee),
                otherTax: toWan(otherTax),
                totalTax: toWan(totalTax),
                landingPrice: toWan(landing),
                taxRatePct: ((totalTax / price) * 100).toFixed(1),
            },
        });
    },
});
