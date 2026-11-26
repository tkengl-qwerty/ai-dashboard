import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export type CommentaryScope =
  | 'global'
  | 'indonesia'
  | 'indonesiaNews'
  | 'china'
  | 'korea'
  | 'india'
  | 'equities'
  | 'all';

export interface TopCommentaryPatch {
  regimeBadge: string;
  dominantRegime: string;
  conviction: string;
  synthesis: string;
  positioningTakeaway: string;
  aiGenerated: true;
  modelLabel: string;
  updatedAtSGT: string;
}

export interface CountryBriefingPatch {
  title: string;
  policyPosture: string;
  executiveSummary: string;
  macroPillars: Array<{
    heading: string;
    analysis: string;
  }>;
  aiGenerated: true;
  modelLabel: string;
  updatedAtSGT: string;
}

export interface GeminiCommentaryResult {
  model: string;
  modelLabel: string;
  updatedAtSGT: string;
  topBoxes: Partial<Record<Exclude<CommentaryScope, 'all'>, TopCommentaryPatch>>;
  countryBriefings: Partial<Record<'indonesia' | 'china' | 'korea' | 'india', CountryBriefingPatch>>;
}

export const ACTIVE_GEMINI_MODEL = 'gemini-4-hydrogen';
export const ACTIVE_MODEL_LABEL = 'GEMINI 4 HYDROGEN';

const COUNTRY_TABS = new Set(['indonesia', 'china', 'korea', 'india']);

