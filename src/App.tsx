import React, { useState, useEffect, useCallback } from 'react';
import { DailyMacroSnapshot, MacroTabId, ChinaMacroData, KoreaMacroData } from './types/market';
import { Header } from './components/Header';
import { NavigationTabs } from './components/NavigationTabs';
import { GlobalMacroTab } from './components/GlobalMacroTab';
import { IndonesiaTab } from './components/IndonesiaTab';
import { ChinaTab } from './components/ChinaTab';
import { KoreaTab } from './components/KoreaTab';
import { AlertCircle } from 'lucide-react';
import {
  buildGlobalArgonCommentary,
  buildIndonesiaArgonCommentary,
  buildChinaArgonCommentary,
  buildKoreaArgonCommentary,
} from './utils/argonSynthesis';

const DEFAULT_CHINA_DATA: ChinaMacroData = {
  commentary: {
    title: 'PBoC & CCDC ChinaBond Sovereign Fixed Income Outlook',
    date: '08 Nov 2026',
    executiveSummary:
      'People’s Bank of China (PBoC) maintains an accommodative monetary posture with the 7-Day Reverse Repo rate at 1.50%, 1Y LPR at 3.00%, and 5Y LPR at 3.50% (Headline CPI at 0.60% YoY). Per official China Central Depository & Clearing Co., Ltd. (CCDC · yield.chinabond.com.cn) ChinaBond Government Bond Yield Curve (YTM) fixings on 2026-11-06, 1Y CGB cleared at 1.1683% (-0.3 bps), 5Y benchmark at 1.3115% (-1.2 bps), 10Y benchmark at 1.5868% (-1.7 bps), and 30Y ultra-long CGB at 2.0275% (-1.5 bps), establishing a -327 bps 10Y spread vs US Treasuries.',
    macroPillars: [
      {
        heading: 'CCDC ChinaBond CGB Yield Curve (yield.chinabond.com.cn · 2026-11-06)',
        analysis:
          'Official CCDC ChinaBond CGB yields compressed across all maturities on 6 Nov 2026: 1Y at 1.1683% (vs 1.1710% prior), 3Y at 1.2291% (vs 1.2397%), 5Y at 1.3115% (vs 1.3236%), 10Y at 1.5868% (vs 1.6038%), and 30Y at 2.0275% (vs 2.0425%), keeping the 2s10s slope at +37 bps and 10s30s at +44 bps.',
      },
      {
        heading: 'PBoC Open Market Operations, DR007 Repo & CCDC CDB Policy Bank Curve',
        analysis:
          'With the 7-Day Reverse Repo policy anchor at 1.50%, 1Y/5Y LPR at 3.00%/3.50%, and CCDC depository-institution 7-day repo (DR007) trading near 1.620%, interbank funding remains ample, supporting commercial bank carry positioning in 3Y–7Y CGBs and official CCDC 10Y China Development Bank (CDB) policy bank bonds (1.771%, +18.4 bps over 10Y CGB).',
      },
      {
        heading: 'Renminbi Central Parity Fixing (CFETS), SSEC & CSI 300 Positioning',
        analysis:
          'Onshore USD/CNY trades at 6.6760 (+0.12%) alongside offshore USD/CNH at 6.6713 and the PBoC daily central parity fixing at 6.6735, while the Shanghai Composite sits at 3,649.18 (+0.31%) and CSI 300 at 4,054.28 (-1.44%).',
      },
    ],
    policyPosture: 'Supportive Monetary Easing (7D OMO 1.50% · 1Y LPR 3.00% · 5Y LPR 3.50%)',
    noteworthyHeadlines: [
      {
        title: 'SSE Composite Weekly Review: Shanghai Rises 1.39% to 3,649.18 and Ends a Six-Week Losing Streak on Beijing Support',
        headline: 'SSE Composite Weekly Review: Shanghai Rises 1.39% to 3,649.18 and Ends a Six-Week Losing Streak on Beijing Support',
        source: 'BBN Times',
        timeAgo: '3h ago',
        significance:
          'Drives onshore asset-allocation rotation between domestic equities (Shanghai Composite 3,649.18, CSI 300 4,054.28) and long-duration 10Y–30Y CCDC CGB benchmarks (1.5868%–2.0275%).',
        url: 'https://www.bloomberg.com/markets',
      },
      {
        title: "Buying the Dip? People's Bank of China Extends Gold Purchases for 24th Consecutive Month",
        headline: "Buying the Dip? People's Bank of China Extends Gold Purchases for 24th Consecutive Month",
        source: 'Bloomberg',
        timeAgo: '5h ago',
        significance:
          'Reinforces PBoC balance-sheet diversification alongside US$3.2T+ FX reserves, supporting sovereign credit quality across the CCDC CGB curve (10Y at 1.5868%).',
        url: 'https://www.bloomberg.com/markets',
      },
      {
        title: 'Bessent, Greer Raise Concerns on China Trade Deal Actions',
        headline: 'Bessent, Greer Raise Concerns on China Trade Deal Actions',
        source: 'Bloomberg',
        timeAgo: '7h ago',
        significance:
          'Shapes external trade-surplus expectations and exporter USD conversion flows on CFETS (USD/CNY 6.6760), a key driver for PBoC domestic liquidity injections.',
        url: 'https://www.bloomberg.com/markets',
      },
      {
        title: 'China’s Central Bank Tweaks Forex Reserve Rules to Steady Yuan',
        headline: 'China’s Central Bank Tweaks Forex Reserve Rules to Steady Yuan',
        source: 'WSJ',
        timeAgo: '9h ago',
        significance:
          'Directly anchors PBoC daily central parity fixing (6.6735) and narrows the offshore-onshore CNH/CNY basis (CNY 6.6760 vs CNH 6.6713), stabilizing FX-hedged inflows into CCDC ChinaBond CGBs.',
        url: 'https://www.wsj.com/economy/central-banking',
      },
      {
        title: "China's yuan dilemma: too weak abroad and too strong at home",
        headline: "China's yuan dilemma: too weak abroad and too strong at home",
        source: 'Reuters',
        timeAgo: '12h ago',
        significance:
          'Reflects PBoC FX management between domestic monetary easing (10Y CCDC CGB at 1.5868%) and external Renminbi stability near 6.6760.',
        url: 'https://www.reuters.com/markets/currencies/',
      },
    ],
  },
  bonds: {
    curveDate: '2026-11-06',
    ccdcCgb: [
      { tenor: '1Y', code: '260019.IB', yield: 1.1683, priorYield: 1.1710, changeBps: -0.3, coupon: 1.35 },
      { tenor: '2Y', code: '260020.IB', yield: 1.2155, priorYield: 1.2214, changeBps: -0.6, coupon: 1.42 },
      { tenor: '3Y', code: '260016.IB', yield: 1.2291, priorYield: 1.2397, changeBps: -1.1, coupon: 1.55 },
      { tenor: '5Y (Benchmark)', code: '260014.IB', yield: 1.3115, priorYield: 1.3236, changeBps: -1.2, coupon: 1.75 },
      { tenor: '7Y', code: '260018.IB', yield: 1.3996, priorYield: 1.4161, changeBps: -1.7, coupon: 1.92 },
      { tenor: '10Y (Benchmark)', code: '260011.IB', yield: 1.5868, priorYield: 1.6038, changeBps: -1.7, coupon: 2.04 },
      { tenor: '15Y', code: '260015.IB', yield: 1.8609, priorYield: 1.8790, changeBps: -1.8, coupon: 2.28 },
      { tenor: '20Y', code: '260017.IB', yield: 2.0139, priorYield: 2.0332, changeBps: -1.9, coupon: 2.39 },
      { tenor: '30Y (Ultra-Long)', code: '2600001.IB', yield: 2.0275, priorYield: 2.0425, changeBps: -1.5, coupon: 2.47 },
    ],
    policyAndMoneyRates: [
      {
        instrument: '7D OMO Reverse Repo',
        code: 'PBOC-7D',
        rate: 1.500,
        changeBps: 0.0,
        description: 'PBoC Primary Open Market Policy Rate Anchor',
      },
      {
        instrument: 'DR007 Interbank Repo',
        code: 'CCDC-DR007',
        rate: 1.620,
        changeBps: -1.5,
        description: 'Depository-Institution 7-Day CGB Pledged Repo',
      },
      {
        instrument: '10Y CDB Policy Bank (CCDC)',
        code: '260210.IB',
        rate: 1.771,
        changeBps: -1.7,
        description: 'CCDC ChinaBond CDB 10Y (+18.4 bps over 10Y CGB)',
      },
      {
        instrument: '1-Year Loan Prime Rate',
        code: 'LPR-1Y',
        rate: 3.000,
        changeBps: 0.0,
        description: 'CFETS Corporate Lending Benchmark Rate',
      },
      {
        instrument: '5-Year Loan Prime Rate',
        code: 'LPR-5Y',
        rate: 3.500,
        changeBps: 0.0,
        description: 'CFETS Long-Term Mortgage Reference Rate',
      },
    ],
    pbocOmo7dRate: 1.50,
    lpr1Y: 3.00,
    lpr5Y: 3.50,
    cpiInflationYoY: 0.60,
    sovereignSpread10Y: -327,
  },
  fxAndEquities: {
    cnySpot: 6.6760,
    cnyChange: 0.0080,
    cnyChangePct: 0.12,
    cnhSpot: 6.6713,
    cnhChange: -0.0023,
    cnhChangePct: -0.03,
    pbocFixing: 6.6735,
    pbocFixingChange: -0.0115,
    cnhCnySpreadPips: -47,
    shanghaiComposite: {
      level: 3649.18,
      change: 11.15,
      changePct: 0.31,
    },
    csi300Index: {
      level: 4054.28,
      change: -59.13,
      changePct: -1.44,
    },
    northboundBondConnectFlow: '+RMB 14.8 Billion (CCDC Custody)',
  },
};

