import React from 'react';
import { IndonesiaCommentary, IndonesiaBonds, IndonesiaFxAndNdf } from '../types/market';
import { Landmark, ArrowUpRight, ArrowDownRight, Newspaper, DollarSign, Layers } from 'lucide-react';

interface IndonesiaTabProps {
  commentary: IndonesiaCommentary;
  bonds: IndonesiaBonds;
  fxAndNdf: IndonesiaFxAndNdf;
  us10YYield: number;
}

export const IndonesiaTab: React.FC<IndonesiaTabProps> = ({
  commentary,
  bonds,
  fxAndNdf,
  us10YYield,
}) => {
  const sovereignSpread = Math.round((bonds.indoGB.find(b => b.tenor.includes('10Y'))?.yield ?? 6.68) * 100 - us10YYield * 100);

  return (
    <div className="space-y-4">
      {/* Top Metric Bar for Quick Indonesian Macro Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#0b0f19] border border-slate-800 p-2.5 rounded-xs">
          <div className="text-[10px] text-slate-500 font-mono uppercase">BI-RATE BENCHMARK</div>
          <div className="text-sm sm:text-base font-bold text-amber-300 font-mono tabular-nums mt-0.5">
            {bonds.biRate.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono">Held Steady by BI</div>
        </div>

        <div className="bg-[#0b0f19] border border-slate-800 p-2.5 rounded-xs">
          <div className="text-[10px] text-slate-500 font-mono uppercase">USD/IDR SPOT</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {fxAndNdf.spotRate.toLocaleString()}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${fxAndNdf.spotChange <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fxAndNdf.spotChange <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            <span>{fxAndNdf.spotChange} ({fxAndNdf.spotChangePct.toFixed(2)}%)</span>
          </div>
        </div>

        <div className="bg-[#0b0f19] border border-slate-800 p-2.5 rounded-xs">
          <div className="text-[10px] text-slate-500 font-mono uppercase">USD/IDR JISDOR</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {fxAndNdf.jisdorRate.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">Bank Indonesia Fixing</div>
        </div>

        <div className="bg-[#0b0f19] border border-slate-800 p-2.5 rounded-xs">
          <div className="text-[10px] text-slate-500 font-mono uppercase">10Y INDOGB YIELD</div>
          <div className="text-sm sm:text-base font-bold text-amber-400 font-mono tabular-nums mt-0.5">
            {bonds.indoGB.find(b => b.tenor.includes('10Y'))?.yield.toFixed(2)}%
          </div>
          <div className="text-[10px] text-emerald-400 font-mono">-3.0 bps Day Chg</div>
        </div>

        <div className="bg-[#0b0f19] border border-slate-800 p-2.5 rounded-xs">
          <div className="text-[10px] text-slate-500 font-mono uppercase">10Y INDO-US SPREAD</div>
          <div className="text-sm sm:text-base font-bold text-cyan-400 font-mono tabular-nums mt-0.5">
            +{sovereignSpread} bps
          </div>
          <div className="text-[10px] text-slate-400 font-mono">vs UST 10Y ({us10YYield.toFixed(2)}%)</div>
        </div>

        <div className="bg-[#0b0f19] border border-slate-800 p-2.5 rounded-xs">
          <div className="text-[10px] text-slate-500 font-mono uppercase">IHSG (IDX COMPOSITE)</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {fxAndNdf.ihsgIndex.level.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" />
            <span>+{fxAndNdf.ihsgIndex.changePct.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Macro Commentary & Noteworthy News (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Executive Market Briefing */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xs p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  {commentary.title}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">{commentary.date}</span>
            </div>

            {/* Executive Summary */}
            <div className="prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed font-sans mb-4 bg-slate-950/40 p-3 border-l-2 border-amber-500/80 rounded-r-xs">
              <p>{commentary.executiveSummary}</p>
            </div>

            {/* Macro Pillars */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                CORE MACROECONOMIC PILLARS:
              </div>
              {commentary.macroPillars.map((pillar, idx) => (
                <div key={idx} className="bg-slate-900/40 border border-slate-800/80 p-2.5 rounded-xs">
                  <div className="text-xs font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>{pillar.heading}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal font-sans">
                    {pillar.analysis}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Noteworthy Indonesian News & Market Disclosures */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xs p-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  NOTEWORTHY INDONESIA DISCLOSURES & MARKET DEVELOPMENTS
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">BI & JAKARTA EXCHANGES</span>
            </div>

            <div className="divide-y divide-slate-800/50">
              {commentary.noteworthyHeadlines.map((item, idx) => (
                <div key={idx} className="py-2.5 hover:bg-slate-900/40 rounded-xs px-1 transition-colors">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mb-1">
                    <span className="text-amber-400 font-bold">SOURCE: {item.source}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    <span className="text-slate-500">Market Significance: </span>
                    <span className="text-slate-300">{item.significance}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Debt & FX/NDF Telemetry (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* IndoGB Government Bond Yields */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xs p-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  INDOGB (GOVERNMENT BENCHMARKS)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">PHEI / DJPPR</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase">
                    <th className="py-1 px-1.5">Tenor</th>
                    <th className="py-1 px-1.5">Series</th>
                    <th className="py-1 px-1.5 text-right">Yield</th>
                    <th className="py-1 px-1.5 text-right">Coupon</th>
                    <th className="py-1 px-1.5 text-right">Chg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {bonds.indoGB.map((bond) => (
                    <tr key={bond.code} className="hover:bg-slate-900/50">
                      <td className="py-1.5 px-1.5 font-bold text-slate-200">{bond.tenor}</td>
                      <td className="py-1.5 px-1.5 text-slate-400">{bond.code}</td>
                      <td className="py-1.5 px-1.5 text-right font-bold text-amber-300 tabular-nums">
                        {bond.yield.toFixed(2)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-slate-400 tabular-nums">
                        {bond.coupon.toFixed(3)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-semibold text-emerald-400 tabular-nums">
                        {bond.changeBps} bps
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 p-2 bg-slate-950/60 border border-slate-800/80 rounded-xs flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 text-[11px]">10Y Sovereign Spread over US:</span>
              <span className="font-bold text-cyan-300">+{bonds.sovereignSpread10Y} bps</span>
            </div>
          </div>

          {/* SRBI (Sekuritas Rupiah Bank Indonesia) Auctions */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xs p-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  SRBI AUCTION YIELDS (CENTRAL BANK)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">BANK INDONESIA</span>
            </div>

            <p className="text-[11px] text-slate-400 font-mono mb-2">
              Pro-market monetary operations to attract portfolio inflows and absorb liquidity.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase">
                    <th className="py-1 px-1.5">Tenor</th>
                    <th className="py-1 px-1.5">Auction</th>
                    <th className="py-1 px-1.5 text-right">Cut-Off Yield</th>
                    <th className="py-1 px-1.5 text-right">Awarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {bonds.srbi.map((srbi) => (
                    <tr key={srbi.tenor} className="hover:bg-slate-900/50">
                      <td className="py-1.5 px-1.5 font-bold text-slate-200">
                        {srbi.tenor} <span className="text-[10px] text-slate-500">({srbi.tenorDays}d)</span>
                      </td>
                      <td className="py-1.5 px-1.5 text-slate-400">{srbi.auctionDate}</td>
                      <td className="py-1.5 px-1.5 text-right font-bold text-amber-300 tabular-nums">
                        {srbi.cutOffYield.toFixed(2)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-slate-300 tabular-nums">
                        {srbi.awardedVolumeIDR}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-[10px] text-slate-500 font-mono">
              * SRBI auctions conducted weekly via Bank Indonesia open market operations
            </div>
          </div>

          {/* USD/IDR FX & NDF Derivatives */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xs p-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  USD/IDR FX & NDF DERIVATIVES
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">SPOT vs OFFSHORE</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">USD/IDR Spot Rate:</span>
                <span className="font-bold text-slate-100 tabular-nums">
                  {fxAndNdf.spotRate.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">BI JISDOR Fixing:</span>
                <span className="font-bold text-slate-200 tabular-nums">
                  {fxAndNdf.jisdorRate.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">1-Month Offshore NDF:</span>
                <span className="font-bold text-amber-300 tabular-nums">
                  {fxAndNdf.ndf1M.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">3-Month Offshore NDF:</span>
                <span className="font-bold text-amber-300 tabular-nums">
                  {fxAndNdf.ndf3M.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">1M NDF vs Spot Basis:</span>
                <span className="font-bold text-cyan-300 tabular-nums">
                  +{fxAndNdf.ndfSpread1M} IDR ({fxAndNdf.annualizedBasis1M}% p.a.)
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Foreign Net Equity Flow:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {fxAndNdf.foreignFlowsDaily}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
