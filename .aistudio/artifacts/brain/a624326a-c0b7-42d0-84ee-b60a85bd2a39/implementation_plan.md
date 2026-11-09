# US Equities (S&P 500) Valuation & Factor Leaderboards Tab

Add a dedicated **6. US EQUITIES (S&P 500)** tab to the institutional macro terminal that screens and ranks S&P 500 constituents across three core fundamental factor tables—**Top 10 Best Price / Forward P/E**, **Top 10 Best Free Cash Flow / Enterprise Value (FCF/EV Yield)**, and **Top 10 Best Dividend / Price (Dividend Yield)**—complete with component numerator/denominator inputs, data provenance and formula methodology sub-notes under every table, a **Gemini 4 Argon S&P 500 Equity Valuation & Factor Synthesis** box, and a live S&P 500 institutional news feed.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and screening decisions incorporate your confirmed preferences from the clarification step:

- **Confirmed Decision 1 — Institutional Outlier & Sector Screening Filters**:
  - **Price / Forward P/E Leaderboard**: Filters for positive NTM consensus Forward EPS and enforces an institutional floor ($\text{Forward P/E} \ge 4.0\times$) to exclude distressed stubs or one-time litigation/tax accounting distortions.
  - **Free Cash Flow / Enterprise Value ($\text{FCF / EV}$) Leaderboard**: Excludes GICS Financials and Real Estate (REITs) where balance-sheet debt/deposits distort Enterprise Value, ranking operating non-financial S&P 500 constituents with highest trailing-12-month (TTM) Levered/Unlevered Free Cash Flow relative to current Enterprise Value.
  - **Dividend / Price (Dividend Yield) Leaderboard**: Ranks S&P 500 constituents by highest indicated annual regular cash dividend divided by current share price, screened for positive Free Cash Flow / FFO payout sustainability.
- **Confirmed Decision 2 — Rich Component Input Columns & Daily Price Action**:
  - Each Top 10 table displays **Rank**, **Ticker & Company Name**, **GICS Sector**, **Share Price ($)**, **1D Change (%)**, the **Component Inputs** used to compute the ratio (Consensus NTM Forward EPS for Table 1; TTM Free Cash Flow $B and Enterprise Value $B for Table 2; Indicated Annual Dividend $/sh and Payout/FCF Coverage for Table 3), and the **Primary Ratio** highlighted in tabular monospace figures.
- **Confirmed Decision 3 — Full Institutional Tab Layout**:
  - Includes a top 6-card S&P 500 Valuation & Equity Risk Premium (ERP) summary bar, the **Gemini 4 Argon S&P 500 Valuation, ERP & Factor Rotation Synthesis** commentary box, the three Top 10 fundamental factor tables (each with its dedicated data-source & formula derivation sub-note), and a live **Noteworthy S&P 500 Earnings, Valuation & Sector Rotation Developments** RSS feed with unique per-headline `Market Significance`.

---

## 1. Overview & Core Concept

