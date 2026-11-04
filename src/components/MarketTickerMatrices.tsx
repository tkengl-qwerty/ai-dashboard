import React from 'react';
import { MarketFuture, FxRate, Commodity } from '../types/market';
import { ArrowUpRight, ArrowDownRight, Layers, DollarSign, Flame } from 'lucide-react';

interface MarketTickerMatricesProps {
  futures: MarketFuture[];
  fxRates: FxRate[];
  commodities: Commodity[];
}

export const MarketTickerMatrices: React.FC<MarketTickerMatricesProps> = ({
  futures,
  fxRates,
  commodities,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* 1. Equity Futures & Dollar Index */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-xs p-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono mb-2">
          <div className="flex items-center gap-1.5 text-slate-200 font-bold uppercase">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>US FUTURES & DXY</span>
          </div>
          <span className="text-[10px] text-slate-500">SETTLEMENT</span>
        </div>

        <div className="space-y-1.5">
          {futures.map((item) => {
            const isPos = item.change >= 0;
            return (
              <div
                key={item.symbol}
                className="flex items-center justify-between text-xs font-mono py-1 px-1.5 hover:bg-slate-900/60 rounded-xs transition-colors"
              >
                <div>
                  <div className="font-semibold text-slate-200">{item.name}</div>
                  <div className="text-[10px] text-slate-500">{item.symbol}</div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-slate-100 tabular-nums">
                    {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div
                    className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 tabular-nums ${
                      isPos ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    <span>{isPos ? `+${item.change.toFixed(2)}` : item.change.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400">({isPos ? `+${item.changePct.toFixed(2)}%` : `${item.changePct.toFixed(2)}%`})</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Global Foreign Exchange (FX) */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-xs p-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono mb-2">
          <div className="flex items-center gap-1.5 text-slate-200 font-bold uppercase">
            <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
            <span>GLOBAL FX RATES</span>
          </div>
          <span className="text-[10px] text-slate-500">SPOT / 24H</span>
        </div>

        <div className="space-y-1.5">
          {fxRates.map((item) => {
            const isPos = item.change >= 0;
            return (
              <div
                key={item.pair}
                className="flex items-center justify-between text-xs font-mono py-1 px-1.5 hover:bg-slate-900/60 rounded-xs transition-colors"
              >
                <div>
                  <div className="font-semibold text-slate-200">{item.pair}</div>
                  <div className="text-[10px] text-slate-500">{item.name}</div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-slate-100 tabular-nums">
                    {item.rate < 10 ? item.rate.toFixed(4) : item.rate.toFixed(2)}
                  </div>
                  <div
                    className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 tabular-nums ${
                      isPos ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    <span>{isPos ? `+${item.changePct.toFixed(2)}%` : `${item.changePct.toFixed(2)}%`}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Commodities (Energy & Metals) */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-xs p-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono mb-2">
          <div className="flex items-center gap-1.5 text-slate-200 font-bold uppercase">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>OIL & GOLD COMMODITIES</span>
          </div>
          <span className="text-[10px] text-slate-500">CONTRACTS</span>
        </div>

        <div className="space-y-1.5">
          {commodities.map((item) => {
            const isPos = item.change >= 0;
            return (
              <div
                key={item.symbol}
                className="flex items-center justify-between text-xs font-mono py-1 px-1.5 hover:bg-slate-900/60 rounded-xs transition-colors"
              >
                <div>
                  <div className="font-semibold text-slate-200">{item.name}</div>
                  <div className="text-[10px] text-slate-500">{item.unit}</div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-slate-100 tabular-nums">
                    ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div
                    className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 tabular-nums ${
                      isPos ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    <span>{isPos ? `+${item.change.toFixed(2)}` : item.change.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400">({isPos ? `+${item.changePct.toFixed(2)}%` : `${item.changePct.toFixed(2)}%`})</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