const DEFAULT_KOREA_DATA: KoreaMacroData = {
  commentary: {
    title: 'Bank of Korea & KOFIA / SOFIA Fixed Income Outlook',
    date: '08 Nov 2026',
    executiveSummary:
      'The Bank of Korea (BOK) maintains its Base Rate at 3.00% (Headline CPI at 2.10% YoY, +0.90% real policy buffer) while Korea Overnight Financing Repo (KOFR / SOFIA) fixes at 3.045% (+3.3 bps), 1-day BOK Call Rate trades at 3.048%, and 91-day KOFIA CD rates sit at 3.340%. Across the Korea Financial Investment Association (KOFIA / SOFIA · kofiabond.or.kr) OTC Korea Treasury Bond (KTB) curve, the benchmark 3Y KTB rallied 4.9 bps to 3.622%, 5Y KTB fell 5.7 bps to 3.716%, 10Y KTB eased 4.0 bps to 3.852% (-101 bps vs 10Y UST), and 30Y KTB closed at 3.975% (-2.8 bps).',
    macroPillars: [
      {
        heading: 'KOFIA / SOFIA KTB Yield Curve & WGBI Inclusion Flows (kofiabond.or.kr · 06 Nov 2026)',
        analysis:
          'Korean Treasury Bonds rallied across the curve on strong institutional receiving: 1Y KTB at 3.587%, 2Y KTB at 3.598% (-5.1 bps), 3Y benchmark KTB at 3.622% (-4.9 bps), 5Y KTB at 3.716% (-5.7 bps), 10Y benchmark KTB at 3.852% (-4.0 bps), and 30Y KTB at 3.975% (-2.8 bps), supported by passive FTSE World Government Bond Index (WGBI) allocations.',
      },
      {
        heading: 'SOFIA / KOFR Overnight Repo, KOFIA CD 91D, Call Rate & AA- Corporate Spreads',
        analysis:
          'Short-term money markets remain well-anchored with KOFR / SOFIA overnight repo at 3.045% (+3.3 bps) and 1-day Call Rate at 3.048% against the 3.00% BOK Base Rate, while KOFIA 91-day CD final quotation sits at 3.340%, 1Y BOK Monetary Stabilization Bonds (MSB) at 3.535%, and 3Y AA- corporate bonds at 4.358% (+73.6 bps credit spread).',
      },
      {
        heading: 'USD/KRW FX Dynamics, Semiconductor Cycle & KOSPI Positioning',
        analysis:
          'Onshore USD/KRW trades at ₩1,363.27 (-0.03%) with 1M offshore NDFs at ₩1,361.03 (-2.24 KRW implied basis), while KOSPI closed at 5,059.69 (-6.02%) and KOSDAQ at 644.27 (-5.03%) amid global tech multiple rotation, accelerating domestic safe-haven bids for KTB duration.',
      },
    ],
    policyPosture: 'Measured Calibration (BOK Base Rate 3.00% · KOFR/SOFIA 3.045% · CD 91D 3.34%)',
    noteworthyHeadlines: [
      {
        title: 'U.S. Semiconductor Rebound Raises Hopes for South Korea’s Market',
        headline: 'U.S. Semiconductor Rebound Raises Hopes for South Korea’s Market',
        source: '조선일보',
        timeAgo: '1h ago',
        significance:
          'Supports Korean semiconductor export earnings and foreign equity inflows into KOSPI (5,059.69), helping stabilize onshore USD/KRW around ₩1,363.27.',
        url: 'https://www.chosun.com',
      },
      {
        title: "Savings Banks' LME Loans Surge 50% to 5.3T",
        headline: "Savings Banks' LME Loans Surge 50% to 5.3T",
        source: '조선일보',
        timeAgo: '1h ago',
        significance:
          'Highlights domestic non-bank credit and funding dynamics monitored by BOK and KOFIA, where 91-day CD fixes at 3.340% and 3Y AA- corporate bonds yield 4.358%.',
        url: 'https://www.chosun.com',
      },
      {
        title: '"Rollercoaster" KOSPI Seeks Relief Following U.S. Rebound',
        headline: '"Rollercoaster" KOSPI Seeks Relief Following U.S. Rebound',
        source: 'SBS 뉴스',
        timeAgo: '2h ago',
        significance:
          'Heightened equity volatility in KOSPI (5,059.69) accelerates domestic institutional rotation into safe-haven KOFIA 3Y (3.622%) and 10Y (3.852%) Korea Treasury Bonds.',
        url: 'https://news.sbs.co.kr',
      },
      {
        title: 'Even Blue Chips Slide as 844 Korean Stocks Hit Yearly Lows',
        headline: 'Even Blue Chips Slide as 844 Korean Stocks Hit Yearly Lows',
        source: 'Seoul Economic Daily',
        timeAgo: '3h ago',
        significance:
          'Prompts Korean pension and insurance desks to rebalance toward long-duration 10Y–30Y KTB benchmarks (3.852%–3.975%) amid tech multiple compression.',
        url: 'https://www.sedaily.com',
      },
      {
        title: 'South Korea Inflation Remained Above Target in October',
        headline: 'South Korea Inflation Remained Above Target in October',
        source: 'WSJ',
        timeAgo: '9h ago',
        significance:
          'Reinforces the Bank of Korea’s cautious calibration with the Base Rate at 3.00% and KOFR/SOFIA overnight repo at 3.045%, anchoring 3Y KTB yields near 3.622%.',
        url: 'https://www.wsj.com/economy/central-banking',
      },
    ],
  },
  bonds: {
    quotationDate: '06 Nov 2026',
    kofiaKtb: [
      { tenor: '1Y KTB', code: 'KR1YT=RR', series: 'KTB 03500-2709', yield: 3.587, changeBps: 3.3, coupon: 3.500 },
      { tenor: '2Y KTB', code: 'KR2YT=RR', series: 'KTB 03625-2809', yield: 3.598, changeBps: -5.1, coupon: 3.625 },
      { tenor: '3Y KTB (Benchmark)', code: 'KR3YT=RR', series: 'KTB 03250-2906', yield: 3.622, changeBps: -4.9, coupon: 3.250 },
      { tenor: '5Y KTB', code: 'KR5YT=RR', series: 'KTB 03375-3109', yield: 3.716, changeBps: -5.7, coupon: 3.375 },
      { tenor: '10Y KTB (Benchmark)', code: 'KR10YT=RR', series: 'KTB 03500-3606', yield: 3.852, changeBps: -4.0, coupon: 3.500 },
      { tenor: '20Y KTB', code: 'KR20YT=RR', series: 'KTB 03625-4609', yield: 3.968, changeBps: -1.8, coupon: 3.625 },
      { tenor: '30Y KTB', code: 'KR30YT=RR', series: 'KTB 03250-5603', yield: 3.975, changeBps: -2.8, coupon: 3.250 },
    ],
    sofiaAndMoneyRates: [
      {
        instrument: 'KOFR / SOFIA (Overnight Repo)',
        code: 'KOFR-ON',
        rate: 3.045,
        changeBps: 3.3,
        description: 'Korea Overnight Financing Repo Rate (KSD / KOFIA)',
      },
      {
        instrument: 'BOK Base Rate (기준금리)',
        code: 'BOK-BASE',
        rate: 3.000,
        changeBps: 0.0,
        description: 'Bank of Korea Monetary Policy Board Benchmark',
      },
      {
        instrument: 'Call Rate 1-Day (콜금리)',
        code: 'KRCALLBOKK',
        rate: 3.048,
        changeBps: 0.9,
        description: 'Onshore Interbank Uncollateralized 1D Call Rate',
      },
      {
        instrument: 'CD 91-Day (KOFIA Final)',
        code: 'KFIA114000',
        rate: 3.340,
        changeBps: 0.0,
        description: 'Negotiable Certificate of Deposit 91D Quotation',
      },
      {
        instrument: 'MSB 1-Year (BOK 통안증권)',
        code: 'KOFIA-MSB1Y',
        rate: 3.535,
        changeBps: 3.3,
        description: 'Bank of Korea Monetary Stabilization Bond 1Y',
      },
      {
        instrument: 'Corp Bond 3Y (AA- KOFIA)',
        code: 'KFIA103009',
        rate: 4.358,
        changeBps: -4.2,
        description: 'Unsubordinated AA- Corporate 3Y (+73.6 bps over 3Y KTB)',
      },
    ],
    bokBaseRate: 3.00,
    kofrOvernightRate: 3.045,
    cd91dRate: 3.34,
    cpiInflationYoY: 2.10,
    sovereignSpread10Y: -101,
  },
  fxAndEquities: {
    krwSpot: 1363.27,
    krwChange: -0.37,
    krwChangePct: -0.03,
    ndf1M: 1361.03,
    ndfSpread1M: -2.24,
    kospiIndex: {
      level: 5059.69,
      change: -324.11,
      changePct: -6.02,
    },
    kosdaqIndex: {
      level: 644.27,
      change: -34.14,
      changePct: -5.03,
    },
    foreignKtbFlows: '+KRW 1.85 Trillion (WGBI & KOFIA OTC)',
  },
};

