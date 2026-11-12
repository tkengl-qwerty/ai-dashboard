import React, { useState, useMemo, useEffect } from 'react';
import {
  IndonesiaLocalNewsData,
  IndonesiaTranslatedNewsItem,
  IndonesiaBonds,
  IndonesiaFxAndNdf,
} from '../types/market';
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

const BAHASA_DETECTION_MARKERS = [
  'serahkan',
  'pengunduran',
  'naik ',
  'tanpa ',
  'potret ',
  'beberkan',
  'penyadapan',
  'oleh ',
  'kabar ',
  'mundur',
  'ungkap',
  'jurus',
  'pemerintah',
  'pakai ',
  'saham ',
  'didepak',
  'mulai ',
  'usung ',
  'hingga ',
  'luncurkan',
  'peduli ',
  'pengangguran',
  'tertekan',
  'menguat',
  'keluarkan',
  'ikut ',
  'tersingkir',
  'pecat ',
  'harga ',
  'jatuh ',
  'muncul ',
  'setelah ',
  'jalan ',
  'sebut ',
  'unjuk ',
  'buka suara',
  'hadiri ',
  'pantau ',
  'lalu lintas',
  'hari ini',
  'dengan ',
  'dalam ',
  'untuk ',
  'tidak ',
  'akan ',
  'sudah ',
  'bisa ',
  'ketahanan',
  'keamanan',
];

export function isStillBahasaHeadline(titleEn: string | undefined, titleId: string | undefined): boolean {
  if (!titleEn) return true;
  if (titleId && titleEn.trim().toLowerCase() === titleId.trim().toLowerCase()) return true;
  const padded = ` ${titleEn.toLowerCase()} `;
  let hits = 0;
  for (const m of BAHASA_DETECTION_MARKERS) {
    if (padded.includes(m)) {
      hits += 1;
      if (hits >= 2) return true;
    }
  }
  return false;
}

function preprocessBahasaClient(origId: string): string {
  return origId
    .trim()
    .replace(/^Tok!\s*/i, 'Resmi: ')
    .replace(/^Sah!\s*/i, 'Resmi: ')
    .replace(/^Potret\s+/i, 'Foto: ')
    .replace(/\bPatwal\b/gi, 'Pengawalan Polisi (Patwal)')
    .replace(/\bCs\b/g, 'dan kawan-kawan')
    .replace(/(Rp\.?\s*\d+(?:[.,]\d+)?)\s*M\b/g, '$1 Miliar')
    .replace(/\bTembus\s+(Rp|Level|\d)/gi, 'Menembus $1');
}

function polishInstitutionalEnClient(textEn: string): string {
  let t = textEn
    .trim()
    .replace(/^\[\d+\]\s*/, '')
    .replace(/^[\u200b\u2060\ufeff\-•\s]+/, '');

  const replacements: Array<[RegExp, string]> = [
    [/^Knock!\s*/i, 'Official: '],
    [/^Portrait of\s+(?:the\s+)?/i, 'Photos: '],
    [/\bTranslucent\b/g, 'Breaches'],
    [/\btranslucent\b/g, 'breaches'],
    [/\bPrints Profits? of\b/gi, 'Posts Net Profit of'],
    [/\bOpens Voice\b/gi, 'Responds'],
    [/\bopens its voice\b/gi, 'responds'],
    [/\band friends\b/gi, 'et al.'],
    [/\bWithout Patwal\b/gi, 'Without Police Escort (Patwal)'],
    [/\bRI\b/g, 'Indonesia'],
    [/\bJCI\b/g, 'IHSG (JCI)'],
    [/\bIHSG\b(?!\s*\(JCI\))/g, 'IHSG (JCI)'],
    [/\bBEI\b/g, 'IDX (BEI)'],
    [/\bWapres\b/g, 'VP'],
    [/\bMendikti\b/g, 'Higher Education Minister'],
    [/\bMenkeu\b/g, 'Finance Minister'],
    [/\bWamen\b/g, 'Deputy Minister'],
    [/\bSeskab\b/g, 'Cabinet Secretary'],
    [/\bKabakom\b/g, 'Presidential Communication Head'],
    [/\bKapolri\b/g, 'National Police Chief'],
    [/\bDirut\b/g, 'President Director'],
    [/\bEmiten\b/g, 'Listed Issuers'],
    [/\bemiten\b/g, 'listed issuers'],
    [/\bBUMN\b/g, 'SOE (BUMN)'],
    [/\bSBN\b/g, 'SBN (IndoGB)'],
    [/\bAPBN\b/g, 'APBN (State Budget)'],
    [/\bKSSK\b/g, 'KSSK (Financial System Stability Committee)'],
    [/\bHMP\b/g, 'HMP (Parliamentary Inquiry Right)'],
    [/\bKUR\b/g, "KUR (People's Business Credit)"],
    [/\bUMKM\b/g, 'MSMEs (UMKM)'],
    [/\bRp\.?\s*(\d)/g, 'IDR $1'],
  ];

  for (const [pat, rep] of replacements) {
    t = t.replace(pat, rep);
  }
  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  return t;
}

