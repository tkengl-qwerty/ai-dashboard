import React from 'react';
import { IndiaMacroData } from '../types/market';
import { Landmark, ArrowUpRight, ArrowDownRight, Newspaper, DollarSign, Layers, ExternalLink, FileText } from 'lucide-react';
import { ArgonCommentaryBox } from './ArgonCommentaryBox';

interface IndiaTabProps {
  india: IndiaMacroData;
  lastUpdatedSGT?: string;
  us10YYield: number;
}

export const IndiaTab: React.FC<IndiaTabProps> = ({
  india,
  lastUpdatedSGT,
  us10YYield,
}) => {
  const { commentary, bonds, fxAndEquities, argonCommentary } = india;
  const gsec5Y = bonds.gsecCurve.find((b) => b.tenor.startsWith('5Y'));
  const gsec10Y = bonds.gsecCurve.find((b) => b.tenor.startsWith('10Y'));
  const gsec30Y = bonds.gsecCurve.find((b) => b.tenor.startsWith('30Y'));
  const sovereignSpread = Math.round(((gsec10Y?.yield ?? 7.162) - us10YYield) * 100);
  const slope5s10s = Math.round(((gsec10Y?.yield ?? 7.162) - (gsec5Y?.yield ?? 7.023)) * 100);
  const slope10s30s = Math.round(((gsec30Y?.yield ?? 7.619) - (gsec10Y?.yield ?? 7.162)) * 100);
  const gsec5YChg = gsec5Y?.changeBps ?? -2.2;
  const gsec10YChg = gsec10Y?.changeBps ?? 1.7;

  return (
    <div className="space-y-4">
      {/* Top 6-Card Metric Bar for India Macro & RBI / CCIL Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono uppercase">RBI REPO / LAF BAND</span>
            <a
              href="https://www.rbi.org.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline"
              title="Reserve Bank of India Official Portal (rbi.org.in)"
            >
              RBI ↗
            </a>
          </div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {bonds.rbiRepoRate.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            SDF {bonds.sdfRate.toFixed(2)}% · MSF {bonds.msfRate.toFixed(2)}%
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">USD/INR SPOT (FBIL)</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            ₹{fxAndEquities.inrSpot.toFixed(4)}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${fxAndEquities.inrChange <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fxAndEquities.inrChange <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            <span>
              Ref: ₹{fxAndEquities.rbiReferenceUsd.toFixed(2)} ({fxAndEquities.inrChangePct > 0 ? `+${fxAndEquities.inrChangePct.toFixed(2)}%` : `${fxAndEquities.inrChangePct.toFixed(2)}%`})
            </span>
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono uppercase">5Y G-SEC (GS 2031)</span>
            <a
              href="https://www.rbi.org.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline"
              title="RBI / CCIL 5Y On-The-Run Benchmark (6.53% GS 2031)"
            >
              CCIL ↗
            </a>
          </div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {(gsec5Y?.yield ?? 7.023).toFixed(3)}%
          </div>
          <div className={`text-[10px] font-mono ${gsec5YChg <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {gsec5YChg > 0 ? `+${gsec5YChg.toFixed(1)}` : gsec5YChg.toFixed(1)} bps Day Chg
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono uppercase">10Y G-SEC (GS 2036)</span>
            <a
              href="https://www.rbi.org.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline"
              title="RBI / CCIL 10Y On-The-Run Benchmark (6.94% GS 2036)"
            >
              RBI ↗
            </a>
          </div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {(gsec10Y?.yield ?? 7.162).toFixed(3)}%
          </div>
          <div className={`text-[10px] font-mono ${gsec10YChg <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {gsec10YChg > 0 ? `+${gsec10YChg.toFixed(1)}` : gsec10YChg.toFixed(1)} bps Day Chg
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">10Y IN-US SPREAD</div>
          <div className="text-sm sm:text-base font-bold text-blue-400 font-mono tabular-nums mt-0.5">
            {sovereignSpread > 0 ? `+${sovereignSpread}` : sovereignSpread} bps
          </div>
          <div className="text-[10px] text-slate-400 font-mono">5s10s: +{slope5s10s} bps</div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">NIFTY 50 (NSE)</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {fxAndEquities.nifty50Index.level.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-[10px] font-mono flex items-center gap-0.5 ${fxAndEquities.nifty50Index.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fxAndEquities.nifty50Index.changePct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>
              {fxAndEquities.nifty50Index.changePct >= 0 ? `+${fxAndEquities.nifty50Index.changePct.toFixed(2)}%` : `${fxAndEquities.nifty50Index.changePct.toFixed(2)}%`} · Sensex {Math.round(fxAndEquities.sensexIndex.level).toLocaleString('en-US')}
            </span>
          </div>
        </div>
      </div>

      {/* Gemini 4 Argon India Sovereign (RBI / CCIL G-Sec), LAF & INR Synthesis */}
      {argonCommentary && (
        <ArgonCommentaryBox
          commentary={argonCommentary}
          lastUpdatedSGT={lastUpdatedSGT}
        />
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Macro Commentary, Live India Macro RSS & Official RBI Releases RSS (7 cols) */}
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
              <span className="text-[10px] font-mono text-slate-400">
                · FX Reserves: <span className="text-emerald-400 font-bold">US${fxAndEquities.forexReservesUsdBn.toFixed(2)}B</span>
              </span>
            </div>

            {/* Executive Summary */}
            <p className="text-xs text-slate-300 leading-relaxed font-sans mb-4 bg-[#0e141d]/80 p-3 rounded-xs border border-slate-800">
              {commentary.executiveSummary}
            </p>

            {/* Macro Pillars */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-display">
                KEY INDIA MACRO, RBI LAF & CCIL G-SEC TRANSMISSION PILLARS
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

          {/* Noteworthy India Macro, RBI & G-Sec Market News (Live RSS Feed) */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  NOTEWORTHY INDIA MACRO, POLICY, RBI & G-SEC DEVELOPMENTS
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

          {/* Official RBI Press Releases & Monetary Operations RSS Feed (rbi.org.in/pressreleases_rss.xml) */}
          {commentary.rbiOfficialReleases && commentary.rbiOfficialReleases.length > 0 && (
            <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                    OFFICIAL RBI PRESS RELEASES & MONETARY OPERATIONS (rbi.org.in RSS)
                  </h3>
                </div>
                <a
                  href="https://rbi.org.in/pressreleases_rss.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-sky-300 bg-blue-950/60 px-2 py-0.5 border border-blue-800/60 rounded-xs font-semibold hover:text-white flex items-center gap-1"
                  title="Official Reserve Bank of India Press Releases RSS Feed"
                >
                  <span>RBI RSS</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              <div className="divide-y divide-slate-700/50">
                {commentary.rbiOfficialReleases.map((rel, idx) => (
                  <div key={idx} className="py-2.5 hover:bg-[#192434]/60 rounded-xs px-1.5 transition-colors">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-bold">RBI #{idx + 1}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-sky-300 bg-sky-950/60 px-1.5 py-0.2 border border-sky-800/60 rounded-xs">
                          {rel.category}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-400">{rel.pubDate}</span>
                      </div>
                      <a
                        href={rel.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 text-[10px] underline"
                        title="Open Official RBI Press Release"
                      >
                        <span>rbi.org.in</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    <h4 className="text-xs sm:text-[13px] font-semibold text-slate-100 leading-snug mb-1">
                      <a
                        href={rel.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-sky-300 transition-colors"
                      >
                        {rel.title}
                      </a>
                    </h4>

                    <p className="text-[11px] text-slate-300 mt-0.5 font-mono">
                      {rel.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: RBI / CCIL G-Sec Curve, LAF & T-Bill Money Rates, and INR / Forex Reserves (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* RBI / CCIL India Government Bond (G-Sec) Yield Curve */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  RBI / CCIL INDIA SOVEREIGN G-SEC YIELD CURVE
                </h3>
              </div>
              <a
                href="https://www.rbi.org.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline flex items-center gap-0.5"
                title="Reserve Bank of India & CCIL NDS-OM Sovereign Benchmarks"
              >
                <span>rbi.org.in ({bonds.quotationDate})</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <p className="text-[11px] text-slate-400 font-mono mb-2">
              Government of India Dated Securities (G-Sec) On-The-Run Benchmarks (<span className="text-slate-300">RBI / CCIL NDS-OM</span> & live <span className="text-slate-300">IN1YT=RR .. IN30YT=RR</span>).
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-1 px-1.5">Tenor</th>
                    <th className="py-1 px-1.5">G-Sec Benchmark</th>
                    <th className="py-1 px-1.5 text-right">Yield</th>
                    <th className="py-1 px-1.5 text-right">Coupon</th>
                    <th className="py-1 px-1.5 text-right">Chg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {bonds.gsecCurve.map((bond) => (
                    <tr key={bond.tenor} className="hover:bg-[#192434]/60">
                      <td className="py-1.5 px-1.5 font-bold text-slate-200 whitespace-nowrap">{bond.tenor}</td>
                      <td className="py-1.5 px-1.5 font-semibold text-sky-300 whitespace-nowrap">{bond.series}</td>
                      <td className="py-1.5 px-1.5 text-right font-bold text-sky-300 tabular-nums whitespace-nowrap">
                        {bond.yield.toFixed(3)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-slate-400 tabular-nums whitespace-nowrap">
                        {bond.coupon.toFixed(2)}%
                      </td>
                      <td className={`py-1.5 px-1.5 text-right font-semibold tabular-nums whitespace-nowrap ${bond.changeBps <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {bond.changeBps > 0 ? `+${bond.changeBps.toFixed(1)}` : bond.changeBps.toFixed(1)} bps
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {bonds.latestGsecAuctionSummary && (
              <div className="mt-3 p-2.5 bg-[#0e141d] border border-blue-900/60 rounded-xs text-[11px] font-mono text-slate-300">
                <div className="text-[10px] font-bold text-sky-300 uppercase mb-0.5">
                  LATEST RBI GOVERNMENT STOCK AUCTION CUT-OFF (rbi.org.in)
                </div>
                <div>{bonds.latestGsecAuctionSummary}</div>
              </div>
            )}

            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 bg-[#0e141d] border border-slate-700/80 rounded-xs flex items-center justify-between">
                <span className="text-slate-400 text-[10px]">G-Sec 5s10s / 10s30s:</span>
                <span className="font-bold text-sky-300">+{slope5s10s} / +{slope10s30s} bps</span>
              </div>
              <div className="p-2 bg-[#0e141d] border border-slate-700/80 rounded-xs flex items-center justify-between">
                <span className="text-slate-400 text-[10px]">10Y G-Sec vs UST 10Y:</span>
                <span className="font-bold text-blue-400">+{sovereignSpread} bps</span>
              </div>
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400 font-mono leading-relaxed">
              * Source: Reserve Bank of India (<span className="text-slate-300">rbi.org.in</span>) CCIL/FBIL benchmarks (`6.20% GS 2029`, `6.53% GS 2031`, `6.94% GS 2036`, `7.06% GS 2041`, `7.63% GS 2056`).
            </div>
          </div>

          {/* RBI LAF Monetary Corridor, T-Bill Cut-Offs & Money Market Benchmarks */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  RBI LAF CORRIDOR, T-BILLS (91D/182D/364D) & MONEY RATES
                </h3>
              </div>
              <a
                href="https://www.rbi.org.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-sky-400 hover:text-sky-300 underline flex items-center gap-0.5"
              >
                <span>RBI Current Rates</span>
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
                  {bonds.rbiAndMoneyRates.map((item) => (
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

            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 bg-[#0e141d] border border-slate-800 rounded-xs flex items-center justify-between">
                <span className="text-slate-400">RBI Call Money Range:</span>
                <span className="text-slate-200 font-bold">{bonds.callRateRange}</span>
              </div>
              <div className="p-2 bg-[#0e141d] border border-slate-800 rounded-xs flex items-center justify-between">
                <span className="text-slate-400">CRR / SLR Ratios:</span>
                <span className="text-slate-200 font-bold">{bonds.crrRate.toFixed(2)}% / {bonds.slrRate.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Indian Rupee (INR / FBIL Ref), RBI Forex Reserves & Equity Telemetry */}
          <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                  INDIAN RUPEE (FBIL REF), RBI FOREX RESERVES & FLOWS
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">RBI / FBIL / NSE</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">Onshore USD/INR Spot:</span>
                <span className="font-bold text-slate-100 tabular-nums">
                  ₹{fxAndEquities.inrSpot.toFixed(4)} ({fxAndEquities.inrChangePct >= 0 ? `+${fxAndEquities.inrChangePct.toFixed(2)}%` : `${fxAndEquities.inrChangePct.toFixed(2)}%`})
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">Official RBI / FBIL Reference (USD):</span>
                <span className="font-bold text-sky-300 tabular-nums">
                  ₹{fxAndEquities.rbiReferenceUsd.toFixed(4)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">FBIL Crosses (EUR / GBP / 100 JPY):</span>
                <span className="font-bold text-slate-200 tabular-nums text-[11px]">
                  ₹{fxAndEquities.rbiReferenceEur.toFixed(2)} / ₹{fxAndEquities.rbiReferenceGbp.toFixed(2)} / ₹{fxAndEquities.rbiReferenceJpy.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">RBI Forex Reserves ({fxAndEquities.forexReservesDate}):</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  US${fxAndEquities.forexReservesUsdBn.toFixed(2)}B ({fxAndEquities.forexReservesWeeklyChgUsdBn >= 0 ? `+${fxAndEquities.forexReservesWeeklyChgUsdBn.toFixed(2)}B` : `${fxAndEquities.forexReservesWeeklyChgUsdBn.toFixed(2)}B`} WoW)
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-300">S&P BSE Sensex Index:</span>
                <span className={`font-bold tabular-nums ${fxAndEquities.sensexIndex.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fxAndEquities.sensexIndex.level.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
                  {fxAndEquities.sensexIndex.changePct >= 0 ? `+${fxAndEquities.sensexIndex.changePct.toFixed(2)}%` : `${fxAndEquities.sensexIndex.changePct.toFixed(2)}%`})
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-300">Foreign FAR G-Sec Index Inflows:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {fxAndEquities.farIndexInflows}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
