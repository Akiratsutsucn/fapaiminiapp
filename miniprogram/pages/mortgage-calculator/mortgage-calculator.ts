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
    result: {} as any,
  },

  onTotalPriceInput(e: any) {
    const v = e.detail.value;
    this.setData({ totalPrice: v, downPayment: this.calcDownPayment(v, this.data.downPaymentRatio) });
  },

  onDownPaymentRatio(e: any) {
    const ratio = parseInt(e.currentTarget.dataset.value);
    this.setData({ downPaymentRatio: ratio, downPayment: this.calcDownPayment(this.data.totalPrice, ratio) });
    if (this.data.calculated) this.doCalculate();
  },

  onDownPaymentInput(e: any) {
    this.setData({ downPayment: e.detail.value });
  },

  onLoanYears(e: any) {
    const years = parseInt(e.currentTarget.dataset.value);
    this.setData({ loanYears: years });
    if (this.data.calculated) this.doCalculate();
  },

  onRateType(e: any) {
    const t = e.currentTarget.dataset.type;
    const updates: any = { rateType: t };
    if (t === 'commercial') updates.rateInput = String(DEFAULT_COMMERCIAL_RATE);
    else if (t === 'fund') updates.rateInput = String(DEFAULT_FUND_RATE);
    this.setData(updates);
    if (this.data.calculated) this.doCalculate();
  },

  onRateInput(e: any) { this.setData({ rateInput: e.detail.value }); },
  onCommercialRateInput(e: any) { this.setData({ commercialRate: e.detail.value }); },
  onFundRateInput(e: any) { this.setData({ fundRate: e.detail.value }); },
  onFundAmountInput(e: any) { this.setData({ fundAmount: e.detail.value }); },

  calcDownPayment(total: string, ratio: number): string {
    const p = parseFloat(total);
    if (isNaN(p) || p <= 0) return '';
    return (p * ratio / 100).toFixed(1);
  },

  onCalcType(e: any) {
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
    if (isNaN(downPayment)) downPayment = totalPrice * this.data.downPaymentRatio / 100;
    const totalLoan = totalPrice - downPayment;

    const months = this.data.loanYears * 12;

    let monthly: number;
    let totalInterest: number;
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
    } else {
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
        monthly: monthly.toFixed(0),
        totalInterest: totalInterest.toFixed(1),
        totalPayment: (totalLoan + totalInterest).toFixed(1),
        minIncome: (monthly * 2).toFixed(0),
        firstMonthly: firstMonthly.toFixed(0),
        monthlyDecrease: monthlyDecrease.toFixed(0),
      },
    });
  },

  // 等额本息
  equalInstallment(principal: number, monthlyRate: number, months: number): number {
    if (monthlyRate === 0) return principal / months;
    const pow = Math.pow(1 + monthlyRate, months);
    return (principal * monthlyRate * pow) / (pow - 1);
  },

  // 等额本金
  equalPrincipal(principal: number, monthlyRate: number, months: number): { first: number; decrease: number } {
    const monthlyPrincipal = principal / months;
    const first = monthlyPrincipal + principal * monthlyRate;
    const decrease = monthlyPrincipal * monthlyRate;
    return { first, decrease };
  },
});