- **What It Does**: Extends the macro terminal from sovereign rates and FX into **US Large-Cap Equities (S&P 500)**, giving portfolio managers and cross-asset analysts an immediate quantitative view of S&P 500 index-level valuation (Index Level, Forward P/E, Earnings Yield vs. 10Y US Treasury Yield / Equity Risk Premium) alongside three fundamental value, cash-return, and income factor screens refreshed by the live data pipeline.
- **Target Audience / Persona**: Cross-asset macro traders, equity portfolio managers, and institutional researchers comparing S&P 500 earnings/cash-flow yields against the 10-Year US Treasury risk-free hurdle rate.
- **Key Value**: Pairs live market price action with transparent fundamental numerator/denominator components and explicit methodological footnotes under each table explaining exactly where the market/fundamental data is sourced and how each ratio is derived and interpreted.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Tab Selection & Top Bar Telemetry**: Clicking **6. US EQUITIES (S&P 500)** in the navigation bar switches the viewport and updates the right-hand telemetry snippet to show live **S&P 500 Index / E-mini**, **S&P 500 Fwd P/E**, and **Equity Risk Premium (ERP vs. 10Y UST)**.
  2. **6-Card S&P 500 Factor & ERP Strip**: Displays S&P 500 Index Price & 1D %, Index NTM Forward P/E & Earnings Yield ($E/P$), S&P 500 Equity Risk Premium vs. 10Y UST, Median Top-10 Forward P/E Leader, Median Top-10 FCF/EV Yield Leader, and Median Top-10 Dividend/Price Yield Leader.
  3. **Gemini 4 Argon Equity Synthesis**: Summarizes S&P 500 valuation multiples against the live 10Y US Treasury yield, highlights critical index support/resistance levels, and flags upcoming catalysts (NVDA/mega-cap earnings, FOMC discount-rate sensitivity, quarterly S&P 500 buyback/dividend windows).
  4. **Interactive Sector / Search Filter & Three Top 10 Factor Tables**: Users can inspect all three Top 10 tables side-by-side or filter/highlight across sectors, with every table followed by a structured **Data Source & Ratio Derivation Sub-Note** panel detailing:
     - **Market & Fundamental Data Provenance** (Yahoo Finance v8/v10 live quote & key-statistics feeds + SEC EDGAR 10-K/10-Q TTM cash flow & balance sheet filings).
     - **Exact Mathematical Formula** (numerator and denominator definition).
     - **Institutional Economic Interpretation** (why a lower Forward P/E or higher FCF/EV and Dividend/Price signals valuation margin of safety and cash return).
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-density institutional Metal & Blue financial terminal matching the existing 5 tabs.
  - *Color Palette & Mood*: Deep slate canvas (`#0e141d`), elevated panel surfaces (`#131b27`), crisp 1px structural borders (`border-slate-700/80`), sky/blue primary factor highlights (`text-sky-300`, `text-blue-400`), and semantic daily change indicators (`text-emerald-400` for gains, `text-rose-400` for declines).
  - *Typography & Hierarchy*: Display headers in `Plus Jakarta Sans` / `Outfit`, dense analytical prose in `DM Sans`, and strict `font-mono tabular-nums` alignment across all prices, multiples, dollar billions, and percentage yields.
  - *Single-Elevation & Zero-Pill Discipline*: Flat 1px-bordered institutional data tables with compact row heights (`36px–40px`), right-aligned numeric columns, and unboxed metadata with typographic (`·`) separators.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Live Price Refresh Combined with Fundamental Denominators**:
  - *Chosen Approach*: The daily refresh pipeline (`update_daily_macro.py`) fetches live market prices and daily percentage changes for the S&P 500 factor universe via Yahoo Finance and recomputes **Price / Forward P/E**, **FCF / Enterprise Value** (updating Market Cap and EV dynamically with live share price), and **Dividend / Price** on every run.
  - *Why*: Ensures ratios are never frozen static numbers—when a stock rallies or sells off on a given day, its live share price, Market Cap, Enterprise Value, Forward P/E, FCF/EV yield, and Dividend/Price yield dynamically update in lockstep.
- **Decision 2 — Dedicated Sub-Note Block Under Each of the Three Tables**:
  - *Chosen Approach*: Render an explicit, multi-part methodological footnote directly inside the bottom of each of the 3 table containers (`Data Provenance`, `Formula & Derivation`, and `What the Ratio Means & Institutional Screening Rule`).
  - *Why*: Directly fulfills your requirement that each table clearly document where its market data is derived and what the ratio means and how it is calculated.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                 Live Data Refresh Pipeline (Daily / On-Demand)               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌────────────┐  │