function formatNowSgt(): string {
  const now = new Date();
  const sgtMs = now.getTime() + 8 * 3600 * 1000;
  const d = new Date(sgtMs);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = months[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  const h24 = d.getUTCHours();
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = String(h24 % 12 || 12).padStart(2, '0');
  return `${day} ${mon} ${yr}, ${h12}:${mins} ${ampm} SGT`;
}

function safeSlice<T>(arr: unknown, max: number): T[] {
  return Array.isArray(arr) ? (arr.slice(0, max) as T[]) : [];
}

function buildCompactTabTelemetry(
  snapshot: Record<string, any>,
  tabs: Array<Exclude<CommentaryScope, 'all'>>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    asOfSGT: snapshot?.metadata?.lastUpdatedSGT || formatNowSgt(),
  };

  const global = snapshot?.globalMacro || {};
  const ust10Y =
    safeSlice<any>(global?.yieldCurve?.tenors, 12).find((t) => t?.label === '10Y')?.yield ?? null;

  if (tabs.includes('global')) {
    payload.global = {
      yieldCurve: global.yieldCurve,
      futures: safeSlice<any>(global.futures, 6),
      fxRates: safeSlice<any>(global.fxRates, 6),
      commodities: safeSlice<any>(global.commodities, 4),
      topNews: safeSlice<any>(global.topNews, 8).map((n) => ({
        headline: n?.headline,
        source: n?.source,
        timeAgo: n?.timeAgo,
        category: n?.category,
        impact: n?.impact,
      })),
    };
  }

  if (tabs.includes('indonesia')) {
    const id = snapshot?.indonesia || {};
    const loc = snapshot?.indonesiaLocalNews || {};
    payload.indonesia = {
      us10YYield: ust10Y,
      biRate: id?.bonds?.biRate,
      cpiInflationYoY: id?.bonds?.cpiInflationYoY,
      sovereignSpread10Y: id?.bonds?.sovereignSpread10Y,
      valuationDate: id?.bonds?.valuationDate,
      yieldSource: id?.bonds?.yieldSource,
      indoGB: safeSlice<any>(id?.bonds?.indoGB, 6),
      srbi: safeSlice<any>(id?.bonds?.srbi, 4),
      fxAndNdf: {
        spotRate: id?.fxAndNdf?.spotRate,
        spotChange: id?.fxAndNdf?.spotChange,
        spotChangePct: id?.fxAndNdf?.spotChangePct,
        jisdorRate: id?.fxAndNdf?.jisdorRate,
        jisdorChange: id?.fxAndNdf?.jisdorChange,
        ndf1M: id?.fxAndNdf?.ndf1M,
        ndfSpread1M: id?.fxAndNdf?.ndfSpread1M,
        ihsgIndex: id?.fxAndNdf?.ihsgIndex,
        foreignFlowsDaily: id?.fxAndNdf?.foreignFlowsDaily,
      },
      headlines: safeSlice<any>(id?.commentary?.noteworthyHeadlines, 6).map((h) => ({
        title: h?.title || h?.headline,
        source: h?.source,
        timeAgo: h?.timeAgo,
      })),
      topLocalHeadlinesEn: safeSlice<any>(loc?.topImportant, 4).map((l) => ({
        titleEn: l?.titleEn,
        source: l?.source,
        category: l?.category,
        timeAgo: l?.timeAgo,
      })),
    };
  }

  if (tabs.includes('indonesiaNews')) {
    const id = snapshot?.indonesia || {};
    const loc = snapshot?.indonesiaLocalNews || {};
    payload.indonesiaNews = {
      biRate: id?.bonds?.biRate,
      indoGB: safeSlice<any>(id?.bonds?.indoGB, 4),
      srbi12M: safeSlice<any>(id?.bonds?.srbi, 4).find((s) => s?.tenor === '12M') || null,
      fxAndNdf: {
        spotRate: id?.fxAndNdf?.spotRate,
        spotChangePct: id?.fxAndNdf?.spotChangePct,
        jisdorRate: id?.fxAndNdf?.jisdorRate,
        ndfSpread1M: id?.fxAndNdf?.ndfSpread1M,
        ihsgIndex: id?.fxAndNdf?.ihsgIndex,
      },
      topImportant: safeSlice<any>(loc?.topImportant, 10).map((it) => ({
        rank: it?.rank,
        titleEn: it?.titleEn,
        source: it?.source,
        category: it?.category,
        timeAgo: it?.timeAgo,
        impactDirection: it?.impactDirection,
        summaryEn: it?.summaryEn,
      })),
      topRead: safeSlice<any>(loc?.topRead, 10).map((it) => ({
        rank: it?.rank,
        titleEn: it?.titleEn,
        source: it?.source,
        category: it?.category,
        timeAgo: it?.timeAgo,
      })),
    };
  }

  if (tabs.includes('china')) {
    const cn = snapshot?.china || {};
    payload.china = {
      us10YYield: ust10Y,
      curveDate: cn?.bonds?.curveDate,
      pbocOmo7dRate: cn?.bonds?.pbocOmo7dRate,
      lpr1Y: cn?.bonds?.lpr1Y,
      lpr5Y: cn?.bonds?.lpr5Y,
      cpiInflationYoY: cn?.bonds?.cpiInflationYoY,
      sovereignSpread10Y: cn?.bonds?.sovereignSpread10Y,
      ccdcCgb: safeSlice<any>(cn?.bonds?.ccdcCgb, 9),
      fxAndEquities: cn?.fxAndEquities,
      headlines: safeSlice<any>(cn?.commentary?.noteworthyHeadlines, 6).map((h) => ({
        title: h?.title || h?.headline,
        source: h?.source,
        timeAgo: h?.timeAgo,
      })),
    };
  }

  if (tabs.includes('korea')) {
    const kr = snapshot?.korea || {};
    payload.korea = {
      us10YYield: ust10Y,
      quotationDate: kr?.bonds?.quotationDate,
      bokBaseRate: kr?.bonds?.bokBaseRate,
      kofrOvernightRate: kr?.bonds?.kofrOvernightRate,
      cd91dRate: kr?.bonds?.cd91dRate,
      cpiInflationYoY: kr?.bonds?.cpiInflationYoY,
      sovereignSpread10Y: kr?.bonds?.sovereignSpread10Y,
      kofiaKtb: safeSlice<any>(kr?.bonds?.kofiaKtb, 7),
      fxAndEquities: kr?.fxAndEquities,
      headlines: safeSlice<any>(kr?.commentary?.noteworthyHeadlines, 6).map((h) => ({
        title: h?.title || h?.headline,
        source: h?.source,
        timeAgo: h?.timeAgo,
      })),
    };
  }

  if (tabs.includes('india')) {
    const ind = snapshot?.india || {};
    payload.india = {
      us10YYield: ust10Y,
      quotationDate: ind?.bonds?.quotationDate,
      rbiRepoRate: ind?.bonds?.rbiRepoRate,
      sdfRate: ind?.bonds?.sdfRate,
      msfRate: ind?.bonds?.msfRate,
      tbill91dRate: ind?.bonds?.tbill91dRate,
      tbill364dRate: ind?.bonds?.tbill364dRate,
      cpiInflationYoY: ind?.bonds?.cpiInflationYoY,
      sovereignSpread10Y: ind?.bonds?.sovereignSpread10Y,
      latestGsecAuctionSummary: ind?.bonds?.latestGsecAuctionSummary,
      gsecCurve: safeSlice<any>(ind?.bonds?.gsecCurve, 8),
      fxAndEquities: ind?.fxAndEquities,
      headlines: safeSlice<any>(ind?.commentary?.noteworthyHeadlines, 6).map((h) => ({
        title: h?.title || h?.headline,
        source: h?.source,
        timeAgo: h?.timeAgo,
      })),
      rbiOfficialReleases: safeSlice<any>(ind?.commentary?.rbiOfficialReleases, 4).map((r) => ({
        title: r?.title,
        category: r?.category,
        pubDate: r?.pubDate,
      })),
    };
  }

  if (tabs.includes('equities')) {
    const eq = snapshot?.equities || {};
    payload.equities = {
      asOfDate: eq?.asOfDate,
      us10YYield: ust10Y,
      indexSummary: eq?.indexSummary,
      topForwardPe: safeSlice<any>(eq?.topForwardPe, 5),
      topFcfToEv: safeSlice<any>(eq?.topFcfToEv, 5),
      topDividendYield: safeSlice<any>(eq?.topDividendYield, 5),
      headlines: safeSlice<any>(eq?.noteworthyHeadlines, 6).map((h) => ({
        title: h?.title || h?.headline,
        source: h?.source,
        timeAgo: h?.timeAgo,
      })),
    };
  }

  return payload;
}

