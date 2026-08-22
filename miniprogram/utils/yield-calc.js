// 法拍房收益计算器 —— 计算引擎（JS 版，与 yield-calc.ts 同步，勿单独改动）
// 规则为上海/宁波/杭州/临沂现行政策常见口径，仅供参考，最终以税务/不动产登记部门核定为准。
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

/** 四城税费规则。结构统一，差异主要在费率口径。所有税率以最新政策为准，可在此集中维护。 */
const CITY_TAX_RULES = {
  // 上海：2024年11月起取消普宅/非普宅认定，满2年免增值税
  310000: {
    cityId: 310000, cityName: '上海',
    deed: { firstSmall: 0.01, firstLarge: 0.015, secondLarge: 0.02, thirdPlus: 0.03 },
    regFee: 80,
    vatRate: 0.03,
    incomeAssessRate: 0.01, incomeDiffRate: 0.20,
    agentRate: 0.015,
    advanceRate: 0.01,
  },
  // 宁波
  330200: {
    cityId: 330200, cityName: '宁波',
    deed: { firstSmall: 0.01, firstLarge: 0.015, secondLarge: 0.02, thirdPlus: 0.03 },
    regFee: 80,
    vatRate: 0.03,
    incomeAssessRate: 0.01, incomeDiffRate: 0.20,
    agentRate: 0.015,
    advanceRate: 0.01,
  },
  // 杭州
  330100: {
    cityId: 330100, cityName: '杭州',
    deed: { firstSmall: 0.01, firstLarge: 0.015, secondLarge: 0.02, thirdPlus: 0.03 },
    regFee: 80,
    vatRate: 0.03,
    incomeAssessRate: 0.01, incomeDiffRate: 0.20,
    agentRate: 0.015,
    advanceRate: 0.01,
  },
  // 临沂
  371300: {
    cityId: 371300, cityName: '临沂',
    deed: { firstSmall: 0.01, firstLarge: 0.015, secondLarge: 0.02, thirdPlus: 0.03 },
    regFee: 80,
    vatRate: 0.03,
    incomeAssessRate: 0.01, incomeDiffRate: 0.20,
    agentRate: 0.015,
    advanceRate: 0.01,
  },
};

/** 城市列表（供页面渲染选择 chip） */
const CITY_LIST = [
  { cityId: 310000, cityName: '上海' },
  { cityId: 330200, cityName: '宁波' },
  { cityId: 330100, cityName: '杭州' },
  { cityId: 371300, cityName: '临沂' },
];

/** 面积阈值（㎡），契税档位分界 */
const AREA_THRESHOLD = 140;

/** 印花税率（买卖双方各按成交价 × 0.0005 = 万分之五） */
const STAMP_RATE = 0.0005;

/** 计算契税额 */
function calcDeedTax(rule, price, area, homeCount) {
  const d = rule.deed;
  let rate;
  if (homeCount >= 3) {
    rate = d.thirdPlus;
  } else if (homeCount === 2) {
    rate = area > AREA_THRESHOLD ? d.secondLarge : d.firstSmall;
  } else {
    rate = area > AREA_THRESHOLD ? d.firstLarge : d.firstSmall;
  }
  return price * rate;
}

