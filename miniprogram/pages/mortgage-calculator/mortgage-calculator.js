"use strict";
const DEFAULT_COMMERCIAL_RATE = 3.5;
const DEFAULT_FUND_RATE = 2.85;
Page({
    data: {
        totalPrice: '',
        downPaymentRatio: 30,
        downPayment: '',
        loanYears: 30,
        rateType: 'commercial',
        rateInput: '3.5',
        commercialRate: '3.5',
        fundRate: '2.85',
        fundAmount: '60',
        calculated: false,
        calcType: 'equal',
        result: {},
    },
    onLoad(options) {
        if (options && options.total) {
            const t = parseFloat(options.total);
            if (!isNaN(t) && t > 0) {
                this.setData({ totalPrice: String(t), downPayment: this.calcDownPayment(String(t), this.data.downPaymentRatio) });
                this.onCalculate();
            }
        }
    },
    onTotalPriceInput(e) {
        const v = e.detail.value;
        this.setData({ totalPrice: v, downPayment: this.calcDownPayment(v, this.data.downPaymentRatio) });
    },
    onDownPaymentRatio(e) {
        const ratio = parseInt(e.currentTarget.dataset.value);
        this.setData({ downPaymentRatio: ratio, downPayment: this.calcDownPayment(this.data.totalPrice, ratio) });
        if (this.data.calculated)
            this.doCalculate();
    },
    onDownPaymentInput(e) {
        this.setData({ downPayment: e.detail.value });
    },
    onLoanYears(e) {
        const years = parseInt(e.currentTarget.dataset.value);
        this.setData({ loanYears: years });
        if (this.data.calculated)
            this.doCalculate();
    },
    onRateType(e) {
        const t = e.currentTarget.dataset.type;
        const updates = { rateType: t };
        if (t === 'commercial')
            updates.rateInput = String(DEFAULT_COMMERCIAL_RATE);
        else if (t === 'fund')
            updates.rateInput = String(DEFAULT_FUND_RATE);
        this.setData(updates);
        if (this.data.calculated)
            this.doCalculate();
    },
    onRateInput(e) { this.setData({ rateInput: e.detail.value }); },
    onCommercialRateInput(e) { this.setData({ commercialRate: e.detail.value }); },
    onFundRateInput(e) { this.setData({ fundRate: e.detail.value }); },
    onFundAmountInput(e) { this.setData({ fundAmount: e.detail.value }); },
    calcDownPayment(total, ratio) {
        const p = parseFloat(total);
        if (isNaN(p) || p <= 0)
            return '';
        return (p * ratio / 100).toFixed(1);
    },
    onCalcType(e) {
        this.setData({ calcType: e.currentTarget.dataset.type });
    },
    onCalculate() {
        const totalPrice = parseFloat(this.data.totalPrice);
        if (isNaN(totalPrice) || totalPrice <= 0) {
            wx.showToast({ title: '请输入房屋总价', icon: 'none' });
            return;
        }
        let downPayment = parseFloat(this.data.downPayment);
        if (isNaN(downPayment) || downPayment < 0) {
            downPayment = totalPrice * this.data.downPaymentRatio / 100;
            this.setData({ downPayment: downPayment.toFixed(1) });
        }
        const loanAmount = totalPrice - downPayment;
        if (loanAmount <= 0) {
            wx.showToast({ title: '首付不能大于等于总价', icon: 'none' });
            return;
        }
        this.doCalculate();
    },
    doCalculate() {
        const totalPrice = parseFloat(this.data.totalPrice);
        let downPayment = parseFloat(this.data.downPayment);
        if (isNaN(downPayment))
            downPayment = totalPrice * this.data.downPaymentRatio / 100;
        const totalLoan = totalPrice - downPayment;
        const months = this.data.loanYears * 12;
        let monthly;
        let totalInterest;
        let firstMonthly = 0;
        let monthlyDecrease = 0;
        if (this.data.rateType === 'mixed') {
            const cRate = parseFloat(this.data.commercialRate) / 100 / 12;
            const fRate = parseFloat(this.data.fundRate) / 100 / 12;
            const fAmount = parseFloat(this.data.fundAmount) || 60;
            const cAmount = Math.max(0, totalLoan - fAmount);
            const cMonthly = this.equalInstallment(cAmount, cRate, months);
            const fMonthly = this.equalInstallment(fAmount, fRate, months);
            monthly = cMonthly + fMonthly;
            totalInterest = (cMonthly + fMonthly) * months - totalLoan;
            const cPFirst = this.equalPrincipal(cAmount, cRate, months);
            const fPFirst = this.equalPrincipal(fAmount, fRate, months);
            firstMonthly = cPFirst.first + fPFirst.first;
            monthlyDecrease = cPFirst.decrease + fPFirst.decrease;
        }
        else {
            const rate = parseFloat(this.data.rateInput) / 100 / 12;
            monthly = this.equalInstallment(totalLoan, rate, months);
            totalInterest = monthly * months - totalLoan;
            const pResult = this.equalPrincipal(totalLoan, rate, months);
            firstMonthly = pResult.first;
            monthlyDecrease = pResult.decrease;
        }
        this.setData({
            calculated: true,
            result: {
                loanAmount: totalLoan.toFixed(1),
                monthly: (monthly * 10000).toFixed(0),
                totalInterest: totalInterest.toFixed(1),
                totalPayment: (totalLoan + totalInterest).toFixed(1),
                minIncome: (monthly * 10000 * 2).toFixed(0),
                firstMonthly: (firstMonthly * 10000).toFixed(0),
                monthlyDecrease: (monthlyDecrease * 10000).toFixed(0),
            },
        });
    },
    equalInstallment(principal, monthlyRate, months) {
        if (monthlyRate === 0)
            return principal / months;
        const pow = Math.pow(1 + monthlyRate, months);
        return (principal * monthlyRate * pow) / (pow - 1);
    },
    equalPrincipal(principal, monthlyRate, months) {
        const monthlyPrincipal = principal / months;
        const first = monthlyPrincipal + principal * monthlyRate;
        const decrease = monthlyPrincipal * monthlyRate;
        return { first, decrease };
    },
});