function buildResponseSchemaForTabs(tabs: Array<Exclude<CommentaryScope, 'all'>>) {
  const topBoxSchema = {
    type: Type.OBJECT,
    properties: {
      regimeBadge: {
        type: Type.STRING,
        description: 'Compact uppercase desk badge (max 75 chars) citing the live regime and key yield/FX metric.',
      },
      dominantRegime: {
        type: Type.STRING,
        description: 'Concise 3-7 word label naming today’s primary macro or policy regime.',
      },
      conviction: {
        type: Type.STRING,
        description: 'Sharp 12-22 word tactical trade call headline grounded in exact today yields, FX, or equity shifts.',
      },
      synthesis: {
        type: Type.STRING,
        description: '3-4 sentence institutional desk synthesis weaving together at least 3 specific headlines with exact live yields, spreads, FX, and equity levels.',
      },
      positioningTakeaway: {
        type: Type.STRING,
        description: 'Concrete 2-3 sentence actionable positioning call across rates, FX, and equities with explicit entry/stop or inflection levels.',
      },
    },
    required: ['regimeBadge', 'dominantRegime', 'conviction', 'synthesis', 'positioningTakeaway'],
  };

  const countryBriefingSchema = {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Institutional briefing title reflecting the central bank, bond benchmark, and active regime.',
      },
      policyPosture: {
        type: Type.STRING,
        description: 'Compact monetary policy summary citing exact current policy rate, corridor/SRBI/LPR/KOFR anchor, and active catalyst theme.',
      },
      executiveSummary: {
        type: Type.STRING,
        description: '3-4 sentence executive market briefing synthesizing the top 2-3 news catalysts with exact sovereign curve yields, 1D bps moves, FX, and equity figures.',
      },
      macroPillars: {
        type: Type.ARRAY,
        description: 'Exactly 3 numbered institutional transmission pillars (1. Sovereign Curve & Fiscal/Auction, 2. Central Bank Liquidity & Money Markets, 3. FX, Reserves/Flows & Equities).',
        items: {
          type: Type.OBJECT,
          properties: {
            heading: { type: Type.STRING },
            analysis: { type: Type.STRING },
          },
          required: ['heading', 'analysis'],
        },
      },
    },
    required: ['title', 'policyPosture', 'executiveSummary', 'macroPillars'],
  };

  const topBoxProps: Record<string, unknown> = {};
  const topBoxRequired: string[] = [];
  const briefingProps: Record<string, unknown> = {};
  const briefingRequired: string[] = [];

  for (const tab of tabs) {
    topBoxProps[tab] = topBoxSchema;
    topBoxRequired.push(tab);
    if (COUNTRY_TABS.has(tab)) {
      briefingProps[tab] = countryBriefingSchema;
      briefingRequired.push(tab);
    }
  }

  const rootProps: Record<string, unknown> = {
    topBoxes: {
      type: Type.OBJECT,
      properties: topBoxProps,
      required: topBoxRequired,
    },
  };
  const rootRequired = ['topBoxes'];

  if (briefingRequired.length > 0) {
    rootProps.countryBriefings = {
      type: Type.OBJECT,
      properties: briefingProps,
      required: briefingRequired,
    };
    rootRequired.push('countryBriefings');
  }

  return {
    type: Type.OBJECT,
    properties: rootProps,
    required: rootRequired,
  };
}

