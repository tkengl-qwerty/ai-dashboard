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
    `watch ${(y10 + 0.15).toFixed(2)}% on US10Y as the primary valuation ceiling for high-multiple Nasdaq 100 (${ndxPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}) constituents.`;

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
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  const biRate = bonds.biRate ?? 5.75;
  const cpi = bonds.cpiInflationYoY ?? 3.28;
  const indo5Y = bonds.indoGB.find((b) => b.tenor.startsWith('5Y'))?.yield ?? 7.35;
  const indo10Y = bonds.indoGB.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 7.69;
  const spread10Y = Math.round((indo10Y - ust10Y) * 100);

  const srbi6M = bonds.srbi.find((s) => s.tenor === '6M')?.weightedAvgYield ?? 6.566;
  const srbi9M = bonds.srbi.find((s) => s.tenor === '9M')?.weightedAvgYield ?? 6.655;
  const srbi12M = bonds.srbi.find((s) => s.tenor === '12M')?.weightedAvgYield ?? 6.675;
  const srbiDate = bonds.srbi.find((s) => s.tenor === '12M')?.auctionDate ?? '06 Nov 2026';
  const srbi12MBids = bonds.srbi.find((s) => s.tenor === '12M')?.nominalBidsIDR ?? 'IDR 19.20 T';
  const srbi12MAwarded = bonds.srbi.find((s) => s.tenor === '12M')?.awardedVolumeIDR ?? 'IDR 3.00 T';

  const spot = fx.spotRate ?? 18080;
  const jisdor = fx.jisdorRate ?? 18130;
  const ndf1M = fx.ndf1M ?? 18116;
  const ndfSpread = fx.ndfSpread1M ?? 36;
  const ihsg = fx.ihsgIndex.level ?? 5050.43;
  const ihsgPct = fx.ihsgIndex.changePct ?? 0.40;

  const realPolicyBuffer = (biRate - cpi).toFixed(2);
  const leadIndoNews =
    snap.indonesia.commentary.noteworthyHeadlines[0]?.title ||
    snap.indonesia.commentary.noteworthyHeadlines[0]?.headline ||
    'Bank Indonesia reports US$146.8B FX reserves and prepares 100% Rupiah conversion for resource export earnings';

  const regimeBadge = `BI-RATE ${biRate.toFixed(2)}% · REAL BUFFER +${realPolicyBuffer}% · SPREAD +${spread10Y} BPS`;
  const conviction = 'Overweight 12M SRBI (6.675% WAR) & 5Y–10Y IndoGB (FR0109/FR0108) · Hedged NDF Carry';

  const synthesis =
    `Indonesia's macro-financial framework offers a +${realPolicyBuffer}% real policy rate buffer (BI-Rate at ${biRate.toFixed(2)}% vs Headline CPI at ${cpi.toFixed(2)}% YoY) ` +
    `alongside a +${spread10Y} bps sovereign yield pickup on 10Y IndoGB benchmark FR0108 (${indo10Y.toFixed(2)}% vs US 10Y at ${ust10Y.toFixed(2)}%, with 5Y FR0109 at ${indo5Y.toFixed(2)}%). ` +
    `In Bank Indonesia's completed Friday ${srbiDate} SRBI issuance (bi.go.id), total incoming bids reached IDR 36.90 T across tenors while BI awarded IDR 7.50 T (4.92x bid-to-cover), ` +
    `with Winner WAR clearing at ${srbi6M.toFixed(3)}% (6M), ${srbi9M.toFixed(3)}% (9M), and ${srbi12M.toFixed(3)}% (12M: ${srbi12MAwarded} awarded from ${srbi12MBids} bids). ` +
    `Onshore USD/IDR spot (${spot.toLocaleString('en-US')}) and JISDOR (Rp ${jisdor.toLocaleString('en-US')}) remain well-anchored with 1M NDFs at ${ndf1M.toLocaleString('en-US')} (+${ndfSpread} IDR basis) and IHSG at ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${ihsgPct >= 0 ? '+' : ''}${ihsgPct.toFixed(2)}%). ` +
    `Lead domestic development: "${leadIndoNews}".`;

  const positioningTakeaway =
    `Following Friday ${srbiDate}'s SRBI issuance (12M WAR at ${srbi12M.toFixed(3)}%), capture front-end Rupiah carry via 12M SRBI and 5Y–10Y DJPPR benchmarks FR0109/FR0108 (${indo5Y.toFixed(2)}%–${indo10Y.toFixed(2)}%) ` +
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
      event: `Post-${srbiDate} SRBI Issuance Settlement & Next Friday BI OMO Tender`,
      timing: `Issued Fri ${srbiDate} · Next Tender Fri 13 Nov`,
      impact: 'Critical' as const,
      watchFor: `Following Friday ${srbiDate}'s issuance (IDR 7.50 T total awarded from IDR 36.90 T bids; 12M WAR at ${srbi12M.toFixed(3)}%), watch secondary market turnover and whether 12M WAR holds near ${srbi12M.toFixed(3)}% next Friday.`,
    },
    {
      event: '100% DHE Export Earnings Conversion & Daily 15:15 WIB JISDOR Fixing',
      timing: 'Daily · 15:15 WIB (16:15 SGT)',
      impact: 'High' as const,
      watchFor: `Onshore USD supply from exporter retention alongside any widening of the 1M NDF spread beyond +100 IDR (currently +${ndfSpread} IDR) over spot (${spot.toLocaleString('en-US')}).`,
    },
    {
      event: 'DJPPR Conventional SUN (IndoGB) Primary Debt Auction & BI Board Meeting',
      timing: 'Bi-Weekly / Monthly Policy Cycle',
      impact: 'High' as const,
      watchFor: `Bid-to-cover ratio on 2026 benchmarks FR0109 (5Y, ${indo5Y.toFixed(2)}%), FR0108 (10Y, ${indo10Y.toFixed(2)}%), FR0106 (15Y), and FR0107 (20Y).`,
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

export function buildChinaArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const china = snap.china;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  const cgb1Y = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('1Y'))?.yield ?? 1.168;
  const cgb5Y = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('5Y'))?.yield ?? 1.312;
  const cgb10Y = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 1.587;
  const cgb30Y = china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('30Y'))?.yield ?? 2.028;
  const curveDate = china?.bonds.curveDate ?? '2026-11-06';

  const omo7d = china?.bonds.pbocOmo7dRate ?? 1.50;
  const lpr1Y = china?.bonds.lpr1Y ?? 3.10;
  const lpr5Y = china?.bonds.lpr5Y ?? 3.60;
  const cpi = china?.bonds.cpiInflationYoY ?? 0.60;
  const spread10Y = Math.round((cgb10Y - ust10Y) * 100);
  const slope10s30s = Math.round((cgb30Y - cgb10Y) * 100);

  const cny = china?.fxAndEquities.cnySpot ?? 6.6710;
  const cnh = china?.fxAndEquities.cnhSpot ?? 6.6736;
  const fixing = china?.fxAndEquities.pbocFixing ?? 6.6685;
  const ssec = china?.fxAndEquities.shanghaiComposite.level ?? 3649.18;
  const ssecPct = china?.fxAndEquities.shanghaiComposite.changePct ?? -1.10;

  const leadHeadline =
    china?.commentary.noteworthyHeadlines[0]?.title ||
    china?.commentary.noteworthyHeadlines[0]?.headline ||
    'PBoC maintains accommodative liquidity operations as CCDC 10Y ChinaBond CGB yield trades near 1.587%';

  const regimeBadge = `7D OMO ${omo7d.toFixed(2)}% · CCDC 10Y ${cgb10Y.toFixed(3)}% · US-CN SPREAD ${spread10Y} BPS`;
  const conviction = 'Belly CGB Receive (3Y–5Y CCDC Curve) · FX-Hedged Total Return · Watch 30Y Ultra-Long Supply';

  const synthesis =
    `Official China Central Depository & Clearing (CCDC · yield.chinabond.com.cn) ChinaBond CGB valuations (${curveDate}) show an accommodative sovereign curve with 1Y CGB at ${cgb1Y.toFixed(3)}%, ` +
    `5Y benchmark at ${cgb5Y.toFixed(3)}%, 10Y benchmark at ${cgb10Y.toFixed(3)}%, and 30Y ultra-long CGB at ${cgb30Y.toFixed(3)}% (10s30s slope at +${slope10s30s} bps; ${spread10Y} bps vs US 10Y Treasuries). ` +
    `With the PBoC 7-Day Reverse Repo anchored at ${omo7d.toFixed(2)}% (1Y/5Y LPR at ${lpr1Y.toFixed(2)}%/${lpr5Y.toFixed(2)}% and CPI at ${cpi.toFixed(2)}% YoY), commercial bank wealth-management demand continues to compress front-end and belly yields. ` +
    `In currency markets, onshore USD/CNY (${cny.toFixed(4)}) and offshore USD/CNH (${cnh.toFixed(4)}) track closely around the PBoC daily central parity fixing (${fixing.toFixed(4)}), while the Shanghai Composite trades at ${ssec.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${ssecPct >= 0 ? '+' : ''}${ssecPct.toFixed(2)}%). ` +
    `Lead China macro development: "${leadHeadline}".`;

  const positioningTakeaway =
    `Express bullish China rates views via 3Y–5Y CCDC CGB benchmarks (${cgb5Y.toFixed(3)}%) where PBoC DR007 funding carry is positive, while avoiding unhedged duration chases below 1.50% on 10Y CGB (${cgb10Y.toFixed(3)}%) where PBoC bond-lending intervention risk rises.`;

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
      event: 'PBoC Daily 7D Reverse Repo OMO & CCDC ChinaBond Valuation Fixing',
      timing: 'Daily · 09:15 & 17:00 CST (SGT)',
      impact: 'Critical' as const,
      watchFor: `Net liquidity injection/drain via 7D OMO (${omo7d.toFixed(2)}%) and whether DR007 repo stays anchored below 1.70% as CCDC publishes end-of-day CGB yields.`,
    },
    {
      event: 'Ministry of Finance (MoF) Ultra-Long Special CGB Auction & LPR Fixing',
      timing: '20th of Month · 09:15 CST',
      impact: 'High' as const,
      watchFor: `Primary auction bid-to-cover on 10Y (${cgb10Y.toFixed(3)}%) and 30Y (${cgb30Y.toFixed(3)}%) CGBs alongside any 10–15 bps cut to 1Y/5Y LPR (${lpr1Y.toFixed(2)}% / ${lpr5Y.toFixed(2)}%).`,
    },
    {
      event: 'PBoC USD/CNY Central Parity Fixing & Northbound Bond Connect Flows',
      timing: 'Daily · 09:15 CST',
      impact: 'High' as const,
      watchFor: `Deviation between PBoC central parity (${fixing.toFixed(4)}) and offshore CNH (${cnh.toFixed(4)}) dictating FX-hedged foreign inflows into CCDC-custodied CGBs.`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · CHINA SOVEREIGN (CCDC), PBOC & FX SYNTHESIS',
    regimeBadge,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}