│  │ Yahoo Finance Quote API  │  │ SEC 10-K/10-Q & Consensus│  │ Google News│  │
│  │ (Live Price, 1D%, Market │  │ Fundamentals (NTM EPS,   │  │ S&P 500 RSS│  │
│  │  Cap & Net Debt Inputs)  │  │  TTM FCF, Indicated Div) │  │ Live Feed  │  │
│  └────────────┬─────────────┘  └─────────────┬────────────┘  └─────┬──────┘  │
│               └───────────────┬──────────────┘                     │         │
│                               ▼                                    ▼         │
│         Recompute Live Ratios (P/Fwd EPS, FCF/EV, Div/P) + Unique News Sigs  │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      Application State & Normalization                       │
│  • Normalizes S&P 500 snapshot & deduplicates news Market Significance       │
│  • Synthesizes Gemini 4 Argon S&P 500 Equity Valuation & ERP Commentary      │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     6. US EQUITIES (S&P 500) Tab View                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Top 6-Card S&P 500 Index, Fwd P/E, Earnings Yield & ERP Summary Strip  │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ Gemini 4 Argon S&P 500 Equity Valuation, ERP & Factor Synthesis Box    │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ Interactive Sector Filter & Factor Search Toolbar                      │  │
│  ├───────────────────────────────────┬────────────────────────────────────┤  │
│  │ Table 1: Top 10 Price / Fwd P/E   │ Table 2: Top 10 FCF / Current EV   │  │
│  │ • Ticker, Sector, Price, 1D%      │ • Ticker, Sector, Price, 1D%       │  │
│  │ • NTM Fwd EPS ($) & Fwd P/E (x)   │ • TTM FCF ($B), EV ($B) & FCF/EV % │  │
│  │ • Sub-Note: Source & Derivation   │ • Sub-Note: Source & Derivation    │  │
│  ├───────────────────────────────────┴────────────────────────────────────┤  │
│  │ Table 3: Top 10 Dividend / Price  │ Live S&P 500 Macro & Earnings News │  │
│  │ • Ticker, Sector, Price, 1D%      │ • Top 5 Curated US Equity Stories  │  │
│  │ • Annual Div ($/sh) & Div/Price % │ • Unique Market Significance per   │  │
│  │ • Sub-Note: Source & Derivation   │   headline                         │  │
│  └───────────────────────────────────┴────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & Ratio Definitions**:
  1. **Table 1 — Top 10 Best Price / Forward P/E (`topForwardPe`)**:
     - $\text{Forward P/E} = \frac{\text{Current Market Share Price } (P_0)}{\text{Consensus NTM Forward Diluted EPS } (\text{EPS}_{\text{NTM}})}$ (sorted lowest positive multiple first, $\ge 4.0\times$, with implied Forward Earnings Yield $E_{\text{NTM}}/P_0$ also shown).
  2. **Table 2 — Top 10 Best Free Cash Flow / Current Enterprise Value (`topFcfToEv`)**:
     - $\text{FCF / EV Yield} = \frac{\text{TTM Free Cash Flow } (\text{Operating Cash Flow} - \text{CapEx})}{\text{Current Enterprise Value } (\text{Live Market Cap} + \text{Total Debt} - \text{Cash \& Equivalents})}$ (sorted highest percentage yield first across non-financial S&P 500 constituents).
  3. **Table 3 — Top 10 Best Dividend / Price (`topDividendYield`)**:
     - $\text{Dividend / Price Yield} = \frac{\text{Indicated Annual Regular Cash Dividend per Share } (D_1)}{\text{Current Market Share Price } (P_0)}$ (sorted highest percentage yield first, screened for positive FCF/FFO coverage).
- **Interactive Component & State Mapping**:
  - **Sector Filter & Search**: Clicking a GICS sector filter button (`All Sectors`, `Energy`, `Health Care`, `Technology`, `Consumer`, `Utilities & Telecom`, `Industrials`) or typing a ticker/company query highlights or filters matching constituents across the three valuation tables.
  - **Sort Direction Toggle**: Users can toggle between standard "Best Ranked" order and secondary sorting by 1D Price Change % or component size.