async function callGeminiBatch(
  ai: GoogleGenAI,
  snapshot: Record<string, any>,
  tabs: Array<Exclude<CommentaryScope, 'all'>>,
  updatedAtSGT: string
): Promise<{
  topBoxes: Partial<Record<Exclude<CommentaryScope, 'all'>, TopCommentaryPatch>>;
  countryBriefings: Partial<Record<'indonesia' | 'china' | 'korea' | 'india', CountryBriefingPatch>>;
}> {
  const telemetry = buildCompactTabTelemetry(snapshot, tabs);
  const countryList = tabs.filter((t) => COUNTRY_TABS.has(t));

  const systemInstruction =
    'You are the Chief Institutional Macro, Sovereign Fixed-Income, FX & Equities Strategist powering an Asian & Global Macro Desk Terminal. ' +
    'Synthesize every provided news headline alongside exact live sovereign bond yields, 1D bps moves, central bank rates, SRBI/CCDC/KOFIA/RBI operations, FX/NDF basis, and equity index levels. ' +
    'Rules: (1) Never write generic boilerplate or ignore breaking headlines. Cite at least 3 concrete headlines per tab and tie them directly to exact numerical prices/yields from the JSON. ' +
    '(2) Never invent numbers, bond series, or dates that contradict the telemetry JSON. Use exact numbers provided (e.g., Indonesia BI-Rate, PHEI IndoGB FR0109/FR0108 yields, BI SRBI 6M/9M/12M Winner WAR & awarded volumes, JISDOR, NDF spread). ' +
    '(3) Tailor each tactical trade call dynamically to today’s dominant regime (political/governance risk, central bank calibration, fiscal supply, trade/tariff shocks, or equity/index reform). ' +
    '(4) For any country briefing requested, output exactly 3 crisp macroPillars covering (1) Sovereign Yield Curve & Primary Auctions, (2) Central Bank Policy & Liquidity Operations, and (3) FX, Capital Flows & Domestic Equities. ' +
    '(5) Keep prose dense, authoritative, institutional, and plain text (no markdown formatting or asterisks inside JSON string values).';

  const userPrompt =
    `Generate fresh institutional commentary for tabs: ${tabs.join(', ')}` +
    (countryList.length > 0
      ? ` AND lower Executive Market Briefings for countries: ${countryList.join(', ')}.`
      : '.') +
    `\nSession Timestamp: ${updatedAtSGT}\n\nLive Market Telemetry & News JSON:\n${JSON.stringify(telemetry)}`;

  const response = await ai.models.generateContent({
    model: ACTIVE_GEMINI_MODEL,
    contents: userPrompt,
    config: {
      systemInstruction,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.XHIGH,
      },
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchemaForTabs(tabs),
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty response payload.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Gemini returned malformed JSON that could not be parsed.');
  }

  const topBoxes: Partial<Record<Exclude<CommentaryScope, 'all'>, TopCommentaryPatch>> = {};
  const countryBriefings: Partial<Record<'indonesia' | 'china' | 'korea' | 'india', CountryBriefingPatch>> = {};

  for (const tab of tabs) {
    const rawTop = parsed?.topBoxes?.[tab];
    if (
      rawTop &&
      typeof rawTop.conviction === 'string' &&
      typeof rawTop.synthesis === 'string' &&
      typeof rawTop.positioningTakeaway === 'string'
    ) {
      topBoxes[tab] = {
        regimeBadge: String(rawTop.regimeBadge || `${tab.toUpperCase()} · LIVE SYNTHESIS`).trim(),
        dominantRegime: String(rawTop.dominantRegime || 'Live Multi-Asset Regime').trim(),
        conviction: rawTop.conviction.trim(),
        synthesis: rawTop.synthesis.trim(),
        positioningTakeaway: rawTop.positioningTakeaway.trim(),
        aiGenerated: true,
        modelLabel: ACTIVE_MODEL_LABEL,
        updatedAtSGT,
      };
    }
  }

  for (const c of countryList as Array<'indonesia' | 'china' | 'korea' | 'india'>) {
    const rawBr = parsed?.countryBriefings?.[c];
    if (
      rawBr &&
      typeof rawBr.executiveSummary === 'string' &&
      Array.isArray(rawBr.macroPillars) &&
      rawBr.macroPillars.length >= 2
    ) {
      countryBriefings[c] = {
        title: String(rawBr.title || `${c.toUpperCase()} Sovereign & Macro Briefing`).trim(),
        policyPosture: String(rawBr.policyPosture || 'Active Central Bank Calibration').trim(),
        executiveSummary: rawBr.executiveSummary.trim(),
        macroPillars: rawBr.macroPillars.slice(0, 3).map((p: any, idx: number) => ({
          heading: String(p?.heading || `Pillar ${idx + 1}`).trim(),
          analysis: String(p?.analysis || '').trim(),
        })),
        aiGenerated: true,
        modelLabel: ACTIVE_MODEL_LABEL,
        updatedAtSGT,
      };
    }
  }

  return { topBoxes, countryBriefings };
}

export async function generateGeminiCommentary(
  snapshot: Record<string, any>,
  scope: CommentaryScope
): Promise<GeminiCommentaryResult> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error(
      'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets.'
    ) as Error & { status?: number; code?: string };
    err.status = 503;
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const updatedAtSGT = formatNowSgt();

  if (scope === 'all') {
    const [batchA, batchB] = await Promise.all([
      callGeminiBatch(ai, snapshot, ['global', 'indonesia', 'indonesiaNews', 'equities'], updatedAtSGT),
      callGeminiBatch(ai, snapshot, ['china', 'korea', 'india'], updatedAtSGT),
    ]);

    return {
      model: ACTIVE_GEMINI_MODEL,
      modelLabel: ACTIVE_MODEL_LABEL,
      updatedAtSGT,
      topBoxes: {
        ...batchA.topBoxes,
        ...batchB.topBoxes,
      },
      countryBriefings: {
        ...batchA.countryBriefings,
        ...batchB.countryBriefings,
      },
    };
  }

  const single = await callGeminiBatch(ai, snapshot, [scope], updatedAtSGT);
  return {
    model: ACTIVE_GEMINI_MODEL,
    modelLabel: ACTIVE_MODEL_LABEL,
    updatedAtSGT,
    topBoxes: single.topBoxes,
    countryBriefings: single.countryBriefings,
  };
}

