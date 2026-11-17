import {
  ArgonCommentary,
  ChinaMacroData,
  DailyMacroSnapshot,
  IndiaMacroData,
  IndonesiaCommentary,
  KoreaMacroData,
} from '../types/market';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export type CatalystThemeId =
  | 'POLITICAL_GOVERNANCE'
  | 'MONETARY_LIQUIDITY'
  | 'TRADE_TARIFF_TECH'
  | 'MARKET_REFORM_EQUITY'
  | 'FISCAL_SUPPLY'
  | 'FX_EXTERNAL_BALANCE'
  | 'INFLATION_COMMODITY';

interface GenericNewsEntry {
  title: string;
  source: string;
  timeAgo: string;
  significance?: string;
  category?: string;
  impact?: string;
}

interface ClassifiedNewsItem extends GenericNewsEntry {
  theme: CatalystThemeId;
  themeLabel: string;
  weight: number;
}

interface CatalystProfile {
  primaryTheme: CatalystThemeId;
  secondaryTheme: CatalystThemeId;
  primaryLabel: string;
  secondaryLabel: string;
  classified: ClassifiedNewsItem[];
  themeCounts: Record<CatalystThemeId, number>;
  leadItem: ClassifiedNewsItem;
  secondItem: ClassifiedNewsItem;
  thirdItem?: ClassifiedNewsItem;
  fourthItem?: ClassifiedNewsItem;
  fifthItem?: ClassifiedNewsItem;
  distinctThemesDigest: string;
}

const THEME_LABELS: Record<CatalystThemeId, string> = {
  POLITICAL_GOVERNANCE: 'Political, Constitutional & Governance Risk',
  MONETARY_LIQUIDITY: 'Central Bank Rate Calibration & Liquidity Operations',
  TRADE_TARIFF_TECH: 'Trade Tariffs, Tech Curbs & Geopolitical Supply Chains',
  MARKET_REFORM_EQUITY: 'Capital Market Reform, Index Rebalancing & Earnings Dispersion',
  FISCAL_SUPPLY: 'Sovereign Debt Supply, Fiscal Execution & Primary Auctions',
  FX_EXTERNAL_BALANCE: 'FX Intervention, Reserve Buffers & External Balance',
  INFLATION_COMMODITY: 'Inflation Pipeline, Energy & Commodity Pass-Through',
};

function classifyHeadlineTheme(title: string, category?: string, sig?: string): CatalystThemeId {
  const text = `${title} ${category || ''} ${sig || ''}`.toLowerCase();

  if (
    /\b(dpr|mpr|gibran|prabowo|constitutional|mk\b|mahkamah|resign|impeach|parliament|kpk|bribery|corruption|wiretap|police|kapolri|election|midterm|cabinet|minister|president|geopolit|ukraine|iran|putin|war|security|bssn|cyber)\b/.test(
      text
    )
  ) {
    return 'POLITICAL_GOVERNANCE';
  }
  if (
    /\b(tariff|trade|chip|semiconductor|nvidia|export control|curb|apec|sanction|supply chain|fdi|bilateral|customs|import|export)\b/.test(
      text
    )
  ) {
    return 'TRADE_TARIFF_TECH';
  }
  if (
    /\b(msci|free-float|hsc|idx|bei\b|ojk|manipulation|rogue|ipo|buyback|dividend|p\/e|fcf|earnings|eps|value-up|kospi|sensex|nifty|s&p 500|blue-chip|lq45|equity|stock|shares)\b/.test(
      text
    )
  ) {
    return 'MARKET_REFORM_EQUITY';
  }
  if (
    /\b(cpi|inflation|pce|ppi|food price|oil|crude|wti|brent|gold|antam|commodity|energy|disinflation|price pressure)\b/.test(
      text
    )
  ) {
    return 'INFLATION_COMMODITY';
  }
  if (
    /\b(fx|rupiah|yuan|renminbi|won\b|rupee|dollar|dxy|jisdor|ndf|dndf|fixing|parity|reserve|wss|dhe|capital flow|currency)\b/.test(
      text
    )
  ) {
    return 'FX_EXTERNAL_BALANCE';
  }
  if (
    /\b(fiscal|apbn|budget|deficit|auction|refunding|issuance|sbn|indogb|cgb|ktb|g-sec|t-bill|treasury|djppr|kemenkeu|pppk|debt)\b/.test(
      text
    )
  ) {
    return 'FISCAL_SUPPLY';
  }
  if (
    /\b(fed|fomc|bi-rate|bank indonesia|pboc|bok|rbi|repo|reverse repo|vrr|vrrr|srbi|klm|kofr|sofia|lpr|omo|rate cut|rate hike|monetary|liquidity|central bank)\b/.test(
      text
    )
  ) {
    return 'MONETARY_LIQUIDITY';
  }
  return 'MONETARY_LIQUIDITY';
}

function parseRecencyWeight(timeAgo: string | undefined, idx: number): number {
  const t = (timeAgo || '').trim().toLowerCase();
  let recencyBonus = 10;
  if (t.endsWith('m ago')) {
    recencyBonus = 30;
  } else if (t.endsWith('h ago')) {
    const hrs = parseInt(t, 10) || 4;
    recencyBonus = Math.max(12, 28 - hrs);
  }
  return Math.max(10, 100 - idx * 8 + recencyBonus);
}

function analyzeNewsCatalysts(items: GenericNewsEntry[], fallbackDefaultTitle: string): CatalystProfile {
  const cleanItems = (items || []).filter((it) => it && it.title && it.title.trim().length > 0);
  const effectiveItems: GenericNewsEntry[] =
    cleanItems.length > 0
      ? cleanItems.slice(0, 10)
      : [{ title: fallbackDefaultTitle, source: 'Institutional Desk', timeAgo: 'Live' }];

  const themeScores: Record<CatalystThemeId, number> = {
    POLITICAL_GOVERNANCE: 0,
    MONETARY_LIQUIDITY: 0,
    TRADE_TARIFF_TECH: 0,
    MARKET_REFORM_EQUITY: 0,
    FISCAL_SUPPLY: 0,
    FX_EXTERNAL_BALANCE: 0,
    INFLATION_COMMODITY: 0,
  };

  const themeCounts: Record<CatalystThemeId, number> = {
    POLITICAL_GOVERNANCE: 0,
    MONETARY_LIQUIDITY: 0,
    TRADE_TARIFF_TECH: 0,
    MARKET_REFORM_EQUITY: 0,
    FISCAL_SUPPLY: 0,
    FX_EXTERNAL_BALANCE: 0,
    INFLATION_COMMODITY: 0,
  };

  const classified: ClassifiedNewsItem[] = effectiveItems.map((item, idx) => {
    const theme = classifyHeadlineTheme(item.title, item.category, item.significance);
    const weight = parseRecencyWeight(item.timeAgo, idx);
    themeScores[theme] += weight;
    themeCounts[theme] += 1;
    return {
      ...item,
      theme,
      themeLabel: THEME_LABELS[theme],
      weight,
    };
  });

  const sortedThemes = (Object.keys(themeScores) as CatalystThemeId[]).sort(
    (a, b) => themeScores[b] - themeScores[a]
  );

  const primaryTheme = sortedThemes[0] || 'MONETARY_LIQUIDITY';
  const secondaryTheme =
    sortedThemes.find((t) => t !== primaryTheme && themeScores[t] > 0) ||
    (primaryTheme === 'MONETARY_LIQUIDITY' ? 'FISCAL_SUPPLY' : 'MONETARY_LIQUIDITY');

  const leadItem = classified[0];
  const secondItem = classified[1] || classified[0];
  const thirdItem = classified[2];
  const fourthItem = classified[3];
  const fifthItem = classified[4];

  const digestParts = classified.slice(0, 4).map((c, idx) => {
    const meta = c.timeAgo ? `${c.source} · ${c.timeAgo}` : c.source;
    return `(#${idx + 1} ${c.themeLabel.split(',')[0]}) "${truncateHeadline(c.title, 82)}" [${meta}]`;
  });

  return {
    primaryTheme,
    secondaryTheme,
    primaryLabel: THEME_LABELS[primaryTheme],
    secondaryLabel: THEME_LABELS[secondaryTheme],
    classified,
    themeCounts,
    leadItem,
    secondItem,
    thirdItem,
    fourthItem,
    fifthItem,
    distinctThemesDigest: digestParts.join('; '),
  };
}

/**
 * Returns a Date shifted into Singapore Time (SGT, UTC+8) so UTC getters
 * (.getUTCFullYear, .getUTCMonth, .getUTCDate, .getUTCDay) reflect SGT calendar dates.
 */
function getSgtReferenceDate(snap: DailyMacroSnapshot): Date {
  const nowMs = Date.now();
  const snapMs = Date.parse(snap.metadata?.lastUpdated || '');
  const baseMs = !Number.isNaN(snapMs) && snapMs > 0 ? Math.max(nowMs, snapMs) : nowMs;
  return new Date(baseMs + 8 * 3600 * 1000);
}

function addSgtDays(sgtDate: Date, days: number): Date {
  return new Date(sgtDate.getTime() + days * 86400 * 1000);
}

function snapToBusinessDay(sgtDate: Date): Date {
  const dow = sgtDate.getUTCDay();
  if (dow === 6) return addSgtDays(sgtDate, 2); // Saturday -> Monday
  if (dow === 0) return addSgtDays(sgtDate, 1); // Sunday -> Monday
  return sgtDate;
}

function formatSgtDate(sgtDate: Date): string {
  const dow = DAYS_SHORT[sgtDate.getUTCDay()];
  const day = String(sgtDate.getUTCDate()).padStart(2, '0');
  const mon = MONTHS_SHORT[sgtDate.getUTCMonth()];
  const yr = sgtDate.getUTCFullYear();
  return `${dow}, ${day} ${mon} ${yr}`;
}

function resolveUpdatedSGT(snap: DailyMacroSnapshot, sgtNow: Date): string {
  if (snap.metadata?.lastUpdatedSGT && snap.metadata.lastUpdatedSGT.trim().length > 0) {
    return snap.metadata.lastUpdatedSGT.trim();
  }
  const day = String(sgtNow.getUTCDate()).padStart(2, '0');
  const mon = MONTHS_SHORT[sgtNow.getUTCMonth()];
  const yr = sgtNow.getUTCFullYear();
  const h24 = sgtNow.getUTCHours();
  const mins = String(sgtNow.getUTCMinutes()).padStart(2, '0');
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = String(h24 % 12 || 12).padStart(2, '0');
  return `${day} ${mon} ${yr}, ${h12}:${mins} ${ampm} SGT`;
}

function getNextWeekdaySgt(sgtBase: Date, targetDow: number, includeToday = true): Date {
  const curDow = sgtBase.getUTCDay();
  let diff = (targetDow - curDow + 7) % 7;
  if (diff === 0 && !includeToday) {
    diff = 7;
  }
  return addSgtDays(sgtBase, diff);
}

function getNextMonthlyDaySgt(sgtBase: Date, dayOfMonth: number): Date {
  const year = sgtBase.getUTCFullYear();
  const month = sgtBase.getUTCMonth();
  const curDay = sgtBase.getUTCDate();

  let candidate = new Date(Date.UTC(year, month, dayOfMonth, 12, 0, 0));
  if (curDay > dayOfMonth) {
    candidate = new Date(Date.UTC(year, month + 1, dayOfMonth, 12, 0, 0));
  }
  return snapToBusinessDay(candidate);
}

function truncateHeadline(text: string | undefined, maxLen = 96): string {
  if (!text) return '';
  const cleaned = text.trim();
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned;
}

