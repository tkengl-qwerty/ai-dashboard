import { ArgonCommentary, DailyMacroSnapshot } from '../types/market';

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

/**
 * Finds the next occurrence of targetDow (0=Sun..6=Sat) on or after sgtBase
 * (or strictly after if includeToday is false).
 */
function getNextWeekdaySgt(sgtBase: Date, targetDow: number, includeToday = true): Date {
  const curDow = sgtBase.getUTCDay();
  let diff = (targetDow - curDow + 7) % 7;
  if (diff === 0 && !includeToday) {
    diff = 7;
  }
  return addSgtDays(sgtBase, diff);
}

/**
 * Finds the next occurrence of a specific day-of-month (e.g. 12th, 18th, 20th, 26th),
 * rolling to the next month if already past in the current month, and snapping weekends to business days.
 */
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

  const n1 = snap.globalMacro.topNews[0];
  const n2 = snap.globalMacro.topNews[1];
  const topHeadline =
    n1?.headline ||
    'Cross-asset positioning adjusts to US Treasury curve steepening and FOMC guidance';
  const topSource = n1?.source ? `${n1.source}${n1.timeAgo ? ` · ${n1.timeAgo}` : ''}` : 'Live Desk Feed';
  const secondHeadline =
    n2?.headline ||
    'Primary dealer duration supply and G10 FX rate differentials drive sovereign bond flows';
  const secondSource = n2?.source ? `${n2.source}${n2.timeAgo ? ` · ${n2.timeAgo}` : ''}` : 'Wire Feed';

  const isSteep = twoTen > 0;
  const regimeBadge = isSteep
    ? `UST 2s10s +${twoTen.toFixed(1)} BPS · 10Y ${y10.toFixed(2)}% (${fmtBps(y10Chg)})`
    : `INVERTED 2s10s (${twoTen.toFixed(1)} BPS) · 10Y ${y10.toFixed(2)}% (${fmtBps(y10Chg)})`;

  const rateDirectionLabel =
    y10Chg >= 3
      ? `Defensive Belly Duration (2Y–5Y ${y2.toFixed(2)}%–${y5.toFixed(2)}%) Amid +${y10Chg.toFixed(1)} bps 10Y Backup`
      : y10Chg <= -3
      ? `Extend Belly-to-10Y Duration (${y10.toFixed(2)}%, ${fmtBps(y10Chg)}) on Bull Flattening/Receiving`
      : `2Y–5Y Belly Carry (${y2.toFixed(2)}%–${y5.toFixed(2)}%) vs ${y30.toFixed(2)}% 30Y Supply`;

  const equityDirectionLabel =
    spxPct >= 0.15
      ? `Constructive SPX (${fmtPct(spxPct)}) Cyclical & Quality Tilt`
      : spxPct <= -0.15
      ? `Quality Cash-Flow Hedge as ES=F Trades ${fmtPct(spxPct)}`
      : `Balanced SPX (${spxPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}) Value/Quality Barbell`;

  const conviction = `${rateDirectionLabel} · ${equityDirectionLabel}`;

  const synthesis =
    `[${sessionDateStr} Session] US Treasury yields are pricing a ${twoTen >= 0 ? `+${twoTen.toFixed(1)} bps upward-sloping` : `${twoTen.toFixed(1)} bps inverted`} 2s10s curve with the 2Y at ${y2.toFixed(2)}% (${fmtBps(y2Chg)} 1D), ` +
    `5Y at ${y5.toFixed(2)}%, 10Y benchmark at ${y10.toFixed(2)}% (${fmtBps(y10Chg)} 1D), and 30Y long bond at ${y30.toFixed(2)}% (${fmtBps(y30Chg)} 1D; 5s10s at +${fiveTen.toFixed(1)} bps). ` +
    `Across cross-asset futures, S&P 500 E-minis trade at ${spxPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)}) and Nasdaq 100 at ${ndxPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ndxPct)}), ` +
    `while the US Dollar Index sits at ${dxyPrice.toFixed(2)} (${fmtPct(dxyPct)}), WTI Crude at $${wtiPrice.toFixed(2)}/bbl (${fmtPct(wtiPct)}), and Gold at $${goldPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz (${fmtPct(goldPct)}). ` +
    `Top desk catalysts: (1) "${topHeadline}" (${topSource}); and (2) "${secondHeadline}" (${secondSource}).`;

  const positioningTakeaway =
    `With 10Y UST at ${y10.toFixed(2)}% (${fmtBps(y10Chg)} today) and 2s10s at +${twoTen.toFixed(1)} bps, favor 2Y–5Y belly duration (${y2.toFixed(2)}%–${y5.toFixed(2)}%) over unhedged 30Y exposure (${y30.toFixed(2)}%). ` +
    `In equities and FX, watch ${(y10 + 0.15).toFixed(2)}% on US10Y and ${dxyPrice.toFixed(2)} on DXY (${fmtPct(dxyPct)}) as institutional desks digest "${truncateHeadline(topHeadline, 72)}".`;

  const criticalLevels = [
    {
      asset: 'US 10Y Treasury Yield',
      current: `${y10.toFixed(2)}%`,
      support: `${(y10 - 0.14).toFixed(2)}%`,
      resistance: `${(y10 + 0.16).toFixed(2)}%`,
      implication: `Break above ${(y10 + 0.16).toFixed(2)}% pressures equity multiples & EM FX; move below ${(y10 - 0.14).toFixed(2)}% fuels duration rally.`,
    },
    {
      asset: 'S&P 500 E-mini (ES=F)',
      current: spxPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      support: Math.round(spxPrice * 0.985).toLocaleString('en-US'),
      resistance: Math.round(spxPrice * 1.015).toLocaleString('en-US'),
      implication: `Holding above ${Math.round(spxPrice * 0.985).toLocaleString('en-US')} keeps institutional dip-buying intact across financials and AI capex leaders.`,
    },
    {
      asset: 'US Dollar Index (DXY)',
      current: dxyPrice.toFixed(2),
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
      watchFor: `Core services stickiness vs energy ($${wtiPrice.toFixed(2)}/bbl WTI) and whether US 2Y (${y2.toFixed(2)}%) breaks ${(y2 + 0.12).toFixed(2)}% following "${truncateHeadline(topHeadline, 85)}".`,
    },
    {
      event: 'US Treasury 10Y / 30Y Refunding Auction Settlement & Primary Dealer Takedown',
      timing: `${formatSgtDate(todayBiz)} · 13:00 ET (02:00 SGT +1)`,
      impact: 'High' as const,
      watchFor: `Foreign indirect bid-to-cover and auction tail; a >2 bps tail tests 30Y resistance near ${(y30 + 0.12).toFixed(2)}% (2s10s at +${twoTen.toFixed(1)} bps) amid "${truncateHeadline(secondHeadline, 80)}".`,
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

  const bonds = snap.indonesia.bonds;
  const fx = snap.indonesia.fxAndNdf;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  const biRate = bonds.biRate ?? 5.75;
  const cpi = bonds.cpiInflationYoY ?? 3.28;
  const b5 = bonds.indoGB.find((b) => b.tenor.startsWith('5Y'));
  const b10 = bonds.indoGB.find((b) => b.tenor.startsWith('10Y'));
  const indo5Y = b5?.yield ?? 7.35;
  const indo5YChg = b5?.changeBps ?? 0.0;
  const indo10Y = b10?.yield ?? 7.69;
  const indo10YChg = b10?.changeBps ?? 0.0;
  const spread10Y = Math.round((indo10Y - ust10Y) * 100);

  const srbi6M = bonds.srbi.find((s) => s.tenor === '6M')?.weightedAvgYield ?? 6.566;
  const srbi9M = bonds.srbi.find((s) => s.tenor === '9M')?.weightedAvgYield ?? 6.655;
  const srbi12M = bonds.srbi.find((s) => s.tenor === '12M')?.weightedAvgYield ?? 6.675;
  const srbiDate = bonds.srbi.find((s) => s.tenor === '12M')?.auctionDate ?? '06 Nov 2026';
  const srbi12MBids = bonds.srbi.find((s) => s.tenor === '12M')?.nominalBidsIDR ?? 'IDR 19.20 T';
  const srbi12MAwarded = bonds.srbi.find((s) => s.tenor === '12M')?.awardedVolumeIDR ?? 'IDR 3.00 T';

  const spot = fx.spotRate ?? 18080;
  const spotChg = fx.spotChange ?? 0;
  const spotPct = fx.spotChangePct ?? 0.0;
  const jisdor = fx.jisdorRate ?? 18130;
  const jisdorChg = fx.jisdorChange ?? 0;
  const ndf1M = fx.ndf1M ?? 18116;
  const ndfSpread = fx.ndfSpread1M ?? 36;
  const ihsg = fx.ihsgIndex.level ?? 5050.43;
  const ihsgPct = fx.ihsgIndex.changePct ?? 0.40;

  const realPolicyBuffer = (biRate - cpi).toFixed(2);
  const h1 = snap.indonesia.commentary.noteworthyHeadlines[0];
  const h2 = snap.indonesia.commentary.noteworthyHeadlines[1];
  const leadIndoNews =
    h1?.title ||
    h1?.headline ||
    'Bank Indonesia reports US$146.8B FX reserves and prepares 100% Rupiah conversion for resource export earnings';
  const leadIndoMeta = h1?.source ? `${h1.source}${h1.timeAgo ? ` · ${h1.timeAgo}` : ''}` : 'Jakarta Desk';
  const secondIndoNews =
    h2?.title ||
    h2?.headline ||
    'KSSK and Ministry of Finance anchor SBN issuance discipline and onshore Rupiah liquidity';
  const secondIndoMeta = h2?.source ? `${h2.source}${h2.timeAgo ? ` · ${h2.timeAgo}` : ''}` : 'Onshore Feed';

  const regimeBadge = `BI-RATE ${biRate.toFixed(2)}% · REAL BUFFER +${realPolicyBuffer}% · SPREAD +${spread10Y} BPS`;

  const fxRegimeNote =
    spot >= 18100 || spotChg > 25
      ? `Onshore USD/IDR trades at Rp ${spot.toLocaleString('en-US')} (${spotChg >= 0 ? `+${spotChg}` : spotChg} IDR / ${fmtPct(spotPct)} 1D) alongside BI JISDOR at Rp ${jisdor.toLocaleString('en-US')} (${jisdorChg >= 0 ? `+${jisdorChg}` : jisdorChg} IDR) and 1M NDF at Rp ${ndf1M.toLocaleString('en-US')} (+${ndfSpread} IDR basis), keeping Bank Indonesia active across spot, DNDF, and secondary SBN triple-intervention`
      : `Onshore USD/IDR spot trades at Rp ${spot.toLocaleString('en-US')} (${fmtPct(spotPct)} 1D) with BI JISDOR at Rp ${jisdor.toLocaleString('en-US')} and 1M NDFs at Rp ${ndf1M.toLocaleString('en-US')} (+${ndfSpread} IDR basis)`;

  const conviction =
    spot >= 18150 || indo10YChg >= 3.0
      ? `Defensive 12M SRBI (${srbi12M.toFixed(3)}%) & 5Y FR0109 (${indo5Y.toFixed(2)}%) Carry · NDF-Hedged Duration (USD/IDR ${spot.toLocaleString('en-US')})`
      : `Overweight 5Y–10Y IndoGB (${indo5Y.toFixed(2)}%–${indo10Y.toFixed(2)}%, +${spread10Y} bps vs UST) & 12M SRBI (${srbi12M.toFixed(3)}%)`;

  const synthesis =
    `[${sessionDateStr} Jakarta Desk] Indonesia's sovereign curve prices 10Y benchmark FR0108 at ${indo10Y.toFixed(2)}% (${fmtBps(indo10YChg)} 1D; +${spread10Y} bps over US 10Y at ${ust10Y.toFixed(2)}%) ` +
    `and 5Y benchmark FR0109 at ${indo5Y.toFixed(2)}% (${fmtBps(indo5YChg)} 1D), backed by a +${realPolicyBuffer}% real policy buffer (BI-Rate ${biRate.toFixed(2)}% vs Headline CPI ${cpi.toFixed(2)}% YoY) and 12M SRBI clearing at ${srbi12M.toFixed(3)}% WAR (${srbiDate} tender: IDR 7.50 T awarded from IDR 36.90 T total bids). ` +
    `${fxRegimeNote}, while the IDX Composite (IHSG) trades at ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ihsgPct)}). ` +
    `Key Indonesia catalysts: (1) "${leadIndoNews}" (${leadIndoMeta}); and (2) "${secondIndoNews}" (${secondIndoMeta}).`;

  const positioningTakeaway =
    `As of ${sessionDateStr}, with 10Y FR0108 at ${indo10Y.toFixed(2)}% (${fmtBps(indo10YChg)} 1D) and USD/IDR at Rp ${spot.toLocaleString('en-US')} (1M NDF spread +${ndfSpread} IDR), ` +
    `pair front-end 12M SRBI (${srbi12M.toFixed(3)}% WAR) with 5Y–10Y DJPPR benchmarks (${indo5Y.toFixed(2)}%–${indo10Y.toFixed(2)}%) on dips while hedging offshore USD tail risk ahead of the ${formatSgtDate(nextSrbiFri)} SRBI tender and "${truncateHeadline(leadIndoNews, 68)}".`;

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
      current: ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
      watchFor: `Following the ${srbiDate} SRBI issuance (IDR 7.50 T awarded from IDR 36.90 T bids; 12M WAR at ${srbi12M.toFixed(3)}%), watch bid-to-cover and 12M WAR clearing level amid "${truncateHeadline(leadIndoNews, 80)}".`,
    },
    {
      event: 'DJPPR Conventional SUN (IndoGB) Primary Debt Auction (FR0109 / FR0108 / FR0106)',
      timing: `${formatSgtDate(nextDjpprTue)} · 10:00–12:00 WIB (11:00–13:00 SGT)`,
      impact: 'High' as const,
      watchFor: `Primary dealer and foreign institutional bids on 5Y FR0109 (${indo5Y.toFixed(2)}%) and 10Y FR0108 (${indo10Y.toFixed(2)}%) following "${truncateHeadline(secondIndoNews, 80)}".`,
    },
    {
      event: 'Bank Indonesia Board of Governors (RDG) Rate Decision & JISDOR / DHE FX Review',
      timing: `${formatSgtDate(biRdgDate)} · 14:20 WIB (15:20 SGT)`,
      impact: 'High' as const,
      watchFor: `BI-Rate policy decision (${biRate.toFixed(2)}%), 100% DHE export retention conversion flows, and 1M NDF spread (+${ndfSpread} IDR) over spot (${spot.toLocaleString('en-US')}).`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · INDONESIA SOVEREIGN, FX & MONETARY SYNTHESIS',
    regimeBadge,
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

  const h1 = china?.commentary.noteworthyHeadlines[0];
  const h2 = china?.commentary.noteworthyHeadlines[1];
  const leadHeadline =
    h1?.title ||
    h1?.headline ||
    'PBoC maintains accommodative liquidity operations as CCDC 10Y ChinaBond CGB yield trades near 1.587%';
  const leadMeta = h1?.source ? `${h1.source}${h1.timeAgo ? ` · ${h1.timeAgo}` : ''}` : 'Beijing Desk';
  const secondHeadline =
    h2?.title ||
    h2?.headline ||
    'Ministry of Finance special sovereign bond issuance and Northbound Bond Connect allocations shape CGB curve';
  const secondMeta = h2?.source ? `${h2.source}${h2.timeAgo ? ` · ${h2.timeAgo}` : ''}` : 'Wire Feed';

  const regimeBadge = `7D OMO ${omo7d.toFixed(2)}% · CCDC 10Y ${cgb10Y.toFixed(3)}% (${fmtBps(cgb10YChg)}) · US-CN ${spread10Y} BPS`;

  const conviction =
    ssecPct >= 0.5
      ? `Barbell 3Y–5Y CCDC CGB (${cgb5Y.toFixed(3)}%) + Domestic A-Share Momentum (SSEC ${fmtPct(ssecPct)}) · FX-Hedged`
      : `Receive 3Y–5Y CCDC CGB Belly (${cgb5Y.toFixed(3)}%, ${fmtBps(cgb5YChg)}) · FX-Hedged Carry vs SSEC (${fmtPct(ssecPct)})`;

  const synthesis =
    `[${sessionDateStr} Beijing/Shanghai Desk] Official CCDC ChinaBond CGB fixings (${curveDate}) price 1Y CGB at ${cgb1Y.toFixed(3)}%, ` +
    `5Y benchmark at ${cgb5Y.toFixed(3)}% (${fmtBps(cgb5YChg)} 1D), 10Y benchmark at ${cgb10Y.toFixed(3)}% (${fmtBps(cgb10YChg)} 1D), and 30Y ultra-long CGB at ${cgb30Y.toFixed(3)}% (${fmtBps(cgb30YChg)} 1D; 10s30s slope +${slope10s30s} bps, ${spread10Y} bps vs 10Y UST). ` +
    `With PBoC 7D Reverse Repo at ${omo7d.toFixed(2)}% and 1Y/5Y LPR at ${lpr1Y.toFixed(2)}%/${lpr5Y.toFixed(2)}% (Headline CPI ${cpi.toFixed(2)}% YoY), onshore USD/CNY trades at ${cny.toFixed(4)} (${fmtPct(cnyPct)}) and offshore USD/CNH at ${cnh.toFixed(4)} around the ${fixing.toFixed(4)} PBoC parity fixing, while Shanghai Composite sits at ${ssec.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ssecPct)}) and CSI 300 at ${csi300.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(csiPct)}). ` +
    `Top China catalysts: (1) "${leadHeadline}" (${leadMeta}); and (2) "${secondHeadline}" (${secondMeta}).`;

  const positioningTakeaway =
    `As of ${sessionDateStr}, express constructive China rates positioning via 3Y–5Y CCDC CGB benchmarks (${cgb5Y.toFixed(3)}%, ${fmtBps(cgb5YChg)} 1D) where DR007 repo funding carry remains positive, ` +
    `while taking profits on 10Y CGB (${cgb10Y.toFixed(3)}%) approaches toward 1.500% and monitoring "${truncateHeadline(leadHeadline, 70)}" for PBoC fixing (${fixing.toFixed(4)}) and CSI 300 (${fmtPct(csiPct)}) spillover.`;

  const criticalLevels = [
    {
      asset: 'CCDC 10Y ChinaBond CGB',
      current: `${cgb10Y.toFixed(3)}%`,
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
      current: ssec.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
      watchFor: `Net liquidity injection via 7D OMO (${omo7d.toFixed(2)}%) and whether DR007 repo stays anchored below 1.70% as CCDC publishes CGB yields amid "${truncateHeadline(leadHeadline, 80)}".`,
    },
    {
      event: 'Ministry of Finance (MoF) 30-Year Ultra-Long Special CGB Issuance Tender',
      timing: `${formatSgtDate(nextWed)} · 10:35 CST (SGT)`,
      impact: 'High' as const,
      watchFor: `Primary auction bid-to-cover on 10Y (${cgb10Y.toFixed(3)}%) and 30Y (${cgb30Y.toFixed(3)}%) CGBs following "${truncateHeadline(secondHeadline, 80)}".`,
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

  const h1 = korea?.commentary.noteworthyHeadlines[0];
  const h2 = korea?.commentary.noteworthyHeadlines[1];
  const leadHeadline =
    h1?.title ||
    h1?.headline ||
    'KOFIA / SOFIA Korea Treasury Bond yields rally as foreign WGBI inflows support 3Y and 10Y KTB benchmarks';
  const leadMeta = h1?.source ? `${h1.source}${h1.timeAgo ? ` · ${h1.timeAgo}` : ''}` : 'Seoul Desk';
  const secondHeadline =
    h2?.title ||
    h2?.headline ||
    'Bank of Korea monitors USD/KRW FX stability and semiconductor export momentum';
  const secondMeta = h2?.source ? `${h2.source}${h2.timeAgo ? ` · ${h2.timeAgo}` : ''}` : 'Seoul Feed';

  const regimeBadge = `BOK BASE ${bokRate.toFixed(2)}% · KOFR/SOFIA ${kofr.toFixed(3)}% · 10Y KTB ${ktb10Y.toFixed(3)}% (${fmtBps(ktb10YChg)})`;

  const conviction =
    kospiPct >= 1.0
      ? `Long Semiconductor Equity Recovery (KOSPI ${fmtPct(kospiPct)}) & 3Y–10Y KTB (${ktb3Y.toFixed(3)}%/${ktb10Y.toFixed(3)}%) WGBI Carry`
      : `Overweight 3Y–10Y KOFIA KTB (${ktb3Y.toFixed(3)}%/${ktb10Y.toFixed(3)}%, ${fmtBps(ktb10YChg)}) on Safe-Haven & WGBI Inflows · Watch ₩${Math.round(krw + 20)}`;

  const synthesis =
    `[${sessionDateStr} Seoul Desk] Korea Financial Investment Association (KOFIA / SOFIA) OTC bond fixings (${quoteDate}) place 3Y KTB at ${ktb3Y.toFixed(3)}% (${fmtBps(ktb3YChg)} 1D), ` +
    `5Y KTB at ${ktb5Y.toFixed(3)}%, 10Y KTB at ${ktb10Y.toFixed(3)}% (${fmtBps(ktb10YChg)} 1D; 3s10s slope +${slope3s10s} bps, ${spread10Y} bps vs 10Y UST), and 30Y KTB at ${ktb30Y.toFixed(3)}%. ` +
    `With the BOK Base Rate at ${bokRate.toFixed(2)}% (CPI ${cpi.toFixed(2)}% YoY, real buffer +${(bokRate - cpi).toFixed(2)}%), SOFIA/KOFR overnight repo fixes at ${kofr.toFixed(3)}% and 91D CD at ${cd91d.toFixed(2)}%. ` +
    `In Seoul FX and equities, USD/KRW trades at ₩${krw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(krwPct)}; 1M NDF ₩${ndf1M.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}), while KOSPI is at ${kospi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(kospiPct)}) and KOSDAQ at ${kosdaq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(kosdaqPct)}). ` +
    `Key Korea catalysts: (1) "${leadHeadline}" (${leadMeta}); and (2) "${secondHeadline}" (${secondMeta}).`;

  const positioningTakeaway =
    `As of ${sessionDateStr}, accumulate 3Y (${ktb3Y.toFixed(3)}%, ${fmtBps(ktb3YChg)}) and 10Y (${ktb10Y.toFixed(3)}%, ${fmtBps(ktb10YChg)}) KTB benchmarks as FTSE WGBI passive inflows and anchored KOFR repo funding (${kofr.toFixed(3)}%) support duration, ` +
    `while tracking KOSPI (${fmtPct(kospiPct)}) and USD/KRW (₩${krw.toFixed(2)}) reaction to "${truncateHeadline(leadHeadline, 70)}".`;

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
      current: kospi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
      watchFor: `Foreign institutional net buying in 3Y (${ktb3Y.toFixed(3)}%) and 10Y (${ktb10Y.toFixed(3)}%) KTB futures following "${truncateHeadline(leadHeadline, 80)}".`,
    },
    {
      event: 'MOEF 10-Year Korea Treasury Bond (KTB) Competitive Primary Auction & WGBI Flows',
      timing: `${formatSgtDate(nextMon)} · 10:40 KST (09:40 SGT)`,
      impact: 'High' as const,
      watchFor: `Competitive auction takedown on 10Y (${ktb10Y.toFixed(3)}%) and 30Y (${ktb30Y.toFixed(3)}%) KTB supply and Euroclear/Clearstream inflows amid "${truncateHeadline(secondHeadline, 75)}".`,
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

  const h1 = india?.commentary.noteworthyHeadlines[0];
  const h2 = india?.commentary.noteworthyHeadlines[1];
  const leadHeadline =
    h1?.title ||
    h1?.headline ||
    'RBI conducts LAF Variable Rate Repo operations as 10Y G-Sec benchmark 6.94% GS 2036 trades near 7.162%';
  const leadMeta = h1?.source ? `${h1.source}${h1.timeAgo ? ` · ${h1.timeAgo}` : ''}` : 'Mumbai Desk';
  const secondHeadline =
    h2?.title ||
    h2?.headline ||
    'Foreign FAR index inflows and RBI FX reserves support Indian sovereign bond curve stability';
  const secondMeta = h2?.source ? `${h2.source}${h2.timeAgo ? ` · ${h2.timeAgo}` : ''}` : 'Mumbai Feed';

  const regimeBadge = `RBI REPO ${repoRate.toFixed(2)}% · 10Y G-SEC ${gsec10Y.toFixed(3)}% (${fmtBps(gsec10YChg)}) · SPREAD +${spread10Y} BPS`;

  const conviction = `Long 5Y–10Y FAR G-Secs (${gsec5Y.toFixed(3)}% / ${gsec10Y.toFixed(3)}%, +${spread10Y} bps vs UST) · USD/INR ₹${inrSpot.toFixed(2)} (${fmtPct(inrPct)}) Backed by $${fxReserves.toFixed(0)}B Reserves`;

  const synthesis =
    `[${sessionDateStr} Mumbai Desk] Reserve Bank of India (RBI) and CCIL/NDS-OM sovereign fixings (${quoteDate}) place 3Y G-Sec (6.20% GS 2029) at ${gsec3Y.toFixed(3)}%, ` +
    `5Y benchmark (6.53% GS 2031) at ${gsec5Y.toFixed(3)}% (${fmtBps(gsec5YChg)} 1D), 10Y benchmark (6.94% GS 2036) at ${gsec10Y.toFixed(3)}% (${fmtBps(gsec10YChg)} 1D; +${spread10Y} bps over 10Y UST, 5s10s +${slope5s10s} bps), and 30Y G-Sec at ${gsec30Y.toFixed(3)}%. ` +
    `With the RBI Policy Repo Rate anchored at ${repoRate.toFixed(2)}% (SDF ${sdfRate.toFixed(2)}% / MSF ${msfRate.toFixed(2)}%; 91D/364D T-Bills at ${tbill91d.toFixed(3)}%/${tbill364d.toFixed(3)}%) and US$${fxReserves.toFixed(2)}B in FX Reserves, ` +
    `spot USD/INR trades at ₹${inrSpot.toFixed(4)} (${fmtPct(inrPct)} 1D; FBIL Ref ₹${rbiRef.toFixed(4)}), while Nifty 50 sits at ${nifty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(niftyPct)}) and Sensex at ${sensex.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(sensexPct)}). ` +
    `Key India catalysts: (1) "${leadHeadline}" (${leadMeta}); and (2) "${secondHeadline}" (${secondMeta}).`;

  const positioningTakeaway =
    `As of ${sessionDateStr}, overweight Fully Accessible Route (FAR) 5Y–10Y Indian G-Secs (${gsec5Y.toFixed(3)}%–${gsec10Y.toFixed(3)}%, ${fmtBps(gsec10YChg)} 1D) for +${spread10Y} bps carry over USTs and RBI reserve-backed INR stability (₹${inrSpot.toFixed(2)}); ` +
    `watch RBI VRR/VRRR LAF operations (${india?.bonds.callRateRange || '4.30% - 5.75%'}) and domestic bank/equity flows amid "${truncateHeadline(leadHeadline, 70)}".`;

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
      current: `${nifty.toLocaleString('en-US', { maximumFractionDigits: 0 })} / ${sensex.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
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
      watchFor: `Food-price trajectory relative to RBI's 4.0% (±2%) target band (currently ${cpi.toFixed(2)}% YoY) and call money alignment with ${repoRate.toFixed(2)}% Repo amid "${truncateHeadline(leadHeadline, 78)}".`,
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
      watchFor: `MPC forward guidance on the ${repoRate.toFixed(2)}% Repo rate, FAR G-Sec foreign inflows, and USD/INR stability following "${truncateHeadline(secondHeadline, 75)}".`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · INDIA SOVEREIGN (RBI / CCIL G-SEC), LAF & INR SYNTHESIS',
    regimeBadge,
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

  const h1 = eq?.noteworthyHeadlines[0];
  const h2 = eq?.noteworthyHeadlines[1];
  const leadHeadline =
    h1?.title ||
    h1?.headline ||
    'S&P 500 factor dispersion widens as 10Y Treasury yields reward high FCF/EV and low Forward P/E constituents';
  const leadMeta = h1?.source ? `${h1.source}${h1.timeAgo ? ` · ${h1.timeAgo}` : ''}` : 'NY Equity Desk';
  const secondHeadline =
    h2?.title ||
    h2?.headline ||
    'Corporate share buyback authorizations and NTM EPS revisions support S&P 500 value and cash-flow leaders';
  const secondMeta = h2?.source ? `${h2.source}${h2.timeAgo ? ` · ${h2.timeAgo}` : ''}` : 'US Markets Feed';

  const regimeBadge = `S&P 500 ${spx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)}) · FWD P/E ${spxFwdPe.toFixed(1)}x · ERP ${erpBps >= 0 ? `+${erpBps}` : erpBps} BPS`;

  const conviction = `Overweight Top FCF/EV (${fcfLeader?.ticker || 'APA'} ${(fcfLeader?.fcfToEvPct ?? 12.7).toFixed(1)}%, ${fcfSecond?.ticker || 'DVN'} ${(fcfSecond?.fcfToEvPct ?? 11.8).toFixed(1)}%) & Low Fwd P/E (${peLeader?.ticker || 'GM'} ${(peLeader?.forwardPe ?? 6.7).toFixed(1)}x) vs ${spxFwdPe.toFixed(1)}x Index`;

  const synthesis =
    `[${sessionDateStr} NY Equity Desk] With the S&P 500 at ${spx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(spxPct)} 1D) on a ${spxFwdPe.toFixed(1)}x consensus NTM Forward P/E ` +
    `(implied Forward Earnings Yield of ${spxEy.toFixed(2)}% vs the ${ust10Y.toFixed(2)}% 10Y US Treasury yield [${fmtBps(ust10YChg)} 1D], placing the Equity Risk Premium at ${erpBps >= 0 ? `+${erpBps}` : erpBps} bps), ` +
    `cross-sectional valuation dispersion strongly favors cash-generative value constituents. ` +
    `Today's live screen is led in Forward P/E by ${peLeader?.ticker || 'GM'} ($${(peLeader?.price ?? 86.16).toFixed(2)}, ${fmtPct(peLeader?.changePct)}, ${(peLeader?.forwardPe ?? 6.73).toFixed(2)}x Fwd P/E / ${(peLeader?.earningsYieldPct ?? 14.86).toFixed(1)}% E/P) and ${peSecond?.ticker || 'SYF'} (${(peSecond?.forwardPe ?? 7.45).toFixed(2)}x), ` +
    `in Enterprise Cash Return by ${fcfLeader?.ticker || 'APA'} (${(fcfLeader?.fcfToEvPct ?? 12.69).toFixed(2)}% FCF/EV) and ${fcfSecond?.ticker || 'DVN'} (${(fcfSecond?.fcfToEvPct ?? 11.75).toFixed(2)}% FCF/EV), ` +
    `and in FCF-covered Dividend Yield by ${divLeader?.ticker || 'PFG'} (${(divLeader?.dividendYieldPct ?? 6.15).toFixed(2)}% Div/Price). ` +
    `Key US equity catalysts: (1) "${leadHeadline}" (${leadMeta}); and (2) "${secondHeadline}" (${secondMeta}).`;

  const positioningTakeaway =
    `As of ${sessionDateStr}, with 10Y UST at ${ust10Y.toFixed(2)}% (${fmtBps(ust10YChg)} 1D) and cap-weighted S&P 500 ERP at ${erpBps >= 0 ? `+${erpBps}` : erpBps} bps, rotate marginal equity exposure toward the Top 10 FCF/EV (${(fcfLeader?.fcfToEvPct ?? 12.7).toFixed(1)}% lead cash yield) ` +
    `and Top 10 Forward P/E (${(peLeader?.forwardPe ?? 6.7).toFixed(2)}x lead NTM multiple) baskets—capturing +450 to +900 bps of cash-flow carry over Treasuries amid "${truncateHeadline(leadHeadline, 68)}".`;

  const criticalLevels = [
    {
      asset: 'S&P 500 Cash Index (^GSPC)',
      current: spx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
      watchFor: `Any move in 10Y UST above ${(ust10Y + 0.15).toFixed(2)}% accelerating institutional rotation into Top 10 FCF/EV (${fcfLeader?.ticker || 'APA'}) and Forward P/E (${peLeader?.ticker || 'GM'}) amid "${truncateHeadline(leadHeadline, 75)}".`,
    },
    {
      event: 'S&P 500 FactSet Weekly NTM Consensus EPS Revision Cut-Off & Margin Update',
      timing: `${formatSgtDate(nextFri)} · 16:00 ET (Sat 05:00 SGT)`,
      impact: 'High' as const,
      watchFor: `Operating margin resilience and forward NTM EPS revisions across Value vs Mega-Cap Technology following "${truncateHeadline(secondHeadline, 75)}".`,
    },
    {
      event: 'S&P 500 Monthly Options Expiration (OpEx), Buyback Execution & Ex-Dividend Date',
      timing: `${formatSgtDate(opexFri)} · 09:30–16:00 ET (NY Cash Close)`,
      impact: 'High' as const,
      watchFor: `Authorized share repurchase execution among Top 10 FCF/EV constituents and institutional dividend capture in ${divLeader?.ticker || 'PFG'} (${(divLeader?.dividendYieldPct ?? 6.15).toFixed(2)}% Div/Price).`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · US EQUITIES (S&P 500) VALUATION, ERP & FACTOR SYNTHESIS',
    regimeBadge,
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
  const indo10Y = bonds.indoGB.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 7.55;
  const srbi12M =
    bonds.srbi.find((s) => s.tenor === '12M')?.weightedAvgYield ??
    bonds.srbi.find((s) => s.tenor === '12M')?.cutOffYield ??
    6.675;

  const imp1 = loc?.topImportant?.[0];
  const imp2 = loc?.topImportant?.[1];
  const imp3 = loc?.topImportant?.[2];
  const read1 = loc?.topRead?.[0];
  const read2 = loc?.topRead?.[1];

  const leadImp =
    imp1?.titleEn ||
    'IDX (BEI) Releases List of 383 HSC Shares Excluded from IHSG Ahead of MSCI Review';
  const leadImpMeta = imp1 ? `${imp1.source} · ${imp1.timeAgo}` : 'Onshore Feed';
  const secondImp =
    imp2?.titleEn ||
    'MSCI November 2026 Rebalancing Reshapes Foreign Index Weights Across IDX Constituents';
  const thirdImp =
    imp3?.titleEn ||
    'Executive and Parliamentary Policy Coordination Anchors Fiscal and Financial Stability';

  const leadRead =
    read1?.titleEn ||
    'IHSG (JCI) Consolidates as Foreign Institutional Investors Accumulate 10 Liquid Blue-Chip Shares';
  const leadReadMeta = read1 ? `${read1.source} · ${read1.timeAgo}` : 'Terpopuler Feed';
  const secondRead =
    read2?.titleEn ||
    'Domestic Political, Regulatory & Industrial Developments Dominate Onshore Readership';

  const leadImpImpact =
    imp1?.marketSignificance ||
    `Shapes institutional positioning across IHSG (${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) and 10Y FR0108 (${indo10Y.toFixed(2)}%).`;

  const conviction = `Focus on #1 Macro Catalyst (${imp1?.category || 'Capital Markets'}) & Liquid LQ45 · Fade Headline Noise via 10Y FR0108 (${indo10Y.toFixed(2)}%) & 12M SRBI (${srbi12M.toFixed(3)}%)`;

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · INDONESIA LOCAL-LANGUAGE MEDIA (ID→EN) & POLITICAL-ECONOMIC SYNTHESIS',
    regimeBadge: `10 BAHASA PORTALS TRANSLATED · USD/IDR Rp ${spot.toLocaleString('en-US')} · IHSG ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    updatedAtSGT,
    conviction,
    synthesis:
      `[${sessionDateStr} Onshore ID→EN Media Synthesis] Live Bahasa Indonesia aggregation and English translation across 10 onshore portals ` +
      `is led on the Top 10 Most Important board by #1 "${leadImp}" (${leadImpMeta}), #2 "${secondImp}" (${imp2?.source || 'ID Portal'}), and #3 "${thirdImp}" (${imp3?.source || 'ID Portal'}). ` +
      `Simultaneously, the Top 10 Most Read (Terpopuler) national board is topped by #1 "${leadRead}" (${leadReadMeta}) and #2 "${secondRead}" (${read2?.source || 'ID Portal'}). ` +
      `Across onshore Jakarta markets, USD/IDR trades at Rp ${spot.toLocaleString('en-US')} (${fmtPct(spotPct)} 1D; JISDOR Rp ${jisdor.toLocaleString('en-US')}), IHSG sits at ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ihsgPct)}), and 10Y FR0108 IndoGB yields ${indo10Y.toFixed(2)}% (12M SRBI ${srbi12M.toFixed(3)}% WAR).`,
    positioningTakeaway:
      `As of ${sessionDateStr}, separate high-velocity domestic readership ("${truncateHeadline(leadRead, 62)}") from institutional market drivers led by "${truncateHeadline(leadImp, 68)}". ` +
      `Desk impact: ${leadImpImpact}`,
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
        watchFor: `Passive and active institutional rotation into liquid LQ45 constituents following "${truncateHeadline(leadImp, 78)}".`,
      },
      {
        event: 'DPR RI Parliamentary Working Meetings & Executive Fiscal / Governance Updates',
        timing: `${formatSgtDate(todayBiz)} · 13:30 WIB (14:30 SGT)`,
        impact: 'High',
        watchFor: `Onshore market reaction to "${truncateHeadline(leadRead, 75)}" and APBN budget efficiency directives.`,
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
