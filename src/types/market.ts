export interface MarketMetadata {
  lastUpdated: string;
  lastUpdatedSGT: string;
  nextRefreshSGT: string;
  edition: string;
  timezone: string;
}

export type MacroTabId = 'global' | 'indonesia' | 'indonesiaNews' | 'china' | 'korea' | 'india' | 'equities';

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
    fiveTenSpread?: number;
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
  maturity?: string;
  yield: number;
  changeBps: number;
  coupon: number;
}

export interface SRBIAuction {
  tenor: string;
  tenorDays: number;
  series?: string;
  auctionDate: string;
  weightedAvgYield: number;
  cutOffYield: number;
  biddingRateRange?: string;
  nominalBidsIDR?: string;
  awardedVolumeIDR: string;
  sourceUrl?: string;
}

export interface JisdorHistoryItem {
  date: string;
  rate: number;
}

export interface RegionalDisclosureItem {
  title: string;
  headline?: string;
  source: string;
  significance: string;
  url?: string;
  timeAgo?: string;
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
  noteworthyHeadlines: RegionalDisclosureItem[];
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
  jisdorChange?: number;
  jisdorHistory?: JisdorHistoryItem[];
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

export interface CcdcBondItem {
  tenor: string;
  code: string;
  maturity?: string;
  yield: number;
  priorYield?: number;
  changeBps: number;
  coupon: number;
}

export interface ChinaMoneyRateItem {
  instrument: string;
  code: string;
  rate: number;
  changeBps: number;
  description: string;
}

export interface ChinaMacroData {
  argonCommentary?: ArgonCommentary;
  commentary: {
    title: string;
    date: string;
    executiveSummary: string;
    macroPillars: Array<{
      heading: string;
      analysis: string;
    }>;
    policyPosture: string;
    noteworthyHeadlines: RegionalDisclosureItem[];
  };
  bonds: {
    curveDate: string;
    ccdcCgb: CcdcBondItem[];
    policyAndMoneyRates: ChinaMoneyRateItem[];
    pbocOmo7dRate: number;
    lpr1Y: number;
    lpr5Y: number;
    cpiInflationYoY: number;
    sovereignSpread10Y: number;
  };
  fxAndEquities: {
    cnySpot: number;
    cnyChange: number;
    cnyChangePct: number;
    cnhSpot: number;
    cnhChange: number;
    cnhChangePct: number;
    pbocFixing: number;
    pbocFixingChange: number;
    cnhCnySpreadPips: number;
    shanghaiComposite: {
      level: number;
      change: number;
      changePct: number;
    };
    csi300Index: {
      level: number;
      change: number;
      changePct: number;
    };
    northboundBondConnectFlow: string;
  };
}

export interface KofiaKtbBondItem {
  tenor: string;
  code: string;
  series: string;
  yield: number;
  priorYield?: number;
  changeBps: number;
  coupon: number;
}

export interface SofiaMoneyRateItem {
  instrument: string;
  code: string;
  rate: number;
  changeBps: number;
  description: string;
}

export interface KoreaMacroData {
  argonCommentary?: ArgonCommentary;
  commentary: {
    title: string;
    date: string;
    executiveSummary: string;
    macroPillars: Array<{
      heading: string;
      analysis: string;
    }>;
    policyPosture: string;
    noteworthyHeadlines: RegionalDisclosureItem[];
  };
  bonds: {
    quotationDate: string;
    kofiaKtb: KofiaKtbBondItem[];
    sofiaAndMoneyRates: SofiaMoneyRateItem[];
    bokBaseRate: number;
    kofrOvernightRate: number;
    cd91dRate: number;
    cpiInflationYoY: number;
    sovereignSpread10Y: number;
  };
  fxAndEquities: {
    krwSpot: number;
    krwChange: number;
    krwChangePct: number;
    ndf1M: number;
    ndfSpread1M: number;
    kospiIndex: {
      level: number;
      change: number;
      changePct: number;
    };
    kosdaqIndex: {
      level: number;
      change: number;
      changePct: number;
    };
    foreignKtbFlows: string;
  };
}

export interface IndiaGSecBondItem {
  tenor: string;
  code: string;
  series: string;
  yield: number;
  rbiBenchmarkYield?: number;
  changeBps: number;
  coupon: number;
}

export interface IndiaMoneyRateItem {
  instrument: string;
  code: string;
  rate: number;
  changeBps: number;
  description: string;
}

export interface RbiOfficialReleaseItem {
  title: string;
  category: string;
  pubDate: string;
  summary: string;
  url: string;
}

export interface IndiaMacroData {
  argonCommentary?: ArgonCommentary;
  commentary: {
    title: string;
    date: string;
    executiveSummary: string;
    macroPillars: Array<{
      heading: string;
      analysis: string;
    }>;
    policyPosture: string;
    noteworthyHeadlines: RegionalDisclosureItem[];
    rbiOfficialReleases: RbiOfficialReleaseItem[];
  };
  bonds: {
    quotationDate: string;
    gsecCurve: IndiaGSecBondItem[];
    rbiAndMoneyRates: IndiaMoneyRateItem[];
    rbiRepoRate: number;
    sdfRate: number;
    msfRate: number;
    crrRate: number;
    slrRate: number;
    callRateRange: string;
    tbill91dRate: number;
    tbill182dRate: number;
    tbill364dRate: number;
    cpiInflationYoY: number;
    sovereignSpread10Y: number;
    latestGsecAuctionSummary?: string;
  };
  fxAndEquities: {
    inrSpot: number;
    inrChange: number;
    inrChangePct: number;
    rbiReferenceUsd: number;
    rbiReferenceEur: number;
    rbiReferenceGbp: number;
    rbiReferenceJpy: number;
    forexReservesUsdBn: number;
    forexReservesWeeklyChgUsdBn: number;
    forexReservesDate: string;
    nifty50Index: {
      level: number;
      change: number;
      changePct: number;
    };
    sensexIndex: {
      level: number;
      change: number;
      changePct: number;
    };
    farIndexInflows: string;
  };
}

export interface SpxForwardPeItem {
  rank: number;
  ticker: string;
  company: string;
  sector: string;
  price: number;
  changePct: number;
  forwardEps: number;
  forwardPe: number;
  earningsYieldPct: number;
  marketCapBn: number;
}

export interface SpxFcfEvItem {
  rank: number;
  ticker: string;
  company: string;
  sector: string;
  price: number;
  changePct: number;
  fcfTtmBn: number;
  marketCapBn: number;
  netDebtBn: number;
  enterpriseValueBn: number;
  fcfToEvPct: number;
}

export interface SpxDividendYieldItem {
  rank: number;
  ticker: string;
  company: string;
  sector: string;
  price: number;
  changePct: number;
  annualDividendPerShare: number;
  dividendYieldPct: number;
  fcfPayoutRatioPct: number;
  marketCapBn: number;
}

export interface TableMethodologySubNote {
  dataSource: string;
  formula: string;
  derivationAndMeaning: string;
  screeningRule: string;
}

export interface UsEquitiesData {
  argonCommentary?: ArgonCommentary;
  asOfDate: string;
  indexSummary: {
    spxLevel: number;
    spxChange: number;
    spxChangePct: number;
    spxForwardPe: number;
    spxEarningsYieldPct: number;
    us10YYieldPct: number;
    equityRiskPremiumBps: number;
    spxDividendYieldPct: number;
    spxFcfYieldPct: number;
  };
  topForwardPe: SpxForwardPeItem[];
  forwardPeSubNote: TableMethodologySubNote;
  topFcfToEv: SpxFcfEvItem[];
  fcfToEvSubNote: TableMethodologySubNote;
  topDividendYield: SpxDividendYieldItem[];
  dividendYieldSubNote: TableMethodologySubNote;
  noteworthyHeadlines: RegionalDisclosureItem[];
}

export interface ArgonCriticalLevel {
  asset: string;
  current: string;
  support: string;
  resistance: string;
  implication: string;
}

export interface ArgonWatchEvent {
  event: string;
  timing: string;
  impact: "High" | "Critical" | "Medium";
  watchFor: string;
}

export interface ArgonCommentary {
  modelLabel: string;
  title: string;
  regimeBadge: string;
  updatedAtSGT?: string;
  conviction: string;
  synthesis: string;
  positioningTakeaway: string;
  criticalLevels: ArgonCriticalLevel[];
  eventsToWatch: ArgonWatchEvent[];
}

export interface IndonesiaTranslatedNewsItem {
  rank: number;
  id: string;
  titleEn: string;
  titleId: string;
  source: string;
  feedSection: string;
  timeAgo: string;
  category: string;
  impactDirection: 'Market-Moving' | 'Supportive' | 'Risk-Off' | 'Policy Watch' | string;
  impactScore: number;
  readPopularityBadge: string;
  summaryEn: string;
  marketSignificance: string;
  url: string;
}

export interface IndonesiaLocalNewsData {
  asOfDate: string;
  sourcesMonitored: string[];
  translationEngine: string;
  argonCommentary?: ArgonCommentary;
  topImportant: IndonesiaTranslatedNewsItem[];
  topRead: IndonesiaTranslatedNewsItem[];
}

export interface DailyMacroSnapshot {
  metadata: MarketMetadata;
  globalMacro: {
    argonCommentary?: ArgonCommentary;
    topNews: MacroNewsItem[];
    yieldCurve: YieldCurveData;
    futures: MarketFuture[];
    fxRates: FxRate[];
    commodities: Commodity[];
  };
  indonesia: {
    argonCommentary?: ArgonCommentary;
    commentary: IndonesiaCommentary;
    bonds: IndonesiaBonds;
    fxAndNdf: IndonesiaFxAndNdf;
  };
  indonesiaLocalNews?: IndonesiaLocalNewsData;
  china?: ChinaMacroData;
  korea?: KoreaMacroData;
  india?: IndiaMacroData;
  equities?: UsEquitiesData;
}