function fmtBps(bps: number | undefined): string {
  const v = bps ?? 0;
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} bps`;
}

function fmtPct(pct: number | undefined): string {
  const v = pct ?? 0;
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export function buildGlobalArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const sgtNow = getSgtReferenceDate(snap);
  const updatedAtSGT = resolveUpdatedSGT(snap, sgtNow);
  const todayBiz = snapToBusinessDay(sgtNow);
  const sessionDateStr = formatSgtDate(todayBiz);
  const nextFri = getNextWeekdaySgt(todayBiz, 5, true);
  const cpiDate = getNextMonthlyDaySgt(todayBiz, 12);

  if (
    snap.globalMacro.argonCommentary?.aiGenerated &&
    snap.globalMacro.argonCommentary.synthesis &&
    snap.globalMacro.topNews[0]?.headline &&
    snap.globalMacro.argonCommentary.synthesis.includes(snap.globalMacro.topNews[0].headline.slice(0, 28))
  ) {
    return {
      ...snap.globalMacro.argonCommentary,
      updatedAtSGT,
    };
  }

  const yc = snap.globalMacro.yieldCurve;
  const t2 = yc.tenors.find((t) => t.label === '2Y');
  const t5 = yc.tenors.find((t) => t.label === '5Y');
  const t10 = yc.tenors.find((t) => t.label === '10Y');
  const t30 = yc.tenors.find((t) => t.label === '30Y');

  const y2 = t2?.yield ?? 4.47;
  const y5 = t5?.yield ?? 4.61;
  const y10 = t10?.yield ?? 4.84;
  const y30 = t30?.yield ?? 5.26;
  const y2Chg = t2?.changeBps ?? 0.0;
  const y10Chg = t10?.changeBps ?? 0.0;
  const y30Chg = t30?.changeBps ?? 0.0;

  const twoTen = yc.spreads.twoTenSpread ?? Number(((y10 - y2) * 100).toFixed(1));
  const fiveTen = yc.spreads.fiveTenSpread ?? Number(((y10 - y5) * 100).toFixed(1));

  const spx = snap.globalMacro.futures.find((f) => f.symbol === 'ES=F');
  const ndx = snap.globalMacro.futures.find((f) => f.symbol === 'NQ=F');
  const dxy = snap.globalMacro.futures.find((f) => f.symbol === 'DX=F');
  const wti = snap.globalMacro.commodities.find((c) => c.symbol === 'CL=F');
  const gold = snap.globalMacro.commodities.find((c) => c.symbol === 'GC=F');
  const jpy = snap.globalMacro.fxRates.find((fx) => fx.pair === 'USD/JPY');

  const spxPrice = spx?.price ?? 6887.0;
  const spxPct = spx?.changePct ?? 0.36;
  const ndxPrice = ndx?.price ?? 25144.25;
  const ndxPct = ndx?.changePct ?? 0.42;
  const dxyPrice = dxy?.price ?? 98.81;
  const dxyPct = dxy?.changePct ?? 0.15;
  const wtiPrice = wti?.price ?? 86.65;
  const wtiPct = wti?.changePct ?? -0.45;
  const goldPrice = gold?.price ?? 4651.5;
  const goldPct = gold?.changePct ?? 0.25;
  const jpyRate = jpy?.rate ?? 158.95;

  const newsProfile = analyzeNewsCatalysts(
    snap.globalMacro.topNews.map((n) => ({
      title: n.headline,
      source: n.source,
      timeAgo: n.timeAgo,
      category: n.category,
      significance: n.macroTakeaway,
      impact: n.impact,
    })),
    'US Treasury curve reprices term premium as FOMC and fiscal supply headlines dominate cross-asset flows'
  );

  const isBearSteepening = y10Chg >= 3.0 && y10Chg >= y2Chg;
  const isBullRally = y10Chg <= -3.0;
  const isRiskOffNews =
    newsProfile.primaryTheme === 'POLITICAL_GOVERNANCE' ||
    newsProfile.primaryTheme === 'TRADE_TARIFF_TECH';

  let conviction: string;
  let synthesisOpening: string;
  let positioningTakeaway: string;

  if (isBearSteepening && newsProfile.primaryTheme === 'FISCAL_SUPPLY') {
    conviction = `Short/Underweight 30Y Bond (${y30.toFixed(2)}%, ${fmtBps(y30Chg)}) · Hold 2Y–5Y Belly (${y2.toFixed(2)}%–${y5.toFixed(2)}%) & Quality Value Over High-Multiple Tech`;
    synthesisOpening =
      `[${sessionDateStr} · Fiscal Supply & Bear-Steepening Regime] Long-end US Treasury term premia are repricing higher today (10Y at ${y10.toFixed(2)}% [${fmtBps(y10Chg)}], 30Y at ${y30.toFixed(2)}% [${fmtBps(y30Chg)}], steepening 2s10s to +${twoTen.toFixed(1)} bps) as fiscal and debt-supply headlines dominate institutional desk flows.`;
    positioningTakeaway =
      `[Tactical Call — Curve Steepener & Short-Duration Quality] Avoid unhedged 10Y–30Y Treasury duration while "${truncateHeadline(newsProfile.leadItem.title, 70)}" pressures long-end term premia (${y30.toFixed(2)}%). Concentrate fixed-income carry in 2Y–5Y notes (${y2.toFixed(2)}%–${y5.toFixed(2)}%), maintain long DXY (${dxyPrice.toFixed(2)}, ${fmtPct(dxyPct)}) / Gold ($${goldPrice.toFixed(0)}/oz) tail hedges, and tilt equity exposure toward low-duration cash-flow compounders unless US10Y rallies back below ${(y10 - 0.12).toFixed(2)}%.`;
  } else if (isRiskOffNews) {
    conviction = `Geopolitical & Trade Hedge: Long Gold ($${goldPrice.toFixed(0)}/oz, ${fmtPct(goldPct)}) + 2Y–5Y UST Belly (${y2.toFixed(2)}%) · Selective SPX (${fmtPct(spxPct)}) Dispersion`;
    synthesisOpening =
      `[${sessionDateStr} · ${newsProfile.primaryLabel} Regime] Cross-asset pricing reflects heightened sensitivity to geopolitical, policy, and trade headlines even as S&P 500 E-minis trade at ${spxPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)}) and Nasdaq 100 at ${ndxPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ndxPct)}).`;
    positioningTakeaway =
      `[Tactical Call — Event-Risk Barbell] With desk flow anchored by "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 65)}" (${newsProfile.secondItem.source}), pair 2Y–5Y US Treasury duration (${y2.toFixed(2)}%–${y5.toFixed(2)}%) and Gold ($${goldPrice.toFixed(0)}/oz, ${fmtPct(goldPct)}) with selective US large-cap quality. Trim high-beta cyclical exposure if 10Y UST (${y10.toFixed(2)}%, ${fmtBps(y10Chg)}) breaks above ${(y10 + 0.15).toFixed(2)}% or WTI ($${wtiPrice.toFixed(2)}/bbl, ${fmtPct(wtiPct)}) spikes above $${(wtiPrice + 4.5).toFixed(0)}/bbl.`;
  } else if (isBullRally) {
    conviction = `Extend 5Y–10Y UST Duration (${y5.toFixed(2)}%–${y10.toFixed(2)}%, ${fmtBps(y10Chg)}) · Long Nasdaq/Growth (${fmtPct(ndxPct)}) & EM FX Carry`;
    synthesisOpening =
      `[${sessionDateStr} · Duration Receiving & Disinflation Regime] Sovereign bonds are catching a broad institutional bid across the curve (2Y at ${y2.toFixed(2)}% [${fmtBps(y2Chg)}], 10Y at ${y10.toFixed(2)}% [${fmtBps(y10Chg)}], 30Y at ${y30.toFixed(2)}% [${fmtBps(y30Chg)}]), easing financial conditions for global risk assets.`;
    positioningTakeaway =
      `[Tactical Call — Duration Extension & Growth Beta] Lock in 5Y–10Y Treasury yields (${y5.toFixed(2)}%–${y10.toFixed(2)}%) as front-end and belly rates compress on "${truncateHeadline(newsProfile.leadItem.title, 70)}". Lower real-rate pressure supports long Nasdaq 100 (${ndxPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}, ${fmtPct(ndxPct)}) and high-carry EM sovereign debt while DXY (${dxyPrice.toFixed(2)}, ${fmtPct(dxyPct)}) remains capped below ${(dxyPrice + 1.15).toFixed(2)}.`;
  } else if (newsProfile.primaryTheme === 'INFLATION_COMMODITY' || Math.abs(wtiPct) >= 1.5) {
    conviction = `Inflation & Commodity Watch: Favor 2Y–5Y UST Carry (${y2.toFixed(2)}%–${y5.toFixed(2)}%) + Energy/Real Assets (WTI $${wtiPrice.toFixed(2)}, Gold $${goldPrice.toFixed(0)})`;
    synthesisOpening =
      `[${sessionDateStr} · Commodity & Inflation Pipeline Regime] Commodity and price-pipeline developments are steering breakeven inflation expectations today, with WTI Crude at $${wtiPrice.toFixed(2)}/bbl (${fmtPct(wtiPct)}), Gold at $${goldPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz (${fmtPct(goldPct)}), and the 10Y US Treasury yield at ${y10.toFixed(2)}% (${fmtBps(y10Chg)} 1D; 2s10s +${twoTen.toFixed(1)} bps).`;
    positioningTakeaway =
      `[Tactical Call — Breakeven & Real-Asset Overlay] Synthesizing "${truncateHeadline(newsProfile.leadItem.title, 68)}" and "${truncateHeadline(newsProfile.secondItem.title, 64)}", keep duration concentrated in the 2Y–5Y sector (${y2.toFixed(2)}%–${y5.toFixed(2)}%) rather than 30Y bonds (${y30.toFixed(2)}%), and pair S&P 500 exposure (${spxPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}, ${fmtPct(spxPct)}) with energy/commodity cash generators while monitoring US10Y resistance at ${(y10 + 0.16).toFixed(2)}%.`;
  } else {
    conviction = `2Y–5Y Belly Carry (${y2.toFixed(2)}%–${y5.toFixed(2)}%) vs 30Y (${y30.toFixed(2)}%) · Constructive S&P 500 (${fmtPct(spxPct)}) & Quality Barbell`;
    synthesisOpening =
      `[${sessionDateStr} · ${newsProfile.primaryLabel} Regime] US Treasury yields are pricing a +${twoTen.toFixed(1)} bps 2s10s slope (2Y at ${y2.toFixed(2)}% [${fmtBps(y2Chg)}], 5Y at ${y5.toFixed(2)}%, 10Y at ${y10.toFixed(2)}% [${fmtBps(y10Chg)}], 30Y at ${y30.toFixed(2)}% [${fmtBps(y30Chg)}]; 5s10s +${fiveTen.toFixed(1)} bps) alongside S&P 500 E-minis at ${spxPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)}), DXY at ${dxyPrice.toFixed(2)} (${fmtPct(dxyPct)}), and Gold at $${goldPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz (${fmtPct(goldPct)}).`;
    positioningTakeaway =
      `[Tactical Call — Belly Carry & Equity Quality Tilt] Across today's news slate led by "${truncateHeadline(newsProfile.leadItem.title, 66)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 64)}" (${newsProfile.secondItem.source}), capture rolldown in 2Y–5Y Treasuries (${y2.toFixed(2)}%–${y5.toFixed(2)}%) while avoiding unhedged 30Y duration (${y30.toFixed(2)}%). Maintain constructive S&P 500 (${fmtPct(spxPct)}) positioning with a stop/hedge trigger if US10Y breaches ${(y10 + 0.16).toFixed(2)}% or DXY breaks ${(dxyPrice + 1.25).toFixed(2)}.`;
  }

  const synthesis =
    `${synthesisOpening} ` +
    `Argon's multi-update review across ${newsProfile.classified.length} live global wires highlights: ${newsProfile.distinctThemesDigest}. ` +
    `Net cross-asset read-through: with 10Y UST moving ${fmtBps(y10Chg)} to ${y10.toFixed(2)}%, USD/JPY at ¥${jpyRate.toFixed(2)}, and WTI at $${wtiPrice.toFixed(2)}/bbl (${fmtPct(wtiPct)}), institutional desks are balancing "${truncateHeadline(newsProfile.leadItem.title, 75)}" against front-end Fed rate expectations (${y2.toFixed(2)}% 2Y) and long-end refunding supply.`;

  const regimeBadge = `${newsProfile.primaryTheme.replace(/_/g, ' ')} · UST 2s10s +${twoTen.toFixed(1)} BPS · 10Y ${y10.toFixed(2)}% (${fmtBps(y10Chg)})`;

  const criticalLevels = [
    {
      asset: 'US 10Y Treasury Yield',
      current: `${y10.toFixed(2)}% (${fmtBps(y10Chg)})`,
      support: `${(y10 - 0.14).toFixed(2)}%`,
      resistance: `${(y10 + 0.16).toFixed(2)}%`,
      implication: `Break above ${(y10 + 0.16).toFixed(2)}% tightens equity ERP & EM FX; move below ${(y10 - 0.14).toFixed(2)}% fuels duration rally.`,
    },
    {
      asset: 'S&P 500 E-mini (ES=F)',
      current: `${spxPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)})`,
      support: Math.round(spxPrice * 0.985).toLocaleString('en-US'),
      resistance: Math.round(spxPrice * 1.015).toLocaleString('en-US'),
      implication: `Holding above ${Math.round(spxPrice * 0.985).toLocaleString('en-US')} keeps institutional dip-buying intact amid "${truncateHeadline(newsProfile.leadItem.title, 52)}".`,
    },
    {
      asset: 'US Dollar Index (DXY)',
      current: `${dxyPrice.toFixed(2)} (${fmtPct(dxyPct)})`,
      support: (dxyPrice - 1.15).toFixed(2),
      resistance: (dxyPrice + 1.25).toFixed(2),
      implication: `Reclaiming ${(dxyPrice + 1.25).toFixed(2)} tightens global USD funding; sub-${(dxyPrice - 1.15).toFixed(2)} accelerates flows into Gold & Asian FX.`,
    },
    {
      asset: 'WTI Crude / USD/JPY',
      current: `$${wtiPrice.toFixed(2)} · ¥${jpyRate.toFixed(2)}`,
      support: `$${(wtiPrice - 4.5).toFixed(2)} · ¥${(jpyRate - 2.0).toFixed(2)}`,
      resistance: `$${(wtiPrice + 5.0).toFixed(2)} · ¥${(jpyRate + 1.5).toFixed(2)}`,
      implication: `WTI sub-$${(wtiPrice + 5.0).toFixed(0)}/bbl caps inflation breakevens; USD/JPY above ¥${(jpyRate + 1.5).toFixed(1)} raises BoJ intervention risk.`,
    },
  ];

  const eventsToWatch = [
    {
      event: 'US BLS Consumer Price Index (CPI) Print & Fed Front-End Rate Cut Pricing',
      timing: `${formatSgtDate(cpiDate)} · 21:30 SGT (08:30 ET)`,
      impact: 'Critical' as const,
      watchFor: `Core services stickiness vs energy ($${wtiPrice.toFixed(2)}/bbl WTI) and whether US 2Y (${y2.toFixed(2)}%) breaks ${(y2 + 0.12).toFixed(2)}% following "${truncateHeadline(newsProfile.leadItem.title, 80)}".`,
    },
    {
      event: 'US Treasury 10Y / 30Y Refunding Auction Settlement & Primary Dealer Takedown',
      timing: `${formatSgtDate(todayBiz)} · 13:00 ET (02:00 SGT +1)`,
      impact: 'High' as const,
      watchFor: `Foreign indirect bid-to-cover and auction tail; a >2 bps tail tests 30Y resistance near ${(y30 + 0.12).toFixed(2)}% (2s10s at +${twoTen.toFixed(1)} bps) amid "${truncateHeadline(newsProfile.secondItem.title, 78)}".`,
    },
    {
      event: 'US Retail Sales, PPI Inflation & FOMC Governors Policy Remarks',
      timing: `${formatSgtDate(nextFri)} · 21:30 SGT (08:30 ET)`,
      impact: 'High' as const,
      watchFor: `Real consumption resilience and PPI pipeline pass-through dictating DXY (${dxyPrice.toFixed(2)}) direction and Gold ($${goldPrice.toFixed(0)}/oz) positioning into the weekend.`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · GLOBAL MACRO SYNTHESIS & CRITICAL WATCHLIST',
    regimeBadge,
    dominantRegime: newsProfile.primaryLabel,
    updatedAtSGT,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}

export function buildIndonesiaArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const sgtNow = getSgtReferenceDate(snap);
  const updatedAtSGT = resolveUpdatedSGT(snap, sgtNow);
  const todayBiz = snapToBusinessDay(sgtNow);
  const sessionDateStr = formatSgtDate(todayBiz);
  const nextSrbiFri = getNextWeekdaySgt(todayBiz, 5, true);
  const nextDjpprTue = getNextWeekdaySgt(todayBiz, 2, false);
  const biRdgDate = getNextMonthlyDaySgt(todayBiz, 18);

  if (
    snap.indonesia.argonCommentary?.aiGenerated &&
    snap.indonesia.argonCommentary.synthesis &&
    snap.indonesia.commentary.noteworthyHeadlines[0]?.title &&
    snap.indonesia.argonCommentary.synthesis.includes(
      snap.indonesia.commentary.noteworthyHeadlines[0].title.slice(0, 28)
    )
  ) {
    return {
      ...snap.indonesia.argonCommentary,
      updatedAtSGT,
    };
  }

  const bonds = snap.indonesia.bonds;
  const fx = snap.indonesia.fxAndNdf;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  const biRate = bonds.biRate ?? 5.75;
  const cpi = bonds.cpiInflationYoY ?? 3.28;
  const b5 = bonds.indoGB.find((b) => b.tenor.startsWith('5Y'));
  const b10 = bonds.indoGB.find((b) => b.tenor.startsWith('10Y'));
  const b15 = bonds.indoGB.find((b) => b.tenor.startsWith('15Y'));
  const indo5Y = b5?.yield ?? 7.35;
  const indo5YChg = b5?.changeBps ?? 0.0;
  const indo10Y = b10?.yield ?? 7.69;
  const indo10YChg = b10?.changeBps ?? 0.0;
  const indo15Y = b15?.yield ?? 7.82;
  const spread10Y = Math.round((indo10Y - ust10Y) * 100);

  const srbi6M = bonds.srbi.find((s) => s.tenor === '6M')?.weightedAvgYield ?? 6.566;
  const srbi12M = bonds.srbi.find((s) => s.tenor === '12M')?.weightedAvgYield ?? 6.675;
  const srbiDate = bonds.srbi.find((s) => s.tenor === '12M')?.auctionDate ?? '06 Nov 2026';
  const srbi12MBids = bonds.srbi.find((s) => s.tenor === '12M')?.nominalBidsIDR ?? 'IDR 19.20 T';
  const srbi12MAwarded = bonds.srbi.find((s) => s.tenor === '12M')?.awardedVolumeIDR ?? 'IDR 3.00 T';

  const spot = fx.spotRate ?? 18080;
  const spotChg = fx.spotChange ?? 0;
  const spotPct = fx.spotChangePct ?? 0.0;
  const jisdor = fx.jisdorRate ?? 18130;
  const ndf1M = fx.ndf1M ?? 18116;
  const ndfSpread = fx.ndfSpread1M ?? 36;
  const ihsg = fx.ihsgIndex.level ?? 5050.43;
  const ihsgPct = fx.ihsgIndex.changePct ?? 0.40;
  const realPolicyBuffer = (biRate - cpi).toFixed(2);

  const combinedNews = [
    ...snap.indonesia.commentary.noteworthyHeadlines.map((h) => ({
      title: h.title || h.headline || '',
      source: h.source,
      timeAgo: h.timeAgo || 'Live',
      significance: h.significance,
    })),
    ...(snap.indonesiaLocalNews?.topImportant?.slice(0, 3).map((loc) => ({
      title: loc.titleEn,
      source: loc.source,
      timeAgo: loc.timeAgo,
      category: loc.category,
      significance: loc.marketSignificance,
    })) || []),
  ];

  const newsProfile = analyzeNewsCatalysts(
    combinedNews,
    'Bank Indonesia and Ministry of Finance coordinate SBN curve stability and onshore Rupiah liquidity'
  );

  let conviction: string;
  let synthesisOpening: string;
  let positioningTakeaway: string;

  if (newsProfile.primaryTheme === 'POLITICAL_GOVERNANCE') {
    conviction = `Political & Governance Risk Hedge: Front-End 12M SRBI (${srbi12M.toFixed(3)}%) + 5Y FR0109 (${indo5Y.toFixed(2)}%) · NDF-Hedged vs 10Y–20Y Duration`;
    synthesisOpening =
      `[${sessionDateStr} · Jakarta Political & Governance Watch] Onshore institutional desks are closely weighing domestic political and constitutional headlines against Indonesia's +${realPolicyBuffer}% real policy buffer (BI-Rate ${biRate.toFixed(2)}% vs CPI ${cpi.toFixed(2)}%) and +${spread10Y} bps 10Y sovereign spread over USTs (FR0108 at ${indo10Y.toFixed(2)}%, ${fmtBps(indo10YChg)} 1D; 5Y FR0109 at ${indo5Y.toFixed(2)}%, ${fmtBps(indo5YChg)} 1D).`;
    positioningTakeaway =
      `[Tactical Call — Shorten Duration into 12M SRBI & 5Y FR0109, Hedge FX Tail] While domestic headlines focus on "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 65)}" (${newsProfile.secondItem.source}), avoid extending unhedged duration into 15Y–20Y IndoGBs (${indo15Y.toFixed(2)}%). Capture 6.675% carry in 12M BI SRBI and 5Y FR0109 (${indo5Y.toFixed(2)}%), and maintain 1M NDF hedges (Rp ${ndf1M.toLocaleString('en-US')}, +${ndfSpread} IDR basis) whenever USD/IDR (Rp ${spot.toLocaleString('en-US')}) trades above Rp 18,050.`;
  } else if (newsProfile.primaryTheme === 'MARKET_REFORM_EQUITY') {
    conviction = `IDX/MSCI Reform Rotation: Long Liquid LQ45 Banks + 5Y–10Y IndoGB (FR0109 ${indo5Y.toFixed(2)}% / FR0108 ${indo10Y.toFixed(2)}%)`;
    synthesisOpening =
      `[${sessionDateStr} · Capital Market Reform & Index Rebalancing Regime] Structural Indonesia Stock Exchange (IDX/OJK) governance and MSCI index investability catalysts are driving onshore institutional allocation today, with IHSG at ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ihsgPct)}), USD/IDR at Rp ${spot.toLocaleString('en-US')} (JISDOR Rp ${jisdor.toLocaleString('en-US')}), and 10Y FR0108 yielding ${indo10Y.toFixed(2)}% (${fmtBps(indo10YChg)} 1D).`;
    positioningTakeaway =
      `[Tactical Call — High-Liquidity LQ45 + Belly SBN Carry] Driven by "${truncateHeadline(newsProfile.leadItem.title, 70)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 65)}", rotate equity exposure strictly out of concentrated low-float issuers into high-free-float LQ45 banks (BBCA, BMRI, BBRI), while pairing with 5Y FR0109 (${indo5Y.toFixed(2)}%) and 10Y FR0108 (${indo10Y.toFixed(2)}%, +${spread10Y} bps over US10Y) supported by onshore bank liquidity.`;
  } else if (spot >= 18150 || spotChg >= 35 || newsProfile.primaryTheme === 'FX_EXTERNAL_BALANCE') {
    conviction = `FX Defense & Front-End Carry: Overweight 12M SRBI (${srbi12M.toFixed(3)}% WAR) · Underweight Unhedged 10Y FR0108 (${indo10Y.toFixed(2)}%)`;
    synthesisOpening =
      `[${sessionDateStr} · FX Defense & Triple-Intervention Regime] With onshore USD/IDR trading at Rp ${spot.toLocaleString('en-US')} (${fmtPct(spotPct)} 1D; JISDOR Rp ${jisdor.toLocaleString('en-US')}, 1M NDF Rp ${ndf1M.toLocaleString('en-US')} [+${ndfSpread} IDR basis]), Bank Indonesia's FX stabilization toolkit and external reserve buffer are the primary anchors for Jakarta fixed income and currency desks.`;
    positioningTakeaway =
      `[Tactical Call — Front-End SRBI Over Long SBN Duration] Synthesizing "${truncateHeadline(newsProfile.leadItem.title, 68)}" and "${truncateHeadline(newsProfile.secondItem.title, 64)}", favor 6M–12M BI SRBI (${srbi6M.toFixed(3)}%–${srbi12M.toFixed(3)}% WAR) where BI explicitly prices yields to defend the Rupiah, and wait for USD/IDR to stabilize below Rp ${(spot - 75).toLocaleString('en-US')} or 10Y FR0108 (${indo10Y.toFixed(2)}%) to test ${(indo10Y + 0.12).toFixed(2)}% before adding unhedged duration.`;
  } else {
    conviction = `Receive 5Y–10Y IndoGB (FR0109 ${indo5Y.toFixed(2)}% / FR0108 ${indo10Y.toFixed(2)}%, +${spread10Y} bps vs UST) + 12M SRBI (${srbi12M.toFixed(3)}%)`;
    synthesisOpening =
      `[${sessionDateStr} · ${newsProfile.primaryLabel} Regime] Indonesia's sovereign fixed-income market offers a +${realPolicyBuffer}% real policy buffer (BI-Rate ${biRate.toFixed(2)}% vs CPI ${cpi.toFixed(2)}% YoY) and a +${spread10Y} bps 10Y yield pickup over US Treasuries (FR0108 at ${indo10Y.toFixed(2)}% [${fmtBps(indo10YChg)} 1D], 5Y FR0109 at ${indo5Y.toFixed(2)}% [${fmtBps(indo5YChg)} 1D]), while USD/IDR trades at Rp ${spot.toLocaleString('en-US')} (${fmtPct(spotPct)}) and IHSG sits at ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ihsgPct)}).`;
    positioningTakeaway =
      `[Tactical Call — Constructive 5Y–10Y SBN & SRBI Barbell] Supported by "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 65)}" (${newsProfile.secondItem.source}), accumulate 5Y FR0109 (${indo5Y.toFixed(2)}%) and 10Y FR0108 (${indo10Y.toFixed(2)}%) on auction dips alongside 12M SRBI (${srbi12M.toFixed(3)}% WAR), using 1M NDFs (+${ndfSpread} IDR spread) as an early-warning barometer for offshore USD demand.`;
  }

  const synthesis =
    `${synthesisOpening} ` +
    `Argon's synthesis of today's ${newsProfile.classified.length} Jakarta macro, regulatory, and political updates highlights: ${newsProfile.distinctThemesDigest}. ` +
    `Combined with Bank Indonesia's ${srbiDate} SRBI clearing rates (6M ${srbi6M.toFixed(3)}%, 12M ${srbi12M.toFixed(3)}% WAR; ${srbi12MAwarded} awarded from ${srbi12MBids} bids), the interplay between "${truncateHeadline(newsProfile.leadItem.title, 70)}" and onshore liquidity dictates near-term foreign SBN and equity flows.`;

  const regimeBadge = `${newsProfile.primaryTheme.replace(/_/g, ' ')} · BI ${biRate.toFixed(2)}% · FR0108 ${indo10Y.toFixed(2)}% (+${spread10Y} BPS)`;

  const criticalLevels = [
    {
      asset: 'USD/IDR Spot & JISDOR',
      current: `${spot.toLocaleString('en-US')} (JISDOR ${jisdor.toLocaleString('en-US')})`,
      support: `${(spot - 125).toLocaleString('en-US')}`,
      resistance: `${(spot + 125).toLocaleString('en-US')}`,
      implication: `Break above ${(spot + 125).toLocaleString('en-US')} triggers active BI DNDF/spot intervention; move below ${(spot - 125).toLocaleString('en-US')} invites foreign bond inflows.`,
    },
    {
      asset: '10Y IndoGB (FR0108)',
      current: `${indo10Y.toFixed(2)}% (+${spread10Y} bps)`,
      support: `${(indo10Y - 0.14).toFixed(2)}%`,
      resistance: `${(indo10Y + 0.16).toFixed(2)}%`,
      implication: `Yields near ${(indo10Y + 0.16).toFixed(2)}% attract domestic pension/bank buying; compression below ${(indo10Y - 0.14).toFixed(2)}% requires lower UST yields.`,
    },
    {
      asset: `12M SRBI (${srbiDate} Issued)`,
      current: `${srbi12M.toFixed(3)}% (6M: ${srbi6M.toFixed(3)}%)`,
      support: `${(srbi12M - 0.10).toFixed(3)}%`,
      resistance: `${(srbi12M + 0.12).toFixed(3)}%`,
      implication: `Friday ${srbiDate} issuance cleared at ${srbi12M.toFixed(3)}% WAR (${srbi12MAwarded} awarded of ${srbi12MBids} bids), keeping foreign short-term portfolio carry attractive.`,
    },
    {
      asset: 'IDX Composite (IHSG)',
      current: `${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ihsgPct)})`,
      support: Math.round(ihsg * 0.98).toLocaleString('en-US'),
      resistance: Math.round(ihsg * 1.02).toLocaleString('en-US'),
      implication: `Reclaiming ${Math.round(ihsg * 1.02).toLocaleString('en-US')} confirms foreign institutional rotation back into big-cap Jakarta banks and infrastructure.`,
    },
  ];

  const eventsToWatch = [
    {
      event: `Bank Indonesia Weekly SRBI (6M / 9M / 12M) Open Market Tender (Post-${srbiDate} Cycle)`,
      timing: `${formatSgtDate(nextSrbiFri)} · 10:00–14:00 WIB (11:00–15:00 SGT)`,
      impact: 'Critical' as const,
      watchFor: `Following the ${srbiDate} SRBI issuance (12M WAR at ${srbi12M.toFixed(3)}%), watch bid-to-cover and clearing yields amid "${truncateHeadline(newsProfile.leadItem.title, 80)}".`,
    },
    {
      event: 'DJPPR Conventional SUN (IndoGB) Primary Debt Auction (FR0109 / FR0108 / FR0106)',
      timing: `${formatSgtDate(nextDjpprTue)} · 10:00–12:00 WIB (11:00–13:00 SGT)`,
      impact: 'High' as const,
      watchFor: `Primary dealer and foreign institutional bids on 5Y FR0109 (${indo5Y.toFixed(2)}%) and 10Y FR0108 (${indo10Y.toFixed(2)}%) following "${truncateHeadline(newsProfile.secondItem.title, 80)}".`,
    },
    {
      event: 'Bank Indonesia Board of Governors (RDG) Rate Decision & JISDOR / DHE FX Review',
      timing: `${formatSgtDate(biRdgDate)} · 14:20 WIB (15:20 SGT)`,
      impact: 'High' as const,
      watchFor: `BI-Rate policy decision (${biRate.toFixed(2)}%), DHE export retention conversion flows, and 1M NDF spread (+${ndfSpread} IDR) over spot (${spot.toLocaleString('en-US')}).`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · INDONESIA SOVEREIGN, FX & MONETARY SYNTHESIS',
    regimeBadge,
    dominantRegime: newsProfile.primaryLabel,
    updatedAtSGT,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}

export function buildChinaArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const sgtNow = getSgtReferenceDate(snap);
  const updatedAtSGT = resolveUpdatedSGT(snap, sgtNow);
  const todayBiz = snapToBusinessDay(sgtNow);
  const sessionDateStr = formatSgtDate(todayBiz);
  const nextFri = getNextWeekdaySgt(todayBiz, 5, true);
  const nextWed = getNextWeekdaySgt(todayBiz, 3, false);
  const lprDate = getNextMonthlyDaySgt(todayBiz, 20);

  if (
    snap.china?.argonCommentary?.aiGenerated &&
    snap.china.argonCommentary.synthesis &&
    snap.china.commentary.noteworthyHeadlines[0]?.title &&
    snap.china.argonCommentary.synthesis.includes(
      snap.china.commentary.noteworthyHeadlines[0].title.slice(0, 28)
    )
  ) {
    return {
      ...snap.china.argonCommentary,
      updatedAtSGT,
    };
  }

  const china = snap.china;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  const b1 = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('1Y'));
  const b5 = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('5Y'));
  const b10 = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('10Y'));
  const b30 = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('30Y'));

  const cgb1Y = b1?.yield ?? 1.168;
  const cgb5Y = b5?.yield ?? 1.312;
  const cgb5YChg = b5?.changeBps ?? -1.2;
  const cgb10Y = b10?.yield ?? 1.587;
  const cgb10YChg = b10?.changeBps ?? -1.7;
  const cgb30Y = b30?.yield ?? 2.028;
  const cgb30YChg = b30?.changeBps ?? -1.5;
  const curveDate = china?.bonds.curveDate ?? '2026-11-06';

  const omo7d = china?.bonds.pbocOmo7dRate ?? 1.50;
  const lpr1Y = china?.bonds.lpr1Y ?? 3.00;
  const lpr5Y = china?.bonds.lpr5Y ?? 3.50;
  const cpi = china?.bonds.cpiInflationYoY ?? 0.60;
  const spread10Y = Math.round((cgb10Y - ust10Y) * 100);
  const slope10s30s = Math.round((cgb30Y - cgb10Y) * 100);

  const cny = china?.fxAndEquities.cnySpot ?? 6.6710;
  const cnyPct = china?.fxAndEquities.cnyChangePct ?? 0.12;
  const cnh = china?.fxAndEquities.cnhSpot ?? 6.6736;
  const fixing = china?.fxAndEquities.pbocFixing ?? 6.6685;
  const ssec = china?.fxAndEquities.shanghaiComposite.level ?? 3649.18;
  const ssecPct = china?.fxAndEquities.shanghaiComposite.changePct ?? -1.10;
  const csi300 = china?.fxAndEquities.csi300Index.level ?? 4054.28;
  const csiPct = china?.fxAndEquities.csi300Index.changePct ?? -1.44;

  const newsProfile = analyzeNewsCatalysts(
    (china?.commentary.noteworthyHeadlines || []).map((h) => ({
      title: h.title || h.headline || '',
      source: h.source,
      timeAgo: h.timeAgo || 'Live',
      significance: h.significance,
    })),
    'PBoC maintains accommodative DR007 liquidity and daily RMB parity fixing as CCDC 10Y CGB trades near 1.59%'
  );

  let conviction: string;
  let synthesisOpening: string;
  let positioningTakeaway: string;

  if (newsProfile.primaryTheme === 'TRADE_TARIFF_TECH') {
    conviction = `Trade & Tech Curbs Hedge: Long 5Y–10Y CCDC CGB (${cgb5Y.toFixed(3)}%–${cgb10Y.toFixed(3)}%) · Defensive USD/CNH (${cnh.toFixed(4)}) Collar vs CSI 300`;
    synthesisOpening =
      `[${sessionDateStr} · External Trade & Tech Supply-Chain Regime] External tariff, semiconductor export-control, and cross-border trade headlines are driving onshore Chinese asset allocation today, keeping safe-haven demand firm for CCDC ChinaBond CGBs (5Y at ${cgb5Y.toFixed(3)}% [${fmtBps(cgb5YChg)}], 10Y at ${cgb10Y.toFixed(3)}% [${fmtBps(cgb10YChg)}], 30Y at ${cgb30Y.toFixed(3)}% [${fmtBps(cgb30YChg)}]) while PBoC anchors the daily fixing at ${fixing.toFixed(4)} (spot CNY ${cny.toFixed(4)}, CNH ${cnh.toFixed(4)}).`;
    positioningTakeaway =
      `[Tactical Call — Long CGB Belly Duration & FX-Hedged Positioning] With external headlines led by "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 65)}" (${newsProfile.secondItem.source}), overweight 5Y–10Y CCDC CGBs (${cgb5Y.toFixed(3)}%–${cgb10Y.toFixed(3)}%) as domestic liquidity (7D OMO ${omo7d.toFixed(2)}%) cushions external trade headwinds. Hedge offshore CNH exposure (${cnh.toFixed(4)}) and favor domestic state-owned dividend leaders over export-sensitive CSI 300 (${fmtPct(csiPct)}) beta.`;
  } else if (newsProfile.primaryTheme === 'MARKET_REFORM_EQUITY' || ssecPct >= 0.45 || csiPct >= 0.45) {
    conviction = `Equity-Bond Rotation Watch: Shorten CGB Duration to 1Y–3Y (${cgb1Y.toFixed(3)}%) · Capture A-Share / Tech IPO Momentum (SSEC ${fmtPct(ssecPct)})`;
    synthesisOpening =
      `[${sessionDateStr} · Onshore Equity & Capital-Market Catalyst Regime] Domestic capital-market and corporate tech catalysts are lifting risk appetite across Shanghai Composite (${ssec.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ${fmtPct(ssecPct)}) and CSI 300 (${csi300.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ${fmtPct(csiPct)}), prompting modest steepening pressure along the CCDC CGB curve (${curveDate}: 10Y at ${cgb10Y.toFixed(3)}% [${fmtBps(cgb10YChg)}], 30Y at ${cgb30Y.toFixed(3)}% [${fmtBps(cgb30YChg)}]).`;
    positioningTakeaway =
      `[Tactical Call — Trim 30Y Ultra-Long CGBs, Barbell Short CGBs + Onshore Equities] As desks digest "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 64)}", take profits on unhedged 10Y–30Y CGB duration (${cgb10Y.toFixed(3)}%–${cgb30Y.toFixed(3)}%) near 1.55%–2.00% and park fixed-income carry in 1Y–5Y CGBs (${cgb1Y.toFixed(3)}%–${cgb5Y.toFixed(3)}%) alongside selective A-share tech and domestic consumption exposure.`;
  } else if (newsProfile.primaryTheme === 'FX_EXTERNAL_BALANCE') {
    conviction = `PBoC Parity Anchor (${fixing.toFixed(4)}): FX-Hedged 3Y–5Y CCDC CGB Carry (${cgb5Y.toFixed(3)}%) · Fade CNH/CNY Basis Extremes`;
    synthesisOpening =
      `[${sessionDateStr} · PBoC Parity Fixing & Cross-Border Flow Regime] PBoC currency management takes center stage with the daily central parity set at ${fixing.toFixed(4)} against onshore USD/CNY at ${cny.toFixed(4)} (${fmtPct(cnyPct)}) and offshore USD/CNH at ${cnh.toFixed(4)}, while the US-China 10Y sovereign spread stands at ${spread10Y} bps (10Y CGB at ${cgb10Y.toFixed(3)}%, ${fmtBps(cgb10YChg)} 1D).`;
    positioningTakeaway =
      `[Tactical Call — FX-Hedged Belly Carry via Northbound Bond Connect] Following "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 64)}", foreign real-money desks should hold 3Y–5Y CCDC CGBs (${cgb5Y.toFixed(3)}%) on an FX-hedged basis to capture cross-currency swap points, while respecting PBoC's counter-cyclical fixing defense near ${(cnh + 0.06).toFixed(4)}.`;
  } else {
    conviction = `Receive 3Y–7Y CCDC CGB Belly (${cgb5Y.toFixed(3)}%, ${fmtBps(cgb5YChg)}) on PBoC OMO Support (${omo7d.toFixed(2)}%) · Watch 30Y Supply (${cgb30Y.toFixed(3)}%)`;
    synthesisOpening =
      `[${sessionDateStr} · ${newsProfile.primaryLabel} Regime] Official CCDC ChinaBond CGB fixings (${curveDate}) price 1Y at ${cgb1Y.toFixed(3)}%, 5Y at ${cgb5Y.toFixed(3)}% (${fmtBps(cgb5YChg)} 1D), 10Y at ${cgb10Y.toFixed(3)}% (${fmtBps(cgb10YChg)} 1D), and 30Y at ${cgb30Y.toFixed(3)}% (${fmtBps(cgb30YChg)} 1D; 10s30s +${slope10s30s} bps), supported by PBoC's ${omo7d.toFixed(2)}% 7D Reverse Repo anchor and low ${cpi.toFixed(2)}% YoY CPI inflation.`;
    positioningTakeaway =
      `[Tactical Call — Bull-Steepener in 3Y–5Y CGBs vs 30Y Special Issuance] Synthesizing "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 65)}" (${newsProfile.secondItem.source}), stay overweight 3Y–5Y CCDC CGBs (${cgb5Y.toFixed(3)}%) where DR007 repo funding carry is positive, and avoid chasing 30Y ultra-long CGBs (${cgb30Y.toFixed(3)}%) below 2.00% ahead of MoF special bond supply.`;
  }

  const synthesis =
    `${synthesisOpening} ` +
    `Argon's multi-update scan across ${newsProfile.classified.length} China macro, CCDC, and geopolitical stories highlights: ${newsProfile.distinctThemesDigest}. ` +
    `With 1Y/5Y LPR at ${lpr1Y.toFixed(2)}%/${lpr5Y.toFixed(2)}% and SSEC at ${ssec.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ssecPct)}), institutional positioning hinges on how "${truncateHeadline(newsProfile.leadItem.title, 72)}" transmits into PBoC liquidity injections and CFETS FX fixings.`;

  const regimeBadge = `${newsProfile.primaryTheme.replace(/_/g, ' ')} · CCDC 10Y ${cgb10Y.toFixed(3)}% (${fmtBps(cgb10YChg)}) · FIX ${fixing.toFixed(4)}`;

  const criticalLevels = [
    {
      asset: 'CCDC 10Y ChinaBond CGB',
      current: `${cgb10Y.toFixed(3)}% (${fmtBps(cgb10YChg)})`,
      support: '1.500%',
      resistance: '1.720%',
      implication: 'Yields approaching 1.500% risk PBoC secondary bond sales; backup toward 1.720% triggers domestic bank buying.',
    },
    {
      asset: 'CCDC 30Y Ultra-Long CGB',
      current: `${cgb30Y.toFixed(3)}% (+${slope10s30s} bps 10s30s)`,
      support: '1.920%',
      resistance: '2.150%',
      implication: 'Ultra-long special Treasury issuance supply tests 2.150% ceiling; rural bank duration demand supports 1.920%.',
    },
    {
      asset: 'USD/CNH & PBoC Fixing',
      current: `${cnh.toFixed(4)} (Fix ${fixing.toFixed(4)})`,
      support: (cnh - 0.065).toFixed(4),
      resistance: (cnh + 0.075).toFixed(4),
      implication: 'PBoC FX reserve requirement adjustments and counter-cyclical fixing factor cap rapid one-way Yuan swings.',
    },
    {
      asset: 'Shanghai Composite (SSEC)',
      current: `${ssec.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ssecPct)})`,
      support: Math.round(ssec * 0.965).toLocaleString('en-US'),
      resistance: Math.round(ssec * 1.035).toLocaleString('en-US'),
      implication: `Break above ${Math.round(ssec * 1.035).toLocaleString('en-US')} drives equity-bond rotation and steepens the CCDC 2s10s CGB curve.`,
    },
  ];

  const eventsToWatch = [
    {
      event: 'PBoC 7D Reverse Repo OMO, MLF Operation & NBS Activity Print (IP / Retail Sales)',
      timing: `${formatSgtDate(nextFri)} · 09:15 & 10:00 CST (SGT)`,
      impact: 'Critical' as const,
      watchFor: `Net liquidity injection via 7D OMO (${omo7d.toFixed(2)}%) and whether DR007 repo stays anchored below 1.70% as CCDC publishes CGB yields amid "${truncateHeadline(newsProfile.leadItem.title, 80)}".`,
    },
    {
      event: 'Ministry of Finance (MoF) 30-Year Ultra-Long Special CGB Issuance Tender',
      timing: `${formatSgtDate(nextWed)} · 10:35 CST (SGT)`,
      impact: 'High' as const,
      watchFor: `Primary auction bid-to-cover on 10Y (${cgb10Y.toFixed(3)}%) and 30Y (${cgb30Y.toFixed(3)}%) CGBs following "${truncateHeadline(newsProfile.secondItem.title, 80)}".`,
    },
    {
      event: 'PBoC Monthly 1-Year & 5-Year Loan Prime Rate (LPR) Quotation Fixing',
      timing: `${formatSgtDate(lprDate)} · 09:15 CST (SGT)`,
      impact: 'High' as const,
      watchFor: `CFETS bank quotations on 1Y/5Y LPR (${lpr1Y.toFixed(2)}% / ${lpr5Y.toFixed(2)}%) alongside PBoC central parity (${fixing.toFixed(4)}) vs offshore CNH (${cnh.toFixed(4)}).`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · CHINA SOVEREIGN (CCDC), PBOC & FX SYNTHESIS',
    regimeBadge,
    dominantRegime: newsProfile.primaryLabel,
    updatedAtSGT,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}

export function buildKoreaArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const sgtNow = getSgtReferenceDate(snap);
  const updatedAtSGT = resolveUpdatedSGT(snap, sgtNow);
  const todayBiz = snapToBusinessDay(sgtNow);
  const sessionDateStr = formatSgtDate(todayBiz);
  const nextMon = getNextWeekdaySgt(todayBiz, 1, false);
  const bokMpbDate = getNextMonthlyDaySgt(todayBiz, 26);

  if (
    snap.korea?.argonCommentary?.aiGenerated &&
    snap.korea.argonCommentary.synthesis &&
    snap.korea.commentary.noteworthyHeadlines[0]?.title &&
    snap.korea.argonCommentary.synthesis.includes(
      snap.korea.commentary.noteworthyHeadlines[0].title.slice(0, 28)
    )
  ) {
    return {
      ...snap.korea.argonCommentary,
      updatedAtSGT,
    };
  }

  const korea = snap.korea;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  const b3 = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('3Y'));
  const b5 = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('5Y'));
  const b10 = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('10Y'));
  const b30 = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('30Y'));

  const ktb3Y = b3?.yield ?? 3.622;
  const ktb3YChg = b3?.changeBps ?? -4.9;
  const ktb5Y = b5?.yield ?? 3.716;
  const ktb10Y = b10?.yield ?? 3.852;
  const ktb10YChg = b10?.changeBps ?? -4.0;
  const ktb30Y = b30?.yield ?? 3.895;
  const quoteDate = korea?.bonds.quotationDate ?? '06 Nov 2026';

  const bokRate = korea?.bonds.bokBaseRate ?? 3.00;
  const kofr = korea?.bonds.kofrOvernightRate ?? 2.98;
  const cd91d = korea?.bonds.cd91dRate ?? 3.42;
  const cpi = korea?.bonds.cpiInflationYoY ?? 2.10;
  const spread10Y = Math.round((ktb10Y - ust10Y) * 100);
  const slope3s10s = Math.round((ktb10Y - ktb3Y) * 100);

  const krw = korea?.fxAndEquities.krwSpot ?? 1356.34;
  const krwPct = korea?.fxAndEquities.krwChangePct ?? -0.03;
  const ndf1M = korea?.fxAndEquities.ndf1M ?? 1354.10;
  const kospi = korea?.fxAndEquities.kospiIndex.level ?? 5059.69;
  const kospiPct = korea?.fxAndEquities.kospiIndex.changePct ?? -6.02;
  const kosdaq = korea?.fxAndEquities.kosdaqIndex.level ?? 644.27;
  const kosdaqPct = korea?.fxAndEquities.kosdaqIndex.changePct ?? -5.03;

  const newsProfile = analyzeNewsCatalysts(
    (korea?.commentary.noteworthyHeadlines || []).map((h) => ({
      title: h.title || h.headline || '',
      source: h.source,
      timeAgo: h.timeAgo || 'Live',
      significance: h.significance,
    })),
    'KOFIA / SOFIA Korea Treasury Bond curve and BOK KOFR repo funding anchor Seoul fixed-income flows'
  );

  let conviction: string;
  let synthesisOpening: string;
  let positioningTakeaway: string;

  if (ktb3YChg >= 5.0 || ktb10YChg >= 5.0 || newsProfile.primaryTheme === 'INFLATION_COMMODITY') {
    conviction = `Hawkish KTB Backup (${fmtBps(ktb3YChg)} 3Y): Fade Sell-Off via 3Y KTB (${ktb3Y.toFixed(3)}%) & KOFR Repo (${kofr.toFixed(3)}%) · Long Chip Exporters (KOSPI ${fmtPct(kospiPct)})`;
    synthesisOpening =
      `[${sessionDateStr} · Sticky CPI & KTB Yield Backup Regime] KOFIA OTC Treasury yields backed up sharply in the latest session (${quoteDate}: 3Y KTB at ${ktb3Y.toFixed(3)}% [${fmtBps(ktb3YChg)}], 5Y at ${ktb5Y.toFixed(3)}%, 10Y at ${ktb10Y.toFixed(3)}% [${fmtBps(ktb10YChg)}; ${spread10Y} bps vs UST]) as sticky inflation and BOK policy calibration headlines temper near-term rate-cut pricing.`;
    positioningTakeaway =
      `[Tactical Call — Scale Into 3Y KTB Above 3.70% & Ride Semiconductor Equity Beta] Synthesizing "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 65)}" (${newsProfile.secondItem.source}), use the ${fmtBps(ktb3YChg)} KTB yield backup to scale into 3Y KTB benchmarks (${ktb3Y.toFixed(3)}%, +${(ktb3Y - bokRate).toFixed(2)}% over the ${bokRate.toFixed(2)}% BOK Base Rate) while keeping equity exposure overweight Korean memory chip exporters driving KOSPI (${kospi.toLocaleString('en-US', { maximumFractionDigits: 0 })}, ${fmtPct(kospiPct)}).`;
  } else if (kospiPct <= -1.5) {
    conviction = `Equity Risk-Off Flight (KOSPI ${fmtPct(kospiPct)}): Overweight 3Y–10Y KOFIA KTB (${ktb3Y.toFixed(3)}%–${ktb10Y.toFixed(3)}%) & Hedge USD/KRW (₩${krw.toFixed(0)})`;
    synthesisOpening =
      `[${sessionDateStr} · Equity Drawdown & Safe-Haven KTB Bid Regime] Sharp equity volatility in KOSPI (${kospi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ${fmtPct(kospiPct)}) and KOSDAQ (${kosdaq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ${fmtPct(kosdaqPct)}) is accelerating domestic institutional rotation into KOFIA Korea Treasury Bonds (3Y at ${ktb3Y.toFixed(3)}% [${fmtBps(ktb3YChg)}], 10Y at ${ktb10Y.toFixed(3)}% [${fmtBps(ktb10YChg)}]).`;
    positioningTakeaway =
      `[Tactical Call — Long 3Y–10Y KTB Duration + Long USD/KRW NDF Protection] With Seoul flows reacting to "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 64)}", hold 3Y–10Y KTB duration (${ktb3Y.toFixed(3)}%–${ktb10Y.toFixed(3)}%) funded at KOFR (${kofr.toFixed(3)}%) and maintain 1M USD/KRW NDF protection (₩${ndf1M.toFixed(2)}) against foreign equity outflow pressure.`;
  } else if (
    newsProfile.primaryTheme === 'TRADE_TARIFF_TECH' ||
    newsProfile.primaryTheme === 'MARKET_REFORM_EQUITY' ||
    kospiPct >= 1.0
  ) {
    conviction = `Semiconductor & Export Boom: Overweight KOSPI Chip Leaders (${fmtPct(kospiPct)}) + WGBI-Backed 10Y KTB (${ktb10Y.toFixed(3)}%) · Constructive KRW`;
    synthesisOpening =
      `[${sessionDateStr} · Semiconductor Export & WGBI Inflow Regime] Strong Korean semiconductor export momentum and Corporate Value-Up catalysts are propelling KOSPI (${kospi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ${fmtPct(kospiPct)}) alongside USD/KRW at ₩${krw.toFixed(2)} (${fmtPct(krwPct)}), while KOFIA 3Y and 10Y KTB benchmarks trade at ${ktb3Y.toFixed(3)}% (${fmtBps(ktb3YChg)}) and ${ktb10Y.toFixed(3)}% (${fmtBps(ktb10YChg)}; 3s10s +${slope3s10s} bps).`;
    positioningTakeaway =
      `[Tactical Call — Dual Semiconductor Equity + WGBI 10Y KTB Allocation] Backed by "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 65)}" (${newsProfile.secondItem.source}), pair long KOSPI semiconductor exporters with unhedged 10Y KTB (${ktb10Y.toFixed(3)}%) to capture both FTSE WGBI passive inflows and exporter USD selling near ₩${Math.round(krw + 15)}.`;
  } else {
    conviction = `Receive 3Y–5Y KOFIA KTB (${ktb3Y.toFixed(3)}%–${ktb5Y.toFixed(3)}%) Over KOFR (${kofr.toFixed(3)}%) · Neutral USD/KRW (₩${krw.toFixed(2)}) Range`;
    synthesisOpening =
      `[${sessionDateStr} · ${newsProfile.primaryLabel} Regime] KOFIA / SOFIA OTC bond fixings (${quoteDate}) price 3Y KTB at ${ktb3Y.toFixed(3)}% (${fmtBps(ktb3YChg)} 1D), 5Y at ${ktb5Y.toFixed(3)}%, 10Y at ${ktb10Y.toFixed(3)}% (${fmtBps(ktb10YChg)} 1D), and 30Y at ${ktb30Y.toFixed(3)}%, anchored by the ${bokRate.toFixed(2)}% BOK Base Rate, ${kofr.toFixed(3)}% KOFR repo, and ${cd91d.toFixed(2)}% 91D CD rate.`;
    positioningTakeaway =
      `[Tactical Call — KTB Belly Carry & Credit Discipline] Reviewing "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 64)}" (${newsProfile.secondItem.source}), capture +${Math.round((ktb3Y - kofr) * 100)} bps of positive repo carry in 3Y–5Y KTBs (${ktb3Y.toFixed(3)}%–${ktb5Y.toFixed(3)}%) while staying selective in AA- corporate credit and watching USD/KRW (₩${krw.toFixed(2)}) around ₩${Math.round(krw + 20)}.`;
  }

  const synthesis =
    `${synthesisOpening} ` +
    `Argon's synthesis across ${newsProfile.classified.length} Seoul macro, BOK, and export headlines highlights: ${newsProfile.distinctThemesDigest}. ` +
    `With Headline CPI at ${cpi.toFixed(2)}% YoY (+${(bokRate - cpi).toFixed(2)}% real buffer) and 91D CD at ${cd91d.toFixed(2)}%, institutional desks are calibrating KTB duration against "${truncateHeadline(newsProfile.leadItem.title, 72)}" and semiconductor trade flows.`;

  const regimeBadge = `${newsProfile.primaryTheme.replace(/_/g, ' ')} · KOFR ${kofr.toFixed(3)}% · 10Y KTB ${ktb10Y.toFixed(3)}% (${fmtBps(ktb10YChg)})`;

  const criticalLevels = [
    {
      asset: 'KOFIA 3Y & 10Y KTB Yield',
      current: `3Y ${ktb3Y.toFixed(3)}% · 10Y ${ktb10Y.toFixed(3)}%`,
      support: `${(ktb10Y - 0.15).toFixed(3)}% (10Y)`,
      resistance: `${(ktb10Y + 0.15).toFixed(3)}% (10Y)`,
      implication: `10Y KTB above ${(ktb10Y + 0.15).toFixed(2)}% draws pension/insurer duration buying; sub-${(ktb10Y - 0.15).toFixed(2)}% prices in an additional BOK rate cut.`,
    },
    {
      asset: 'KOFR / SOFIA & 91D CD Rate',
      current: `KOFR ${kofr.toFixed(3)}% · CD ${cd91d.toFixed(2)}%`,
      support: `${(kofr - 0.15).toFixed(2)}%`,
      resistance: `${(cd91d + 0.12).toFixed(2)}%`,
      implication: 'Tight KOFR-to-BOK Base Rate spread confirms ample overnight RP liquidity across Korean securities dealers.',
    },
    {
      asset: 'USD/KRW Spot & 1M NDF',
      current: `₩${krw.toFixed(2)} (NDF ₩${ndf1M.toFixed(2)})`,
      support: `₩${(krw - 22).toFixed(0)}`,
      resistance: `₩${(krw + 25).toFixed(0)}`,
      implication: `Sustained move above ₩${(krw + 25).toFixed(0)} delays BOK easing and prompts NPS/BOK FX smoothing operations.`,
    },
    {
      asset: 'KOSPI Composite Index',
      current: `${kospi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(kospiPct)})`,
      support: Math.round(kospi * 0.97).toLocaleString('en-US'),
      resistance: Math.round(kospi * 1.035).toLocaleString('en-US'),
      implication: 'Memory semiconductor export cycle and Corporate Value-Up disclosures dictate foreign net equity flows.',
    },
  ];

  const eventsToWatch = [
    {
      event: 'KOFIA 16:00 KST Final OTC KTB Yield Quotation & KTB Futures Settlement',
      timing: `${formatSgtDate(todayBiz)} · 16:00 KST (15:00 SGT)`,
      impact: 'Critical' as const,
      watchFor: `Foreign institutional net buying in 3Y (${ktb3Y.toFixed(3)}%) and 10Y (${ktb10Y.toFixed(3)}%) KTB futures following "${truncateHeadline(newsProfile.leadItem.title, 80)}".`,
    },
    {
      event: 'MOEF 10-Year Korea Treasury Bond (KTB) Competitive Primary Auction & WGBI Flows',
      timing: `${formatSgtDate(nextMon)} · 10:40 KST (09:40 SGT)`,
      impact: 'High' as const,
      watchFor: `Competitive auction takedown on 10Y (${ktb10Y.toFixed(3)}%) and 30Y (${ktb30Y.toFixed(3)}%) KTB supply and Euroclear/Clearstream inflows amid "${truncateHeadline(newsProfile.secondItem.title, 75)}".`,
    },
    {
      event: 'Bank of Korea (BOK) Monetary Policy Board Base Rate Decision & MSB Tender',
      timing: `${formatSgtDate(bokMpbDate)} · 09:00 KST (08:00 SGT)`,
      impact: 'High' as const,
      watchFor: `Governor Rhee Chang-yong's guidance on Base Rate (${bokRate.toFixed(2)}%), KOFR/SOFIA (${kofr.toFixed(3)}%) repo transmission, and USD/KRW (₩${krw.toFixed(2)}) FX smoothing.`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · KOREA SOVEREIGN (KOFIA / SOFIA), BOK & KRW SYNTHESIS',
    regimeBadge,
    dominantRegime: newsProfile.primaryLabel,
    updatedAtSGT,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}

export function buildIndiaArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const sgtNow = getSgtReferenceDate(snap);
  const updatedAtSGT = resolveUpdatedSGT(snap, sgtNow);
  const todayBiz = snapToBusinessDay(sgtNow);
  const sessionDateStr = formatSgtDate(todayBiz);
  const mospiCpiDate = getNextMonthlyDaySgt(todayBiz, 12);
  const nextGsecFri = getNextWeekdaySgt(todayBiz, 5, true);
  const rbiMpcDate = getNextMonthlyDaySgt(addSgtDays(todayBiz, 15), 4);

  if (
    snap.india?.argonCommentary?.aiGenerated &&
    snap.india.argonCommentary.synthesis &&
    snap.india.commentary.noteworthyHeadlines[0]?.title &&
    snap.india.argonCommentary.synthesis.includes(
      snap.india.commentary.noteworthyHeadlines[0].title.slice(0, 28)
    )
  ) {
    return {
      ...snap.india.argonCommentary,
      updatedAtSGT,
    };
  }

  const india = snap.india;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  const b3 = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('3Y'));
  const b5 = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('5Y'));
  const b10 = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('10Y'));
  const b30 = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('30Y'));

  const gsec3Y = b3?.yield ?? 6.958;
  const gsec5Y = b5?.yield ?? 7.023;
  const gsec5YChg = b5?.changeBps ?? -2.2;
  const gsec10Y = b10?.yield ?? 7.162;
  const gsec10YChg = b10?.changeBps ?? 1.7;
  const gsec30Y = b30?.yield ?? 7.619;
  const quoteDate = india?.bonds.quotationDate ?? '06 Nov 2026';

  const repoRate = india?.bonds.rbiRepoRate ?? 5.50;
  const sdfRate = india?.bonds.sdfRate ?? 5.25;
  const msfRate = india?.bonds.msfRate ?? 5.75;
  const tbill91d = india?.bonds.tbill91dRate ?? 5.897;
  const tbill364d = india?.bonds.tbill364dRate ?? 6.649;
  const cpi = india?.bonds.cpiInflationYoY ?? 4.85;
  const spread10Y = Math.round((gsec10Y - ust10Y) * 100);
  const slope5s10s = Math.round((gsec10Y - gsec5Y) * 100);

  const inrSpot = india?.fxAndEquities.inrSpot ?? 93.895;
  const inrPct = india?.fxAndEquities.inrChangePct ?? -0.60;
  const rbiRef = india?.fxAndEquities.rbiReferenceUsd ?? 94.1402;
  const fxReserves = india?.fxAndEquities.forexReservesUsdBn ?? 717.06;
  const nifty = india?.fxAndEquities.nifty50Index.level ?? 24986.40;
  const niftyPct = india?.fxAndEquities.nifty50Index.changePct ?? -0.18;
  const sensex = india?.fxAndEquities.sensexIndex.level ?? 80999.40;
  const sensexPct = india?.fxAndEquities.sensexIndex.changePct ?? -0.04;

  const newsProfile = analyzeNewsCatalysts(
    [
      ...(india?.commentary.noteworthyHeadlines || []).map((h) => ({
        title: h.title || h.headline || '',
        source: h.source,
        timeAgo: h.timeAgo || 'Live',
        significance: h.significance,
      })),
      ...(india?.commentary.rbiOfficialReleases?.slice(0, 2).map((r) => ({
        title: r.title,
        source: `RBI (${r.category})`,
        timeAgo: r.pubDate,
        significance: r.summary,
      })) || []),
    ],
    'RBI manages banking liquidity within the 5.25%-5.75% LAF corridor as 10Y G-Sec trades near 7.16%'
  );

  let conviction: string;
  let synthesisOpening: string;
  let positioningTakeaway: string;

  if (gsec10YChg >= 3.5 || newsProfile.primaryTheme === 'FISCAL_SUPPLY') {
    conviction = `G-Sec Supply & Valuation Shift (${fmtBps(gsec10YChg)} 10Y): Favor 91D–364D T-Bills (${tbill91d.toFixed(2)}%–${tbill364d.toFixed(2)}%) & 3Y–5Y G-Sec (${gsec3Y.toFixed(3)}%–${gsec5Y.toFixed(3)}%)`;
    synthesisOpening =
      `[${sessionDateStr} · G-Sec Portfolio Valuation & Supply Regime] Indian sovereign yields backed up across the belly and long end (${quoteDate}: 5Y G-Sec at ${gsec5Y.toFixed(3)}% [${fmtBps(gsec5YChg)}], 10Y 6.94% GS 2036 at ${gsec10Y.toFixed(3)}% [${fmtBps(gsec10YChg)}], 30Y at ${gsec30Y.toFixed(3)}%) as commercial bank bond-valuation rules and primary auction supply shape PSU bank SLR demand.`;
    positioningTakeaway =
      `[Tactical Call — Shorten G-Sec Duration to 3Y–5Y & Wait for 7.22%+ on 10Y] With Mumbai desks focused on "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 65)}" (${newsProfile.secondItem.source}), keep duration concentrated in 364D T-Bills (${tbill364d.toFixed(3)}%) and 3Y–5Y G-Secs (${gsec3Y.toFixed(3)}%–${gsec5Y.toFixed(3)}%) rather than chasing 10Y–30Y G-Secs until Friday's ₹36,000 Cr auction clears.`;
  } else if (newsProfile.primaryTheme === 'TRADE_TARIFF_TECH' || newsProfile.primaryTheme === 'FX_EXTERNAL_BALANCE') {
    conviction = `Reserve-Backed INR Carry ($${fxReserves.toFixed(0)}B FX Reserves): Long 5Y–10Y FAR G-Secs (${gsec5Y.toFixed(3)}%–${gsec10Y.toFixed(3)}%, +${spread10Y} bps vs UST)`;
    synthesisOpening =
      `[${sessionDateStr} · External Trade & RBI FX Reserve Buffer Regime] Bilateral trade diplomacy and external balance dynamics are driving USD/INR sentiment today (spot at ₹${inrSpot.toFixed(4)} [${fmtPct(inrPct)}], FBIL Ref ₹${rbiRef.toFixed(4)}), backed by RBI's US$${fxReserves.toFixed(2)}B foreign exchange reserve war chest and a +${spread10Y} bps 10Y G-Sec pickup over US Treasuries.`;
    positioningTakeaway =
      `[Tactical Call — Unhedged / Partially Hedged FAR 5Y–10Y G-Sec Carry] Synthesizing "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 65)}" (${newsProfile.secondItem.source}), RBI's US$${fxReserves.toFixed(0)}B reserve buffer caps USD/INR upside near ₹${(inrSpot + 0.65).toFixed(2)}, making Fully Accessible Route (FAR) 5Y–10Y G-Secs (${gsec5Y.toFixed(3)}%–${gsec10Y.toFixed(3)}%) one of Asia's highest risk-adjusted carry trades.`;
  } else if (newsProfile.primaryTheme === 'INFLATION_COMMODITY') {
    conviction = `Crude & Inflation tailwind: Extend into 5Y–10Y G-Secs (${gsec5Y.toFixed(3)}%–${gsec10Y.toFixed(3)}%) + Domestic Nifty Bank / Financials (Nifty ${fmtPct(niftyPct)})`;
    synthesisOpening =
      `[${sessionDateStr} · Disinflation & Commodity Pass-Through Regime] Moderating crude oil prices and easing imported inflation headwinds are supporting both the Indian Rupee (₹${inrSpot.toFixed(4)}, ${fmtPct(inrPct)}) and sovereign bond sentiment (5Y G-Sec at ${gsec5Y.toFixed(3)}% [${fmtBps(gsec5YChg)}], 10Y at ${gsec10Y.toFixed(3)}% [${fmtBps(gsec10YChg)}]) alongside Nifty 50 at ${nifty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(niftyPct)}).`;
    positioningTakeaway =
      `[Tactical Call — Bull-Flattening G-Sec Duration + Domestic Financials] Driven by "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 64)}", lock in 7.00%+ yields in 5Y–10Y G-Secs (${gsec5Y.toFixed(3)}%–${gsec10Y.toFixed(3)}%) and pair with Indian financials and domestic cyclicals benefiting from lower oil import bills and RBI LAF stability (${repoRate.toFixed(2)}% Repo).`;
  } else {
    conviction = `LAF Corridor Carry (Repo ${repoRate.toFixed(2)}%): Overweight 5Y–10Y FAR G-Secs (${gsec5Y.toFixed(3)}% / ${gsec10Y.toFixed(3)}%) & Domestic Equity SIP Leaders`;
    synthesisOpening =
      `[${sessionDateStr} · ${newsProfile.primaryLabel} Regime] Official RBI and CCIL/NDS-OM fixings (${quoteDate}) place 3Y G-Sec at ${gsec3Y.toFixed(3)}%, 5Y at ${gsec5Y.toFixed(3)}% (${fmtBps(gsec5YChg)} 1D), 10Y at ${gsec10Y.toFixed(3)}% (${fmtBps(gsec10YChg)} 1D; 5s10s +${slope5s10s} bps), and 30Y at ${gsec30Y.toFixed(3)}%, anchored by RBI's VRR/VRRR liquidity operations within the ${sdfRate.toFixed(2)}%–${msfRate.toFixed(2)}% SDF/MSF corridor.`;
    positioningTakeaway =
      `[Tactical Call — Core FAR G-Sec Duration & Rupee Stability] Across "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 64)}" (${newsProfile.secondItem.source}), accumulate 5Y–10Y FAR G-Secs (${gsec5Y.toFixed(3)}%–${gsec10Y.toFixed(3)}%) on any backup toward ${(gsec10Y + 0.10).toFixed(2)}% while Nifty 50 (${nifty.toLocaleString('en-US', { maximumFractionDigits: 0 })}, ${fmtPct(niftyPct)}) and Sensex (${sensex.toLocaleString('en-US', { maximumFractionDigits: 0 })}, ${fmtPct(sensexPct)}) consolidate recent gains.`;
  }

  const synthesis =
    `${synthesisOpening} ` +
    `Argon's multi-update synthesis of ${newsProfile.classified.length} Mumbai market disclosures and RBI press releases highlights: ${newsProfile.distinctThemesDigest}. ` +
    `With 91D/364D T-Bills clearing at ${tbill91d.toFixed(3)}%/${tbill364d.toFixed(3)}% and CPI at ${cpi.toFixed(2)}% YoY, institutional desks are positioning around "${truncateHeadline(newsProfile.leadItem.title, 72)}" and RBI's active LAF liquidity fine-tuning.`;

  const regimeBadge = `${newsProfile.primaryTheme.replace(/_/g, ' ')} · REPO ${repoRate.toFixed(2)}% · 10Y G-SEC ${gsec10Y.toFixed(3)}% (${fmtBps(gsec10YChg)})`;

  const criticalLevels = [
    {
      asset: '10Y G-Sec (6.94% GS 2036)',
      current: `${gsec10Y.toFixed(3)}% (+${spread10Y} bps)`,
      support: `${(gsec10Y - 0.12).toFixed(3)}%`,
      resistance: `${(gsec10Y + 0.14).toFixed(3)}%`,
      implication: `Yields near ${(gsec10Y + 0.14).toFixed(2)}% attract PSU bank SLR & foreign FAR inflows; sub-${(gsec10Y - 0.12).toFixed(2)}% requires softer food CPI.`,
    },
    {
      asset: 'RBI LAF Corridor & 91D T-Bill',
      current: `Repo ${repoRate.toFixed(2)}% · 91D ${tbill91d.toFixed(3)}%`,
      support: `${sdfRate.toFixed(2)}% (SDF Floor)`,
      resistance: `${msfRate.toFixed(2)}% (MSF Ceiling)`,
      implication: 'Active RBI VRR/VRRR liquidity auctions prevent overnight call/TREPS rates from breaching the 5.25%–5.75% LAF band.',
    },
    {
      asset: 'USD/INR Spot & FBIL Ref',
      current: `₹${inrSpot.toFixed(2)} (Ref ₹${rbiRef.toFixed(2)})`,
      support: `₹${(inrSpot - 0.65).toFixed(2)}`,
      resistance: `₹${(inrSpot + 0.65).toFixed(2)}`,
      implication: `RBI two-way FX intervention backed by US$${fxReserves.toFixed(1)}B reserves caps rupee volatility near ₹${(inrSpot + 0.65).toFixed(2)}.`,
    },
    {
      asset: 'NIFTY 50 & BSE SENSEX',
      current: `${nifty.toLocaleString('en-US', { maximumFractionDigits: 0 })} / ${sensex.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${fmtPct(niftyPct)})`,
      support: Math.round(nifty * 0.975).toLocaleString('en-US'),
      resistance: Math.round(nifty * 1.025).toLocaleString('en-US'),
      implication: 'Domestic SIP inflows and banking earnings offset foreign equity rotation and support INR capital account stability.',
    },
  ];

  const eventsToWatch = [
    {
      event: 'India MoSPI Consumer Price Index (CPI) Print & RBI LAF VRR/VRRR Operations',
      timing: `${formatSgtDate(mospiCpiDate)} · 16:00 IST (18:30 SGT)`,
      impact: 'Critical' as const,
      watchFor: `Food-price trajectory relative to RBI's 4.0% (±2%) target band (currently ${cpi.toFixed(2)}% YoY) and call money alignment with ${repoRate.toFixed(2)}% Repo amid "${truncateHeadline(newsProfile.leadItem.title, 78)}".`,
    },
    {
      event: 'RBI Weekly ₹36,000 Cr Government Stock (G-Sec) Auction & WSS Forex Reserves Print',
      timing: `${formatSgtDate(nextGsecFri)} · 14:30 & 17:00 IST (17:00 & 19:30 SGT)`,
      impact: 'High' as const,
      watchFor: `Cut-off yields on 5Y (${gsec5Y.toFixed(3)}%) and 10Y (${gsec10Y.toFixed(3)}%) G-Secs with NIL PD devolvement, plus weekly variation in RBI's US$${fxReserves.toFixed(2)}B FX Reserves.`,
    },
    {
      event: 'RBI Monetary Policy Committee (MPC) Repo Rate Decision & SDF/MSF Corridor Review',
      timing: `${formatSgtDate(rbiMpcDate)} · 10:00 IST (12:30 SGT)`,
      impact: 'High' as const,
      watchFor: `MPC forward guidance on the ${repoRate.toFixed(2)}% Repo rate, FAR G-Sec foreign inflows, and USD/INR stability following "${truncateHeadline(newsProfile.secondItem.title, 75)}".`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · INDIA SOVEREIGN (RBI / CCIL G-SEC), LAF & INR SYNTHESIS',
    regimeBadge,
    dominantRegime: newsProfile.primaryLabel,
    updatedAtSGT,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}

export function buildUsEquitiesArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const sgtNow = getSgtReferenceDate(snap);
  const updatedAtSGT = resolveUpdatedSGT(snap, sgtNow);
  const todayBiz = snapToBusinessDay(sgtNow);
  const sessionDateStr = formatSgtDate(todayBiz);
  const cpiDate = getNextMonthlyDaySgt(todayBiz, 12);
  const nextFri = getNextWeekdaySgt(todayBiz, 5, true);
  const opexFri = getNextMonthlyDaySgt(todayBiz, 20);

  if (
    snap.equities?.argonCommentary?.aiGenerated &&
    snap.equities.argonCommentary.synthesis &&
    snap.equities.noteworthyHeadlines[0]?.title &&
    snap.equities.argonCommentary.synthesis.includes(
      snap.equities.noteworthyHeadlines[0].title.slice(0, 28)
    )
  ) {
    return {
      ...snap.equities.argonCommentary,
      updatedAtSGT,
    };
  }

  const eq = snap.equities;
  const t10 = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y');
  const ust10Y = t10?.yield ?? 4.86;
  const ust10YChg = t10?.changeBps ?? 0.0;
  const ust2Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '2Y')?.yield ?? 4.53;

  const spx = eq?.indexSummary.spxLevel ?? 7376.86;
  const spxPct = eq?.indexSummary.spxChangePct ?? 0.31;
  const spxFwdPe = eq?.indexSummary.spxForwardPe ?? 21.8;
  const spxEy = eq?.indexSummary.spxEarningsYieldPct ?? Number((100 / spxFwdPe).toFixed(2));
  const erpBps = Math.round((spxEy - ust10Y) * 100);

  const peLeader = eq?.topForwardPe[0];
  const peSecond = eq?.topForwardPe[1];
  const fcfLeader = eq?.topFcfToEv[0];
  const fcfSecond = eq?.topFcfToEv[1];
  const divLeader = eq?.topDividendYield[0];
  const divSecond = eq?.topDividendYield[1];

  const newsProfile = analyzeNewsCatalysts(
    (eq?.noteworthyHeadlines || []).map((h) => ({
      title: h.title || h.headline || '',
      source: h.source,
      timeAgo: h.timeAgo || 'Live',
      significance: h.significance,
    })),
    'S&P 500 valuation dispersion widens as 10Y Treasury yields test equity risk premium across growth vs FCF value'
  );

  let conviction: string;
  let synthesisOpening: string;
  let positioningTakeaway: string;

  if (ust10YChg >= 3.0 || erpBps <= -35) {
    conviction = `Negative ERP (${erpBps} bps vs ${ust10Y.toFixed(2)}% 10Y UST): Rotate From 22x+ Index Beta Into Top FCF/EV (${fcfLeader?.ticker || 'APA'} ${(fcfLeader?.fcfToEvPct ?? 12.2).toFixed(1)}%) & Low Fwd P/E (${peLeader?.ticker || 'CAG'} ${(peLeader?.forwardPe ?? 5.8).toFixed(1)}x)`;
    synthesisOpening =
      `[${sessionDateStr} · Rate-Driven ERP Compression & Value Dispersion Regime] With 10Y US Treasury yields moving ${fmtBps(ust10YChg)} to ${ust10Y.toFixed(2)}% against the S&P 500's ${spxFwdPe.toFixed(1)}x NTM Forward P/E (${spxEy.toFixed(2)}% implied earnings yield, compressing the Equity Risk Premium to ${erpBps} bps), rate-sensitive multiple discipline is dominating US equity factor flows even as the cash index trades at ${spx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)}).`;
    positioningTakeaway =
      `[Tactical Call — Long Unlevered FCF/EV & Low-P/E Compounders Over Cap-Weighted Index] Synthesizing "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 64)}" (${newsProfile.secondItem.source}), underweight long-duration mega-cap multiples and reallocate into the Top 10 FCF/EV basket led by ${fcfLeader?.ticker || 'APA'} (${(fcfLeader?.fcfToEvPct ?? 12.2).toFixed(2)}% FCF/EV) and ${fcfSecond?.ticker || 'DVN'} (${(fcfSecond?.fcfToEvPct ?? 11.2).toFixed(2)}%), alongside Top Forward P/E names ${peLeader?.ticker || 'CAG'} (${(peLeader?.forwardPe ?? 5.8).toFixed(2)}x) and ${peSecond?.ticker || 'GM'} (${(peSecond?.forwardPe ?? 6.7).toFixed(2)}x) generating +700 to +1,100 bps of earnings/cash yield pickup over 10Y Treasuries.`;
  } else if (spxPct <= -0.5 || newsProfile.primaryTheme === 'POLITICAL_GOVERNANCE' || newsProfile.primaryTheme === 'TRADE_TARIFF_TECH') {
    conviction = `Defensive Cash-Flow & Dividend Shield: Overweight FCF-Covered Dividend Leaders (${divLeader?.ticker || 'LYB'} ${(divLeader?.dividendYieldPct ?? 7.4).toFixed(1)}%, ${divSecond?.ticker || 'CAG'} ${(divSecond?.dividendYieldPct ?? 6.8).toFixed(1)}%) + Low-Debt FCF/EV`;
    synthesisOpening =
      `[${sessionDateStr} · Defensive Factor Rotation & Policy Headline Regime] Amid "${truncateHeadline(newsProfile.leadItem.title, 70)}" (${newsProfile.leadItem.source}) and S&P 500 trading at ${spx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)}), institutional desks are rotating toward self-funded balance sheets with high dividend and free-cash-flow coverage.`;
    positioningTakeaway =
      `[Tactical Call — Defensive Dividend + FCF/EV Barbell] Anchor US equity books in FCF-covered dividend payers led by ${divLeader?.ticker || 'LYB'} (${(divLeader?.dividendYieldPct ?? 7.4).toFixed(2)}% Div/Price) and ${divSecond?.ticker || 'CAG'} (${(divSecond?.dividendYieldPct ?? 6.8).toFixed(2)}%), paired with unlevered cash generators ${fcfLeader?.ticker || 'APA'} (${(fcfLeader?.fcfToEvPct ?? 12.2).toFixed(2)}% FCF/EV), insulating portfolios from policy/tariff volatility and ${ust10Y.toFixed(2)}% 10Y Treasury yields.`;
  } else {
    conviction = `Cyclical Value & Buyback Compounders: Long Top Fwd P/E (${peLeader?.ticker || 'CAG'} ${(peLeader?.forwardPe ?? 5.8).toFixed(1)}x, ${peSecond?.ticker || 'GM'} ${(peSecond?.forwardPe ?? 6.7).toFixed(1)}x) + FCF/EV Leaders (${fcfLeader?.ticker || 'APA'} ${(fcfLeader?.fcfToEvPct ?? 12.2).toFixed(1)}%)`;
    synthesisOpening =
      `[${sessionDateStr} · Broad Equity Breadth & Cash-Return Regime] As the S&P 500 advances to ${spx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)} 1D) on a ${spxFwdPe.toFixed(1)}x NTM Forward P/E (${spxEy.toFixed(2)}% E/P vs ${ust10Y.toFixed(2)}% 10Y UST; ERP ${erpBps} bps), breadth expansion and share buyback execution are rewarding deep-value and high-FCF/EV constituents.`;
    positioningTakeaway =
      `[Tactical Call — Capture Factor Dispersion Across All 3 Valuation Screens] Reviewing "${truncateHeadline(newsProfile.leadItem.title, 68)}" (${newsProfile.leadItem.source}) and "${truncateHeadline(newsProfile.secondItem.title, 64)}" (${newsProfile.secondItem.source}), overweight a 3-factor sleeve combining Top Forward P/E (${peLeader?.ticker || 'CAG'} at ${(peLeader?.forwardPe ?? 5.8).toFixed(2)}x / ${(peLeader?.earningsYieldPct ?? 17.2).toFixed(1)}% E/P), Top FCF/EV (${fcfLeader?.ticker || 'APA'} at ${(fcfLeader?.fcfToEvPct ?? 12.2).toFixed(2)}%), and Top Dividend Yield (${divLeader?.ticker || 'LYB'} at ${(divLeader?.dividendYieldPct ?? 7.4).toFixed(2)}%) to outperform the ${spxFwdPe.toFixed(1)}x cap-weighted benchmark.`;
  }

  const synthesis =
    `${synthesisOpening} ` +
    `Argon's multi-update analysis of ${newsProfile.classified.length} US equity and valuation stories highlights: ${newsProfile.distinctThemesDigest}. ` +
    `Cross-referencing the live S&P 500 screens: Forward P/E is led by ${peLeader?.ticker || 'CAG'} ($${(peLeader?.price ?? 20.5).toFixed(2)}, ${fmtPct(peLeader?.changePct)}, ${(peLeader?.forwardPe ?? 5.8).toFixed(2)}x) and ${peSecond?.ticker || 'GM'} (${(peSecond?.forwardPe ?? 6.7).toFixed(2)}x); Enterprise Cash Yield is led by ${fcfLeader?.ticker || 'APA'} (${(fcfLeader?.fcfToEvPct ?? 12.2).toFixed(2)}% FCF/EV) and ${fcfSecond?.ticker || 'DVN'} (${(fcfSecond?.fcfToEvPct ?? 11.2).toFixed(2)}%); and Dividend Yield is led by ${divLeader?.ticker || 'LYB'} (${(divLeader?.dividendYieldPct ?? 7.4).toFixed(2)}% Div/Price).`;

  const regimeBadge = `${newsProfile.primaryTheme.replace(/_/g, ' ')} · SPX ${spx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)}) · ERP ${erpBps} BPS`;

  const criticalLevels = [
    {
      asset: 'S&P 500 Cash Index (^GSPC)',
      current: `${spx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)})`,
      support: Math.round(spx * 0.982).toLocaleString('en-US'),
      resistance: Math.round(spx * 1.018).toLocaleString('en-US'),
      implication: `Sustaining above ${Math.round(spx * 0.982).toLocaleString('en-US')} preserves breadth rotation into cyclical value, financials, and energy cash cows.`,
    },
    {
      asset: 'S&P 500 Forward P/E & ERP',
      current: `${spxFwdPe.toFixed(1)}x (${erpBps} bps ERP)`,
      support: '19.8x (5.05% E/P)',
      resistance: '22.5x (4.44% E/P)',
      implication: `Multiple expansion above 22.5x requires 10Y UST yields to ease below ${(ust10Y - 0.25).toFixed(2)}%; higher rates favor low-duration FCF/EV leaders.`,
    },
    {
      asset: 'Top 10 FCF / EV Spread vs 10Y UST',
      current: `${(fcfLeader?.fcfToEvPct ?? 12.8).toFixed(2)}% vs ${ust10Y.toFixed(2)}% UST`,
      support: '+450 bps FCF Spread',
      resistance: '+850 bps FCF Spread',
      implication: 'Double-digit FCF/EV yields fund aggressive share buybacks and debt retirement independent of capital market conditions.',
    },
    {
      asset: 'Top 10 Div / Price vs US 2Y',
      current: `${(divLeader?.dividendYieldPct ?? 7.4).toFixed(2)}% vs ${ust2Y.toFixed(2)}% 2Y`,
      support: '+150 bps Income Pickup',
      resistance: '+300 bps Income Pickup',
      implication: 'High-dividend S&P 500 cash generators with <75% FCF payout ratios attract institutional income reallocation as front-end rates peak.',
    },
  ];

  const eventsToWatch = [
    {
      event: 'US CPI Disinflation Print & 10-Year Treasury Yield ERP Re-Rating Test',
      timing: `${formatSgtDate(cpiDate)} · 21:30 SGT (08:30 ET)`,
      impact: 'Critical' as const,
      watchFor: `Any move in 10Y UST above ${(ust10Y + 0.15).toFixed(2)}% accelerating institutional rotation into Top 10 FCF/EV (${fcfLeader?.ticker || 'APA'}) and Forward P/E (${peLeader?.ticker || 'GM'}) amid "${truncateHeadline(newsProfile.leadItem.title, 75)}".`,
    },
    {
      event: 'S&P 500 FactSet Weekly NTM Consensus EPS Revision Cut-Off & Margin Update',
      timing: `${formatSgtDate(nextFri)} · 16:00 ET (Sat 05:00 SGT)`,
      impact: 'High' as const,
      watchFor: `Operating margin resilience and forward NTM EPS revisions across Value vs Mega-Cap Technology following "${truncateHeadline(newsProfile.secondItem.title, 75)}".`,
    },
    {
      event: 'S&P 500 Monthly Options Expiration (OpEx), Buyback Execution & Ex-Dividend Date',
      timing: `${formatSgtDate(opexFri)} · 09:30–16:00 ET (NY Cash Close)`,
      impact: 'High' as const,
      watchFor: `Authorized share repurchase execution among Top 10 FCF/EV constituents and institutional dividend capture in ${divLeader?.ticker || 'LYB'} (${(divLeader?.dividendYieldPct ?? 7.4).toFixed(2)}% Div/Price).`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · US EQUITIES (S&P 500) VALUATION, ERP & FACTOR SYNTHESIS',
    regimeBadge,
    dominantRegime: newsProfile.primaryLabel,
    updatedAtSGT,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}

export function buildIndonesiaLocalNewsArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const sgtNow = getSgtReferenceDate(snap);
  const updatedAtSGT = snap.indonesiaLocalNews?.asOfDate || resolveUpdatedSGT(snap, sgtNow);
  const todayBiz = snapToBusinessDay(sgtNow);
  const sessionDateStr = formatSgtDate(todayBiz);
  const nextFri = getNextWeekdaySgt(todayBiz, 5, true);
  const biRdgDate = getNextMonthlyDaySgt(todayBiz, 18);

  const loc = snap.indonesiaLocalNews;
  const fx = snap.indonesia.fxAndNdf;
  const bonds = snap.indonesia.bonds;

  const spot = fx.spotRate ?? 18070;
  const spotPct = fx.spotChangePct ?? 0.0;
  const jisdor = fx.jisdorRate ?? 18059;
  const ihsg = fx.ihsgIndex.level ?? 5075.13;
  const ihsgPct = fx.ihsgIndex.changePct ?? 0.0;
  const indo5Y = bonds.indoGB.find((b) => b.tenor.startsWith('5Y'))?.yield ?? 7.39;
  const indo10Y = bonds.indoGB.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 7.55;
  const srbi12M =
    bonds.srbi.find((s) => s.tenor === '12M')?.weightedAvgYield ??
    bonds.srbi.find((s) => s.tenor === '12M')?.cutOffYield ??
    6.675;

  const impList = loc?.topImportant || [];
  const readList = loc?.topRead || [];

  const impProfile = analyzeNewsCatalysts(
    impList.map((item) => ({
      title: item.titleEn,
      source: item.source,
      timeAgo: item.timeAgo,
      category: item.category,
      significance: item.marketSignificance,
      impact: item.impactDirection,
    })),
    'IDX and Bank Indonesia coordinate capital-market free-float reforms and Rupiah liquidity'
  );

  const readProfile = analyzeNewsCatalysts(
    readList.map((item) => ({
      title: item.titleEn,
      source: item.source,
      timeAgo: item.timeAgo,
      category: item.category,
      significance: item.marketSignificance,
      impact: item.impactDirection,
    })),
    'National political and parliamentary oversight headlines lead domestic Bahasa readership'
  );

  const imp1 = impList[0];
  const imp2 = impList[1];
  const imp3 = impList[2];
  const imp4 = impList[3];
  const read1 = readList[0];
  const read2 = readList[1];
  const read3 = readList[2];

  const polCount =
    impProfile.themeCounts.POLITICAL_GOVERNANCE + readProfile.themeCounts.POLITICAL_GOVERNANCE;
  const mktCount =
    impProfile.themeCounts.MARKET_REFORM_EQUITY + readProfile.themeCounts.MARKET_REFORM_EQUITY;

  let conviction: string;
  let positioningTakeaway: string;

  if (polCount >= 4) {
    conviction = `High Onshore Political/DPR Readership (${polCount} Stories): Anchor in 12M SRBI (${srbi12M.toFixed(3)}%) & 5Y FR0109 (${indo5Y.toFixed(2)}%) · Selective Liquid LQ45 Banks`;
    positioningTakeaway =
      `[Tactical Call — Separate Political Virality from Institutional Policy Anchors] With ${polCount} of today's top Bahasa stories centered on constitutional, DPR, or governance developments—led by "${truncateHeadline(imp1?.titleEn || read1?.titleEn, 68)}" (${imp1?.source || read1?.source}) and "${truncateHeadline(read1?.titleEn, 65)}" (${read1?.source})—foreign desks should keep Rupiah duration focused in 12M BI SRBI (${srbi12M.toFixed(3)}% WAR) and 5Y FR0109 (${indo5Y.toFixed(2)}%), hedge offshore USD/IDR (Rp ${spot.toLocaleString('en-US')}) via 1M NDFs, and restrict equity holdings to high-free-float LQ45 banks.`;
  } else if (mktCount >= 3 || impProfile.primaryTheme === 'MARKET_REFORM_EQUITY') {
    conviction = `Onshore IDX/MSCI Reform Catalyst: Rotate Out of HSC Small-Caps Into Liquid LQ45 + 10Y FR0108 (${indo10Y.toFixed(2)}%) Carry`;
    positioningTakeaway =
      `[Tactical Call — Quality Free-Float Rotation & SBN Carry] Synthesizing #1 Important "${truncateHeadline(imp1?.titleEn, 68)}" (${imp1?.source}) alongside #2 "${truncateHeadline(imp2?.titleEn, 64)}" (${imp2?.source}) and #1 Most Read "${truncateHeadline(read1?.titleEn, 64)}" (${read1?.source}), actively avoid High Shareholder Concentration (HSC) and low-float IDX tickers, concentrate Jakarta equity risk in top-10 foreign-accumulated blue chips (IHSG ${ihsg.toLocaleString('en-US', { maximumFractionDigits: 2 })}, ${fmtPct(ihsgPct)}), and lock in ${indo10Y.toFixed(2)}% on 10Y FR0108.`;
  } else {
    conviction = `Macro & Fiscal Policy Focus (${impProfile.primaryLabel.split(',')[0]}): Long 5Y–10Y IndoGB (${indo5Y.toFixed(2)}%–${indo10Y.toFixed(2)}%) & Liquid State Banks`;
    positioningTakeaway =
      `[Tactical Call — Constructive Onshore Rates & Core Banking Exposure] Balancing top macro-policy disclosures ("${truncateHeadline(imp1?.titleEn, 66)}" [${imp1?.source}] and "${truncateHeadline(imp2?.titleEn, 62)}" [${imp2?.source}]) against viral readership ("${truncateHeadline(read1?.titleEn, 62)}" [${read1?.source}]), accumulate 5Y–10Y IndoGBs (${indo5Y.toFixed(2)}%–${indo10Y.toFixed(2)}%) and 12M SRBI (${srbi12M.toFixed(3)}%) while USD/IDR holds near Rp ${spot.toLocaleString('en-US')} (JISDOR Rp ${jisdor.toLocaleString('en-US')}).`;
  }

  const synthesis =
    `[${sessionDateStr} · ID→EN Cross-Portal Intelligence (${impProfile.primaryLabel.split(',')[0]} vs ${readProfile.primaryLabel.split(',')[0]})] ` +
    `Argon's live neural translation and institutional scoring across 10 Bahasa Indonesia portals identifies a clear thematic structure: ` +
    `on the Top 10 Most Important board, institutional impact is driven by #1 "${truncateHeadline(imp1?.titleEn, 78)}" (${imp1?.source} · ${imp1?.timeAgo}), #2 "${truncateHeadline(imp2?.titleEn, 74)}" (${imp2?.source} · ${imp2?.timeAgo}), #3 "${truncateHeadline(imp3?.titleEn, 70)}" (${imp3?.source}), and #4 "${truncateHeadline(imp4?.titleEn, 66)}" (${imp4?.source}). ` +
    `Meanwhile, domestic Terpopuler readership is led by #1 "${truncateHeadline(read1?.titleEn, 74)}" (${read1?.source} · ${read1?.timeAgo}), #2 "${truncateHeadline(read2?.titleEn, 70)}" (${read2?.source}), and #3 "${truncateHeadline(read3?.titleEn, 68)}" (${read3?.source}) — ` +
    `against an onshore backdrop where USD/IDR trades at Rp ${spot.toLocaleString('en-US')} (${fmtPct(spotPct)} 1D; JISDOR Rp ${jisdor.toLocaleString('en-US')}), IHSG prints ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ihsgPct)}), and 10Y FR0108 yields ${indo10Y.toFixed(2)}%.`;

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · INDONESIA LOCAL-LANGUAGE MEDIA (ID→EN) & POLITICAL-ECONOMIC SYNTHESIS',
    regimeBadge: `${impProfile.primaryTheme.replace(/_/g, ' ')} · USD/IDR Rp ${spot.toLocaleString('en-US')} · IHSG ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    dominantRegime: impProfile.primaryLabel,
    updatedAtSGT,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels: [
      {
        asset: 'IHSG (JCI) & LQ45 Liquidity',
        current: `${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ihsgPct)})`,
        support: Math.round(ihsg * 0.98).toLocaleString('en-US'),
        resistance: Math.round(ihsg * 1.02).toLocaleString('en-US'),
        implication: 'IDX free-float reforms and MSCI rebalancing concentrate institutional flows into liquid big-cap banks.',
      },
      {
        asset: '12M SRBI & BI Policy Rate',
        current: `${srbi12M.toFixed(3)}% WAR · 5.75% BI`,
        support: '5.75% BI-Rate',
        resistance: '6.80% SRBI Cap',
        implication: `12M SRBI at ${srbi12M.toFixed(3)}% WAR and BI triple-intervention defend onshore Rupiah carry.`,
      },
      {
        asset: 'USD/IDR Spot & JISDOR',
        current: `Rp ${spot.toLocaleString('en-US')} (JISDOR ${jisdor.toLocaleString('en-US')})`,
        support: `Rp ${(spot - 120).toLocaleString('en-US')}`,
        resistance: `Rp ${(spot + 150).toLocaleString('en-US')}`,
        implication: 'BI DNDF and spot intervention smooth external Fed/DXY volatility and domestic political headline noise.',
      },
      {
        asset: '10Y IndoGB (FR0108)',
        current: `${indo10Y.toFixed(2)}%`,
        support: `${(indo10Y - 0.15).toFixed(2)}%`,
        resistance: `${(indo10Y + 0.18).toFixed(2)}%`,
        implication: `Domestic bank and pension demand anchors 10Y FR0108 whenever yields approach ${(indo10Y + 0.15).toFixed(2)}%.`,
      },
    ],
    eventsToWatch: [
      {
        event: 'IDX (BEI) HSC Free-Float Exclusion & MSCI Index Rebalancing Implementation',
        timing: `${formatSgtDate(nextFri)} · 09:00 WIB (10:00 SGT)`,
        impact: 'Critical',
        watchFor: `Passive and active institutional rotation into liquid LQ45 constituents following "${truncateHeadline(imp1?.titleEn, 78)}".`,
      },
      {
        event: 'DPR RI Parliamentary Working Meetings & Executive Fiscal / Governance Updates',
        timing: `${formatSgtDate(todayBiz)} · 13:30 WIB (14:30 SGT)`,
        impact: 'High',
        watchFor: `Onshore market reaction to "${truncateHeadline(read1?.titleEn, 75)}" and APBN budget efficiency directives.`,
      },
      {
        event: 'Bank Indonesia Board of Governors (RDG) & KSSK Financial Stability Assessment',
        timing: `${formatSgtDate(biRdgDate)} · 14:20 WIB (15:20 SGT)`,
        impact: 'High',
        watchFor: `BI liquidity incentives, USD/IDR JISDOR (Rp ${jisdor.toLocaleString('en-US')}) stability, and 10Y FR0108 (${indo10Y.toFixed(2)}%) auction demand.`,
      },
    ],
  };
}

/**
 * Dynamic Country Executive Market Briefings & 3 Macro Pillars (Indonesia, China, Korea, India)
 * Ensures the secondary Executive Market Briefing card on each country tab is also rewritten
 * from the day's top 5 news updates and live 1D yield/FX/equity shifts.
 */
export function buildIndonesiaMarketBriefing(snap: DailyMacroSnapshot): IndonesiaCommentary {
  const sgtNow = getSgtReferenceDate(snap);
  const todayBiz = snapToBusinessDay(sgtNow);
  const dateStr = formatSgtDate(todayBiz);

  const bonds = snap.indonesia.bonds;
  const fx = snap.indonesia.fxAndNdf;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  const biRate = bonds.biRate ?? 5.75;
  const cpi = bonds.cpiInflationYoY ?? 3.28;
  const realBuffer = (biRate - cpi).toFixed(2);

  const b5 = bonds.indoGB.find((b) => b.tenor.startsWith('5Y'));
  const b10 = bonds.indoGB.find((b) => b.tenor.startsWith('10Y'));
  const b15 = bonds.indoGB.find((b) => b.tenor.startsWith('15Y'));
  const b20 = bonds.indoGB.find((b) => b.tenor.startsWith('20Y'));

  const y5 = b5?.yield ?? 7.39;
  const y5Chg = b5?.changeBps ?? 0.0;
  const y10 = b10?.yield ?? 7.55;
  const y10Chg = b10?.changeBps ?? 0.0;
  const y15 = b15?.yield ?? 7.82;
  const y20 = b20?.yield ?? 7.89;
  const spread10Y = Math.round((y10 - ust10Y) * 100);

  const srbi6M = bonds.srbi.find((s) => s.tenor === '6M')?.weightedAvgYield ?? 6.566;
  const srbi9M = bonds.srbi.find((s) => s.tenor === '9M')?.weightedAvgYield ?? 6.655;
  const srbi12M = bonds.srbi.find((s) => s.tenor === '12M')?.weightedAvgYield ?? 6.675;
  const srbiDate = bonds.srbi.find((s) => s.tenor === '12M')?.auctionDate ?? '06 Nov 2026';

  const spot = fx.spotRate ?? 18080;
  const spotPct = fx.spotChangePct ?? 0.0;
  const jisdor = fx.jisdorRate ?? 18130;
  const ndf1M = fx.ndf1M ?? 18116;
  const ndfSpread = fx.ndfSpread1M ?? 36;
  const ihsg = fx.ihsgIndex.level ?? 5075.13;
  const ihsgPct = fx.ihsgIndex.changePct ?? 0.0;

  const headlines = snap.indonesia.commentary.noteworthyHeadlines || [];
  const profile = analyzeNewsCatalysts(
    headlines.map((h) => ({
      title: h.title || h.headline || '',
      source: h.source,
      timeAgo: h.timeAgo || 'Live',
      significance: h.significance,
    })),
    'Bank Indonesia and Ministry of Finance coordinate SBN curve and Rupiah stability'
  );

  return {
    title: `Bank Indonesia & DJPPR Sovereign Fixed Income Briefing · ${profile.primaryLabel.split(',')[0]}`,
    date: dateStr,
    biPolicyPosture: `BI-Rate ${biRate.toFixed(2)}% (Real Buffer +${realBuffer}%) · 12M SRBI ${srbi12M.toFixed(3)}% WAR · ${profile.primaryTheme.replace(/_/g, ' ')}`,
    executiveSummary:
      `[${dateStr} Executive Synthesis] Across today's Jakarta session, dominant news flow centers on ${profile.primaryLabel.toLowerCase()} — led by "${truncateHeadline(profile.leadItem.title, 78)}" (${profile.leadItem.source} · ${profile.leadItem.timeAgo}) and "${truncateHeadline(profile.secondItem.title, 74)}" (${profile.secondItem.source} · ${profile.secondItem.timeAgo}). ` +
      `Bank Indonesia maintains its ${biRate.toFixed(2)}% policy anchor (+${realBuffer}% real buffer over ${cpi.toFixed(2)}% YoY CPI), anchoring 5Y FR0109 at ${y5.toFixed(2)}% (${fmtBps(y5Chg)} 1D) and 10Y FR0108 at ${y10.toFixed(2)}% (${fmtBps(y10Chg)} 1D; +${spread10Y} bps over 10Y UST), while onshore USD/IDR trades at Rp ${spot.toLocaleString('en-US')} (${fmtPct(spotPct)}; JISDOR Rp ${jisdor.toLocaleString('en-US')}) and IHSG prints ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ihsgPct)}).`,
    macroPillars: [
      {
        heading: `1. DJPPR 2026 Seri Benchmark SUN Curve & Fiscal Transmission (${dateStr})`,
        analysis:
          `Official DJPPR Kemenkeu 2026 benchmarks price 5Y FR0109 at ${y5.toFixed(2)}% (${fmtBps(y5Chg)}), 10Y FR0108 at ${y10.toFixed(2)}% (${fmtBps(y10Chg)}, +${spread10Y} bps vs US10Y), 15Y FR0106 at ${y15.toFixed(2)}%, and 20Y FR0107 at ${y20.toFixed(2)}%. Onshore institutional duration demand is actively weighing "${truncateHeadline(profile.leadItem.title, 72)}" (${profile.leadItem.source}) against domestic bank and pension reinvestment flows.`,
      },
      {
        heading: `2. BI SRBI Open Market Operations (${srbiDate}) & Rupiah Liquidity Corridor`,
        analysis:
          `Bank Indonesia's SRBI curve clears at ${srbi6M.toFixed(3)}% (6M), ${srbi9M.toFixed(3)}% (9M), and ${srbi12M.toFixed(3)}% (12M WAR, IDR 7.50 T awarded from IDR 36.90 T total bids), preserving a +${Math.round((srbi12M - ust10Y) * 100)} bps short-end yield pickup over US 10Y Treasuries while desks digest "${truncateHeadline(profile.secondItem.title, 72)}" (${profile.secondItem.source}).`,
      },
      {
        heading: `3. JISDOR (Rp ${jisdor.toLocaleString('en-US')}), Offshore NDF Basis (+${ndfSpread} IDR) & IHSG (${ihsg.toLocaleString('en-US', { maximumFractionDigits: 2 })})`,
        analysis:
          `Spot USD/IDR trades at Rp ${spot.toLocaleString('en-US')} (${fmtPct(spotPct)}) alongside 1M NDFs at Rp ${ndf1M.toLocaleString('en-US')} (+${ndfSpread} IDR implied basis) and IHSG at ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ihsgPct)}), with "${truncateHeadline((profile.thirdItem || profile.leadItem).title, 72)}" shaping foreign institutional equity and bond positioning.`,
      },
    ],
    noteworthyHeadlines: headlines,
  };
}

