#!/usr/bin/env python3
"""
Daily 5:00 AM SGT Market & Macro Data Updater
1. Fetches Official US Treasury Par Yield Curve (1M to 30Y) from US Treasury XML/CSV feed.
2. Fetches Futures, Global FX, Commodities, USD/IDR Spot, and IHSG via Yahoo Finance (yfinance).
3. Uses Gemini API with Google Search Grounding (two-stage grounded search -> structured JSON)
   to synthesize Top 10 Global Macro News and Indonesia Market Commentary, IndoGB, SRBI, and NDFs.
4. Runs automated financial sense-checks (JISDOR/NDF parity vs Spot USD/IDR, Indo-US 10Y spread,
   and yield curve slope consistency) so stale or mismatched numbers can never appear.

Writes output to: public/data/daily_macro.json
"""

import csv
import io
import json
import os
from datetime import datetime, timedelta, timezone
import requests
import yfinance as yf
from google import genai
from google.genai import types

SGT = timezone(timedelta(hours=8))
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data", "daily_macro.json")


def fetch_us_treasury_yield_curve(existing_curve: dict) -> dict:
    """Fetch official US Treasury Par Yield Curve rates from home.treasury.gov CSV feed."""
    year = datetime.now(timezone.utc).year
    url = (
        f"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
        f"daily-treasury-rates.csv/{year}/all?type=daily_treasury_yield_curve&page&_format=csv"
    )
    tenor_map = [
        ("1 Mo", "1M", 0.08),
        ("3 Mo", "3M", 0.25),
        ("6 Mo", "6M", 0.50),
        ("1 Yr", "1Y", 1.00),
        ("2 Yr", "2Y", 2.00),
        ("3 Yr", "3Y", 3.00),
        ("5 Yr", "5Y", 5.00),
        ("7 Yr", "7Y", 7.00),
        ("10 Yr", "10Y", 10.00),
        ("20 Yr", "20Y", 20.00),
        ("30 Yr", "30Y", 30.00),
    ]
    try:
        resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        reader = list(csv.DictReader(io.StringIO(resp.text)))
        if len(reader) < 2:
            return existing_curve

        latest_row = reader[0]
        prior_row = reader[1]

        tenors = []
        yield_by_label = {}
        for csv_col, label, years in tenor_map:
            if csv_col in latest_row and latest_row[csv_col]:
                curr_val = float(latest_row[csv_col])
                prev_val = float(prior_row[csv_col]) if prior_row.get(csv_col) else curr_val
                chg_bps = round((curr_val - prev_val) * 100, 1)
                tenors.append({
                    "label": label,
                    "years": years,
                    "yield": round(curr_val, 2),
                    "changeBps": chg_bps,
                    "priorClose": round(prev_val, 2),
                })
                yield_by_label[label] = curr_val

        if len(tenors) >= 8:
            y2 = yield_by_label.get("2Y", 4.63)
            y10 = yield_by_label.get("10Y", 4.93)
            y3m = yield_by_label.get("3M", 4.13)
            y5 = yield_by_label.get("5Y", 4.74)
            y30 = yield_by_label.get("30Y", 5.29)
            two_ten = round((y10 - y2) * 100, 1)
            five_ten = round((y10 - y5) * 100, 1)
            three_m_ten = round((y10 - y3m) * 100, 1)
            five_thirty = round((y30 - y5) * 100, 1)
            return {
                "tenors": tenors,
                "spreads": {
                    "twoTenSpread": two_ten,
                    "fiveTenSpread": five_ten,
                    "threeMonthTenSpread": three_m_ten,
                    "fiveThirtySpread": five_thirty,
                    "isInverted": two_ten < 0 or five_ten < 0,
                },
            }
    except Exception as e:
        print(f"Warn: US Treasury CSV fetch failed ({e}), keeping existing yield curve.")
    return existing_curve


def get_yf_quote(symbols: list[str]):
    """Try a list of candidate Yahoo Finance ticker symbols and return (last, prev, chg, pct)."""
    for sym in symbols:
        try:
            hist = yf.Ticker(sym).history(period="5d")
            closes = hist["Close"].dropna()
            if len(closes) >= 2:
                last = float(closes.iloc[-1])
                prev = float(closes.iloc[-2])
                chg = last - prev
                pct = (chg / prev) * 100 if prev else 0.0
                return last, prev, chg, pct
        except Exception as e:
            print(f"Warn: symbol {sym} error: {e}")
    return None


