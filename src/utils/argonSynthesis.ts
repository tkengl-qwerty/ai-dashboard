import { ArgonCommentary, DailyMacroSnapshot } from '../types/market';

export function buildGlobalArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const yc = snap.globalMacro.yieldCurve;
  const y2 = yc.tenors.find((t) => t.label === '2Y')?.yield ?? 4.47;
  const y5 = yc.tenors.find((t) => t.label === '5Y')?.yield ?? 4.61;
  const y10 = yc.tenors.find((t) => t.label === '10Y')?.yield ?? 4.84;
  const y30 = yc.tenors.find((t) => t.label === '30Y')?.yield ?? 5.26;
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
  const dxyPrice = dxy?.price ?? 98.81;
  const wtiPrice = wti?.price ?? 86.65;
  const goldPrice = gold?.price ?? 4651.5;
  const jpyRate = jpy?.rate ?? 158.95;

  const topHeadline = snap.globalMacro.topNews[0]?.headline || 'Cross-asset positioning adjusts to US Treasury curve steepening and FOMC guidance';

  const isSteep = twoTen > 0;
  const regimeBadge = isSteep
    ? `BEAR/BULL STEEPENING (+${twoTen.toFixed(1)} bps 2s10s)`
    : `INVERTED CURVE (${twoTen.toFixed(1)} bps 2s10s)`;

  const conviction =
    spxPct >= 0
      ? 'Constructive Cyclicals · Short-Duration Fixed Income Tilt'
      : 'Defensive Quality · Curve Steepener Bias';

  const synthesis =
    `Global macro price action is anchored by an upward-sloping US Treasury curve where the 2Y sits at ${y2.toFixed(2)}%, ` +
    `5Y at ${y5.toFixed(2)}%, 10Y at ${y10.toFixed(2)}%, and 30Y at ${y30.toFixed(2)}% (2Y/10Y at +${twoTen.toFixed(1)} bps; 5Y/10Y at +${fiveTen.toFixed(1)} bps). ` +
    `With the US Dollar Index (DXY) trading near ${dxyPrice.toFixed(2)} and WTI Crude at $${wtiPrice.toFixed(2)}/bbl, headline energy-driven inflation risk remains contained, ` +
    `allowing S&P 500 E-mini futures (${spxPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ${spxPct >= 0 ? '+' : ''}${spxPct.toFixed(2)}%) ` +
    `and Gold ($${goldPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz) to absorb elevated long-end term premia. ` +
    `Lead desk catalyst: "${topHeadline}".`;

  const positioningTakeaway =
    `Favor 2Y–5Y belly duration (${y2.toFixed(2)}%–${y5.toFixed(2)}%) over unhedged 30Y long bonds (${y30.toFixed(2)}%) until term-premium supply clears; ` +
    `watch ${ (y10 + 0.15).toFixed(2) }% on US10Y as the primary valuation ceiling for high-multiple Nasdaq 100 (${ndxPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}) constituents.`;

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
      event: 'Federal Reserve FOMC Rate Guidance & Senior Loan Officer Survey',
      timing: 'Next 24–72 Hours',
      impact: 'Critical' as const,
      watchFor: `Any hawkish pushback on front-end cuts that lifts US 2Y above ${(y2 + 0.12).toFixed(2)}% or flattens the 2Y/10Y spread from +${twoTen.toFixed(1)} bps.`,
    },
    {
      event: 'US Treasury 10Y & 30Y Refunding Auction Bid-to-Cover & Tail',
      timing: 'This Week · NY 1:00 PM ET',
      impact: 'High' as const,
      watchFor: `Primary dealer takedown and foreign indirect bids; a >2 bps tail would test 30Y resistance near ${(y30 + 0.12).toFixed(2)}%.`,
    },
    {
      event: 'US CPI / PCE Disinflation Trajectory & Energy Pass-Through',
      timing: 'Upcoming Macro Window',
      impact: 'High' as const,
      watchFor: `Core services stickiness vs softer energy ($${wtiPrice.toFixed(2)}/bbl WTI) dictating real yield direction and Gold ($${goldPrice.toFixed(0)}/oz) momentum.`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · GLOBAL MACRO SYNTHESIS & CRITICAL WATCHLIST',
    regimeBadge,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}

