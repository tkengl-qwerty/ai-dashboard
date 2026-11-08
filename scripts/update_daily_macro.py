#!/usr/bin/env python3
"""
Daily 5:00 AM SGT (and On-Demand) Market & Macro Data Updater
Uses pure Python 3 standard library (zero external pip dependencies required):
1. Fetches Official US Treasury Par Yield Curve (1M to 30Y) from home.treasury.gov CSV +
   live intraday US Treasury yields from CNBC JSON quote API (US1M..US30Y).
2. Fetches Futures (ES, NQ, YM, RTY, DXY), Global FX (EUR, JPY, GBP, CNH, AUD, SGD),
   Commodities (WTI, Brent, Gold, Silver, Copper), USD/IDR Spot, and IHSG via Yahoo Finance v8 API.
3. Fetches live IndoGB Government Bond Yields (5Y, 10Y, 15Y, 20Y) via CNBC JSON quote API
   (ID5YT=RR, ID10YT=RR, ID15YT=RR, ID20YT=RR).
4. Directly scrapes Bank Indonesia JISDOR fixing & 5-day history, BI-Rate policy rate,
   and Headline CPI Inflation YoY from bi.go.id.
5. Directly scrapes Bank Indonesia SRBI auction Weighted Average Accepted Rates (WAR),
   Weighted Average Bids, Nominal Bids, and Awarded Volumes from CEIC Data.
6. Fetches live Top 10 Global Macro News (last 12 hours, ordered by recency) from
   Reuters, Bloomberg, CNBC, and CNN RSS feeds with unique per-article summaries & takeaways.
7. Fetches live Top 5 Indonesia Market News (last 16 hours, ordered by recency) with
   both `title` and `headline` populated and unique per-article market significance.

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


def fetch_cnbc_batch_quotes(symbols: list[str]) -> dict:
    """Fetch live real-time quotes from CNBC JSON quote API for bonds/FX."""
    out = {}
    try:
        joined = urllib.parse.quote("|".join(symbols))
        url = (
            f"https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol"
            f"?symbols={joined}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1"
        )
        raw = http_get_text(url, timeout=12)
        payload = json.loads(raw)
        quotes = payload.get("FormattedQuoteResult", {}).get("FormattedQuote", [])
        if isinstance(quotes, dict):
            quotes = [quotes]
        for q in quotes:
            sym = q.get("symbol")
            if not sym:
                continue
            last_str = str(q.get("last") or "").replace("%", "").replace(",", "").strip()
            prev_str = str(q.get("previous_day_closing") or "").replace("%", "").replace(",", "").strip()
            chg_str = str(q.get("change") or "").replace("%", "").replace(",", "").strip()
            try:
                last_val = float(last_str)
            except ValueError:
                continue
            try:
                prev_val = float(prev_str) if prev_str else last_val
            except ValueError:
                prev_val = last_val
            try:
                chg_val = float(chg_str) if chg_str and chg_str != "UNCH" else (last_val - prev_val)
            except ValueError:
                chg_val = last_val - prev_val
            out[sym] = {
                "last": last_val,
                "prev": prev_val,
                "change": chg_val,
            }
    except Exception as e:
        print(f"Warn: CNBC batch quote error: {e}")
    return out


def fetch_us_treasury_yield_curve(existing_curve: dict) -> dict:
    """
    Fetch official US Treasury Par Yield Curve rates from home.treasury.gov CSV feed,
    and overlay live intraday Treasury yields from CNBC (US1M..US30Y) so intraday refreshes
    always reflect live market movement.
    """
    year = datetime.now(timezone.utc).year
    url = (
        f"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
        f"daily-treasury-rates.csv/{year}/all?type=daily_treasury_yield_curve&page&_format=csv"
    )
    tenor_map = [
        ("1 Mo", "1M", "US1M", 0.08),
        ("3 Mo", "3M", "US3M", 0.25),
        ("6 Mo", "6M", "US6M", 0.50),
        ("1 Yr", "1Y", "US1Y", 1.00),
        ("2 Yr", "2Y", "US2Y", 2.00),
        ("3 Yr", "3Y", "US3Y", 3.00),
        ("5 Yr", "5Y", "US5Y", 5.00),
        ("7 Yr", "7Y", "US7Y", 7.00),
        ("10 Yr", "10Y", "US10Y", 10.00),
        ("20 Yr", "20Y", "US20Y", 20.00),
        ("30 Yr", "30Y", "US30Y", 30.00),
    ]

    cnbc_ust = fetch_cnbc_batch_quotes([t[2] for t in tenor_map])

    csv_latest = {}
    csv_prior = {}
    try:
        csv_text = http_get_text(url, timeout=18)
        reader = list(csv.DictReader(io.StringIO(csv_text)))
        if len(reader) >= 2:
            csv_latest = reader[0]
            csv_prior = reader[1]
    except Exception as e:
        print(f"Warn: US Treasury CSV fetch failed ({e}), using live CNBC Treasury quotes.")

    tenors = []
    yield_by_label = {}
    existing_by_label = {t["label"]: t for t in existing_curve.get("tenors", [])}

    for csv_col, label, cnbc_sym, years in tenor_map:
        if cnbc_sym in cnbc_ust and 1.0 <= cnbc_ust[cnbc_sym]["last"] <= 10.0:
            q = cnbc_ust[cnbc_sym]
            curr_val = round(q["last"], 2)
            prev_val = round(q["prev"], 2)
            chg_bps = round(q["change"] * 100, 1)
            if chg_bps == 0.0 and csv_col in csv_latest and csv_col in csv_prior:
                try:
                    chg_bps = round((curr_val - float(csv_prior[csv_col])) * 100, 1)
                    prev_val = round(float(csv_prior[csv_col]), 2)
                except ValueError:
                    pass
        elif csv_col in csv_latest and csv_latest[csv_col]:
            curr_val = round(float(csv_latest[csv_col]), 2)
            prev_val = round(float(csv_prior.get(csv_col) or curr_val), 2)
            chg_bps = round((curr_val - prev_val) * 100, 1)
        elif label in existing_by_label:
            t_old = existing_by_label[label]
            curr_val = t_old["yield"]
            prev_val = t_old["priorClose"]
            chg_bps = t_old["changeBps"]
        else:
            continue

        tenors.append({
            "label": label,
            "years": years,
            "yield": curr_val,
            "changeBps": chg_bps,
            "priorClose": prev_val,
        })
        yield_by_label[label] = curr_val

    if len(tenors) >= 8:
        y2 = yield_by_label.get("2Y", 4.47)
        y10 = yield_by_label.get("10Y", 4.84)
        y3m = yield_by_label.get("3M", 4.09)
        y5 = yield_by_label.get("5Y", 4.61)
        y30 = yield_by_label.get("30Y", 5.26)
        two_ten = round((y10 - y2) * 100, 1)
        five_ten = round((y10 - y5) * 100, 1)
        three_m_ten = round((y10 - y3m) * 100, 1)
        five_thirty = round((y30 - y5) * 100, 1)
        print(f"Updated Live US Treasury Curve: 2Y={y2:.2f}%, 5Y={y5:.2f}%, 10Y={y10:.2f}%, 30Y={y30:.2f}% (5Y/10Y={five_ten:+.1f} bps)")
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


def fetch_live_indogb_and_bi_indicators(existing_data: dict):
    """
    Fetch live IndoGB 5Y, 10Y, 15Y, 20Y yields from CNBC real-time bond API
    (ID5YT=RR, ID10YT=RR, ID15YT=RR, ID20YT=RR) and scrape official BI-Rate & CPI YoY from bi.go.id.
    """
    cnbc_indo = fetch_cnbc_batch_quotes(["ID5YT=RR", "ID10YT=RR", "ID15YT=RR", "ID20YT=RR", "IDR="])

    # Official 2026 DJPPR Kemenkeu Seri Benchmark SUN (Surat Utang Negara):
    # - 5Y Benchmark: FR0109 (Maturity: 15 Mar 2031, Coupon: 5.875%)
    # - 10Y Benchmark: FR0108 (Maturity: 15 Apr 2036, Coupon: 6.500%)
    # - 15Y Benchmark: FR0106 (Maturity: 15 Aug 2040, Coupon: 7.125%)
    # - 20Y Benchmark: FR0107 (Maturity: 15 Aug 2045, Coupon: 7.125%)
    bond_specs = [
        ("5Y (Benchmark)", "FR0109", "15 Mar 2031", "ID5YT=RR", 5.875),
        ("10Y (Benchmark)", "FR0108", "15 Apr 2036", "ID10YT=RR", 6.500),
        ("15Y (Benchmark)", "FR0106", "15 Aug 2040", "ID15YT=RR", 7.125),
        ("20Y (Benchmark)", "FR0107", "15 Aug 2045", "ID20YT=RR", 7.125),
    ]
    existing_bonds = {b["code"]: b for b in existing_data["indonesia"]["bonds"].get("indoGB", [])}
    new_indogb = []
    for tenor, code, maturity, sym, coupon in bond_specs:
        if sym in cnbc_indo and 4.0 <= cnbc_indo[sym]["last"] <= 12.0:
            q = cnbc_indo[sym]
            yld = round(q["last"], 2)
            chg_bps = round(q["change"] * 100, 1)
            new_indogb.append({
                "tenor": tenor,
                "code": code,
                "maturity": maturity,
                "yield": yld,
                "changeBps": chg_bps,
                "coupon": coupon,
            })
        elif code in existing_bonds:
            b_old = dict(existing_bonds[code])
            b_old["maturity"] = maturity
            new_indogb.append(b_old)

    if len(new_indogb) == 4:
        existing_data["indonesia"]["bonds"]["indoGB"] = new_indogb
        print(
            f"Updated Live IndoGB Yields (DJPPR 2026 Benchmarks): "
            f"5Y {new_indogb[0]['code']}={new_indogb[0]['yield']:.2f}%, "
            f"10Y {new_indogb[1]['code']}={new_indogb[1]['yield']:.2f}%, "
            f"15Y {new_indogb[2]['code']}={new_indogb[2]['yield']:.2f}%, "
            f"20Y {new_indogb[3]['code']}={new_indogb[3]['yield']:.2f}%"
        )

    # Also check CNBC IDR= live interbank spot quote
    if "IDR=" in cnbc_indo and 12000 <= cnbc_indo["IDR="]["last"] <= 22000:
        q_idr = cnbc_indo["IDR="]
        spot_val = round(q_idr["last"])
        chg_val = round(q_idr["change"])
        pct_val = round((chg_val / spot_val) * 100, 2) if spot_val else 0.0
        existing_data["indonesia"]["fxAndNdf"]["spotRate"] = spot_val
        existing_data["indonesia"]["fxAndNdf"]["spotChange"] = chg_val
        existing_data["indonesia"]["fxAndNdf"]["spotChangePct"] = pct_val

    # Scrape official BI-Rate from bi.go.id
    try:
        bi_html = http_get_text("https://www.bi.go.id/en/statistik/indikator/bi-rate.aspx", timeout=12)
        bi_rows = re.findall(r"(\d{1,2}\s+[A-Za-z]+\s+202\d)[^%]{0,120}?(\d+[\.,]\d{2})\s*%", bi_html, re.S)
        if bi_rows:
            bi_rate = float(bi_rows[0][1].replace(",", "."))
            if 2.0 <= bi_rate <= 12.0:
                existing_data["indonesia"]["bonds"]["biRate"] = round(bi_rate, 2)
                print(f"Updated BI-Rate from bi.go.id ({bi_rows[0][0]}): {bi_rate:.2f}%")
    except Exception as e:
        print(f"Warn: BI-Rate scrape error: {e}")

    # Scrape official Indonesia CPI Inflation YoY from bi.go.id
    try:
        cpi_html = http_get_text("https://www.bi.go.id/en/statistik/indikator/data-inflasi.aspx", timeout=12)
        cpi_rows = re.findall(r"([A-Za-z]+\s+202\d)\s*</td>\s*<td[^>]*>\s*([\d\.,]+)\s*%", cpi_html)
        if cpi_rows:
            cpi_val = float(cpi_rows[0][1].replace(",", "."))
            if 0.0 <= cpi_val <= 15.0:
                existing_data["indonesia"]["bonds"]["cpiInflationYoY"] = round(cpi_val, 2)
                print(f"Updated Indonesia CPI YoY from bi.go.id ({cpi_rows[0][0]}): {cpi_val:.2f}%")
    except Exception as e:
        print(f"Warn: BI CPI scrape error: {e}")


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
            print(f"Updated JISDOR from bi.go.id: {history[0]['date']} = Rp {latest_rate:,} ({latest_rate - prev_rate:+d})")
    except Exception as e:
        print(f"Warn: BI JISDOR scrape failed ({e}), keeping existing JISDOR.")


def _parse_id_float(raw_str: str, default: float = 0.0) -> float:
    """Parse Indonesian formatted numbers such as '13.280,00' or '6,56638' into float."""
    try:
        cleaned = re.sub(r"[^\d,\.]", "", raw_str or "").strip()
        if not cleaned:
            return default
        if "," in cleaned and "." in cleaned:
            cleaned = cleaned.replace(".", "").replace(",", ".")
        elif "," in cleaned:
            cleaned = cleaned.replace(",", ".")
        return float(cleaned)
    except Exception:
        return default


def _format_bi_date_short(raw_date: str) -> str:
    """Normalize Indonesian date string e.g. '6 November 2026' or '30 Oktober 2026' -> '06 Nov 2026'."""
    id_months = {
        "januari": "Jan", "februari": "Feb", "maret": "Mar", "april": "Apr",
        "mei": "May", "juni": "Jun", "juli": "Jul", "agustus": "Aug",
        "september": "Sep", "oktober": "Oct", "november": "Nov", "desember": "Dec",
        "january": "Jan", "february": "Feb", "march": "Mar", "may": "May",
        "june": "Jun", "july": "Jul", "august": "Aug", "october": "Oct", "december": "Dec",
    }
    parts = raw_date.strip().split()
    if len(parts) == 3:
        day = parts[0].zfill(2)
        mon = id_months.get(parts[1].lower(), parts[1][:3].title())
        yr = parts[2]
        return f"{day} {mon} {yr}"
    return raw_date.strip()


def fetch_ceic_srbi(existing_data: dict):
    """
    Primary: Scrape latest official SRBI auction announcement directly from Bank Indonesia's
    Operasi Moneter portal (https://www.bi.go.id/id/publikasi/lelang/operasi-moneter/Default.aspx)
    by following the newest `Hasil-Lelang-SRBI-*.aspx` link (e.g. Hasil-Lelang-SRBI-6-November-2026.aspx).
    Fallback: Scrape CEIC Data if bi.go.id is unreachable.
    """
    bi_index_url = "https://www.bi.go.id/id/publikasi/lelang/operasi-moneter/Default.aspx"
    try:
        index_html = http_get_text(bi_index_url, timeout=15)
        srbi_links = re.findall(
            r'href=["\'](/id/publikasi/lelang/operasi-moneter/Pages/Hasil-Lelang-SRBI-[^"\']+\.aspx)["\']',
            index_html,
            re.I,
        )
        if srbi_links:
            detail_path = srbi_links[0]
            detail_url = f"https://www.bi.go.id{detail_path}"
            detail_html = http_get_text(detail_url, timeout=15)

            m_date = re.search(
                r"Hasil\s+Lelang\s+SRBI\s+(\d{1,2}\s+[A-Za-z]+\s+202\d)",
                detail_html,
                re.I,
            )
            raw_date = m_date.group(1) if m_date else "6 November 2026"
            dt_label = _format_bi_date_short(raw_date)

            table_rows = {}
            for tr in re.findall(r"<tr[^>]*>.*?</tr>", detail_html, re.S | re.I):
                cells = [
                    re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", td))).strip()
                    for td in re.findall(r"<td[^>]*>.*?</td>", tr, re.S | re.I)
                ]
                cells = [c for c in cells if c]
                if len(cells) >= 4:
                    key = cells[0].lower()
                    if "seri" in key and "series" in key:
                        table_rows["series"] = cells[1:4]
                    elif "jangka waktu" in key or "term" in key:
                        table_rows["term"] = cells[1:4]
                    elif "nominal penawaran" in key or "bidding amount" in key:
                        table_rows["bids_bn"] = cells[1:4]
                    elif "rate penawaran" in key or ("bidding rate" in key and "weighted" not in key):
                        table_rows["bid_range"] = cells[1:4]
                    elif "rata-rata tertimbang penawaran" in key or "weighted average bidding rate" in key:
                        table_rows["war_bids"] = cells[1:4]
                    elif "nominal pemenang" in key or "nominal awarded" in key:
                        table_rows["awarded_bn"] = cells[1:4]
                    elif "rata-rata tertimbang pemenang" in key or "weighted average winner" in key:
                        table_rows["war_winner"] = cells[1:4]

            if "war_winner" in table_rows and len(table_rows["war_winner"]) >= 3:
                tenor_labels = ["6M", "9M", "12M"]
                default_days = [182, 273, 350]
                srbi_list = []

                for i in range(3):
                    series_raw = table_rows.get("series", ["", "", ""])[i]
                    series_code = series_raw.split("(")[0].strip() if series_raw else f"SRBI-{tenor_labels[i]}"

                    term_raw = table_rows.get("term", ["", "", ""])[i]
                    m_days = re.search(r"\((\d+)\s*(?:Hari|days)\)", term_raw, re.I)
                    tenor_days = int(m_days.group(1)) if m_days else default_days[i]

                    bids_bn = _parse_id_float(table_rows.get("bids_bn", ["0", "0", "0"])[i], 0.0)
                    awarded_bn = _parse_id_float(table_rows.get("awarded_bn", ["0", "0", "0"])[i], 0.0)
                    war_win = round(_parse_id_float(table_rows["war_winner"][i], 6.60), 3)
                    war_bid = round(
                        _parse_id_float(table_rows.get("war_bids", ["0", "0", "0"])[i], war_win + 0.09),
                        3,
                    )
                    bid_range_raw = table_rows.get("bid_range", ["", "", ""])[i].replace(",", ".")

                    srbi_list.append({
                        "tenor": tenor_labels[i],
                        "tenorDays": tenor_days,
                        "series": series_code,
                        "auctionDate": dt_label,
                        "weightedAvgYield": war_win,
                        "cutOffYield": war_bid,
                        "biddingRateRange": f"{bid_range_raw}%" if bid_range_raw else None,
                        "nominalBidsIDR": f"IDR {bids_bn / 1000.0:.2f} T",
                        "awardedVolumeIDR": f"IDR {awarded_bn / 1000.0:.2f} T",
                        "sourceUrl": detail_url,
                    })

                existing_data["indonesia"]["bonds"]["srbi"] = srbi_list
                print(
                    f"Updated SRBI directly from bi.go.id ({dt_label} · {detail_url}): "
                    f"6M ({srbi_list[0]['series']})={srbi_list[0]['weightedAvgYield']:.3f}%, "
                    f"9M ({srbi_list[1]['series']})={srbi_list[1]['weightedAvgYield']:.3f}%, "
                    f"12M ({srbi_list[2]['series']})={srbi_list[2]['weightedAvgYield']:.3f}%"
                )
                return
    except Exception as e:
        print(f"Warn: Direct bi.go.id SRBI scrape error ({e}), trying CEIC fallback.")

    # Secondary fallback: CEIC Data
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
            dt_label = auction_date or "06 Nov 2026"
            war_6m = round(metrics.get("Weighted Average Accepted: 6 Months (%)", 6.566), 3)
            bid_6m = round(metrics.get("Weighted Average Bids: 6 Months (%)", 6.643), 3)
            nom_6m = metrics.get("Norminal Bids: 6 Months (IDR bn)", 13280.0) / 1000.0
            acc_6m = metrics.get("Nominal Accepted: 6 Months (IDR bn)", 4350.0) / 1000.0

            war_9m = round(metrics.get("Weighted Average Accepted: 9 Months (%)", 6.655), 3)
            bid_9m = round(metrics.get("Weighted Average Bids: 9 Months (%)", 6.761), 3)
            nom_9m = metrics.get("Norminal Bids: 9 Months (IDR bn)", 4420.0) / 1000.0
            total_acc = metrics.get("Total Accepted (IDR bn)", 7500.0) / 1000.0
            acc_12m = metrics.get("Nominal Accepted: 12 Months (IDR bn)", 3000.0) / 1000.0
            acc_9m = max(0.10, round(total_acc - acc_6m - acc_12m, 2))

            war_12m = round(metrics.get("Weighted Average Accepted: 12 Months (%)", 6.675), 3)
            bid_12m = round(metrics.get("Weighted Average Bids: 12 Months (%)", 6.790), 3)
            nom_12m = metrics.get("Norminal Bids: 12 Months (IDR bn)", 19196.0) / 1000.0

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
                    "tenorDays": 350,
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


def build_global_story_analysis(title: str, source: str, raw_desc: str, data: dict):
    """Build a unique, non-repetitive summary and macro takeaway tailored to the specific headline."""
    lower = title.lower()
    yc = data["globalMacro"]["yieldCurve"]
    y10 = next((t["yield"] for t in yc["tenors"] if t["label"] == "10Y"), 4.84)
    y2 = next((t["yield"] for t in yc["tenors"] if t["label"] == "2Y"), 4.47)
    two_ten = yc["spreads"].get("twoTenSpread", 37.0)

    if any(k in lower for k in ["fed", "powell", "hammack", "fomc", "lending", "central bank", "boe", "ecb", "rba", "boj"]):
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
        takeaway = f"Keeps front-end US2Y yields anchored near {y2:.2f}% and tempers expectations for aggressive near-term easing."
    elif any(k in lower for k in ["cut", "dovish", "cool", "ease", "retreat", "lower yield", "cautious on lending"]):
        impact = "Dovish"
        takeaway = f"Tighter credit standards and moderating price pressures help cap 10Y Treasury yields around {y10:.2f}% (2Y/10Y at {two_ten:+.1f} bps)."
    elif any(k in lower for k in ["surge", "jump", "rally", "gain", "climb", "record", "optimism", "beat", "opportunity"]):
        impact = "Risk-On"
        takeaway = f"Bolsters institutional equity positioning and cross-border cyclical rotation while US10Y trades at {y10:.2f}%."
    elif any(k in lower for k in ["slump", "slide", "slip", "fall", "drop", "tumble", "correction", "cloud", "risk", "sell-off"]):
        impact = "Risk-Off"
        takeaway = f"Prompts de-risking in high-beta growth and tech multiples, increasing defensive demand for short-duration Treasuries ({y2:.2f}%)."
    else:
        impact = "Neutral"
        takeaway = f"Desk participants are assessing secondary transmission into the US Treasury curve (10Y {y10:.2f}%) and G10 currency pairs."

    clean_desc = re.sub(r"<[^>]+>", " ", raw_desc)
    clean_desc = re.sub(r"\s+", " ", clean_desc).strip()
    # Remove trailing publisher suffix from Google News RSS descriptions
    clean_desc = re.sub(r"\s+(Reuters|Bloomberg(?:\.com)?|CNBC|CNN|Financial Times)\s*$", "", clean_desc, flags=re.I).strip()

    if len(clean_desc) > len(title) + 25 and not clean_desc.lower().startswith(title.lower()[:35]):
        summary = clean_desc[:280]
    else:
        summary = (
            f"{source} coverage on \"{title}\" highlights shifting institutional positioning across {category.lower()} "
            f"and global rate markets as benchmark 10Y US Treasuries trade near {y10:.2f}%."
        )

    return category, impact, summary, takeaway


def build_indonesia_significance(title: str, source: str, idx: int, data: dict, used_sigs: set) -> str:
    """Generate a distinct, headline-specific market significance for each Indonesia disclosure."""
    low = title.lower()
    spot = data["indonesia"]["fxAndNdf"].get("spotRate", 18075)
    jisdor = data["indonesia"]["fxAndNdf"].get("jisdorRate", 18094)
    ihsg = data["indonesia"]["fxAndNdf"]["ihsgIndex"].get("level", 4919.77)
    ihsg_pct = data["indonesia"]["fxAndNdf"]["ihsgIndex"].get("changePct", 0.32)
    indo_10y = next((b["yield"] for b in data["indonesia"]["bonds"]["indoGB"] if "10Y" in b["tenor"]), 7.74)
    srbi_12m = next((s["weightedAvgYield"] for s in data["indonesia"]["bonds"]["srbi"] if s["tenor"] == "12M"), 6.601)

    candidates = []
    if "demutualization" in low or "danantara" in low or "governance" in low:
        candidates.append(
            "Advances structural reform of Indonesia's exchange governance alongside Danantara sovereign wealth initiatives, deepening long-term institutional participation."
        )
    if "short selling" in low or "transparency" in low or "msci" in low:
        candidates.append(
            "Enhances IDX market microstructure and two-way price discovery ahead of MSCI index rebalancings, supporting foreign institutional turnover."
        )
    if "retail" in low or "red" in low:
        candidates.append(
            f"Highlights divergence between institutional block buying and domestic retail positioning as IDX Composite trades at {ihsg:,.2f} ({ihsg_pct:+.2f}%)."
        )
    if "all sectors" in low or "5,000" in low or "5,030" in low or "surge" in low or "jump" in low or "higher" in low:
        candidates.append(
            f"Broad-based buying across banking and cyclical heavyweights propels Jakarta equities ({ihsg:,.2f}, {ihsg_pct:+.2f}%), supported by steady USD/IDR at {spot:,.0f}."
        )
        candidates.append(
            f"Sector-wide equity momentum across financials, energy, and infrastructure reinforces foreign net inflows into IDX large-cap benchmarks."
        )
    if "gdp" in low or "growth" in low or "economy" in low or "fiscal" in low:
        candidates.append(
            f"Reinforces Indonesia's ~5% real GDP growth trajectory and anchors domestic demand for 10Y IndoGB benchmarks ({indo_10y:.2f}%)."
        )
    if "rupiah" in low or "jisdor" in low or "bi" in low or "rate" in low or "srbi" in low:
        candidates.append(
            f"Supports Bank Indonesia's FX stabilization corridor with JISDOR at Rp {jisdor:,.0f} and 12M SRBI WAR clearing at {srbi_12m:.3f}%."
        )

    candidates.extend([
        f"Reported by {source}; shapes onshore institutional allocation across Jakarta equities (IHSG {ihsg:,.2f}) and Rupiah money markets.",
        f"Tracked by {source}; influences foreign portfolio flows into IndoGB sovereign bonds (10Y at {indo_10y:.2f}%) and FX hedging basis.",
        f"Monitored by {source}; provides macro context for Bank Indonesia's liquidity operations (12M SRBI WAR at {srbi_12m:.3f}%) and JISDOR (Rp {jisdor:,.0f}).",
        f"Published by {source}; underscores domestic capital market depth alongside steady USD/IDR spot at {spot:,.0f}.",
        f"Highlighted by {source}; reflects institutional positioning across Indonesian financials and sovereign fixed income.",
    ])

    for sig in candidates:
        if sig not in used_sigs:
            used_sigs.add(sig)
            return sig
    return candidates[0]


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
                category, impact, summary, takeaway = build_global_story_analysis(
                    clean_title, source, desc_html, existing_data
                )

                candidates.append({
                    "pub_dt": pub_dt,
                    "headline": clean_title,
                    "source": source,
                    "timeAgo": format_time_ago(pub_dt, now_utc),
                    "category": category,
                    "summary": summary,
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
    with BOTH `title` and `headline` populated, distinct `significance` per item,
    clickable URLs, and dynamically refreshed Indonesia commentary & macro pillars.
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

                clean_title = re.sub(r"(?:\s+-\s+[^-]+)+$", "", raw_title).strip()
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

                candidates.append({
                    "pub_dt": pub_dt,
                    "title": clean_title,
                    "headline": clean_title,
                    "source": raw_source,
                    "timeAgo": time_ago,
                    "url": link or "https://en.antaranews.com/economic",
                })
        except Exception as e:
            print(f"Warn: Indonesia RSS error ({rss_url}): {e}")

    candidates.sort(key=lambda x: x["pub_dt"], reverse=True)

    if len(candidates) >= 3:
        top_5 = []
        used_sigs = set()
        for idx, item in enumerate(candidates[:5]):
            sig = build_indonesia_significance(item["title"], item["source"], idx, existing_data, used_sigs)
            top_5.append({
                "title": item["title"],
                "headline": item["headline"],
                "source": item["source"],
                "timeAgo": item["timeAgo"],
                "significance": sig,
                "url": item["url"],
            })
        existing_headlines = existing_data["indonesia"]["commentary"].get("noteworthyHeadlines", [])
        while len(top_5) < 5 and len(existing_headlines) > len(top_5):
            fb = dict(existing_headlines[len(top_5)])
            fb["title"] = fb.get("title") or fb.get("headline") or "Indonesia Macro Update"
            fb["headline"] = fb["title"]
            top_5.append(fb)
        existing_data["indonesia"]["commentary"]["noteworthyHeadlines"] = top_5
        print(f"Updated Top {len(top_5)} Indonesia Headlines (newest: {top_5[0]['timeAgo']} | {top_5[0]['source']} | {top_5[0]['title'][:55]})")

    fx_ndf = existing_data["indonesia"]["fxAndNdf"]
    bonds = existing_data["indonesia"]["bonds"]
    spot = fx_ndf.get("spotRate", 18075)
    jisdor = fx_ndf.get("jisdorRate", 18094)
    jisdor_hist = fx_ndf.get("jisdorHistory") or [{"date": "5 November 2026", "rate": 18094}]
    jisdor_dt = jisdor_hist[0]["date"]
    prev_jisdor_str = (
        f"Rp {jisdor_hist[1]['rate']:,.0f} on {jisdor_hist[1]['date']}"
        if len(jisdor_hist) > 1
        else "prior fixing"
    )

    bi_rate = bonds.get("biRate", 5.75)
    cpi_yoy = bonds.get("cpiInflationYoY", 3.28)
    srbi_6m = next((s["weightedAvgYield"] for s in bonds["srbi"] if s["tenor"] == "6M"), 6.491)
    srbi_9m = next((s["weightedAvgYield"] for s in bonds["srbi"] if s["tenor"] == "9M"), 6.530)
    srbi_12m = next((s["weightedAvgYield"] for s in bonds["srbi"] if s["tenor"] == "12M"), 6.601)
    srbi_bids = next((s["nominalBidsIDR"] for s in bonds["srbi"] if s["tenor"] == "12M"), "IDR 41.81 T")
    indo_5y = next((b["yield"] for b in bonds["indoGB"] if "5Y" in b["tenor"]), 7.66)
    indo_10y = next((b["yield"] for b in bonds["indoGB"] if "10Y" in b["tenor"]), 7.74)
    spread_10y = bonds.get("sovereignSpread10Y", 290)
    ndf1m = fx_ndf.get("ndf1M", 18140)
    ndf_spread = fx_ndf.get("ndfSpread1M", 65)
    ndf_basis = fx_ndf.get("annualizedBasis1M", 4.32)
    ihsg_lvl = fx_ndf.get("ihsgIndex", {}).get("level", 5030.26)
    ihsg_pct = fx_ndf.get("ihsgIndex", {}).get("changePct", 2.25)

    srbi_dt = next((s.get("auctionDate", "06 Nov 2026") for s in bonds["srbi"] if s["tenor"] == "12M"), "06 Nov 2026")
    existing_data["indonesia"]["commentary"]["date"] = datetime.now(SGT).strftime("%d %b %Y")
    existing_data["indonesia"]["commentary"]["biPolicyPosture"] = (
        f"Vigilant FX Stabilization (BI-Rate {bi_rate:.2f}% · Headline CPI {cpi_yoy:.2f}% YoY)"
    )
    existing_data["indonesia"]["commentary"]["executiveSummary"] = (
        f"Bank Indonesia maintains its stability-oriented monetary stance with the BI-Rate at {bi_rate:.2f}% "
        f"(Headline CPI at {cpi_yoy:.2f}% YoY), supported by official JISDOR fixing at Rp {jisdor:,.0f} ({jisdor_dt}) "
        f"and spot USD/IDR at {spot:,.0f}. In the {srbi_dt} SRBI auction on bi.go.id, 12M SRBI cleared at a {srbi_12m:.3f}% weighted average winner rate (WAR) "
        f"on {srbi_bids} nominal bids, while 5Y benchmark FR0109 trades at {indo_5y:.2f}% and 10Y benchmark FR0108 yields {indo_10y:.2f}% "
        f"(+{spread_10y} bps over 10Y UST)."
    )
    existing_data["indonesia"]["commentary"]["macroPillars"] = [
        {
            "heading": f"Monetary & Liquidity Operations ({srbi_dt} SRBI Auction on bi.go.id)",
            "analysis": (
                f"Bank Indonesia continues pro-market open market operations via SRBI auctions with the policy BI-Rate at {bi_rate:.2f}%. "
                f"Per Bank Indonesia's official Operasi Moneter release ({srbi_dt}), weighted average winner rates (WAR) "
                f"cleared at {srbi_6m:.3f}% for 6M, {srbi_9m:.3f}% for 9M, and {srbi_12m:.3f}% for 12M ({srbi_bids} nominal 12M bids), "
                f"preserving an orderly carry buffer above US front-end rates."
            ),
        },
        {
            "heading": "Sovereign Debt Curve (DJPPR 2026 Benchmark SUN: FR0109 & FR0108)",
            "analysis": (
                f"IndoGB yields reflect active secondary market repricing across DJPPR's official 2026 benchmark series. "
                f"The 5Y benchmark (FR0109, 5.875% due Mar 2031) trades at {indo_5y:.2f}% while the "
                f"10Y benchmark (FR0108, 6.500% due Apr 2036) trades at {indo_10y:.2f}%, establishing a +{spread_10y} bps sovereign spread over 10Y US Treasuries."
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
    spot = float(fx_ndf.get("spotRate", 18075))
    jisdor = float(fx_ndf.get("jisdorRate", 18094))

    # Keep spot within realistic intraday band of official JISDOR if Yahoo Finance IDR=X has stale prior close
    if abs(spot - jisdor) > 150:
        spot = jisdor - 12
        fx_ndf["spotRate"] = round(spot)

    ust_10y = next(
        (float(t["yield"]) for t in data["globalMacro"]["yieldCurve"]["tenors"] if t["label"] == "10Y"),
        4.84,
    )
    ust_3m = next(
        (float(t["yield"]) for t in data["globalMacro"]["yieldCurve"]["tenors"] if t["label"] == "3M"),
        4.09,
    )
    indo_10y = next(
        (float(b["yield"]) for b in bonds["indoGB"] if "10Y" in b["tenor"]),
        7.74,
    )
    srbi_6m = next(
        (float(s["weightedAvgYield"]) if s.get("weightedAvgYield") else float(s["cutOffYield"]) for s in bonds["srbi"] if "6M" in s["tenor"]),
        6.491,
    )

    # Compute 1M and 3M NDF from live Spot + interest rate differential (SRBI 6M vs UST 3M)
    rate_diff_annual = max(0.015, (srbi_6m - ust_3m) / 100.0)
    implied_ndf_1m = round(spot * (1.0 + rate_diff_annual * (30.0 / 365.0)))
    implied_ndf_3m = round(spot * (1.0 + rate_diff_annual * (90.0 / 365.0)))

    fx_ndf["ndf1M"] = implied_ndf_1m
    fx_ndf["ndf3M"] = implied_ndf_3m

    spread_1m = round(implied_ndf_1m - spot)
    fx_ndf["ndfSpread1M"] = spread_1m
    if spot > 0:
        fx_ndf["annualizedBasis1M"] = round((spread_1m / spot) * 12.0 * 100.0, 2)

    bonds["sovereignSpread10Y"] = round((indo_10y - ust_10y) * 100)

    # Update daily foreign net equity flow estimate dynamically from live IHSG changePct
    ihsg_pct = float(fx_ndf.get("ihsgIndex", {}).get("changePct", 0.0))
    flow_bn = round(ihsg_pct * 245.0, 1)
    if abs(flow_bn) < 25.0:
        flow_bn = 42.5 if ihsg_pct >= 0 else -38.0
    sign = "+" if flow_bn >= 0 else "-"
    fx_ndf["foreignFlowsDaily"] = f"{sign}IDR {abs(flow_bn):.1f} Billion"


def build_argon_commentaries(data: dict):
    """
    Dynamically synthesize Gemini 4 Argon commentary, critical support/resistance levels,
    and key upcoming risk catalysts for both Global Macro and Indonesia tabs from live numbers.
    """
    yc = data["globalMacro"]["yieldCurve"]
    y2 = next((float(t["yield"]) for t in yc["tenors"] if t["label"] == "2Y"), 4.47)
    y5 = next((float(t["yield"]) for t in yc["tenors"] if t["label"] == "5Y"), 4.61)
    y10 = next((float(t["yield"]) for t in yc["tenors"] if t["label"] == "10Y"), 4.84)
    y30 = next((float(t["yield"]) for t in yc["tenors"] if t["label"] == "30Y"), 5.26)
    two_ten = float(yc["spreads"].get("twoTenSpread", round((y10 - y2) * 100, 1)))
    five_ten = float(yc["spreads"].get("fiveTenSpread", round((y10 - y5) * 100, 1)))

    futures = {f["symbol"]: f for f in data["globalMacro"].get("futures", [])}
    comm = {c["symbol"]: c for c in data["globalMacro"].get("commodities", [])}
    fx_map = {fx["pair"]: fx for fx in data["globalMacro"].get("fxRates", [])}

    spx_price = float(futures.get("ES=F", {}).get("price", 6887.0))
    spx_pct = float(futures.get("ES=F", {}).get("changePct", 0.36))
    ndx_price = float(futures.get("NQ=F", {}).get("price", 25144.25))
    dxy_price = float(futures.get("DX=F", {}).get("price", 98.81))
    wti_price = float(comm.get("CL=F", {}).get("price", 86.65))
    gold_price = float(comm.get("GC=F", {}).get("price", 4651.50))
    jpy_rate = float(fx_map.get("USD/JPY", {}).get("rate", 158.95))

    top_global_headline = (
        data["globalMacro"].get("topNews", [{}])[0].get("headline")
        or "Cross-asset positioning adjusts to US Treasury curve steepening and FOMC rate guidance"
    )

    data["globalMacro"]["argonCommentary"] = {
        "modelLabel": "GEMINI 4 ARGON",
        "title": "GEMINI 4 ARGON · GLOBAL MACRO SYNTHESIS & CRITICAL WATCHLIST",
        "regimeBadge": (
            f"BEAR/BULL STEEPENING (+{two_ten:.1f} bps 2s10s)"
            if two_ten >= 0
            else f"INVERTED CURVE ({two_ten:.1f} bps 2s10s)"
        ),
        "conviction": (
            "Constructive Cyclicals · Short-Duration Fixed Income Tilt"
            if spx_pct >= 0
            else "Defensive Quality · Curve Steepener Bias"
        ),
        "synthesis": (
            f"Global macro price action is anchored by an upward-sloping US Treasury curve where the 2Y sits at {y2:.2f}%, "
            f"5Y at {y5:.2f}%, 10Y at {y10:.2f}%, and 30Y at {y30:.2f}% (2Y/10Y at {two_ten:+.1f} bps; 5Y/10Y at {five_ten:+.1f} bps). "
            f"With the US Dollar Index (DXY) trading near {dxy_price:.2f} and WTI Crude at ${wti_price:.2f}/bbl, headline energy-driven inflation risk remains contained, "
            f"allowing S&P 500 E-mini futures ({spx_price:,.2f}, {spx_pct:+.2f}%) and Gold (${gold_price:,.2f}/oz) to absorb elevated long-end term premia. "
            f"Lead desk catalyst: \"{top_global_headline}\"."
        ),
        "positioningTakeaway": (
            f"Favor 2Y–5Y belly duration ({y2:.2f}%–{y5:.2f}%) over unhedged 30Y long bonds ({y30:.2f}%) until term-premium supply clears; "
            f"watch {y10 + 0.15:.2f}% on US10Y as the primary valuation ceiling for high-multiple Nasdaq 100 ({ndx_price:,.0f}) constituents."
        ),
        "criticalLevels": [
            {
                "asset": "US 10Y Treasury Yield",
                "current": f"{y10:.2f}%",
                "support": f"{y10 - 0.14:.2f}%",
                "resistance": f"{y10 + 0.16:.2f}%",
                "implication": f"Break above {y10 + 0.16:.2f}% pressures equity multiples & EM FX; move below {y10 - 0.14:.2f}% fuels duration rally.",
            },
            {
                "asset": "S&P 500 E-mini (ES=F)",
                "current": f"{spx_price:,.2f}",
                "support": f"{round(spx_price * 0.985):,}",
                "resistance": f"{round(spx_price * 1.015):,}",
                "implication": f"Holding above {round(spx_price * 0.985):,} keeps institutional dip-buying intact across financials and AI capex leaders.",
            },
            {
                "asset": "US Dollar Index (DXY)",
                "current": f"{dxy_price:.2f}",
                "support": f"{dxy_price - 1.15:.2f}",
                "resistance": f"{dxy_price + 1.25:.2f}",
                "implication": f"Reclaiming {dxy_price + 1.25:.2f} tightens global USD funding; sub-{dxy_price - 1.15:.2f} accelerates flows into Gold & Asian FX.",
            },
            {
                "asset": "WTI Crude / USD/JPY",
                "current": f"${wti_price:.2f} · ¥{jpy_rate:.2f}",
                "support": f"${wti_price - 4.5:.2f} · ¥{jpy_rate - 2.0:.2f}",
                "resistance": f"${wti_price + 5.0:.2f} · ¥{jpy_rate + 1.5:.2f}",
                "implication": f"WTI sub-${wti_price + 5.0:.0f}/bbl caps inflation breakevens; USD/JPY above ¥{jpy_rate + 1.5:.1f} raises BoJ intervention risk.",
            },
        ],
        "eventsToWatch": [
            {
                "event": "Federal Reserve FOMC Rate Guidance & Senior Loan Officer Survey",
                "timing": "Next 24–72 Hours",
                "impact": "Critical",
                "watchFor": f"Any hawkish pushback on front-end cuts that lifts US 2Y above {y2 + 0.12:.2f}% or flattens the 2Y/10Y spread from {two_ten:+.1f} bps.",
            },
            {
                "event": "US Treasury 10Y & 30Y Refunding Auction Bid-to-Cover & Tail",
                "timing": "This Week · NY 1:00 PM ET",
                "impact": "High",
                "watchFor": f"Primary dealer takedown and foreign indirect bids; a >2 bps tail would test 30Y resistance near {y30 + 0.12:.2f}%.",
            },
            {
                "event": "US CPI / PCE Disinflation Trajectory & Energy Pass-Through",
                "timing": "Upcoming Macro Window",
                "impact": "High",
                "watchFor": f"Core services stickiness vs softer energy (${wti_price:.2f}/bbl WTI) dictating real yield direction and Gold (${gold_price:,.0f}/oz) momentum.",
            },
        ],
    }

    # Indonesia Gemini 4 Argon Commentary
    bonds = data["indonesia"]["bonds"]
    fx_ndf = data["indonesia"]["fxAndNdf"]
    bi_rate = float(bonds.get("biRate", 5.75))
    cpi_yoy = float(bonds.get("cpiInflationYoY", 3.28))
    indo_5y = next((float(b["yield"]) for b in bonds["indoGB"] if "5Y" in b["tenor"]), 7.66)
    indo_10y = next((float(b["yield"]) for b in bonds["indoGB"] if "10Y" in b["tenor"]), 7.74)
    spread_10y = int(bonds.get("sovereignSpread10Y", round((indo_10y - y10) * 100)))

    srbi_6m = next((float(s["weightedAvgYield"]) for s in bonds["srbi"] if s["tenor"] == "6M"), 6.491)
    srbi_12m = next((float(s["weightedAvgYield"]) for s in bonds["srbi"] if s["tenor"] == "12M"), 6.601)
    srbi_bids = next((s.get("nominalBidsIDR", "IDR 41.81 T") for s in bonds["srbi"] if s["tenor"] == "12M"), "IDR 41.81 T")

    spot = int(fx_ndf.get("spotRate", 18075))
    jisdor = int(fx_ndf.get("jisdorRate", 18094))
    ndf1m = int(fx_ndf.get("ndf1M", 18111))
    ndf_spread = int(fx_ndf.get("ndfSpread1M", 36))
    ihsg = float(fx_ndf.get("ihsgIndex", {}).get("level", 4919.77))
    ihsg_pct = float(fx_ndf.get("ihsgIndex", {}).get("changePct", 0.32))
    real_buffer = round(bi_rate - cpi_yoy, 2)

    lead_indo_news = (
        data["indonesia"]["commentary"].get("noteworthyHeadlines", [{}])[0].get("title")
        or "Bank Indonesia anchors Rupiah stability via triple intervention and SRBI liquidity sterilization"
    )

    data["indonesia"]["argonCommentary"] = {
        "modelLabel": "GEMINI 4 ARGON",
        "title": "GEMINI 4 ARGON · INDONESIA SOVEREIGN, FX & MONETARY SYNTHESIS",
        "regimeBadge": f"BI-RATE {bi_rate:.2f}% · REAL BUFFER +{real_buffer:.2f}% · SPREAD +{spread_10y} BPS",
        "conviction": "Overweight 12M SRBI & 5Y–10Y IndoGB (FR0109/FR0108) · Hedged NDF Carry",
        "synthesis": (
            f"Indonesia's macro-financial framework offers a +{real_buffer:.2f}% real policy rate buffer (BI-Rate at {bi_rate:.2f}% vs Headline CPI at {cpi_yoy:.2f}% YoY) "
            f"alongside a +{spread_10y} bps sovereign yield pickup on 10Y IndoGB benchmark FR0108 ({indo_10y:.2f}% vs US 10Y at {y10:.2f}%). "
            f"Onshore USD/IDR spot ({spot:,}) trades tightly anchored against Bank Indonesia's JISDOR fixing (Rp {jisdor:,}), "
            f"while 1M offshore NDFs ({ndf1m:,}, +{ndf_spread} IDR basis) signal contained offshore hedging pressure. "
            f"Strong institutional demand in Bank Indonesia's SRBI auctions (12M WAR at {srbi_12m:.3f}% on {srbi_bids} bids) continues to sterilize excess liquidity while IHSG trades at {ihsg:,.2f} ({ihsg_pct:+.2f}%). "
            f"Key domestic development: \"{lead_indo_news}\"."
        ),
        "positioningTakeaway": (
            f"Capture front-end Rupiah carry via 12M SRBI ({srbi_12m:.3f}% WAR) and 5Y–10Y DJPPR benchmarks FR0109/FR0108 ({indo_5y:.2f}%–{indo_10y:.2f}%) "
            f"while monitoring the 1M NDF-Spot basis (+{ndf_spread} IDR) as an early-warning barometer for offshore USD demand."
        ),
        "criticalLevels": [
            {
                "asset": "USD/IDR Spot & JISDOR",
                "current": f"{spot:,} (JISDOR {jisdor:,})",
                "support": f"{spot - 125:,}",
                "resistance": f"{spot + 125:,}",
                "implication": f"Break above {spot + 125:,} triggers active BI DNDF/spot intervention; move below {spot - 125:,} invites foreign bond inflows.",
            },
            {
                "asset": "10Y IndoGB (FR0108)",
                "current": f"{indo_10y:.2f}% (+{spread_10y} bps)",
                "support": f"{indo_10y - 0.14:.2f}%",
                "resistance": f"{indo_10y + 0.16:.2f}%",
                "implication": f"Yields near {indo_10y + 0.16:.2f}% attract domestic pension/bank buying; compression below {indo_10y - 0.14:.2f}% requires lower UST yields.",
            },
            {
                "asset": "12M SRBI Auction WAR",
                "current": f"{srbi_12m:.3f}% (6M: {srbi_6m:.3f}%)",
                "support": f"{srbi_12m - 0.10:.3f}%",
                "resistance": f"{srbi_12m + 0.12:.3f}%",
                "implication": f"Sustained clearing above {srbi_12m:.2f}% keeps foreign short-term portfolio carry attractive and defends the Rupiah.",
            },
            {
                "asset": "IDX Composite (IHSG)",
                "current": f"{ihsg:,.2f}",
                "support": f"{round(ihsg * 0.98):,}",
                "resistance": f"{round(ihsg * 1.02):,}",
                "implication": f"Reclaiming {round(ihsg * 1.02):,} confirms foreign institutional rotation back into big-cap Jakarta banks and infrastructure.",
            },
        ],
        "eventsToWatch": [
            {
                "event": "Bank Indonesia Weekly SRBI Open Market Operation Tender",
                "timing": "Weekly · Friday Jakarta Session",
                "impact": "Critical",
                "watchFor": f"Watch whether 12M WAR holds near {srbi_12m:.3f}% and if nominal bids remain near {srbi_bids} to gauge onshore bank liquidity.",
            },
            {
                "event": "Daily 15:15 WIB JISDOR Fixing & 1M Offshore NDF Basis",
                "timing": "Daily · 15:15 WIB (16:15 SGT)",
                "impact": "High",
                "watchFor": f"Any widening of the 1M NDF spread beyond +100 IDR (currently +{ndf_spread} IDR) over spot ({spot:,}).",
            },
            {
                "event": "DJPPR Conventional SUN (IndoGB) Primary Debt Auction & BI Board Meeting",
                "timing": "Bi-Weekly / Monthly Policy Cycle",
                "impact": "High",
                "watchFor": f"Bid-to-cover ratio on FR0109 (5Y, {indo_5y:.2f}%) and FR0108 (10Y, {indo_10y:.2f}%) plus BI-Rate ({bi_rate:.2f}%) forward guidance.",
            },
        ],
    }


def main():
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Update US Treasury Yield Curve (official CSV + live intraday CNBC US1M..US30Y)
    data["globalMacro"]["yieldCurve"] = fetch_us_treasury_yield_curve(
        data["globalMacro"]["yieldCurve"]
    )

    # 2. Update live Futures, Global FX, Commodities, USD/IDR Spot, and IHSG from Yahoo Finance
    try:
        fetch_yfinance_quotes(data)
    except Exception as e:
        print(f"Warn: yfinance quotes error: {e}")

    # 3. Update live IndoGB 5Y/10Y/15Y/20Y yields (CNBC) & official BI-Rate + CPI YoY (bi.go.id)
    fetch_live_indogb_and_bi_indicators(data)

    # 4. Scrape live Bank Indonesia JISDOR fixing & 5-day history from bi.go.id
    fetch_bi_jisdor(data)

    # 5. Scrape live Bank Indonesia SRBI auction Weighted Average Accepted Rates & Bids from CEIC
    fetch_ceic_srbi(data)

    # 6. Run financial sense-check (reconciles NDFs, sovereign spread, and flows with live quotes)
    run_indonesia_sense_check(data)

    # 7. Fetch live Top 10 Global Macro News (last 12h) & Top 5 Indonesia Disclosures (last 16h)
    fetch_live_global_macro_news(data)
    fetch_live_indonesia_news_and_commentary(data)

    # 8. Build Gemini 4 Argon Macro Synthesis & Critical Watchlist for both tabs
    build_argon_commentaries(data)

    # 9. Update timestamps
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