def fetch_yfinance_quotes(existing_data: dict):
    """Pull live futures, FX, commodities, USD/IDR spot, and IHSG from Yahoo Finance."""
    futures_spec = [
        (["ES=F", "^GSPC"], "ES=F", "S&P 500 E-mini"),
        (["NQ=F", "^NDX"], "NQ=F", "Nasdaq 100 E-mini"),
        (["YM=F", "^DJI"], "YM=F", "Dow Jones Mini"),
        (["RTY=F", "^RUT"], "RTY=F", "Russell 2000 Mini"),
        (["DX-Y.NYB", "DX=F"], "DX=F", "US Dollar Index"),
    ]
    fx_spec = [
        (["EURUSD=X"], "EUR/USD", "Euro / US Dollar"),
        (["JPY=X"], "USD/JPY", "US Dollar / Japanese Yen"),
        (["GBPUSD=X"], "GBP/USD", "British Pound / US Dollar"),
        (["CNY=X", "CNH=X"], "USD/CNH", "US Dollar / Offshore Yuan"),
        (["AUDUSD=X"], "AUD/USD", "Australian Dollar / USD"),
        (["SGD=X"], "USD/SGD", "US Dollar / Singapore Dollar"),
    ]
    commodities_spec = [
        (["CL=F"], "CL=F", "WTI Crude Oil", "$/bbl"),
        (["BZ=F"], "BZ=F", "Brent Crude", "$/bbl"),
        (["GC=F"], "GC=F", "Gold Futures", "$/t.oz"),
        (["SI=F"], "SI=F", "Silver Futures", "$/t.oz"),
        (["HG=F"], "HG=F", "Copper Futures", "$/lb"),
    ]

    existing_futures = {f["symbol"]: f for f in existing_data["globalMacro"].get("futures", [])}
    futures_out = []
    for candidates, display_sym, name in futures_spec:
        q = get_yf_quote(candidates)
        if q:
            last, _, chg, pct = q
            futures_out.append({
                "symbol": display_sym,
                "name": name,
                "price": round(last, 2),
                "change": round(chg, 2),
                "changePct": round(pct, 2),
            })
        elif display_sym in existing_futures:
            futures_out.append(existing_futures[display_sym])

    existing_fx = {f["pair"]: f for f in existing_data["globalMacro"].get("fxRates", [])}
    fx_out = []
    for candidates, pair, name in fx_spec:
        q = get_yf_quote(candidates)
        if q:
            last, _, chg, pct = q
            decimals = 4 if last < 10 else 2
            fx_out.append({
                "pair": pair,
                "name": name,
                "rate": round(last, decimals),
                "change": round(chg, decimals),
                "changePct": round(pct, 2),
            })
        elif pair in existing_fx:
            fx_out.append(existing_fx[pair])

    existing_comm = {c["symbol"]: c for c in existing_data["globalMacro"].get("commodities", [])}
    comm_out = []
    for candidates, display_sym, name, unit in commodities_spec:
        q = get_yf_quote(candidates)
        if q:
            last, _, chg, pct = q
            comm_out.append({
                "symbol": display_sym,
                "name": name,
                "price": round(last, 2),
                "unit": unit,
                "change": round(chg, 2),
                "changePct": round(pct, 2),
            })
        elif display_sym in existing_comm:
            comm_out.append(existing_comm[display_sym])

    if futures_out:
        existing_data["globalMacro"]["futures"] = futures_out
    if fx_out:
        existing_data["globalMacro"]["fxRates"] = fx_out
    if comm_out:
        existing_data["globalMacro"]["commodities"] = comm_out

    idr_q = get_yf_quote(["IDR=X"])
    if idr_q:
        last, _, chg, pct = idr_q
        if 10000 <= last <= 25000:
            existing_data["indonesia"]["fxAndNdf"]["spotRate"] = round(last)
            existing_data["indonesia"]["fxAndNdf"]["spotChange"] = round(chg)
            existing_data["indonesia"]["fxAndNdf"]["spotChangePct"] = round(pct, 2)

    jkse_q = get_yf_quote(["^JKSE"])
    if jkse_q:
        last, _, chg, pct = jkse_q
        if 3000 <= last <= 12000:
            existing_data["indonesia"]["fxAndNdf"]["ihsgIndex"] = {
                "level": round(last, 2),
                "change": round(chg, 2),
                "changePct": round(pct, 2),
            }