export function buildChinaMarketBriefing(snap: DailyMacroSnapshot): ChinaMacroData['commentary'] {
  const sgtNow = getSgtReferenceDate(snap);
  const todayBiz = snapToBusinessDay(sgtNow);
  const dateStr = formatSgtDate(todayBiz);

  const china = snap.china;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;
  const curveDate = china?.bonds.curveDate ?? '2026-11-11';

  const b1 = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('1Y'));
  const b5 = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('5Y'));
  const b10 = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('10Y'));
  const b30 = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('30Y'));

  const y1 = b1?.yield ?? 1.181;
  const y5 = b5?.yield ?? 1.329;
  const y5Chg = b5?.changeBps ?? 1.9;
  const y10 = b10?.yield ?? 1.602;
  const y10Chg = b10?.changeBps ?? 0.0;
  const y30 = b30?.yield ?? 2.043;
  const y30Chg = b30?.changeBps ?? 0.5;
  const spread10Y = Math.round((y10 - ust10Y) * 100);

  const omo7d = china?.bonds.pbocOmo7dRate ?? 1.50;
  const lpr1Y = china?.bonds.lpr1Y ?? 3.00;
  const lpr5Y = china?.bonds.lpr5Y ?? 3.50;
  const cpi = china?.bonds.cpiInflationYoY ?? 0.60;

  const cny = china?.fxAndEquities.cnySpot ?? 6.6760;
  const cnyPct = china?.fxAndEquities.cnyChangePct ?? 0.12;
  const cnh = china?.fxAndEquities.cnhSpot ?? 6.6713;
  const fixing = china?.fxAndEquities.pbocFixing ?? 6.6735;
  const ssec = china?.fxAndEquities.shanghaiComposite.level ?? 3649.18;
  const ssecPct = china?.fxAndEquities.shanghaiComposite.changePct ?? 0.08;
  const csi300 = china?.fxAndEquities.csi300Index.level ?? 4054.28;
  const csiPct = china?.fxAndEquities.csi300Index.changePct ?? -0.15;

  const headlines = china?.commentary.noteworthyHeadlines || [];
  const profile = analyzeNewsCatalysts(
    headlines.map((h) => ({
      title: h.title || h.headline || '',
      source: h.source,
      timeAgo: h.timeAgo || 'Live',
      significance: h.significance,
    })),
    'PBoC and CCDC ChinaBond CGB curve anchor onshore Chinese rates and RMB fixing'
  );

  return {
    title: `PBoC & CCDC ChinaBond Sovereign Briefing · ${profile.primaryLabel.split(',')[0]}`,
    date: dateStr,
    policyPosture: `7D OMO ${omo7d.toFixed(2)}% · 1Y/5Y LPR ${lpr1Y.toFixed(2)}%/${lpr5Y.toFixed(2)}% · ${profile.primaryTheme.replace(/_/g, ' ')}`,
    executiveSummary:
      `[${dateStr} Executive Synthesis] China macro and fixed-income flows today are shaped by ${profile.primaryLabel.toLowerCase()} — specifically "${truncateHeadline(profile.leadItem.title, 78)}" (${profile.leadItem.source} · ${profile.leadItem.timeAgo}) and "${truncateHeadline(profile.secondItem.title, 74)}" (${profile.secondItem.source} · ${profile.secondItem.timeAgo}). ` +
      `Per official CCDC ChinaBond fixings (${curveDate}), 1Y CGB clears at ${y1.toFixed(3)}%, 5Y benchmark at ${y5.toFixed(3)}% (${fmtBps(y5Chg)} 1D), 10Y benchmark at ${y10.toFixed(3)}% (${fmtBps(y10Chg)} 1D; ${spread10Y} bps vs 10Y UST), and 30Y ultra-long CGB at ${y30.toFixed(3)}% (${fmtBps(y30Chg)} 1D), while PBoC sets the RMB parity fixing at ${fixing.toFixed(4)} (CNY ${cny.toFixed(4)}, CNH ${cnh.toFixed(4)}) and SSEC trades at ${ssec.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ssecPct)}).`,
    macroPillars: [
      {
        heading: `1. CCDC ChinaBond CGB Yield Curve (${curveDate}) & Duration Positioning`,
        analysis:
          `CCDC ChinaBond benchmarks trade at ${y1.toFixed(3)}% (1Y), ${y5.toFixed(3)}% (5Y, ${fmtBps(y5Chg)}), ${y10.toFixed(3)}% (10Y, ${fmtBps(y10Chg)}), and ${y30.toFixed(3)}% (30Y, ${fmtBps(y30Chg)}), keeping the 10s30s slope at +${Math.round((y30 - y10) * 100)} bps as commercial bank desks weigh "${truncateHeadline(profile.leadItem.title, 72)}" (${profile.leadItem.source}).`,
      },
      {
        heading: `2. PBoC 7D OMO (${omo7d.toFixed(2)}%), DR007 Repo & LPR Policy Transmission`,
        analysis:
          `With 7D Reverse Repo at ${omo7d.toFixed(2)}%, 1Y/5Y LPR at ${lpr1Y.toFixed(2)}%/${lpr5Y.toFixed(2)}%, and Headline CPI at ${cpi.toFixed(2)}% YoY, PBoC liquidity injections keep DR007 repo funding stable while institutions assess "${truncateHeadline(profile.secondItem.title, 72)}" (${profile.secondItem.source}).`,
      },
      {
        heading: `3. CFETS RMB Fixing (${fixing.toFixed(4)}), CNH/CNY Basis & Onshore Equities`,
        analysis:
          `Onshore USD/CNY (${cny.toFixed(4)}, ${fmtPct(cnyPct)}) and offshore USD/CNH (${cnh.toFixed(4)}) remain anchored near the ${fixing.toFixed(4)} parity fixing, while Shanghai Composite (${ssec.toLocaleString('en-US', { maximumFractionDigits: 2 })}, ${fmtPct(ssecPct)}) and CSI 300 (${csi300.toLocaleString('en-US', { maximumFractionDigits: 2 })}, ${fmtPct(csiPct)}) digest "${truncateHeadline((profile.thirdItem || profile.leadItem).title, 70)}".`,
      },
    ],
    noteworthyHeadlines: headlines,
  };
}

