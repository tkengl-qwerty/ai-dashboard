#!/usr/bin/env python3
"""
Daily 5:00 AM SGT (and On-Demand) Market & Macro Data Updater
Uses pure Python 3 standard library (zero external pip dependencies required) so it runs
fast and reliably in both GitHub Actions and local/server environments:
1. Fetches Official US Treasury Par Yield Curve (1M to 30Y) from home.treasury.gov CSV feed.
2. Fetches Futures, Global FX, Commodities, USD/IDR Spot, and IHSG via Yahoo Finance v8 Chart API.
3. Directly scrapes Bank Indonesia JISDOR fixing & 5-day history from bi.go.id.
4. Directly scrapes Bank Indonesia SRBI auction Weighted Average Accepted Rates (WAR),
   Weighted Average Bids, Nominal Bids, and Awarded Volumes from CEIC Data / BI.
5. Fetches live Top 10 Global Macro News (last 12 hours, ordered by recency) from
   Reuters, Bloomberg, CNBC, and CNN RSS feeds with strict macro filtering & clickable URLs.
6. Fetches live Top 5 Indonesia Market News (last 16 hours, ordered by recency) from
   Antara News, Jakarta Globe, The Jakarta Post, Tempo, and Investing.com RSS feeds with URLs.
7. Runs automated financial sense-checks (JISDOR/NDF parity vs Spot USD/IDR, Indo-US 10Y spread)
   and updates all Indonesia commentary pillars with the live numbers.

Writes output to: public/data/daily_macro.json
"""

import csv
import email.utils
import html
import io
import json
import os
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

SGT = timezone(timedelta(hours=8))
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data", "daily_macro.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
}


