import React, { useState, useMemo } from 'react';
import { IndonesiaLocalNewsData, IndonesiaTranslatedNewsItem, IndonesiaBonds, IndonesiaFxAndNdf } from '../types/market';
import {
  Languages,
  Newspaper,
  Flame,
  ShieldAlert,
  ExternalLink,
  Search,
  Eye,
  EyeOff,
  Columns2,
  Award,
  TrendingUp,
  Info,
} from 'lucide-react';
import { ArgonCommentaryBox } from './ArgonCommentaryBox';

interface IndonesiaLocalNewsTabProps {
  localNews: IndonesiaLocalNewsData;
  bonds: IndonesiaBonds;
  fxAndNdf: IndonesiaFxAndNdf;
  lastUpdatedSGT?: string;
}

type ViewMode = 'split' | 'important' | 'read';

const CATEGORY_FILTERS = [
  'All Categories',
  'BI & Monetary',
  'IDX & MSCI',
  'Fiscal & APBN',
  'Executive & Politics',
  'Banking & BUMN',
  'Investment & Trade',
  'Commodities & Energy',
] as const;

function getImpactBadgeStyle(direction: string): string {
  switch (direction) {
    case 'Market-Moving':
      return 'text-sky-300 bg-sky-950/70 border-sky-800/70';
    case 'Supportive':
      return 'text-emerald-300 bg-emerald-950/60 border-emerald-800/70';
    case 'Risk-Off':
      return 'text-rose-300 bg-rose-950/60 border-rose-800/70';
    default:
      return 'text-amber-300 bg-amber-950/60 border-amber-800/70';
  }
}

const TranslatedNewsCard: React.FC<{
  item: IndonesiaTranslatedNewsItem;
  boardType: 'important' | 'read';
  showOriginalBahasa: boolean;
}> = ({ item, boardType, showOriginalBahasa }) => {
  return (
    <div className="py-3 px-2.5 hover:bg-[#182334]/70 transition-colors rounded-xs">
      {/* Top Meta Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono mb-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`px-1.5 py-0.5 font-bold rounded-xs border ${
              boardType === 'important'
                ? 'bg-blue-950/80 text-sky-300 border-blue-800/80'
                : 'bg-amber-950/70 text-amber-300 border-amber-800/70'
            }`}
          >
            #{item.rank}
          </span>
          <span className="text-slate-100 font-semibold">SOURCE: {item.source}</span>
          <span className="text-slate-600">·</span>
          <span className="text-sky-300 font-semibold">{item.timeAgo}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300 bg-[#0e141d] px-1.5 py-0.5 border border-slate-700/80 rounded-xs">
            {item.category}
          </span>
          <span
            className={`px-1.5 py-0.5 border rounded-xs font-semibold ${getImpactBadgeStyle(
              item.impactDirection
            )}`}
          >
            {item.impactDirection}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {boardType === 'important' ? (
            <span
              className="text-[10px] font-mono text-sky-300 bg-[#0e141d] px-1.5 py-0.5 border border-slate-700/80 rounded-xs tabular-nums"
              title="Institutional Macro, Policy & Market Impact Score (0–100)"
            >
              IMPACT SCORE: <strong className="text-white">{item.impactScore}/100</strong>
            </span>
          ) : (
            <span
              className="text-[10px] font-mono text-amber-300 bg-[#0e141d] px-1.5 py-0.5 border border-amber-900/60 rounded-xs"
              title="Indonesian Local Portal Readership & Top-Story Placement"
            >
              {item.readPopularityBadge}
            </span>
          )}

          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 text-[10px] underline shrink-0"
              title="Open original Indonesian article"
            >
              <span>Source</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* Translated English Headline */}
      <div className="mb-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-0.2 bg-blue-950/70 text-sky-300 border border-blue-800/60 rounded-xs shrink-0">
            EN TRANSLATED
          </span>
          <h4 className="text-xs sm:text-[13px] font-semibold text-slate-100 leading-snug">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-300 transition-colors"
              >
                {item.titleEn}
              </a>
            ) : (
              <span>{item.titleEn}</span>
            )}
          </h4>
        </div>
      </div>

      {/* Original Bahasa Indonesia Headline */}
      {showOriginalBahasa && (
        <div className="mb-2 pl-2 border-l-2 border-slate-700/90 bg-[#0e141d]/70 py-1 px-2 rounded-xs">
          <div className="flex items-baseline gap-1.5 text-[11px] font-mono text-slate-400">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 bg-slate-800/90 px-1 py-0.2 rounded-xs shrink-0">
              BAHASA ID
            </span>
            <span className="italic text-slate-300">{item.titleId}</span>
          </div>
        </div>
      )}

      {/* Institutional Market Significance */}
      <div className="text-[11px] font-mono text-slate-400 leading-relaxed bg-[#0e141d]/60 px-2.5 py-1.5 border border-slate-800/80 rounded-xs">
        <span className="text-sky-300 font-semibold uppercase text-[10px] mr-1.5">
          Institutional Market Significance:
        </span>
        <span className="text-slate-300">{item.marketSignificance}</span>
      </div>
    </div>
  );
};

