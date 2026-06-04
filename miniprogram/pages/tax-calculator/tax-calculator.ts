// 法拍房税费 / 上岸成本计算器
// 规则为沪甬杭常见口径，仅供参考，最终以税务/不动产登记部门核定为准。

interface FeeResult {
  deedTax: string;        // 契税
  vat: string;            // 增值税及附加
  personalTax: string;    // 个人所得税
  agentFee: string;       // 代办/服务费
  otherTax: string;       // 其他税费(印花等)
  totalTax: string;       // 税费合计
  landingPrice: string;   // 上岸总价(成交价+税费)
  taxRatePct: string;     // 税费占成交价比例
}

Page({
  data: {
    dealPrice: '',          // 成交价(万元)
    area: '',               // 面积(㎡)
    isFirstHome: true,      // 是否首套
    overTwoYears: true,     // 是否满2年
    isUnique: true,         // 是否卖方唯一住房(满五唯一免个税)
    agentRatePct: '1',      // 代办服务费率(%)
    calculated: false,
    result: {} as FeeResult,
  },

  onLoad(options: any) {
    // 支持从房源详情带入成交价(起拍价，万元)与面积
    if (options.price) {
      const wan = (parseFloat(options.price) / 10000).toFixed(1);
      this.setData({ dealPrice: wan });
    }
    if (options.area) this.setData({ area: options.area });
    if (options.price) this.doCalc();
  },

  onDealPriceInput(e: any) { this.setData({ dealPrice: e.detail.value }); if (this.data.calculated) this.doCalc(); },
  onAreaInput(e: any) { this.setData({ area: e.detail.value }); if (this.data.calculated) this.doCalc(); },
  onAgentRateInput(e: any) { this.setData({ agentRatePct: e.detail.value }); if (this.data.calculated) this.doCalc(); },

  onToggleFirstHome(e: any) { this.setData({ isFirstHome: e.currentTarget.dataset.value === 'true' }); if (this.data.calculated) this.doCalc(); },
  onToggleYears(e: any) { this.setData({ overTwoYears: e.currentTarget.dataset.value === 'true' }); if (this.data.calculated) this.doCalc(); },
  onToggleUnique(e: any) { this.setData({ isUnique: e.currentTarget.dataset.value === 'true' }); if (this.data.calculated) this.doCalc(); },

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
    if (isNaN(priceWan) || priceWan <= 0) return;
    const price = priceWan * 10000;         // 元
    const area = parseFloat(this.data.area) || 0;

    // 契税：首套 ≤90㎡ 1%，>90㎡ 1.5%；二套统一 3%
    let deedRate: number;
    if (!this.data.isFirstHome) {
      deedRate = 0.03;
    } else {
      deedRate = (area > 0 && area <= 90) ? 0.01 : 0.015;
    }
    const deedTax = price * deedRate;

    // 增值税及附加：满2年免征；不满2年按 5.3%(含附加)全额征
    const vat = this.data.overTwoYears ? 0 : price * 0.053;

    // 个税：满五唯一免征；否则按全额 1% 简易计征
    const personalTax = (this.data.overTwoYears && this.data.isUnique) ? 0 : price * 0.01;

    // 代办/服务费：按费率
    const agentRate = (parseFloat(this.data.agentRatePct) || 0) / 100;
    const agentFee = price * agentRate;

    // 其他(印花/登记等)粗估固定值
    const otherTax = 500;

    const totalTax = deedTax + vat + personalTax + agentFee + otherTax;
    const landing = price + totalTax;

    const toWan = (v: number) => (v / 10000).toFixed(2);
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
