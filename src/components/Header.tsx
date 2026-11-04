import React, { useState, useEffect } from 'react';
import { MarketMetadata } from '../types/market';
import { Clock, RefreshCw, Globe, ShieldCheck, Database, Calendar } from 'lucide-react';

interface HeaderProps {
  metadata: MarketMetadata;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ metadata, onRefresh, isLoading }) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format times in SGT, EST, and UTC
  const sgtString = currentTime.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Singapore',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const estString = currentTime.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  const londonString = currentTime.toLocaleTimeString('en-US', {
    timeZone: 'Europe/London',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="border-b border-slate-800/80 bg-[#070a10] px-4 py-3 select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Terminal Title & Branding */}
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-8 bg-amber-500 rounded-xs shadow-[0_0_12px_rgba(245,158,11,0.5)]"></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-wider text-slate-100 uppercase font-display flex items-center gap-2">
                GLOBAL MACRO & INDONESIA TERMINAL
              </h1>
              <span className="text-[10px] font-mono tracking-tight text-amber-400 bg-amber-950/40 border border-amber-800/50 px-1.5 py-0.5 rounded-xs">
                DAILY 5:00 AM SGT
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
              <span>US Yield Curve</span>
              <span>·</span>
              <span>Global FX & Futures</span>
              <span>·</span>
              <span>IndoGB & SRBI</span>
              <span>·</span>
              <span>USD/IDR NDFs</span>
            </p>
          </div>
        </div>

        {/* Global Market Clocks */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-slate-800 rounded-xs">
            <span className="text-slate-500 text-[10px]">SGT</span>
            <span className="text-amber-400 font-semibold">{sgtString}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/60 border border-slate-800/80 rounded-xs">
            <span className="text-slate-500 text-[10px]">NY / EST</span>
            <span className="text-slate-300">{estString}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/60 border border-slate-800/80 rounded-xs">
            <span className="text-slate-500 text-[10px]">LDN / GMT</span>
            <span className="text-slate-300">{londonString}</span>
          </div>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Reload snapshot data"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 border border-slate-700/80 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 transition-colors rounded-xs cursor-pointer text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Subheader Status Ticker */}
      <div className="max-w-7xl mx-auto mt-2.5 pt-2 border-t border-slate-900/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono gap-y-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-300">
            <Calendar className="w-3 h-3 text-amber-500" />
            <span>Snapshot: <strong className="text-slate-200">{metadata.lastUpdatedSGT}</strong></span>
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline text-slate-400">
            Next Scheduled: <strong className="text-slate-300">{metadata.nextRefreshSGT}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-400">
            <Database className="w-3 h-3 text-emerald-400" />
            <span>Porkbun Static Hosted</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>GitHub Connected</span>
          </span>
        </div>
      </div>
    </header>
  );
};