/** 核心计算 */
function calcYield(input, cond) {
  const rule = CITY_TAX_RULES[input.cityId] || CITY_TAX_RULES[310000];
  const price = input.dealPrice;
  const sell = input.sellPrice;

  // ===== 买入阶段 =====
  const deedTax = calcDeedTax(rule, price, input.area, cond.homeCount);   // 契税
  const stampTax = price * STAMP_RATE;                                    // 印花税：法拍成交价 × 0.0005
  const regFee = rule.regFee;                                             // 不动产登记费：固定80元
  // 垫付的卖方税费：按法拍成交价 × 1% 核定（合并增值税及附加+个税，标注可申请退还）
  const advancePaid = price * rule.advanceRate;

  const buyItems = [
    { key: 'deal', label: '法拍成交价', amount: price },
    { key: 'deposit', label: '保证金（已抵扣进成交价）', amount: input.deposit, note: '仅展示不计入' },
    { key: 'deed', label: '契税', amount: deedTax },
    { key: 'stamp', label: '印花税（成交价0.05%）', amount: stampTax },
    { key: 'reg', label: '不动产登记费（固定80元）', amount: regFee },
    { key: 'repair', label: '维修基金欠费', amount: input.repairFundOwed },
    { key: 'propOwed', label: '物业欠费', amount: input.propertyOwed },
    { key: 'utilOwed', label: '水电煤欠费', amount: input.utilityOwed },
    { key: 'auction', label: '竞拍服务费', amount: input.auctionServiceFee },
    { key: 'advance', label: '垫付卖方税费（成交价1%）', amount: advancePaid, note: '可申请退还' },
  ];
  const buyTotal = price + deedTax + stampTax + regFee
    + input.repairFundOwed + input.propertyOwed + input.utilityOwed + input.auctionServiceFee
    + advancePaid;

  // ===== 持有阶段 =====
  const holdFee = input.propertyFeeRate * input.area * 12 * input.holdYears;
  const holdItems = [
    { key: 'holdFee', label: `物业费（${input.propertyFeeRate}元/㎡·月 × ${input.area}㎡ × ${input.holdYears}年）`, amount: holdFee },
  ];
  const holdTotal = holdFee;

  // ===== 卖出阶段 =====
  const diff = sell - price;   // 卖出价 − 买入价（法拍成交价）
  // 增值税及附加：满2年免征；不满2年按卖出总价 × 3% 征收（不可退）
  const sellVat = cond.overTwoYears ? 0 : sell * rule.vatRate;
  // 个税：满五唯一免征；否则差额20% 或 核定1%
  let sellIncome = 0;
  if (!cond.overFiveUnique) {
    if (cond.incomeMode === 'assess') {
      sellIncome = sell * rule.incomeAssessRate;
    } else {
      sellIncome = Math.max(diff, 0) * rule.incomeDiffRate;
    }
  }
  // 中介费：卖方承担卖出价 × 1.5%
  const agentFee = sell * rule.agentRate;
  // 印花税：卖出成交价 × 0.0005
  const sellStamp = sell * STAMP_RATE;

  const sellItems = [
    { key: 'sellVat', label: cond.overTwoYears ? '增值税及附加（满2年免征）' : '增值税及附加（卖出总价3%，不可退）', amount: sellVat },
    { key: 'sellInc', label: cond.overFiveUnique ? '个人所得税（满五唯一免征）' : (cond.incomeMode === 'assess' ? '个人所得税（核定1%）' : '个人所得税（差额20%）'), amount: sellIncome },
    { key: 'agent', label: '二手房中介服务费（卖方1.5%）', amount: agentFee },
    { key: 'sellStamp', label: '印花税（成交价0.05%）', amount: sellStamp },
  ];
  const sellTotal = sellVat + sellIncome + agentFee + sellStamp;

  // ===== 汇总 =====
  const totalCost = buyTotal + holdTotal + sellTotal;
  const grossProfit = sell - totalCost;                                  // 毛利润（含垫付未退）
  const advanceRefund = cond.advanceRefundable ? advancePaid : 0;        // 可退还金额
  const investCost = totalCost - advanceRefund;                          // 实际投入成本
  const netProfit = sell - investCost;                                   // 净利润（扣除垫付退还后）
  const returnRate = investCost > 0 ? netProfit / investCost : 0;
  const annualRate = input.holdYears > 0 ? returnRate / input.holdYears : returnRate;

  return {
    cityName: rule.cityName,
    buyItems, holdItems, sellItems,
    buyTotal, holdTotal, sellTotal,
    totalCost, grossProfit,
    advancePaid, advanceRefund,
    netProfit, investCost,
    returnRate, annualRate,
    sellPrice: sell,
  };
}

exports.CITY_LIST = CITY_LIST;
exports.CITY_TAX_RULES = CITY_TAX_RULES;
exports.calcYield = calcYield;
