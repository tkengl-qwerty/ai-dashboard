import React from 'react';
import { DailyMacroSnapshot } from '../types/market';
import { MarketTickerMatrices } from './MarketTickerMatrices';
import { YieldCurveChart } from './YieldCurveChart';
import { TopMacroNews } from './TopMacroNews';

interface GlobalMacroTabProps {
  data: DailyMacroSnapshot;
}

export const GlobalMacroTab: React.FC<GlobalMacroTabProps> = ({ data }) => {
  const { futures, fxRates, commodities, yieldCurve, topNews } = data.globalMacro;

  return (
    <div className="space-y-4">
      {/* 1. Market Tickers Bar: Futures, FX, and Commodities */}
      <MarketTickerMatrices
        futures={futures}
        fxRates={fxRates}
        commodities={commodities}
      />

      {/* 2. Main Two-Section Layout: Yield Curve & Top 10 Macro News */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* US Treasury Yield Curve Benchmark (5 cols) */}
        <div className="lg:col-span-5">
          <YieldCurveChart data={yieldCurve} />
        </div>

        {/* Top 10 Global & US Macro News (7 cols) */}
        <div className="lg:col-span-7">
          <TopMacroNews news={topNews} />
        </div>
      </div>
    </div>
  );
};