export const IndonesiaLocalNewsTab: React.FC<IndonesiaLocalNewsTabProps> = ({
  localNews,
  bonds,
  fxAndNdf,
  lastUpdatedSGT,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showOriginalBahasa, setShowOriginalBahasa] = useState<boolean>(true);

  const { topImportant, topRead, sourcesMonitored, argonCommentary } = localNews;
  const indo10Y = bonds.indoGB.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 7.55;
  const srbi12M =
    bonds.srbi.find((s) => s.tenor === '12M')?.weightedAvgYield ??
    bonds.srbi.find((s) => s.tenor === '12M')?.cutOffYield ??
    6.675;

  const filteredImportant = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return topImportant.filter((item) => {
      const catOk = selectedCategory === 'All Categories' || item.category === selectedCategory;
      const queryOk =
        !q ||
        item.titleEn.toLowerCase().includes(q) ||
        item.titleId.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.marketSignificance.toLowerCase().includes(q);
      return catOk && queryOk;
    });
  }, [topImportant, selectedCategory, searchQuery]);

  const filteredRead = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return topRead.filter((item) => {
      const catOk = selectedCategory === 'All Categories' || item.category === selectedCategory;
      const queryOk =
        !q ||
        item.titleEn.toLowerCase().includes(q) ||
        item.titleId.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.marketSignificance.toLowerCase().includes(q);
      return catOk && queryOk;
    });
  }, [topRead, selectedCategory, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Top 6-Card Telemetry Bar for Indonesia Local-Language News & Translation Pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">LOCAL ID PORTALS</div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {sourcesMonitored.length} Bahasa Feeds
          </div>
          <div className="text-[10px] text-slate-400 font-mono truncate">
            CNBC ID · Kontan · Kompas · Detik · ANTARA
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">TRANSLATION ENGINE</div>
          <div className="text-sm sm:text-base font-bold text-emerald-400 font-mono tabular-nums mt-0.5 flex items-center gap-1">
            <Languages className="w-4 h-4 text-sky-400 shrink-0" />
            <span>ID → EN LIVE</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            BI / OJK / IDX Glossary Active
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">TOP 10 IMPORTANT</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            10 Macro / Policy
          </div>
          <div className="text-[10px] text-sky-300 font-mono truncate">
            Lead: {topImportant[0]?.source || 'CNBC Indonesia'} ({topImportant[0]?.timeAgo || 'Live'})
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">TOP 10 MOST READ</div>
          <div className="text-sm sm:text-base font-bold text-amber-300 font-mono tabular-nums mt-0.5">
            10 Terpopuler ID
          </div>
          <div className="text-[10px] text-slate-400 font-mono truncate">
            Lead: {topRead[0]?.source || 'detikNews'} ({topRead[0]?.timeAgo || 'Live'})
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">USD/IDR & JISDOR</div>
          <div className="text-sm sm:text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            Rp {fxAndNdf.spotRate.toLocaleString('en-US')}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            JISDOR: Rp {fxAndNdf.jisdorRate.toLocaleString('en-US')}
          </div>
        </div>

        <div className="bg-[#131b27] border border-slate-700/80 p-2.5 rounded-xs shadow-sm">
          <div className="text-[10px] text-slate-400 font-mono uppercase">IHSG & 10Y FR0108</div>
          <div className="text-sm sm:text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
            {fxAndNdf.ihsgIndex.level.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            10Y: {indo10Y.toFixed(2)}% · SRBI: {srbi12M.toFixed(3)}%
          </div>
        </div>
      </div>

      {/* Gemini 4 Argon · Indonesia Local-Language Media (ID→EN) & Political-Economic Synthesis */}
      {argonCommentary && (
        <ArgonCommentaryBox
          commentary={argonCommentary}
          lastUpdatedSGT={lastUpdatedSGT}
        />
      )}

      {/* Interactive Control Bar: Board Mode Switcher, Category Filter, Bilingual Search & Original Bahasa Toggle */}
      <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-3 shadow-sm space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Board View Mode Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">DISPLAY BOARD:</span>
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono font-semibold rounded-xs border cursor-pointer transition-colors ${
                viewMode === 'split'
                  ? 'bg-blue-600/30 text-sky-200 border-blue-500'
                  : 'bg-[#0e141d] text-slate-400 border-slate-700/80 hover:text-slate-200'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>SPLIT VIEW (BOTH TOP 10s)</span>
            </button>
            <button
              onClick={() => setViewMode('important')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono font-semibold rounded-xs border cursor-pointer transition-colors ${
                viewMode === 'important'
                  ? 'bg-blue-600/30 text-sky-200 border-blue-500'
                  : 'bg-[#0e141d] text-slate-400 border-slate-700/80 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-sky-400" />
              <span>TOP 10 MOST IMPORTANT</span>
            </button>
            <button
              onClick={() => setViewMode('read')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono font-semibold rounded-xs border cursor-pointer transition-colors ${
                viewMode === 'read'
                  ? 'bg-amber-600/25 text-amber-200 border-amber-500'
                  : 'bg-[#0e141d] text-slate-400 border-slate-700/80 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>TOP 10 MOST READ (TERPOPULER)</span>
            </button>
          </div>

          {/* Search & Show/Hide Bahasa Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search English or Bahasa (e.g. Gibran, MSCI, BI)..."
                className="w-full bg-[#0e141d] border border-slate-700/80 rounded-xs pl-8 pr-2.5 py-1 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => setShowOriginalBahasa((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-xs border cursor-pointer transition-colors ${
                showOriginalBahasa
                  ? 'bg-sky-950/60 text-sky-300 border-sky-800/70'
                  : 'bg-[#0e141d] text-slate-400 border-slate-700/80'
              }`}
              title="Toggle visibility of original Bahasa Indonesia headline underneath the English translation"
            >
              {showOriginalBahasa ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Bahasa Original: {showOriginalBahasa ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800">
          <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">TOPIC FILTER:</span>
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded-xs border cursor-pointer transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600/30 text-sky-200 border-blue-500 font-semibold'
                  : 'bg-[#0e141d] text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Grid: Split View or Single Focused Leaderboard */}
      <div
        className={`grid grid-cols-1 ${
          viewMode === 'split' ? 'xl:grid-cols-12' : ''
        } gap-4`}
      >
        {/* BOARD 1: TOP 10 MOST IMPORTANT LOCAL NEWS (ID -> EN) */}
        {(viewMode === 'split' || viewMode === 'important') && (
          <div
            className={`${
              viewMode === 'split' ? 'xl:col-span-6' : ''
            } bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                      1. TOP 10 MOST IMPORTANT INDONESIA LOCAL NEWS (ID → EN)
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400">
                      Ranked by Institutional Macro, BI/OJK, APBN Fiscal, IDX/MSCI & Constitutional Policy Impact
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-sky-300 bg-sky-950/60 px-2 py-0.5 border border-sky-800/60 rounded-xs font-semibold shrink-0">
                  IMPACT RANKED ({filteredImportant.length})
                </span>
              </div>

              {filteredImportant.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">
                  No translated articles match the current filter criteria.
                </div>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {filteredImportant.map((item) => (
                    <TranslatedNewsCard
                      key={item.id}
                      item={item}
                      boardType="important"
                      showOriginalBahasa={showOriginalBahasa}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 p-2.5 bg-[#0e141d] border border-slate-800 rounded-xs text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5 text-blue-400" />
                <span>Sources: CNBC Indonesia · Kontan · Bisnis · Detik · ANTARA · Kompas · Tempo</span>
              </div>
              <span className="text-sky-300">Auto-Translated to English</span>
            </div>
          </div>
        )}

        {/* BOARD 2: TOP 10 MOST READ / TRENDING LOCAL NEWS (TERPOPULER · ID -> EN) */}
        {(viewMode === 'split' || viewMode === 'read') && (
          <div
            className={`${
              viewMode === 'split' ? 'xl:col-span-6' : ''
            } bg-[#131b27] border border-slate-700/80 rounded-xs p-4 shadow-sm flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80 mb-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-display">
                      2. TOP 10 MOST READ / TRENDING LOCAL NEWS (TERPOPULER · ID → EN)
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400">
                      Ranked by Indonesia Top-Stories Placement & Cross-Portal Readership Syndication
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 border border-amber-800/60 rounded-xs font-semibold shrink-0">
                  MOST READ ({filteredRead.length})
                </span>
              </div>

              {filteredRead.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">
                  No translated articles match the current filter criteria.
                </div>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {filteredRead.map((item) => (
                    <TranslatedNewsCard
                      key={item.id}
                      item={item}
                      boardType="read"
                      showOriginalBahasa={showOriginalBahasa}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 p-2.5 bg-[#0e141d] border border-slate-800 rounded-xs text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Feeds: Google News ID Top Stories · ANTARA Terpopuler · Top Business & Nation</span>
              </div>
              <span className="text-amber-300">Syndication & Readership Ranked</span>
            </div>
          </div>
        )}
      </div>

      {/* Methodology & Source Derivation Sub-Note */}
      <div className="bg-[#131b27] border border-slate-700/80 rounded-xs p-3.5 text-[11px] font-sans space-y-1.5">
        <div className="flex items-center gap-1.5 text-sky-300 font-mono font-bold uppercase text-[10px] tracking-wider">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>INDONESIA LOCAL-LANGUAGE NEWS AGGREGATION & ENGLISH TRANSLATION METHODOLOGY NOTE</span>
        </div>
        <div className="text-slate-300 leading-relaxed">
          <span className="text-slate-100 font-semibold font-mono text-[10px] uppercase">
            Where Local News Data Is Gathered:{' '}
          </span>
          <span>
            Aggregated directly from 9 Bahasa Indonesia RSS feeds spanning{' '}
            <strong className="text-slate-200">{sourcesMonitored.join(', ')}</strong>.
          </span>
        </div>
        <div className="text-slate-300 leading-relaxed">
          <span className="text-slate-100 font-semibold font-mono text-[10px] uppercase">
            How Translation & Ranking Are Derived:{' '}
          </span>
          <span>
            Headlines are translated from Bahasa Indonesia to English via automated neural translation paired with an institutional financial glossary (normalizing{' '}
            <span className="font-mono text-sky-200">IHSG → IHSG (JCI)</span>,{' '}
            <span className="font-mono text-sky-200">BEI → IDX (BEI)</span>,{' '}
            <span className="font-mono text-sky-200">Rp M → IDR Billion</span>,{' '}
            <span className="font-mono text-sky-200">APBN → State Budget</span>,{' '}
            <span className="font-mono text-sky-200">HMP → Parliamentary Inquiry Right</span>).{' '}
            <strong>Top 10 Most Important</strong> ranks stories by institutional macro, BI/OJK, fiscal, and constitutional policy weight;{' '}
            <strong>Top 10 Most Read (Terpopuler)</strong> ranks stories by cross-portal syndication frequency and placement in Indonesia&apos;s Top Stories / Terpopuler feeds.
          </span>
        </div>
      </div>
    </div>
  );
};