// Default static fallback snapshot matching public/data/daily_macro.json
const DEFAULT_SNAPSHOT: DailyMacroSnapshot = {
  metadata: {
    lastUpdated: '2026-11-08T18:00:00+08:00',
    lastUpdatedSGT: '08 Nov 2026, 06:00 PM SGT',
    nextRefreshSGT: '09 Nov 2026, 05:00 AM SGT',
    edition: 'Daily Macro Close & Pre-Asia Open',
    timezone: 'Asia/Singapore (UTC+8)',
  },
  globalMacro: {
    topNews: [
      {
        id: 'gn-01',
        headline: "Gulf markets retreat as traders await Trump's next move on Iran",
        source: 'Reuters',
        timeAgo: '1h ago',
        category: 'Fiscal & Debt',
        summary:
          'Reuters coverage on "Gulf markets retreat as traders await Trump\'s next move on Iran" highlights shifting institutional positioning across fiscal & debt and global rate markets as benchmark 10Y US Treasuries trade near 4.86%.',
        macroTakeaway:
          'Tighter credit standards and moderating price pressures help cap 10Y Treasury yields around 4.86% (2Y/10Y at +35.0 bps).',
        impact: 'Dovish',
        url: 'https://www.reuters.com/markets/',
      },
      {
        id: 'gn-02',
        headline: "Cathie Wood 'always feels better when the market is worried' — here's why",
        source: 'CNBC',
        timeAgo: '3h ago',
        category: 'Fiscal & Debt',
        summary:
          'CNBC coverage highlights shifting institutional positioning across global equity and rate markets as benchmark 10Y US Treasuries trade near 4.86%.',
        macroTakeaway:
          'Desk participants are assessing secondary transmission into the US Treasury curve (10Y 4.86%) and G10 currency pairs.',
        impact: 'Neutral',
        url: 'https://www.cnbc.com/markets/',
      },
      {
        id: 'gn-03',
        headline: 'As fresh peace talks loom, Putin is escalating his efforts to shatter Ukraine’s economy',
        source: 'CNN',
        timeAgo: '4h ago',
        category: 'Geopolitics',
        summary:
          'CNN coverage highlights shifting institutional positioning across geopolitics and global rate markets as benchmark 10Y US Treasuries trade near 4.86%.',
        macroTakeaway:
          'Desk participants are assessing secondary transmission into the US Treasury curve (10Y 4.86%) and G10 currency pairs.',
        impact: 'Neutral',
        url: 'https://www.cnn.com/business',
      },
      {
        id: 'gn-04',
        headline: 'China Set to Lead World in Energy Investment in 2026, CCTV Says',
        source: 'Bloomberg',
        timeAgo: '5h ago',
        category: 'Inflation',
        summary:
          'Bloomberg coverage highlights shifting institutional positioning across energy capex and global rate markets as benchmark 10Y US Treasuries trade near 4.86%.',
        macroTakeaway:
          'Desk participants are assessing secondary transmission into the US Treasury curve (10Y 4.86%) and G10 currency pairs.',
        impact: 'Neutral',
        url: 'https://www.bloomberg.com/markets',
      },
      {
        id: 'gn-05',
        headline: 'AI Slump Revives Asia’s Forgotten Trades From China to India',
        source: 'Bloomberg',
        timeAgo: '9h ago',
        category: 'Geopolitics',
        summary:
          'Bloomberg coverage highlights cross-border equity rotation across Asian markets as benchmark 10Y US Treasuries trade near 4.86%.',
        macroTakeaway:
          'Prompts de-risking in high-beta growth and tech multiples, increasing defensive demand for short-duration Treasuries (4.51%).',
        impact: 'Risk-Off',
        url: 'https://www.bloomberg.com/markets',
      },
      {
        id: 'gn-06',
        headline: 'US Banks Grow More Cautious on Lending, Fed Survey Shows',
        source: 'Bloomberg',
        timeAgo: '11h ago',
        category: 'Fed Policy',
        summary:
          'Bloomberg coverage on the Federal Reserve Senior Loan Officer Opinion Survey highlights tightening credit standards across US commercial banks.',
        macroTakeaway:
          'Tighter credit standards and moderating price pressures help cap 10Y Treasury yields around 4.86% (2Y/10Y at +35.0 bps).',
        impact: 'Dovish',
        url: 'https://www.bloomberg.com/markets',
      },
      {
        id: 'gn-07',
        headline: 'Why the prognosis for healthcare stocks is uncertain ahead of Congress’ new makeup',
        source: 'CNBC',
        timeAgo: '12h ago',
        category: 'Fiscal & Debt',
        summary:
          'CNBC coverage highlights shifting legislative and fiscal expectations ahead of the new Congressional session.',
        macroTakeaway:
          'Desk participants are assessing secondary transmission into the US Treasury curve (10Y 4.86%) and G10 currency pairs.',
        impact: 'Neutral',
        url: 'https://www.cnbc.com/markets/',
      },
      {
        id: 'gn-08',
        headline: 'Wall Street Strategists Call Stock Rout a Fresh Reason to Buy',
        source: 'Bloomberg',
        timeAgo: '12h ago',
        category: 'Fiscal & Debt',
        summary:
          'Bloomberg coverage highlights institutional dip-buying appetite following recent tech multiple compression.',
        macroTakeaway:
          'Desk participants are assessing secondary transmission into the US Treasury curve (10Y 4.86%) and G10 currency pairs.',
        impact: 'Neutral',
        url: 'https://www.bloomberg.com/markets',
      },
      {
        id: 'gn-09',
        headline: 'Charting the Global Economy: Job Growth in US Tops All Forecasts',
        source: 'Bloomberg',
        timeAgo: '12h ago',
        category: 'Labor Market',
        summary:
          'Bloomberg coverage highlights resilient US labor market additions alongside moderating wage pressures.',
        macroTakeaway:
          'Desk participants are assessing secondary transmission into the US Treasury curve (10Y 4.86%) and G10 currency pairs.',
        impact: 'Neutral',
        url: 'https://www.bloomberg.com/markets',
      },
      {
        id: 'gn-10',
        headline: 'Czech Premier Blasts Central Bank Rate Hike as ‘Scandalous’',
        source: 'Bloomberg',
        timeAgo: '12h ago',
        category: 'Fed Policy',
        summary:
          'Bloomberg coverage highlights central bank policy tension across European emerging markets.',
        macroTakeaway:
          'Keeps front-end US2Y yields anchored near 4.51% and tempers expectations for aggressive near-term easing.',
        impact: 'Hawkish',
        url: 'https://www.bloomberg.com/markets',
      },
    ],
    yieldCurve: {
      tenors: [
        { label: '1M', years: 0.08, yield: 3.94, changeBps: -1.3, priorClose: 3.96 },
        { label: '3M', years: 0.25, yield: 4.11, changeBps: 1.4, priorClose: 4.09 },
        { label: '6M', years: 0.5, yield: 4.26, changeBps: 2.2, priorClose: 4.23 },
        { label: '1Y', years: 1.0, yield: 4.33, changeBps: 2.3, priorClose: 4.31 },
        { label: '2Y', years: 2.0, yield: 4.51, changeBps: 3.5, priorClose: 4.48 },
        { label: '3Y', years: 3.0, yield: 4.58, changeBps: 3.9, priorClose: 4.54 },
        { label: '5Y', years: 5.0, yield: 4.64, changeBps: 3.7, priorClose: 4.61 },
        { label: '7Y', years: 7.0, yield: 4.74, changeBps: 3.3, priorClose: 4.71 },
        { label: '10Y', years: 10.0, yield: 4.86, changeBps: 2.2, priorClose: 4.84 },
        { label: '20Y', years: 20.0, yield: 5.29, changeBps: 1.7, priorClose: 5.28 },
        { label: '30Y', years: 30.0, yield: 5.26, changeBps: 1.2, priorClose: 5.25 },
      ],
      spreads: {
        twoTenSpread: 35.0,
        fiveTenSpread: 22.0,
        threeMonthTenSpread: 75.0,
        fiveThirtySpread: 62.0,
        isInverted: false,
      },
    },
    futures: [
      { symbol: 'ES=F', name: 'S&P 500 E-mini', price: 7402.0, change: 19.0, changePct: 0.26 },
      { symbol: 'NQ=F', name: 'Nasdaq 100 E-mini', price: 27085.25, change: 333.25, changePct: 1.25 },
      { symbol: 'YM=F', name: 'Dow Jones Mini', price: 51385.0, change: -230.0, changePct: -0.45 },
      { symbol: 'RTY=F', name: 'Russell 2000 Mini', price: 2760.5, change: 25.1, changePct: 0.92 },
      { symbol: 'DX=F', name: 'US Dollar Index', price: 102.3, change: 0.75, changePct: 0.74 },
    ],
    fxRates: [
      { pair: 'EUR/USD', name: 'Euro / US Dollar', rate: 1.1228, change: -0.0007, changePct: -0.06 },
      { pair: 'USD/JPY', name: 'US Dollar / Japanese Yen', rate: 158.43, change: 0.93, changePct: 0.59 },
      { pair: 'GBP/USD', name: 'British Pound / US Dollar', rate: 1.3456, change: -0.0021, changePct: -0.16 },
      { pair: 'USD/CNH', name: 'US Dollar / Offshore Yuan', rate: 6.671, change: -0.017, changePct: -0.25 },
      { pair: 'AUD/USD', name: 'Australian Dollar / USD', rate: 0.6868, change: -0.0063, changePct: -0.91 },
      { pair: 'USD/SGD', name: 'US Dollar / Singapore Dollar', rate: 1.2825, change: 0.0045, changePct: 0.35 },
    ],
    commodities: [
      { symbol: 'CL=F', name: 'WTI Crude Oil', price: 90.83, unit: '$/bbl', change: 0.31, changePct: 0.34 },
      { symbol: 'BZ=F', name: 'Brent Crude', price: 98.32, unit: '$/bbl', change: 0.03, changePct: 0.03 },
      { symbol: 'GC=F', name: 'Gold Futures', price: 4074.9, unit: '$/t.oz', change: -38.6, changePct: -0.94 },
      { symbol: 'SI=F', name: 'Silver Futures', price: 51.94, unit: '$/t.oz', change: -0.29, changePct: -0.56 },
      { symbol: 'HG=F', name: 'Copper Futures', price: 6.24, unit: '$/lb', change: -0.01, changePct: -0.18 },
    ],
  },
  indonesia: {
    commentary: {
      title: 'Bank Indonesia Macro Commentary & Fixed Income Outlook',
      date: '08 Nov 2026',
      executiveSummary:
        'Bank Indonesia maintains its stability-oriented monetary stance with the BI-Rate at 5.75% (Headline CPI at 3.28% YoY), supported by official JISDOR fixing at Rp 18,130 (6 November 2026) and spot USD/IDR at 18,080. In the 06 Nov 2026 SRBI auction on bi.go.id, 12M SRBI cleared at a 6.675% weighted average winner rate (WAR) on IDR 19.20 T nominal bids, while 5Y benchmark FR0109 trades at 7.35% and 10Y benchmark FR0108 yields 7.69% (+283 bps over 10Y UST).',
      macroPillars: [
        {
          heading: 'Monetary & Liquidity Operations (06 Nov 2026 SRBI Auction on bi.go.id)',
          analysis:
            "Bank Indonesia continues pro-market open market operations via SRBI auctions with the policy BI-Rate at 5.75%. Per Bank Indonesia's official Operasi Moneter release (06 Nov 2026), weighted average winner rates (WAR) cleared at 6.566% for 6M, 6.655% for 9M, and 6.675% for 12M (IDR 19.20 T nominal 12M bids), preserving an orderly carry buffer above US front-end rates.",
        },
        {
          heading: 'Sovereign Debt Curve (DJPPR 2026 Benchmark SUN: FR0109 & FR0108)',
          analysis:
            "IndoGB yields reflect active secondary market repricing across DJPPR's official 2026 benchmark series. The 5Y benchmark (FR0109, 5.875% due Mar 2031) trades at 7.35% while the 10Y benchmark (FR0108, 6.500% due Apr 2036) trades at 7.69%, establishing a +283 bps sovereign spread over 10Y US Treasuries.",
        },
        {
          heading: 'Currency Dynamics (JISDOR Rp 18,130 & Offshore NDF)',
          analysis:
            "Bank Indonesia's official JISDOR reference rate fixed at Rp 18,130 per USD on 6 November 2026 (following Rp 18,094 on 5 November 2026). Offshore 1-Month NDFs trade at 18,116 (+36 IDR spread / 2.39% p.a. basis), while IDX Composite (IHSG) closed at 5,050.43 (+0.40%).",
        },
      ],
      biPolicyPosture: 'Vigilant FX Stabilization (BI-Rate 5.75% · Headline CPI 3.28% YoY)',
      noteworthyHeadlines: [
        {
          title: 'Amidst Cyber Threats in Indonesia, OJK Strengthens Coordination with Banks',
          headline: 'Amidst Cyber Threats in Indonesia, OJK Strengthens Coordination with Banks',
          source: 'Kompas.id',
          timeAgo: '3h ago',
          significance:
            'Strengthens OJK prudential supervision and institutional governance across Indonesian banks and capital markets (IHSG 5,050.43).',
          url: 'https://www.kompas.id',
        },
        {
          title: 'At 80, the rupiah needs credibility, not ceremony',
          headline: 'At 80, the rupiah needs credibility, not ceremony',
          source: 'The Jakarta Post',
          timeAgo: '12h ago',
          significance:
            "Supports Bank Indonesia's FX stabilization corridor with JISDOR at Rp 18,130 and the 06 Nov 12M SRBI WAR clearing at 6.675%.",
          url: 'https://www.thejakartapost.com',
        },
        {
          title: 'Govt prepares 100 pct rupiah conversion for resource export earnings',
          headline: 'Govt prepares 100 pct rupiah conversion for resource export earnings',
          source: 'ANTARA News',
          timeAgo: '1d ago',
          significance:
            'Mandatory onshore conversion of natural resource export proceeds (DHE SDA) structurally deepens domestic USD liquidity and anchors spot USD/IDR near 18,080.',
          url: 'https://en.antaranews.com',
        },
        {
          title: 'Bank Indonesia expects export retention policy to boost forex reserves',
          headline: 'Bank Indonesia expects export retention policy to boost forex reserves',
          source: 'ANTARA News',
          timeAgo: '1d ago',
          significance:
            "Reinforces Bank Indonesia's US$146.8B external reserve buffer to defend JISDOR (Rp 18,130) alongside the 06 Nov SRBI issuance (12M WAR at 6.675%).",
          url: 'https://en.antaranews.com',
        },
        {
          title: 'Indonesias foreign exchange reserves hit US$146.8 bln in October: BI',
          headline: 'Indonesias foreign exchange reserves hit US$146.8 bln in October: BI',
          source: 'ANTARA News',
          timeAgo: '1d ago',
          significance:
            'Reported by ANTARA News; shapes onshore institutional allocation across Jakarta equities (IHSG 5,050.43) and Rupiah money markets.',
          url: 'https://en.antaranews.com',
        },
      ],
    },
    bonds: {
      indoGB: [
        { tenor: '5Y (Benchmark)', code: 'FR0109', maturity: '15 Mar 2031', yield: 7.35, changeBps: -31.2, coupon: 5.875 },
        { tenor: '10Y (Benchmark)', code: 'FR0108', maturity: '15 Apr 2036', yield: 7.69, changeBps: -4.8, coupon: 6.500 },
        { tenor: '15Y (Benchmark)', code: 'FR0106', maturity: '15 Aug 2040', yield: 7.69, changeBps: 0.0, coupon: 7.125 },
        { tenor: '20Y (Benchmark)', code: 'FR0107', maturity: '15 Aug 2045', yield: 7.74, changeBps: 0.0, coupon: 7.125 },
      ],
      srbi: [
        {
          tenor: '6M',
          tenorDays: 182,
          series: 'IDSR070527364S',
          auctionDate: '06 Nov 2026',
          weightedAvgYield: 6.566,
          cutOffYield: 6.643,
          biddingRateRange: '6.45-7.00%',
          nominalBidsIDR: 'IDR 13.28 T',
          awardedVolumeIDR: 'IDR 4.35 T',
          sourceUrl: 'https://www.bi.go.id/id/publikasi/lelang/operasi-moneter/Pages/Hasil-Lelang-SRBI-6-November-2026.aspx',
        },
        {
          tenor: '9M',
          tenorDays: 273,
          series: 'IDSR060827364S',
          auctionDate: '06 Nov 2026',
          weightedAvgYield: 6.655,
          cutOffYield: 6.761,
          biddingRateRange: '6.65-7.10%',
          nominalBidsIDR: 'IDR 4.42 T',
          awardedVolumeIDR: 'IDR 0.15 T',
          sourceUrl: 'https://www.bi.go.id/id/publikasi/lelang/operasi-moneter/Pages/Hasil-Lelang-SRBI-6-November-2026.aspx',
        },
        {
          tenor: '12M',
          tenorDays: 350,
          series: 'IDSR221027364S',
          auctionDate: '06 Nov 2026',
          weightedAvgYield: 6.675,
          cutOffYield: 6.790,
          biddingRateRange: '6.60-7.20%',
          nominalBidsIDR: 'IDR 19.20 T',
          awardedVolumeIDR: 'IDR 3.00 T',
          sourceUrl: 'https://www.bi.go.id/id/publikasi/lelang/operasi-moneter/Pages/Hasil-Lelang-SRBI-6-November-2026.aspx',
        },
      ],
      sovereignSpread10Y: 283,
      biRate: 5.75,
      cpiInflationYoY: 3.28,
    },
    fxAndNdf: {
      spotRate: 18080,
      spotChange: 5,
      spotChangePct: 0.03,
      jisdorRate: 18130,
      jisdorChange: 36,
      jisdorHistory: [
        { date: '6 November 2026', rate: 18130 },
        { date: '5 November 2026', rate: 18094 },
        { date: '4 November 2026', rate: 18140 },
        { date: '3 November 2026', rate: 18148 },
        { date: '2 November 2026', rate: 18161 },
      ],
      ndf1M: 18116,
      ndf3M: 18189,
      ndfSpread1M: 36,
      annualizedBasis1M: 2.39,
      ihsgIndex: {
        level: 5050.43,
        change: 20.17,
        changePct: 0.4,
      },
      foreignFlowsDaily: '+IDR 98.0 Billion',
      foreignFlowsYTD: '+IDR 38.2 Trillion',
    },
  },
  china: DEFAULT_CHINA_DATA,
  korea: DEFAULT_KOREA_DATA,
};