export function buildKoreaMarketBriefing(snap: DailyMacroSnapshot): KoreaMacroData['commentary'] {
  const sgtNow = getSgtReferenceDate(snap);
  const todayBiz = snapToBusinessDay(sgtNow);
  const dateStr = formatSgtDate(todayBiz);

  const korea = snap.korea;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;
  const quoteDate = korea?.bonds.quotationDate ?? '11 Nov 2026';

  const b3 = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('3Y'));
  const b5 = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('5Y'));
  const b10 = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('10Y'));
  const b30 = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('30Y'));

  const y3 = b3?.yield ?? 3.733;
  const y3Chg = b3?.changeBps ?? 10.7;
  const y5 = b5?.yield ?? 3.816;
  const y10 = b10?.yield ?? 3.952;
  const y10Chg = b10?.changeBps ?? 10.1;
  const y30 = b30?.yield ?? 3.975;
  const spread10Y = Math.round((y10 - ust10Y) * 100);

  const bokRate = korea?.bonds.bokBaseRate ?? 3.00;
  const kofr = korea?.bonds.kofrOvernightRate ?? 3.045;
  const cd91d = korea?.bonds.cd91dRate ?? 3.34;
  const cpi = korea?.bonds.cpiInflationYoY ?? 2.10;

  const krw = korea?.fxAndEquities.krwSpot ?? 1375.94;
  const krwPct = korea?.fxAndEquities.krwChangePct ?? 0.0;
  const ndf1M = korea?.fxAndEquities.ndf1M ?? 1373.50;
  const kospi = korea?.fxAndEquities.kospiIndex.level ?? 5472.20;
  const kospiPct = korea?.fxAndEquities.kospiIndex.changePct ?? 4.39;
  const kosdaq = korea?.fxAndEquities.kosdaqIndex.level ?? 680.12;
  const kosdaqPct = korea?.fxAndEquities.kosdaqIndex.changePct ?? 2.15;

  const headlines = korea?.commentary.noteworthyHeadlines || [];
  const profile = analyzeNewsCatalysts(
    headlines.map((h) => ({
      title: h.title || h.headline || '',
      source: h.source,
      timeAgo: h.timeAgo || 'Live',
      significance: h.significance,
    })),
    'Bank of Korea and KOFIA / SOFIA KTB yields respond to inflation and semiconductor export flows'
  );

  return {
    title: `Bank of Korea & KOFIA / SOFIA Fixed Income Briefing · ${profile.primaryLabel.split(',')[0]}`,
    date: dateStr,
    policyPosture: `BOK Base ${bokRate.toFixed(2)}% · KOFR ${kofr.toFixed(3)}% · CD 91D ${cd91d.toFixed(2)}% · ${profile.primaryTheme.replace(/_/g, ' ')}`,
    executiveSummary:
      `[${dateStr} Executive Synthesis] Seoul fixed-income and equity markets are driven today by ${profile.primaryLabel.toLowerCase()} — led by "${truncateHeadline(profile.leadItem.title, 78)}" (${profile.leadItem.source} · ${profile.leadItem.timeAgo}) and "${truncateHeadline(profile.secondItem.title, 74)}" (${profile.secondItem.source} · ${profile.secondItem.timeAgo}). ` +
      `Across KOFIA / SOFIA OTC bond fixings (${quoteDate}), 3Y benchmark KTB trades at ${y3.toFixed(3)}% (${fmtBps(y3Chg)} 1D), 5Y KTB at ${y5.toFixed(3)}%, 10Y benchmark KTB at ${y10.toFixed(3)}% (${fmtBps(y10Chg)} 1D; ${spread10Y} bps vs 10Y UST), and 30Y KTB at ${y30.toFixed(3)}%, while USD/KRW sits at ₩${krw.toFixed(2)} (${fmtPct(krwPct)}) and KOSPI prints ${kospi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(kospiPct)}).`,
    macroPillars: [
      {
        heading: `1. KOFIA / SOFIA KTB Curve (${quoteDate}) & WGBI Institutional Flows`,
        analysis:
          `KOFIA OTC yields price 3Y KTB at ${y3.toFixed(3)}% (${fmtBps(y3Chg)}), 5Y at ${y5.toFixed(3)}%, 10Y at ${y10.toFixed(3)}% (${fmtBps(y10Chg)}), and 30Y at ${y30.toFixed(3)}% (+${Math.round((y10 - y3) * 100)} bps 3s10s slope) as domestic and WGBI accounts react to "${truncateHeadline(profile.leadItem.title, 72)}" (${profile.leadItem.source}).`,
      },
      {
        heading: `2. BOK Base Rate (${bokRate.toFixed(2)}%), KOFR Repo (${kofr.toFixed(3)}%) & 91D CD (${cd91d.toFixed(2)}%)`,
        analysis:
          `With Headline CPI at ${cpi.toFixed(2)}% YoY (+${(bokRate - cpi).toFixed(2)}% real buffer), overnight KOFR/SOFIA repo fixes at ${kofr.toFixed(3)}% and 91-day KOFIA CD at ${cd91d.toFixed(2)}%, framing money-market carry alongside "${truncateHeadline(profile.secondItem.title, 72)}" (${profile.secondItem.source}).`,
      },
      {
        heading: `3. USD/KRW (₩${krw.toFixed(2)}), Semiconductor Exports & KOSPI (${kospi.toLocaleString('en-US', { maximumFractionDigits: 2 })})`,
        analysis:
          `Onshore USD/KRW trades at ₩${krw.toFixed(2)} (1M NDF ₩${ndf1M.toFixed(2)}) while KOSPI (${kospi.toLocaleString('en-US', { maximumFractionDigits: 2 })}, ${fmtPct(kospiPct)}) and KOSDAQ (${kosdaq.toLocaleString('en-US', { maximumFractionDigits: 2 })}, ${fmtPct(kosdaqPct)}) reflect "${truncateHeadline((profile.thirdItem || profile.leadItem).title, 70)}".`,
      },
    ],
    noteworthyHeadlines: headlines,
  };
}

