import React, { useState } from 'react';
import { MacroNewsItem } from '../types/market';
import { Newspaper, ChevronDown, ChevronUp, ExternalLink, Filter } from 'lucide-react';

interface TopMacroNewsProps {
  news: MacroNewsItem[];
}

export const TopMacroNews: React.FC<TopMacroNewsProps> = ({ news }) => {
  const [filterImpact, setFilterImpact] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredNews = filterImpact === 'ALL'
    ? news
    : news.filter((n) => n.impact.toUpperCase() === filterImpact);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getImpactBadgeClass = (impact: string) => {
    switch (impact) {
      case 'Hawkish':
        return 'text-sky-300 bg-blue-950/50 border-blue-700/60';
      case 'Dovish':
        return 'text-cyan-300 bg-cyan-950/40 border-cyan-700/60';
      case 'Risk-On':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
      case 'Risk-Off':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
      default:
        return 'text-slate-300 bg-slate-800/60 border-slate-600/60';
    }
  };

  return (
    <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-700/80 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
              TOP 10 GLOBAL MACRO NEWS & SYNTHESIS
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Curated within last 12 hours from Bloomberg, Reuters, CNBC, & CNN · Ordered by recency
          </p>
        </div>

        {/* Impact Filter Buttons */}
        <div className="flex items-center gap-1 bg-[#0e141d] p-1 border border-slate-700/80 rounded-xs text-[10px] font-mono">
          <span className="text-slate-400 px-1 hidden sm:inline flex items-center gap-1">
            <Filter className="w-2.5 h-2.5" />
            <span>IMPACT:</span>
          </span>
          {['ALL', 'HAWKISH', 'DOVISH', 'RISK-ON', 'RISK-OFF'].map((btn) => (
            <button
              key={btn}
              onClick={() => setFilterImpact(btn)}
              className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer ${
                filterImpact === btn
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#192434]'
              }`}
            >
              {btn}
            </button>
          ))}
        </div>
      </div>

      {/* News Items List */}
      <div className="divide-y divide-slate-700/50 mt-1">
        {filteredNews.map((item, index) => {
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className={`py-3 px-1.5 transition-colors hover:bg-[#192434]/70 rounded-xs ${
                isExpanded ? 'bg-[#192434]/50' : ''
              }`}
            >
              {/* Item Header Row */}
              <div
                onClick={() => toggleExpand(item.id)}
                className="cursor-pointer flex items-start justify-between gap-3 select-none"
              >
                <div className="flex-1">
                  {/* Clean unboxed metadata with subtle typographic separators */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mb-1">
                    <span className="font-bold text-sky-400">#{index + 1}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-slate-200 font-medium">{item.source}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>{item.category}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-sky-300 font-semibold">{item.timeAgo}</span>
                    {item.url && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 underline text-[10px]"
                          title="Open original news report"
                        >
                          <span>Article</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </>
                    )}
                  </div>

                  {/* Headline */}
                  <h4 className="text-xs sm:text-[13px] font-semibold text-slate-100 hover:text-sky-300 transition-colors leading-snug">
                    {item.headline}
                  </h4>
                </div>

                {/* Right side: Impact indicator + expand chevron */}
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 border rounded-xs font-semibold ${getImpactBadgeClass(
                      item.impact
                    )}`}
                  >
                    {item.impact}
                  </span>
                  <button
                    aria-label="Expand story details"
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expanded Narrative & Institutional Macro Takeaway */}
              {isExpanded && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-700/80 pl-2 sm:pl-4 space-y-2 text-xs">
                  {/* Narrative Summary */}
                  <p className="text-slate-200 leading-relaxed font-sans text-xs">
                    {item.summary}
                  </p>

                  {/* Macro Takeaway Box */}
                  <div className="bg-[#0e141d] border-l-2 border-blue-500 p-2 text-xs font-mono">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-0.5">
                      MACRO IMPLICATION & TRANSMISSION:
                    </span>
                    <span className="text-slate-300 text-xs">
                      {item.macroTakeaway}
                    </span>
                  </div>

                  {/* Source link */}
                  {item.url && (
                    <div className="pt-1 flex items-center justify-end">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-sky-400 transition-colors"
                      >
                        <span>Original Coverage</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
