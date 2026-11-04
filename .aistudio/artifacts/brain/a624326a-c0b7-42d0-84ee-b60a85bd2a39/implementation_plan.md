# Global Macro & Indonesia Market Terminal (Porkbun GitHub Connected)

A high-density financial terminal delivering daily US/global macro analysis, Treasury yield curves, global futures, commodities, FX, and Indonesian domestic markets (IndoGB, SRBI, USD/IDR Spot & NDFs). Built as a pure static web application designed to deploy seamlessly via Porkbun's native GitHub integration whenever updated daily JSON data is committed.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following adjustments have been incorporated per your revision request:

- **Strict Two-Tab Architecture**: Tab 3 (Pipeline & Export Tool) and in-app setup scripts have been completely removed. The interface strictly features:
  1. **Global Macro & Markets** (Top 10 Global/US Macro News, US Treasury Yield Curve, Futures, FX, Oil & Gold)
  2. **Indonesia Market** (Macro Commentary & Noteworthy News, IndoGB, SRBI, USD/IDR Spot & NDFs)
- **Streamlined Porkbun GitHub Workflow**: The application reads from `/data/daily_macro.json`. Whenever daily data is updated and committed to GitHub, Porkbun automatically detects the push and redeploys the static site without any manual export steps or complex server configurations.
- **Permanent Layout & Format**: The visual hierarchy, grid layout, metrics, and cards remain rock-solid and unchanging, with only the underlying data points, curves, and market commentaries updating daily.

---

## 1. Overview & Core Concept

### What It Does
The terminal provides institutional-grade market telemetry split across two dedicated tabs:
1. **Global Macro & Markets (Focus on US Macro)**:
   - **Top 10 Global Macro News**: Ranked by market relevance with primary focus on US macroeconomics (inflation, labor, Federal Reserve policy, trade). Each item provides source, timestamp, headline, a concise 2-sentence macro synthesis, and market impact badge.
   - **US Treasury Yield Curve**: Live visualization across 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, and 30Y tenors, complete with 2Y/10Y spread, 3M/10Y inversion monitor, and daily basis point deltas.
   - **Futures Contracts & Prices**: Major equity indices (S&P 500 ES=F, Nasdaq NQ=F, Dow YM=F, Russell 2000 RTY=F) with real-time settlement and change percentages.
   - **Global FX & Commodities**: DXY Dollar Index, EUR/USD, USD/JPY, GBP/USD, USD/CNH, alongside WTI Crude Oil, Brent Crude, Gold (GC=F), Silver, and Copper.

2. **Indonesia Market**:
   - **Market Commentary & Noteworthy News**: Institutional morning briefing covering Bank Indonesia (BI) monetary stance, Rupiah liquidity, inflation dynamics, fiscal policies, and critical domestic macro developments.
   - **Sovereign & Central Bank Debt**:
     - **IndoGB (Indonesian Government Bonds)**: Benchmark yields across 5Y, 10Y, 15Y, and 20Y maturities with coupon rates and 10Y IndoGB vs. 10Y US Treasury sovereign yield spread.
     - **SRBI (Sekuritas Rupiah Bank Indonesia)**: Central bank monetary operation auction yields across 6M, 9M, and 12M tenors with latest auction dates and cut-off levels.
   - **Foreign Exchange & NDFs**:
     - **USD/IDR Spot & JISDOR**: Bank Indonesia Jakarta Interbank Spot Dollar Rate (JISDOR) and spot market exchange rates.
     - **USD/IDR Non-Deliverable Forwards (NDFs)**: 1-Month and 3-Month offshore NDF pricing with onshore-offshore basis spreads.
     - **Equity & Flow Context**: IDX Composite (IHSG) performance and foreign portfolio net flow indicator.

### Target Audience & Persona
Macro strategists, portfolio managers, corporate treasurers, and market observers tracking global macro transmissions, Fed rate expectations, and Indonesian domestic debt/currency dynamics daily.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Morning Market Scan (Global Macro)**:
   - User loads the site. The top bar displays current SGT session time, data freshness timestamp, and market session indicators (Asian, European, US).
   - In Tab 1, the user scans the US Treasury yield curve, checks key spread levels (2Y/10Y), monitors futures & commodities, and reads the curated Top 10 global macro headlines with structured macro takeaways.
2. **Indonesian Fixed Income & FX Review**:
   - User clicks the **Indonesia** tab.
   - The user immediately reads the overnight Indonesian macro commentary and policy stance.
   - The bond matrix shows IndoGB yields alongside SRBI auction cut-off rates and the 10Y sovereign spread over US Treasuries.
   - The currency section shows USD/IDR Spot, JISDOR, and 1M/3M NDFs with offshore basis differentials.

### Visual Identity & Theme
- **Aesthetic Direction**: High-density Bloomberg / Refinitiv financial workstation with razor-sharp borders and zero visual fluff.
- **Color Palette**:
  - Background Canvas (60%): `#0a0d14` (Deep Obsidian) and `#101520` (Card Base).
  - Structural Hairlines & Borders (30%): `#1f293d` (Subtle 1px Borders).
  - Financial Accents (10%):
    - Amber/Gold (`#f59e0b`): Terminal branding, active tab indicators, key yield figures.
    - Emerald Green (`#10b981`): Positive basis point changes, equity gains, risk-on indicators.
    - Crimson Red (`#f43f5e`): Inversions, selloffs, yield declines.
    - Electric Cyan (`#38bdf8`): Benchmark currency pairs and tenor markers.
