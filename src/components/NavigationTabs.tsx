import React from 'react';
import { Globe2, Landmark } from 'lucide-react';
import { DailyMacroSnapshot } from '../types/market';

interface NavigationTabsProps {
  activeTab: 'global' | 'indonesia';
  onTabChange: (tab: 'global' | 'indonesia') => void;
  data: DailyMacroSnapshot;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onTabChange,
  data,
}) => {
  const ust10y = data.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.24;
  const spFuture = data.globalMacro.futures.find((f) => f.symbol === 'ES=F')?.changePct ?? 0.31;
  const dxy = data.globalMacro.futures.find((f) => f.symbol === 'DX=F')?.price ?? 104.15;

  const indo10y = data.indonesia.bonds.indoGB.find((b) => b.tenor.includes('10Y'))?.yield ?? 6.68;
  const srbi12m = data.indonesia.bonds.srbi.find((s) => s.tenor === '12M')?.cutOffYield ?? 7.08;
  const spotIdr = data.indonesia.fxAndNdf.spotRate ?? 15645;

  return (
    <div className="bg-[#0b0e17] border-b border-slate-800 px-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
        {/* Tab Controls */}
        <div className="flex items-center gap-2">
          {/* Global Macro Tab */}
          <button
            onClick={() => onTabChange('global')}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer uppercase ${
              activeTab === 'global'
                ? 'border-amber-400 text-amber-300 bg-slate-900/90'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Globe2 className={`w-4 h-4 ${activeTab === 'global' ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>1. GLOBAL MACRO & MARKETS</span>
          </button>

          {/* Indonesia Market Tab */}
          <button
            onClick={() => onTabChange('indonesia')}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer uppercase ${
              activeTab === 'indonesia'
                ? 'border-amber-400 text-amber-300 bg-slate-900/90'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Landmark className={`w-4 h-4 ${activeTab === 'indonesia' ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>2. INDONESIA MARKET</span>
          </button>
        </div>

        {/* Tab Telemetry Snippet */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-slate-400 pb-1.5">
          {activeTab === 'global' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[10px]">UST 10Y:</span>
                <span className="text-amber-300 font-bold tabular-nums">{ust10y.toFixed(2)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[10px]">S&P 500 FUT:</span>
                <span className={`tabular-nums font-semibold ${spFuture >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {spFuture >= 0 ? `+${spFuture.toFixed(2)}%` : `${spFuture.toFixed(2)}%`}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[10px]">DXY:</span>
                <span className="text-slate-200 tabular-nums">{dxy.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[10px]">IndoGB 10Y:</span>
                <span className="text-amber-300 font-bold tabular-nums">{indo10y.toFixed(2)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[10px]">SRBI 12M:</span>
                <span className="text-cyan-400 font-semibold tabular-nums">{srbi12m.toFixed(2)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[10px]">USD/IDR:</span>
                <span className="text-slate-200 tabular-nums">{spotIdr.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
