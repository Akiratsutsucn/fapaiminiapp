// 法拍房收益计算器（JS 版，与 yield-calculator.ts 同步，勿单独改动）
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yield_calc_1 = require("../../utils/yield-calc");

Page({
  data: {
    cities: yield_calc_1.CITY_LIST,
    cityIndex: 0,

    dealPrice: '',
    deposit: '',
    area: '',
    repairFundOwed: '',
    propertyOwed: '',
    utilityOwed: '',
    auctionServiceFee: '',
    propertyFeeRate: '',
    sellPrice: '',
    holdYears: '',

    homeCount: 1,
    overTwoYears: true,
    overFiveUnique: false,
    incomeMode: 'diff',
    advanceRefundable: true,

    calculated: false,

    netProfit: '',
    returnRate: '',
    annualRate: '',
    grossProfit: '',
    totalCost: '',
    investCost: '',
    advancePaid: '',
    advanceRefund: '',
    sellPriceWan: '',
    cityName: '',
    stages: [],

    shareImg: '',
    showShareModal: false,
    generating: false,
  },

  onLoad(options) {
    if (options.price) {
      this.setData({ dealPrice: String(parseFloat(options.price) || '') });
    }
    if (options.area) this.setData({ area: options.area });
  },

  onCityTap(e) {
    this.setData({ cityIndex: Number(e.currentTarget.dataset.index) });
    if (this.data.calculated) this.doCalc();
  },
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
    if (this.data.calculated) this.doCalc();
  },
  onHomeCount(e) {
    this.setData({ homeCount: Number(e.currentTarget.dataset.value) });
    if (this.data.calculated) this.doCalc();
  },
  onToggleTwoYears(e) {
    this.setData({ overTwoYears: e.currentTarget.dataset.value === 'true' });
    if (this.data.calculated) this.doCalc();
  },
  onToggleFiveUnique(e) {
    this.setData({ overFiveUnique: e.currentTarget.dataset.value === 'true' });
    if (this.data.calculated) this.doCalc();
  },
  onIncomeMode(e) {
    this.setData({ incomeMode: e.currentTarget.dataset.value });
    if (this.data.calculated) this.doCalc();
  },

  onCalculate() {
    const dealWan = parseFloat(this.data.dealPrice);
    if (isNaN(dealWan) || dealWan <= 0) {
      wx.showToast({ title: '请输入法拍成交价', icon: 'none' });
      return;
    }
    const sellWan = parseFloat(this.data.sellPrice);
    if (isNaN(sellWan) || sellWan <= 0) {
      wx.showToast({ title: '请输入二手房卖出总价', icon: 'none' });
      return;
    }
    const years = parseFloat(this.data.holdYears);
    if (isNaN(years) || years <= 0) {
      wx.showToast({ title: '请输入持有年数', icon: 'none' });
      return;
    }
    this.doCalc();
  },

  doCalc() {
    const num = (s) => {
      const v = parseFloat(s);
      return isNaN(v) ? 0 : v;
    };
    const city = yield_calc_1.CITY_LIST[this.data.cityIndex];

    const input = {
      cityId: city.cityId,
      dealPrice: num(this.data.dealPrice),
      deposit: num(this.data.deposit),
      area: num(this.data.area),
      repairFundOwed: num(this.data.repairFundOwed),
      propertyOwed: num(this.data.propertyOwed),
      utilityOwed: num(this.data.utilityOwed),
      auctionServiceFee: num(this.data.auctionServiceFee),
      propertyFeeRate: num(this.data.propertyFeeRate),
      sellPrice: num(this.data.sellPrice),
      holdYears: num(this.data.holdYears),
    };
    const cond = {
      homeCount: this.data.homeCount,
      overTwoYears: this.data.overTwoYears,
      overFiveUnique: this.data.overFiveUnique,
      incomeMode: this.data.incomeMode,
      advanceRefundable: this.data.advanceRefundable,
    };

    const r = yield_calc_1.calcYield(input, cond);

    // 金额统一以「元」显示（千分位），与用户填写单位一致
    const toYuan = (v) => {
      const n = Math.round(v);
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };
    const mapItems = (items) =>
      items
        .filter((it) => it.key !== 'deposit')
        .map((it) => ({
          label: it.label,
          amount: toYuan(it.amount),
          note: it.note || '',
        }));

    const stages = [
      { title: '买入阶段支出', total: toYuan(r.buyTotal), items: mapItems(r.buyItems) },
      { title: '持有阶段支出', total: toYuan(r.holdTotal), items: mapItems(r.holdItems) },
      { title: '卖出阶段支出', total: toYuan(r.sellTotal), items: mapItems(r.sellItems) },
    ];

    this.setData({
      calculated: true,
      cityName: r.cityName,
      netProfit: toYuan(r.netProfit),
      grossProfit: toYuan(r.grossProfit),
      totalCost: toYuan(r.totalCost),
      investCost: toYuan(r.investCost),
      advancePaid: toYuan(r.advancePaid),
      advanceRefund: toYuan(r.advanceRefund),
      sellPriceWan: toYuan(r.sellPrice),
      returnRate: (r.returnRate * 100).toFixed(1),
      annualRate: (r.annualRate * 100).toFixed(1),
      stages,
    });
  },

  onShareAppMessage() {
    return {
      title: '法拍房收益计算器：买入成本全算清，未来收益早知道',
      path: '/pages/yield-calculator/yield-calculator',
    };
  },

  onGenShareImage() {
    if (!this.data.calculated) {
      wx.showToast({ title: '请先计算', icon: 'none' });
      return;
    }
    if (this.data.generating) return;
    this.setData({ generating: true });
    this.drawShareImage()
      .then((img) => {
        this.setData({ shareImg: img, showShareModal: true, generating: false });
      })
      .catch(() => {
        this.setData({ generating: false });
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      });
  },

  drawShareImage() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery();
      query.select('#shareCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) { reject(new Error('no canvas')); return; }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const W = 750;
          const H = 1180;
          const dpr = 2;
          canvas.width = W * dpr;
          canvas.height = H * dpr;
          ctx.scale(dpr, dpr);

          const d = this.data;
          const BLUE_900 = '#1a2f52';
          const BLUE_700 = '#2d4a7a';
          const BLUE_200 = '#b8cce0';
          const ORANGE = '#FF6B35';
          const GOLD = '#C99846';
          const TEXT_2 = '#5a5a5a';
          const HINT = '#8aa0bd';

          ctx.fillStyle = '#f5f6f8';
          ctx.fillRect(0, 0, W, H);

          const grad = ctx.createLinearGradient(0, 0, W, 220);
          grad.addColorStop(0, BLUE_900);
          grad.addColorStop(1, BLUE_700);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, 240);

          ctx.fillStyle = BLUE_200;
          ctx.font = '26px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('法拍者联盟 · 收益测算报告', W / 2, 70);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 44px sans-serif';
          ctx.fillText('法拍房收益测算', W / 2, 130);

          ctx.fillStyle = BLUE_200;
          ctx.font = '24px sans-serif';
          ctx.fillText(`${d.cityName} · 持有 ${d.holdYears} 年 · 买入到卖出`, W / 2, 175);

          ctx.fillStyle = '#ffffff';
          this.roundRect(ctx, 40, 280, W - 80, 220, 24);
          ctx.fill();

          ctx.fillStyle = HINT;
          ctx.font = '26px sans-serif';
          ctx.fillText('预计净利润（扣除垫付退还后）', W / 2, 340);

          ctx.fillStyle = d.netProfit.indexOf('-') === 0 ? '#b85a5a' : ORANGE;
          ctx.font = 'bold 84px sans-serif';
          const profitText = `${d.netProfit}`;
          const profitW = ctx.measureText(profitText).width;
          ctx.font = 'bold 30px sans-serif';
          const yuanText = ' 元';
          const yuanW = ctx.measureText(yuanText).width;
          // 数字与「元」整体居中，「元」跟在数字后、底部对齐
          const startX = W / 2 - (profitW + yuanW) / 2;
          ctx.textAlign = 'left';
          ctx.font = 'bold 84px sans-serif';
          ctx.fillText(profitText, startX, 450);
          ctx.font = 'bold 30px sans-serif';
          ctx.fillText(yuanText, startX + profitW, 450);
          ctx.textAlign = 'center';

          ctx.fillStyle = '#ffffff';
          this.roundRect(ctx, 40, 530, (W - 100) / 2, 150, 24);
          ctx.fill();
          this.roundRect(ctx, 60 + (W - 100) / 2, 530, (W - 100) / 2, 150, 24);
          ctx.fill();

          ctx.fillStyle = HINT;
          ctx.font = '24px sans-serif';
          ctx.fillText('回报收益率', 40 + (W - 100) / 4, 585);
          ctx.fillText('年化收益率', 60 + (W - 100) / 2 + (W - 100) / 4, 585);
          ctx.fillStyle = BLUE_900;
          ctx.font = 'bold 48px sans-serif';
          ctx.fillText(`${d.returnRate}%`, 40 + (W - 100) / 4, 650);
          ctx.fillText(`${d.annualRate}%`, 60 + (W - 100) / 2 + (W - 100) / 4, 650);

          let y = 740;
          ctx.textAlign = 'left';
          ctx.fillStyle = BLUE_900;
          ctx.font = 'bold 32px sans-serif';
          ctx.fillText('成本构成（元）', 50, y);
          y += 24;
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(50, y);
          ctx.lineTo(110, y);
          ctx.stroke();
          y += 40;

          const rows = [
            ['买入阶段支出', d.stages[0] ? d.stages[0].total : '0'],
            ['持有阶段支出', d.stages[1] ? d.stages[1].total : '0'],
            ['卖出阶段支出', d.stages[2] ? d.stages[2].total : '0'],
            ['总成本（含垫付）', d.totalCost],
            ['垫付卖方税费（可申请退还）', d.advancePaid],
            ['二手房卖出总价', d.sellPriceWan],
          ];
          ctx.font = '27px sans-serif';
          rows.forEach((row) => {
            ctx.fillStyle = TEXT_2;
            ctx.textAlign = 'left';
            ctx.fillText(row[0], 60, y);
            ctx.fillStyle = BLUE_900;
            ctx.textAlign = 'right';
            ctx.font = 'bold 27px sans-serif';
            ctx.fillText(row[1], W - 60, y);
            ctx.font = '27px sans-serif';
            y += 56;
          });

          ctx.textAlign = 'center';
          ctx.fillStyle = HINT;
          ctx.font = '20px sans-serif';
          ctx.fillText('税费按现行政策常见口径估算，以税务/不动产登记部门核定为准', W / 2, H - 70);
          ctx.fillText('垫付税费退还以实际到账为准 · 法拍者联盟', W / 2, H - 36);

          wx.canvasToTempFilePath({
            canvas,
            success: (r) => resolve(r.tempFilePath),
            fail: reject,
          });
        });
    });
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  onCloseShareModal() {
    this.setData({ showShareModal: false });
  },

  onSaveShareImage() {
    const img = this.data.shareImg;
    if (!img) return;
    wx.saveImageToPhotosAlbum({
      filePath: img,
      success: () => {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
        this.setData({ showShareModal: false });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('auth') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存图片到相册',
            confirmText: '去设置',
            success: (r) => { if (r.confirm) wx.openSetting(); },
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },
});