const DJPPR_2026_BENCHMARKS = [
  { match: '15Y', tenor: '15Y (Benchmark)', code: 'FR0106', maturity: '15 Aug 2040', coupon: 7.125 },
  { match: '20Y', tenor: '20Y (Benchmark)', code: 'FR0107', maturity: '15 Aug 2045', coupon: 7.125 },
  { match: '10Y', tenor: '10Y (Benchmark)', code: 'FR0108', maturity: '15 Apr 2036', coupon: 6.500 },
  { match: '5Y', tenor: '5Y (Benchmark)', code: 'FR0109', maturity: '15 Mar 2031', coupon: 5.875 },
];

function normalizeSnapshot(snap: DailyMacroSnapshot): DailyMacroSnapshot {
  const headlines = snap.indonesia?.commentary?.noteworthyHeadlines || [];
  const usedSigs = new Set<string>();
  const jisdor = snap.indonesia?.fxAndNdf?.jisdorRate ?? 18130;
  const ihsg = snap.indonesia?.fxAndNdf?.ihsgIndex?.level ?? 5050.43;

  const normalizedHeadlines = headlines.map((item, idx) => {
    const rawTitle = (item.title || item.headline || 'Indonesia Market Disclosure').replace(
      /\s+-\s+[^-]+$/,
      ''
    );
    let sig = (item.significance || '').replace(/6\.601%/g, '6.675%');
    if (!sig || usedSigs.has(sig)) {
      const low = rawTitle.toLowerCase();
      if (low.includes('reserve') || low.includes('146.8') || low.includes('forex') || low.includes('export')) {
        sig =
          'Bolsters Bank Indonesia’s external reserve buffer and onshore USD supply alongside the 6 Nov SRBI issuance (12M WAR at 6.675%).';
      } else if (low.includes('ojk') || low.includes('bank') || low.includes('cyber') || low.includes('reform')) {
        sig =
          'Strengthens OJK regulatory enforcement and institutional confidence across Jakarta financials and domestic money markets.';
      } else if (low.includes('rupiah') || low.includes('credibility') || low.includes('dollar')) {
        sig = `Underscores Bank Indonesia's FX stability focus with JISDOR at Rp ${jisdor.toLocaleString()} and 12M SRBI clearing at 6.675% on 6 Nov.`;
      } else if (low.includes('gdp') || low.includes('economy') || low.includes('growth')) {
        sig = `Frames Indonesia's Q3 GDP expansion against domestic purchasing power and anchors demand for 10Y FR0108 IndoGBs.`;
      } else {
        sig = `Reported by ${item.source}; shapes onshore institutional allocation across Jakarta equities (IHSG ${ihsg.toLocaleString()}) and Rupiah debt (#${idx + 1}).`;
      }
    }
    usedSigs.add(sig);
    return {
      ...item,
      title: rawTitle,
      headline: rawTitle,
      significance: sig,
    };
  });

  // Ensure IndoGB rows always reflect the verified 2026 DJPPR Kemenkeu Seri Benchmark SUN:
  // Use startsWith(s.match) so "15Y" never matches "5Y"!
  const rawIndoGB = snap.indonesia?.bonds?.indoGB || [];
  const normalizedIndoGB = rawIndoGB.map((b) => {
    const trimmedTenor = (b.tenor || '').trim();
    const spec = DJPPR_2026_BENCHMARKS.find((s) => trimmedTenor.startsWith(s.match));
    if (!spec) return b;
    return {
      ...b,
      tenor: spec.tenor,
      code: spec.code,
      maturity: spec.maturity,
      coupon: spec.coupon,
    };
  });

  // Upgrade stale Oct 2026 CEIC SRBI rows if remote cache hasn't refreshed yet
  const rawSrbi = snap.indonesia?.bonds?.srbi || [];
  const isStaleOctSrbi = rawSrbi.some((s) => (s.auctionDate || '').includes('Oct'));
  const normalizedSrbi = isStaleOctSrbi ? DEFAULT_SNAPSHOT.indonesia.bonds.srbi : rawSrbi;

  const rawChinaData: ChinaMacroData = snap.china ?? DEFAULT_CHINA_DATA;
  const rawKoreaData: KoreaMacroData = snap.korea ?? DEFAULT_KOREA_DATA;

  // Normalize & de-duplicate China headlines and Market Significance
  const usedChinaSigs = new Set<string>();
  const rawChinaHeadlines = (rawChinaData.commentary?.noteworthyHeadlines || [])
    .filter((h) => {
      const t = (h.title || h.headline || '').toLowerCase();
      return !t.includes('yangwang') && !t.includes('byd unveils') && !t.includes('settlement crisis leaves merchants');
    });
  const chinaHeadlinesSource = rawChinaHeadlines.length >= 3 ? rawChinaHeadlines : DEFAULT_CHINA_DATA.commentary.noteworthyHeadlines;
  const normalizedChinaHeadlines = chinaHeadlinesSource.slice(0, 5).map((item, idx) => {
    const rawTitle = (item.title || item.headline || '').trim() || `China Macro & CCDC Update #${idx + 1}`;
    const low = rawTitle.toLowerCase();
    let sig = (item.significance || '').trim();
    if (!sig || usedChinaSigs.has(sig) || sig.startsWith('Shapes institutional positioning across CCDC ChinaBond CGBs')) {
      if (low.includes('forex') || low.includes('yuan') || low.includes('renminbi') || low.includes('fix')) {
        sig = `Directly anchors PBoC daily central parity fixing (${rawChinaData.fxAndEquities.pbocFixing.toFixed(4)}) and narrows the CNH/CNY basis (CNY ${rawChinaData.fxAndEquities.cnySpot.toFixed(4)}), stabilizing FX-hedged CGB inflows.`;
      } else if (low.includes('gold') || low.includes('reserve')) {
        sig = `Reinforces PBoC balance-sheet diversification alongside US$3.2T+ FX reserves, supporting sovereign credit quality across the CCDC CGB curve.`;
      } else if (low.includes('sse') || low.includes('shanghai') || low.includes('stocks') || low.includes('forgotten trades')) {
        sig = `Drives onshore asset-allocation rotation between domestic equities (SSEC ${rawChinaData.fxAndEquities.shanghaiComposite.level.toLocaleString()}) and long-duration 10Y–30Y CCDC CGB benchmarks.`;
      } else if (low.includes('tariff') || low.includes('trade') || low.includes('bessent') || low.includes('sanctions') || low.includes('exports')) {
        sig = `Shapes external trade-surplus expectations and exporter USD conversion flows on CFETS (USD/CNY ${rawChinaData.fxAndEquities.cnySpot.toFixed(4)}), guiding PBoC liquidity operations.`;
      } else {
        sig = `Reported by ${item.source}; influences onshore bank duration appetite across 10Y CCDC CGBs (1.5868%) and PBoC DR007 repo funding (#${idx + 1}).`;
      }
      if (usedChinaSigs.has(sig)) {
        sig = `${sig.replace(/\.$/, '')} (Desk Note #${idx + 1}).`;
      }
    }
    usedChinaSigs.add(sig);
    return {
      ...item,
      title: rawTitle,
      headline: rawTitle,
      significance: sig,
    };
  });

  // Normalize & de-duplicate Korea headlines and Market Significance
  const usedKoreaSigs = new Set<string>();
  const rawKoreaHeadlines = (rawKoreaData.commentary?.noteworthyHeadlines || [])
    .filter((h) => {
      const t = (h.title || h.headline || '').toLowerCase();
      return !t.includes('pokémon') && !t.includes('pokemon') && !t.includes('youtube program') && !t.includes("korean won't");
    });
  const koreaHeadlinesSource = rawKoreaHeadlines.length >= 3 ? rawKoreaHeadlines : DEFAULT_KOREA_DATA.commentary.noteworthyHeadlines;
  const normalizedKoreaHeadlines = koreaHeadlinesSource.slice(0, 5).map((item, idx) => {
    const rawTitle = (item.title || item.headline || '').trim() || `Korea BOK & KOFIA Update #${idx + 1}`;
    const low = rawTitle.toLowerCase();
    let sig = (item.significance || '').trim();
    if (!sig || usedKoreaSigs.has(sig) || sig.startsWith('Influences foreign positioning across KOFIA/SOFIA KTB benchmarks')) {
      if (low.includes('inflation') || low.includes('cpi') || low.includes('target') || low.includes('bank of korea')) {
        sig = `Reinforces the Bank of Korea's cautious calibration with the Base Rate at ${rawKoreaData.bonds.bokBaseRate.toFixed(2)}% and KOFR/SOFIA overnight repo at ${rawKoreaData.bonds.kofrOvernightRate.toFixed(3)}%.`;
      } else if (low.includes('semiconductor') || low.includes('chip') || low.includes('rebound') || low.includes('samsung')) {
        sig = `Supports Korean semiconductor export earnings and foreign equity inflows into KOSPI (${rawKoreaData.fxAndEquities.kospiIndex.level.toLocaleString()}), stabilizing onshore USD/KRW (₩${rawKoreaData.fxAndEquities.krwSpot.toFixed(2)}).`;
      } else if (low.includes('loans') || low.includes('lme') || low.includes('savings banks') || low.includes('credit')) {
        sig = `Highlights domestic non-bank credit and funding dynamics monitored by BOK and KOFIA alongside 91-day CD (${rawKoreaData.bonds.cd91dRate.toFixed(2)}%) and AA- corporate spreads.`;
      } else if (low.includes('kospi') || low.includes('stocks') || low.includes('blue chips') || low.includes('foreign selling') || low.includes('rout')) {
        sig = `Heightened equity volatility in KOSPI (${rawKoreaData.fxAndEquities.kospiIndex.level.toLocaleString()}) accelerates domestic institutional rotation into safe-haven KOFIA 3Y (3.622%) and 10Y (3.852%) KTBs.`;
      } else {
        sig = `Tracked by ${item.source}; shapes foreign institutional positioning across KOFIA 3Y/10Y KTB futures and onshore KRW basis (#${idx + 1}).`;
      }
      if (usedKoreaSigs.has(sig)) {
        sig = `${sig.replace(/\.$/, '')} (Desk Note #${idx + 1}).`;
      }
    }
    usedKoreaSigs.add(sig);
    return {
      ...item,
      title: rawTitle,
      headline: rawTitle,
      significance: sig,
    };
  });

  const chinaData: ChinaMacroData = {
    ...rawChinaData,
    commentary: {
      ...rawChinaData.commentary,
      noteworthyHeadlines: normalizedChinaHeadlines,
    },
  };
  const koreaData: KoreaMacroData = {
    ...rawKoreaData,
    commentary: {
      ...rawKoreaData.commentary,
      noteworthyHeadlines: normalizedKoreaHeadlines,
    },
  };

  const withNormalizedBondsAndHeadlines: DailyMacroSnapshot = {
    ...snap,
    indonesia: {
      ...snap.indonesia,
      bonds: {
        ...snap.indonesia.bonds,
        indoGB: normalizedIndoGB,
        srbi: normalizedSrbi,
      },
      commentary: {
        ...snap.indonesia.commentary,
        noteworthyHeadlines: normalizedHeadlines,
      },
    },
    china: chinaData,
    korea: koreaData,
  };

  return {
    ...withNormalizedBondsAndHeadlines,
    globalMacro: {
      ...withNormalizedBondsAndHeadlines.globalMacro,
      argonCommentary: buildGlobalArgonCommentary(withNormalizedBondsAndHeadlines),
    },
    indonesia: {
      ...withNormalizedBondsAndHeadlines.indonesia,
      argonCommentary: buildIndonesiaArgonCommentary(withNormalizedBondsAndHeadlines),
    },
    china: {
      ...chinaData,
      argonCommentary: buildChinaArgonCommentary(withNormalizedBondsAndHeadlines),
    },
    korea: {
      ...koreaData,
      argonCommentary: buildKoreaArgonCommentary(withNormalizedBondsAndHeadlines),
    },
  };
}