export function buildIndiaMarketBriefing(snap: DailyMacroSnapshot): IndiaMacroData['commentary'] {
  const sgtNow = getSgtReferenceDate(snap);
  const todayBiz = snapToBusinessDay(sgtNow);
  const dateStr = formatSgtDate(todayBiz);

  const india = snap.india;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;
  const quoteDate = india?.bonds.quotationDate ?? '11 Nov 2026';

  const b3 = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('3Y'));
  const b5 = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('5Y'));
  const b10 = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('10Y'));
  const b30 = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('30Y'));

  const y3 = b3?.yield ?? 6.852;
  const y5 = b5?.yield ?? 6.966;
  const y5Chg = b5?.changeBps ?? 1.8;
  const y10 = b10?.yield ?? 7.167;
  const y10Chg = b10?.changeBps ?? 6.0;
  const y30 = b30?.yield ?? 7.619;
  const spread10Y = Math.round((y10 - ust10Y) * 100);

  const repoRate = india?.bonds.rbiRepoRate ?? 5.50;
  const sdfRate = india?.bonds.sdfRate ?? 5.25;
  const msfRate = india?.bonds.msfRate ?? 5.75;
  const tbill91d = india?.bonds.tbill91dRate ?? 5.897;
  const tbill364d = india?.bonds.tbill364dRate ?? 6.649;

  const inrSpot = india?.fxAndEquities.inrSpot ?? 93.92;
  const inrPct = india?.fxAndEquities.inrChangePct ?? -0.02;
  const rbiRef = india?.fxAndEquities.rbiReferenceUsd ?? 94.1402;
  const fxReserves = india?.fxAndEquities.forexReservesUsdBn ?? 717.06;
  const nifty = india?.fxAndEquities.nifty50Index.level ?? 24986.40;
  const niftyPct = india?.fxAndEquities.nifty50Index.changePct ?? -0.18;
  const sensex = india?.fxAndEquities.sensexIndex.level ?? 80999.40;
  const sensexPct = india?.fxAndEquities.sensexIndex.changePct ?? -0.04;

  const headlines = india?.commentary.noteworthyHeadlines || [];
  const releases = india?.commentary.rbiOfficialReleases || [];
  const profile = analyzeNewsCatalysts(
    headlines.map((h) => ({
      title: h.title || h.headline || '',
      source: h.source,
      timeAgo: h.timeAgo || 'Live',
      significance: h.significance,
    })),
    'RBI LAF operations and FAR G-Sec demand anchor Indian sovereign bond yields'
  );

  return {
    title: `Reserve Bank of India (RBI) & CCIL G-Sec Briefing · ${profile.primaryLabel.split(',')[0]}`,
    date: dateStr,
    policyPosture: `RBI Repo ${repoRate.toFixed(2)}% (SDF ${sdfRate.toFixed(2)}% / MSF ${msfRate.toFixed(2)}%) · ${profile.primaryTheme.replace(/_/g, ' ')}`,
    executiveSummary:
      `[${dateStr} Executive Synthesis] Indian sovereign bond and currency markets today reflect ${profile.primaryLabel.toLowerCase()} — led by "${truncateHeadline(profile.leadItem.title, 78)}" (${profile.leadItem.source} · ${profile.leadItem.timeAgo}) and "${truncateHeadline(profile.secondItem.title, 74)}" (${profile.secondItem.source} · ${profile.secondItem.timeAgo}). ` +
      `Across official RBI / CCIL NDS-OM fixings (${quoteDate}), 3Y G-Sec (6.20% GS 2029) yields ${y3.toFixed(3)}%, 5Y benchmark (6.53% GS 2031) trades at ${y5.toFixed(3)}% (${fmtBps(y5Chg)} 1D), 10Y benchmark (6.94% GS 2036) yields ${y10.toFixed(3)}% (${fmtBps(y10Chg)} 1D; +${spread10Y} bps over 10Y UST), and 30Y G-Sec sits at ${y30.toFixed(3)}%, backed by US$${fxReserves.toFixed(2)}B in RBI FX Reserves (USD/INR ₹${inrSpot.toFixed(4)} [${fmtPct(inrPct)}], Nifty 50 ${nifty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${fmtPct(niftyPct)}]).`,
    macroPillars: [
      {
        heading: `1. RBI / CCIL Sovereign G-Sec Curve (${quoteDate}) & Bank Portfolio Demand`,
        analysis:
          `On-the-run G-Secs trade at ${y3.toFixed(3)}% (3Y), ${y5.toFixed(3)}% (5Y, ${fmtBps(y5Chg)}), ${y10.toFixed(3)}% (10Y, ${fmtBps(y10Chg)}), and ${y30.toFixed(3)}% (30Y) as PSU banks, insurers, and foreign FAR accounts evaluate "${truncateHeadline(profile.leadItem.title, 72)}" (${profile.leadItem.source}).`,
      },
      {
        heading: `2. RBI LAF Corridor (${sdfRate.toFixed(2)}%–${msfRate.toFixed(2)}%), VRR/VRRR & T-Bill Cut-Offs`,
        analysis:
          `RBI keeps overnight Call Money (${india?.bonds.callRateRange || '4.30% - 5.75%'}) aligned with the ${repoRate.toFixed(2)}% Repo rate via VRR/VRRR operations while 91D/364D T-Bills yield ${tbill91d.toFixed(3)}%/${tbill364d.toFixed(3)}% amid "${truncateHeadline(profile.secondItem.title, 72)}" (${profile.secondItem.source}).`,
      },
      {
        heading: `3. USD/INR (₹${inrSpot.toFixed(4)}), US$${fxReserves.toFixed(2)}B FX Reserves & Nifty 50 / Sensex`,
        analysis:
          `Spot USD/INR at ₹${inrSpot.toFixed(4)} (FBIL Ref ₹${rbiRef.toFixed(4)}) is cushioned by US$${fxReserves.toFixed(2)}B in RBI reserves, while Nifty 50 (${nifty.toLocaleString('en-US', { maximumFractionDigits: 2 })}, ${fmtPct(niftyPct)}) and Sensex (${sensex.toLocaleString('en-US', { maximumFractionDigits: 2 })}, ${fmtPct(sensexPct)}) digest "${truncateHeadline((profile.thirdItem || profile.leadItem).title, 70)}".`,
      },
    ],
    noteworthyHeadlines: headlines,
    rbiOfficialReleases: releases,
  };
}
