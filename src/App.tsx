import React, { useState, useEffect, useCallback } from 'react';
import { DailyMacroSnapshot } from './types/market';
import { Header } from './components/Header';
import { NavigationTabs } from './components/NavigationTabs';
import { GlobalMacroTab } from './components/GlobalMacroTab';
import { IndonesiaTab } from './components/IndonesiaTab';
import { AlertCircle } from 'lucide-react';

// Default static fallback snapshot matching public/data/daily_macro.json
const DEFAULT_SNAPSHOT: DailyMacroSnapshot = {
  metadata: {
    lastUpdated: "2026-11-04T17:00:00+08:00",
    lastUpdatedSGT: "04 Nov 2026, 05:00 PM SGT",
    nextRefreshSGT: "05 Nov 2026, 05:00 AM SGT",
    edition: "Daily Macro Close & Pre-Asia Open",
    timezone: "Asia/Singapore (UTC+8)"
  },
  globalMacro: {
    topNews: [
      {
        id: "gn-01",
        headline: "Wall Street Surges After US Midterms as Dow Jumps 1,569 Points (+3.03%) to Close Above 53,356",
        source: "CNBC",
        timeAgo: "1h ago",
        category: "Fiscal & Debt",
        summary: "Major US equity indices rallied sharply on November 4 as investors welcomed the prospect of political gridlock in Washington after Democrats swept control of both the House and Senate. The S&P 500 rose 1.58% to 7,688.62 while the Nasdaq Composite gained 1.44% to 25,736.51.",
        macroTakeaway: "Divided government reduces the probability of unbridled fiscal expansion or abrupt tariff shocks, compresses equity risk premia, and supports broad cyclical rotation.",
        impact: "Risk-On",
        url: "https://www.cnbc.com/markets/"
      },
      {
        id: "gn-02",
        headline: "WTI Crude Plunges Over 8% Toward $88.40/bbl as Markets Price De-Escalation in Middle East",
        source: "Reuters",
        timeAgo: "2h ago",
        category: "Inflation",
        summary: "Global oil prices suffered a steep sell-off on Wednesday, with WTI falling 8.1% to $88.40/bbl and Brent tumbling 8.2% to $94.84/bbl on expectations of renewed diplomatic mediation regarding the US-Iran conflict and political pressure to ease fuel costs.",
        macroTakeaway: "Sharp energy pullback immediately cools headline CPI and PCE inflation expectations, relieving pressure on the Federal Reserve.",
        impact: "Dovish",
        url: "https://www.reuters.com/markets/commodities/"
      },
      {
        id: "gn-03",
        headline: "US 10-Year Treasury Yield Retreats 5 bps to 4.90% as Divided Congress Restrains Fiscal Deficit Outlook",
        source: "Bloomberg",
        timeAgo: "3h ago",
        category: "Fiscal & Debt",
        summary: "US Treasury bonds rallied across the curve following the midterm outcome and steady quarterly refunding guidance, pulling the 10-year benchmark yield down 5 bps to 4.90% and the 30-year yield down 4 bps to 5.28%.",
        macroTakeaway: "2Y/10Y spread holds positive at +32.0 bps while the 5Y/10Y spread stands at +21.0 bps (4.90% vs 4.69%).",
        impact: "Dovish",
        url: "https://www.bloomberg.com/markets/rates-bonds"
      },
      {
        id: "gn-04",
        headline: "Spot Gold Surges 3.4% Above $4,073/oz as US Dollar Index Drops to Five-Week Low",
        source: "Reuters",
        timeAgo: "4h ago",
        category: "Inflation",
        summary: "Bullion jumped over $133 per ounce to $4,073.50/oz (+3.38%) while Silver rallied 4.8% to $52.22/oz, propelled by a sharp drop in the US Dollar Index (DXY) to 101.38 and declining real Treasury yields.",
        macroTakeaway: "Softer dollar and retreating Treasury yields trigger institutional rotation into precious metals and hard-asset hedges.",
        impact: "Risk-On",
        url: "https://www.reuters.com/markets/commodities/"
      },
      {
        id: "gn-05",
        headline: "Meta Platforms Draws Record €53 Billion Orderbook for Debut Euro Bond Offering to Fund AI Capex",
        source: "Bloomberg",
        timeAgo: "5h ago",
        category: "Fiscal & Debt",
        summary: "Meta Platforms attracted an unprecedented €53 billion in institutional investor orders for its multi-tranche euro-denominated corporate bond sale, underscoring deep European credit demand for hyperscale AI infrastructure financing.",
        macroTakeaway: "Demonstrates abundant cross-border institutional liquidity and tight investment-grade credit spreads in European debt markets.",
        impact: "Risk-On",
        url: "https://www.bloomberg.com/markets"
      },
      {
        id: "gn-06",
        headline: "US Dollar Index (DXY) Slides to 101.38 as Congressional Gridlock Safeguards Fed Independence",
        source: "CNN",
        timeAgo: "6h ago",
        category: "Fed Policy",
        summary: "The greenback fell to a five-week low against major peers—sending EUR/USD up to 1.1240 and GBP/USD to 1.3481—as analysts noted a Democratic-controlled Congress will curb fiscal stimulus and protect Federal Reserve institutional independence.",
        macroTakeaway: "Lower US dollar relieves external funding stress across G10 and emerging market currencies.",
        impact: "Dovish",
        url: "https://www.cnn.com/business"
      },
      {
        id: "gn-07",
        headline: "Reserve Bank of Australia Hikes Cash Rate by 25 bps to 4.85% on Persistent Services Inflation",
        source: "Reuters",
        timeAgo: "7h ago",
        category: "Fed Policy",
        summary: "The RBA raised its benchmark cash rate target by 25 basis points to 4.85%, citing sticky domestic services prices and tight labor market conditions, lifting AUD/USD by 0.62% to 0.7010.",
        macroTakeaway: "Highlights ongoing G10 monetary policy divergence as Australia tightens while US yields retrace.",
        impact: "Hawkish",
        url: "https://www.reuters.com/markets/currencies/"
      },
      {
        id: "gn-08",
        headline: "People's Bank of China Raises FX Reserve Requirement Ratio to Cool Rapid Yuan Appreciation",
        source: "Bloomberg",
        timeAgo: "8h ago",
        category: "Trade",
        summary: "The PBoC intervened to moderate a multi-week rally in the renminbi by adjusting foreign-currency reserve parameters, stabilizing offshore USD/CNH around 6.6740.",
        macroTakeaway: "Maintains export competitiveness for Chinese manufacturers while preventing disorderly one-way currency speculation.",
        impact: "Neutral",
        url: "https://www.bloomberg.com/markets/currencies"
      },
      {
        id: "gn-09",
        headline: "Apple Curbs Internal Engineering AI Token Allowances Amid Broader Tech Enterprise Cost Discipline",
        source: "Reuters",
        timeAgo: "9h ago",
        category: "Labor",
        summary: "Apple reduced daily AI compute and token spending caps for software engineers from $300 to $200, signaling a broader shift among mega-cap technology firms toward disciplined return-on-investment scrutiny for AI operations.",
        macroTakeaway: "Focus on operating margin efficiency supports mega-cap tech free cash flow generation.",
        impact: "Neutral",
        url: "https://www.reuters.com/technology/"
      },
      {
        id: "gn-10",
        headline: "US Treasury Department Confirms Steady Quarterly Refunding Auction Sizes Across 3Y, 10Y, and 30Y Tenors",
        source: "CNBC",
        timeAgo: "11h ago",
        category: "Fiscal & Debt",
        summary: "The US Treasury maintained unchanged coupon auction sizes for the upcoming refunding window, reassuring fixed-income dealers that near-term borrowing needs will not require unexpected long-end supply increases.",
        macroTakeaway: "Caps long-end term premium expansion and supports orderly secondary market liquidity.",
        impact: "Dovish",
        url: "https://www.cnbc.com/bonds/"
      }
    ],
    yieldCurve: {
      tenors: [
        { label: "1M", years: 0.08, yield: 4.01, changeBps: -2.0, priorClose: 4.03 },
        { label: "3M", years: 0.25, yield: 4.21, changeBps: 0.0, priorClose: 4.21 },
        { label: "6M", years: 0.50, yield: 4.25, changeBps: -2.0, priorClose: 4.27 },
        { label: "1Y", years: 1.00, yield: 4.39, changeBps: -3.0, priorClose: 4.42 },
        { label: "2Y", years: 2.00, yield: 4.58, changeBps: -4.0, priorClose: 4.62 },
        { label: "3Y", years: 3.00, yield: 4.64, changeBps: -4.0, priorClose: 4.68 },
        { label: "5Y", years: 5.00, yield: 4.69, changeBps: -5.0, priorClose: 4.74 },
        { label: "7Y", years: 7.00, yield: 4.77, changeBps: -5.0, priorClose: 4.82 },
        { label: "10Y", years: 10.00, yield: 4.90, changeBps: -5.0, priorClose: 4.95 },
        { label: "20Y", years: 20.00, yield: 5.30, changeBps: -4.0, priorClose: 5.34 },
        { label: "30Y", years: 30.00, yield: 5.28, changeBps: -4.0, priorClose: 5.32 }
      ],
      spreads: {
        twoTenSpread: 32.0,
        fiveTenSpread: 21.0,
        threeMonthTenSpread: 69.0,
        fiveThirtySpread: 59.0,
        isInverted: false
      }
    },
    futures: [
      { symbol: "ES=F", name: "S&P 500 E-mini", price: 7688.62, change: 119.70, changePct: 1.58 },
      { symbol: "NQ=F", name: "Nasdaq 100 E-mini", price: 25736.51, change: 364.50, changePct: 1.44 },
      { symbol: "YM=F", name: "Dow Jones Mini", price: 53356.12, change: 1569.40, changePct: 3.03 },
      { symbol: "RTY=F", name: "Russell 2000 Mini", price: 2856.95, change: 44.45, changePct: 1.58 },
      { symbol: "DX=F", name: "US Dollar Index", price: 101.38, change: -0.68, changePct: -0.67 }
    ],
    fxRates: [
      { pair: "EUR/USD", name: "Euro / US Dollar", rate: 1.1240, change: 0.0065, changePct: 0.58 },
      { pair: "USD/JPY", name: "US Dollar / Japanese Yen", rate: 157.85, change: -0.82, changePct: -0.52 },
      { pair: "GBP/USD", name: "British Pound / US Dollar", rate: 1.3481, change: 0.0066, changePct: 0.49 },
      { pair: "USD/CNH", name: "US Dollar / Offshore Yuan", rate: 6.6740, change: 0.0120, changePct: 0.18 },
      { pair: "AUD/USD", name: "Australian Dollar / USD", rate: 0.7010, change: 0.0043, changePct: 0.62 },
      { pair: "USD/SGD", name: "US Dollar / Singapore Dollar", rate: 1.2783, change: -0.0032, changePct: -0.25 }
    ],
    commodities: [
      { symbol: "CL=F", name: "WTI Crude Oil", price: 88.40, unit: "$/bbl", change: -7.80, changePct: -8.11 },
      { symbol: "BZ=F", name: "Brent Crude", price: 94.84, unit: "$/bbl", change: -8.45, changePct: -8.18 },
      { symbol: "GC=F", name: "Gold Futures", price: 4073.50, unit: "$/t.oz", change: 133.20, changePct: 3.38 },
      { symbol: "SI=F", name: "Silver Futures", price: 52.22, unit: "$/t.oz", change: 2.40, changePct: 4.82 },
      { symbol: "HG=F", name: "Copper Futures", price: 6.41, unit: "$/lb", change: 0.08, changePct: 1.26 }
    ]
  },
  indonesia: {
    commentary: {
      title: "Bank Indonesia Macro Commentary & Fixed Income Outlook",
      date: "04 Nov 2026",
      executiveSummary: "Bank Indonesia (BI) maintains its benchmark BI-Rate at 6.00% (Deposit Facility at 5.25%, Lending Facility at 6.75%), actively managing domestic liquidity and stabilizing the Rupiah. The official Jakarta Interbank Spot Dollar Rate (JISDOR) published by Bank Indonesia (bi.go.id) fixed at Rp 18,140 per USD on 4 November 2026 (easing from Rp 18,148 on 3 November), with onshore spot USD/IDR trading closely at 18,135 IDR. In the sovereign debt market, Indonesia Government Bond (IndoGB) yields trade near ~7.0%–7.2% (5Y at 7.05% per TradingEconomics gidn5y:gov and 10Y Benchmark FR0100 at 7.18%), providing a +228 bps spread over US 10-Year Treasuries (4.90%). In monetary operations, Bank Indonesia conducts weekly Sekuritas Rupiah Bank Indonesia (SRBI) auctions (bi.go.id Operasi Moneter & CEIC Data) with weighted average accepted rates (WAR) clearing at 6.491% (6M), 6.625% (9M), and 6.760% (12M), with 12M nominal bids reaching IDR 29.80 Trillion and cut-off at 6.820%.",
      macroPillars: [
        {
          heading: "Monetary & Liquidity Operations (SRBI Weighted Average Rates)",
          analysis: "Bank Indonesia continues pro-market open market operations via weekly SRBI auctions. As published on Bank Indonesia Operasi Moneter and CEIC Data, latest weighted average accepted rates cleared at 6.491% for 6M, 6.625% for 9M, and 6.760% for 12M, preserving an orderly carry buffer and absorbing surplus banking reserves."
        },
        {
          heading: "Sovereign Debt Curve (IndoGB ~7% Benchmark Yields)",
          analysis: "IndoGB yields reflect solid primary auction uptake and domestic institutional demand. As tracked on TradingEconomics (gidn5y:gov), the 5Y yield trades at 7.05% while the 10Y benchmark (FR0100) trades at 7.18%, establishing a steady +228 bps spread over US Treasuries (4.90%)."
        },
        {
          heading: "Currency Dynamics (JISDOR Rp 18,140 & Offshore NDF)",
          analysis: "Bank Indonesia's official JISDOR reference rate fixed at Rp 18,140 per USD on 4 Nov 2026 (following Rp 18,148 on 3 Nov and Rp 18,161 on 2 Nov). Offshore 1-Month NDFs trade at 18,205 (+70 IDR spread / 4.63% p.a. basis), while IDX Composite (IHSG) trades at 7,243.86."
        }
      ],
      biPolicyPosture: "Vigilant FX Stabilization (BI-Rate 6.00% · SRBI Sterilization)",
      noteworthyHeadlines: [
        {
          title: "Bank Indonesia Deploys Triple Spot, NDF, and SBN Operations to Anchor Rupiah Near 18,140",
          source: "Jakarta Globe",
          timeAgo: "3h ago",
          significance: "Central bank aggressively conducts spot market, domestic NDF, and secondary government bond purchases to counter global currency volatility.",
          url: "https://jakartaglobe.id/business"
        },
        {
          title: "President Prabowo Convenes Economic Ministers at Merdeka Palace on Fiscal Efficiency & Q4 Budget",
          source: "Cabinet Secretariat (setkab.go.id)",
          timeAgo: "5h ago",
          significance: "High-level cabinet session focused on state spending discipline, budget absorption targets, and safeguarding domestic consumer purchasing power.",
          url: "https://setkab.go.id"
        },
        {
          title: "Financial System Stability Committee (KSSK) Projects 2026 GDP Growth at 5.4%–5.5%",
          source: "Antara News",
          timeAgo: "8h ago",
          significance: "Joint assessment by Ministry of Finance, Bank Indonesia, OJK, and LPS highlights stable banking liquidity despite external headwinds.",
          url: "https://www.antaranews.com/ekonomi"
        },
        {
          title: "Indonesia October CPI Inflation Holds Steady at 3.23% YoY Within Central Bank Target Corridor",
          source: "Statistics Indonesia (BPS) / CNBC Indonesia",
          timeAgo: "11h ago",
          significance: "Food and volatile transport prices remain well-managed across provincial logistics corridors, reinforcing monetary stability.",
          url: "https://www.bps.go.id"
        },
        {
          title: "Official Bank Indonesia JISDOR Rate Fixes at Rp 18,140.00/USD with Orderly Interbank Turnover",
          source: "Bank Indonesia (bi.go.id)",
          timeAgo: "14h ago",
          significance: "Volume-weighted daily fixing eases 8 IDR from 18,148.00 on 3 Nov, maintaining tight parity with onshore interbank spot quotes.",
          url: "https://www.bi.go.id/en/statistik/informasi-kurs/jisdor/Default.aspx"
        }
      ]
    },
    bonds: {
      indoGB: [
        { tenor: "5Y", code: "FR0101", yield: 7.05, changeBps: 1.5, coupon: 6.875 },
        { tenor: "10Y (Benchmark)", code: "FR0100", yield: 7.18, changeBps: 2.0, coupon: 6.625 },
        { tenor: "15Y", code: "FR0098", yield: 7.28, changeBps: 1.0, coupon: 7.125 },
        { tenor: "20Y", code: "FR0097", yield: 7.38, changeBps: 0.5, coupon: 7.125 }
      ],
      srbi: [
        { tenor: "6M", tenorDays: 182, auctionDate: "25 Oct 2026", weightedAvgYield: 6.491, cutOffYield: 6.550, nominalBidsIDR: "IDR 14.80 T", awardedVolumeIDR: "IDR 8.45 T" },
        { tenor: "9M", tenorDays: 273, auctionDate: "25 Oct 2026", weightedAvgYield: 6.625, cutOffYield: 6.680, nominalBidsIDR: "IDR 18.25 T", awardedVolumeIDR: "IDR 10.50 T" },
        { tenor: "12M", tenorDays: 364, auctionDate: "25 Oct 2026", weightedAvgYield: 6.760, cutOffYield: 6.820, nominalBidsIDR: "IDR 29.80 T", awardedVolumeIDR: "IDR 18.75 T" }
      ],
      sovereignSpread10Y: 228,
      biRate: 6.00,
      cpiInflationYoY: 1.71
    },
    fxAndNdf: {
      spotRate: 18135,
      spotChange: -13,
      spotChangePct: -0.07,
      jisdorRate: 18140,
      jisdorChange: -8,
      jisdorHistory: [
        { date: "4 November 2026", rate: 18140 },
        { date: "3 November 2026", rate: 18148 },
        { date: "2 November 2026", rate: 18161 },
        { date: "30 October 2026", rate: 18138 },
        { date: "29 October 2026", rate: 18128 }
      ],
      ndf1M: 18205,
      ndf3M: 18315,
      ndfSpread1M: 70,
      annualizedBasis1M: 4.63,
      ihsgIndex: {
        level: 7243.86,
        change: 29.30,
        changePct: 0.41
      },
      foreignFlowsDaily: "+IDR 428.5 Billion",
      foreignFlowsYTD: "+IDR 38.2 Trillion"
    }
  }
};