export default function App() {
  const [data, setData] = useState<DailyMacroSnapshot>(() => normalizeSnapshot(DEFAULT_SNAPSHOT));
  const [activeTab, setActiveTab] = useState<MacroTabId>('global');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDailyData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const bust = Date.now();
      const localPromise = fetch(`/data/daily_macro.json?t=${bust}`, { cache: 'no-store' })
        .then((r) => (r.ok ? (r.json() as Promise<DailyMacroSnapshot>) : null))
        .catch(() => null);

      const remotePromise = fetch(
        `https://raw.githubusercontent.com/tkengl-qwerty/ai-dashboard/porkbun-deploy/data/daily_macro.json?t=${bust}`,
        { cache: 'no-store' }
      )
        .then((r) => (r.ok ? (r.json() as Promise<DailyMacroSnapshot>) : null))
        .catch(() => null);

      const [localJson, remoteJson] = await Promise.all([localPromise, remotePromise]);

      if (!localJson && !remoteJson) {
        throw new Error('Failed to load daily dataset from local or remote source');
      }

      if (localJson && remoteJson) {
        const localTime = Date.parse(localJson.metadata?.lastUpdated || '') || 0;
        const remoteTime = Date.parse(remoteJson.metadata?.lastUpdated || '') || 0;
        const chosen = remoteTime > localTime ? remoteJson : localJson;
        setData(normalizeSnapshot(chosen));
      } else {
        setData(normalizeSnapshot((remoteJson || localJson) as DailyMacroSnapshot));
      }
    } catch (err: unknown) {
      console.warn('Using embedded default snapshot fallback:', err);
      setFetchError(err instanceof Error ? err.message : 'Error loading remote data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyData();
  }, [fetchDailyData]);

  const us10Y = data.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;

  return (
    <div className="min-h-screen bg-[#0e141d] text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* 1. Metal & Blue Header with Global Session Clocks */}
      <Header
        metadata={data.metadata}
        onRefresh={fetchDailyData}
        isLoading={isLoading}
      />

      {/* 2. Navigation Tab Switcher */}
      <NavigationTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        data={data}
      />

      {/* Error alert toast if remote fetch fails, indicating fallback is active */}
      {fetchError && (
        <div className="bg-blue-950/50 border-b border-blue-800/60 px-4 py-1.5 text-xs text-sky-300 font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-sky-400" />
            <span>Serving verified snapshot data · Offline/CDN fallback active ({fetchError})</span>
          </div>
          <button
            onClick={fetchDailyData}
            className="text-sky-200 hover:text-white underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Main Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4">
        {activeTab === 'global' && <GlobalMacroTab data={data} />}
        {activeTab === 'indonesia' && (
          <IndonesiaTab
            argonCommentary={data.indonesia.argonCommentary}
            lastUpdatedSGT={data.metadata.lastUpdatedSGT}
            commentary={data.indonesia.commentary}
            bonds={data.indonesia.bonds}
            fxAndNdf={data.indonesia.fxAndNdf}
            us10YYield={us10Y}
          />
        )}
        {activeTab === 'china' && data.china && (
          <ChinaTab
            china={data.china}
            lastUpdatedSGT={data.metadata.lastUpdatedSGT}
            us10YYield={us10Y}
          />
        )}
        {activeTab === 'korea' && data.korea && (
          <KoreaTab
            korea={data.korea}
            lastUpdatedSGT={data.metadata.lastUpdatedSGT}
            us10YYield={us10Y}
          />
        )}
      </main>

      {/* 4. Terminal Footer */}
      <footer className="border-t border-slate-800 bg-gradient-to-r from-[#111824] via-[#151f2e] to-[#111824] px-4 py-3 mt-8 text-[11px] font-mono text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <span className="text-slate-200 font-semibold uppercase">AI Macro Testbed</span>
            <span className="mx-2 text-slate-600">·</span>
            <span>Daily Market Intelligence refreshed at 05:00 AM SGT (21:00 UTC)</span>
          </div>
          <div className="text-slate-400">
            <span>Global Macro · Indonesia (BI/DJPPR) · China (CCDC) · Korea (SOFIA/KOFIA)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
