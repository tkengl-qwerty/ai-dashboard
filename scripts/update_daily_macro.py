#!/usr/bin/env python3
"""
Daily 5:00 AM SGT Market & Macro Data Updater
Fetches US Treasury Yield Curve, Futures, FX, Commodities (via yfinance / US Treasury),
and uses Gemini API with Google Search Grounding to synthesize Top 10 Global Macro News
plus Indonesia Market Commentary, IndoGB, SRBI, and USD/IDR NDF levels.

Writes output to: public/data/daily_macro.json
"""

import json
import os
from datetime import datetime, timedelta, timezone
import yfinance as yf
from google import genai
from google.genai import types

SGT = timezone(timedelta(hours=8))
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data", "daily_macro.json")


def fetch_yfinance_quotes():
    """Pull live futures, FX, commodities, and USD/IDR spot from Yahoo Finance."""
    tickers = {
        "futures": [
            ("ES=F", "S&P 500 E-mini"),
            ("NQ=F", "Nasdaq 100 E-mini"),
            ("YM=F", "Dow Jones Mini"),
            ("RTY=F", "Russell 2000 Mini"),
            ("DX=F", "US Dollar Index"),
        ],
        "fx": [
            ("EURUSD=X", "EUR/USD", "Euro / US Dollar"),
            ("JPY=X", "USD/JPY", "US Dollar / Japanese Yen"),
            ("GBPUSD=X", "GBP/USD", "British Pound / US Dollar"),
            ("CNH=X", "USD/CNH", "US Dollar / Offshore Yuan"),
            ("AUDUSD=X", "AUD/USD", "Australian Dollar / USD"),
            ("SGD=X", "USD/SGD", "US Dollar / Singapore Dollar"),
        ],
        "commodities": [
            ("CL=F", "WTI Crude Oil", "$/bbl"),
            ("BZ=F", "Brent Crude", "$/bbl"),
            ("GC=F", "Gold Futures", "$/t.oz"),
            ("SI=F", "Silver Futures", "$/t.oz"),
            ("HG=F", "Copper Futures", "$/lb"),
        ],
    }

    result = {"futures": [], "fxRates": [], "commodities": [], "usdidr_spot": None, "ihsg": None}

    for sym, name in tickers["futures"]:
        try:
            hist = yf.Ticker(sym).history(period="5d")
            if len(hist) >= 2:
                last = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2])
                chg = last - prev
                pct = (chg / prev) * 100 if prev else 0.0
                result["futures"].append({
                    "symbol": sym,
                    "name": name,
                    "price": round(last, 2),
                    "change": round(chg, 2),
                    "changePct": round(pct, 2),
                })
        except Exception as e:
            print(f"Warn: failed {sym}: {e}")

    for yf_sym, pair, name in tickers["fx"]:
        try:
            hist = yf.Ticker(yf_sym).history(period="5d")
            if len(hist) >= 2:
                last = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2])
                chg = last - prev
                pct = (chg / prev) * 100 if prev else 0.0
                result["fxRates"].append({
                    "pair": pair,
                    "name": name,
                    "rate": round(last, 4 if last < 10 else 2),
                    "change": round(chg, 4 if last < 10 else 2),
                    "changePct": round(pct, 2),
                })
        except Exception as e:
            print(f"Warn: failed {yf_sym}: {e}")

    for sym, name, unit in tickers["commodities"]:
        try:
            hist = yf.Ticker(sym).history(period="5d")
            if len(hist) >= 2:
                last = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2])
                chg = last - prev
                pct = (chg / prev) * 100 if prev else 0.0
                result["commodities"].append({
                    "symbol": sym,
                    "name": name,
                    "price": round(last, 2),
                    "unit": unit,
                    "change": round(chg, 2),
                    "changePct": round(pct, 2),
                })
        except Exception as e:
            print(f"Warn: failed {sym}: {e}")

    try:
        idr_hist = yf.Ticker("IDR=X").history(period="5d")
        if len(idr_hist) >= 2:
            last = float(idr_hist["Close"].iloc[-1])
            prev = float(idr_hist["Close"].iloc[-2])
            result["usdidr_spot"] = {
                "spotRate": round(last),
                "spotChange": round(last - prev),
                "spotChangePct": round(((last - prev) / prev) * 100, 2),
            }
    except Exception as e:
        print(f"Warn: failed IDR=X: {e}")

    try:
        jkse_hist = yf.Ticker("^JKSE").history(period="5d")
        if len(jkse_hist) >= 2:
            last = float(jkse_hist["Close"].iloc[-1])
            prev = float(jkse_hist["Close"].iloc[-2])
            result["ihsg"] = {
                "level": round(last, 2),
                "change": round(last - prev, 2),
                "changePct": round(((last - prev) / prev) * 100, 2),
            }
    except Exception as e:
        print(f"Warn: failed ^JKSE: {e}")

    return result


def fetch_grounded_macro_and_indonesia(existing_data: dict) -> dict:
    """Use Gemini with Google Search Grounding to fetch latest US Treasury yields, Top 10 Macro News, and Indonesia Bond/NDF/BI commentary."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set; keeping existing grounded fields.")
        return existing_data

    client = genai.Client(api_key=api_key)
    now_sgt = datetime.now(SGT).strftime("%d %b %Y")

    prompt = f"""
Today is {now_sgt}. Search the web for the latest closing financial data and news, and return a JSON object matching the exact structure below:
1. US Treasury Yield Curve latest closing yields (1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y) with daily change in bps and prior close.
2. Top 10 Global Macro News (with strong focus on US economy, Federal Reserve, inflation, fiscal debt, and global trade).
3. Indonesia Market intelligence:
   - Market commentary covering Bank Indonesia (BI-Rate), Rupiah stability, inflation, fiscal SBN auctions, and trade balance.
   - Latest IndoGB government bond benchmark yields (5Y, 10Y, 15Y, 20Y).
   - Latest SRBI (Sekuritas Rupiah Bank Indonesia) auction cut-off yields for 6M, 9M, and 12M tenors.
   - Latest USD/IDR JISDOR rate and 1M / 3M USD/IDR NDF rates.

Return ONLY valid JSON matching this schema:
{json.dumps(existing_data, indent=2)}
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            response_mime_type="application/json",
        ),
    )

    if response.text:
        return json.loads(response.text)
    return existing_data


def main():
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Update grounded news, yield curve, and Indonesia OTC data via Gemini Search Grounding
    try:
        data = fetch_grounded_macro_and_indonesia(data)
    except Exception as e:
        print(f"Warn: Gemini grounding update error: {e}")

    # 2. Overlay exact market quotes from Yahoo Finance
    quotes = fetch_yfinance_quotes()
    if quotes["futures"]:
        data["globalMacro"]["futures"] = quotes["futures"]
    if quotes["fxRates"]:
        data["globalMacro"]["fxRates"] = quotes["fxRates"]
    if quotes["commodities"]:
        data["globalMacro"]["commodities"] = quotes["commodities"]
    if quotes["usdidr_spot"]:
        data["indonesia"]["fxAndNdf"].update(quotes["usdidr_spot"])
    if quotes["ihsg"]:
        data["indonesia"]["fxAndNdf"]["ihsgIndex"] = quotes["ihsg"]

    # 3. Update timestamps
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