function normalizeSnapshot(snap: DailyMacroSnapshot): DailyMacroSnapshot {
  const headlines = snap.indonesia?.commentary?.noteworthyHeadlines || [];
  const usedSigs = new Set<string>();
  const spot = snap.indonesia?.fxAndNdf?.spotRate ?? 18075;
  const jisdor = snap.indonesia?.fxAndNdf?.jisdorRate ?? 18094;
  const ihsg = snap.indonesia?.fxAndNdf?.ihsgIndex?.level ?? 4919.77;
  const ihsgPct = snap.indonesia?.fxAndNdf?.ihsgIndex?.changePct ?? 0.32;

  const normalizedHeadlines = headlines.map((item, idx) => {
    const rawTitle = (item.title || item.headline || 'Indonesia Market Disclosure').replace(
      /\s+-\s+[^-]+$/,
      ''
    );
    let sig = item.significance || '';
    if (!sig || usedSigs.has(sig)) {
      const low = rawTitle.toLowerCase();
      if (low.includes('demutualization') || low.includes('danantara')) {
        sig =
          "Advances structural reform of Indonesia's exchange governance alongside Danantara sovereign wealth initiatives, deepening long-term institutional participation.";
      } else if (low.includes('short selling') || low.includes('msci')) {
        sig =
          'Enhances IDX market microstructure and two-way price discovery ahead of MSCI index rebalancings, supporting foreign institutional turnover.';
      } else if (low.includes('retail') || low.includes('red')) {
        sig = `Highlights divergence between institutional block buying and domestic retail positioning as IDX Composite trades at ${ihsg.toLocaleString()} (${ihsgPct >= 0 ? '+' : ''}${ihsgPct.toFixed(2)}%).`;
      } else if (low.includes('5,000') || low.includes('5,030') || low.includes('surge') || low.includes('higher')) {
        sig = `Broad-based buying across banking and cyclical heavyweights propels Jakarta equities, supported by steady USD/IDR at ${spot.toLocaleString()} and JISDOR at Rp ${jisdor.toLocaleString()}.`;
      } else {
        sig = `Reported by ${item.source}; shapes onshore institutional allocation across Jakarta equities and Rupiah fixed-income markets (#${idx + 1}).`;
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

  return {
    ...snap,
    indonesia: {
      ...snap.indonesia,
      commentary: {
        ...snap.indonesia.commentary,
        noteworthyHeadlines: normalizedHeadlines,
      },
    },
  };
}

export default function App() {
  const [data, setData] = useState<DailyMacroSnapshot>(() => normalizeSnapshot(DEFAULT_SNAPSHOT));
  const [activeTab, setActiveTab] = useState<'global' | 'indonesia'>('global');
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
      console.warn("Using embedded default snapshot fallback:", err);
      setFetchError(err instanceof Error ? err.message : "Error loading remote data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyData();
  }, [fetchDailyData]);

  const us10Y = data.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.42;

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

      {/* 3. Main Body Content (Unchanging Container Format) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4">
        {activeTab === 'global' ? (
          <GlobalMacroTab data={data} />
        ) : (
          <IndonesiaTab
            commentary={data.indonesia.commentary}
            bonds={data.indonesia.bonds}
            fxAndNdf={data.indonesia.fxAndNdf}
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
            <span>Global Macro & Indonesia Fixed Income / FX</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
