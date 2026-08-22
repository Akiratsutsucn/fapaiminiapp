// 法拍房收益计算器 —— 计算引擎
// 规则为上海/宁波/杭州/临沂现行政策常见口径，仅供参考，最终以税务/不动产登记部门核定为准。
//
// 计算模型（法拍买入 → 持有 → 二手卖出，转手差价收益）：
//   买入支出 = 成交价 + 契税 + 印花税 + 登记费
//              + 维修基金欠费 + 物业欠费 + 水电煤欠费 + 竞拍服务费
//              + 垫付卖方税(增值税+个税, 标注可退)   // 保证金仅展示不计入
//   持有支出 = 物业费单价 × 面积 × 12 × 持有年数
//   卖出支出 = 增值税及附加(卖出) + 个税(卖出) + 中介费(卖出价×1.5%)
//   总成本   = 买入支出 + 持有支出 + 卖出支出
//   净利润(主口径) = 卖出总价 − (总成本 − 垫付可退金额)   // 扣除垫付退还后
//   回报收益率 = 净利润 ÷ 实际投入成本；年化 = 回报收益率 ÷ 持有年数

/** 契税档位（2024年12月新政，全国统一含上海）：面积阈值 140㎡ */
interface DeedRule {
  /** ≤140㎡ 首套/二套 */
  firstSmall: number;
  /** >140㎡ 首套 */
  firstLarge: number;
  /** >140㎡ 二套 */
  secondLarge: number;
  /** 三套及以上（不论面积） */
  thirdPlus: number;
}

interface CityTaxRule {
  cityId: number;
  cityName: string;
  deed: DeedRule;
  /** 住宅不动产登记费（元/件，固定小额） */
  regFee: number;
  /** 增值税及附加率（不满2年时按差额征收） */
  vatRate: number;  // 不满2年时按卖出总价计征
  /** 个税核定额征收率（无法提供原值凭证时，按卖出价） */
  incomeAssessRate: number;
  /** 个税差额征收率 */
  incomeDiffRate: number;
  /** 二手房中介服务费率（卖方承担，按卖出价） */
  agentRate: number;
  /** 买入时买方垫付的卖方税费率（按法拍成交价核定，合并增值税及附加+个税，可退） */
  advanceRate: number;
}

/** 四城税费规则。结构统一，差异主要在费率口径。所有税率以最新政策为准，可在此集中维护。 */
const CITY_TAX_RULES: { [cityId: number]: CityTaxRule } = {
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

/** 用户输入（金额单位：元；面积㎡；年数） */
export interface YieldInput {
  cityId: number;
  /** 法拍成交价 */
  dealPrice: number;
  /** 保证金（仅展示，不计入成本，因已抵扣进成交价） */
  deposit: number;
  /** 建筑面积㎡ */
  area: number;
  /** 维修基金欠费 */
  repairFundOwed: number;
  /** 物业欠费 */
  propertyOwed: number;
  /** 水电煤欠费 */
  utilityOwed: number;
  /** 竞拍服务费 */
  auctionServiceFee: number;
  /** 物业费单价（元/㎡·月） */
  propertyFeeRate: number;
  /** 二手房卖出总价 */
  sellPrice: number;
  /** 持有年数（买入到卖出间隔） */
  holdYears: number;
}

/** 条件开关 */
export interface YieldCondition {
  /** 套数：1首套 2二套 3三套及以上 */
  homeCount: number;
  /** 是否满2年（卖出时，影响增值税） */
  overTwoYears: boolean;
  /** 是否满五唯一（卖出时，免个税） */
  overFiveUnique: boolean;
  /** 个税计征方式：'diff'差额20% | 'assess'核定1% */
  incomeMode: string;
  /** 垫付的卖方税费默认是否假设能退回 */
  advanceRefundable: boolean;
}

/** 单条费用明细 */
export interface FeeItem {
  key: string;
  label: string;
  amount: number;
  /** 备注（如「可申请退还」「仅展示不计入」） */
  note?: string;
}

/** 计算结果 */
export interface YieldResult {
  cityName: string;
  // 三阶段明细
  buyItems: FeeItem[];
  holdItems: FeeItem[];
  sellItems: FeeItem[];
  // 阶段小计
  buyTotal: number;
  holdTotal: number;
  sellTotal: number;
  // 汇总
  totalCost: number;        // 总成本（含垫付）
  grossProfit: number;      // 毛利润（卖出−总成本，含垫付）
  advancePaid: number;      // 买入垫付的卖方税费合计
  advanceRefund: number;    // 可申请退还金额
  netProfit: number;        // 净利润（主口径：扣除垫付退还后）
  investCost: number;       // 实际投入成本（总成本−可退垫付）
  returnRate: number;       // 回报收益率（小数）
  annualRate: number;       // 年化收益率（小数）
  sellPrice: number;
}

/** 计算契税额 */
function calcDeedTax(rule: CityTaxRule, price: number, area: number, homeCount: number): number {
  const d = rule.deed;
  let rate: number;
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
export function calcYield(input: YieldInput, cond: YieldCondition): YieldResult {
  const rule = CITY_TAX_RULES[input.cityId] || CITY_TAX_RULES[310000];
  const price = input.dealPrice;
  const sell = input.sellPrice;

  // ===== 买入阶段 =====
  const deedTax = calcDeedTax(rule, price, input.area, cond.homeCount);   // 契税
  const stampTax = price * STAMP_RATE;                                    // 印花税：法拍成交价 × 0.0005
  const regFee = rule.regFee;                                             // 不动产登记费：固定80元
  // 垫付的卖方税费：按法拍成交价 × 1% 核定（合并增值税及附加+个税，标注可申请退还）
  const advancePaid = price * rule.advanceRate;

  const buyItems: FeeItem[] = [
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
  const holdItems: FeeItem[] = [
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

  const sellItems: FeeItem[] = [
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

export { CITY_LIST, CITY_TAX_RULES };