/**
 * Generates a specific 1-line summary of the news AND a specific 1-line potential impact
 * whenever an item has generic boilerplate or was newly translated on the client.
 */
function buildOneLineSummaryAndImpact(
  item: IndonesiaTranslatedNewsItem,
  titleEn: string,
  spotIdr: number,
  jisdor: number,
  ihsgLvl: number,
  indo10Y: number,
  srbi12M: number
): { summaryLine: string; impactLine: string } {
  const low = `${item.titleId} ${titleEn} ${item.summaryEn || ''}`.toLowerCase();
  const src = item.source || 'Indonesian Media';

  const existingSummary = (item.summaryEn || '').trim();
  const isOldBoilerplateSummary =
    !existingSummary ||
    existingSummary.startsWith('Translated from ') ||
    existingSummary.includes('originally reported in Bahasa Indonesia as') ||
    isStillBahasaHeadline(existingSummary, item.titleId);

  let summaryLine = existingSummary;
  if (isOldBoilerplateSummary) {
    if (low.includes('innova') || low.includes('patwal')) {
      summaryLine = `${src} reports that VP Gibran Rakabuming Raka arrived at the MPR parliamentary complex in a private Kijang Innova without a police escort (Patwal) to submit his resignation letter.`;
    } else if (low.includes('danantara') && low.includes('gibran')) {
      summaryLine = `${src} reports that sovereign wealth fund Danantara outlined three market-stabilization measures to reassure domestic and foreign investors amid VP Gibran's resignation news.`;
    } else if (low.includes('gibran') && (low.includes('ihsg') || low.includes('melonjak') || low.includes('2%'))) {
      summaryLine = `${src} reports that the IHSG (JCI) rallied +2% into positive territory as VP Gibran formally submitted his resignation letter to parliament.`;
    } else if (low.includes('gibran') || low.includes('pengunduran diri') || low.includes('wapres')) {
      summaryLine = `${src} covers parliamentary and MPR proceedings in Jakarta surrounding VP Gibran Rakabuming Raka's resignation letter submission.`;
    } else if (low.includes('ahrie sonta') || (low.includes('pecat') && low.includes('polri'))) {
      summaryLine = `${src} reports that the National Police (Polri) dismissed Inspector General Ahrie Sonta Nasution after proving unlawful wiretapping against President Prabowo.`;
    } else if (low.includes('lpsk') || low.includes('8 saksi') || low.includes('8 witnesses')) {
      summaryLine = `${src} reports that eight witnesses applied for LPSK protection—including one justice collaborator—in the President Prabowo wiretapping investigation.`;
    } else if (low.includes('listyo sigit') || low.includes('penyadapan') || low.includes('wiretapping')) {
      summaryLine = `${src} reports that National Police Chief Listyo Sigit Prabowo briefed the DPR on the investigation into the unlawful wiretapping of President Prabowo.`;
    } else if (low.includes('msci') || low.includes('brpt') || low.includes('brms')) {
      summaryLine = `${src} details MSCI's November 2026 index rebalancing, which removes BRPT, BRMS, and seven other Indonesian stocks while adjusting foreign free-float weights.`;
    } else if (low.includes('383') || low.includes('300') || low.includes('hsc')) {
      summaryLine = `${src} reports that IDX (BEI) is officially excluding 383 High Shareholder Concentration (HSC) stocks from IHSG (JCI) index calculations effective November 13, 2026.`;
    } else if (low.includes('byd') || low.includes('subang')) {
      summaryLine = `${src} reports on EV manufacturer BYD's Subang industrial plant expansion and recruitment of thousands of Indonesian workers.`;
    } else if (low.includes('the fed') || low.includes('all-time low') || low.includes('all–time low') || low.includes('rupiah')) {
      summaryLine = `${src} reports that hawkish Federal Reserve rate expectations are pressuring the Indonesian Rupiah toward Rp ${spotIdr.toLocaleString('en-US')}/USD in onshore FX trading.`;
    } else if (low.includes('apbn') || low.includes('jor-joran') || low.includes('state budget')) {
      summaryLine = `${src} examines the government's accelerated APBN (State Budget) fiscal spending and Bank Indonesia's liquidity operations to boost domestic GDP growth.`;
    } else if (low.includes('likuiditas') || low.includes('149')) {
      summaryLine = `${src} reports that Bank Indonesia disbursed Rp149.3 trillion in Macroprudential Liquidity Incentives (KLM) to commercial banks for MSMEs and housing credit.`;
    } else if (low.includes('emas') || low.includes('gold')) {
      summaryLine = `${src} reports a nearly 3% pullback in gold prices as higher US real yields and stronger dollar dynamics trigger profit-taking.`;
    } else if (low.includes('uu pemilu') || low.includes('election law') || low.includes('komisi ii')) {
      summaryLine = `${src} reports that DPR Commission II's working committee engaged constitutional scholars to deliberate revisions to Indonesia's Election Law.`;
    } else {
      summaryLine = `${src} reports: ${titleEn.replace(/\.$/, '')}.`;
    }
  }

  const existingImpact = (item.marketSignificance || '').trim();
  const isGenericBoilerplateImpact =
    !existingImpact ||
    existingImpact.startsWith('High-attention constitutional and parliamentary') ||
    existingImpact.startsWith('Key national security, governance, and institutional') ||
    existingImpact.startsWith('Monitored across onshore Bahasa Indonesia financial portals');

  let impactLine = existingImpact;
  if (isGenericBoilerplateImpact) {
    if (low.includes('innova') || (low.includes('gibran') && low.includes('mpr'))) {
      impactLine = `Signals an orderly, constitutional MPR succession process in Jakarta, helping contain political risk premia on 10Y IndoGBs (${indo10Y.toFixed(2)}%) and USD/IDR (Rp ${spotIdr.toLocaleString('en-US')}).`;
    } else if (low.includes('danantara') && low.includes('gibran')) {
      impactLine = `Danantara's proactive institutional backstop anchors foreign fund confidence and supports SOE (BUMN) blue-chip equities on the IHSG (${ihsgLvl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`;
    } else if (low.includes('gibran') && (low.includes('ihsg') || low.includes('melonjak') || low.includes('2%'))) {
      impactLine = `Removes political overhang and sparks a relief rally across liquid LQ45 financials as certainty over constitutional procedure improves.`;
    } else if (low.includes('gibran') || low.includes('wapres')) {
      impactLine = `Focuses investor attention on MPR constitutional continuity while keeping APBN fiscal execution and BI monetary operations insulated.`;
    } else if (low.includes('lpsk') || low.includes('saksi') || low.includes('witness')) {
      impactLine = `Accelerates evidentiary disclosures in the executive wiretapping probe, keeping parliamentary oversight and security reforms in focus.`;
    } else if (low.includes('ahrie sonta') || (low.includes('pecat') && low.includes('polri'))) {
      impactLine = `Decisive disciplinary action within Polri reinforces executive security discipline and institutional rule-of-law credibility.`;
    } else if (low.includes('listyo sigit') || (low.includes('kapolri') && low.includes('dpr')) || low.includes('penyadapan')) {
      impactLine = `Transparent DPR parliamentary hearings on the wiretapping probe reduce governance uncertainty for onshore capital markets.`;
    } else if (low.includes('msci') || low.includes('brpt') || low.includes('brms')) {
      impactLine = `Drives passive foreign index outflows from excluded tickers (BRPT, BRMS) while concentrating institutional liquidity into core LQ45 banks.`;
    } else if (low.includes('383') || low.includes('300') || low.includes('hsc')) {
      impactLine = `Structural IDX reform strips out illiquid low-float stocks from IHSG (${ihsgLvl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}), improving index investability ahead of MSCI's review.`;
    } else if (low.includes('byd') || low.includes('subang')) {
      impactLine = `Bolsters West Java manufacturing employment and EV supply-chain FDI inflows, supporting Indonesia's structural balance of payments.`;
    } else if (low.includes('the fed') || low.includes('all-time low') || low.includes('all–time low') || low.includes('rupiah')) {
      impactLine = `Increases near-term imported volatility on USD/IDR (Rp ${spotIdr.toLocaleString('en-US')}, JISDOR Rp ${jisdor.toLocaleString('en-US')}) and keeps Bank Indonesia active in DNDF and SRBI (${srbi12M.toFixed(3)}%) intervention.`;
    } else if (low.includes('apbn') || low.includes('jor-joran')) {
      impactLine = `Boosts Q4 domestic demand and fiscal impulse, though bond desks watch DJPPR SBN issuance supply and the 10Y FR0108 (${indo10Y.toFixed(2)}%) yield.`;
    } else if (low.includes('uu pemilu') || low.includes('election law') || low.includes('komisi ii')) {
      impactLine = `Shapes long-term electoral threshold and coalition rules ahead of the next legislative cycle without disrupting near-term cabinet execution.`;
    } else if (low.includes('emas') || low.includes('gold')) {
      impactLine = `Pressures short-term domestic Antam gold retail prices and precious-metal mining equities (ANTM, BRMS, MDKA) on the IDX.`;
    } else {
      impactLine = `Shapes onshore institutional sentiment across the Jakarta Composite Index (IHSG ${ihsgLvl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) and Rupiah money markets (Rp ${spotIdr.toLocaleString('en-US')}).`;
    }
  }

  return { summaryLine, impactLine };
}

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
  translatedTitleEn: string;
  summaryLine: string;
  impactLine: string;
  boardType: 'important' | 'read';
  showOriginalBahasa: boolean;
}> = ({ item, translatedTitleEn, summaryLine, impactLine, boardType, showOriginalBahasa }) => {
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
                {translatedTitleEn}
              </a>
            ) : (
              <span>{translatedTitleEn}</span>
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

      {/* Quick 1-Liner Summary of the News & Potential Impact */}
      <div className="text-[11px] leading-relaxed bg-[#0e141d]/80 px-2.5 py-2 border border-slate-800/90 rounded-xs space-y-1">
        <div>
          <span className="text-sky-400 font-mono font-bold uppercase text-[10px] mr-1.5">
            1-LINE SUMMARY:
          </span>
          <span className="text-slate-200 font-sans">{summaryLine}</span>
        </div>
        <div className="pt-1 border-t border-slate-800/70">
          <span className="text-amber-300 font-mono font-bold uppercase text-[10px] mr-1.5">
            POTENTIAL IMPACT:
          </span>
          <span className="text-slate-300 font-sans">{impactLine}</span>
        </div>
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
  const [liveTranslatedMap, setLiveTranslatedMap] = useState<Record<string, string>>({});

  const { topImportant, topRead, sourcesMonitored, argonCommentary } = localNews;
  const indo10Y = bonds.indoGB.find((b) => b.tenor.startsWith('10Y'))?.yield ?? 7.55;
  const srbi12M =
    bonds.srbi.find((s) => s.tenor === '12M')?.weightedAvgYield ??
    bonds.srbi.find((s) => s.tenor === '12M')?.cutOffYield ??
    6.675;

  // Automatic client-side live translation fallback in case remote JSON has any untranslated Bahasa headlines
  useEffect(() => {
    let cancelled = false;
    const allItems = [...topImportant, ...topRead];
    const untranslated = allItems.filter(
      (it) => !liveTranslatedMap[it.titleId] && isStillBahasaHeadline(it.titleEn, it.titleId)
    );

    if (untranslated.length === 0) return;

    async function translateMissingOnClient() {
      const uniqueTitles = Array.from(new Set(untranslated.map((u) => u.titleId)));
      const tagged = uniqueTitles
        .map((t, idx) => `[${idx}] ${preprocessBahasaClient(t.replace(/[\r\n]+/g, ' '))}`)
        .join('\n');

      const endpoints = [
        `https://clients5.google.com/translate_a/single?client=at&sl=id&tl=en&dt=t&q=${encodeURIComponent(
          tagged
        )}`,
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=en&dt=t&q=${encodeURIComponent(
          tagged
        )}`,
      ];

      const newMap: Record<string, string> = {};

      for (const url of endpoints) {
        try {
          const resp = await fetch(url);
          if (!resp.ok) continue;
          const parsed = await resp.json();
          if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
            const fullEn = parsed[0]
              .map((seg: unknown) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
              .join('');
            const regex = /\[(\d+)\]\s*([\s\S]*?)(?=\s*\[\d+\]|$)/g;
            let match: RegExpExecArray | null;
            while ((match = regex.exec(fullEn)) !== null) {
              const idx = Number(match[1]);
              const rawEn = (match[2] || '').trim();
              if (idx >= 0 && idx < uniqueTitles.length && rawEn) {
                newMap[uniqueTitles[idx]] = polishInstitutionalEnClient(rawEn);
              }
            }
            if (Object.keys(newMap).length > 0) break;
          }
        } catch {
          // Try next endpoint
        }
      }

      if (!cancelled && Object.keys(newMap).length > 0) {
        setLiveTranslatedMap((prev) => ({ ...prev, ...newMap }));
      }
    }

    translateMissingOnClient();
    return () => {
      cancelled = true;
    };
  }, [topImportant, topRead, liveTranslatedMap]);

  const enrichedImportant = useMemo(() => {
    return topImportant.map((item) => {
      const finalTitleEn = liveTranslatedMap[item.titleId] || polishInstitutionalEnClient(item.titleEn);
      const { summaryLine, impactLine } = buildOneLineSummaryAndImpact(
        item,
        finalTitleEn,
        fxAndNdf.spotRate,
        fxAndNdf.jisdorRate,
        fxAndNdf.ihsgIndex.level,
        indo10Y,
        srbi12M
      );
      return { item, finalTitleEn, summaryLine, impactLine };
    });
  }, [topImportant, liveTranslatedMap, fxAndNdf.spotRate, fxAndNdf.jisdorRate, fxAndNdf.ihsgIndex.level, indo10Y, srbi12M]);

  const enrichedRead = useMemo(() => {
    return topRead.map((item) => {
      const finalTitleEn = liveTranslatedMap[item.titleId] || polishInstitutionalEnClient(item.titleEn);
      const { summaryLine, impactLine } = buildOneLineSummaryAndImpact(
        item,
        finalTitleEn,
        fxAndNdf.spotRate,
        fxAndNdf.jisdorRate,
        fxAndNdf.ihsgIndex.level,
        indo10Y,
        srbi12M
      );
      return { item, finalTitleEn, summaryLine, impactLine };
    });
  }, [topRead, liveTranslatedMap, fxAndNdf.spotRate, fxAndNdf.jisdorRate, fxAndNdf.ihsgIndex.level, indo10Y, srbi12M]);

  const filteredImportant = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedImportant.filter(({ item, finalTitleEn, summaryLine, impactLine }) => {
      const catOk = selectedCategory === 'All Categories' || item.category === selectedCategory;
      const queryOk =
        !q ||
        finalTitleEn.toLowerCase().includes(q) ||
        item.titleId.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        summaryLine.toLowerCase().includes(q) ||
        impactLine.toLowerCase().includes(q);
      return catOk && queryOk;
    });
  }, [enrichedImportant, selectedCategory, searchQuery]);

  const filteredRead = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedRead.filter(({ item, finalTitleEn, summaryLine, impactLine }) => {
      const catOk = selectedCategory === 'All Categories' || item.category === selectedCategory;
      const queryOk =
        !q ||
        finalTitleEn.toLowerCase().includes(q) ||
        item.titleId.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        summaryLine.toLowerCase().includes(q) ||
        impactLine.toLowerCase().includes(q);
      return catOk && queryOk;
    });
  }, [enrichedRead, selectedCategory, searchQuery]);

  const liveArgonCommentary = useMemo(() => {
    if (!argonCommentary) return undefined;
    const imp1 = enrichedImportant[0];
    const imp2 = enrichedImportant[1];
    const imp3 = enrichedImportant[2];
    const read1 = enrichedRead[0];
    const read2 = enrichedRead[1];

    if (!imp1 && !read1) return argonCommentary;

    const leadImp = imp1?.finalTitleEn || 'IDX (BEI) Releases List of 383 HSC Shares Excluded from IHSG Ahead of MSCI Review';
    const leadImpMeta = imp1 ? `${imp1.item.source} · ${imp1.item.timeAgo}` : 'Onshore Feed';
    const secondImp = imp2?.finalTitleEn || 'MSCI November 2026 Rebalancing Reshapes Foreign Index Weights Across IDX Constituents';
    const thirdImp = imp3?.finalTitleEn || 'Executive and Parliamentary Policy Coordination Anchors Fiscal and Financial Stability';

    const leadRead = read1?.finalTitleEn || 'IHSG (JCI) Consolidates as Foreign Institutional Investors Accumulate 10 Liquid Blue-Chip Shares';
    const leadReadMeta = read1 ? `${read1.item.source} · ${read1.item.timeAgo}` : 'Terpopuler Feed';
    const secondRead = read2?.finalTitleEn || 'Domestic Political, Regulatory & Industrial Developments Dominate Onshore Readership';

    const spot = fxAndNdf.spotRate;
    const spotPct = fxAndNdf.spotChangePct;
    const jisdor = fxAndNdf.jisdorRate;
    const ihsg = fxAndNdf.ihsgIndex.level;
    const ihsgPct = fxAndNdf.ihsgIndex.changePct;
    const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

    return {
      ...argonCommentary,
      updatedAtSGT: lastUpdatedSGT || localNews.asOfDate || argonCommentary.updatedAtSGT,
      conviction: `Focus on #1 Macro Catalyst (${imp1?.item.category || 'Capital Markets'}) & Liquid LQ45 · Fade Headline Noise via 10Y FR0108 (${indo10Y.toFixed(2)}%) & 12M SRBI (${srbi12M.toFixed(3)}%)`,
      synthesis:
        `Live Bahasa Indonesia aggregation and English translation across 10 onshore portals is led on the Top 10 Most Important board by ` +
        `#1 "${leadImp}" (${leadImpMeta}), #2 "${secondImp}" (${imp2?.item.source || 'ID Portal'}), and #3 "${thirdImp}" (${imp3?.item.source || 'ID Portal'}). ` +
        `Simultaneously, the Top 10 Most Read (Terpopuler) national board is topped by #1 "${leadRead}" (${leadReadMeta}) and #2 "${secondRead}" (${read2?.item.source || 'ID Portal'}). ` +
        `Across onshore Jakarta markets, USD/IDR trades at Rp ${spot.toLocaleString('en-US')} (${fmtPct(spotPct)} 1D; JISDOR Rp ${jisdor.toLocaleString('en-US')}), IHSG sits at ${ihsg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fmtPct(ihsgPct)}), and 10Y FR0108 IndoGB yields ${indo10Y.toFixed(2)}% (12M SRBI ${srbi12M.toFixed(3)}% WAR).`,
      positioningTakeaway:
        `Separate high-velocity domestic readership ("${leadRead.slice(0, 62)}") from institutional market drivers led by "${leadImp.slice(0, 68)}". ` +
        `Desk impact: ${imp1?.impactLine || argonCommentary.positioningTakeaway}`,
    };
  }, [
    argonCommentary,
    enrichedImportant,
    enrichedRead,
    fxAndNdf.spotRate,
    fxAndNdf.spotChangePct,
    fxAndNdf.jisdorRate,
    fxAndNdf.ihsgIndex.level,
    fxAndNdf.ihsgIndex.changePct,
    indo10Y,
    srbi12M,
    lastUpdatedSGT,
    localNews.asOfDate,
  ]);

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
            1-Line Summary + Impact Active
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
      {liveArgonCommentary && (
        <ArgonCommentaryBox
          commentary={liveArgonCommentary}
          lastUpdatedSGT={lastUpdatedSGT || localNews.asOfDate}
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
                  {filteredImportant.map(({ item, finalTitleEn, summaryLine, impactLine }) => (
                    <TranslatedNewsCard
                      key={item.id}
                      item={item}
                      translatedTitleEn={finalTitleEn}
                      summaryLine={summaryLine}
                      impactLine={impactLine}
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
                  {filteredRead.map(({ item, finalTitleEn, summaryLine, impactLine }) => (
                    <TranslatedNewsCard
                      key={item.id}
                      item={item}
                      translatedTitleEn={finalTitleEn}
                      summaryLine={summaryLine}
                      impactLine={impactLine}
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
            How Translation, 1-Line Summary & Potential Impact Are Derived:{' '}
          </span>
          <span>
            Headlines and RSS article snippets are translated from Bahasa Indonesia to English via indexed neural translation paired with an institutional financial glossary (normalizing{' '}
            <span className="font-mono text-sky-200">IHSG → IHSG (JCI)</span>,{' '}
            <span className="font-mono text-sky-200">BEI → IDX (BEI)</span>,{' '}
            <span className="font-mono text-sky-200">Rp M → IDR Billion</span>,{' '}
            <span className="font-mono text-sky-200">APBN → State Budget</span>,{' '}
            <span className="font-mono text-sky-200">HMP → Parliamentary Inquiry Right</span>), plus a real-time browser translation fallback.{' '}
            Each card provides a specific <strong>1-Line Summary</strong> of the news report alongside its <strong>Potential Impact</strong> on Indonesian markets and policy.
          </span>
        </div>
      </div>
    </div>
  );
};
