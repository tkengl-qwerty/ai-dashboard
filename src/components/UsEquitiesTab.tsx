import React, { useState, useMemo } from 'react';
import { UsEquitiesData, TableMethodologySubNote } from '../types/market';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Newspaper,
  ExternalLink,
  Search,
  BarChart3,
  DollarSign,
  Percent,
  Info,
} from 'lucide-react';
import { ArgonCommentaryBox } from './ArgonCommentaryBox';

interface UsEquitiesTabProps {
  equities: UsEquitiesData;
  lastUpdatedSGT?: string;
  us10YYield: number;
}

type SortMode = 'rank' | 'changePct' | 'marketCap';

const SECTOR_GROUPS = [
  'All Sectors',
  'Energy',
  'Health Care',
  'Consumer',
  'Financials',
  'Industrials',
  'Tech & Telecom',
  'Materials',
] as const;

function matchesSectorGroup(sector: string, group: string): boolean {
  if (group === 'All Sectors') return true;
  const s = sector.toLowerCase();
  if (group === 'Energy') return s.includes('energy');
  if (group === 'Health Care') return s.includes('health');
  if (group === 'Consumer') return s.includes('consumer');
  if (group === 'Financials') return s.includes('financial');
  if (group === 'Industrials') return s.includes('industrial');
  if (group === 'Tech & Telecom') return s.includes('tech') || s.includes('communication') || s.includes('telecom');
  if (group === 'Materials') return s.includes('material');
  return true;
}

const SubNotePanel: React.FC<{ title: string; subNote: TableMethodologySubNote }> = ({ title, subNote }) => (
  <div className="mt-3 p-3 bg-[#0e141d] border border-slate-800 rounded-xs space-y-1.5 text-[11px] font-sans">
    <div className="flex items-center gap-1.5 text-sky-300 font-mono font-bold uppercase text-[10px] tracking-wider">
      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      <span>{title} · DATA DERIVATION & RATIO METHODOLOGY NOTE</span>
    </div>
    <div className="text-slate-300 leading-relaxed">
      <span className="text-slate-100 font-semibold font-mono text-[10px] uppercase">Where Market Data Is Derived: </span>
      <span>{subNote.dataSource}</span>
    </div>
    <div className="text-slate-300 leading-relaxed font-mono text-[11px] bg-[#131b27] px-2.5 py-1.5 border border-slate-800/90 rounded-xs text-sky-200">
      <span className="text-slate-400 uppercase text-[10px] mr-1.5">Formula:</span>
      {subNote.formula}
    </div>
    <div className="text-slate-300 leading-relaxed">
      <span className="text-slate-100 font-semibold font-mono text-[10px] uppercase">What the Ratio Means & How It Is Derived: </span>
      <span>{subNote.derivationAndMeaning}</span>
    </div>
    <div className="text-slate-400 leading-relaxed text-[10px] font-mono">
      <span className="text-slate-300 uppercase">Institutional Filter: </span>
      <span>{subNote.screeningRule}</span>
    </div>
  </div>
);

