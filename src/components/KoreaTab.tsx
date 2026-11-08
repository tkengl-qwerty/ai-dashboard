import React from 'react';
import { KoreaMacroData } from '../types/market';
import { Landmark, ArrowUpRight, ArrowDownRight, Newspaper, DollarSign, Layers, ExternalLink } from 'lucide-react';
import { ArgonCommentaryBox } from './ArgonCommentaryBox';

interface KoreaTabProps {
  korea: KoreaMacroData;
  lastUpdatedSGT?: string;
  us10YYield: number;
}

export const KoreaTab: React.FC<KoreaTabProps> = ({
  korea,
  lastUpdatedSGT,
  us10YYield,
}) => {
  const { commentary, bonds, fxAndEquities, argonCommentary } = korea;
  const ktb3Y = bonds.kofiaKtb.find((b) => b.tenor.startsWith('3Y'));
  const ktb10Y = bonds.kofiaKtb.find((b) => b.tenor.startsWith('10Y'));
  const ktb30Y = bonds.kofiaKtb.find((b) => b.tenor.startsWith('30Y'));
  const sovereignSpread = Math.round(((ktb10Y?.yield ?? 3.852) - us10YYield) * 100);
  const slope3s10s = Math.round(((ktb10Y?.yield ?? 3.852) - (ktb3Y?.yield ?? 3.622)) * 100);
  const slope10s30s = Math.round(((ktb30Y?.yield ?? 3.895) - (ktb10Y?.yield ?? 3.852)) * 100);
  const ktb3YChg = ktb3Y?.changeBps ?? -4.9;
  const ktb10YChg = ktb10Y?.changeBps ?? -4.0;

  return (
    <div className="space-y-4">
      {/* Top 6-Card Metric Bar for Korea Macro & KOFIA/SOFIA Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">BOK BASE / KOFR-SOFIA</div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {bonds.bokBaseRate.toFixed(2)}% / {bonds.kofrOvernightRate.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono">91D CD: {bonds.cd91dRate.toFixed(2)}%</div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">USD/KRW ONSHORE</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            ₩{fxAndEquities.krwSpot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${fxAndEquities.krwChange <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fxAndEquities.krwChange <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            <span>
              {fxAndEquities.krwChange > 0 ? `+${fxAndEquities.krwChange.toFixed(2)}` : fxAndEquities.krwChange.toFixed(2)} (
              {fxAndEquities.krwChangePct > 0 ? `+${fxAndEquities.krwChangePct.toFixed(2)}%` : `${fxAndEquities.krwChangePct.toFixed(2)}%`})
            </span>
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono uppercase">3Y KTB (KOFIA/SOFIA)</span>
            <a
              href="https://www.kofiabond.or.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline"
              title="KOFIA / SOFIA Bond Information Service (kofiabond.or.kr)"
            >
              KOFIA ↗
            </a>
          </div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {(ktb3Y?.yield ?? 3.622).toFixed(3)}%
          </div>
          <div className={`text-[10px] font-mono ${ktb3YChg <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {ktb3YChg > 0 ? `+${ktb3YChg.toFixed(1)}` : ktb3YChg.toFixed(1)} bps Day Chg
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono uppercase">10Y KTB BENCHMARK</span>
            <a
              href="https://www.kofiabond.or.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline"
              title="KOFIA Final OTC Quotation Yield"
            >
              SOFIA ↗
            </a>
          </div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {(ktb10Y?.yield ?? 3.852).toFixed(3)}%
          </div>
          <div className={`text-[10px] font-mono ${ktb10YChg <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {ktb10YChg > 0 ? `+${ktb10YChg.toFixed(1)}` : ktb10YChg.toFixed(1)} bps Day Chg
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">10Y KR-US SPREAD</div>
          <div className="text-sm sm:text-base font-bold text-blue-400 font-mono tabular-nums mt-0.5">
            {sovereignSpread > 0 ? `+${sovereignSpread}` : sovereignSpread} bps
          </div>
          <div className="text-[10px] text-slate-400 font-mono">3s10s: +{slope3s10s} bps</div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">KOSPI COMPOSITE</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {fxAndEquities.kospiIndex.level.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${fxAndEquities.kospiIndex.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fxAndEquities.kospiIndex.changePct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>
              {fxAndEquities.kospiIndex.changePct >= 0 ? `+${fxAndEquities.kospiIndex.changePct.toFixed(2)}%` : `${fxAndEquities.kospiIndex.changePct.toFixed(2)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Gemini 4 Argon Korea Sovereign (KOFIA / SOFIA), BOK & KRW Synthesis */}
      {argonCommentary && (
        <ArgonCommentaryBox
          commentary={argonCommentary}
          lastUpdatedSGT={lastUpdatedSGT}
        />
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Macro Commentary & Noteworthy Korea Disclosures (7 cols) */}
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
                KEY KOREA MACRO, KOFIA / SOFIA & BOK TRANSMISSION PILLARS
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

          {/* Noteworthy Korea Disclosures */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  NOTEWORTHY KOREA MACRO, BOK & KOFIA / SOFIA DEVELOPMENTS
                </h3>
              </div>
              <span className="text-[10px] font-mono text-sky-300 bg-sky-950/60 px-2 py-0.5 border border-sky-800/60 rounded-xs font-semibold">
                LIVE FEED
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

        {/* Right Column: KOFIA / SOFIA KTB Curve, KOFR/CD Money Rates & KRW FX (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* KOFIA / SOFIA Korea Treasury Bond (KTB) Yield Curve */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  KOFIA / SOFIA KTB YIELD CURVE (국고채 최종호가수익률)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://www.kofiabond.or.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline flex items-center gap-0.5"
                  title="Korea Financial Investment Association (KOFIA / SOFIA) Bond Information Service"
                >
                  <span>kofiabond.or.kr ({bonds.quotationDate})</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-mono mb-2">
              Korea Treasury Bond (KTB) OTC Final Quotation Yields & live interbank curve (<span className="text-slate-300">KOFIA / SOFIA · kofiabond.or.kr</span>).
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1 px-1.5">Tenor</th>
                    <th className="py-1 px-1.5">KTB Series</th>
                    <th className="py-1 px-1.5 text-right">Yield</th>
                    <th className="py-1 px-1.5 text-right">Coupon</th>
                    <th className="py-1 px-1.5 text-right">Chg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {bonds.kofiaKtb.map((bond) => (
                    <tr key={bond.tenor} className="hover:bg-[#192434]/60">
                      <td className="py-1.5 px-1.5 font-bold text-slate-200 whitespace-nowrap">{bond.tenor}</td>
                      <td className="py-1.5 px-1.5 font-semibold text-sky-300 whitespace-nowrap">{bond.series}</td>
                      <td className="py-1.5 px-1.5 text-right font-bold text-sky-300 tabular-nums whitespace-nowrap">
                        {bond.yield.toFixed(3)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-slate-400 tabular-nums whitespace-nowrap">
                        {bond.coupon.toFixed(3)}%
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
                <span className="text-slate-400 text-[10px]">KTB 3s10s / 10s30s:</span>
                <span className="font-bold text-sky-300">+{slope3s10s} / {slope10s30s >= 0 ? `+${slope10s30s}` : slope10s30s} bps</span>
              </div>
              <div className="p-2 bg-[#0e141d] border border-slate-700/80 rounded-xs flex items-center justify-between">
                <span className="text-slate-400 text-[10px]">10Y KTB vs UST 10Y:</span>
                <span className="font-bold text-blue-400">{sovereignSpread} bps</span>
              </div>
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400 font-mono leading-relaxed">
              * Source: KOFIA Bond Information Service (<span className="text-slate-300">kofiabond.or.kr</span>) & Refinitiv live KTB quotes (<span className="text-slate-300">KR1YT=RR .. KR30YT=RR</span>).
            </div>
          </div>

          {/* SOFIA / KOFR Overnight Repo & KOFIA Money Market / Corporate Credit Benchmarks */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  SOFIA / KOFR REPO, KOFIA CD/CP & MSB BENCHMARKS
                </h3>
              </div>
              <a
                href="https://www.kofr.kr/eng/main.jsp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline flex items-center gap-0.5"
              >
                <span>KOFR / KOFIA</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1 px-1.5">Instrument</th>
                    <th className="py-1 px-1.5">Reference</th>
                    <th className="py-1 px-1.5 text-right">Rate</th>
                    <th className="py-1 px-1.5 text-right">Chg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {bonds.sofiaAndMoneyRates.map((item) => (
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

          {/* USD/KRW FX, Offshore NDF & KOSPI / WGBI Flow Telemetry */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  KOREAN WON (KRW / NDF) & WGBI FLOW TELEMETRY
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">BOK / KRX</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">Onshore USD/KRW Spot:</span>
                <span className="font-bold text-slate-100 tabular-nums">
                  ₩{fxAndEquities.krwSpot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">1-Month Offshore USD/KRW NDF:</span>
                <span className="font-bold text-sky-300 tabular-nums">
                  ₩{fxAndEquities.ndf1M.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">1M NDF - Spot Implied Basis:</span>
                <span className="font-bold text-blue-300 tabular-nums">
                  {fxAndEquities.ndfSpread1M >= 0 ? `+${fxAndEquities.ndfSpread1M.toFixed(2)}` : fxAndEquities.ndfSpread1M.toFixed(2)} KRW
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">KOSDAQ Composite Index:</span>
                <span className={`font-bold tabular-nums ${fxAndEquities.kosdaqIndex.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fxAndEquities.kosdaqIndex.level.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
                  {fxAndEquities.kosdaqIndex.changePct >= 0 ? `+${fxAndEquities.kosdaqIndex.changePct.toFixed(2)}%` : `${fxAndEquities.kosdaqIndex.changePct.toFixed(2)}%`})
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-300">Foreign Net KTB Flow:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {fxAndEquities.foreignKtbFlows}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
