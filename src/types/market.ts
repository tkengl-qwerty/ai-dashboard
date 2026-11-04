export interface MarketMetadata {
  lastUpdated: string;
  lastUpdatedSGT: string;
  nextRefreshSGT: string;
  edition: string;
  timezone: string;
}

export interface MacroNewsItem {
  id: string;
  headline: string;
  source: string;
  timeAgo: string;
  category: "Fed Policy" | "Inflation" | "Labor" | "Fiscal & Debt" | "Trade" | string;
  summary: string;
  macroTakeaway: string;
  impact: "Hawkish" | "Dovish" | "Risk-On" | "Risk-Off" | "Neutral";
  url?: string;
}

export interface YieldCurveTenor {
  label: string;
  years: number;
  yield: number;
  changeBps: number;
  priorClose: number;
}

export interface YieldCurveData {
  tenors: YieldCurveTenor[];
  spreads: {
    twoTenSpread: number;
    threeMonthTenSpread: number;
    fiveThirtySpread: number;
    isInverted: boolean;
  };
}

export interface MarketFuture {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}

export interface FxRate {
  pair: string;
  name: string;
  rate: number;
  change: number;
  changePct: number;
}

export interface Commodity {
  symbol: string;
  name: string;
  price: number;
  unit: string;
  change: number;
  changePct: number;
}

export interface IndoGBBond {
  tenor: string;
  code: string;
  yield: number;
  changeBps: number;
  coupon: number;
}

export interface SRBIAuction {
  tenor: string;
  tenorDays: number;
  auctionDate: string;
  cutOffYield: number;
  awardedVolumeIDR: string;
}

export interface IndonesiaCommentary {
  title: string;
  date: string;
  executiveSummary: string;
  macroPillars: Array<{
    heading: string;
    analysis: string;
  }>;
  biPolicyPosture: string;
  noteworthyHeadlines: Array<{
    title: string;
    source: string;
    significance: string;
  }>;
}

export interface IndonesiaBonds {
  indoGB: IndoGBBond[];
  srbi: SRBIAuction[];
  sovereignSpread10Y: number;
  biRate: number;
  cpiInflationYoY: number;
}

export interface IndonesiaFxAndNdf {
  spotRate: number;
  spotChange: number;
  spotChangePct: number;
  jisdorRate: number;
  ndf1M: number;
  ndf3M: number;
  ndfSpread1M: number;
  annualizedBasis1M: number;
  ihsgIndex: {
    level: number;
    change: number;
    changePct: number;
  };
  foreignFlowsDaily: string;
  foreignFlowsYTD: string;
}

export interface DailyMacroSnapshot {
  metadata: MarketMetadata;
  globalMacro: {
    topNews: MacroNewsItem[];
    yieldCurve: YieldCurveData;
    futures: MarketFuture[];
    fxRates: FxRate[];
    commodities: Commodity[];
  };
  indonesia: {
    commentary: IndonesiaCommentary;
    bonds: IndonesiaBonds;
    fxAndNdf: IndonesiaFxAndNdf;
  };
}
