import React from 'react';
import { IndonesiaCommentary, IndonesiaBonds, IndonesiaFxAndNdf, ArgonCommentary } from '../types/market';
import { Landmark, ArrowUpRight, ArrowDownRight, Newspaper, DollarSign, Layers, ExternalLink, Calendar } from 'lucide-react';
import { ArgonCommentaryBox } from './ArgonCommentaryBox';

interface IndonesiaTabProps {
  argonCommentary?: ArgonCommentary;
  lastUpdatedSGT?: string;
  commentary: IndonesiaCommentary;
  bonds: IndonesiaBonds;
  fxAndNdf: IndonesiaFxAndNdf;
  us10YYield: number;
}

export const IndonesiaTab: React.FC<IndonesiaTabProps> = ({
  argonCommentary,
  lastUpdatedSGT,
  commentary,
  bonds,
  fxAndNdf,
  us10YYield,
}) => {
  const indo10Y = bonds.indoGB.find((b) => b.tenor.includes('10Y'));
  const sovereignSpread = Math.round(((indo10Y?.yield ?? 7.18) - us10YYield) * 100);
  const indo10YChg = indo10Y?.changeBps ?? 2.0;

  // Default JISDOR 5-Day History from official Bank Indonesia table (bi.go.id/en/statistik/informasi-kurs/jisdor)
  const jisdorHistory = fxAndNdf.jisdorHistory ?? [
    { date: '4 November 2026', rate: 18140 },
    { date: '3 November 2026', rate: 18148 },
    { date: '2 November 2026', rate: 18161 },
    { date: '30 October 2026', rate: 18138 },
    { date: '29 October 2026', rate: 18128 },
  ];

  const jisdorDayChange = fxAndNdf.jisdorChange ?? -8;

  return (
    <div className="space-y-4">
      {/* Top Metric Bar for Quick Indonesian Macro Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">BI-RATE BENCHMARK</div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {bonds.biRate.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono">Bank Indonesia Policy</div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">USD/IDR SPOT</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {fxAndNdf.spotRate.toLocaleString()}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${fxAndNdf.spotChange <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fxAndNdf.spotChange <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            <span>
              {fxAndNdf.spotChange > 0 ? `+${fxAndNdf.spotChange}` : fxAndNdf.spotChange} (
              {fxAndNdf.spotChangePct > 0 ? `+${fxAndNdf.spotChangePct.toFixed(2)}%` : `${fxAndNdf.spotChangePct.toFixed(2)}%`})
            </span>
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono uppercase">USD/IDR JISDOR</span>
            <a
              href="https://www.bi.go.id/en/statistik/informasi-kurs/jisdor/Default.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline flex items-center gap-0.5"
              title="Official Bank Indonesia JISDOR fixing page (bi.go.id)"
            >
              bi.go.id ↗
            </a>
          </div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            Rp {fxAndNdf.jisdorRate.toLocaleString()}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${jisdorDayChange <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {jisdorDayChange <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            <span>{jisdorDayChange > 0 ? `+${jisdorDayChange}` : jisdorDayChange} IDR vs yesterday</span>
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono uppercase">10Y INDOGB YIELD</span>
            <a
              href="https://tradingeconomics.com/gidn5y:gov"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline"
              title="TradingEconomics Indonesia Government Bond (gidn5y:gov)"
            >
              ~7% ↗
            </a>
          </div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {(indo10Y?.yield ?? 7.18).toFixed(2)}%
          </div>
          <div className={`text-[10px] font-mono ${indo10YChg <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {indo10YChg > 0 ? `+${indo10YChg.toFixed(1)}` : indo10YChg.toFixed(1)} bps Day Chg
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">10Y INDO-US SPREAD</div>
          <div className="text-sm sm:text-base font-bold text-blue-400 font-mono tabular-nums mt-0.5">
            +{sovereignSpread} bps
          </div>
          <div className="text-[10px] text-slate-400 font-mono">vs UST 10Y ({us10YYield.toFixed(2)}%)</div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">IHSG (IDX COMPOSITE)</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {fxAndNdf.ihsgIndex.level.toLocaleString()}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${fxAndNdf.ihsgIndex.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fxAndNdf.ihsgIndex.changePct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>
              {fxAndNdf.ihsgIndex.changePct >= 0 ? `+${fxAndNdf.ihsgIndex.changePct.toFixed(2)}%` : `${fxAndNdf.ihsgIndex.changePct.toFixed(2)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Gemini 4 Argon Indonesia Sovereign, FX & Monetary Synthesis */}
      {argonCommentary && (
        <ArgonCommentaryBox
          commentary={argonCommentary}
          lastUpdatedSGT={lastUpdatedSGT}
        />
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Macro Commentary & Noteworthy News (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Executive Market Briefing */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/80 mb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  {commentary.title}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-[#0e141d] px-2 py-0.5 border border-slate-700/80 rounded-xs">
                {commentary.date}
              </span>
            </div>

            {/* Policy Badge & Headline */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="bg-sky-950/80 text-sky-300 border border-sky-600/50 text-[10px] font-mono px-2 py-0.5 rounded-xs font-semibold">
                POLICY: {commentary.biPolicyPosture}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Headline CPI: <span className="text-slate-200 font-bold">{bonds.cpiInflationYoY.toFixed(2)}% YoY</span>
              </span>
            </div>

            {/* Executive Summary */}
            <p className="text-xs text-slate-300 leading-relaxed font-sans mb-4 bg-[#0e141d]/80 p-3 rounded-xs border border-slate-800">
              {commentary.executiveSummary}
            </p>

            {/* Macro Pillars */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-display">
                KEY MACRO TRANSMISSION PILLARS
              </div>
              {commentary.macroPillars.map((pillar, idx) => (
                <div key={idx} className="bg-[#0e141d] border border-slate-800 p-3 rounded-xs">
                  <div className="text-xs font-semibold text-sky-300 font-sans mb-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-950/60 px-1.5 py-0.2 rounded-xs border border-blue-800/60">
                      0{idx + 1}
                    </span>
                    {pillar.heading}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    {pillar.analysis}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Noteworthy Disclosures */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  NOTEWORTHY INDONESIA DISCLOSURES & DEVELOPMENTS
                </h3>
              </div>
              <span className="text-[10px] font-mono text-sky-300 bg-sky-950/60 px-2 py-0.5 border border-sky-800/60 rounded-xs font-semibold">
                LAST 16 HOURS
              </span>
            </div>

            <div className="divide-y divide-slate-700/50">
              {commentary.noteworthyHeadlines.map((item, idx) => (
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
        </div>

        {/* Right Column: Debt & FX/NDF Telemetry (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* IndoGB Government Bond Yields (~7% Source: TradingEconomics) */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  INDOGB (GOVERNMENT BENCHMARKS ~7%)
                </h3>
              </div>
              <a
                href="https://tradingeconomics.com/gidn5y:gov"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-sky-400 hover:text-sky-300 underline flex items-center gap-0.5"
                title="TradingEconomics Indonesia Government Bond 5Y (gidn5y:gov)"
              >
                <span>TradingEconomics</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1 px-1.5">Tenor</th>
                    <th className="py-1 px-1.5">Series</th>
                    <th className="py-1 px-1.5 text-right">Yield</th>
                    <th className="py-1 px-1.5 text-right">Coupon</th>
                    <th className="py-1 px-1.5 text-right">Chg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {bonds.indoGB.map((bond) => (
                    <tr key={bond.code} className="hover:bg-[#192434]/60">
                      <td className="py-1.5 px-1.5 font-bold text-slate-200">{bond.tenor}</td>
                      <td className="py-1.5 px-1.5 text-slate-400">{bond.code}</td>
                      <td className="py-1.5 px-1.5 text-right font-bold text-sky-300 tabular-nums">
                        {bond.yield.toFixed(2)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-slate-400 tabular-nums">
                        {bond.coupon.toFixed(3)}%
                      </td>
                      <td className={`py-1.5 px-1.5 text-right font-semibold tabular-nums ${bond.changeBps <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {bond.changeBps > 0 ? `+${bond.changeBps}` : bond.changeBps} bps
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 p-2 bg-[#0e141d] border border-slate-700/80 rounded-xs flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 text-[11px]">10Y Sovereign Spread over US:</span>
              <span className="font-bold text-sky-300">+{sovereignSpread} bps</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400 font-mono">
              * Benchmark reference rates tracked via TradingEconomics (gidn5y:gov / gidn10y:gov) & DJPPR Ministry of Finance
            </div>
          </div>

          {/* SRBI (Sekuritas Rupiah Bank Indonesia) Auctions - Weighted Average Rates */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  SRBI AUCTION YIELDS (BANK INDONESIA WEIGHTED AVERAGE RATE)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://www.bi.go.id/en/publikasi/lelang/operasi-moneter/Default.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline flex items-center gap-0.5"
                  title="Bank Indonesia Operasi Moneter Auction Publication"
                >
                  <span>bi.go.id</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span className="text-slate-600">|</span>
                <a
                  href="https://www.ceicdata.com/en/indonesia/monetary-operations-auction-bank-indonesia-rupiah-securities-srbi/monetary-operation-srbi-norminal-bids-12-months"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-mono text-blue-400 hover:text-blue-300 underline flex items-center gap-0.5"
                  title="CEIC Data - Indonesia Monetary Operations SRBI Auction"
                >
                  <span>CEIC</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-mono mb-2">
              Bank Indonesia Weekly Open Market Operation Auction — Official Weighted Average Accepted Rate (WAR) & Cut-Off Stop-Out.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1 px-1.5">Tenor</th>
                    <th className="py-1 px-1.5">Auction Date</th>
                    <th className="py-1 px-1.5 text-right" title="Official Weighted Average Accepted Rate from Bank Indonesia & CEIC Data">
                      Weighted Avg (WAR)
                    </th>
                    <th className="py-1 px-1.5 text-right" title="Highest accepted cut-off yield / stop-out rate">
                      Cut-Off Yield
                    </th>
                    <th className="py-1 px-1.5 text-right" title="Nominal Bids submitted by primary dealers / commercial banks">
                      Nominal Bids
                    </th>
                    <th className="py-1 px-1.5 text-right">Awarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {bonds.srbi.map((srbi) => (
                    <tr key={srbi.tenor} className="hover:bg-[#192434]/60">
                      <td className="py-1.5 px-1.5 font-bold text-slate-200">
                        {srbi.tenor} <span className="text-[10px] text-slate-400">({srbi.tenorDays}d)</span>
                      </td>
                      <td className="py-1.5 px-1.5 text-slate-400">{srbi.auctionDate}</td>
                      <td className="py-1.5 px-1.5 text-right font-bold text-sky-300 tabular-nums">
                        {srbi.weightedAvgYield.toFixed(3)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-semibold text-slate-300 tabular-nums">
                        {srbi.cutOffYield.toFixed(3)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-slate-400 tabular-nums">
                        {srbi.nominalBidsIDR ?? '—'}
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-slate-200 tabular-nums font-semibold">
                        {srbi.awardedVolumeIDR}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-[10px] text-slate-400 font-mono">
              * Sources: Bank Indonesia Operasi Moneter (bi.go.id/en/publikasi/lelang/operasi-moneter) & CEIC Data (Monetary Operations Auction: SRBI). Shows the official Weighted Average Accepted Yield (WAR) and Bids from the latest auction tender.
            </div>
          </div>

          {/* USD/IDR FX & NDF Derivatives */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  USD/IDR FX & NDF DERIVATIVES
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">SPOT vs OFFSHORE</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">USD/IDR Spot Rate:</span>
                <span className="font-bold text-slate-100 tabular-nums">
                  {fxAndNdf.spotRate.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-300">BI JISDOR Fixing:</span>
                  <a
                    href="https://www.bi.go.id/en/statistik/informasi-kurs/jisdor/Default.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-sky-400 hover:text-sky-300 underline font-mono flex items-center gap-0.5"
                    title="Bank Indonesia official JISDOR reference fixing"
                  >
                    <span>bi.go.id</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <span className="font-bold text-sky-300 tabular-nums">
                  Rp {fxAndNdf.jisdorRate.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">1-Month Offshore NDF:</span>
                <span className="font-bold text-slate-200 tabular-nums">
                  {fxAndNdf.ndf1M.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">3-Month Offshore NDF:</span>
                <span className="font-bold text-slate-200 tabular-nums">
                  {fxAndNdf.ndf3M.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">1M NDF vs Spot Basis:</span>
                <span className="font-bold text-blue-300 tabular-nums">
                  +{fxAndNdf.ndfSpread1M} IDR ({fxAndNdf.annualizedBasis1M}% p.a.)
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-300">Foreign Net Equity Flow:</span>
                <span className={`font-bold tabular-nums ${fxAndNdf.foreignFlowsDaily.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fxAndNdf.foreignFlowsDaily}
                </span>
              </div>
            </div>
          </div>

          {/* Official Bank Indonesia JISDOR Historical Fixing Table (Exact Attachment Match) */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  BANK INDONESIA JISDOR HISTORICAL FIXING
                </h3>
              </div>
              <a
                href="https://www.bi.go.id/en/statistik/informasi-kurs/jisdor/Default.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-sky-400 hover:text-sky-300 underline flex items-center gap-0.5"
                title="Bank Indonesia Official JISDOR Table"
              >
                <span>bi.go.id</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <p className="text-[11px] text-slate-400 font-mono mb-2">
              Official daily Jakarta Interbank Spot Dollar Rate reference fixings published by Bank Indonesia (15:15 WIB).
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1.5 px-2 bg-[#0e141d]/70 text-slate-300 font-semibold">Date</th>
                    <th className="py-1.5 px-2 bg-[#0e141d]/70 text-right text-slate-300 font-semibold">Rates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {jisdorHistory.map((item, idx) => (
                    <tr
                      key={item.date}
                      className={idx === 0 ? 'bg-sky-950/30 hover:bg-sky-950/50' : 'hover:bg-[#192434]/60'}
                    >
                      <td className="py-2 px-2 text-slate-200 flex items-center gap-1.5">
                        {idx === 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" title="Latest Fixing" />
                        )}
                        <span>{item.date}</span>
                      </td>
                      <td className="py-2 px-2 text-right font-bold font-mono text-slate-100 tabular-nums">
                        Rp {item.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-[10px] text-slate-400 font-mono">
              * Source: Bank Indonesia JISDOR (bi.go.id/en/statistik/informasi-kurs/jisdor)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