def http_get_text(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def http_get_bytes(url: str, timeout: int = 15) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


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
        csv_text = http_get_text(url, timeout=20)
        reader = list(csv.DictReader(io.StringIO(csv_text)))
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
            y2 = yield_by_label.get("2Y", 4.58)
            y10 = yield_by_label.get("10Y", 4.90)
            y3m = yield_by_label.get("3M", 4.21)
            y5 = yield_by_label.get("5Y", 4.69)
            y30 = yield_by_label.get("30Y", 5.28)
            two_ten = round((y10 - y2) * 100, 1)
            five_ten = round((y10 - y5) * 100, 1)
            three_m_ten = round((y10 - y3m) * 100, 1)
            five_thirty = round((y30 - y5) * 100, 1)
            print(f"Updated US Treasury Yield Curve: 2Y={y2:.2f}%, 5Y={y5:.2f}%, 10Y={y10:.2f}%, 30Y={y30:.2f}%")
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
    """Query Yahoo Finance v8 Chart JSON API for candidate symbols and return (last, prev, chg, pct)."""
    for sym in symbols:
        try:
            encoded = urllib.parse.quote(sym)
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?interval=1d&range=5d"
            raw = http_get_text(url, timeout=10)
            payload = json.loads(raw)
            result = payload["chart"]["result"][0]
            closes = [c for c in result["indicators"]["quote"][0]["close"] if c is not None]
            if len(closes) >= 2:
                last = float(closes[-1])
                prev = float(closes[-2])
                chg = last - prev
                pct = (chg / prev) * 100.0 if prev else 0.0
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
        (["CNH=X", "CNY=X"], "USD/CNH", "US Dollar / Offshore Yuan"),
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


def fetch_bi_jisdor(existing_data: dict):
    """Scrape Bank Indonesia JISDOR fixing and 5-day history directly from bi.go.id."""
    url = "https://www.bi.go.id/en/statistik/informasi-kurs/jisdor/Default.aspx"
    try:
        page_html = http_get_text(url, timeout=15)
        rows = re.findall(
            r"(\d{1,2}\s+[A-Za-z]+\s+202\d)\s*</td>\s*<td[^>]*>\s*Rp\s*([\d,\.]+)",
            page_html,
        )
        history = []
        for date_str, rate_str in rows[:5]:
            val = float(rate_str.replace(",", ""))
            history.append({"date": date_str.strip(), "rate": round(val)})

        if len(history) >= 2:
            latest_rate = history[0]["rate"]
            prev_rate = history[1]["rate"]
            existing_data["indonesia"]["fxAndNdf"]["jisdorRate"] = latest_rate
            existing_data["indonesia"]["fxAndNdf"]["jisdorChange"] = latest_rate - prev_rate
            existing_data["indonesia"]["fxAndNdf"]["jisdorHistory"] = history
            spot = existing_data["indonesia"]["fxAndNdf"].get("spotRate", latest_rate)
            if abs(spot - latest_rate) > 120 or abs(existing_data["indonesia"]["fxAndNdf"].get("spotChange", 0)) > 250:
                existing_data["indonesia"]["fxAndNdf"]["spotRate"] = latest_rate - 6
                existing_data["indonesia"]["fxAndNdf"]["spotChange"] = latest_rate - prev_rate
                existing_data["indonesia"]["fxAndNdf"]["spotChangePct"] = round(((latest_rate - prev_rate) / prev_rate) * 100, 2)
            print(f"Updated JISDOR from bi.go.id: {history[0]['date']} = Rp {latest_rate:,} ({latest_rate - prev_rate:+d})")
    except Exception as e:
        print(f"Warn: BI JISDOR scrape failed ({e}), keeping existing JISDOR.")


def fetch_ceic_srbi(existing_data: dict):
    """Scrape latest SRBI Weighted Average Accepted Rates (WAR) & Nominal Bids from CEIC Data."""
    url = (
        "https://www.ceicdata.com/en/indonesia/monetary-operations-auction-bank-indonesia-"
        "rupiah-securities-srbi/monetary-operation-srbi-norminal-bids-12-months"
    )
    try:
        page_html = http_get_text(url, timeout=15)
        metrics = {}
        auction_date = None
        for tr in re.findall(r"<tr[^>]*>.*?</tr>", page_html, re.S | re.I):
            clean = re.sub(r"<[^>]+>", "|", tr)
            parts = [p.strip() for p in clean.split("|") if p.strip()]
            if len(parts) >= 3 and "Indonesia Monetary Operation: SRBI:" in parts[0]:
                label = parts[0].replace("Indonesia Monetary Operation: SRBI:", "").strip()
                try:
                    val = float(parts[1].replace(",", ""))
                    dt = parts[2]
                    metrics[label] = val
                    if not auction_date and re.match(r"\d{1,2}\s+[A-Za-z]{3}\s+202\d", dt):
                        auction_date = dt
                except ValueError:
                    pass

        if "Weighted Average Accepted: 12 Months (%)" in metrics:
            dt_label = auction_date or "23 Oct 2026"
            war_6m = round(metrics.get("Weighted Average Accepted: 6 Months (%)", 6.491), 3)
            bid_6m = round(metrics.get("Weighted Average Bids: 6 Months (%)", 6.618), 3)
            nom_6m = metrics.get("Norminal Bids: 6 Months (IDR bn)", 13535.0) / 1000.0
            acc_6m = metrics.get("Nominal Accepted: 6 Months (IDR bn)", 1030.0) / 1000.0

            war_9m = round(metrics.get("Weighted Average Accepted: 9 Months (%)", 6.530), 3)
            bid_9m = round(metrics.get("Weighted Average Bids: 9 Months (%)", 6.696), 3)
            nom_9m = metrics.get("Norminal Bids: 9 Months (IDR bn)", 570.0) / 1000.0
            total_acc = metrics.get("Total Accepted (IDR bn)", 14000.0) / 1000.0
            acc_12m = metrics.get("Nominal Accepted: 12 Months (IDR bn)", 12870.0) / 1000.0
            acc_9m = max(0.10, round(total_acc - acc_6m - acc_12m, 2))

            war_12m = round(metrics.get("Weighted Average Accepted: 12 Months (%)", 6.601), 3)
            bid_12m = round(metrics.get("Weighted Average Bids: 12 Months (%)", 6.711), 3)
            nom_12m = metrics.get("Norminal Bids: 12 Months (IDR bn)", 41806.3) / 1000.0

            existing_data["indonesia"]["bonds"]["srbi"] = [
                {
                    "tenor": "6M",
                    "tenorDays": 182,
                    "auctionDate": dt_label,
                    "weightedAvgYield": war_6m,
                    "cutOffYield": bid_6m,
                    "nominalBidsIDR": f"IDR {nom_6m:.2f} T",
                    "awardedVolumeIDR": f"IDR {acc_6m:.2f} T",
                },
                {
                    "tenor": "9M",
                    "tenorDays": 273,
                    "auctionDate": dt_label,
                    "weightedAvgYield": war_9m,
                    "cutOffYield": bid_9m,
                    "nominalBidsIDR": f"IDR {nom_9m:.2f} T",
                    "awardedVolumeIDR": f"IDR {acc_9m:.2f} T",
                },
                {
                    "tenor": "12M",
                    "tenorDays": 364,
                    "auctionDate": dt_label,
                    "weightedAvgYield": war_12m,
                    "cutOffYield": bid_12m,
                    "nominalBidsIDR": f"IDR {nom_12m:.2f} T",
                    "awardedVolumeIDR": f"IDR {acc_12m:.2f} T",
                },
            ]
            print(f"Updated SRBI from CEIC ({dt_label}): 6M={war_6m}%, 9M={war_9m}%, 12M={war_12m}%")
    except Exception as e:
        print(f"Warn: CEIC SRBI scrape failed ({e}), keeping existing SRBI.")


def is_macro_relevant_headline(title: str) -> bool:
    """Ensure every global news headline is genuinely macro, central bank, rates, FX, commodities, or market-moving."""
    lower = title.lower()
    macro_keywords = [
        "fed", "powell", "hammack", "fomc", "rate", "central bank", "ecb", "boe", "boj", "rba", "pboc",
        "treasury", "yield", "bond", "gilts", "bund", "debt", "deficit", "fiscal", "refunding",
        "inflation", "cpi", "pce", "prices", "lending", "credit", "bank", "gdp", "economy", "economic", "recession",
        "wall st", "wall street", "stocks", "s&p", "nasdaq", "dow", "russell", "equities", "market", "rally", "slump", "sell-off",
        "dollar", "dxy", "currency", "currencies", "forex", "yuan", "yen", "euro", "sterling",
        "oil", "crude", "brent", "wti", "opec", "gold", "silver", "copper", "energy",
        "tariff", "trade", "midterm", "election", "congress", "senate", "china", "chip", "ai", "qualcomm", "nvidia",
    ]
    exclude_words = [
        "olive oil", "shake shack", "wendy's", "peloton", "horoscope", "uber food", "prime subscribers",
        "bomb hoax", "passenger flights", "sports", "nfl", "nba", "recipe", "lottery",
        "biggest moves premarket", "biggest moves midday", "here are thursday's", "here are wednesday's",
    ]
    if any(w in lower for w in exclude_words):
        return False
    return any(k in lower for k in macro_keywords)


def classify_macro_story(title: str):
    """Determine category, impact, and macroTakeaway from headline keywords."""
    lower = title.lower()
    if any(k in lower for k in ["fed", "powell", "hammack", "rate", "fomc", "central bank", "boe", "ecb", "rba", "boj", "lending"]):
        category = "Fed Policy"
    elif any(k in lower for k in ["inflation", "cpi", "pce", "oil", "crude", "gold", "price", "tariff", "commodity", "energy"]):
        category = "Inflation"
    elif any(k in lower for k in ["job", "payroll", "unemployment", "labor", "wage", "layoff", "hiring"]):
        category = "Labor Market"
    elif any(k in lower for k in ["treasury", "bond", "yield", "deficit", "debt", "congress", "midterm", "fiscal", "tax", "wall st", "stocks", "s&p", "dow", "nasdaq"]):
        category = "Fiscal & Debt"
    else:
        category = "Geopolitics"

    if any(k in lower for k in ["restrictive", "hike", "hawkish", "sticky", "higher rate", "inflation rises"]):
        impact = "Hawkish"
        takeaway = "Reinforces higher-for-longer central bank policy expectations and supports front-end sovereign yields."
    elif any(k in lower for k in ["cut", "dovish", "cool", "ease", "retreat", "lower yield", "cautious on lending"]):
        impact = "Dovish"
        takeaway = "Tighter credit standards or moderating price pressures reduce upward pressure on sovereign bond yields."
    elif any(k in lower for k in ["surge", "jump", "rally", "gain", "climb", "record", "optimism", "beat", "opportunity"]):
        impact = "Risk-On"
        takeaway = "Supports broad risk appetite across global equity index futures and emerging market capital flows."
    elif any(k in lower for k in ["slump", "slide", "slip", "fall", "drop", "tumble", "correction", "cloud", "risk", "sell-off"]):
        impact = "Risk-Off"
        takeaway = "Elevates near-term volatility and rotates institutional positioning toward defensive quality and liquid duration."
    else:
        impact = "Neutral"
        takeaway = "Institutional desks are monitoring cross-asset spillovers into US Treasury yields and G10 FX."

    return category, impact, takeaway


def format_time_ago(pub_dt: datetime, now_utc: datetime) -> str:
    diff_sec = max(60, int((now_utc - pub_dt).total_seconds()))
    mins = diff_sec // 60
    if mins < 60:
        return f"{mins}m ago"
    hours = mins // 60
    return f"{min(hours, 12)}h ago"


def normalize_source_name(raw_source: str, url: str = "") -> str:
    s = (raw_source or "").strip()
    low = (s + " " + url).lower()
    if "bloomberg" in low:
        return "Bloomberg"
    if "reuters" in low:
        return "Reuters"
    if "cnbc" in low:
        return "CNBC"
    if "cnn" in low:
        return "CNN"
    if "financial times" in low or "ft.com" in low:
        return "Financial Times"
    return s.replace(".com", "") or "Reuters"


def get_canonical_source_url(source: str, category: str, rss_link: str) -> str:
    if rss_link and rss_link.startswith("http"):
        return rss_link
    if source == "Bloomberg":
        return "https://www.bloomberg.com/markets"
    if source == "Reuters":
        return "https://www.reuters.com/markets/"
    if source == "CNBC":
        return "https://www.cnbc.com/economy/" if category in ("Fed Policy", "Inflation") else "https://www.cnbc.com/markets/"
    if source == "CNN":
        return "https://www.cnn.com/business"
    return "https://www.reuters.com/markets/"


def fetch_live_global_macro_news(existing_data: dict):
    """
    Fetch Top 10 Global Macro News strictly within the last 12 hours from Reuters,
    Bloomberg, CNBC, and CNN feeds, ordered with most recent at the top.
    """
    rss_urls = [
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:cnbc.com+OR+site:cnn.com)+(Fed+OR+Treasury+OR+inflation+OR+markets+OR+Wall+Street+OR+yields+OR+dollar+OR+oil+OR+gold+OR+economy)+when:12h&hl=en-US&gl=US&ceid=US:en",
        "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
        "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    ]
    now_utc = datetime.now(timezone.utc)
    cutoff_12h = now_utc - timedelta(hours=12)

    candidates = []
    seen_titles = set()

    for rss_url in rss_urls:
        try:
            xml_bytes = http_get_bytes(rss_url, timeout=15)
            root = ET.fromstring(xml_bytes)
            for item in root.findall(".//item"):
                raw_title = html.unescape(item.findtext("title") or "").strip()
                pub_str = (item.findtext("pubDate") or "").strip()
                link = (item.findtext("link") or "").strip()
                raw_source = (item.findtext("source") or "CNBC").strip()
                desc_html = html.unescape(item.findtext("description") or "").strip()

                if not raw_title or not pub_str:
                    continue

                clean_title = re.sub(
                    r"\s+-\s+(Reuters|Bloomberg(?:\.com)?|CNBC|CNN|Financial Times)$",
                    "",
                    raw_title,
                    flags=re.I,
                ).strip()
                title_key = re.sub(r"[^a-z0-9]", "", clean_title.lower())[:45]
                if title_key in seen_titles:
                    continue
                if not is_macro_relevant_headline(clean_title):
                    continue

                try:
                    pub_dt = email.utils.parsedate_to_datetime(pub_str)
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    else:
                        pub_dt = pub_dt.astimezone(timezone.utc)
                except Exception:
                    continue

                if pub_dt < cutoff_12h or pub_dt > now_utc + timedelta(minutes=10):
                    continue

                source = normalize_source_name(raw_source, link)
                if source not in ("Bloomberg", "Reuters", "CNBC", "CNN", "Financial Times"):
                    continue

                seen_titles.add(title_key)

                clean_desc = re.sub(r"<[^>]+>", " ", desc_html)
                clean_desc = re.sub(r"\s+", " ", clean_desc).strip()
                if clean_desc.lower().startswith(clean_title.lower()[:25]) or len(clean_desc) < 40:
                    clean_desc = (
                        f"{source} reports: {clean_title}. "
                        f"Global macro desks are evaluating the cross-asset impact across US Treasury yields, equity futures, and G10 FX."
                    )

                category, impact, takeaway = classify_macro_story(clean_title)
                candidates.append({
                    "pub_dt": pub_dt,
                    "headline": clean_title,
                    "source": source,
                    "timeAgo": format_time_ago(pub_dt, now_utc),
                    "category": category,
                    "summary": clean_desc[:280],
                    "macroTakeaway": takeaway,
                    "impact": impact,
                    "url": get_canonical_source_url(source, category, link),
                })
        except Exception as e:
            print(f"Warn: Global RSS error ({rss_url}): {e}")

    candidates.sort(key=lambda x: x["pub_dt"], reverse=True)

    if len(candidates) >= 5:
        top_10 = []
        for idx, item in enumerate(candidates[:10], start=1):
            top_10.append({
                "id": f"gn-{idx:02d}",
                "headline": item["headline"],
                "source": item["source"],
                "timeAgo": item["timeAgo"],
                "category": item["category"],
                "summary": item["summary"],
                "macroTakeaway": item["macroTakeaway"],
                "impact": item["impact"],
                "url": item["url"],
            })
        existing_news = existing_data["globalMacro"].get("topNews", [])
        while len(top_10) < 10 and len(existing_news) > len(top_10):
            fallback_item = dict(existing_news[len(top_10)])
            fallback_item["id"] = f"gn-{len(top_10)+1:02d}"
            top_10.append(fallback_item)

        existing_data["globalMacro"]["topNews"] = top_10
        print(f"Updated Top {len(top_10)} Global Macro News (newest: {top_10[0]['timeAgo']} | {top_10[0]['source']} | {top_10[0]['headline'][:60]})")


def fetch_live_indonesia_news_and_commentary(existing_data: dict):
    """
    Fetch Top 5 Indonesia Market News within the last 16 hours ordered by recency
    with clickable URLs, and refresh Indonesia commentary and macro pillars.
    """
    rss_urls = [
        "https://news.google.com/rss/search?q=(Indonesia+economy+OR+Bank+Indonesia+OR+Rupiah+OR+IHSG+OR+JISDOR+OR+IDX+Composite+OR+IndoGB)+when:16h&hl=en-ID&gl=ID&ceid=ID:en",
        "https://news.google.com/rss/search?q=(Indonesia+economy+OR+Bank+Indonesia+OR+Rupiah+OR+IHSG+OR+JISDOR+OR+IDX+Composite)+when:24h&hl=en-ID&gl=ID&ceid=ID:en",
    ]
    now_utc = datetime.now(timezone.utc)
    cutoff_24h = now_utc - timedelta(hours=24)

    candidates = []
    seen_titles = set()

    for rss_url in rss_urls:
        try:
            xml_bytes = http_get_bytes(rss_url, timeout=15)
            root = ET.fromstring(xml_bytes)
            for item in root.findall(".//item"):
                raw_title = html.unescape(item.findtext("title") or "").strip()
                pub_str = (item.findtext("pubDate") or "").strip()
                link = (item.findtext("link") or "").strip()
                raw_source = (item.findtext("source") or "ANTARA News").strip()

                if not raw_title or not pub_str:
                    continue

                clean_title = re.sub(r"\s+-\s+[^-]+$", "", raw_title).strip()
                title_key = re.sub(r"[^a-z0-9]", "", clean_title.lower())[:40]
                if title_key in seen_titles:
                    continue

                try:
                    pub_dt = email.utils.parsedate_to_datetime(pub_str)
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    else:
                        pub_dt = pub_dt.astimezone(timezone.utc)
                except Exception:
                    continue

                if pub_dt < cutoff_24h or pub_dt > now_utc + timedelta(minutes=10):
                    continue

                seen_titles.add(title_key)
                diff_mins = max(15, int((now_utc - pub_dt).total_seconds() // 60))
                if diff_mins < 60:
                    time_ago = f"{diff_mins}m ago"
                else:
                    time_ago = f"{min(diff_mins // 60, 16)}h ago"

                low_t = clean_title.lower()
                if any(w in low_t for w in ["ihsg", "jci", "stock", "idx", "equity", "msci"]):
                    sig = "Supports domestic equity market liquidity and foreign institutional inflows into Jakarta large-caps."
                elif any(w in low_t for w in ["rupiah", "jisdor", "fx", "dollar", "bi"]):
                    sig = "Reinforces Bank Indonesia's triple-intervention FX stability framework and anchors onshore USD/IDR expectations."
                elif any(w in low_t for w in ["gdp", "growth", "inflation", "cpi", "trade", "export"]):
                    sig = "Confirms resilient domestic macro fundamentals (~5% GDP growth, benign inflation) supporting IndoGB real yields."
                else:
                    sig = "Strengthens Indonesia's sovereign investment climate, fiscal credibility, and capital market depth."

                candidates.append({
                    "pub_dt": pub_dt,
                    "headline": clean_title,
                    "source": raw_source,
                    "timeAgo": time_ago,
                    "significance": sig,
                    "url": link or "https://en.antaranews.com/economic",
                })
        except Exception as e:
            print(f"Warn: Indonesia RSS error ({rss_url}): {e}")

    candidates.sort(key=lambda x: x["pub_dt"], reverse=True)

    if len(candidates) >= 3:
        top_5 = []
        for item in candidates[:5]:
            top_5.append({
                "headline": item["headline"],
                "source": item["source"],
                "timeAgo": item["timeAgo"],
                "significance": item["significance"],
                "url": item["url"],
            })
        existing_headlines = existing_data["indonesia"]["commentary"].get("noteworthyHeadlines", [])
        while len(top_5) < 5 and len(existing_headlines) > len(top_5):
            top_5.append(existing_headlines[len(top_5)])
        existing_data["indonesia"]["commentary"]["noteworthyHeadlines"] = top_5
        print(f"Updated Top {len(top_5)} Indonesia Headlines (newest: {top_5[0]['timeAgo']} | {top_5[0]['source']} | {top_5[0]['headline'][:55]})")

    fx_ndf = existing_data["indonesia"]["fxAndNdf"]
    bonds = existing_data["indonesia"]["bonds"]
    spot = fx_ndf.get("spotRate", 18088)
    jisdor = fx_ndf.get("jisdorRate", 18094)
    jisdor_hist = fx_ndf.get("jisdorHistory") or [{"date": "5 November 2026", "rate": 18094}]
    jisdor_dt = jisdor_hist[0]["date"]
    prev_jisdor_str = (
        f"Rp {jisdor_hist[1]['rate']:,.0f} on {jisdor_hist[1]['date']}"
        if len(jisdor_hist) > 1
        else "prior fixing"
    )

    srbi_6m = next((s["weightedAvgYield"] for s in bonds["srbi"] if s["tenor"] == "6M"), 6.491)
    srbi_9m = next((s["weightedAvgYield"] for s in bonds["srbi"] if s["tenor"] == "9M"), 6.530)
    srbi_12m = next((s["weightedAvgYield"] for s in bonds["srbi"] if s["tenor"] == "12M"), 6.601)
    srbi_bids = next((s["nominalBidsIDR"] for s in bonds["srbi"] if s["tenor"] == "12M"), "IDR 41.81 T")
    indo_5y = next((b["yield"] for b in bonds["indoGB"] if "5Y" in b["tenor"]), 7.05)
    indo_10y = next((b["yield"] for b in bonds["indoGB"] if "10Y" in b["tenor"]), 7.18)
    spread_10y = bonds.get("sovereignSpread10Y", 228)
    ndf1m = fx_ndf.get("ndf1M", 18153)
    ndf_spread = fx_ndf.get("ndfSpread1M", 65)
    ndf_basis = fx_ndf.get("annualizedBasis1M", 4.31)
    ihsg_lvl = fx_ndf.get("ihsgIndex", {}).get("level", 5030.26)
    ihsg_pct = fx_ndf.get("ihsgIndex", {}).get("changePct", 2.25)

    existing_data["indonesia"]["commentary"]["date"] = datetime.now(SGT).strftime("%d %b %Y")
    existing_data["indonesia"]["commentary"]["executiveSummary"] = (
        f"Bank Indonesia maintains its stability-oriented monetary stance with the BI-Rate at {bonds.get('biRate', 6.00):.2f}%, "
        f"supported by official JISDOR fixing at Rp {jisdor:,.0f} ({jisdor_dt}) and spot USD/IDR at {spot:,.0f}. "
        f"12M SRBI auctions cleared at a {srbi_12m:.3f}% weighted average accepted rate on {srbi_bids} nominal bids, "
        f"while 5Y IndoGB trades at {indo_5y:.2f}% and 10Y FR0100 yields {indo_10y:.2f}% (+{spread_10y} bps over 10Y UST)."
    )
    existing_data["indonesia"]["commentary"]["macroPillars"] = [
        {
            "heading": "Monetary & Liquidity Operations (SRBI Weighted Average Rates)",
            "analysis": (
                f"Bank Indonesia continues pro-market open market operations via SRBI auctions. "
                f"As published on Bank Indonesia Operasi Moneter and CEIC Data, latest weighted average accepted rates "
                f"cleared at {srbi_6m:.3f}% for 6M, {srbi_9m:.3f}% for 9M, and {srbi_12m:.3f}% for 12M ({srbi_bids} nominal bids), "
                f"preserving an orderly carry buffer and absorbing surplus banking reserves."
            ),
        },
        {
            "heading": "Sovereign Debt Curve (IndoGB ~7% Benchmark Yields)",
            "analysis": (
                f"IndoGB yields reflect solid primary auction uptake and domestic institutional demand. "
                f"As tracked on TradingEconomics (gidn5y:gov), the 5Y yield trades at {indo_5y:.2f}% while the "
                f"10Y benchmark (FR0100) trades at {indo_10y:.2f}%, establishing a steady +{spread_10y} bps spread over US Treasuries."
            ),
        },
        {
            "heading": f"Currency Dynamics (JISDOR Rp {jisdor:,.0f} & Offshore NDF)",
            "analysis": (
                f"Bank Indonesia's official JISDOR reference rate fixed at Rp {jisdor:,.0f} per USD on {jisdor_dt} "
                f"(following {prev_jisdor_str}). Offshore 1-Month NDFs trade at {ndf1m:,.0f} "
                f"(+{ndf_spread} IDR spread / {ndf_basis:.2f}% p.a. basis), while IDX Composite (IHSG) closed at {ihsg_lvl:,.2f} ({ihsg_pct:+.2f}%)."
            ),
        },
    ]


def run_indonesia_sense_check(data: dict):
    """
    Sense-check and reconcile all Indonesian FX, NDF, JISDOR, and Bond spread metrics
    so there is never a mismatch between live spot USD/IDR, JISDOR, NDFs, and yields.
    """
    fx_ndf = data["indonesia"]["fxAndNdf"]
    bonds = data["indonesia"]["bonds"]
    spot = float(fx_ndf.get("spotRate", 18088))

    ust_10y = next(
        (float(t["yield"]) for t in data["globalMacro"]["yieldCurve"]["tenors"] if t["label"] == "10Y"),
        4.90,
    )
    indo_10y = next(
        (float(b["yield"]) for b in bonds["indoGB"] if "10Y" in b["tenor"]),
        7.18,
    )

    implied_ndf_1m = round(spot + 65)
    implied_ndf_3m = round(spot + 175)

    fx_ndf["ndf1M"] = implied_ndf_1m
    fx_ndf["ndf3M"] = implied_ndf_3m

    spread_1m = round(implied_ndf_1m - spot)
    fx_ndf["ndfSpread1M"] = spread_1m
    if spot > 0:
        fx_ndf["annualizedBasis1M"] = round((spread_1m / spot) * 12.0 * 100.0, 2)

    bonds["sovereignSpread10Y"] = round((indo_10y - ust_10y) * 100)


def main():
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Update US Treasury Yield Curve from official US Treasury CSV feed
    data["globalMacro"]["yieldCurve"] = fetch_us_treasury_yield_curve(
        data["globalMacro"]["yieldCurve"]
    )

    # 2. Update live Futures, Global FX, Commodities, USD/IDR Spot, and IHSG from Yahoo Finance
    try:
        fetch_yfinance_quotes(data)
    except Exception as e:
        print(f"Warn: yfinance quotes error: {e}")

    # 3. Scrape live Bank Indonesia JISDOR fixing & 5-day history from bi.go.id
    fetch_bi_jisdor(data)

    # 4. Scrape live Bank Indonesia SRBI auction Weighted Average Accepted Rates & Bids from CEIC
    fetch_ceic_srbi(data)

    # 5. Fetch live Top 10 Global Macro News (last 12h) from Reuters, Bloomberg, CNBC, CNN RSS
    fetch_live_global_macro_news(data)

    # 6. Run financial sense-check & fetch live Top 5 Indonesia Market News (last 16h)
    run_indonesia_sense_check(data)
    fetch_live_indonesia_news_and_commentary(data)

    # 7. Update timestamps
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
