import React from 'react';
import { ArgonCommentary } from '../types/market';
import { Cpu, Crosshair, CalendarClock, TrendingUp, ShieldAlert } from 'lucide-react';

interface ArgonCommentaryBoxProps {
  commentary: ArgonCommentary;
  lastUpdatedSGT?: string;
}

export const ArgonCommentaryBox: React.FC<ArgonCommentaryBoxProps> = ({
  commentary,
  lastUpdatedSGT,
}) => {
  return (
    <section className="bg-gradient-to-b from-[#152030] to-[#111926] border border-blue-500/40 rounded-xs p-4 shadow-md">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/80">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-blue-600/20 border border-blue-400/50 text-sky-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-xs uppercase tracking-wider">
            <Cpu className="w-3 h-3 text-sky-400" />
            <span>{commentary.modelLabel}</span>
          </span>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-100 font-display">
            {commentary.title}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono font-semibold text-sky-300 bg-[#0e141d] border border-sky-700/60 px-2 py-0.5 rounded-xs">
            {commentary.regimeBadge}
          </span>
          {lastUpdatedSGT && (
            <span className="text-[10px] font-mono text-slate-400 bg-[#0e141d] border border-slate-800 px-2 py-0.5 rounded-xs">
              SYNC: {lastUpdatedSGT}
            </span>
          )}
        </div>
      </div>

      {/* Executive Synthesis & Positioning Callout */}
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 bg-[#0e141d]/90 border border-slate-800 p-3 rounded-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
              EXECUTIVE DESK SYNTHESIS ({commentary.modelLabel})
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              LIVE TELEMETRY DERIVED
            </span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-sans">
            {commentary.synthesis}
          </p>
        </div>

        <div className="lg:col-span-4 bg-blue-950/30 border border-blue-800/50 p-3 rounded-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-blue-300 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
              <span>TACTICAL STANCE & POSITIONING</span>
            </div>
            <div className="text-xs font-semibold text-sky-200 font-mono mb-1.5">
              {commentary.conviction}
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
              {commentary.positioningTakeaway}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Two-Column Grid: Critical Levels & Events to Watch */}
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: Critical Technical & Macro Inflection Levels (7 cols) */}
        <div className="lg:col-span-7 bg-[#0e141d] border border-slate-800 rounded-xs p-3">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-sky-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200 font-display">
                CRITICAL LEVELS & INFLECTION ZONES TO WATCH
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">SUPPORT / RESISTANCE TRIGGERS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                  <th className="py-1 pr-2">Instrument</th>
                  <th className="py-1 px-2 text-right">Current</th>
                  <th className="py-1 px-2 text-right text-emerald-400">Support</th>
                  <th className="py-1 px-2 text-right text-amber-400">Resistance</th>
                  <th className="py-1 pl-2">Desk Trigger Implication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {commentary.criticalLevels.map((lvl) => (
                  <tr key={lvl.asset} className="hover:bg-[#162030]/60 align-top">
                    <td className="py-1.5 pr-2 font-bold text-slate-200 whitespace-nowrap">
                      {lvl.asset}
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-sky-300 tabular-nums whitespace-nowrap">
                      {lvl.current}
                    </td>
                    <td className="py-1.5 px-2 text-right text-emerald-400 tabular-nums whitespace-nowrap">
                      {lvl.support}
                    </td>
                    <td className="py-1.5 px-2 text-right text-amber-300 tabular-nums whitespace-nowrap">
                      {lvl.resistance}
                    </td>
                    <td className="py-1.5 pl-2 text-[11px] text-slate-300 font-sans leading-snug min-w-[200px]">
                      {lvl.implication}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Upcoming Risk Events & Catalysts to Watch (5 cols) */}
        <div className="lg:col-span-5 bg-[#0e141d] border border-slate-800 rounded-xs p-3">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-blue-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200 font-display">
                KEY CATALYSTS & RISK EVENTS TO WATCH
              </h3>
            </div>
            <span className="text-[10px] font-mono text-sky-400">SCHEDULED EVENT DATES</span>
          </div>

          <div className="space-y-2">
            {commentary.eventsToWatch.map((ev, idx) => (
              <div
                key={idx}
                className="p-2 bg-[#131b27]/90 border border-slate-800/90 rounded-xs hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-100 leading-snug">
                    {ev.event}
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-xs uppercase shrink-0 flex items-center gap-1 ${
                      ev.impact === 'Critical'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                        : 'bg-amber-950/70 text-amber-300 border border-amber-700/50'
                    }`}
                  >
                    <ShieldAlert className="w-2.5 h-2.5" />
                    {ev.impact}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-mono bg-sky-950/35 border border-sky-800/50 px-2 py-0.5 rounded-xs mb-1.5">
                  <CalendarClock className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="text-slate-400">EVENT DATE:</span>
                  <span className="font-bold text-sky-300 tabular-nums">{ev.timing}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug font-sans">
                  <span className="text-slate-400 font-mono">Watch for: </span>
                  {ev.watchFor}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