export function buildKoreaArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const korea = snap.korea;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  const ktb3Y = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('3Y'))?.yield ?? 3.622;
  const ktb5Y = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('5Y'))?.yield ?? 3.716;
  const ktb10Y = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 3.852;
  const ktb30Y = korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('30Y'))?.yield ?? 3.895;
  const quoteDate = korea?.bonds.quotationDate ?? '06 Nov 2026';

  const bokRate = korea?.bonds.bokBaseRate ?? 3.00;
  const kofr = korea?.bonds.kofrOvernightRate ?? 2.98;
  const cd91d = korea?.bonds.cd91dRate ?? 3.42;
  const cpi = korea?.bonds.cpiInflationYoY ?? 2.10;
  const spread10Y = Math.round((ktb10Y - ust10Y) * 100);
  const slope3s10s = Math.round((ktb10Y - ktb3Y) * 100);

  const krw = korea?.fxAndEquities.krwSpot ?? 1356.34;
  const ndf1M = korea?.fxAndEquities.ndf1M ?? 1354.10;
  const kospi = korea?.fxAndEquities.kospiIndex.level ?? 5059.69;
  const kospiPct = korea?.fxAndEquities.kospiIndex.changePct ?? -6.02;

  const leadHeadline =
    korea?.commentary.noteworthyHeadlines[0]?.title ||
    korea?.commentary.noteworthyHeadlines[0]?.headline ||
    'KOFIA / SOFIA Korea Treasury Bond yields rally as foreign WGBI inflows support 3Y and 10Y KTB benchmarks';

  const regimeBadge = `BOK BASE ${bokRate.toFixed(2)}% · KOFR/SOFIA ${kofr.toFixed(2)}% · 10Y KTB ${ktb10Y.toFixed(3)}%`;
  const conviction = 'Long 3Y–10Y KTB (KOFIA Benchmark) on WGBI Inflows · Receive 3s10s Box · Watch USD/KRW 1,380';

  const synthesis =
    `Korea Financial Investment Association (KOFIA / SOFIA · kofiabond.or.kr) final OTC bond quotations (${quoteDate}) place the benchmark 3Y KTB at ${ktb3Y.toFixed(3)}%, ` +
    `5Y KTB at ${ktb5Y.toFixed(3)}%, 10Y KTB at ${ktb10Y.toFixed(3)}%, and 30Y KTB at ${ktb30Y.toFixed(3)}% (3s10s slope at +${slope3s10s} bps; ${spread10Y} bps vs 10Y US Treasuries). ` +
    `With the Bank of Korea (BOK) Base Rate at ${bokRate.toFixed(2)}% (Headline CPI at ${cpi.toFixed(2)}% YoY, real policy buffer +${(bokRate - cpi).toFixed(2)}%), short-term SOFIA / KOFR overnight repo fixes at ${kofr.toFixed(2)}% and 91-day KOFIA CD rates trade at ${cd91d.toFixed(2)}%. ` +
    `In FX and equity markets, onshore USD/KRW trades at ₩${krw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (1M NDF at ₩${ndf1M.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) while KOSPI sits at ${kospi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${kospiPct >= 0 ? '+' : ''}${kospiPct.toFixed(2)}%). ` +
    `Lead Korea macro catalyst: "${leadHeadline}".`;

  const positioningTakeaway =
    `Accumulate 3Y and 10Y KTB benchmarks (${ktb3Y.toFixed(3)}% / ${ktb10Y.toFixed(3)}%) on any backup above 3.95% as passive FTSE WGBI index allocations and stable KOFR/SOFIA repo funding (${kofr.toFixed(2)}%) anchor domestic duration demand.`;

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
      current: `KOFR ${kofr.toFixed(2)}% · CD ${cd91d.toFixed(2)}%`,
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
      event: 'KOFIA 11:30 & 16:00 KST Final OTC Quotation Yield Fixing & KTB Futures',
      timing: 'Daily · 11:30 & 16:00 KST (15:00 SGT)',
      impact: 'Critical' as const,
      watchFor: `Foreign institutional net buying in 3Y (${ktb3Y.toFixed(3)}%) and 10Y (${ktb10Y.toFixed(3)}%) KTB futures alongside KOFIA AA- 3Y corporate credit spreads.`,
    },
    {
      event: 'Bank of Korea (BOK) Monetary Policy Board Rate Decision & MSB Auctions',
      timing: 'Monthly BOK Cycle · Weekly MSB Tender',
      impact: 'High' as const,
      watchFor: `Forward guidance from Governor Rhee Chang-yong on household debt vs export momentum and KOFR/SOFIA (${kofr.toFixed(2)}%) repo transmission.`,
    },
    {
      event: 'MOEF Monthly KTB Issuance Plan & FTSE WGBI Foreign Custody Inflows',
      timing: 'Monthly · Ministry of Economy and Finance',
      impact: 'High' as const,
      watchFor: `Competitive auction takedown on 10Y (${ktb10Y.toFixed(3)}%) and 30Y (${ktb30Y.toFixed(3)}%) KTB supply and Euroclear/Clearstream omnibus inflows.`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · KOREA SOVEREIGN (KOFIA / SOFIA), BOK & KRW SYNTHESIS',
    regimeBadge,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}