export const UsEquitiesTab: React.FC<UsEquitiesTabProps> = ({
  equities,
  lastUpdatedSGT,
  us10YYield,
}) => {
  const [selectedSector, setSelectedSector] = useState<string>('All Sectors');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortMode, setSortMode] = useState<SortMode>('rank');

  const {
    indexSummary,
    topForwardPe,
    forwardPeSubNote,
    topFcfToEv,
    fcfToEvSubNote,
    topDividendYield,
    dividendYieldSubNote,
    noteworthyHeadlines,
    argonCommentary,
  } = equities;

  const liveErpBps = Math.round((indexSummary.spxEarningsYieldPct - us10YYield) * 100);
  const peLeader = topForwardPe[0];
  const fcfLeader = topFcfToEv[0];
  const divLeader = topDividendYield[0];

  const filteredForwardPe = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = topForwardPe.filter((item) => {
      const sectorOk = matchesSectorGroup(item.sector, selectedSector);
      const queryOk =
        !q ||
        item.ticker.toLowerCase().includes(q) ||
        item.company.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q);
      return sectorOk && queryOk;
    });
    if (sortMode === 'changePct') return [...list].sort((a, b) => b.changePct - a.changePct);
    if (sortMode === 'marketCap') return [...list].sort((a, b) => b.marketCapBn - a.marketCapBn);
    return [...list].sort((a, b) => a.rank - b.rank);
  }, [topForwardPe, selectedSector, searchQuery, sortMode]);

  const filteredFcfEv = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = topFcfToEv.filter((item) => {
      const sectorOk = matchesSectorGroup(item.sector, selectedSector);
      const queryOk =
        !q ||
        item.ticker.toLowerCase().includes(q) ||
        item.company.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q);
      return sectorOk && queryOk;
    });
    if (sortMode === 'changePct') return [...list].sort((a, b) => b.changePct - a.changePct);
    if (sortMode === 'marketCap') return [...list].sort((a, b) => b.marketCapBn - a.marketCapBn);
    return [...list].sort((a, b) => a.rank - b.rank);
  }, [topFcfToEv, selectedSector, searchQuery, sortMode]);

  const filteredDividend = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = topDividendYield.filter((item) => {
      const sectorOk = matchesSectorGroup(item.sector, selectedSector);
      const queryOk =
        !q ||
        item.ticker.toLowerCase().includes(q) ||
        item.company.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q);
      return sectorOk && queryOk;
    });
    if (sortMode === 'changePct') return [...list].sort((a, b) => b.changePct - a.changePct);
    if (sortMode === 'marketCap') return [...list].sort((a, b) => b.marketCapBn - a.marketCapBn);
    return [...list].sort((a, b) => a.rank - b.rank);
  }, [topDividendYield, selectedSector, searchQuery, sortMode]);

  return (
    <div className="space-y-4">
      {/* Top 6-Card S&P 500 Index & Factor Valuation Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">S&P 500 INDEX (^GSPC)</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {indexSummary.spxLevel.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${indexSummary.spxChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {indexSummary.spxChangePct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>
              {indexSummary.spxChange >= 0 ? `+${indexSummary.spxChange.toFixed(2)}` : indexSummary.spxChange.toFixed(2)} (
              {indexSummary.spxChangePct >= 0 ? `+${indexSummary.spxChangePct.toFixed(2)}%` : `${indexSummary.spxChangePct.toFixed(2)}%`})
            </span>
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">S&P 500 NTM FWD P/E</div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {indexSummary.spxForwardPe.toFixed(1)}x
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Fwd E/P Yield: <span className="text-slate-200 font-semibold">{indexSummary.spxEarningsYieldPct.toFixed(2)}%</span>
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">EQUITY RISK PREMIUM</div>
          <div className="text-sm sm:text-base font-bold text-blue-400 font-mono tabular-nums mt-0.5">
            {liveErpBps >= 0 ? `+${liveErpBps}` : liveErpBps} bps
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            E/P ({indexSummary.spxEarningsYieldPct.toFixed(2)}%) vs 10Y ({us10YYield.toFixed(2)}%)
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">#1 PRICE / FWD P/E</div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {peLeader?.ticker ?? 'GM'} · {(peLeader?.forwardPe ?? 6.84).toFixed(2)}x
          </div>
          <div className="text-[10px] text-emerald-400 font-mono">
            Fwd E/P: {(peLeader?.earningsYieldPct ?? 14.62).toFixed(1)}% (${(peLeader?.forwardEps ?? 12.60).toFixed(2)} EPS)
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">#1 FCF / CURRENT EV</div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {fcfLeader?.ticker ?? 'DVN'} · {(fcfLeader?.fcfToEvPct ?? 12.84).toFixed(2)}%
          </div>
          <div className="text-[10px] text-emerald-400 font-mono">
            FCF ${(fcfLeader?.fcfTtmBn ?? 4.42).toFixed(2)}B / EV ${(fcfLeader?.enterpriseValueBn ?? 34.42).toFixed(1)}B
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">#1 DIVIDEND / PRICE</div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {divLeader?.ticker ?? 'MO'} · {(divLeader?.dividendYieldPct ?? 7.42).toFixed(2)}%
          </div>
          <div className="text-[10px] text-emerald-400 font-mono">
            ${(divLeader?.annualDividendPerShare ?? 4.08).toFixed(2)}/sh · {divLeader?.fcfPayoutRatioPct ?? 74}% FCF Payout
          </div>
        </div>
      </div>

      {/* Gemini 4 Argon S&P 500 Valuation, ERP & Factor Synthesis Box */}
      {argonCommentary && (
        <ArgonCommentaryBox
          commentary={argonCommentary}
          lastUpdatedSGT={lastUpdatedSGT}
        />
      )}

      {/* Interactive Filter & Sort Toolbar */}
      <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">GICS Sector Filter:</span>
          {SECTOR_GROUPS.map((sector) => (
            <button
              key={sector}
              onClick={() => setSelectedSector(sector)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                selectedSector === sector
                  ? 'bg-blue-600/30 border-blue-500 text-sky-200 font-semibold'
                  : 'bg-[#0e141d] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {sector}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter ticker or company..."
              className="w-full bg-[#0e141d] border border-slate-700/80 rounded-xs pl-8 pr-2.5 py-1 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#0e141d] border border-slate-800 p-0.5 rounded-xs">
            <button
              onClick={() => setSortMode('rank')}
              className={`px-2 py-1 text-[10px] font-mono rounded-xs cursor-pointer whitespace-nowrap ${
                sortMode === 'rank' ? 'bg-[#192436] text-sky-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Best Rank (1–10)
            </button>
            <button
              onClick={() => setSortMode('changePct')}
              className={`px-2 py-1 text-[10px] font-mono rounded-xs cursor-pointer whitespace-nowrap ${
                sortMode === 'changePct' ? 'bg-[#192436] text-sky-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1D Chg %
            </button>
            <button
              onClick={() => setSortMode('marketCap')}
              className={`px-2 py-1 text-[10px] font-mono rounded-xs cursor-pointer whitespace-nowrap ${
                sortMode === 'marketCap' ? 'bg-[#192436] text-sky-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mkt Cap
            </button>
          </div>

          {(selectedSector !== 'All Sectors' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedSector('All Sectors');
                setSearchQuery('');
                setSortMode('rank');
              }}
              className="px-2 py-1 text-[10px] font-mono text-sky-300 hover:text-white underline cursor-pointer whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Row 1: Table 1 (Top 10 Best Price / Forward P/E) & Table 2 (Top 10 Best FCF / Current Enterprise Value) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
        {/* TABLE 1: TOP 10 BEST PRICE / FORWARD P/E */}
        <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2.5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  1. TOP 10 S&P 500 BEST PRICE / FORWARD P/E (LOWEST MULTIPLE)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-sky-300">
                As of {equities.asOfDate}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1.5 px-1.5">#</th>
                    <th className="py-1.5 px-1.5">Constituent</th>
                    <th className="py-1.5 px-1.5">GICS Sector</th>
                    <th className="py-1.5 px-1.5 text-right">Price</th>
                    <th className="py-1.5 px-1.5 text-right">1D %</th>
                    <th className="py-1.5 px-1.5 text-right">Fwd EPS</th>
                    <th className="py-1.5 px-1.5 text-right">Fwd E/P</th>
                    <th className="py-1.5 px-1.5 text-right text-sky-300">Price / Fwd P/E</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {filteredForwardPe.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400 font-sans text-xs">
                        No Top 10 Price / Forward P/E constituents match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredForwardPe.map((item) => (
                      <tr key={item.ticker} className="hover:bg-[#192434]/60 transition-colors">
                        <td className="py-1.5 px-1.5 text-slate-400 font-bold tabular-nums">{item.rank}</td>
                        <td className="py-1.5 px-1.5 whitespace-nowrap">
                          <div className="font-bold text-slate-100">{item.ticker}</div>
                          <div className="text-[10px] text-slate-400 font-sans truncate max-w-[135px]">{item.company}</div>
                        </td>
                        <td className="py-1.5 px-1.5 text-[11px] text-slate-300 whitespace-nowrap">{item.sector}</td>
                        <td className="py-1.5 px-1.5 text-right font-semibold text-slate-100 tabular-nums whitespace-nowrap">
                          ${item.price.toFixed(2)}
                        </td>
                        <td className={`py-1.5 px-1.5 text-right font-semibold tabular-nums whitespace-nowrap ${item.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.changePct >= 0 ? `+${item.changePct.toFixed(2)}%` : `${item.changePct.toFixed(2)}%`}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-300 tabular-nums whitespace-nowrap">
                          ${item.forwardEps.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-emerald-400 tabular-nums whitespace-nowrap">
                          {item.earningsYieldPct.toFixed(1)}%
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-bold text-sky-300 tabular-nums whitespace-nowrap">
                          {item.forwardPe.toFixed(2)}x
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <SubNotePanel
            title="PRICE / FORWARD P/E"
            subNote={forwardPeSubNote}
          />
        </div>

        {/* TABLE 2: TOP 10 BEST FREE CASH FLOW / CURRENT ENTERPRISE VALUE */}
        <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2.5">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  2. TOP 10 S&P 500 BEST FREE CASH FLOW / CURRENT ENTERPRISE VALUE
                </h3>
              </div>
              <span className="text-[10px] font-mono text-sky-300">
                Non-Financials · TTM FCF / Live EV
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1.5 px-1.5">#</th>
                    <th className="py-1.5 px-1.5">Constituent</th>
                    <th className="py-1.5 px-1.5">GICS Sector</th>
                    <th className="py-1.5 px-1.5 text-right">Price</th>
                    <th className="py-1.5 px-1.5 text-right">1D %</th>
                    <th className="py-1.5 px-1.5 text-right">TTM FCF</th>
                    <th className="py-1.5 px-1.5 text-right">Curr EV</th>
                    <th className="py-1.5 px-1.5 text-right text-sky-300">FCF / EV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {filteredFcfEv.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400 font-sans text-xs">
                        No Top 10 FCF / Enterprise Value constituents match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredFcfEv.map((item) => (
                      <tr key={item.ticker} className="hover:bg-[#192434]/60 transition-colors">
                        <td className="py-1.5 px-1.5 text-slate-400 font-bold tabular-nums">{item.rank}</td>
                        <td className="py-1.5 px-1.5 whitespace-nowrap">
                          <div className="font-bold text-slate-100">{item.ticker}</div>
                          <div className="text-[10px] text-slate-400 font-sans truncate max-w-[135px]">{item.company}</div>
                        </td>
                        <td className="py-1.5 px-1.5 text-[11px] text-slate-300 whitespace-nowrap">{item.sector}</td>
                        <td className="py-1.5 px-1.5 text-right font-semibold text-slate-100 tabular-nums whitespace-nowrap">
                          ${item.price.toFixed(2)}
                        </td>
                        <td className={`py-1.5 px-1.5 text-right font-semibold tabular-nums whitespace-nowrap ${item.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.changePct >= 0 ? `+${item.changePct.toFixed(2)}%` : `${item.changePct.toFixed(2)}%`}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-emerald-400 tabular-nums whitespace-nowrap">
                          ${item.fcfTtmBn.toFixed(2)}B
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-300 tabular-nums whitespace-nowrap" title={`Market Cap $${item.marketCapBn.toFixed(1)}B + Net Debt $${item.netDebtBn.toFixed(1)}B`}>
                          ${item.enterpriseValueBn.toFixed(1)}B
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-bold text-sky-300 tabular-nums whitespace-nowrap">
                          {item.fcfToEvPct.toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <SubNotePanel
            title="FREE CASH FLOW / CURRENT ENTERPRISE VALUE (FCF / EV)"
            subNote={fcfToEvSubNote}
          />
        </div>
      </div>

      {/* Row 2: Table 3 (Top 10 Best Dividend / Price) & Live S&P 500 Macro & Earnings News Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* TABLE 3: TOP 10 BEST DIVIDEND / PRICE (7 cols) */}
        <div className="xl:col-span-7 bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2.5">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  3. TOP 10 S&P 500 BEST DIVIDEND / PRICE (HIGHEST DIVIDEND YIELD)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-sky-300">
                Indicated Annual Cash Div / Live Price
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1.5 px-1.5">#</th>
                    <th className="py-1.5 px-1.5">Constituent</th>
                    <th className="py-1.5 px-1.5">GICS Sector</th>
                    <th className="py-1.5 px-1.5 text-right">Price</th>
                    <th className="py-1.5 px-1.5 text-right">1D %</th>
                    <th className="py-1.5 px-1.5 text-right">Indicated Div</th>
                    <th className="py-1.5 px-1.5 text-right">FCF Payout</th>
                    <th className="py-1.5 px-1.5 text-right text-sky-300">Div / Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {filteredDividend.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400 font-sans text-xs">
                        No Top 10 Dividend / Price constituents match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDividend.map((item) => (
                      <tr key={item.ticker} className="hover:bg-[#192434]/60 transition-colors">
                        <td className="py-1.5 px-1.5 text-slate-400 font-bold tabular-nums">{item.rank}</td>
                        <td className="py-1.5 px-1.5 whitespace-nowrap">
                          <div className="font-bold text-slate-100">{item.ticker}</div>
                          <div className="text-[10px] text-slate-400 font-sans truncate max-w-[145px]">{item.company}</div>
                        </td>
                        <td className="py-1.5 px-1.5 text-[11px] text-slate-300 whitespace-nowrap">{item.sector}</td>
                        <td className="py-1.5 px-1.5 text-right font-semibold text-slate-100 tabular-nums whitespace-nowrap">
                          ${item.price.toFixed(2)}
                        </td>
                        <td className={`py-1.5 px-1.5 text-right font-semibold tabular-nums whitespace-nowrap ${item.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.changePct >= 0 ? `+${item.changePct.toFixed(2)}%` : `${item.changePct.toFixed(2)}%`}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-200 tabular-nums whitespace-nowrap">
                          ${item.annualDividendPerShare.toFixed(2)}/sh
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-300 tabular-nums whitespace-nowrap">
                          {item.fcfPayoutRatioPct}%
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-bold text-sky-300 tabular-nums whitespace-nowrap">
                          {item.dividendYieldPct.toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <SubNotePanel
            title="DIVIDEND / PRICE (INDICATED DIVIDEND YIELD)"
            subNote={dividendYieldSubNote}
          />
        </div>

        {/* LIVE S&P 500 EQUITY, EARNINGS & VALUATION DEVELOPMENTS FEED (5 cols) */}
        <div className="xl:col-span-5 bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  NOTEWORTHY S&P 500 EARNINGS, POLICY & FACTOR DEVELOPMENTS
                </h3>
              </div>
              <span className="text-[10px] font-mono text-sky-300">
                LIVE RSS FEED
              </span>
            </div>

            <div className="divide-y divide-slate-700/50">
              {noteworthyHeadlines.map((item, idx) => (
                <div key={idx} className="py-2.5 hover:bg-[#192434]/60 rounded-xs px-1.5 transition-colors">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sky-400 font-bold">#{idx + 1}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-200 font-medium">SOURCE: {item.source}</span>
                      {item.timeAgo && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-slate-400">{item.timeAgo}</span>
                        </>
                      )}
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 text-[10px] underline"
                        title="Read full article"
                      >
                        <span>Read</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  <h4 className="text-xs sm:text-[13px] font-semibold text-slate-100 leading-snug mb-1">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-sky-300 transition-colors inline-flex items-baseline gap-1"
                      >
                        <span>{item.title || item.headline}</span>
                      </a>
                    ) : (
                      <span>{item.title || item.headline}</span>
                    )}
                  </h4>

                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    <span className="text-slate-400">Market Significance: </span>
                    <span className="text-slate-300">{item.significance}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 p-2.5 bg-[#0e141d] border border-slate-800 rounded-xs text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span>S&P 500 Universe: 500 Large-Cap US Constituents (NYSE / NASDAQ)</span>
            </div>
            <span className="text-sky-300">Live Price Re-Indexing Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
