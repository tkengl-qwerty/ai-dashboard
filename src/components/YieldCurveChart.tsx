import React, { useState } from 'react';
import { YieldCurveData, YieldCurveTenor } from '../types/market';
import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface YieldCurveChartProps {
  data: YieldCurveData;
}

export const YieldCurveChart: React.FC<YieldCurveChartProps> = ({ data }) => {
  const [activeTenor, setActiveTenor] = useState<YieldCurveTenor | null>(null);

  const tenors = data.tenors;

  // Compute 5Y/10Y spread dynamically if not explicitly provided
  const y5 = tenors.find((t) => t.label === '5Y')?.yield ?? 4.74;
  const y10 = tenors.find((t) => t.label === '10Y')?.yield ?? 4.93;
  const fiveTenSpread = data.spreads.fiveTenSpread ?? Math.round((y10 - y5) * 1000) / 10;

  // Compute min and max yields for chart scaling
  const allYields = tenors.flatMap((t) => [t.yield, t.priorClose]);
  const minYield = Math.floor((Math.min(...allYields) - 0.3) * 2) / 2;
  const maxYield = Math.ceil((Math.max(...allYields) + 0.3) * 2) / 2;

  // Chart dimensions
  const width = 640;
  const height = 240;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  // Map tenor index to X coordinate evenly spaced
  const getX = (index: number) => {
    return padLeft + (index / (tenors.length - 1)) * chartWidth;
  };

  // Map yield to Y coordinate
  const getY = (yieldVal: number) => {
    const ratio = (yieldVal - minYield) / (maxYield - minYield);
    return padTop + chartHeight - ratio * chartHeight;
  };

  // Build SVG path strings
  const currentPath = tenors.reduce((acc, tenor, idx) => {
    const x = getX(idx);
    const y = getY(tenor.yield);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const priorPath = tenors.reduce((acc, tenor, idx) => {
    const x = getX(idx);
    const y = getY(tenor.priorClose);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Fill gradient area path
  const areaPath = `${currentPath} L ${getX(tenors.length - 1)} ${padTop + chartHeight} L ${getX(0)} ${padTop + chartHeight} Z`;

  // Grid horizontal lines
  const gridTicks = [minYield, (minYield + maxYield) / 2, maxYield];

  return (
    <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm">
      {/* Title & Spreads Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-700/80 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
              US TREASURY YIELD CURVE BENCHMARK
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            FRED / US Treasury Daily Curve · 1M to 30Y Tenors
          </p>
        </div>

        {/* Spread Metrics Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* 2Y/10Y Spread */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#192434] border border-slate-700 rounded-xs">
            <span className="text-slate-400 text-[10px]">2Y/10Y SPREAD:</span>
            <span className={`font-bold tabular-nums ${data.spreads.twoTenSpread >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.spreads.twoTenSpread > 0 ? `+${data.spreads.twoTenSpread.toFixed(1)}` : data.spreads.twoTenSpread.toFixed(1)} bps
            </span>
          </div>

          {/* 5Y/10Y Spread */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#192434] border border-slate-700 rounded-xs">
            <span className="text-slate-400 text-[10px]">5Y/10Y SPREAD:</span>
            <span className={`font-bold tabular-nums ${fiveTenSpread >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fiveTenSpread > 0 ? `+${fiveTenSpread.toFixed(1)}` : fiveTenSpread.toFixed(1)} bps
            </span>
            <span
              className={`text-[9px] px-1 py-0.2 border rounded-xs font-semibold ${
                fiveTenSpread < 0
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                  : 'bg-blue-950/60 text-sky-300 border-blue-700/60'
              }`}
            >
              {fiveTenSpread < 0 ? 'INVERTED' : 'NORMAL'}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 sm:h-56 select-none overflow-visible"
        >
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines */}
          {gridTicks.map((tickVal, i) => {
            const y = getY(tickVal);
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#243247"
                  strokeDasharray="2,3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="JetBrains Mono"
                >
                  {tickVal.toFixed(2)}%
                </text>
              </g>
            );
          })}

          {/* Tenor Vertical Guides */}
          {tenors.map((tenor, i) => {
            const x = getX(i);
            return (
              <g key={tenor.label}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + chartHeight}
                  stroke="#1c2738"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={padTop + chartHeight + 18}
                  fill={activeTenor?.label === tenor.label ? '#38bdf8' : '#94a3b8'}
                  fontSize="11"
                  fontWeight={activeTenor?.label === tenor.label ? 'bold' : 'normal'}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono"
                >
                  {tenor.label}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaPath} fill="url(#curveGradient)" />

          {/* Prior Close Path (Dashed Steel) */}
          <path
            d={priorPath}
            fill="none"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="3,3"
          />

          {/* Current Yield Path (Solid Electric Blue) */}
          <path
            d={currentPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Tenor Points & Hit Areas */}
          {tenors.map((tenor, i) => {
            const x = getX(i);
            const y = getY(tenor.yield);
            const isSelected = activeTenor?.label === tenor.label;

            return (
              <g
                key={tenor.label}
                className="cursor-pointer"
                onMouseEnter={() => setActiveTenor(tenor)}
                onClick={() => setActiveTenor(tenor)}
              >
                {/* Invisible larger hover target */}
                <circle cx={x} cy={y} r="14" fill="transparent" />

                {/* Point ring */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 6 : 4}
                  fill="#131b27"
                  stroke="#38bdf8"
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-all duration-150"
                />

                {/* Yield text label above dot */}
                <text
                  x={x}
                  y={y - 8}
                  fill={isSelected ? '#7dd3fc' : '#e2e8f0'}
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                  fontFamily="JetBrains Mono"
                >
                  {tenor.yield.toFixed(2)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2 pt-2 border-t border-slate-700/60">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-500 inline-block"></span>
              <span className="text-slate-300">Latest Yield</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-slate-500 inline-block"></span>
              <span className="text-slate-400">Prior Close</span>
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            Hover over nodes for details
          </div>
        </div>
      </div>

      {/* Tenor Data Grid Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-slate-700/80 text-[10px] text-slate-400 uppercase tracking-wider">
              <th className="py-1.5 px-2">Tenor</th>
              <th className="py-1.5 px-2 text-right">Yield</th>
              <th className="py-1.5 px-2 text-right">Prior</th>
              <th className="py-1.5 px-2 text-right">Chg (bps)</th>
              <th className="py-1.5 px-2 text-right hidden sm:table-cell">Duration (Yrs)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {tenors.map((tenor) => {
              const isSelected = activeTenor?.label === tenor.label;
              const isPositive = tenor.changeBps > 0;
              const isNegative = tenor.changeBps < 0;

              return (
                <tr
                  key={tenor.label}
                  onMouseEnter={() => setActiveTenor(tenor)}
                  className={`hover:bg-[#1a2536] cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-950/30' : ''
                  }`}
                >
                  <td className="py-1 px-2 font-bold text-slate-200 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-sky-400' : 'bg-slate-600'}`}></span>
                    <span>{tenor.label}</span>
                  </td>
                  <td className="py-1 px-2 text-right font-semibold text-sky-300 tabular-nums">
                    {tenor.yield.toFixed(2)}%
                  </td>
                  <td className="py-1 px-2 text-right text-slate-400 tabular-nums">
                    {tenor.priorClose.toFixed(2)}%
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums">
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : isNegative ? <ArrowDownRight className="w-3 h-3" /> : null}
                      {isPositive ? `+${tenor.changeBps.toFixed(1)}` : tenor.changeBps.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-1 px-2 text-right text-slate-400 tabular-nums hidden sm:table-cell">
                    {tenor.years.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
