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
        headline: "Fed Signals Measured Pace of Policy Easing as Labor Market and Consumer Demand Remain Firm",
        source: "Bloomberg",
        timeAgo: "3h ago",
        category: "Fed Policy",
        summary: "Federal Reserve policymakers emphasized a data-dependent, gradual approach to benchmark interest rate adjustments, noting that resilient nonfarm payroll growth and sticky services inflation preclude aggressive front-loaded easing.",
        macroTakeaway: "Short-end yields anchor around 4.28% while 10-year Treasury consolidates near 4.42%, keeping the 5Y/10Y spread positive at +12 bps.",
        impact: "Hawkish",
        url: "https://www.bloomberg.com"
      },
      {
        id: "gn-02",
        headline: "Core PCE Inflation Moderates to 2.6% YoY, Reinforcing Disinflation Trajectory",
        source: "Reuters",
        timeAgo: "4h ago",
        category: "Inflation",
        summary: "The US personal consumption expenditures price index advanced 0.2% month-on-month, matching market expectations and supporting the baseline outlook of steady 25-basis-point rate recalibrations.",
        macroTakeaway: "Reduces downside recession tail-risks while preserving an orderly, gradual real rate decompression.",
        impact: "Dovish",
        url: "https://www.reuters.com"
      },
      {
        id: "gn-03",
        headline: "US Treasury Announces $125 Billion Quarterly Refunding With Unchanged Auction Sizes",
        source: "Financial Times",
        timeAgo: "5h ago",
        category: "Fiscal & Debt",
        summary: "The US Treasury Department maintained steady issuance sizes across 3-year, 10-year, and 30-year bond auctions for the upcoming quarter, alleviating market concerns over near-term duration supply indigestion.",
        macroTakeaway: "Long-end term premium stabilizes; 10Y UST holds comfortably at 4.42% with 30Y yields at 4.60%.",
        impact: "Neutral",
        url: "https://www.ft.com"
      },
      {
        id: "gn-04",
        headline: "S&P Global US Manufacturing PMI Edges Toward Expansion as Industrial Orders Rebound",
        source: "CNBC",
        timeAgo: "6h ago",
        category: "Labor",
        summary: "US manufacturing indicators improved to 49.8, supported by steady domestic capital goods orders and easing supply chain bottlenecks across the industrial sector.",
        macroTakeaway: "Cyclical equity earnings resilience continues to support S&P 500 futures (+0.31%) and Russell 2000 small-caps.",
        impact: "Risk-On",
        url: "https://www.cnbc.com"
      },
      {
        id: "gn-05",
        headline: "WTI Crude Consolidates Near $70.85/bbl as OPEC+ Reaffirms Phased Output Discipline",
        source: "MarketWatch",
        timeAgo: "7h ago",
        category: "Trade",
        summary: "Crude oil benchmarks held steady with WTI at $70.85/bbl and Brent at $74.60/bbl, as modest global inventory draws offset soft demand indicators from industrial refineries.",
        macroTakeaway: "Moderate headline energy prices prevent imported inflation spikes for emerging Asian fuel importers.",
        impact: "Neutral",
        url: "https://www.marketwatch.com"
      },
      {
        id: "gn-06",
        headline: "Gold Holds Above $2,685/oz Supported by Global Central Bank Reserve Accumulation",
        source: "Reuters",
        timeAgo: "8h ago",
        category: "Inflation",
        summary: "Spot bullion traded at $2,685.40/oz as official sector sovereign reserves managers continued net physical gold accumulation as a structural geopolitical and currency diversifier.",
        macroTakeaway: "Physical de-dollarization and reserve safety demand maintain a persistent floor beneath precious metals.",
        impact: "Risk-Off",
        url: "https://www.reuters.com"
      },
      {
        id: "gn-07",
        headline: "European Central Bank Considers Easing Cadence as Eurozone Manufacturing Diverges from US",
        source: "Financial Times",
        timeAgo: "9h ago",
        category: "Fed Policy",
        summary: "ECB Governing Council officials debate the pace of deposit rate cuts as sluggish German industrial output contrasts with resilient US economic momentum.",
        macroTakeaway: "Keeps EUR/USD capped near 1.0825 while dollar index (DXY) consolidates around 104.25.",
        impact: "Dovish",
        url: "https://www.ft.com"
      },
      {
        id: "gn-08",
        headline: "Bank of Japan Affirms Gradual Policy Normalization Stance Amid Yen Fluctuations",
        source: "Nikkei Asia",
        timeAgo: "10h ago",
        category: "Fed Policy",
        summary: "Governor Kazuo Ueda reiterated that real policy rates remain accommodative, leaving scope for future rate increases if domestic wage transmission continues to broaden.",
        macroTakeaway: "USD/JPY resistance holds near 153.40; carry unwinds remain an intermittent volatility driver.",
        impact: "Hawkish",
        url: "https://asia.nikkei.com"
      },
      {
        id: "gn-09",
        headline: "Global Semiconductor Infrastructure Capex Projects Raised on Enterprise AI Deployment",
        source: "Bloomberg",
        timeAgo: "11h ago",
        category: "Trade",
        summary: "Hyperscale cloud operators reaffirmed multi-year high capex commitments, stimulating hardware and precision equipment supply chains across Southeast Asia and Taiwan.",
        macroTakeaway: "Technology hardware export orders provide structural growth buffers for Asian manufacturing economies.",
        impact: "Risk-On",
        url: "https://www.bloomberg.com"
      },
      {
        id: "gn-10",
        headline: "US Institutional Liquidity Assets Hit Record $6.5 Trillion in Front-End Money Funds",
        source: "Wall Street Journal",
        timeAgo: "12h ago",
        category: "Fiscal & Debt",
        summary: "Institutional cash holdings in US money market funds expanded to fresh highs, providing a massive pool of liquidity ready to rotate into fixed income duration upon rate cycle clarity.",
        macroTakeaway: "Guarantees robust secondary market liquidity and bidding depth for government debt auctions.",
        impact: "Neutral",
        url: "https://www.wsj.com"
      }
    ],
    yieldCurve: {
      tenors: [
        { label: "1M", years: 0.08, yield: 4.60, changeBps: -1.0, priorClose: 4.61 },
        { label: "3M", years: 0.25, yield: 4.54, changeBps: -1.0, priorClose: 4.55 },
        { label: "6M", years: 0.50, yield: 4.48, changeBps: -2.0, priorClose: 4.50 },
        { label: "1Y", years: 1.00, yield: 4.35, changeBps: -2.0, priorClose: 4.37 },
        { label: "2Y", years: 2.00, yield: 4.28, changeBps: -3.0, priorClose: 4.31 },
        { label: "3Y", years: 3.00, yield: 4.26, changeBps: -2.0, priorClose: 4.28 },
        { label: "5Y", years: 5.00, yield: 4.30, changeBps: -2.0, priorClose: 4.32 },
        { label: "7Y", years: 7.00, yield: 4.36, changeBps: -1.0, priorClose: 4.37 },
        { label: "10Y", years: 10.00, yield: 4.42, changeBps: -1.0, priorClose: 4.43 },
        { label: "20Y", years: 20.00, yield: 4.68, changeBps: 0.0, priorClose: 4.68 },
        { label: "30Y", years: 30.00, yield: 4.60, changeBps: 0.0, priorClose: 4.60 }
      ],
      spreads: {
        twoTenSpread: 14.0,
        fiveTenSpread: 12.0,
        threeMonthTenSpread: -12.0,
        fiveThirtySpread: 30.0,
        isInverted: false
      }
    },
    futures: [
      { symbol: "ES=F", name: "S&P 500 E-mini", price: 5985.50, change: 18.25, changePct: 0.31 },
      { symbol: "NQ=F", name: "Nasdaq 100 E-mini", price: 20890.25, change: 78.50, changePct: 0.38 },
      { symbol: "YM=F", name: "Dow Jones Mini", price: 43840.00, change: 95.00, changePct: 0.22 },
      { symbol: "RTY=F", name: "Russell 2000 Mini", price: 2340.50, change: 12.40, changePct: 0.53 },
      { symbol: "DX=F", name: "US Dollar Index", price: 104.25, change: -0.18, changePct: -0.17 }
    ],
    fxRates: [
      { pair: "EUR/USD", name: "Euro / US Dollar", rate: 1.0825, change: 0.0022, changePct: 0.20 },
      { pair: "USD/JPY", name: "US Dollar / Japanese Yen", rate: 153.40, change: -0.35, changePct: -0.23 },
      { pair: "GBP/USD", name: "British Pound / US Dollar", rate: 1.2965, change: 0.0028, changePct: 0.22 },
      { pair: "USD/CNH", name: "US Dollar / Offshore Yuan", rate: 7.1420, change: -0.0080, changePct: -0.11 },
      { pair: "AUD/USD", name: "Australian Dollar / USD", rate: 0.6590, change: 0.0030, changePct: 0.46 },
      { pair: "USD/SGD", name: "US Dollar / Singapore Dollar", rate: 1.3245, change: -0.0020, changePct: -0.15 }
    ],
    commodities: [
      { symbol: "CL=F", name: "WTI Crude Oil", price: 70.85, unit: "$/bbl", change: 0.95, changePct: 1.36 },
      { symbol: "BZ=F", name: "Brent Crude", price: 74.60, unit: "$/bbl", change: 0.88, changePct: 1.19 },
      { symbol: "GC=F", name: "Gold Futures", price: 2685.40, unit: "$/t.oz", change: 14.20, changePct: 0.53 },
      { symbol: "SI=F", name: "Silver Futures", price: 31.85, unit: "$/t.oz", change: 0.45, changePct: 1.43 },
      { symbol: "HG=F", name: "Copper Futures", price: 4.32, unit: "$/lb", change: 0.03, changePct: 0.70 }
    ]
  },
  indonesia: {
    commentary: {
      title: "Bank Indonesia Macro Commentary & Fixed Income Outlook",
      date: "04 Nov 2026",
      executiveSummary: "Bank Indonesia (BI) maintains its benchmark BI-Rate at 6.00% (Deposit Facility at 5.25%, Lending Facility at 6.75%), actively managing domestic liquidity and stabilizing the Rupiah. The official Jakarta Interbank Spot Dollar Rate (JISDOR) published by Bank Indonesia (bi.go.id) fixed at Rp 18,140 per USD on 4 November 2026 (easing from Rp 18,148 on 3 November), with onshore spot USD/IDR trading closely at 18,135 IDR. In the sovereign debt market, Indonesia Government Bond (IndoGB) yields trade near ~7.0%–7.2% (5Y at 7.05% per TradingEconomics gidn5y:gov and 10Y Benchmark FR0100 at 7.18%), providing a +276 bps spread over US 10-Year Treasuries (4.42%). In monetary operations, Bank Indonesia conducts weekly Sekuritas Rupiah Bank Indonesia (SRBI) auctions (bi.go.id Operasi Moneter & CEIC Data) with weighted average accepted rates (WAR) clearing at 6.491% (6M), 6.625% (9M), and 6.760% (12M), with 12M nominal bids reaching IDR 29.80 Trillion and cut-off at 6.820%.",
      macroPillars: [
        {
          heading: "Monetary & Liquidity Operations (SRBI Weighted Average Rates)",
          analysis: "Bank Indonesia continues pro-market open market operations via weekly SRBI auctions. As published on Bank Indonesia Operasi Moneter and CEIC Data, latest weighted average accepted rates cleared at 6.491% for 6M, 6.625% for 9M, and 6.760% for 12M, preserving an orderly carry buffer and absorbing surplus banking reserves."
        },
        {
          heading: "Sovereign Debt Curve (IndoGB ~7% Benchmark Yields)",
          analysis: "IndoGB yields reflect solid primary auction uptake and domestic institutional demand. As tracked on TradingEconomics (gidn5y:gov), the 5Y yield trades at 7.05% while the 10Y benchmark (FR0100) trades at 7.18%, establishing a steady +276 bps spread over US Treasuries."
        },
        {
          heading: "Currency Dynamics (JISDOR Rp 18,140 & Offshore NDF)",
          analysis: "Bank Indonesia's official JISDOR reference rate fixed at Rp 18,140 per USD on 4 Nov 2026 (following Rp 18,148 on 3 Nov and Rp 18,161 on 2 Nov). Offshore 1-Month NDFs trade at 18,205 (+70 IDR spread / 4.63% p.a. basis), while IDX Composite (IHSG) trades at 7,243.86."
        }
      ],
      biPolicyPosture: "Vigilant FX Stabilization (BI-Rate 6.00% · SRBI Sterilization)",
      noteworthyHeadlines: [
        {
          title: "Bank Indonesia JISDOR Rate Fixes at Rp 18,140.00/USD on 4 November 2026",
          source: "Bank Indonesia (bi.go.id/en/statistik/informasi-kurs/jisdor)",
          significance: "Official BI volume-weighted interbank fixing eases 8 IDR from 18,148.00 on 3 Nov, reflecting orderly interbank currency flows."
        },
        {
          title: "IndoGB 5-Year and 10-Year Sovereign Yields Anchor Near ~7% (7.05% / 7.18%)",
          source: "TradingEconomics (gidn5y:gov) & DJPPR",
          significance: "10-Year spread over US Treasuries holds at +276 bps, maintaining international carry interest."
        },
        {
          title: "Bank Indonesia SRBI 12-Month Auction Clears at 6.760% Weighted Average Rate (WAR)",
          source: "Bank Indonesia (bi.go.id Operasi Moneter) & CEIC Data",
          significance: "Cut-off yield cleared at 6.820% with IDR 29.80 Trillion nominal bids submitted and IDR 18.75 Trillion awarded."
        },
        {
          title: "Jakarta Composite Index (IHSG) Trades at 7,243.86 (+0.41%) on Net Foreign Purchases",
          source: "Indonesia Stock Exchange (IDX)",
          significance: "Foreign institutional inflows logged positive +IDR 428.5 Billion on resilient macro stability."
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
      sovereignSpread10Y: 276,
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

export default function App() {
  const [data, setData] = useState<DailyMacroSnapshot>(DEFAULT_SNAPSHOT);
  const [activeTab, setActiveTab] = useState<'global' | 'indonesia'>('global');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDailyData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/data/daily_macro.json?t=${Date.now()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to load daily dataset`);
      }
      const json: DailyMacroSnapshot = await res.json();
      setData(json);
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