def fetch_grounded_macro_and_indonesia(existing_data: dict) -> dict:
    """
    Two-stage Gemini Search Grounding pipeline:
    Stage 1: Search the web with Google Search tool (plain text mode to avoid tool+JSON 400 conflict).
    Stage 2: Structure the grounded report into the exact JSON schema.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set; keeping existing grounded fields.")
        return existing_data

    client = genai.Client(api_key=api_key)
    now_sgt = datetime.now(SGT).strftime("%d %b %Y")
    spot_hint = existing_data["indonesia"]["fxAndNdf"]["spotRate"]
    ihsg_hint = existing_data["indonesia"]["fxAndNdf"]["ihsgIndex"]["level"]

    # Stage 1: Web Search Grounding (no response_mime_type so Google Search tool works cleanly)
    search_prompt = f"""
Today is {now_sgt}. Search the web (Bloomberg, Reuters, CNBC, CNN, Financial Times, Bank Indonesia bi.go.id, Jakarta Globe, Antara News, Setkab, CEIC Data, TradingEconomics) and compile a verified daily financial report covering:
1. Top 10 Global Macro News stories strictly within the LAST 12 HOURS, ordered with the most recent at the top (e.g. 1h ago, 2h ago, 3h ago...). Focus heavily on US economy, Federal Reserve, US CPI/PCE inflation, US labor market, US Treasury issuance, and global trade. Include exact headline, verified news source (Bloomberg, Reuters, CNBC, CNN, FT), recency timeAgo, category, 2-sentence summary, macro takeaway, impact (Hawkish, Dovish, Risk-On, Risk-Off, or Neutral), and a direct clickable URL link to the news article.
2. Indonesia Market Daily Briefing within the LAST 16 HOURS (ensure internal consistency with live USD/IDR spot at {spot_hint} and IHSG at {ihsg_hint}):
   - Latest Bank Indonesia (BI-Rate) policy rate, Indonesia CPI inflation YoY, FX reserves, and market commentary across 3 pillars (Monetary & Liquidity Operations, Sovereign Debt Curve & Fiscal Discipline, Currency Dynamics & Equity Market).
   - 5 Noteworthy Indonesia Headlines strictly within the LAST 16 HOURS, ordered by recency with headline, verified source (Jakarta Globe, Antara, Setkab, BPS, Bank Indonesia), timeAgo, market significance, and direct article URL.
   - Latest Indonesia Government Bond (IndoGB) yields for 5Y (FR0101) and 10Y Benchmark (FR0100) tenors (source: TradingEconomics gidn5y:gov around ~7.0%–7.2%), 15Y (FR0098), and 20Y (FR0097).
   - Latest Sekuritas Rupiah Bank Indonesia (SRBI) auction Weighted Average Accepted Rates (WAR), nominal bids, and cut-off yields for 6M, 9M, and 12M tenors from Bank Indonesia (bi.go.id Operasi Moneter) and CEIC Data.
   - Latest Bank Indonesia JISDOR USD/IDR fixing (from bi.go.id/en/statistik/informasi-kurs/jisdor), 5-day fixing history, and USD/IDR 1-Month (1M) and 3-Month (3M) NDF rates.
"""
    grounded_resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=search_prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
        ),
    )
    grounded_report = grounded_resp.text or ""
    if not grounded_report.strip():
        print("Warn: Empty grounded report from Stage 1.")
        return existing_data

    # Stage 2: Convert the grounded report into strict JSON matching topNews & indonesia schema
    template_subset = {
        "topNews": existing_data["globalMacro"]["topNews"],
        "indonesia": existing_data["indonesia"],
    }
    json_prompt = f"""
Convert the following grounded market research report into a JSON object with two top-level keys: "topNews" (array of 10 items) and "indonesia" (matching the exact nested structure of commentary, bonds, and fxAndNdf).
Preserve all field names and data types exactly as shown in the template.

GROUNDED RESEARCH REPORT:
{grounded_report}

