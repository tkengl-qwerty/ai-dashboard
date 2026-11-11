import React from 'react';
import { ChinaMacroData } from '../types/market';
import { Landmark, ArrowUpRight, ArrowDownRight, Newspaper, DollarSign, Layers, ExternalLink } from 'lucide-react';
import { ArgonCommentaryBox } from './ArgonCommentaryBox';

interface ChinaTabProps {
  china: ChinaMacroData;
  lastUpdatedSGT?: string;
  us10YYield: number;
}

export const ChinaTab: React.FC<ChinaTabProps> = ({
  china,
  lastUpdatedSGT,
  us10YYield,
}) => {
  const { commentary, bonds, fxAndEquities, argonCommentary } = china;
  const cgb10Y = bonds.ccdcCgb.find((b) => b.tenor.startsWith('10Y'));
  const cgb30Y = bonds.ccdcCgb.find((b) => b.tenor.startsWith('30Y'));
  const cgb2Y = bonds.ccdcCgb.find((b) => b.tenor.startsWith('2Y'));
  const sovereignSpread = Math.round(((cgb10Y?.yield ?? 1.587) - us10YYield) * 100);
  const slope2s10s = Math.round(((cgb10Y?.yield ?? 1.587) - (cgb2Y?.yield ?? 1.216)) * 100);
  const slope10s30s = Math.round(((cgb30Y?.yield ?? 2.028) - (cgb10Y?.yield ?? 1.587)) * 100);
  const cgb10YChg = cgb10Y?.changeBps ?? -1.7;

  return (
    <div className="space-y-4">
      {/* Top 6-Card Metric Bar for China Macro & CCDC Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">PBOC 7D OMO / 1Y LPR</div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {bonds.pbocOmo7dRate.toFixed(2)}% / {bonds.lpr1Y.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono">5Y LPR: {bonds.lpr5Y.toFixed(2)}%</div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">USD/CNY ONSHORE</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {fxAndEquities.cnySpot.toFixed(4)}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${fxAndEquities.cnyChange <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fxAndEquities.cnyChange <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            <span>
              {fxAndEquities.cnyChange > 0 ? `+${fxAndEquities.cnyChange.toFixed(4)}` : fxAndEquities.cnyChange.toFixed(4)} (
              {fxAndEquities.cnyChangePct > 0 ? `+${fxAndEquities.cnyChangePct.toFixed(2)}%` : `${fxAndEquities.cnyChangePct.toFixed(2)}%`})
            </span>
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono uppercase">PBOC PARITY FIXING</span>
            <a
              href="https://www.chinamoney.com.cn/english/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline"
              title="CFETS / PBoC Official Daily Central Parity Fixing"
            >
              CFETS ↗
            </a>
          </div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            ¥{fxAndEquities.pbocFixing.toFixed(4)}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Offshore CNH: <span className="text-slate-200">{fxAndEquities.cnhSpot.toFixed(4)}</span>
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono uppercase">10Y CCDC CGB YIELD</span>
            <a
              href="https://yield.chinabond.com.cn/cbweb-mn/yc/ycYz?locale=en_US"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline"
              title="Official CCDC ChinaBond Government Bond Yield Curve (yield.chinabond.com.cn)"
            >
              CCDC ↗
            </a>
          </div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {(cgb10Y?.yield ?? 1.587).toFixed(3)}%
          </div>
          <div className={`text-[10px] font-mono ${cgb10YChg <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {cgb10YChg > 0 ? `+${cgb10YChg.toFixed(1)}` : cgb10YChg.toFixed(1)} bps vs prior CCDC
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">10Y CN-US SPREAD</div>
          <div className="text-sm sm:text-base font-bold text-blue-400 font-mono tabular-nums mt-0.5">
            {sovereignSpread > 0 ? `+${sovereignSpread}` : sovereignSpread} bps
          </div>
          <div className="text-[10px] text-slate-400 font-mono">30Y CGB: {(cgb30Y?.yield ?? 2.028).toFixed(3)}%</div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">SHANGHAI COMP (SSEC)</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {fxAndEquities.shanghaiComposite.level.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${fxAndEquities.shanghaiComposite.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fxAndEquities.shanghaiComposite.changePct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>
              {fxAndEquities.shanghaiComposite.changePct >= 0 ? `+${fxAndEquities.shanghaiComposite.changePct.toFixed(2)}%` : `${fxAndEquities.shanghaiComposite.changePct.toFixed(2)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Gemini 4 Argon China Sovereign (CCDC), PBoC & FX Synthesis */}
      {argonCommentary && (
        <ArgonCommentaryBox
          commentary={argonCommentary}
          lastUpdatedSGT={lastUpdatedSGT}
        />
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Macro Commentary & Noteworthy China Disclosures (7 cols) */}
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
                POLICY: {commentary.policyPosture}
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
                KEY CHINA MACRO & CCDC FIXED INCOME PILLARS
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

          {/* Noteworthy China Disclosures */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  NOTEWORTHY CHINA MACRO, POLICY, PBOC & CCDC DEVELOPMENTS
                </h3>
              </div>
              <span className="text-[10px] font-mono text-sky-300 bg-sky-950/60 px-2 py-0.5 border border-sky-800/60 rounded-xs font-semibold">
                LIVE RSS FEED
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

        {/* Right Column: Official CCDC ChinaBond Yield Curve, PBoC Money Market & FX (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Official CCDC ChinaBond Government Bond (CGB) Yield Curve */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  CCDC CHINABOND CGB YIELD CURVE (中债国债收益率曲线)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://yield.chinabond.com.cn/cbweb-mn/yc/ycYz?locale=en_US"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline flex items-center gap-0.5"
                  title="China Central Depository & Clearing Co., Ltd. (CCDC) Official ChinaBond Yield Curve"
                >
                  <span>CCDC ({bonds.curveDate})</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-mono mb-2">
              Official ChinaBond Government Bond Yield Curve (YTM) published by China Central Depository & Clearing Co., Ltd. (<span className="text-slate-300">yield.chinabond.com.cn</span>).
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1 px-1.5">Tenor</th>
                    <th className="py-1 px-1.5">CGB Series</th>
                    <th className="py-1 px-1.5 text-right">CCDC YTM</th>
                    <th className="py-1 px-1.5 text-right">Prior CCDC</th>
                    <th className="py-1 px-1.5 text-right">Chg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {bonds.ccdcCgb.map((bond) => (
                    <tr key={bond.tenor} className="hover:bg-[#192434]/60">
                      <td className="py-1.5 px-1.5 font-bold text-slate-200 whitespace-nowrap">{bond.tenor}</td>
                      <td className="py-1.5 px-1.5 font-semibold text-sky-300 whitespace-nowrap">{bond.code}</td>
                      <td className="py-1.5 px-1.5 text-right font-bold text-sky-300 tabular-nums whitespace-nowrap">
                        {bond.yield.toFixed(4)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-slate-400 tabular-nums whitespace-nowrap">
                        {bond.priorYield !== undefined ? `${bond.priorYield.toFixed(4)}%` : `${bond.coupon.toFixed(2)}%`}
                      </td>
                      <td className={`py-1.5 px-1.5 text-right font-semibold tabular-nums whitespace-nowrap ${bond.changeBps <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {bond.changeBps > 0 ? `+${bond.changeBps.toFixed(1)}` : bond.changeBps.toFixed(1)} bps
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 bg-[#0e141d] border border-slate-700/80 rounded-xs flex items-center justify-between">
                <span className="text-slate-400 text-[10px]">CCDC 2s10s / 10s30s:</span>
                <span className="font-bold text-sky-300">+{slope2s10s} / +{slope10s30s} bps</span>
              </div>
              <div className="p-2 bg-[#0e141d] border border-slate-700/80 rounded-xs flex items-center justify-between">
                <span className="text-slate-400 text-[10px]">10Y CGB vs UST 10Y:</span>
                <span className="font-bold text-blue-400">{sovereignSpread} bps</span>
              </div>
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400 font-mono leading-relaxed">
              * Source: Directly queried from CCDC ChinaBond (<span className="text-slate-300">yield.chinabond.com.cn/cbweb-mn/yc/ycDetail</span> · Curve ID <span className="text-slate-300">2c9081e50a2f9606010a3068cae70001</span>).
            </div>
          </div>

          {/* PBoC Monetary Operations & CCDC Repo / Policy Bank Benchmarks */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  PBOC POLICY RATES, DR007 REPO & CCDC CDB BENCHMARKS
                </h3>
              </div>
              <a
                href="http://www.pbc.gov.cn/en/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline flex items-center gap-0.5"
              >
                <span>pbc.gov.cn</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1 px-1.5">Instrument</th>
                    <th className="py-1 px-1.5">Ticker / Reference</th>
                    <th className="py-1 px-1.5 text-right">Rate</th>
                    <th className="py-1 px-1.5 text-right">Chg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {bonds.policyAndMoneyRates.map((item) => (
                    <tr key={item.instrument} className="hover:bg-[#192434]/60">
                      <td className="py-1.5 px-1.5 font-bold text-slate-200">
                        <div>{item.instrument}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{item.description}</div>
                      </td>
                      <td className="py-1.5 px-1.5 text-slate-300 whitespace-nowrap">{item.code}</td>
                      <td className="py-1.5 px-1.5 text-right font-bold text-sky-300 tabular-nums whitespace-nowrap">
                        {item.rate.toFixed(3)}%
                      </td>
                      <td className={`py-1.5 px-1.5 text-right font-semibold tabular-nums whitespace-nowrap ${item.changeBps <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.changeBps > 0 ? `+${item.changeBps.toFixed(1)}` : item.changeBps.toFixed(1)} bps
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* USD/CNY, Offshore CNH & Equity / Bond Connect Telemetry */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  RENMINBI (CNY / CNH) & BOND CONNECT TELEMETRY
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">CFETS / CCDC</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">Onshore USD/CNY Spot:</span>
                <span className="font-bold text-slate-100 tabular-nums">
                  ¥{fxAndEquities.cnySpot.toFixed(4)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">Offshore USD/CNH Spot:</span>
                <span className="font-bold text-sky-300 tabular-nums">
                  ¥{fxAndEquities.cnhSpot.toFixed(4)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">PBoC Central Parity Fixing:</span>
                <span className="font-bold text-slate-200 tabular-nums">
                  ¥{fxAndEquities.pbocFixing.toFixed(4)} ({fxAndEquities.pbocFixingChange >= 0 ? `+${fxAndEquities.pbocFixingChange.toFixed(4)}` : fxAndEquities.pbocFixingChange.toFixed(4)})
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">CNH - CNY Offshore Basis:</span>
                <span className="font-bold text-blue-300 tabular-nums">
                  {fxAndEquities.cnhCnySpreadPips >= 0 ? `+${fxAndEquities.cnhCnySpreadPips}` : fxAndEquities.cnhCnySpreadPips} pips
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">CSI 300 Index:</span>
                <span className={`font-bold tabular-nums ${fxAndEquities.csi300Index.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fxAndEquities.csi300Index.level.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
                  {fxAndEquities.csi300Index.changePct >= 0 ? `+${fxAndEquities.csi300Index.changePct.toFixed(2)}%` : `${fxAndEquities.csi300Index.changePct.toFixed(2)}%`})
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-300">Bond Connect Foreign Custody:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {fxAndEquities.northboundBondConnectFlow}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