export function buildIndonesiaArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const bonds = snap.indonesia.bonds;
  const fx = snap.indonesia.fxAndNdf;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.84;

  const biRate = bonds.biRate ?? 5.75;
  const cpi = bonds.cpiInflationYoY ?? 3.28;
  const indo5Y = bonds.indoGB.find((b) => b.tenor.includes('5Y'))?.yield ?? 7.66;
  const indo10Y = bonds.indoGB.find((b) => b.tenor.includes('10Y'))?.yield ?? 7.74;
  const spread10Y = Math.round((indo10Y - ust10Y) * 100);

  const srbi6M = bonds.srbi.find((s) => s.tenor === '6M')?.weightedAvgYield ?? 6.491;
  const srbi12M = bonds.srbi.find((s) => s.tenor === '12M')?.weightedAvgYield ?? 6.601;
  const srbiBids = bonds.srbi.find((s) => s.tenor === '12M')?.nominalBidsIDR ?? 'IDR 41.81 T';

  const spot = fx.spotRate ?? 18075;
  const jisdor = fx.jisdorRate ?? 18094;
  const ndf1M = fx.ndf1M ?? 18111;
  const ndfSpread = fx.ndfSpread1M ?? 36;
  const ihsg = fx.ihsgIndex.level ?? 4919.77;
  const ihsgPct = fx.ihsgIndex.changePct ?? 0.32;

  const realPolicyBuffer = (biRate - cpi).toFixed(2);
  const leadIndoNews =
    snap.indonesia.commentary.noteworthyHeadlines[0]?.title ||
    snap.indonesia.commentary.noteworthyHeadlines[0]?.headline ||
    'Bank Indonesia anchors Rupiah stability via triple intervention and SRBI liquidity sterilization';

  const regimeBadge = `BI-RATE ${biRate.toFixed(2)}% · REAL BUFFER +${realPolicyBuffer}% · SPREAD +${spread10Y} BPS`;
  const conviction = 'Overweight 12M SRBI & 5Y–10Y IndoGB Belly · Hedged NDF Carry';

  const synthesis =
    `Indonesia's macro-financial framework offers a +${realPolicyBuffer}% real policy rate buffer (BI-Rate at ${biRate.toFixed(2)}% vs Headline CPI at ${cpi.toFixed(2)}% YoY) ` +
    `alongside a +${spread10Y} bps sovereign yield pickup on 10Y IndoGB FR0100 (${indo10Y.toFixed(2)}% vs US 10Y at ${ust10Y.toFixed(2)}%). ` +
    `Onshore USD/IDR spot (${spot.toLocaleString('en-US')}) trades tightly anchored against Bank Indonesia's JISDOR fixing (Rp ${jisdor.toLocaleString('en-US')}), ` +
    `while 1M offshore NDFs (${ndf1M.toLocaleString('en-US')}, +${ndfSpread} IDR basis) signal contained offshore hedging pressure. ` +
    `Strong institutional demand in 12M SRBI auctions (${srbi12M.toFixed(3)}% WAR on ${srbiBids} bids) continues to sterilize excess liquidity while IHSG trades at ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${ihsgPct >= 0 ? '+' : ''}${ihsgPct.toFixed(2)}%). ` +
    `Key domestic development: "${leadIndoNews}".`;

  const positioningTakeaway =
    `Capture front-end Rupiah carry via 12M SRBI (${srbi12M.toFixed(3)}% WAR) and 5Y–10Y IndoGB (${indo5Y.toFixed(2)}%–${indo10Y.toFixed(2)}%) ` +
    `while monitoring the 1M NDF-Spot basis (+${ndfSpread} IDR) as an early-warning barometer for offshore USD demand.`;

  const criticalLevels = [
    {
      asset: 'USD/IDR Spot & JISDOR',
      current: `${spot.toLocaleString('en-US')} (JISDOR ${jisdor.toLocaleString('en-US')})`,
      support: `${(spot - 125).toLocaleString('en-US')}`,
      resistance: `${(spot + 125).toLocaleString('en-US')}`,
      implication: `Break above ${(spot + 125).toLocaleString('en-US')} triggers active BI DNDF/spot intervention; move below ${(spot - 125).toLocaleString('en-US')} invites foreign bond inflows.`,
    },
    {
      asset: '10Y IndoGB (FR0100)',
      current: `${indo10Y.toFixed(2)}% (+${spread10Y} bps)`,
      support: `${(indo10Y - 0.14).toFixed(2)}%`,
      resistance: `${(indo10Y + 0.16).toFixed(2)}%`,
      implication: `Yields near ${(indo10Y + 0.16).toFixed(2)}% attract domestic pension/bank buying; compression below ${(indo10Y - 0.14).toFixed(2)}% requires lower UST yields.`,
    },
    {
      asset: '12M SRBI Auction WAR',
      current: `${srbi12M.toFixed(3)}% (6M: ${srbi6M.toFixed(3)}%)`,
      support: `${(srbi12M - 0.10).toFixed(3)}%`,
      resistance: `${(srbi12M + 0.12).toFixed(3)}%`,
      implication: `Sustained clearing above ${srbi12M.toFixed(2)}% keeps foreign short-term portfolio carry attractive and defends the Rupiah.`,
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
      event: 'Bank Indonesia Weekly SRBI Open Market Operation Tender',
      timing: 'Weekly · Friday Jakarta Session',
      impact: 'Critical' as const,
      watchFor: `Watch whether 12M WAR holds near ${srbi12M.toFixed(3)}% and if nominal bids remain near ${srbiBids} to gauge onshore bank liquidity.`,
    },
    {
      event: 'Daily 15:15 WIB JISDOR Fixing & 1M Offshore NDF Basis',
      timing: 'Daily · 15:15 WIB (16:15 SGT)',
      impact: 'High' as const,
      watchFor: `Any widening of the 1M NDF spread beyond +100 IDR (currently +${ndfSpread} IDR) over spot (${spot.toLocaleString('en-US')}).`,
    },
    {
      event: 'DJPPR Conventional SUN (IndoGB) Primary Debt Auction & BI Board Meeting',
      timing: 'Bi-Weekly / Monthly Policy Cycle',
      impact: 'High' as const,
      watchFor: `Bid-to-cover ratio on FR0101 (5Y, ${indo5Y.toFixed(2)}%) and FR0100 (10Y, ${indo10Y.toFixed(2)}%) plus BI-Rate (${biRate.toFixed(2)}%) forward guidance.`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · INDONESIA SOVEREIGN, FX & MONETARY SYNTHESIS',
    regimeBadge,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}
