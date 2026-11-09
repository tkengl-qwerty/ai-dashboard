import React from 'react';
import { Globe2, Landmark, Building2, Layers, TrendingUp } from 'lucide-react';
import { DailyMacroSnapshot, MacroTabId } from '../types/market';

interface NavigationTabsProps {
  activeTab: MacroTabId;
  onTabChange: (tab: MacroTabId) => void;
  data: DailyMacroSnapshot;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onTabChange,
  data,
}) => {
  const ust10y = data.globalMacro.yieldCurve.tenors.find((t) => t.label === '10Y')?.yield ?? 4.86;
  const spFuture = data.globalMacro.futures.find((f) => f.symbol === 'ES=F')?.changePct ?? 0.26;
  const dxy = data.globalMacro.futures.find((f) => f.symbol === 'DX=F')?.price ?? 102.30;

  const indo10y = data.indonesia.bonds.indoGB.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 7.69;
  const srbi12m =
    data.indonesia.bonds.srbi.find((s) => s.tenor === '12M')?.weightedAvgYield ??
    data.indonesia.bonds.srbi.find((s) => s.tenor === '12M')?.cutOffYield ??
    6.675;
  const spotIdr = data.indonesia.fxAndNdf.spotRate ?? 18080;

  const cgb10y = data.china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 1.587;
  const cgb30y = data.china?.bonds.ccdcCgb.find((b) => b.tenor.startsWith('30Y'))?.yield ?? 2.028;
  const cnySpot = data.china?.fxAndEquities.cnySpot ?? 6.6710;

  const ktb3y = data.korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('3Y'))?.yield ?? 3.622;
  const ktb10y = data.korea?.bonds.kofiaKtb.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 3.852;
  const krwSpot = data.korea?.fxAndEquities.krwSpot ?? 1356.34;

  const indGsec10y = data.india?.bonds.gsecCurve.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 7.162;
  const rbiRepo = data.india?.bonds.rbiRepoRate ?? 5.50;
  const inrSpot = data.india?.fxAndEquities.inrSpot ?? 93.895;

  const spxLevel = data.equities?.indexSummary.spxLevel ?? 7376.86;
  const spxFwdPe = data.equities?.indexSummary.spxForwardPe ?? 21.8;
  const spxEy = data.equities?.indexSummary.spxEarningsYieldPct ?? 4.59;
  const erpBps = Math.round((spxEy - ust10y) * 100);

  return (
    <div className="bg-[#121a26] border-b border-slate-700/80 px-4">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2 pt-2">
        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* 1. Global Macro Tab */}
          <button
            onClick={() => onTabChange('global')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer uppercase whitespace-nowrap shrink-0 ${
              activeTab === 'global'
                ? 'border-blue-500 text-sky-300 bg-[#192436]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#162030]/60'
            }`}
          >
            <Globe2 className={`w-3.5 h-3.5 ${activeTab === 'global' ? 'text-blue-400' : 'text-slate-500'}`} />
            <span>1. GLOBAL MACRO</span>
          </button>

          {/* 2. Indonesia Market Tab */}
          <button
            onClick={() => onTabChange('indonesia')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer uppercase whitespace-nowrap shrink-0 ${
              activeTab === 'indonesia'
                ? 'border-blue-500 text-sky-300 bg-[#192436]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#162030]/60'
            }`}
          >
            <Landmark className={`w-3.5 h-3.5 ${activeTab === 'indonesia' ? 'text-blue-400' : 'text-slate-500'}`} />
            <span>2. INDONESIA</span>
          </button>

          {/* 3. China Market (CCDC) Tab */}
          <button
            onClick={() => onTabChange('china')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer uppercase whitespace-nowrap shrink-0 ${
              activeTab === 'china'
                ? 'border-blue-500 text-sky-300 bg-[#192436]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#162030]/60'
            }`}
          >
            <Building2 className={`w-3.5 h-3.5 ${activeTab === 'china' ? 'text-blue-400' : 'text-slate-500'}`} />
            <span>3. CHINA (CCDC)</span>
          </button>

          {/* 4. Korea Market (SOFIA / KOFIA) Tab */}
          <button
            onClick={() => onTabChange('korea')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer uppercase whitespace-nowrap shrink-0 ${
              activeTab === 'korea'
                ? 'border-blue-500 text-sky-300 bg-[#192436]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#162030]/60'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 ${activeTab === 'korea' ? 'text-blue-400' : 'text-slate-500'}`} />
            <span>4. KOREA (SOFIA / KOFIA)</span>
          </button>

          {/* 5. India Market (RBI / CCIL) Tab */}
          <button
            onClick={() => onTabChange('india')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer uppercase whitespace-nowrap shrink-0 ${
              activeTab === 'india'
                ? 'border-blue-500 text-sky-300 bg-[#192436]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#162030]/60'
            }`}
          >
            <Landmark className={`w-3.5 h-3.5 ${activeTab === 'india' ? 'text-blue-400' : 'text-slate-500'}`} />
            <span>5. INDIA (RBI / CCIL)</span>
          </button>

          {/* 6. US Equities (S&P 500) Tab */}
          <button
            onClick={() => onTabChange('equities')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer uppercase whitespace-nowrap shrink-0 ${
              activeTab === 'equities'
                ? 'border-blue-500 text-sky-300 bg-[#192436]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#162030]/60'
            }`}
          >
            <TrendingUp className={`w-3.5 h-3.5 ${activeTab === 'equities' ? 'text-blue-400' : 'text-slate-500'}`} />
            <span>6. US EQUITIES (S&P 500)</span>
          </button>
        </div>

        {/* Tab Telemetry Snippet */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-slate-400 pb-1.5">
          {activeTab === 'global' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">UST 10Y:</span>
                <span className="text-sky-300 font-bold tabular-nums">{ust10y.toFixed(2)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">S&P 500 FUT:</span>
                <span className={`tabular-nums font-semibold ${spFuture >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {spFuture >= 0 ? `+${spFuture.toFixed(2)}%` : `${spFuture.toFixed(2)}%`}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">DXY:</span>
                <span className="text-slate-200 tabular-nums">{dxy.toFixed(2)}</span>
              </div>
            </>
          )}

          {activeTab === 'indonesia' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">IndoGB 10Y (FR0108):</span>
                <span className="text-sky-300 font-bold tabular-nums">{indo10y.toFixed(2)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">SRBI 12M:</span>
                <span className="text-blue-400 font-semibold tabular-nums">{srbi12m.toFixed(3)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">USD/IDR:</span>
                <span className="text-slate-200 tabular-nums">{spotIdr.toLocaleString()}</span>
              </div>
            </>
          )}

          {activeTab === 'china' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">CCDC 10Y CGB:</span>
                <span className="text-sky-300 font-bold tabular-nums">{cgb10y.toFixed(4)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">CCDC 30Y CGB:</span>
                <span className="text-blue-400 font-semibold tabular-nums">{cgb30y.toFixed(4)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">USD/CNY:</span>
                <span className="text-slate-200 tabular-nums">¥{cnySpot.toFixed(4)}</span>
              </div>
            </>
          )}

          {activeTab === 'korea' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">KOFIA 3Y KTB:</span>
                <span className="text-sky-300 font-bold tabular-nums">{ktb3y.toFixed(3)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">KOFIA 10Y KTB:</span>
                <span className="text-blue-400 font-semibold tabular-nums">{ktb10y.toFixed(3)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">USD/KRW:</span>
                <span className="text-slate-200 tabular-nums">₩{krwSpot.toFixed(2)}</span>
              </div>
            </>
          )}

          {activeTab === 'india' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">RBI 10Y G-Sec:</span>
                <span className="text-sky-300 font-bold tabular-nums">{indGsec10y.toFixed(3)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">RBI Repo:</span>
                <span className="text-blue-400 font-semibold tabular-nums">{rbiRepo.toFixed(2)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">USD/INR:</span>
                <span className="text-slate-200 tabular-nums">₹{inrSpot.toFixed(2)}</span>
              </div>
            </>
          )}

          {activeTab === 'equities' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">S&P 500 (^GSPC):</span>
                <span className="text-sky-300 font-bold tabular-nums">
                  {spxLevel.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">FWD P/E:</span>
                <span className="text-blue-400 font-semibold tabular-nums">{spxFwdPe.toFixed(1)}x</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">ERP vs 10Y:</span>
                <span className="text-slate-200 tabular-nums">{erpBps >= 0 ? `+${erpBps}` : erpBps} bps</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