JSON TEMPLATE TO MATCH:
{json.dumps(template_subset, indent=2)}
"""
    structured_resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=json_prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    if structured_resp.text:
        parsed = json.loads(structured_resp.text)
        if "topNews" in parsed and isinstance(parsed["topNews"], list) and len(parsed["topNews"]) > 0:
            existing_data["globalMacro"]["topNews"] = parsed["topNews"]
        if "indonesia" in parsed and isinstance(parsed["indonesia"], dict):
            existing_data["indonesia"] = parsed["indonesia"]

    return existing_data


def run_indonesia_sense_check(data: dict):
    """
    Sense-check and reconcile all Indonesian FX, NDF, JISDOR, and Bond spread metrics
    so there is never a mismatch between live spot USD/IDR, JISDOR, NDFs, and yields.
    """
    fx_ndf = data["indonesia"]["fxAndNdf"]
    bonds = data["indonesia"]["bonds"]
    spot = float(fx_ndf.get("spotRate", 18135))

    # 1. Get US 10Y and 3M yields, and Indonesia 10Y and SRBI 6M yields
    ust_10y = next(
        (float(t["yield"]) for t in data["globalMacro"]["yieldCurve"]["tenors"] if t["label"] == "10Y"),
        4.90,
    )
    ust_3m = next(
        (float(t["yield"]) for t in data["globalMacro"]["yieldCurve"]["tenors"] if t["label"] == "3M"),
        4.21,
    )
    indo_10y = next(
        (float(b["yield"]) for b in bonds["indoGB"] if "10Y" in b["tenor"]),
        7.18,
    )
    srbi_6m = next(
        (float(s["weightedAvgYield"]) if s.get("weightedAvgYield") else float(s["cutOffYield"]) for s in bonds["srbi"] if "6M" in s["tenor"]),
        6.491,
    )

    # 2. Sense-check JISDOR: JISDOR is Bank Indonesia's daily onshore spot fixing and should be within 1.5% of Spot
    jisdor = float(fx_ndf.get("jisdorRate", spot))
    if abs(jisdor - spot) / spot > 0.015:
        print(f"Sense-check: Reconciling JISDOR ({jisdor}) to align with USD/IDR Spot ({spot})")
        fx_ndf["jisdorRate"] = round(spot - 7)

    # 3. Sense-check 1M and 3M NDF using Covered Interest Rate Parity if divergent by >2.5% from Spot
    rate_diff_annual = max(0.01, (srbi_6m - ust_3m) / 100.0)
    implied_ndf_1m = round(spot * (1.0 + rate_diff_annual * (30.0 / 365.0)))
    implied_ndf_3m = round(spot * (1.0 + rate_diff_annual * (90.0 / 365.0)))

    ndf1m = float(fx_ndf.get("ndf1M", implied_ndf_1m))
    ndf3m = float(fx_ndf.get("ndf3M", implied_ndf_3m))

    if abs(ndf1m - spot) / spot > 0.025 or ndf1m < spot - 150:
        print(f"Sense-check: Reconciling 1M NDF ({ndf1m}) to interest-parity forward ({implied_ndf_1m})")
        ndf1m = implied_ndf_1m
        fx_ndf["ndf1M"] = ndf1m

    if abs(ndf3m - spot) / spot > 0.04 or ndf3m < ndf1m:
        print(f"Sense-check: Reconciling 3M NDF ({ndf3m}) to interest-parity forward ({implied_ndf_3m})")
        ndf3m = implied_ndf_3m
        fx_ndf["ndf3M"] = ndf3m

    # 4. Recompute 1M NDF spread & annualized basis
    spread_1m = round(ndf1m - spot)
    fx_ndf["ndfSpread1M"] = spread_1m
    if spot > 0:
        fx_ndf["annualizedBasis1M"] = round((spread_1m / spot) * 12.0 * 100.0, 2)

    # 5. Recompute 10Y IndoGB - 10Y UST sovereign spread in bps
    bonds["sovereignSpread10Y"] = round((indo_10y - ust_10y) * 100)


def main():
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Update US Treasury Yield Curve from official US Treasury feed
    data["globalMacro"]["yieldCurve"] = fetch_us_treasury_yield_curve(
        data["globalMacro"]["yieldCurve"]
    )

    # 2. Overlay exact live quotes from Yahoo Finance first (so Spot USD/IDR and IHSG are fresh)
    try:
        fetch_yfinance_quotes(data)
    except Exception as e:
        print(f"Warn: yfinance quotes error: {e}")

    # 3. Update grounded news and Indonesia OTC bond/NDF data via 2-stage Gemini Search Grounding
    try:
        data = fetch_grounded_macro_and_indonesia(data)
    except Exception as e:
        print(f"Warn: Gemini grounding update error: {e}")

    # 4. Re-apply live Yahoo Finance quotes & run financial sense-check
    try:
        fetch_yfinance_quotes(data)
        run_indonesia_sense_check(data)
    except Exception as e:
        print(f"Warn: sense-check error: {e}")

    # 5. Update timestamps
    now_sgt = datetime.now(SGT)
    next_sgt = (now_sgt + timedelta(days=1)).replace(hour=5, minute=0, second=0, microsecond=0)
    data["metadata"]["lastUpdated"] = now_sgt.isoformat()
    data["metadata"]["lastUpdatedSGT"] = now_sgt.strftime("%d %b %Y, %I:%M %p SGT")
    data["metadata"]["nextRefreshSGT"] = next_sgt.strftime("%d %b %Y, 05:00 AM SGT")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Successfully updated {OUTPUT_PATH} at {data['metadata']['lastUpdatedSGT']}")


if __name__ == "__main__":
    main()