export function buildIndiaArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const india = snap.india;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  const gsec3Y = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('3Y'))?.yield ?? 6.958;
  const gsec5Y = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('5Y'))?.yield ?? 7.023;
  const gsec10Y = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 7.162;
  const gsec30Y = india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('30Y'))?.yield ?? 7.619;
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
  const rbiRef = india?.fxAndEquities.rbiReferenceUsd ?? 94.1402;
  const fxReserves = india?.fxAndEquities.forexReservesUsdBn ?? 717.06;
  const nifty = india?.fxAndEquities.nifty50Index.level ?? 24986.40;
  const niftyPct = india?.fxAndEquities.nifty50Index.changePct ?? -0.18;

  const leadHeadline =
    india?.commentary.noteworthyHeadlines[0]?.title ||
    india?.commentary.noteworthyHeadlines[0]?.headline ||
    'RBI conducts LAF Variable Rate Repo operations as 10Y G-Sec benchmark 6.94% GS 2036 trades near 7.162%';

  const regimeBadge = `RBI REPO ${repoRate.toFixed(2)}% (SDF ${sdfRate.toFixed(2)}% / MSF ${msfRate.toFixed(2)}%) · 10Y G-SEC ${gsec10Y.toFixed(3)}%`;
  const conviction = 'Long 5Y–10Y FAR G-Secs (6.53% GS 2031 / 6.94% GS 2036) · Positive Carry +230 bps vs UST · Watch RBI VRR/VRRR';

  const synthesis =
    `Reserve Bank of India (RBI · rbi.org.in) and CCIL/NDS-OM sovereign fixings (${quoteDate}) place the 3Y G-Sec benchmark (6.20% GS 2029) at ${gsec3Y.toFixed(3)}%, ` +
    `5Y benchmark (6.53% GS 2031) at ${gsec5Y.toFixed(3)}%, 10Y benchmark (6.94% GS 2036) at ${gsec10Y.toFixed(3)}%, and 30Y G-Sec (7.63% GS 2056) at ${gsec30Y.toFixed(3)}% (5s10s slope at +${slope5s10s} bps; +${spread10Y} bps over 10Y US Treasuries). ` +
    `With the RBI Monetary Policy Committee maintaining the Policy Repo Rate at ${repoRate.toFixed(2)}% (SDF floor at ${sdfRate.toFixed(2)}%, MSF ceiling at ${msfRate.toFixed(2)}%, CRR at 3.00%) and 91D/364D T-Bills clearing at ${tbill91d.toFixed(3)}%/${tbill364d.toFixed(3)}%, ` +
    `RBI's US$${fxReserves.toFixed(2)}B Foreign Exchange Reserves cushion spot USD/INR around ₹${inrSpot.toFixed(4)} (FBIL Reference Rate ₹${rbiRef.toFixed(4)}) as Nifty 50 trades at ${nifty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${niftyPct >= 0 ? '+' : ''}${niftyPct.toFixed(2)}%). ` +
    `Lead India macro catalyst: "${leadHeadline}".`;

  const positioningTakeaway =
    `Overweight Fully Accessible Route (FAR) 5Y–10Y Indian G-Secs (${gsec5Y.toFixed(3)}%–${gsec10Y.toFixed(3)}%) to capture +${spread10Y} bps sovereign spread over USTs and low FX volatility backed by RBI's US$${fxReserves.toFixed(2)}B reserve war chest; ` +
    `monitor RBI fine-tuning VRR/VRRR LAF operations keeping overnight call rates (${india?.bonds.callRateRange || '4.30% - 5.75%'}) aligned with the ${repoRate.toFixed(2)}% Repo anchor.`;

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
      current: `${nifty.toLocaleString('en-US', { maximumFractionDigits: 0 })} / ${(india?.fxAndEquities.sensexIndex.level ?? 80999).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      support: Math.round(nifty * 0.975).toLocaleString('en-US'),
      resistance: Math.round(nifty * 1.025).toLocaleString('en-US'),
      implication: 'Domestic SIP inflows and banking earnings offset foreign equity rotation and support INR capital account stability.',
    },
  ];

  const eventsToWatch = [
    {
      event: 'RBI Variable Rate Repo (VRR) / Reverse Repo (VRRR) LAF Operations & Weekly T-Bill Auction',
      timing: 'Nov 09 & Nov 11, 2026 · rbi.org.in',
      impact: 'Critical' as const,
      watchFor: `Allotment in RBI's 4-day VRR auction and Wednesday's ₹23,000 Cr T-Bill tender (₹8,000 Cr 91D, ₹8,000 Cr 182D, ₹7,000 Cr 364D) dictating front-end money market funding.`,
    },
    {
      event: 'Weekly Friday RBI Government Stock (G-Sec) Primary Auction & PD Devolvement',
      timing: 'Fridays · 14:30 IST (17:00 SGT)',
      impact: 'High' as const,
      watchFor: `Following the 06 Nov auction (₹23,000 Cr 7.06% GS 2041 @ 7.3881% & ₹13,000 Cr 7.43% GS 2076 @ 7.7708% with NIL devolvement), watch long-duration insurer demand.`,
    },
    {
      event: 'India MoSPI CPI Inflation Print & RBI Weekly Statistical Supplement (WSS) FX Reserves',
      timing: '12th of Month & Fridays 17:00 IST',
      impact: 'High' as const,
      watchFor: `Food-price trajectory relative to RBI's 4% (±2%) target band and weekly variation in RBI's US$${fxReserves.toFixed(2)}B Forex Reserves.`,
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · INDIA SOVEREIGN (RBI / CCIL G-SEC), LAF & INR SYNTHESIS',
    regimeBadge,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}

export function buildUsEquitiesArgonCommentary(snap: DailyMacroSnapshot): ArgonCommentary {
  const eq = snap.equities;
  const ust10Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;
  const ust2Y = snap.globalMacro.yieldCurve.tenors.find((t) => t.label === '2Y')?.yield ?? 4.53;

  const spx = eq?.indexSummary.spxLevel ?? 7376.86;
  const spxPct = eq?.indexSummary.spxChangePct ?? 0.31;
  const spxFwdPe = eq?.indexSummary.spxForwardPe ?? 21.8;
  const spxEy = eq?.indexSummary.spxEarningsYieldPct ?? Number((100 / spxFwdPe).toFixed(2));
  const erpBps = Math.round((spxEy - ust10Y) * 100);

  const peLeader = eq?.topForwardPe[0];
  const fcfLeader = eq?.topFcfToEv[0];
  const divLeader = eq?.topDividendYield[0];

  const leadHeadline =
    eq?.noteworthyHeadlines[0]?.title ||
    eq?.noteworthyHeadlines[0]?.headline ||
    'S&P 500 factor dispersion widens as 10Y Treasury yields near 4.86% reward high FCF/EV and low Forward P/E constituents';

  const regimeBadge = `S&P 500 ${spx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · FWD P/E ${spxFwdPe.toFixed(1)}x (E/P ${spxEy.toFixed(2)}%) · ERP ${erpBps >= 0 ? `+${erpBps}` : erpBps} BPS VS 10Y UST`;
  const conviction = 'Overweight High FCF/EV & Low Forward P/E Value · Quality Cash-Return Barbell vs Cap-Weighted Index';

  const synthesis =
    `With the S&P 500 Index trading at ${spx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${spxPct >= 0 ? '+' : ''}${spxPct.toFixed(2)}%) on a ${spxFwdPe.toFixed(1)}x consensus NTM Forward P/E ` +
    `(implied Forward Earnings Yield of ${spxEy.toFixed(2)}% vs the ${ust10Y.toFixed(2)}% 10-Year US Treasury risk-free rate, compressing the aggregate Equity Risk Premium to ${erpBps} bps), ` +
    `factor dispersion across the S&P 500 offers substantial valuation alpha outside mega-cap growth. ` +
    `Our live three-factor screen highlights deep earnings value led by ${peLeader?.ticker || 'GM'} (${(peLeader?.forwardPe ?? 6.8).toFixed(2)}x Forward P/E, ${(peLeader?.earningsYieldPct ?? 14.7).toFixed(1)}% E/P), ` +
    `unlevered cash-return leadership in ${fcfLeader?.ticker || 'DVN'} (${(fcfLeader?.fcfToEvPct ?? 12.8).toFixed(2)}% FCF/EV yield), ` +
    `and FCF-covered cash income anchored by ${divLeader?.ticker || 'MO'} (${(divLeader?.dividendYieldPct ?? 7.4).toFixed(2)}% Dividend/Price yield). ` +
    `Lead US equity catalyst: "${leadHeadline}".`;

  const positioningTakeaway =
    `When 10Y US Treasury yields sit near ${ust10Y.toFixed(2)}% and aggregate S&P 500 ERP is ${erpBps} bps, rotate marginal equity exposure toward the Top 10 FCF/EV (>9%–13% cash yield) ` +
    `and Top 10 Forward P/E (6.5x–9.5x NTM EPS) baskets, which provide +450 to +900 bps of positive earnings/cash-flow carry over risk-free Treasuries.`;

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
      event: 'S&P 500 Consensus NTM EPS Revisions & Quarterly Earnings Guidance Window',
      timing: 'Ongoing Quarterly Reporting Cycle',
      impact: 'Critical' as const,
      watchFor: 'Operating margin resilience and forward EPS revisions across Value vs Mega-Cap Technology constituents.',
    },
    {
      event: '10-Year US Treasury Real Yield & Equity Risk Premium (ERP) Re-Rating Threshold',
      timing: 'Daily NY Cash Session (09:30–16:00 ET)',
      impact: 'High' as const,
      watchFor: `Any move in 10Y UST above ${(ust10Y + 0.15).toFixed(2)}% accelerating institutional factor rotation from high-P/E growth into high FCF/EV and low Forward P/E leaders.`,
    },
    {
      event: 'Corporate Share Repurchase Blackout Exit & Ex-Dividend Reinvestment Flows',
      timing: 'Post-Earnings Open Window',
      impact: 'High' as const,
      watchFor: 'Authorized buyback execution among Top 10 FCF/EV constituents (Energy, Healthcare, Industrials, Legacy Tech) shrinking float and boosting EPS.',
    },
  ];

  return {
    modelLabel: 'GEMINI 4 ARGON',
    title: 'GEMINI 4 ARGON · US EQUITIES (S&P 500) VALUATION, ERP & FACTOR SYNTHESIS',
    regimeBadge,
    conviction,
    synthesis,
    positioningTakeaway,
    criticalLevels,
    eventsToWatch,
  };
}