- **Typography & Precision**:
  - Display & Headings: `Plus Jakarta Sans` (SemiBold 600).
  - Narrative Body: `DM Sans` (Regular 400).
  - Telemetry, Rates & Yields: Strictly enforced `JetBrains Mono` / monospace tabular numerals (`font-mono tabular-nums`).
- **Formatting Rule**: Zero-pill discipline for metadata, clean text dividers (`·`, `|`), and high-density tabular grids.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Pure Static JSON Reader for Porkbun GitHub Connection
- **Chosen Approach**: The entire site is powered by a static snapshot file located at `/data/daily_macro.json`. The web app has zero server or database dependencies.
- **Why**: Perfectly aligns with Porkbun static hosting connected to a GitHub repository. When new market data is committed to the repository, Porkbun automatically pulls the update and refreshes the live site.
- **Alternatives Considered**: Direct live scraping on page load from the browser (causes CORS blocking, rate limits, and slow initial render).

### Decision 2: Permanent Unchanging UI Structure
- **Chosen Approach**: Fixed grid sections and consistent layout containers. When data updates daily, the layout never shifts or reorganizes; only values, dates, percentages, and commentary text update.
- **Why**: Directly satisfies the requirement: *"The format of the website shouldnt change."* Traders and analysts require predictable spatial memory.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GITHUB REPOSITORY PUSH                          │
│                                                                        │
│   Daily JSON Commit: /public/data/daily_macro.json                     │
│                        │                                               │
│                        ▼                                               │
│   Porkbun Static Hosting (Auto-deploys from GitHub repository)         │
└────────────────────────┼───────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    HIGH-DENSITY FINANCIAL TERMINAL                     │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Top Bar: Session Clocks (SGT/EST) · Freshness · Session Status │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│   ┌─────────────────────────────┐ ┌─────────────────────────────┐      │
│   │ Tab 1: Global Macro & Yield │ │ Tab 2: Indonesia Market     │      │
│   └─────────────────────────────┘ └─────────────────────────────┘      │
│                                                                        │
│   TAB 1: GLOBAL MACRO & MARKETS                                        │
│   ├── Top 10 Macro News (Headline, Source, 2-line takeaway, Impact)    │
│   ├── US Treasury Yield Curve (1M to 30Y SVG Curve + 2Y/10Y Spread)   │
│   ├── Futures Contracts (ES=F, NQ=F, YM=F, RTY=F)                     │
│   └── Global FX & Commodities (EURUSD, USDJPY, DXY, Oil, Gold, Silver) │
│                                                                        │
│   TAB 2: INDONESIA MARKET                                              │
│   ├── Macro & Central Bank Commentary (BI policy, fiscal, headlines)   │
│   ├── Bond Telemetry (IndoGB 5Y/10Y/15Y/20Y, 10Y UST Spread)           │
│   ├── SRBI Auction Yields (6M, 9M, 12M Tenors, Cut-Off Rates)          │
│   └── FX & Derivatives (USD/IDR Spot, JISDOR, 1M/3M NDFs, IHSG)        │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Schema (`public/data/daily_macro.json`)
```typescript
interface DailyMacroSnapshot {
  metadata: {
    lastUpdated: string;          // ISO timestamp
    lastUpdatedSGT: string;       // e.g. "04 Nov 2026, 05:00 AM SGT"
    nextRefreshSGT: string;       // e.g. "05 Nov 2026, 05:00 AM SGT"
  };
  globalMacro: {
    topNews: Array<{
      id: string;
      headline: string;
      source: string;
      timeAgo: string;
      category: "Fed Policy" | "Inflation" | "Labor" | "Fiscal" | "Trade";
      summary: string;
      macroTakeaway: string;
      impact: "Hawkish" | "Dovish" | "Risk-On" | "Risk-Off" | "Neutral";
      url?: string;
    }>;
    yieldCurve: {
      tenors: Array<{
        label: string;
        years: number;
        yield: number;
        changeBps: number;
        priorClose: number;
      }>;
      twoTenSpread: number;
      threeMonthTenSpread: number;
      isInverted: boolean;
    };
    futures: Array<{ symbol: string; name: string; price: number; change: number; changePct: number }>;
    fxRates: Array<{ pair: string; name: string; rate: number; change: number; changePct: number }>;
    commodities: Array<{ symbol: string; name: string; price: number; unit: string; change: number; changePct: number }>;
  };
  indonesia: {
    commentary: {
      title: string;
      date: string;
      executiveSummary: string;
      macroPillars: Array<{ heading: string; analysis: string }>;
      biPolicyPosture: string;
      noteworthyHeadlines: Array<{ title: string; source: string; significance: string }>;
    };
    bonds: {
      indoGB: Array<{ tenor: string; code: string; yield: number; changeBps: number; coupon: number }>;
      srbi: Array<{ tenor: string; auctionDate: string; cutOffYield: number; tenorDays: number }>;
      sovereignSpread10Y: number; // IndoGB 10Y - UST 10Y in bps
    };
    fxAndNdf: {
      jisdorRate: number;
      spotRate: number;
      ndf1M: number;
      ndf3M: number;
      ndfSpread1M: number;
      ihsgIndex: { level: number; changePct: number };
      foreignFlowsYTD: string;
    };
  };
}
```