export function classifyGeminiError(err: unknown): { status: number; code: string; message: string } {
  const anyErr = err as { status?: number; code?: string; message?: string };
  const rawMsg = String(anyErr?.message || 'Unexpected error generating commentary with Gemini.');
  const upper = rawMsg.toUpperCase();

  if (anyErr?.code === 'MISSING_API_KEY') {
    return {
      status: 503,
      code: 'MISSING_API_KEY',
      message: 'GEMINI_API_KEY is not configured on the server. Check your key in Settings > Secrets.',
    };
  }
  if (
    anyErr?.status === 403 ||
    anyErr?.status === 400 ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID')
  ) {
    return {
      status: 403,
      code: 'API_KEY_INVALID',
      message: 'Gemini API key was rejected (403/400). Please check your API key in Settings > Secrets.',
    };
  }
  if (anyErr?.status === 429 || upper.includes('RESOURCE_EXHAUSTED') || upper.includes('QUOTA')) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message:
        'Gemini API rate limit or quota reached (429). Please wait a moment and retry, or check your key tier in Settings > Secrets.',
    };
  }
  if (anyErr?.status === 404 || upper.includes('NOT_FOUND')) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      message: `Requested Gemini model (${ACTIVE_GEMINI_MODEL}) was not found or is unavailable for this API key.`,
    };
  }

  return {
    status: 502,
    code: 'UPSTREAM_ERROR',
    message: rawMsg.length > 260 ? `${rawMsg.slice(0, 260)}…` : rawMsg,
  };
}
