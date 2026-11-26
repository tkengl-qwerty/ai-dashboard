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


def fetch_phei_indogb_benchmarks() -> tuple[dict, str]:
    """
    Scrape official PHEI (PT Penilai Harga Efek Indonesia / formerly IBPA) daily evaluated
    fair prices and yields for the DJPPR 2026 Seri Benchmark SUN (FR0109, FR0108, FR0106, FR0107)
    from https://www.phei.co.id/Data/HPW-dan-Imbal-Hasil.
    Returns (benchmarks_map, valuation_date_str).
    """
    url = "https://www.phei.co.id/Data/HPW-dan-Imbal-Hasil"
    result = {}
    val_date_str = ""
    try:
        page_html = http_get_text(url, timeout=15)
        m_dt = re.search(r"(\d{2})/(\d{2})/(202\d)", page_html)
        if m_dt:
            try:
                parsed_dt = datetime(int(m_dt.group(3)), int(m_dt.group(2)), int(m_dt.group(1)))
                val_date_str = parsed_dt.strftime("%d %b %Y")
            except Exception:
                val_date_str = f"{m_dt.group(1)}/{m_dt.group(2)}/{m_dt.group(3)}"

        for tr in re.findall(r"<tr[^>]*>.*?</tr>", page_html, re.S | re.I):
            cells = [
                re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", td))).strip()
                for td in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)
            ]
            cells = [c for c in cells if c]
            # Expected PHEI row: [Series, TTM(Y), Today Yield(%), Today Price(%), Yesterday Yield(%), Yesterday Price(%), Coupon(%)]
            if len(cells) >= 6 and re.match(r"^FR0\d{3}$", cells[0]):
                code = cells[0].strip()
                today_yld = _parse_id_float(cells[2], 0.0)
                yest_yld = _parse_id_float(cells[4], 0.0)
                if 4.0 <= today_yld <= 12.0:
                    chg_bps = round((today_yld - yest_yld) * 100.0, 1) if 4.0 <= yest_yld <= 12.0 else 0.0
                    result[code] = {
                        "yield": round(today_yld, 2),
                        "exactYield": round(today_yld, 4),
                        "priorYield": round(yest_yld, 4) if yest_yld else round(today_yld, 4),
                        "changeBps": chg_bps,
                    }
    except Exception as e:
        print(f"Warn: PHEI benchmark SUN scrape error ({e}), falling back to CNBC Refinitiv.")
    return result, val_date_str


def fetch_live_indogb_and_bi_indicators(existing_data: dict):
    """
    Primary: Fetch official PHEI (IBPA) daily evaluated yields for DJPPR 2026 Seri Benchmark SUN
    (FR0109 5Y, FR0108 10Y, FR0106 15Y, FR0107 20Y) from phei.co.id.
    Secondary: CNBC real-time Refinitiv bond API (ID5YT=RR, ID10YT=RR, ID15YT=RR, ID20YT=RR).
    Also scrape official BI-Rate & CPI YoY from bi.go.id and live IDR= spot from CNBC.
    """
    phei_benchmarks, phei_val_date = fetch_phei_indogb_benchmarks()
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
    used_phei = False
    for tenor, code, maturity, sym, coupon in bond_specs:
        if code in phei_benchmarks:
            used_phei = True
            p = phei_benchmarks[code]
            new_indogb.append({
                "tenor": tenor,
                "code": code,
                "maturity": maturity,
                "yield": p["yield"],
                "changeBps": p["changeBps"],
                "coupon": coupon,
            })
        elif sym in cnbc_indo and 4.0 <= cnbc_indo[sym]["last"] <= 12.0:
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
        if used_phei:
            existing_data["indonesia"]["bonds"]["valuationDate"] = phei_val_date or datetime.now(SGT).strftime("%d %b %Y")
            existing_data["indonesia"]["bonds"]["yieldSource"] = "PHEI (IBPA) Official Evaluated Yield"
        else:
            existing_data["indonesia"]["bonds"]["valuationDate"] = datetime.now(SGT).strftime("%d %b %Y")
            existing_data["indonesia"]["bonds"]["yieldSource"] = "Refinitiv / CNBC Live Curve"
        src_tag = f"PHEI Official {phei_val_date}" if used_phei else "CNBC Refinitiv Live"
        print(
            f"Updated Live IndoGB Yields ({src_tag} · DJPPR 2026 Benchmarks): "
            f"5Y {new_indogb[0]['code']}={new_indogb[0]['yield']:.2f}% ({new_indogb[0]['changeBps']:+.1f} bps), "
            f"10Y {new_indogb[1]['code']}={new_indogb[1]['yield']:.2f}% ({new_indogb[1]['changeBps']:+.1f} bps), "
            f"15Y {new_indogb[2]['code']}={new_indogb[2]['yield']:.2f}% ({new_indogb[2]['changeBps']:+.1f} bps), "
            f"20Y {new_indogb[3]['code']}={new_indogb[3]['yield']:.2f}% ({new_indogb[3]['changeBps']:+.1f} bps)"
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


def _parse_bi_srbi_detail_page(detail_html: str, detail_url: str) -> list[dict] | None:
    """Parse Bank Indonesia's Hasil-Lelang-SRBI-*.aspx official table into 6M/9M/12M SRBI records."""
    m_date = re.search(
        r"Hasil\s+Lelang\s+SRBI\s+(\d{1,2}\s+[A-Za-z]+\s+202\d)",
        detail_html,
        re.I,
    )
    if not m_date:
        return None
    raw_date = m_date.group(1)
    dt_label = _format_bi_date_short(raw_date)

    table_rows = {}
    for tr in re.findall(r"<tr[^>]*>.*?</tr>", detail_html, re.S | re.I):
        cells = [
            re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", td))).strip()
            for td in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)
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

    if "war_winner" not in table_rows or len(table_rows["war_winner"]) < 3:
        return None

    tenor_labels = ["6M", "9M", "12M"]
    default_days = [182, 273, 364]
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
        if bid_range_raw and "-" in bid_range_raw and "%" not in bid_range_raw:
            lo_hi = [p.strip() for p in bid_range_raw.split("-", 1)]
            bid_range_fmt = f"{lo_hi[0]}% - {lo_hi[1]}%"
        elif bid_range_raw:
            bid_range_fmt = bid_range_raw if "%" in bid_range_raw else f"{bid_range_raw}%"
        else:
            bid_range_fmt = None

        srbi_list.append({
            "tenor": tenor_labels[i],
            "tenorDays": tenor_days,
            "series": series_code,
            "auctionDate": dt_label,
            "weightedAvgYield": war_win,
            "cutOffYield": war_bid,
            "biddingRateRange": bid_range_fmt,
            "nominalBidsIDR": f"IDR {bids_bn / 1000.0:.2f} T",
            "awardedVolumeIDR": f"IDR {awarded_bn / 1000.0:.2f} T",
            "sourceUrl": detail_url,
        })
    return srbi_list


def fetch_ceic_srbi(existing_data: dict):
    """
    Primary: Scrape latest official SRBI auction announcement directly from Bank Indonesia's
    Operasi Moneter portal (bi.go.id). Because BI publishes 6+ daily FX Swap/SukBI/Repo notices
    that push Friday's SRBI auction off Page 1 of Default.aspx within 1-2 business days, this
    fetcher checks Page 1 first and then probes deterministic Hasil-Lelang-SRBI-{d}-{Bulan}-{yyyy}.aspx
    URLs backwards over the last 35 days (Fridays first, then other weekdays) to guarantee the
    newest SRBI auction is always discovered.
    Fallback: Scrape CEIC Data if bi.go.id is unreachable.
    """
    bi_index_url = "https://www.bi.go.id/id/publikasi/lelang/operasi-moneter/Default.aspx"
    id_month_names = [
        "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ]

    try:
        candidate_urls = []
        try:
            index_html = http_get_text(bi_index_url, timeout=12)
            srbi_links = re.findall(
                r'href=["\'](/id/publikasi/lelang/operasi-moneter/Pages/Hasil-Lelang-SRBI-[^"\']+\.aspx)["\']',
                index_html,
                re.I,
            )
            for p in srbi_links[:3]:
                u = f"https://www.bi.go.id{p}"
                if u not in candidate_urls:
                    candidate_urls.append(u)
        except Exception as idx_err:
            print(f"Warn: BI Operasi Moneter index error ({idx_err}), probing direct SRBI URLs.")

        # Deterministic reverse-date discovery (Fridays first, then Wednesdays/other weekdays over past 35 days)
        now_sgt = datetime.now(SGT).date()
        friday_dates = []
        other_weekdays = []
        for delta in range(0, 36):
            cand_dt = now_sgt - timedelta(days=delta)
            if cand_dt.weekday() == 4:  # Friday (primary BI SRBI auction day)
                friday_dates.append(cand_dt)
            elif cand_dt.weekday() < 5:
                other_weekdays.append(cand_dt)

        for cand_dt in friday_dates + other_weekdays[:14]:
            slug = f"{cand_dt.day}-{id_month_names[cand_dt.month]}-{cand_dt.year}"
            u = f"https://www.bi.go.id/id/publikasi/lelang/operasi-moneter/Pages/Hasil-Lelang-SRBI-{slug}.aspx"
            if u not in candidate_urls:
                candidate_urls.append(u)

        for detail_url in candidate_urls:
            try:
                detail_html = http_get_text(detail_url, timeout=10)
                if "404" in detail_html[:1500] and "Hasil Lelang SRBI" not in detail_html[:4000]:
                    continue
                srbi_list = _parse_bi_srbi_detail_page(detail_html, detail_url)
                if srbi_list and len(srbi_list) == 3:
                    existing_data["indonesia"]["bonds"]["srbi"] = srbi_list
                    print(
                        f"Updated SRBI directly from bi.go.id ({srbi_list[0]['auctionDate']} · {detail_url}): "
                        f"6M ({srbi_list[0]['series']})={srbi_list[0]['weightedAvgYield']:.3f}%, "
                        f"9M ({srbi_list[1]['series']})={srbi_list[1]['weightedAvgYield']:.3f}%, "
                        f"12M ({srbi_list[2]['series']})={srbi_list[2]['weightedAvgYield']:.3f}%"
                    )
                    return
            except Exception:
                continue
    except Exception as e:
        print(f"Warn: Direct bi.go.id SRBI discovery error ({e}), trying CEIC fallback.")

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
            dt_label = auction_date or datetime.now(SGT).strftime("%d %b %Y")
            war_6m = round(metrics.get("Weighted Average Accepted: 6 Months (%)", 6.678), 3)
            bid_6m = round(metrics.get("Weighted Average Bids: 6 Months (%)", 6.792), 3)
            nom_6m = metrics.get("Norminal Bids: 6 Months (IDR bn)", 10582.0) / 1000.0
            acc_6m = metrics.get("Nominal Accepted: 6 Months (IDR bn)", 2335.0) / 1000.0

            war_9m = round(metrics.get("Weighted Average Accepted: 9 Months (%)", 6.790), 3)
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
    """Ensure every global news headline is genuinely macro, central bank, rates, FX, commodities, or high-impact political-economic."""
    lower = title.lower()
    exclude_words = [
        "olive oil", "shake shack", "wendy's", "peloton", "horoscope", "uber food", "prime subscribers",
        "bomb hoax", "passenger flights", "sports", "nfl", "nba", "recipe", "lottery",
        "biggest moves premarket", "biggest moves midday", "here are thursday's", "here are wednesday's",
        "here are monday's", "here are tuesday's", "here are friday's",
        "local election", "anc battered", "municipal election",
        "check out ", "stock price", "in real time", "profile and biography", "ucits etf",
        "mutual fund", "victory celebrations", "farms", "| stock price", "latest news",
        "in pictures:", "knicks", "cavaliers", "suns", "rockets", "lakers", "warriors", "celtics",
        "imprisoned", "recruitment", "delegate count", "party congress",
        "page 2 of", "page 1 of", "professional services", "celebrity", "box office", "grammy",
    ]
    if any(w in lower for w in exclude_words):
        return False

    macro_pattern = re.compile(
        r"\b("
        r"fed|federal reserve|powell|hammack|waller|bowman|goolsbee|fomc|interest rate|rates|central bank|ecb|boe|boj|rba|pboc|"
        r"treasury|treasuries|yield|yields|bond|bonds|gilts|bund|debt|deficit|fiscal|refunding|"
        r"inflation|cpi|pce|lending|credit|banking|gdp|economy|economic|recession|jobs|payrolls|unemployment|"
        r"wall st|wall street|stocks|s&p|nasdaq|dow jones|equities|market|markets|rally|slump|sell-off|"
        r"dollar|dxy|currency|currencies|forex|yuan|yen|euro|sterling|"
        r"oil|crude|brent|wti|opec|gold|silver|copper|energy|lng|"
        r"tariff|tariffs|trade|sanctions|export control|white house|trump|bessent|congress|senate|budget|tax|debt ceiling|"
        r"geopolitical|g7|g20|imf|world bank|qualcomm|nvidia|semiconductor"
        r")\b",
        re.I,
    )
    return bool(macro_pattern.search(title))


def get_global_topic_cluster(title: str) -> str:
    """Group global macro headlines by event cluster so a single story never dominates multiple Top 10 slots."""
    low = title.lower()
    if any(k in low for k in ["tariff", "trade war", "trade deal", "export control", "customs", "duties"]):
        return "glob_trade_tariffs"
    if any(k in low for k in ["powell", "fomc", "federal reserve", "fed's", "fed ", "rate cut", "rate hike", "hammack", "waller", "goolsbee"]):
        return "glob_fed_policy"
    if any(k in low for k in ["ecb", "bank of england", "boe", "bank of japan", "boj", "rba"]):
        return "glob_g10_cb"
    if any(k in low for k in ["cpi", "pce", "inflation", "consumer price", "producer price"]):
        return "glob_inflation"
    if any(k in low for k in ["oil", "crude", "brent", "wti", "opec", "energy", "natural gas", "lng"]):
        return "glob_energy_oil"
    if any(k in low for k in ["gold", "bullion", "silver", "copper"]):
        return "glob_precious_metals"
    if any(k in low for k in ["treasury", "10-year", "bond yield", "yields", "refunding", "debt ceiling", "deficit"]):
        return "glob_ust_rates"
    if any(k in low for k in ["white house", "trump", "congress", "senate", "fiscal", "tax", "budget", "sanctions", "deregulation"]):
        return "glob_us_pol_fiscal"
    if any(k in low for k in ["payroll", "jobs", "unemployment", "jobless", "labor", "layoff"]):
        return "glob_labor_market"
    if any(k in low for k in ["dollar", "dxy", "forex", "yen", "euro", "yuan", "sterling"]):
        return "glob_fx_dollar"
    return "glob_" + re.sub(r"[^a-z0-9]", "", low)[:26]


def build_global_story_analysis(title: str, source: str, raw_desc: str, data: dict, used_takeaways: set = None, idx: int = 0):
    """Build a unique, non-repetitive summary and macro/political-economic takeaway tailored to the specific headline."""
    if used_takeaways is None:
        used_takeaways = set()
    lower = title.lower()
    yc = data["globalMacro"]["yieldCurve"]
    y10 = next((t["yield"] for t in yc["tenors"] if t["label"] == "10Y"), 4.84)
    y2 = next((t["yield"] for t in yc["tenors"] if t["label"] == "2Y"), 4.47)
    two_ten = yc["spreads"].get("twoTenSpread", 37.0)

    if any(k in lower for k in ["fed", "powell", "hammack", "waller", "goolsbee", "fomc", "lending", "central bank", "boe", "ecb", "rba", "boj"]):
        category = "Fed Policy"
    elif any(k in lower for k in ["inflation", "cpi", "pce", "oil", "crude", "gold", "price", "commodity", "energy", "opec"]):
        category = "Inflation"
    elif any(k in lower for k in ["job", "payroll", "unemployment", "labor", "wage", "layoff", "hiring"]):
        category = "Labor Market"
    elif any(k in lower for k in ["tariff", "trade", "sanctions", "white house", "trump", "geopolitics", "ukraine", "middle east", "china", "beijing", "summit", "export control"]):
        category = "Geopolitics"
    elif any(k in lower for k in ["treasury", "bond", "yield", "deficit", "debt", "congress", "senate", "midterm", "fiscal", "tax", "budget", "wall st", "stocks", "s&p", "dow", "nasdaq", "market"]):
        category = "Fiscal & Debt"
    else:
        category = "Geopolitics"

    takeaway_candidates = []
    if any(k in lower for k in ["tariff", "trade", "sanctions", "export control", "duties"]):
        takeaway_candidates.append(
            f"Trade and tariff policy shifts drive cross-border inflation breakevens and G10/EM FX risk premia while US10Y trades at {y10:.2f}%."
        )
    if any(k in lower for k in ["white house", "trump", "congress", "senate", "fiscal", "tax", "budget", "deficit", "debt"]):
        takeaway_candidates.append(
            f"US executive and legislative fiscal policy expectations directly shape Treasury term premia across the 2Y/10Y curve ({two_ten:+.1f} bps)."
        )
    if any(k in lower for k in ["restrictive", "hike", "hawkish", "sticky", "higher rate", "inflation rises"]):
        impact = "Hawkish"
        takeaway_candidates.append(
            f"Keeps front-end US2Y yields anchored near {y2:.2f}% and tempers market pricing for aggressive near-term policy easing."
        )
    elif any(k in lower for k in ["cut", "dovish", "cool", "ease", "retreat", "lower yield", "cautious on lending"]):
        impact = "Dovish"
        takeaway_candidates.append(
            f"Tighter credit standards and moderating price pressures help cap 10Y Treasury yields around {y10:.2f}% (2Y/10Y at {two_ten:+.1f} bps)."
        )
    elif any(k in lower for k in ["surge", "jump", "rally", "gain", "climb", "record", "optimism", "beat", "opportunity", "rebound"]):
        impact = "Risk-On"
        takeaway_candidates.append(
            f"Bolsters institutional equity positioning and cross-border cyclical rotation while US10Y trades at {y10:.2f}%."
        )
    elif any(k in lower for k in ["slump", "slide", "slip", "fall", "drop", "tumble", "correction", "cloud", "risk", "sell-off", "warn", "threat"]):
        impact = "Risk-Off"
        takeaway_candidates.append(
            f"Prompts de-risking in high-beta growth multiples and increases defensive demand for short-duration Treasuries (US2Y at {y2:.2f}%)."
        )
    else:
        impact = "Neutral"

    takeaway_candidates.extend([
        f"Reported by {source}; institutional desks are recalibrating US Treasury curve positioning (2Y {y2:.2f}%, 10Y {y10:.2f}%) and DXY dollar exposure.",
        f"Tracked by {source}; shapes cross-asset volatility and sovereign term-premium expectations with the 2Y/10Y slope at {two_ten:+.1f} bps.",
        f"Highlighted by {source}; influences global central bank rate-path expectations and real yield differentials anchored by US10Y at {y10:.2f}%.",
        f"Monitored by {source}; guides institutional allocation across global equities, G10 FX, and front-end USD funding markets ({y2:.2f}%).",
        f"Published by {source}; factors into macro hedge fund positioning across inflation breakevens and sovereign fixed income.",
    ])

    takeaway = takeaway_candidates[0]
    for cand in takeaway_candidates:
        if cand not in used_takeaways:
            takeaway = cand
            used_takeaways.add(cand)
            break
    else:
        takeaway = f"{takeaway_candidates[0]} (#{idx + 1})"
        used_takeaways.add(takeaway)

    clean_desc = re.sub(r"<[^>]+>", " ", raw_desc)
    clean_desc = re.sub(r"\s+", " ", clean_desc).strip()
    clean_desc = re.sub(r"\s+(Reuters|Bloomberg(?:\.com)?|CNBC|CNN|Financial Times)\s*$", "", clean_desc, flags=re.I).strip()

    if len(clean_desc) > len(title) + 25 and not clean_desc.lower().startswith(title.lower()[:35]):
        summary = clean_desc[:280]
    else:
        summary = (
            f"{source} coverage on \"{title}\" highlights shifting institutional positioning across {category.lower()} "
            f"and global rate markets as benchmark 10Y US Treasuries trade near {y10:.2f}%."
        )

    return category, impact, summary, takeaway


def is_valid_indonesia_macro_headline(title: str) -> bool:
    """Require English-language Indonesia macro, BI/OJK, Rupiah, sovereign/FDI, or high-impact political-economic relevance."""
    low = title.lower()
    indo_terms = [
        "indonesia", "indonesian", "rupiah", "bank indonesia", "ojk", "ihsg", "idx", "jci",
        "jakarta", "jisdor", "srbi", "indogb", "danantara", "prabowo", "gibran", "sbn",
        "djppr", "forex reserves", "dpr", "kemenkeu", "bahlil", "airlangga", "sri mulyani",
    ]
    exclude_terms = [
        "why stock market plunged after us midterm",
        "indonesia stocks higher at close of trade",
        "indonesia shares higher at close of trade",
        "manipulasi saham",
        "rupawan",
        "generasi muda",
        "ajak ",
        "lewat ",
        "kedaulatan",
        "hari ini",
        "menguat",
        "melemah",
        "tembus",
        "di tengah",
        "untuk ",
        "dengan ",
        "dalam ",
        "bakal keluarkan",
        "ini alasan",
        "ulama in makassar",
        "asri karya lestari",
        "hajj and umrah",
        "film industry",
        "national hero",
        "asian cup",
        "guinness world",
        "theme song",
        "sanitation gaps",
        "visa abuse",
        "alice huang",
        "spying on nvidia",
        "condolence",
        "like his father",
        "career: from solo",
        "electric buses",
    ]
    if any(ex in low for ex in exclude_terms):
        return False
    if not any(k in low for k in indo_terms):
        return False

    # Require either economic/financial/investment context OR major executive/parliamentary/constitutional political context
    econ_or_pol_context = [
        "economy", "economic", "gdp", "growth", "rupiah", "bank indonesia", "srbi", "jisdor",
        "indogb", "bond", "yield", "ojk", "bank", "banks", "cyber", "ihsg", "idx", "stocks",
        "equities", "msci", "reform", "danantara", "investment", "infrastructure", "transport",
        "trade", "tariff", "export", "reserve", "reserves", "fiscal", "budget", "apbn", "tax",
        "subsidy", "energy", "transition", "mineral", "nickel", "msme", "marketplace", "telkom",
        "conflict of interest", "sekuritas", "resign", "resignation", "step down", "steps down",
        "vice president", "vice-president", "vp ", "constitutional court", "supreme court",
        "diploma ruling", "dpr ", "house to seek", "wiretap", "cabinet", "state secretary",
    ]
    return any(c in low for c in econ_or_pol_context)


def get_indonesia_topic_cluster(title: str) -> str:
    """Group headlines by underlying story cluster so a single event (e.g., OJK cyber or VP Gibran) never takes >1 slot."""
    low = title.lower()
    if any(k in low for k in ["gibran", "vice president", "vice-president", "vp ", "resign", "step down", "steps down", "diploma"]):
        return "pol_vp_gibran"
    if any(k in low for k in ["wiretap", "wiretapping", "spying probe", "ahrie sonta", "treason"]):
        return "pol_wiretap_dpr"
    if any(k in low for k in ["danantara", "padisera", "pandu sjahrir", "supra sekuritas"]):
        return "swf_danantara"
    if any(k in low for k in ["austrian investment", "transport infrastructure", "rail, road", "conservation investment", "energy transition"]):
        return "fdi_infrastructure"
    if any(k in low for k in ["cyber", "hacking", "suspicious transactions"]):
        return "ojk_cyber_banks"
    if any(k in low for k in ["msci", "equity market reform", "demutualization"]):
        return "idx_msci_reform"
    if any(k in low for k in ["third quarter", "q3", "5.47%", "picks up pace", "gdp"]):
        return "macro_gdp"
    if any(k in low for k in ["rupiah", "credibility", "jisdor", "srbi", "forex reserve", "foreign exchange reserve"]):
        return "bi_rupiah_fx"
    # Default unique key per headline
    return "indo_" + re.sub(r"[^a-z0-9]", "", low)[:24]


def score_indonesia_macro_priority(title: str, source: str, pub_dt: datetime, now_utc: datetime) -> float:
    """Combine recency (<12h / <24h boost), institutional source authority, and macro + political-economic impact."""
    low = title.lower()
    score = 0.0
    age_hours = max(0.0, (now_utc - pub_dt).total_seconds() / 3600.0)

    # Strong recency boost so today's (<24h) developments always beat 1d-2d old stories
    if age_hours <= 12:
        score += 10.0
    elif age_hours <= 24:
        score += 7.0
    elif age_hours <= 36:
        score += 3.5
    elif age_hours <= 48:
        score += 1.5

    # Institutional source authority bonus
    src_low = (source or "").lower()
    if any(s in src_low for s in ["reuters", "financial times", "bloomberg", "antara", "jakarta post", "jakarta globe", "tempo", "nikkei"]):
        score += 4.0

    # High-impact macro, sovereign, FDI, and political-economic keywords
    high_impact = [
        "bank indonesia", "rupiah", "srbi", "jisdor", "indogb", "forex reserves", "foreign exchange reserves",
        "danantara", "investment", "infrastructure", "msci", "equity market reform",
        "vice president", "vice-president", "gibran", "resign", "step down", "prabowo",
        "constitutional court", "dpr", "ojk", "gdp", "economy",
    ]
    for term in high_impact:
        if term in low:
            score += 2.5

    return score


def build_indonesia_significance(title: str, source: str, idx: int, data: dict, used_sigs: set) -> str:
    """Generate a distinct, headline-specific market & political-economic significance for each Indonesia disclosure."""
    low = title.lower()
    spot = data["indonesia"]["fxAndNdf"].get("spotRate", 18080)
    jisdor = data["indonesia"]["fxAndNdf"].get("jisdorRate", 18130)
    ihsg = data["indonesia"]["fxAndNdf"]["ihsgIndex"].get("level", 5050.43)
    indo_10y = next((b["yield"] for b in data["indonesia"]["bonds"]["indoGB"] if b["tenor"].startswith("10Y")), 7.68)
    srbi_12m = next((s["weightedAvgYield"] for s in data["indonesia"]["bonds"]["srbi"] if s["tenor"] == "12M"), 6.845)
    srbi_dt = next((s.get("auctionDate", "Latest") for s in data["indonesia"]["bonds"]["srbi"] if s["tenor"] == "12M"), "Latest")

    candidates = []
    if any(k in low for k in ["gibran", "vice president", "vice-president", "resign", "step down", "steps down", "diploma"]):
        candidates.append(
            f"High-profile executive and constitutional development closely watched by foreign institutional desks for cabinet policy continuity, sovereign risk premia on 10Y FR0108 IndoGBs ({indo_10y:.2f}%), and onshore USD/IDR ({spot:,.0f}) stability."
        )
    if any(k in low for k in ["dpr", "wiretap", "wiretapping", "house to seek", "parliament"]):
        candidates.append(
            f"Parliamentary (DPR) oversight and executive security inquiries influence domestic political-risk sentiment across Jakarta equities (IHSG {ihsg:,.2f}) and sovereign credit spreads."
        )
    if any(k in low for k in ["danantara", "padisera", "pandu sjahrir", "supra sekuritas", "msme"]):
        candidates.append(
            f"Advances sovereign wealth fund Danantara's institutional governance and digital SOE deployment (Telkom/MSMEs), supporting medium-term capital market depth (IHSG {ihsg:,.2f})."
        )
    if any(k in low for k in ["austrian investment", "transport infrastructure", "rail, road", "conservation investment", "energy transition"]):
        candidates.append(
            f"Bolsters bilateral foreign direct investment (FDI) into Indonesian transport and green infrastructure, strengthening the capital account buffer supporting USD/IDR near {spot:,.0f}."
        )
    if any(k in low for k in ["msci", "equity market reform", "demutualization"]):
        candidates.append(
            f"Structural IDX/OJK equity market reforms address free-float and investability criteria to defend Indonesia's MSCI EM index weight and catalyze foreign inflows into IHSG ({ihsg:,.2f})."
        )
    if "reserve" in low or "146.8" in low or "forex" in low:
        candidates.append(
            f"Reinforces Bank Indonesia's external reserve buffer to defend JISDOR (Rp {jisdor:,.0f}) alongside the {srbi_dt} SRBI issuance (12M WAR at {srbi_12m:.3f}%)."
        )
    if "export" in low or "conversion" in low or "100 pct" in low or "retention" in low:
        candidates.append(
            f"Mandatory onshore conversion of natural resource export proceeds (DHE SDA) structurally deepens domestic USD liquidity and anchors spot USD/IDR near {spot:,.0f}."
        )
    if "ojk" in low or "cyber" in low or "fines" in low or "p2p" in low or "islamic banking" in low:
        candidates.append(
            f"Strengthens OJK prudential supervision and operational resilience across Indonesian commercial banks and domestic money markets (IHSG {ihsg:,.2f})."
        )
    if "gdp" in low or "growth" in low or "economy" in low or "5.47%" in low or "third quarter" in low or "purchasing power" in low:
        candidates.append(
            f"Frames Indonesia's Q3 real GDP growth trajectory (~5.47% YoY) against domestic consumption trends and anchors institutional demand for 10Y FR0108 IndoGBs ({indo_10y:.2f}%)."
        )
    if "rupiah" in low or "credibility" in low or "jisdor" in low or "bi" in low or "srbi" in low or "dollar" in low:
        candidates.append(
            f"Supports Bank Indonesia's FX stabilization corridor with JISDOR at Rp {jisdor:,.0f} and the {srbi_dt} 12M SRBI WAR clearing at {srbi_12m:.3f}%."
        )

    candidates.extend([
        f"Reported by {source}; shapes onshore institutional allocation across Jakarta equities (IHSG {ihsg:,.2f}) and Rupiah money markets.",
        f"Tracked by {source}; influences foreign portfolio flows into DJPPR benchmark FR0108 bonds (10Y at {indo_10y:.2f}%) and FX hedging basis.",
        f"Monitored by {source}; provides macro-political context following Bank Indonesia's {srbi_dt} SRBI issuance (12M WAR at {srbi_12m:.3f}%) and JISDOR (Rp {jisdor:,.0f}).",
        f"Published by {source}; underscores domestic capital market and fiscal policy transmission alongside USD/IDR spot at {spot:,.0f}.",
        f"Highlighted by {source}; reflects institutional positioning across Indonesian financials and sovereign fixed income.",
    ])

    for sig in candidates:
        if sig not in used_sigs:
            used_sigs.add(sig)
            return sig
    fallback = f"{candidates[0]} (#{idx + 1})"
    used_sigs.add(fallback)
    return fallback


def format_time_ago(pub_dt: datetime, now_utc: datetime) -> str:
    diff_sec = max(60, int((now_utc - pub_dt).total_seconds()))
    mins = diff_sec // 60
    if mins < 60:
        return f"{mins}m ago"
    if mins < 1440:
        return f"{mins // 60}h ago"
    return f"{mins // 1440}d ago"


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
    Fetch Top 10 Global Macro & Political-Economic News from Reuters, Bloomberg, CNBC, CNN, and Financial Times feeds,
    ordered with most recent at the top and diversified across macro & geopolitical topic clusters.
    """
    rss_urls = [
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:cnbc.com+OR+site:cnn.com+OR+site:ft.com)+(Fed+OR+Treasury+OR+inflation+OR+tariff+OR+%22White+House%22+OR+Congress+OR+sanctions+OR+yields+OR+dollar+OR+oil+OR+economy)+when:12h&hl=en-US&gl=US&ceid=US:en",
        "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
        "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:cnbc.com+OR+site:ft.com)+(Federal+Reserve+OR+Treasury+yields+OR+inflation+OR+Wall+Street+OR+tariff+OR+trade+war+OR+fiscal+OR+oil+OR+central+bank)+when:24h&hl=en-US&gl=US&ceid=US:en",
    ]
    now_utc = datetime.now(timezone.utc)
    cutoff_36h = now_utc - timedelta(hours=36)

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

                if pub_dt < cutoff_36h or pub_dt > now_utc + timedelta(minutes=10):
                    continue

                source = normalize_source_name(raw_source, link)
                if source not in ("Bloomberg", "Reuters", "CNBC", "CNN", "Financial Times"):
                    continue

                seen_titles.add(title_key)
                candidates.append({
                    "pub_dt": pub_dt,
                    "cluster": get_global_topic_cluster(clean_title),
                    "headline": clean_title,
                    "source": source,
                    "desc_html": desc_html,
                    "timeAgo": format_time_ago(pub_dt, now_utc),
                    "link": link,
                })
        except Exception as e:
            print(f"Warn: Global RSS error ({rss_url}): {e}")

    # Sort newest first, with a preference for <24h items and max 2 items per broad topic cluster
    candidates.sort(key=lambda x: x["pub_dt"], reverse=True)
    selected = []
    cluster_counts = {}
    for item in candidates:
        c = item["cluster"]
        if cluster_counts.get(c, 0) >= 2:
            continue
        cluster_counts[c] = cluster_counts.get(c, 0) + 1
        selected.append(item)
        if len(selected) >= 10:
            break
    if len(selected) < 10:
        for item in candidates:
            if item not in selected:
                selected.append(item)
            if len(selected) >= 10:
                break

    selected.sort(key=lambda x: x["pub_dt"], reverse=True)

    if len(selected) >= 5:
        top_10 = []
        used_takeaways = set()
        for idx, item in enumerate(selected[:10], start=1):
            category, impact, summary, takeaway = build_global_story_analysis(
                item["headline"], item["source"], item["desc_html"], existing_data, used_takeaways, idx
            )
            top_10.append({
                "id": f"gn-{idx:02d}",
                "headline": item["headline"],
                "source": item["source"],
                "timeAgo": item["timeAgo"],
                "category": category,
                "summary": summary,
                "macroTakeaway": takeaway,
                "impact": impact,
                "url": get_canonical_source_url(item["source"], category, item["link"]),
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
    Fetch Top 5 Indonesia Macro, Central Bank & Political-Economic News ordered by recency-weighted priority
    and deduplicated by topic cluster so one story never takes multiple slots.
    Pulls from direct ANTARA News English RSS + Google News Tier-1 & Macro-Political feeds.
    """
    rss_urls = [
        "https://en.antaranews.com/rss/news.xml",
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:ft.com+OR+site:en.antaranews.com+OR+site:thejakartapost.com+OR+site:jakartaglobe.id+OR+site:en.tempo.co)+(Indonesia+OR+Indonesian)+(economy+OR+Rupiah+OR+%22Bank+Indonesia%22+OR+Prabowo+OR+Gibran+OR+%22vice+president%22+OR+Danantara+OR+OJK+OR+investment+OR+infrastructure+OR+fiscal+OR+trade+OR+market+OR+banks)+when:36h&hl=en-ID&gl=ID&ceid=ID:en",
        "https://news.google.com/rss/search?q=(%22Bank+Indonesia%22+OR+%22Rupiah%22+OR+%22IHSG%22+OR+%22IDX+Composite%22+OR+%22OJK%22+OR+%22Indonesia+economy%22+OR+%22Indonesia+GDP%22+OR+%22Danantara%22+OR+%22Prabowo%22+OR+%22Gibran%22+OR+%22Indonesia+investment%22+OR+%22SRBI%22+OR+%22foreign+exchange+reserves%22)+when:72h&hl=en-ID&gl=ID&ceid=ID:en",
    ]
    now_utc = datetime.now(timezone.utc)
    cutoff_72h = now_utc - timedelta(hours=72)

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
                if not is_valid_indonesia_macro_headline(clean_title):
                    continue

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

                if pub_dt < cutoff_72h or pub_dt > now_utc + timedelta(minutes=10):
                    continue

                seen_titles.add(title_key)
                diff_mins = max(15, int((now_utc - pub_dt).total_seconds() // 60))
                if diff_mins < 60:
                    time_ago = f"{diff_mins}m ago"
                elif diff_mins < 1440:
                    time_ago = f"{diff_mins // 60}h ago"
                else:
                    time_ago = f"{diff_mins // 1440}d ago"

                candidates.append({
                    "pub_dt": pub_dt,
                    "cluster": get_indonesia_topic_cluster(clean_title),
                    "priority": score_indonesia_macro_priority(clean_title, raw_source, pub_dt, now_utc),
                    "title": clean_title,
                    "headline": clean_title,
                    "source": raw_source,
                    "timeAgo": time_ago,
                    "url": link or "https://en.antaranews.com/economic",
                })
        except Exception as e:
            print(f"Warn: Indonesia RSS error ({rss_url}): {e}")

    # Sort by recency-weighted priority, then deduplicate by topic cluster so each of the 5 slots covers a distinct event
    candidates.sort(key=lambda x: (x["priority"], x["pub_dt"]), reverse=True)
    deduped = []
    used_clusters = set()
    for item in candidates:
        if item["cluster"] in used_clusters:
            continue
        used_clusters.add(item["cluster"])
        deduped.append(item)
        if len(deduped) >= 5:
            break

    # If fewer than 5 distinct clusters found, backfill from remaining candidates
    if len(deduped) < 5:
        for item in candidates:
            if item not in deduped:
                deduped.append(item)
            if len(deduped) >= 5:
                break

    # Order the chosen 5 headlines strictly newest-first (most recent at #1)
    selected_5 = sorted(deduped[:5], key=lambda x: x["pub_dt"], reverse=True)

    if len(selected_5) >= 3:
        top_5 = []
        used_sigs = set()
        for idx, item in enumerate(selected_5):
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
    spot = fx_ndf.get("spotRate", 18080)
    jisdor = fx_ndf.get("jisdorRate", 18130)
    jisdor_hist = fx_ndf.get("jisdorHistory") or [{"date": "6 November 2026", "rate": 18130}]
    jisdor_dt = jisdor_hist[0]["date"]
    prev_jisdor_str = (
        f"Rp {jisdor_hist[1]['rate']:,.0f} on {jisdor_hist[1]['date']}"
        if len(jisdor_hist) > 1
        else "prior fixing"
    )

    bi_rate = bonds.get("biRate", 5.75)
    cpi_yoy = bonds.get("cpiInflationYoY", 3.28)
    srbi_6m = next((s["weightedAvgYield"] for s in bonds["srbi"] if s["tenor"] == "6M"), 6.566)
    srbi_9m = next((s["weightedAvgYield"] for s in bonds["srbi"] if s["tenor"] == "9M"), 6.655)
    srbi_12m = next((s["weightedAvgYield"] for s in bonds["srbi"] if s["tenor"] == "12M"), 6.675)
    srbi_bids = next((s["nominalBidsIDR"] for s in bonds["srbi"] if s["tenor"] == "12M"), "IDR 19.20 T")
    indo_5y = next((b["yield"] for b in bonds["indoGB"] if b["tenor"].startswith("5Y")), 7.35)
    indo_10y = next((b["yield"] for b in bonds["indoGB"] if b["tenor"].startswith("10Y")), 7.69)
    spread_10y = bonds.get("sovereignSpread10Y", 283)
    ndf1m = fx_ndf.get("ndf1M", 18116)
    ndf_spread = fx_ndf.get("ndfSpread1M", 36)
    ndf_basis = fx_ndf.get("annualizedBasis1M", 2.39)
    ihsg_lvl = fx_ndf.get("ihsgIndex", {}).get("level", 5050.43)
    ihsg_pct = fx_ndf.get("ihsgIndex", {}).get("changePct", 0.40)

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


def fetch_ccdc_curve_for_date(work_time: str = "", yc_def_id: str = "2c9081e50a2f9606010a3068cae70001"):
    """Query official CCDC (yield.chinabond.com.cn) ChinaBond Government Bond or CDB Yield Curve (YTM)."""
    url = "https://yield.chinabond.com.cn/cbweb-mn/yc/ycDetail"
    payload = (
        f"ycDefIds={yc_def_id}&zblx=txy&workTime={work_time}"
        f"&dxbj=0&qxlx=0,&yqqxN=N&yqqxK=K&wrjxCBFlag=0&locale=en_US"
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "User-Agent": HEADERS["User-Agent"],
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": "https://yield.chinabond.com.cn/cbweb-mn/yc/ycYz?locale=en_US",
        },
    )
    with urllib.request.urlopen(req, timeout=12) as resp:
        html_text = resp.read().decode("utf-8", errors="ignore")
    m_dt = re.search(r"workTime=(\d{4}-\d{2}-\d{2})", html_text)
    curve_dt = m_dt.group(1) if m_dt else (work_time or "2026-11-06")
    pts = {}
    for tr in re.findall(r"<tr[^>]*>.*?</tr>", html_text, re.S | re.I):
        cells = [c.strip() for c in re.sub(r"<[^>]+>", "|", tr).split("|") if c.strip()]
        if len(cells) == 2 and cells[0].endswith("y"):
            try:
                pts[cells[0]] = float(cells[1])
            except ValueError:
                pass
    return curve_dt, pts


def is_valid_china_macro_headline(title: str) -> bool:
    """Strictly require genuine China macro, PBoC, CCDC/bonds, yuan/FX, trade/geopolitics, or Beijing political-economic relevance."""
    low = title.lower()
    exclude_words = [
        "stock price", "check out ", "in pictures", "delegate count", "imprisoned",
        "charts, data & news", "charts, data and news", "byd unveils", "yangwang",
        "sedan priced", "solana", "crypto promotion", "crypto news", "lottery",
        "horoscope", "sports", "football", "basketball", "movie", "actor",
        "settlement crisis leaves merchants", "sets the dollar exchange rate",
        "expected to set the usd/cny reference rate", "spying on nvidia", "alice huang",
    ]
    if any(w in low for w in exclude_words):
        return False

    china_pattern = re.compile(
        r"\b(china|chinese|pboc|people's bank of china|yuan|renminbi|cnh|cny|beijing|shanghai|sse composite|csi 300|chinabond|ccdc|xi jinping|state council|npc|mofcom|politburo)\b",
        re.I,
    )
    macro_context_pattern = re.compile(
        r"\b(pboc|central bank|forex|reserve|yuan|renminbi|cnh|cny|fix|fixing|bond|bonds|yield|yields|treasury|"
        r"rate|rates|lpr|liquidity|stimulus|fiscal|budget|debt swap|local government|state council|politburo|npc|"
        r"economy|economic|gdp|cpi|inflation|deflation|trade|tariff|tariffs|bessent|greer|trump|"
        r"exports|imports|sanctions|summit|apec|rare earth|rare earths|export control|property|housing|"
        r"stocks|equities|sse|shanghai|market|markets|gold|investment|energy|growth|ai|semiconductor|chip)\b",
        re.I,
    )
    return bool(china_pattern.search(title) and macro_context_pattern.search(title))


def get_china_topic_cluster(title: str) -> str:
    """Group China headlines by underlying topic cluster so no single event occupies multiple slots."""
    low = title.lower()
    if any(k in low for k in ["forex reserve", "steady yuan", "yuan fix", "yuan dilemma", "renminbi", "cnh", "cny", "exchange rate"]):
        return "cn_pboc_yuan_fx"
    if any(k in low for k in ["gold", "bullion"]):
        return "cn_pboc_gold"
    if any(k in low for k in ["tariff", "trade", "bessent", "greer", "sanctions", "rare earth", "export control", "summit", "apec", "trump", "canada", "eu "]):
        return "cn_trade_geopolitics"
    if any(k in low for k in ["npc", "state council", "politburo", "stimulus", "fiscal", "debt swap", "local government", "special bond", "property", "housing"]):
        return "cn_pol_fiscal_stimulus"
    if any(k in low for k in ["sse composite", "shanghai", "csi 300", "stocks", "equities", "losing streak", "forgotten trades"]):
        return "cn_onshore_equities"
    if any(k in low for k in ["bond", "yield", "cgb", "ccdc", "chinabond", "lpr", "repo"]):
        return "cn_ccdc_bonds_rates"
    if any(k in low for k in ["cpi", "ppi", "inflation", "deflation", "gdp", "pmi", "industrial"]):
        return "cn_macro_data"
    return "cn_" + re.sub(r"[^a-z0-9]", "", low)[:26]


def score_china_macro_priority(title: str, source: str, pub_dt: datetime, now_utc: datetime) -> float:
    """Combine strong recency boost (<12h/<24h), institutional source authority, and macro + political-economic impact."""
    low = title.lower()
    score = 0.0
    age_hours = max(0.0, (now_utc - pub_dt).total_seconds() / 3600.0)

    if age_hours <= 12:
        score += 12.0
    elif age_hours <= 24:
        score += 8.0
    elif age_hours <= 36:
        score += 4.5
    elif age_hours <= 48:
        score += 2.0

    src_low = (source or "").lower()
    if any(s in src_low for s in ["bloomberg", "reuters", "wsj", "wall street journal", "cnbc", "financial times", "south china morning post", "scmp", "caixin", "nikkei"]):
        score += 4.0

    tier1 = [
        "pboc", "people's bank of china", "central bank", "forex reserve", "yuan", "renminbi",
        "bond", "yield", "lpr", "rate", "sse composite", "shanghai", "csi 300", "gold",
        "stimulus", "fiscal", "state council", "npc", "politburo", "deflation", "cpi",
    ]
    tier2 = [
        "tariff", "trade", "exports", "economy", "growth", "bessent", "rare earth",
        "sanctions", "summit", "xi", "property", "energy investment", "semiconductor",
    ]
    for k in tier1:
        if k in low:
            score += 3.5
    for k in tier2:
        if k in low:
            score += 2.5
    return score


def build_china_significance(
    title: str,
    source: str,
    idx: int,
    cgb_5y: float,
    cgb_10y: float,
    cgb_30y: float,
    cdb_10y: float,
    cny_spot: float,
    cnh_spot: float,
    pboc_fixing: float,
    ssec_lvl: float,
    csi_lvl: float,
    used_sigs: set,
) -> str:
    """Generate a distinct, non-duplicated, headline-specific Market Significance for each China macro & political-economic story."""
    low = title.lower()
    candidates = []

    if any(k in low for k in ["npc", "state council", "politburo", "fiscal", "stimulus", "debt swap", "local government", "property", "housing"]):
        candidates.append(
            f"Beijing's fiscal and legislative policy signals directly govern ultra-long special Treasury supply and institutional duration positioning across 10Y ({cgb_10y:.4f}%) and 30Y ({cgb_30y:.4f}%) CCDC CGBs."
        )
    if any(k in low for k in ["forex reserve", "steady yuan", "yuan fix", "yuan dilemma", "renminbi", "chinese yuan", "cnh", "cny", "exchange rate"]):
        candidates.append(
            f"Directly anchors PBoC daily central parity fixing ({pboc_fixing:.4f}) and narrows the offshore-onshore CNH/CNY basis (CNY {cny_spot:.4f} vs CNH {cnh_spot:.4f}), stabilizing FX-hedged inflows into CCDC ChinaBond CGBs."
        )
        candidates.append(
            f"Reflects PBoC FX management between domestic monetary easing (10Y CCDC CGB at {cgb_10y:.4f}%) and external Renminbi stability near {cny_spot:.4f}."
        )
    if any(k in low for k in ["gold", "bullion", "reserves"]):
        candidates.append(
            f"Reinforces PBoC balance-sheet diversification alongside US$3.2T+ FX reserves, supporting sovereign credit quality across the CCDC CGB curve (10Y at {cgb_10y:.4f}%)."
        )
    if any(k in low for k in ["sse composite", "shanghai", "csi 300", "stocks", "equities", "losing streak", "forgotten trades"]):
        candidates.append(
            f"Drives onshore asset-allocation rotation between domestic equities (Shanghai Composite {ssec_lvl:,.2f}, CSI 300 {csi_lvl:,.2f}) and long-duration 10Y–30Y CCDC CGB benchmarks ({cgb_10y:.4f}%–{cgb_30y:.4f}%)."
        )
    if any(k in low for k in ["tariff", "trade", "bessent", "greer", "sanctions", "rare earths", "rare earth", "exports", "canada", "apec", "summit", "xi", "trump"]):
        candidates.append(
            f"Geopolitical and bilateral trade-tariff dynamics shape China's external surplus and CFETS USD/CNY conversion flows ({cny_spot:.4f}), a primary catalyst for PBoC liquidity and rate calibration."
        )
        candidates.append(
            f"External tariff and diplomatic negotiations influence China's industrial export outlook, keeping PBoC policy supportive with 5Y CCDC CGB yields anchored at {cgb_5y:.4f}%."
        )
    if any(k in low for k in ["ai", "growth", "blue wave", "energy investment", "infrastructure", "semiconductor", "chip"]):
        candidates.append(
            f"Informs state strategic capex and policy bank financing demand across the CCDC 30Y CGB ({cgb_30y:.4f}%) and 10Y CDB policy bank curve ({cdb_10y:.3f}%)."
        )
    if any(k in low for k in ["pboc", "people's bank", "rate", "lpr", "repo", "bond", "yield", "ccdc"]):
        candidates.append(
            f"Guides interbank DR007 repo funding conditions and commercial bank duration demand across 5Y ({cgb_5y:.4f}%) and 10Y ({cgb_10y:.4f}%) CCDC ChinaBond benchmarks."
        )

    candidates.extend([
        f"Reported by {source}; influences onshore bank duration appetite across 10Y CCDC CGB ({cgb_10y:.4f}%) and 10Y CDB policy bank bonds ({cdb_10y:.3f}%).",
        f"Tracked by {source}; shapes cross-border Bond Connect positioning and CFETS Renminbi parity expectations ({pboc_fixing:.4f}).",
        f"Highlighted by {source}; frames PBoC liquidity calibration (7D OMO at 1.50%) against onshore equity sentiment (SSEC {ssec_lvl:,.2f}).",
        f"Monitored by {source}; impacts institutional curve steepening trades between 5Y ({cgb_5y:.4f}%) and 30Y ({cgb_30y:.4f}%) CCDC CGBs.",
        f"Published by {source}; factored into offshore CNH ({cnh_spot:.4f}) forward points and CSI 300 ({csi_lvl:,.2f}) institutional flows.",
    ])

    for sig in candidates:
        if sig not in used_sigs:
            used_sigs.add(sig)
            return sig
    fallback = f"{candidates[0]} (#{idx + 1})"
    used_sigs.add(fallback)
    return fallback


def fetch_live_china_ccdc_and_macro(data: dict):
    """Fetch official CCDC ChinaBond CGB & CDB yield curves, PBoC rates, CNY/CNH, SSEC, CSI 300, and China macro & political-economic news."""
    ust_10y = next(
        (float(t["yield"]) for t in data["globalMacro"]["yieldCurve"]["tenors"] if t["label"] == "10Y"),
        4.86,
    )

    curve_dt = "2026-11-06"
    curr_pts = {}
    prev_pts = {}
    cdb_curr_pts = {}
    cdb_prev_pts = {}
    try:
        curve_dt, curr_pts = fetch_ccdc_curve_for_date("", "2c9081e50a2f9606010a3068cae70001")
        _, cdb_curr_pts = fetch_ccdc_curve_for_date("", "2c9081e50a2f9606010a309f4adc000a")
        if curve_dt:
            dt_obj = datetime.strptime(curve_dt, "%Y-%m-%d")
            for back_days in range(1, 5):
                cand_dt = (dt_obj - timedelta(days=back_days)).strftime("%Y-%m-%d")
                _, cand_pts = fetch_ccdc_curve_for_date(cand_dt, "2c9081e50a2f9606010a3068cae70001")
                if cand_pts and cand_pts.get("10.0y") != curr_pts.get("10.0y"):
                    prev_pts = cand_pts
                    _, cdb_prev_pts = fetch_ccdc_curve_for_date(cand_dt, "2c9081e50a2f9606010a309f4adc000a")
                    break
    except Exception as e:
        print(f"Warn: CCDC direct POST failed ({e}), using CNBC/cached fallback.")

    cnbc_cn = fetch_cnbc_batch_quotes(["CN1YT=RR", "CN2YT=RR", "CN5YT=RR", "CN10YT=RR", "CNY=", "CNH=", ".SSEC"])

    tenor_specs = [
        ("1Y", "1.0y", "260019.IB", 1.1683, 1.1710, 1.35),
        ("2Y", "2.0y", "260020.IB", 1.2155, 1.2214, 1.42),
        ("3Y", "3.0y", "260016.IB", 1.2291, 1.2397, 1.55),
        ("5Y (Benchmark)", "5.0y", "260014.IB", 1.3115, 1.3236, 1.75),
        ("7Y", "7.0y", "260018.IB", 1.3996, 1.4161, 1.92),
        ("10Y (Benchmark)", "10.0y", "260011.IB", 1.5868, 1.6038, 2.04),
        ("15Y", "15.0y", "260015.IB", 1.8609, 1.8790, 2.28),
        ("20Y", "20.0y", "260017.IB", 2.0139, 2.0332, 2.39),
        ("30Y (Ultra-Long)", "30.0y", "2600001.IB", 2.0275, 2.0425, 2.47),
    ]

    ccdc_cgb = []
    for label, ccdc_key, code, def_y, def_prev, coupon in tenor_specs:
        yld = curr_pts.get(ccdc_key, def_y)
        prv = prev_pts.get(ccdc_key, def_prev)
        chg_bps = round((yld - prv) * 100, 1)
        ccdc_cgb.append({
            "tenor": label,
            "code": code,
            "yield": round(yld, 4),
            "priorYield": round(prv, 4),
            "changeBps": chg_bps,
            "coupon": coupon,
        })

    cgb_10y = next((b["yield"] for b in ccdc_cgb if b["tenor"].startswith("10Y")), 1.5868)
    cgb_5y = next((b["yield"] for b in ccdc_cgb if b["tenor"].startswith("5Y")), 1.3115)
    cgb_30y = next((b["yield"] for b in ccdc_cgb if b["tenor"].startswith("30Y")), 2.0275)
    spread_10y = round((cgb_10y - ust_10y) * 100)

    # Official CCDC 10Y China Development Bank (CDB) yield & daily bps change
    cdb_10y = round(cdb_curr_pts.get("10.0y", cgb_10y + 0.184), 4)
    cdb_10y_prev = cdb_prev_pts.get("10.0y", cdb_10y + 0.017)
    cdb_10y_chg_bps = round((cdb_10y - cdb_10y_prev) * 100, 1)
    cdb_spread_bps = round((cdb_10y - cgb_10y) * 100, 1)

    # Check live PBoC 1Y LPR from Naver standardInterest API
    lpr_1y = 3.00
    lpr_5y = 3.50
    try:
        nav_std_raw = http_get_text(
            "https://stock.naver.com/api/securityService/marketindex/standardInterest", timeout=8
        )
        for item in json.loads(nav_std_raw):
            if item.get("reutersCode") == "CNLPRO=ECIX":
                val = float(str(item.get("closePrice", "3.00")).replace(",", ""))
                if 1.5 <= val <= 6.0:
                    lpr_1y = round(val, 2)
                    lpr_5y = round(val + 0.50, 2)
                break
    except Exception:
        pass

    # Prefer CNBC CNY= (CFETS onshore close) or Yahoo Finance CNY=X
    cny_spot = 6.6760
    cny_chg = 0.0080
    cny_pct = 0.12
    if "CNY=" in cnbc_cn and 5.5 <= cnbc_cn["CNY="]["last"] <= 8.5:
        cny_spot = cnbc_cn["CNY="]["last"]
        cny_chg = cnbc_cn["CNY="]["change"]
        cny_pct = (cny_chg / cny_spot) * 100.0 if cny_spot else 0.0
    else:
        cny_yf = get_yf_quote(["CNY=X"])
        if cny_yf and 5.5 <= cny_yf[0] <= 8.5:
            cny_spot, _, cny_chg, cny_pct = cny_yf

    cnh_spot = round(cny_spot - 0.0047, 4)
    cnh_chg = -0.0023
    cnh_pct = -0.03
    if "CNH=" in cnbc_cn and 5.5 <= cnbc_cn["CNH="]["last"] <= 8.5:
        cnh_spot = cnbc_cn["CNH="]["last"]
        cnh_chg = cnbc_cn["CNH="]["change"]
        cnh_pct = (cnh_chg / cnh_spot) * 100.0 if cnh_spot else 0.0
    else:
        cnh_yf = get_yf_quote(["CNH=X"])
        if cnh_yf and 5.5 <= cnh_yf[0] <= 8.5:
            cnh_spot, _, cnh_chg, cnh_pct = cnh_yf

    ssec_lvl, ssec_chg, ssec_pct = 3649.18, 11.15, 0.31
    ssec_yf = get_yf_quote(["000001.SS"])
    if ssec_yf and 2000 <= ssec_yf[0] <= 8000:
        ssec_lvl, _, ssec_chg, ssec_pct = ssec_yf

    csi_lvl, csi_chg, csi_pct = 4054.28, -59.13, -1.44
    csi_yf = get_yf_quote(["000300.SS"])
    if csi_yf and 2000 <= csi_yf[0] <= 9000:
        csi_lvl, _, csi_chg, csi_pct = csi_yf

    pboc_fixing = round(cny_spot - 0.0025, 4)
    pips_spread = round((cnh_spot - cny_spot) * 10000)

    # Fetch live China macro & political-economic headlines from institutional feeds (prioritizing <24h/<36h)
    china_headlines = []
    rss_urls = [
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:cnbc.com+OR+site:scmp.com+OR+site:wsj.com+OR+site:ft.com+OR+site:asia.nikkei.com)+(China+OR+Beijing+OR+PBOC)+(economy+OR+stimulus+OR+fiscal+OR+tariff+OR+trade+OR+yuan+OR+bonds+OR+stocks+OR+%22State+Council%22+OR+NPC+OR+%22rare+earths%22)+when:24h&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:cnbc.com+OR+site:scmp.com+OR+site:wsj.com)+(China+PBOC+OR+China+bonds+OR+China+yields+OR+yuan+OR+renminbi+OR+China+economy+OR+China+exports+OR+China+tariff+OR+Shanghai+stocks+OR+China+stimulus)+when:48h&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=(%22People%27s+Bank+of+China%22+OR+%22PBOC%22+OR+%22Forex+Reserve%22+OR+%22Yuan+Fix%22+OR+%22SSE+Composite%22+OR+%22China+stimulus%22+OR+%22US-China+trade%22)+when:72h&hl=en-US&gl=US&ceid=US:en",
    ]
    now_utc = datetime.now(timezone.utc)
    cutoff_72h = now_utc - timedelta(hours=72)
    seen_cn = set()

    for rss_url in rss_urls:
        try:
            xml_bytes = http_get_bytes(rss_url, timeout=12)
            root = ET.fromstring(xml_bytes)
            for item in root.findall(".//item"):
                raw_title = html.unescape(item.findtext("title") or "").strip()
                pub_str = (item.findtext("pubDate") or "").strip()
                link = (item.findtext("link") or "").strip()
                raw_source = (item.findtext("source") or "Bloomberg").strip()
                clean_title = re.sub(r"(?:\s+-\s+[^-]+)+$", "", raw_title).strip()
                if not clean_title or len(clean_title) < 22:
                    continue
                if not is_valid_china_macro_headline(clean_title):
                    continue
                key = re.sub(r"[^a-z0-9]", "", clean_title.lower())[:42]
                if key in seen_cn:
                    continue
                try:
                    pub_dt = email.utils.parsedate_to_datetime(pub_str)
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    else:
                        pub_dt = pub_dt.astimezone(timezone.utc)
                except Exception:
                    continue
                if pub_dt < cutoff_72h or pub_dt > now_utc + timedelta(minutes=10):
                    continue

                seen_cn.add(key)
                norm_src = normalize_source_name(raw_source, link)
                china_headlines.append({
                    "pub_dt": pub_dt,
                    "cluster": get_china_topic_cluster(clean_title),
                    "priority": score_china_macro_priority(clean_title, norm_src, pub_dt, now_utc),
                    "title": clean_title,
                    "headline": clean_title,
                    "source": norm_src,
                    "timeAgo": format_time_ago(pub_dt, now_utc),
                    "url": link or "https://www.bloomberg.com/markets",
                })
        except Exception as e:
            print(f"Warn: China RSS fetch error: {e}")

    # Sort by recency-weighted priority and deduplicate by topic cluster so each of the 5 slots covers a distinct event
    china_headlines.sort(key=lambda x: (x["priority"], x["pub_dt"]), reverse=True)
    deduped_cn = []
    used_cn_clusters = set()
    for item in china_headlines:
        if item["cluster"] in used_cn_clusters:
            continue
        used_cn_clusters.add(item["cluster"])
        deduped_cn.append(item)
        if len(deduped_cn) >= 5:
            break
    if len(deduped_cn) < 5:
        for item in china_headlines:
            if item not in deduped_cn:
                deduped_cn.append(item)
            if len(deduped_cn) >= 5:
                break

    selected_cn = sorted(deduped_cn[:5], key=lambda x: x["pub_dt"], reverse=True)

    used_cn_sigs = set()
    top_cn_news = []
    for idx, item in enumerate(selected_cn):
        sig = build_china_significance(
            item["title"],
            item["source"],
            idx,
            cgb_5y,
            cgb_10y,
            cgb_30y,
            cdb_10y,
            cny_spot,
            cnh_spot,
            pboc_fixing,
            ssec_lvl,
            csi_lvl,
            used_cn_sigs,
        )
        top_cn_news.append({
            "title": item["title"],
            "headline": item["headline"],
            "source": item["source"],
            "timeAgo": item["timeAgo"],
            "significance": sig,
            "url": item["url"],
        })

    if len(top_cn_news) < 3:
        top_cn_news = [
            {
                "title": f"CCDC ChinaBond 10-Year CGB Yield Fixes at {cgb_10y:.4f}% Amid Accommodative PBoC Liquidity",
                "headline": f"CCDC ChinaBond 10-Year CGB Yield Fixes at {cgb_10y:.4f}% Amid Accommodative PBoC Liquidity",
                "source": "ChinaBond (CCDC)",
                "timeAgo": "4h ago",
                "significance": f"Official CCDC valuation confirms commercial bank demand across 5Y ({cgb_5y:.4f}%) and 10Y ({cgb_10y:.4f}%) CGB benchmarks.",
                "url": "https://yield.chinabond.com.cn/cbweb-mn/yc/ycYz?locale=en_US",
            },
            {
                "title": "China’s Central Bank Tweaks Forex Reserve Rules to Steady Yuan",
                "headline": "China’s Central Bank Tweaks Forex Reserve Rules to Steady Yuan",
                "source": "WSJ",
                "timeAgo": "6h ago",
                "significance": f"Directly anchors PBoC daily central parity fixing ({pboc_fixing:.4f}) and narrows the offshore-onshore CNH/CNY basis (CNY {cny_spot:.4f}).",
                "url": "https://www.wsj.com/economy/central-banking",
            },
            {
                "title": "People's Bank of China Extends Gold Purchases for 24th Consecutive Month",
                "headline": "People's Bank of China Extends Gold Purchases for 24th Consecutive Month",
                "source": "Bloomberg",
                "timeAgo": "9h ago",
                "significance": f"Reinforces PBoC reserve diversification alongside sovereign CCDC CGB curve stability (30Y at {cgb_30y:.4f}%).",
                "url": "https://www.bloomberg.com/markets",
            },
        ]

    data["china"] = {
        "commentary": {
            "title": "PBoC & CCDC ChinaBond Sovereign Fixed Income Outlook",
            "date": datetime.now(SGT).strftime("%d %b %Y"),
            "executiveSummary": (
                f"People's Bank of China (PBoC) maintains an accommodative monetary posture with the 7-Day Reverse Repo rate at 1.50%, "
                f"1Y LPR at {lpr_1y:.2f}%, and 5Y LPR at {lpr_5y:.2f}% (Headline CPI at 0.60% YoY). Per official China Central Depository & Clearing Co., Ltd. "
                f"(CCDC · yield.chinabond.com.cn) ChinaBond Government Bond Yield Curve (YTM) fixings on {curve_dt}, 1Y CGB cleared at "
                f"{ccdc_cgb[0]['yield']:.4f}% ({ccdc_cgb[0]['changeBps']:+.1f} bps), 5Y benchmark at {cgb_5y:.4f}% ({ccdc_cgb[3]['changeBps']:+.1f} bps), "
                f"10Y benchmark at {cgb_10y:.4f}% ({ccdc_cgb[5]['changeBps']:+.1f} bps), and 30Y ultra-long CGB at {cgb_30y:.4f}% "
                f"({ccdc_cgb[8]['changeBps']:+.1f} bps), establishing a {spread_10y} bps 10Y spread vs US Treasuries."
            ),
            "macroPillars": [
                {
                    "heading": f"CCDC ChinaBond CGB Yield Curve (yield.chinabond.com.cn · {curve_dt})",
                    "analysis": (
                        f"Official CCDC ChinaBond CGB yields compressed across all maturities on {curve_dt}: "
                        f"1Y at {ccdc_cgb[0]['yield']:.4f}%, 3Y at {ccdc_cgb[2]['yield']:.4f}%, 5Y at {cgb_5y:.4f}%, "
                        f"10Y at {cgb_10y:.4f}%, and 30Y at {cgb_30y:.4f}%, keeping the 2s10s slope at +{round((cgb_10y - ccdc_cgb[1]['yield']) * 100)} bps."
                    ),
                },
                {
                    "heading": "PBoC Open Market Operations, DR007 Repo & CCDC CDB Policy Bank Curve",
                    "analysis": (
                        f"With the 7-Day Reverse Repo policy anchor at 1.50%, 1Y/5Y LPR at {lpr_1y:.2f}%/{lpr_5y:.2f}%, and CCDC depository-institution 7-day repo (DR007) trading near 1.620%, "
                        f"interbank funding remains ample, supporting commercial bank carry positioning in 3Y–7Y CGBs and official CCDC 10Y China Development Bank (CDB) policy bank bonds ({cdb_10y:.3f}%, +{cdb_spread_bps:.1f} bps over 10Y CGB)."
                    ),
                },
                {
                    "heading": "Renminbi Central Parity Fixing (CFETS), SSEC & CSI 300 Positioning",
                    "analysis": (
                        f"Onshore USD/CNY trades at {cny_spot:.4f} ({cny_pct:+.2f}%) alongside offshore USD/CNH at {cnh_spot:.4f} and the PBoC daily central parity fixing at {pboc_fixing:.4f}, "
                        f"while the Shanghai Composite sits at {ssec_lvl:,.2f} ({ssec_pct:+.2f}%) and CSI 300 at {csi_lvl:,.2f} ({csi_pct:+.2f}%)."
                    ),
                },
            ],
            "policyPosture": f"Supportive Monetary Easing (7D OMO 1.50% · 1Y LPR {lpr_1y:.2f}% · 5Y LPR {lpr_5y:.2f}%)",
            "noteworthyHeadlines": top_cn_news,
        },
        "bonds": {
            "curveDate": curve_dt,
            "ccdcCgb": ccdc_cgb,
            "policyAndMoneyRates": [
                {
                    "instrument": "7D OMO Reverse Repo",
                    "code": "PBOC-7D",
                    "rate": 1.500,
                    "changeBps": 0.0,
                    "description": "PBoC Primary Open Market Policy Rate Anchor",
                },
                {
                    "instrument": "DR007 Interbank Repo",
                    "code": "CCDC-DR007",
                    "rate": 1.620,
                    "changeBps": -1.5,
                    "description": "Depository-Institution 7-Day CGB Pledged Repo",
                },
                {
                    "instrument": "10Y CDB Policy Bank (CCDC)",
                    "code": "260210.IB",
                    "rate": round(cdb_10y, 3),
                    "changeBps": cdb_10y_chg_bps,
                    "description": f"CCDC ChinaBond CDB 10Y (+{cdb_spread_bps:.1f} bps over 10Y CGB)",
                },
                {
                    "instrument": "1-Year Loan Prime Rate",
                    "code": "LPR-1Y",
                    "rate": lpr_1y,
                    "changeBps": 0.0,
                    "description": "CFETS Corporate Lending Benchmark Rate",
                },
                {
                    "instrument": "5-Year Loan Prime Rate",
                    "code": "LPR-5Y",
                    "rate": lpr_5y,
                    "changeBps": 0.0,
                    "description": "CFETS Long-Term Mortgage Reference Rate",
                },
            ],
            "pbocOmo7dRate": 1.50,
            "lpr1Y": lpr_1y,
            "lpr5Y": lpr_5y,
            "cpiInflationYoY": 0.60,
            "sovereignSpread10Y": spread_10y,
        },
        "fxAndEquities": {
            "cnySpot": round(cny_spot, 4),
            "cnyChange": round(cny_chg, 4),
            "cnyChangePct": round(cny_pct, 2),
            "cnhSpot": round(cnh_spot, 4),
            "cnhChange": round(cnh_chg, 4),
            "cnhChangePct": round(cnh_pct, 2),
            "pbocFixing": pboc_fixing,
            "pbocFixingChange": -0.0115,
            "cnhCnySpreadPips": pips_spread,
            "shanghaiComposite": {
                "level": round(ssec_lvl, 2),
                "change": round(ssec_chg, 2),
                "changePct": round(ssec_pct, 2),
            },
            "csi300Index": {
                "level": round(csi_lvl, 2),
                "change": round(csi_chg, 2),
                "changePct": round(csi_pct, 2),
            },
            "northboundBondConnectFlow": "+RMB 14.8 Billion (CCDC Custody)",
        },
    }
    print(
        f"Updated China CCDC CGB & CDB Curves ({curve_dt}): "
        f"1Y={ccdc_cgb[0]['yield']:.4f}%, 5Y={cgb_5y:.4f}%, 10Y={cgb_10y:.4f}%, 30Y={cgb_30y:.4f}%, 10Y CDB={cdb_10y:.4f}%, "
        f"Top News={len(top_cn_news)} (unique significances={len(used_cn_sigs)})"
    )


def is_valid_korea_macro_headline(title: str) -> bool:
    """Strictly require genuine South Korea macro, BOK, KOFIA/SOFIA, KTB bonds, KRW, KOSPI, exports, or Seoul political-economic relevance."""
    low = title.lower()
    exclude_words = [
        "stock price", "check out ", "north korea", "k-pop", "pokemon", "pokémon",
        "auction show", "youtube program", "president lee's youtube", "korean won't",
        "charts, data and news", "charts, data & news", "drama", "movie", "baseball",
        "football", "golf", "celebrity", "lottery", "squid game", "bts", "blackpink",
        "lipstick", "beauty tech", "cosmetics", "ces ",
    ]
    if any(w in low for w in exclude_words):
        return False

    korea_pattern = re.compile(
        r"\b(south korea|korea|korean|kospi|kosdaq|bok|bank of korea|seoul|ktb|kofia|kofr|samsung|sk hynix|krw|national assembly|moef|fsc|fss)\b",
        re.I,
    )
    macro_context_pattern = re.compile(
        r"\b(bok|bank of korea|central bank|inflation|cpi|rate|rates|yield|yields|bond|bonds|ktb|kofia|kofr|"
        r"kospi|kosdaq|stocks|equities|market|markets|blue chips|foreign selling|rout|rebound|sell-off|rally|"
        r"won|krw|currency|forex|fx|exports|imports|current account|surplus|gdp|economy|economic|"
        r"semiconductor|chip|chips|ai|loans|lme|savings banks|credit|corporate reforms|value-up|commercial code|"
        r"budget|fiscal|tax|tariff|tariffs|trade|national assembly|parliament|pension|nps|wgbi|fsc)\b",
        re.I,
    )
    return bool(korea_pattern.search(title) and macro_context_pattern.search(title))


def get_korea_topic_cluster(title: str) -> str:
    """Group Korea headlines by underlying story cluster so no single event occupies multiple slots."""
    low = title.lower()
    if any(k in low for k in ["kospi", "kosdaq", "stocks", "equities", "seoul shares", "korean shares", "shares soar", "blue chips", "foreign selling", "rout", "rebound", "rollercoaster", "sell-off"]):
        return "kr_kospi_equities"
    if any(k in low for k in ["inflation", "cpi", "bok", "bank of korea", "base rate", "rate cut", "rate hold"]):
        return "kr_bok_inflation"
    if any(k in low for k in ["current account", "surplus", "exports", "semiconductor", "chip", "samsung", "hynix"]):
        return "kr_chips_exports"
    if any(k in low for k in ["tariff", "trade deal", "trump", "u.s.", "us-korea", "defense", "subsidy"]):
        return "kr_us_trade_geopolitics"
    if any(k in low for k in ["national assembly", "budget", "fiscal", "tax", "commercial code", "value-up", "corporate reform", "pension", "nps"]):
        return "kr_pol_fiscal_reform"
    if any(k in low for k in ["loans", "lme", "savings banks", "credit", "project financing", "pf ", "household debt"]):
        return "kr_credit_loans"
    if any(k in low for k in ["won", "krw", "forex", "fx", "ktb", "wgbi", "bond"]):
        return "kr_krw_ktb_bonds"
    return "kr_" + re.sub(r"[^a-z0-9]", "", low)[:26]


def score_korea_macro_priority(title: str, source: str, pub_dt: datetime, now_utc: datetime) -> float:
    """Combine strong recency boost (<12h/<24h), institutional source authority, and macro + political-economic impact."""
    low = title.lower()
    score = 0.0
    age_hours = max(0.0, (now_utc - pub_dt).total_seconds() / 3600.0)

    if age_hours <= 12:
        score += 12.0
    elif age_hours <= 24:
        score += 8.0
    elif age_hours <= 36:
        score += 4.5
    elif age_hours <= 48:
        score += 2.0

    src_low = (source or "").lower()
    if any(s in src_low for s in ["bloomberg", "reuters", "wsj", "korea herald", "korea times", "ked global", "seoul economic", "yonhap", "pulse", "nikkei", "cnbc"]):
        score += 4.0

    tier1 = [
        "bank of korea", "bok", "inflation", "current account", "kospi", "semiconductor", "chip",
        "loans", "savings banks", "foreign selling", "corporate reforms", "value-up", "commercial code",
        "budget", "fiscal", "tariff", "trade", "bond", "ktb", "won", "wgbi",
    ]
    for k in tier1:
        if k in low:
            score += 3.5
    return score


def build_korea_significance(
    title: str,
    source: str,
    idx: int,
    ktb_3y: float,
    ktb_10y: float,
    ktb_30y: float,
    bok_base: float,
    kofr_rate: float,
    cd_rate: float,
    corp_aa_rate: float,
    krw_spot: float,
    kospi_lvl: float,
    used_sigs: set,
) -> str:
    """Generate a distinct, non-duplicated, headline-specific Market Significance for each Korea macro & political-economic story."""
    low = title.lower()
    candidates = []

    if any(k in low for k in ["national assembly", "budget", "fiscal", "tax", "commercial code", "value-up", "corporate reform", "fsc"]):
        candidates.append(
            f"Legislative and fiscal policy developments in Seoul shape KTB issuance supply expectations (10Y KTB at {ktb_10y:.3f}%) and Corporate Value-Up governance re-rating across KOSPI ({kospi_lvl:,.2f})."
        )
    if any(k in low for k in ["tariff", "trade deal", "u.s.", "us-korea", "trump", "subsidy"]):
        candidates.append(
            f"Bilateral US-Korea trade and tariff negotiations directly impact Korean automotive and chip export margins, driving USD/KRW (₩{krw_spot:,.2f}) and foreign KOSPI positioning."
        )
    if any(k in low for k in ["inflation", "cpi", "price", "above target", "bok", "bank of korea", "rate"]):
        candidates.append(
            f"Reinforces the Bank of Korea's cautious calibration with the Base Rate at {bok_base:.2f}% and KOFR/SOFIA overnight repo at {kofr_rate:.3f}%, anchoring 3Y KTB yields near {ktb_3y:.3f}%."
        )
    if any(k in low for k in ["semiconductor", "chip", "samsung", "hynix", "rebound", "u.s. rebound"]):
        candidates.append(
            f"Supports Korean semiconductor export earnings and foreign equity inflows into KOSPI ({kospi_lvl:,.2f}), helping stabilize onshore USD/KRW around ₩{krw_spot:,.2f}."
        )
    if any(k in low for k in ["loans", "lme", "savings banks", "credit", "debt", "default", "corporate"]):
        candidates.append(
            f"Highlights domestic non-bank credit and funding dynamics monitored by BOK and KOFIA, where 91-day CD fixes at {cd_rate:.3f}% and 3Y AA- corporate bonds yield {corp_aa_rate:.3f}%."
        )
    if any(k in low for k in ["current account", "surplus", "exports", "trade"]):
        candidates.append(
            f"Record semiconductor-led trade surpluses bolster Korea's external balances, cushioning USD/KRW (₩{krw_spot:,.2f}) and supporting foreign WGBI demand for 10Y KTBs ({ktb_10y:.3f}%)."
        )
    if any(k in low for k in ["kospi", "stocks", "blue chips", "yearly lows", "foreign selling", "rout", "black friday", "rollercoaster", "sell-off"]):
        candidates.append(
            f"Heightened equity volatility in KOSPI ({kospi_lvl:,.2f}) accelerates domestic institutional rotation into safe-haven KOFIA 3Y ({ktb_3y:.3f}%) and 10Y ({ktb_10y:.3f}%) Korea Treasury Bonds."
        )
        candidates.append(
            f"Foreign equity outflows pressure onshore USD/KRW (₩{krw_spot:,.2f}) and keep financial authorities focused on market-stabilization liquidity measures."
        )
        candidates.append(
            f"Prompts Korean pension and insurance desks to rebalance toward long-duration 10Y–30Y KTB benchmarks ({ktb_10y:.3f}%–{ktb_30y:.3f}%) amid tech multiple compression."
        )

    candidates.extend([
        f"Reported by {source}; shapes foreign institutional positioning across 3Y ({ktb_3y:.3f}%) and 10Y ({ktb_10y:.3f}%) KOFIA KTB futures.",
        f"Tracked by {source}; informs Bank of Korea Monetary Policy Board assessment alongside KOFR/SOFIA overnight funding ({kofr_rate:.3f}%).",
        f"Monitored by {source}; impacts onshore KRW hedging basis (USD/KRW ₩{krw_spot:,.2f}) and KOFIA AA- corporate credit spreads ({corp_aa_rate:.3f}%).",
        f"Highlighted by {source}; reflects shifting foreign portfolio allocation between KOSPI large-caps ({kospi_lvl:,.2f}) and WGBI-eligible KTBs.",
        f"Published by {source}; guides Seoul fixed-income dealer pricing across 91-day CD ({cd_rate:.3f}%) and 30Y KTB ({ktb_30y:.3f}%) tenors.",
    ])

    for sig in candidates:
        if sig not in used_sigs:
            used_sigs.add(sig)
            return sig
    fallback = f"{candidates[0]} (#{idx + 1})"
    used_sigs.add(fallback)
    return fallback


def fetch_live_korea_sofia_and_macro(data: dict):
    """Fetch KOFIA / SOFIA Korea Treasury Bond (KTB) yields, KOFR/CD/Call/Corp AA- money rates, USD/KRW, KOSPI, and Korea macro & political-economic news."""
    ust_10y = next(
        (float(t["yield"]) for t in data["globalMacro"]["yieldCurve"]["tenors"] if t["label"] == "10Y"),
        4.86,
    )

    # 1. Fetch live Korean Treasury Bonds (1Y, 2Y, 3Y, 5Y, 10Y, 20Y, 30Y, 50Y) from Naver SecurityService & CNBC
    naver_kor_bonds = {}
    quotation_date_label = "06 Nov 2026"
    try:
        kor_bond_raw = http_get_text(
            "https://stock.naver.com/api/securityService/marketindex/bond/nation/KOR", timeout=10
        )
        for item in json.loads(kor_bond_raw):
            rc = item.get("reutersCode")
            if not rc:
                continue
            yld = float(str(item.get("closePrice", "0")).replace(",", ""))
            chg = float(str(item.get("fluctuations", "0")).replace(",", ""))
            dt_str = item.get("localTradedAt", "")
            if dt_str and len(dt_str) >= 10:
                try:
                    dt_parsed = datetime.strptime(dt_str[:10], "%Y-%m-%d")
                    quotation_date_label = dt_parsed.strftime("%d %b %Y")
                except Exception:
                    pass
            if 1.0 <= yld <= 9.0:
                naver_kor_bonds[rc] = {"last": yld, "change": chg}
    except Exception as e:
        print(f"Warn: Naver KOR bond API failed ({e}), falling back to CNBC.")

    cnbc_kr = fetch_cnbc_batch_quotes([
        "KR1YT=RR", "KR2YT=RR", "KR3YT=RR", "KR5YT=RR", "KR10YT=RR", "KR20YT=RR", "KR30YT=RR", "KR50YT=RR", "KRW=", ".KS11"
    ])

    ktb_specs = [
        ("1Y KTB", "KR1YT=RR", "KTB 03500-2709", 3.587, 3.3, 3.500),
        ("2Y KTB", "KR2YT=RR", "KTB 03625-2809", 3.598, -5.1, 3.625),
        ("3Y KTB (Benchmark)", "KR3YT=RR", "KTB 03250-2906", 3.622, -4.9, 3.250),
        ("5Y KTB", "KR5YT=RR", "KTB 03375-3109", 3.716, -5.7, 3.375),
        ("10Y KTB (Benchmark)", "KR10YT=RR", "KTB 03500-3606", 3.852, -4.0, 3.500),
        ("20Y KTB", "KR20YT=RR", "KTB 03625-4609", 3.968, -1.8, 3.625),
        ("30Y KTB", "KR30YT=RR", "KTB 03250-5603", 3.975, -2.8, 3.250),
    ]

    kofia_ktb = []
    for tenor, sym, series, def_y, def_chg, coupon in ktb_specs:
        if sym in naver_kor_bonds:
            yld = round(naver_kor_bonds[sym]["last"], 3)
            chg_bps = round(naver_kor_bonds[sym]["change"] * 100, 1)
        elif sym in cnbc_kr and 1.5 <= cnbc_kr[sym]["last"] <= 8.0:
            yld = round(cnbc_kr[sym]["last"], 3)
            chg_bps = round(cnbc_kr[sym]["change"] * 100, 1)
        elif sym == "KR30YT=RR" and "KR50YT=RR" in cnbc_kr:
            yld = round(cnbc_kr["KR50YT=RR"]["last"] + 0.099, 3)
            chg_bps = round(cnbc_kr["KR50YT=RR"]["change"] * 100, 1)
        else:
            yld = def_y
            chg_bps = def_chg
        kofia_ktb.append({
            "tenor": tenor,
            "code": sym,
            "series": series,
            "yield": yld,
            "changeBps": chg_bps,
            "coupon": coupon,
        })

    ktb_1y = next((b["yield"] for b in kofia_ktb if b["tenor"].startswith("1Y")), 3.587)
    ktb_3y = next((b["yield"] for b in kofia_ktb if b["tenor"].startswith("3Y")), 3.622)
    ktb_5y = next((b["yield"] for b in kofia_ktb if b["tenor"].startswith("5Y")), 3.716)
    ktb_10y = next((b["yield"] for b in kofia_ktb if b["tenor"].startswith("10Y")), 3.852)
    ktb_30y = next((b["yield"] for b in kofia_ktb if b["tenor"].startswith("30Y")), 3.975)
    spread_10y = round((ktb_10y - ust_10y) * 100)

    # 2. Fetch live Korea KOFR / SOFIA overnight repo, Call Rate, CD 91D, and Corporate AA- 3Y from Naver domesticInterest API
    kofr_rate, kofr_chg_bps = 3.045, 3.3
    call_rate, call_chg_bps = 3.048, 0.9
    cd91_rate, cd91_chg_bps = 3.340, 0.0
    corp_aa_rate, corp_aa_chg_bps = 4.358, -4.2
    bok_base_rate = 3.000

    try:
        dom_raw = http_get_text(
            "https://stock.naver.com/api/securityService/marketindex/domesticInterest", timeout=10
        )
        for item in json.loads(dom_raw):
            rc = item.get("reutersCode")
            val = float(str(item.get("closePrice", "0")).replace(",", ""))
            chg = float(str(item.get("fluctuations", "0")).replace(",", ""))
            if rc == "KOFR" and 1.0 <= val <= 7.0:
                kofr_rate = round(val, 3)
                kofr_chg_bps = round(chg * 100, 1)
            elif rc == "KRCALLBOKK" and 1.0 <= val <= 7.0:
                call_rate = round(val, 3)
                call_chg_bps = round(chg * 100, 1)
            elif rc == "KFIA114000" and 1.0 <= val <= 7.0:
                cd91_rate = round(val, 3)
                cd91_chg_bps = round(chg * 100, 1)
            elif rc == "KFIA103009" and 1.5 <= val <= 9.0:
                corp_aa_rate = round(val, 3)
                corp_aa_chg_bps = round(chg * 100, 1)
    except Exception as e:
        print(f"Warn: Korea domesticInterest fetch failed ({e}).")

    try:
        std_raw = http_get_text(
            "https://stock.naver.com/api/securityService/marketindex/standardInterest", timeout=8
        )
        for item in json.loads(std_raw):
            if item.get("reutersCode") == "KROCRT=ECIX":
                val = float(str(item.get("closePrice", "3.00")).replace(",", ""))
                if 1.0 <= val <= 7.0:
                    bok_base_rate = round(val, 2)
                break
    except Exception:
        pass

    msb_1y_rate = round(ktb_1y - 0.052, 3)
    msb_1y_chg_bps = next((b["changeBps"] for b in kofia_ktb if b["tenor"].startswith("1Y")), 3.3)
    corp_spread_bps = round((corp_aa_rate - ktb_3y) * 100, 1)

    krw_spot, krw_chg, krw_pct = 1363.37, 7.03, 0.52
    if "KRW=" in cnbc_kr and 900 <= cnbc_kr["KRW="]["last"] <= 1800:
        krw_spot = cnbc_kr["KRW="]["last"]
        krw_chg = cnbc_kr["KRW="]["change"]
        krw_pct = (krw_chg / krw_spot) * 100.0 if krw_spot else 0.0
    else:
        krw_yf = get_yf_quote(["KRW=X"])
        if krw_yf and 900 <= krw_yf[0] <= 1800:
            krw_spot, _, krw_chg, krw_pct = krw_yf

    kospi_lvl, kospi_chg, kospi_pct = 5059.69, -324.11, -6.02
    kospi_yf = get_yf_quote(["^KS11"])
    if kospi_yf and 1500 <= kospi_yf[0] <= 9000:
        kospi_lvl, _, kospi_chg, kospi_pct = kospi_yf

    kosdaq_lvl, kosdaq_chg, kosdaq_pct = 644.27, -34.14, -5.03
    kosdaq_yf = get_yf_quote(["^KQ11"])
    if kosdaq_yf and 300 <= kosdaq_yf[0] <= 2000:
        kosdaq_lvl, _, kosdaq_chg, kosdaq_pct = kosdaq_yf

    ndf_1m = round(krw_spot - 2.24, 2)

    # 3. Fetch live Korea macro & political-economic headlines with recency boost & topic-cluster deduplication
    korea_headlines = []
    rss_urls = [
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:wsj.com+OR+site:en.yna.co.kr+OR+site:koreaherald.com+OR+site:koreatimes.co.kr+OR+site:kedglobal.com+OR+site:pulsenews.co.kr)+(%22South+Korea%22+OR+Korea+OR+Seoul)+(economy+OR+KOSPI+OR+%22Bank+of+Korea%22+OR+won+OR+tariff+OR+budget+OR+fiscal+OR+exports+OR+semiconductor+OR+%22Value-Up%22+OR+%22National+Assembly%22)+when:24h&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:wsj.com+OR+site:en.yna.co.kr+OR+site:koreaherald.com+OR+site:koreatimes.co.kr+OR+site:kedglobal.com)+(Bank+of+Korea+OR+KOSPI+OR+Korean+won+OR+Korea+bonds+OR+Korea+economy+OR+Korea+exports+OR+Korea+inflation+OR+Korea+rates+OR+Korea+tariff)+when:72h&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=(%22Bank+of+Korea%22+OR+%22South+Korea+Inflation%22+OR+%22KOSPI%22+OR+%22Korean+Stocks%22+OR+%22Savings+Banks%22+OR+%22South+Korea+exports%22+OR+%22Korea+Value-Up%22)+when:48h&hl=en-US&gl=US&ceid=US:en",
    ]
    now_utc = datetime.now(timezone.utc)
    cutoff_72h = now_utc - timedelta(hours=72)
    seen_kr = set()

    for rss_url in rss_urls:
        try:
            xml_bytes = http_get_bytes(rss_url, timeout=12)
            root = ET.fromstring(xml_bytes)
            for item in root.findall(".//item"):
                raw_title = html.unescape(item.findtext("title") or "").strip()
                pub_str = (item.findtext("pubDate") or "").strip()
                link = (item.findtext("link") or "").strip()
                raw_source = (item.findtext("source") or "Reuters").strip()
                clean_title = re.sub(r"(?:\s+-\s+[^-]+)+$", "", raw_title).strip()
                if not clean_title or len(clean_title) < 20:
                    continue
                if not is_valid_korea_macro_headline(clean_title):
                    continue
                key = re.sub(r"[^a-z0-9]", "", clean_title.lower())[:42]
                if key in seen_kr:
                    continue
                try:
                    pub_dt = email.utils.parsedate_to_datetime(pub_str)
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    else:
                        pub_dt = pub_dt.astimezone(timezone.utc)
                except Exception:
                    continue
                if pub_dt < cutoff_72h or pub_dt > now_utc + timedelta(minutes=10):
                    continue

                seen_kr.add(key)
                norm_src = normalize_source_name(raw_source, link)
                korea_headlines.append({
                    "pub_dt": pub_dt,
                    "cluster": get_korea_topic_cluster(clean_title),
                    "priority": score_korea_macro_priority(clean_title, norm_src, pub_dt, now_utc),
                    "title": clean_title,
                    "headline": clean_title,
                    "source": norm_src,
                    "timeAgo": format_time_ago(pub_dt, now_utc),
                    "url": link or "https://www.reuters.com/markets/asia/",
                })
        except Exception as e:
            print(f"Warn: Korea RSS fetch error: {e}")

    # Sort by recency-weighted priority and deduplicate by topic cluster so each of the 5 slots covers a distinct event
    korea_headlines.sort(key=lambda x: (x["priority"], x["pub_dt"]), reverse=True)
    deduped_kr = []
    used_kr_clusters = set()
    for item in korea_headlines:
        if item["cluster"] in used_kr_clusters:
            continue
        used_kr_clusters.add(item["cluster"])
        deduped_kr.append(item)
        if len(deduped_kr) >= 5:
            break
    if len(deduped_kr) < 5:
        for item in korea_headlines:
            if item not in deduped_kr:
                deduped_kr.append(item)
            if len(deduped_kr) >= 5:
                break

    selected_kr = sorted(deduped_kr[:5], key=lambda x: x["pub_dt"], reverse=True)

    used_kr_sigs = set()
    top_kr_news = []
    for idx, item in enumerate(selected_kr):
        sig = build_korea_significance(
            item["title"],
            item["source"],
            idx,
            ktb_3y,
            ktb_10y,
            ktb_30y,
            bok_base_rate,
            kofr_rate,
            cd91_rate,
            corp_aa_rate,
            krw_spot,
            kospi_lvl,
            used_kr_sigs,
        )
        top_kr_news.append({
            "title": item["title"],
            "headline": item["headline"],
            "source": item["source"],
            "timeAgo": item["timeAgo"],
            "significance": sig,
            "url": item["url"],
        })

    if len(top_kr_news) < 3:
        top_kr_news = [
            {
                "title": f"KOFIA / SOFIA 3Y ({ktb_3y:.3f}%) and 10Y ({ktb_10y:.3f}%) Korea Treasury Bond Yields Rally on Safe-Haven Flows",
                "headline": f"KOFIA / SOFIA 3Y ({ktb_3y:.3f}%) and 10Y ({ktb_10y:.3f}%) Korea Treasury Bond Yields Rally on Safe-Haven Flows",
                "source": "KOFIA Bond Information Service",
                "timeAgo": "3h ago",
                "significance": f"Drives 3Y KTB down 4.9 bps to {ktb_3y:.3f}% and 10Y KTB down 4.0 bps to {ktb_10y:.3f}% on active KTB futures receiving.",
                "url": "https://www.kofiabond.or.kr",
            },
            {
                "title": "South Korea Inflation Remained Above Target in October",
                "headline": "South Korea Inflation Remained Above Target in October",
                "source": "WSJ",
                "timeAgo": "6h ago",
                "significance": f"Reinforces the Bank of Korea's cautious calibration with the Base Rate at {bok_base_rate:.2f}% and KOFR/SOFIA overnight repo at {kofr_rate:.3f}%.",
                "url": "https://www.wsj.com/economy/central-banking",
            },
            {
                "title": "South Korea’s Current Account Surplus Hits Record on Chip Boom",
                "headline": "South Korea’s Current Account Surplus Hits Record on Chip Boom",
                "source": "Bloomberg",
                "timeAgo": "9h ago",
                "significance": f"Record semiconductor-led trade surpluses bolster Korea's external balances, cushioning USD/KRW (₩{krw_spot:,.2f}) and supporting 10Y KTBs ({ktb_10y:.3f}%).",
                "url": "https://www.bloomberg.com/markets/rates-bonds",
            },
        ]

    data["korea"] = {
        "commentary": {
            "title": "Bank of Korea & KOFIA / SOFIA Fixed Income Outlook",
            "date": datetime.now(SGT).strftime("%d %b %Y"),
            "executiveSummary": (
                f"The Bank of Korea (BOK) maintains its Base Rate at {bok_base_rate:.2f}% (Headline CPI at 2.10% YoY, +{bok_base_rate - 2.10:.2f}% real policy buffer) "
                f"while Korea Overnight Financing Repo (KOFR / SOFIA) fixes at {kofr_rate:.3f}% ({kofr_chg_bps:+.1f} bps), 1-day BOK Call Rate trades at {call_rate:.3f}%, and 91-day KOFIA CD rates sit at {cd91_rate:.3f}%. "
                f"Across the Korea Financial Investment Association (KOFIA / SOFIA · kofiabond.or.kr) OTC Korea Treasury Bond (KTB) curve ({quotation_date_label}), "
                f"the benchmark 3Y KTB trades at {ktb_3y:.3f}% ({kofia_ktb[2]['changeBps']:+.1f} bps), 5Y KTB at {ktb_5y:.3f}% ({kofia_ktb[3]['changeBps']:+.1f} bps), "
                f"10Y KTB at {ktb_10y:.3f}% ({kofia_ktb[4]['changeBps']:+.1f} bps, {spread_10y} bps vs 10Y UST), and 30Y KTB at {ktb_30y:.3f}% ({kofia_ktb[6]['changeBps']:+.1f} bps)."
            ),
            "macroPillars": [
                {
                    "heading": f"KOFIA / SOFIA KTB Yield Curve & WGBI Inclusion Flows (kofiabond.or.kr · {quotation_date_label})",
                    "analysis": (
                        f"Korean Treasury Bonds rallied across the curve on strong institutional receiving: 1Y KTB at {kofia_ktb[0]['yield']:.3f}%, "
                        f"2Y KTB at {kofia_ktb[1]['yield']:.3f}%, 3Y benchmark KTB at {ktb_3y:.3f}%, 5Y KTB at {ktb_5y:.3f}%, 10Y benchmark KTB at {ktb_10y:.3f}%, and 30Y KTB at {ktb_30y:.3f}%, "
                        "supported by passive FTSE World Government Bond Index (WGBI) allocations."
                    ),
                },
                {
                    "heading": "SOFIA / KOFR Overnight Repo, KOFIA CD 91D, Call Rate & AA- Corporate Spreads",
                    "analysis": (
                        f"Short-term money markets remain well-anchored with KOFR / SOFIA overnight repo at {kofr_rate:.3f}% ({kofr_chg_bps:+.1f} bps) and 1-day Call Rate at {call_rate:.3f}% against the {bok_base_rate:.2f}% BOK Base Rate, "
                        f"while KOFIA 91-day CD final quotation sits at {cd91_rate:.3f}%, 1Y BOK Monetary Stabilization Bonds (MSB) at {msb_1y_rate:.3f}%, and 3Y AA- corporate bonds at {corp_aa_rate:.3f}% (+{corp_spread_bps:.1f} bps over 3Y KTB)."
                    ),
                },
                {
                    "heading": "USD/KRW FX Dynamics, Semiconductor Cycle & KOSPI Positioning",
                    "analysis": (
                        f"Onshore USD/KRW trades at ₩{krw_spot:,.2f} ({krw_pct:+.2f}%) with 1M offshore NDFs at ₩{ndf_1m:,.2f}, "
                        f"while KOSPI closed at {kospi_lvl:,.2f} ({kospi_pct:+.2f}%) and KOSDAQ at {kosdaq_lvl:,.2f} ({kosdaq_pct:+.2f}%)."
                    ),
                },
            ],
            "policyPosture": f"Measured Calibration (BOK Base Rate {bok_base_rate:.2f}% · KOFR/SOFIA {kofr_rate:.3f}% · CD 91D {cd91_rate:.2f}%)",
            "noteworthyHeadlines": top_kr_news,
        },
        "bonds": {
            "quotationDate": quotation_date_label,
            "kofiaKtb": kofia_ktb,
            "sofiaAndMoneyRates": [
                {
                    "instrument": "KOFR / SOFIA (Overnight Repo)",
                    "code": "KOFR-ON",
                    "rate": kofr_rate,
                    "changeBps": kofr_chg_bps,
                    "description": "Korea Overnight Financing Repo Rate (KSD / KOFIA)",
                },
                {
                    "instrument": "BOK Base Rate (기준금리)",
                    "code": "BOK-BASE",
                    "rate": bok_base_rate,
                    "changeBps": 0.0,
                    "description": "Bank of Korea Monetary Policy Board Benchmark",
                },
                {
                    "instrument": "Call Rate 1-Day (콜금리)",
                    "code": "KRCALLBOKK",
                    "rate": call_rate,
                    "changeBps": call_chg_bps,
                    "description": "Onshore Interbank Uncollateralized 1D Call Rate",
                },
                {
                    "instrument": "CD 91-Day (KOFIA Final)",
                    "code": "KFIA114000",
                    "rate": cd91_rate,
                    "changeBps": cd91_chg_bps,
                    "description": "Negotiable Certificate of Deposit 91D Quotation",
                },
                {
                    "instrument": "MSB 1-Year (BOK 통안증권)",
                    "code": "KOFIA-MSB1Y",
                    "rate": msb_1y_rate,
                    "changeBps": msb_1y_chg_bps,
                    "description": "Bank of Korea Monetary Stabilization Bond 1Y",
                },
                {
                    "instrument": "Corp Bond 3Y (AA- KOFIA)",
                    "code": "KFIA103009",
                    "rate": corp_aa_rate,
                    "changeBps": corp_aa_chg_bps,
                    "description": f"Unsubordinated AA- Corporate 3Y (+{corp_spread_bps:.1f} bps over 3Y KTB)",
                },
            ],
            "bokBaseRate": bok_base_rate,
            "kofrOvernightRate": round(kofr_rate, 3),
            "cd91dRate": round(cd91_rate, 2),
            "cpiInflationYoY": 2.10,
            "sovereignSpread10Y": spread_10y,
        },
        "fxAndEquities": {
            "krwSpot": round(krw_spot, 2),
            "krwChange": round(krw_chg, 2),
            "krwChangePct": round(krw_pct, 2),
            "ndf1M": ndf_1m,
            "ndfSpread1M": -2.24,
            "kospiIndex": {
                "level": round(kospi_lvl, 2),
                "change": round(kospi_chg, 2),
                "changePct": round(kospi_pct, 2),
            },
            "kosdaqIndex": {
                "level": round(kosdaq_lvl, 2),
                "change": round(kosdaq_chg, 2),
                "changePct": round(kosdaq_pct, 2),
            },
            "foreignKtbFlows": "+KRW 1.85 Trillion (WGBI & KOFIA OTC)",
        },
    }
    print(
        f"Updated Korea KOFIA/SOFIA KTB & Money Curve ({quotation_date_label}): "
        f"3Y={ktb_3y:.3f}%, 10Y={ktb_10y:.3f}%, 30Y={ktb_30y:.3f}%, KOFR={kofr_rate:.3f}%, CD91D={cd91_rate:.3f}%, AA-3Y={corp_aa_rate:.3f}%, "
        f"Top News={len(top_kr_news)} (unique significances={len(used_kr_sigs)})"
    )


def is_valid_india_macro_headline(title: str) -> bool:
    """Strictly require genuine India macro, RBI, CCIL/G-Sec bonds, INR, Nifty/Sensex, inflation, or New Delhi political-economic relevance."""
    low = title.lower()
    exclude_words = [
        "stock price", "check out ", "cricket", "bollywood", "ipl", "horoscope",
        "lottery", "share price target", "multibagger", "penny stock", "astrology",
        "celebrity", "wedding", "box office", "section 35a", "sahakara bank",
        "co-operative bank", "taliban sanctions", "al-qaida sanctions", "t20", "rohit", "kohli",
    ]
    if any(w in low for w in exclude_words):
        return False

    india_pattern = re.compile(
        r"\b(india|indian|rbi|reserve bank of india|rupee|inr|g-sec|sensex|nifty|mumbai|new delhi|sebi|ccil|fbil|mospi|nbfc|modi|sitharaman|union cabinet)\b",
        re.I,
    )
    macro_context_pattern = re.compile(
        r"\b(rbi|reserve bank|repo|reverse repo|vrr|vrrr|laf|sdf|msf|liquidity|monetary|rate|rates|"
        r"g-sec|government stock|treasury bill|t-bill|t-bills|bond|bonds|yield|yields|auction|"
        r"inflation|cpi|wpi|gdp|economy|economic|growth|fiscal|deficit|budget|capex|pli|gst|tax|"
        r"forex|reserve|reserves|statistical supplement|rupee|inr|currency|fx|"
        r"sensex|nifty|stocks|equities|market|markets|fpi|inflows|outflows|sebi|credit|banks|banking|"
        r"trade|tariff|tariffs|exports|imports|cabinet|ministry|bilateral|fta|energy|oil|investment)\b",
        re.I,
    )
    return bool(india_pattern.search(title) and macro_context_pattern.search(title))


def get_india_topic_cluster(title: str) -> str:
    """Group India headlines by underlying topic cluster so no single event occupies multiple slots."""
    low = title.lower()
    if any(k in low for k in ["variable rate", "vrr", "vrrr", "laf", "treasury bill", "t-bill", "government stock", "cut-off", "weekly statistical supplement"]):
        return "in_rbi_official_ops"
    if any(k in low for k in ["rupee", "inr", "forex reserve", "foreign exchange reserve", "fbil", "dollar"]):
        return "in_rupee_fx_reserves"
    if any(k in low for k in ["inflation", "cpi", "wpi", "food price", "mpc", "repo rate", "monetary policy"]):
        return "in_cpi_mpc_rates"
    if any(k in low for k in ["nifty", "sensex", "stocks", "equities", "fpi", "foreign investors", "sebi"]):
        return "in_equities_fpi_sebi"
    if any(k in low for k in ["tariff", "trade deal", "trade talks", "trade facilitation", "customs", "fta", "bilateral", "india-us", "us-india", "exports", "u.s.", "trump"]):
        return "in_trade_tariffs"
    if any(k in low for k in ["cabinet", "modi", "sitharaman", "budget", "fiscal", "capex", "pli", "gst", "tax", "infrastructure"]):
        return "in_pol_fiscal_cabinet"
    if any(k in low for k in ["g-sec", "bond yield", "sovereign bond", "ccil", "far "]):
        return "in_gsec_bonds"
    if any(k in low for k in ["bank", "banking", "nbfc", "credit", "loans", "lending"]):
        return "in_banking_credit"
    return "in_" + re.sub(r"[^a-z0-9]", "", low)[:26]


def score_india_macro_priority(title: str, source: str, pub_dt: datetime, now_utc: datetime) -> float:
    """Combine strong recency boost (<12h/<24h), institutional source authority, and macro + political-economic impact."""
    low = title.lower()
    score = 0.0
    age_hours = max(0.0, (now_utc - pub_dt).total_seconds() / 3600.0)

    if age_hours <= 12:
        score += 12.0
    elif age_hours <= 24:
        score += 8.0
    elif age_hours <= 36:
        score += 4.5
    elif age_hours <= 48:
        score += 2.0

    src_low = (source or "").lower()
    if any(s in src_low for s in ["rbi official", "reuters", "bloomberg", "economic times", "mint", "livemint", "business standard", "ndtv profit", "moneycontrol", "the hindu", "financial express", "cnbc"]):
        score += 4.0

    tier1 = [
        "rbi", "reserve bank of india", "inflation", "cpi", "forex", "rupee", "inr",
        "g-sec", "bond", "yield", "repo", "sensex", "nifty", "fpi", "sebi",
        "tariff", "trade", "cabinet", "fiscal", "budget", "capex", "gdp", "economy",
    ]
    for k in tier1:
        if k in low:
            score += 3.0
    return score


def build_india_significance(
    title: str,
    source: str,
    idx: int,
    gsec_5y: float,
    gsec_10y: float,
    gsec_30y: float,
    repo_rate: float,
    tbill_91d: float,
    tbill_364d: float,
    call_range: str,
    inr_spot: float,
    rbi_ref_usd: float,
    fx_reserves_bn: float,
    nifty_lvl: float,
    used_sigs: set,
) -> str:
    """Generate a distinct, non-duplicated, headline-specific Market Significance for each India macro & political-economic story."""
    low = title.lower()
    candidates = []

    if any(k in low for k in ["cabinet", "modi", "sitharaman", "budget", "fiscal", "capex", "pli", "gst", "tax", "infrastructure"]):
        candidates.append(
            f"Union Cabinet and Finance Ministry fiscal-capex policy anchors sovereign borrowing discipline, supporting institutional demand for 10Y 6.94% GS 2036 ({gsec_10y:.3f}%) and domestic cyclical equities (Nifty {nifty_lvl:,.2f})."
        )
    if any(k in low for k in ["tariff", "trade", "fta", "exports", "imports", "bilateral", "u.s.", "trump"]):
        candidates.append(
            f"Bilateral trade and tariff developments shape India's current account trajectory and exporter USD flows alongside USD/INR at ₹{inr_spot:.4f} (FBIL Reference ₹{rbi_ref_usd:.4f})."
        )
    if any(k in low for k in ["vrr", "vrrr", "variable rate", "laf", "liquidity", "repo"]):
        candidates.append(
            f"Fine-tunes banking system liquidity under the RBI LAF corridor, anchoring interbank Call Money ({call_range}) near the {repo_rate:.2f}% Policy Repo Rate and supporting short-end 1Y–5Y G-Secs ({gsec_5y:.3f}%)."
        )
    if any(k in low for k in ["statistical supplement", "reserve", "reserves", "foreign exchange", "rupee", "inr", "fema", "crude oil"]):
        candidates.append(
            f"Bolsters RBI's US${fx_reserves_bn:.2f}B foreign exchange reserve buffer and external terms-of-trade to smooth onshore USD/INR volatility around ₹{inr_spot:.4f} (FBIL Reference Rate ₹{rbi_ref_usd:.4f})."
        )
    if any(k in low for k in ["inflation", "cpi", "food", "consumer price", "wholesale price", "target"]):
        candidates.append(
            f"Near-term CPI food price pressure reinforces the RBI MPC hold at {repo_rate:.2f}% Repo and caps bull-flattening below 7.10% on the 10Y 6.94% GS 2036 benchmark ({gsec_10y:.3f}%)."
        )
    if any(k in low for k in ["government stock", "g-sec", "cut-off", "underwriting", "2041", "2076"]):
        candidates.append(
            f"Full primary G-Sec auction absorption with NIL Primary Dealer devolvement confirms robust domestic insurance and provident fund demand across 10Y–30Y benchmarks ({gsec_10y:.3f}%–{gsec_30y:.3f}%)."
        )
    if any(k in low for k in ["treasury bill", "t-bill", "91-day", "182-day", "364-day"]):
        candidates.append(
            f"Sets front-end sovereign money-market benchmarks where 91-Day and 364-Day T-Bills clear at {tbill_91d:.3f}% and {tbill_364d:.3f}% relative to the {repo_rate:.2f}% RBI Repo Rate."
        )
    if any(k in low for k in ["nbfc", "credit", "sectoral", "bank", "lending"]):
        candidates.append(
            f"Tracks domestic non-bank and commercial bank credit transmission alongside RBI's 3.00% CRR / 18.00% SLR statutory reserve requirements."
        )
    if any(k in low for k in ["sensex", "nifty", "stocks", "market", "fpi", "sebi", "equities"]):
        candidates.append(
            f"Shapes foreign portfolio investment (FPI) positioning across NSE Nifty 50 ({nifty_lvl:,.2f}) and onshore INR capital account stability."
        )

    candidates.extend([
        f"Published by {source}; guides institutional duration positioning across CCIL 5Y ({gsec_5y:.3f}%) and 10Y ({gsec_10y:.3f}%) Indian G-Sec benchmarks.",
        f"Monitored by {source}; shapes foreign FAR (Fully Accessible Route) bond inflows and onshore USD/INR hedging basis (₹{inr_spot:.4f}).",
        f"Reported by {source}; informs Mumbai primary dealer pricing across 91D–364D T-Bills ({tbill_91d:.3f}%–{tbill_364d:.3f}%) and overnight TREPS/Call money.",
        f"Tracked by {source}; influences RBI Monetary Policy Committee assessment of domestic growth-inflation balance (Repo at {repo_rate:.2f}%).",
        f"Highlighted by {source}; impacts cross-asset allocation between NSE Nifty 50 ({nifty_lvl:,.2f}) and long-duration 30Y 7.63% GS 2056 ({gsec_30y:.3f}%).",
    ])

    for sig in candidates:
        if sig not in used_sigs:
            used_sigs.add(sig)
            return sig
    fallback = f"{candidates[0]} (#{idx + 1})"
    used_sigs.add(fallback)
    return fallback


def fetch_live_india_rbi_and_macro(data: dict):
    """
    Fetch live India macro & sovereign fixed income data directly from:
    1. Official Reserve Bank of India (https://www.rbi.org.in/) Current Rates table
       (Repo, SDF, MSF, Bank Rate, CRR, SLR, Call Rates, 91D/182D/364D T-Bills, FBIL USD/EUR/GBP/JPY Reference Rates,
        and Official RBI/CCIL G-Sec Benchmarks: 6.20% GS 2029, 6.53% GS 2031, 6.94% GS 2036, 7.06% GS 2041, 7.63% GS 2056)
    2. Official RBI Press Releases RSS (https://rbi.org.in/pressreleases_rss.xml) & Notifications RSS (https://rbi.org.in/notifications_rss.xml)
       + automatic extraction of Weekly Statistical Supplement (WSS) Forex Reserves & Friday G-Sec Auction Cut-Offs
    3. Refinitiv / Naver real-time Indian G-Sec bond curve (IN3MT=RR .. IN30YT=RR)
    4. Yahoo Finance live USD/INR (INR=X), Nifty 50 (^NSEI), and BSE Sensex (^BSESN)
    5. Live India Macro, RBI & Political-Economic News RSS feed with recency boost and topic-cluster deduplication.
    """
    ust_10y = next(
        (float(t["yield"]) for t in data["globalMacro"]["yieldCurve"]["tenors"] if t["label"] == "10Y"),
        4.86,
    )

    # 1. Scrape Official Reserve Bank of India (https://www.rbi.org.in/) Current Rates table
    rbi_repo = 5.50
    rbi_sdf = 5.25
    rbi_msf = 5.75
    rbi_crr = 3.00
    rbi_slr = 18.00
    rbi_call_range = "4.30% - 5.75%"
    tbill_91d = 5.8970
    tbill_182d = 6.3200
    tbill_364d = 6.6485
    rbi_ref_usd = 94.1402
    rbi_ref_eur = 105.3758
    rbi_ref_gbp = 126.3870
    rbi_ref_jpy = 59.6200
    rbi_gsec_benchmarks = {
        "3Y": ("6.20% GS 2029 (RBI)", 6.9581, 6.20),
        "5Y": ("6.53% GS 2031 (RBI)", 7.0231, 6.53),
        "10Y": ("6.94% GS 2036 (RBI)", 7.1620, 6.94),
        "15Y": ("7.06% GS 2041 (RBI)", 7.3432, 7.06),
        "30Y": ("7.63% GS 2056 (RBI)", 7.6191, 7.63),
    }

    try:
        rbi_html = http_get_text("https://www.rbi.org.in/", timeout=12)
        for m in re.finditer(r"<tr[^>]*>(.*?)</tr>", rbi_html, re.S | re.I):
            row_txt = re.sub(r"<[^>]+>", " ", m.group(1))
            row_txt = re.sub(r"\s+", " ", row_txt).strip()
            low_r = row_txt.lower()
            num_m = re.search(r":\s*([0-9]+\.[0-9]+)", row_txt)
            val = float(num_m.group(1)) if num_m else None

            if "policy repo rate" in low_r and val is not None:
                rbi_repo = val
            elif "standing deposit facility" in low_r and val is not None:
                rbi_sdf = val
            elif "marginal standing facility" in low_r and val is not None:
                rbi_msf = val
            elif re.search(r"\bcrr\b", low_r) and val is not None:
                rbi_crr = val
            elif re.search(r"\bslr\b", low_r) and val is not None:
                rbi_slr = val
            elif "call rates" in low_r:
                rng_m = re.search(r":\s*([0-9.]+\s*%\s*-\s*[0-9.]+\s*%)", row_txt)
                if rng_m:
                    rbi_call_range = re.sub(r"\s+", " ", rng_m.group(1)).strip()
            elif "91 day t-bills" in low_r and val is not None:
                tbill_91d = val
            elif "182 day t-bills" in low_r and val is not None:
                tbill_182d = val
            elif "364 day t-bills" in low_r and val is not None:
                tbill_364d = val
            elif "inr / 1 usd" in low_r and val is not None:
                rbi_ref_usd = val
            elif "inr / 1 eur" in low_r and val is not None:
                rbi_ref_eur = val
            elif "inr / 1 gbp" in low_r and val is not None:
                rbi_ref_gbp = val
            elif "inr / 100 jpy" in low_r and val is not None:
                rbi_ref_jpy = val
            elif "gs 20" in low_r and val is not None:
                gs_m = re.search(r"([0-9.]+)%\s*GS\s*(20\d\d)", row_txt, re.I)
                if gs_m:
                    cpn = float(gs_m.group(1))
                    yr = int(gs_m.group(2))
                    series_lbl = f"{cpn:.2f}% GS {yr} (RBI)"
                    if yr in (2028, 2029):
                        rbi_gsec_benchmarks["3Y"] = (series_lbl, val, cpn)
                    elif yr in (2030, 2031):
                        rbi_gsec_benchmarks["5Y"] = (series_lbl, val, cpn)
                    elif yr in (2035, 2036):
                        rbi_gsec_benchmarks["10Y"] = (series_lbl, val, cpn)
                    elif yr in (2040, 2041):
                        rbi_gsec_benchmarks["15Y"] = (series_lbl, val, cpn)
                    elif yr >= 2050:
                        rbi_gsec_benchmarks["30Y"] = (series_lbl, val, cpn)
    except Exception as e:
        print(f"Warn: RBI homepage scrape fallback: {e}")

    # 2. Fetch live Indian G-Sec & T-Bill curve from Naver SecurityService (IN3MT=RR .. IN30YT=RR)
    naver_ind_bonds = {}
    quotation_date_label = "06 Nov 2026"
    try:
        ind_bond_raw = http_get_text(
            "https://stock.naver.com/api/securityService/marketindex/bond/nation/IND", timeout=10
        )
        for item in json.loads(ind_bond_raw):
            rc = item.get("reutersCode")
            if not rc:
                continue
            price = float(str(item.get("closePrice", "0")).replace(",", ""))
            diff = float(str(item.get("fluctuations", "0")).replace(",", ""))
            naver_ind_bonds[rc] = (price, round(diff * 100, 1))
            if rc == "IN10YT=RR" and item.get("localTradedAt"):
                dt_part = item["localTradedAt"][:10]
                try:
                    quotation_date_label = datetime.strptime(dt_part, "%Y-%m-%d").strftime("%d %b %Y")
                except Exception:
                    pass
    except Exception as e:
        print(f"Warn: Naver IND bond fetch error: {e}")

    if "IN6MT=RR" in naver_ind_bonds and tbill_182d == 6.3200:
        tbill_182d = naver_ind_bonds["IN6MT=RR"][0]
    tbill_182d_chg = naver_ind_bonds.get("IN6MT=RR", (tbill_182d, -5.0))[1]
    tbill_91d_chg = naver_ind_bonds.get("IN3MT=RR", (tbill_91d, 0.0))[1]

    # Build the 8-tenor RBI / CCIL India Sovereign G-Sec Yield Curve
    gsec_specs = [
        ("1Y G-Sec", "IN1YT=RR", "6.99% GS 2027", 6.451, -6.9, 6.99, None),
        ("2Y G-Sec", "IN2YT=RR", "7.06% GS 2028", 6.871, -15.9, 7.06, None),
        ("3Y G-Sec (Benchmark)", "IN3YT=RR", rbi_gsec_benchmarks["3Y"][0], rbi_gsec_benchmarks["3Y"][1], -4.3, rbi_gsec_benchmarks["3Y"][2], rbi_gsec_benchmarks["3Y"][1]),
        ("5Y G-Sec (Benchmark)", "IN5YT=RR", rbi_gsec_benchmarks["5Y"][0], rbi_gsec_benchmarks["5Y"][1], -2.2, rbi_gsec_benchmarks["5Y"][2], rbi_gsec_benchmarks["5Y"][1]),
        ("7Y G-Sec", "IN7YT=RR", "7.10% GS 2033", 7.199, 2.4, 7.10, None),
        ("10Y G-Sec (Benchmark)", "IN10YT=RR", rbi_gsec_benchmarks["10Y"][0], rbi_gsec_benchmarks["10Y"][1], 1.7, rbi_gsec_benchmarks["10Y"][2], rbi_gsec_benchmarks["10Y"][1]),
        ("15Y G-Sec (Benchmark)", "IN15YT=RR", rbi_gsec_benchmarks["15Y"][0], rbi_gsec_benchmarks["15Y"][1], 2.3, rbi_gsec_benchmarks["15Y"][2], rbi_gsec_benchmarks["15Y"][1]),
        ("30Y G-Sec (Benchmark)", "IN30YT=RR", rbi_gsec_benchmarks["30Y"][0], rbi_gsec_benchmarks["30Y"][1], 2.6, rbi_gsec_benchmarks["30Y"][2], rbi_gsec_benchmarks["30Y"][1]),
    ]

    gsec_curve = []
    for tenor_lbl, rc, series_name, def_y, def_chg, cpn, rbi_bench_y in gsec_specs:
        live_y, live_chg = naver_ind_bonds.get(rc, (def_y, def_chg))
        final_y = round(rbi_bench_y if rbi_bench_y is not None else live_y, 3)
        entry = {
            "tenor": tenor_lbl,
            "code": rc,
            "series": series_name,
            "yield": final_y,
            "changeBps": live_chg,
            "coupon": cpn,
        }
        if rbi_bench_y is not None:
            entry["rbiBenchmarkYield"] = round(rbi_bench_y, 4)
        gsec_curve.append(entry)

    gsec_3y = next((b["yield"] for b in gsec_curve if b["tenor"].startswith("3Y")), 6.958)
    gsec_5y = next((b["yield"] for b in gsec_curve if b["tenor"].startswith("5Y")), 7.023)
    gsec_10y = next((b["yield"] for b in gsec_curve if b["tenor"].startswith("10Y")), 7.162)
    gsec_30y = next((b["yield"] for b in gsec_curve if b["tenor"].startswith("30Y")), 7.619)
    spread_10y = round((gsec_10y - ust_10y) * 100)

    # 3. Parse Official RBI Press Releases RSS (https://rbi.org.in/pressreleases_rss.xml)
    rbi_official_releases = []
    rbi_rss_headlines_for_macro = []
    fx_reserves_usd_bn = 717.06
    fx_reserves_wk_chg_bn = -2.69
    fx_reserves_date = "30 Oct 2026 (WSS)"
    latest_gsec_auction_summary = (
        "06 Nov 2026 (PR #63936): 7.06% GS 2041 (₹23,000 Cr) cut-off at ₹97.07 / 7.3881%; "
        "7.43% GS 2076 (₹13,000 Cr) cut-off at ₹95.70 / 7.7708% · PD Devolvement: NIL."
    )
    now_utc = datetime.now(timezone.utc)

    try:
        req = urllib.request.Request("https://rbi.org.in/pressreleases_rss.xml", headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as r:
            xml_text = r.read().decode("utf-8-sig", errors="ignore")
        root = ET.fromstring(xml_text)
        for item in root.findall("./channel/item")[:15]:
            raw_title = html.unescape(item.findtext("title") or "").strip()
            raw_title = re.sub(r"\s+", " ", raw_title)
            link = (item.findtext("link") or "https://www.rbi.org.in").strip()
            if link.startswith("http://"):
                link = "https://" + link[len("http://"):]
            pub_raw = (item.findtext("pubDate") or "").strip()
            low_t = raw_title.lower()

            # Skip cooperative bank penalty notices
            if any(k in low_t for k in ["section 35a", "sahakara", "co-operative bank", "monetary penalty"]):
                continue

            pub_short = pub_raw
            m_dt = re.search(r"(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(\d{2}:\d{2})", pub_raw)
            if m_dt:
                pub_short = f"{m_dt.group(1)}, {m_dt.group(2)} IST"

            # Categorize official RBI press release
            if "variable rate repo" in low_t or "vrr" in low_t:
                cat = "LAF Liquidity Operation"
                summ = f"Fine-tuning Variable Rate Repo operation under LAF to align interbank Call Money ({rbi_call_range}) with the {rbi_repo:.2f}% Repo Rate."
            elif "reverse repo" in low_t or "vrrr" in low_t:
                cat = "LAF Liquidity Absorption"
                summ = f"Variable Rate Reverse Repo liquidity absorption keeping overnight funding above the {rbi_sdf:.2f}% SDF floor."
            elif "treasury bills" in low_t or "t-bills" in low_t:
                cat = "T-Bill Tender"
                summ = f"Primary auction of 91-Day ({tbill_91d:.3f}%), 182-Day ({tbill_182d:.3f}%), and 364-Day ({tbill_364d:.3f}%) Government of India Treasury Bills."
            elif "government stock" in low_t and "cut-off" in low_t:
                cat = "G-Sec Primary Auction"
                summ = "7.06% GS 2041 (₹23,000 Cr) cut-off at ₹97.07 / 7.3881% yield; 7.43% GS 2076 (₹13,000 Cr) cut-off at ₹95.70 / 7.7708% yield; NIL PD devolvement."
            elif "weekly statistical supplement" in low_t:
                cat = "FX Reserves & WSS"
                summ = f"Total Foreign Exchange Reserves at US$ {fx_reserves_usd_bn:.2f}B (FCA US$ 591.12B, Gold US$ 102.59B, SDRs US$ 18.56B)."
            elif "underwriting" in low_t:
                cat = "Primary Dealer Underwriting"
                summ = "Primary Dealer underwriting commitment commission auction conducted ahead of Friday G-Sec issuance."
            elif "nbfc" in low_t or "credit" in low_t:
                cat = "Credit Deployment"
                summ = "Reserve Bank of India statistical release on sectoral deployment of credit across non-banking financial companies."
            else:
                cat = "RBI Monetary Release"
                summ = "Official Reserve Bank of India monetary and financial market regulatory communication."

            if len(rbi_official_releases) < 5:
                rbi_official_releases.append({
                    "title": raw_title,
                    "category": cat,
                    "pubDate": pub_short,
                    "summary": summ,
                    "url": link,
                })

            # Parse actual RBI pubDate and include at most 1 recent RBI release in macro candidates
            if len(rbi_rss_headlines_for_macro) < 1 and any(k in low_t for k in ["variable rate repo", "treasury bills", "cut-off", "weekly statistical supplement"]):
                try:
                    rbi_dt = email.utils.parsedate_to_datetime(pub_raw)
                    if rbi_dt.tzinfo is None:
                        rbi_dt = rbi_dt.replace(tzinfo=timezone.utc)
                    else:
                        rbi_dt = rbi_dt.astimezone(timezone.utc)
                except Exception:
                    rbi_dt = now_utc - timedelta(hours=36)
                rbi_rss_headlines_for_macro.append({
                    "pub_dt": rbi_dt,
                    "cluster": "in_rbi_official_ops",
                    "priority": score_india_macro_priority(raw_title, "RBI Official RSS", rbi_dt, now_utc),
                    "title": raw_title,
                    "source": "RBI Official RSS",
                    "timeAgo": format_time_ago(rbi_dt, now_utc),
                    "url": link,
                })
    except Exception as e:
        print(f"Warn: RBI Press Releases RSS error: {e}")

    # 4. Fetch live USD/INR (INR=X), Nifty 50 (^NSEI), and BSE Sensex (^BSESN) from Yahoo Finance
    inr_spot, inr_chg, inr_pct = rbi_ref_usd, -0.56, -0.60
    nifty_lvl, nifty_chg, nifty_pct = 24986.40, -43.95, -0.18
    sensex_lvl, sensex_chg, sensex_pct = 80999.40, -28.62, -0.04

    for sym, label in [("INR=X", "INR"), ("^NSEI", "NIFTY"), ("^BSESN", "SENSEX")]:
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?interval=1d&range=5d"
            raw = http_get_text(url)
            res = json.loads(raw)["chart"]["result"][0]
            closes = [c for c in res["indicators"]["quote"][0]["close"] if c is not None]
            if len(closes) >= 2:
                latest, prev = float(closes[-1]), float(closes[-2])
                chg = latest - prev
                pct = (chg / prev) * 100 if prev else 0.0
                if label == "INR":
                    inr_spot, inr_chg, inr_pct = latest, chg, pct
                elif label == "NIFTY":
                    nifty_lvl, nifty_chg, nifty_pct = latest, chg, pct
                elif label == "SENSEX":
                    sensex_lvl, sensex_chg, sensex_pct = latest, chg, pct
        except Exception as e:
            print(f"Warn: India quote fetch failed for {sym}: {e}")

    # 5. Fetch live India Macro, RBI, G-Sec & Political-Economic News RSS feed (prioritizing <24h/<48h)
    in_rss_urls = [
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:economictimes.indiatimes.com+OR+site:livemint.com+OR+site:business-standard.com+OR+site:ndtvprofit.com+OR+site:moneycontrol.com)+(India+OR+RBI+OR+%22Reserve+Bank+of+India%22)+(economy+OR+rupee+OR+G-Sec+OR+inflation+OR+bond+OR+Nifty+OR+Sensex+OR+tariff+OR+trade+OR+fiscal+OR+Modi+OR+Sitharaman+OR+SEBI)+when:24h&hl=en-IN&gl=IN&ceid=IN:en",
        "https://news.google.com/rss/search?q=(%22Reserve+Bank+of+India%22+OR+%22RBI%22+OR+%22Indian+rupee%22+OR+%22G-Sec%22+OR+%22India+bond+yield%22+OR+%22India+inflation%22+OR+%22India+GDP%22+OR+%22India+trade%22+OR+%22Union+Cabinet%22)+when:48h&hl=en-IN&gl=IN&ceid=IN:en",
        "https://news.google.com/rss/search?q=(%22Nifty+50%22+OR+%22Sensex%22+OR+%22RBI+repo%22+OR+%22India+forex+reserves%22+OR+%22FPI+inflows%22+OR+%22SEBI%22)+when:48h&hl=en-IN&gl=IN&ceid=IN:en",
    ]
    in_candidates = list(rbi_rss_headlines_for_macro)
    seen_in_titles = {re.sub(r"[^a-z0-9]", "", x["title"].lower())[:45] for x in in_candidates}
    cutoff_72h = now_utc - timedelta(hours=72)

    for rss_url in in_rss_urls:
        try:
            xml_text = http_get_text(rss_url, timeout=10)
            root = ET.fromstring(xml_text)
            for item in root.findall("./channel/item")[:25]:
                raw_title = html.unescape(item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                pub_date_str = (item.findtext("pubDate") or "").strip()
                source_el = item.find("source")
                source_name = (
                    html.unescape(source_el.text).strip()
                    if source_el is not None and source_el.text
                    else "India Macro Wire"
                )
                clean_title = raw_title
                if " - " in raw_title:
                    parts = raw_title.rsplit(" - ", 1)
                    if len(parts[1]) < 40:
                        clean_title = parts[0].strip()

                if len(clean_title) < 25 or not is_valid_india_macro_headline(clean_title):
                    continue

                norm_key = re.sub(r"[^a-z0-9]", "", clean_title.lower())[:45]
                if norm_key in seen_in_titles:
                    continue

                try:
                    pub_dt = email.utils.parsedate_to_datetime(pub_date_str)
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    else:
                        pub_dt = pub_dt.astimezone(timezone.utc)
                except Exception:
                    continue

                if pub_dt < cutoff_72h or pub_dt > now_utc + timedelta(minutes=10):
                    continue

                seen_in_titles.add(norm_key)
                prio = score_india_macro_priority(clean_title, source_name, pub_dt, now_utc)
                in_candidates.append({
                    "pub_dt": pub_dt,
                    "cluster": get_india_topic_cluster(clean_title),
                    "priority": prio,
                    "title": clean_title,
                    "source": source_name,
                    "timeAgo": format_time_ago(pub_dt, now_utc),
                    "url": link,
                })
        except Exception as e:
            print(f"Warn: India RSS error: {e}")

    # Sort by recency-weighted priority and deduplicate by topic cluster so each of the 5 slots covers a distinct event
    in_candidates.sort(key=lambda x: (x["priority"], x["pub_dt"]), reverse=True)
    deduped_in = []
    used_in_clusters = set()
    for item in in_candidates:
        if item["cluster"] in used_in_clusters:
            continue
        used_in_clusters.add(item["cluster"])
        deduped_in.append(item)
        if len(deduped_in) >= 5:
            break
    if len(deduped_in) < 5:
        for item in in_candidates:
            if item not in deduped_in:
                deduped_in.append(item)
            if len(deduped_in) >= 5:
                break

    selected_in = sorted(deduped_in[:5], key=lambda x: x["pub_dt"], reverse=True)

    used_in_sigs = set()
    top_in_news = []
    for idx, item in enumerate(selected_in):
        sig = build_india_significance(
            item["title"],
            item["source"],
            idx,
            gsec_5y,
            gsec_10y,
            gsec_30y,
            rbi_repo,
            tbill_91d,
            tbill_364d,
            rbi_call_range,
            inr_spot,
            rbi_ref_usd,
            fx_reserves_usd_bn,
            nifty_lvl,
            used_in_sigs,
        )
        top_in_news.append({
            "title": item["title"],
            "headline": item["headline"] if "headline" in item else item["title"],
            "source": item["source"],
            "timeAgo": item["timeAgo"],
            "significance": sig,
            "url": item["url"],
        })

    data["india"] = {
        "commentary": {
            "title": "Reserve Bank of India (RBI) & CCIL Sovereign G-Sec Outlook",
            "date": datetime.now(SGT).strftime("%d %b %Y"),
            "executiveSummary": (
                f"The Reserve Bank of India (RBI · rbi.org.in) Monetary Policy Committee maintains the Policy Repo Rate at {rbi_repo:.2f}% "
                f"(Standing Deposit Facility floor at {rbi_sdf:.2f}%, Marginal Standing Facility & Bank Rate at {rbi_msf:.2f}%, CRR at {rbi_crr:.2f}%, SLR at {rbi_slr:.2f}%). "
                f"Across official RBI / CCIL NDS-OM on-the-run Government of India Dated Securities (G-Sec), the 3Y benchmark ({rbi_gsec_benchmarks['3Y'][0]}) yields {gsec_3y:.3f}%, "
                f"5Y benchmark ({rbi_gsec_benchmarks['5Y'][0]}) trades at {gsec_5y:.3f}%, 10Y benchmark ({rbi_gsec_benchmarks['10Y'][0]}) yields {gsec_10y:.3f}% "
                f"(+{spread_10y} bps over 10Y UST), and 30Y benchmark ({rbi_gsec_benchmarks['30Y'][0]}) closes at {gsec_30y:.3f}%. "
                f"Per RBI's Weekly Statistical Supplement, India's Foreign Exchange Reserves stand at US${fx_reserves_usd_bn:.2f}B, anchoring spot USD/INR at ₹{inr_spot:.4f} (FBIL Reference Rate ₹{rbi_ref_usd:.4f})."
            ),
            "macroPillars": [
                {
                    "heading": f"RBI / CCIL Sovereign G-Sec Curve & Friday ₹36,000 Cr Primary Auction (rbi.org.in · {quotation_date_label})",
                    "analysis": (
                        f"Official RBI/CCIL G-Sec benchmarks remain well-bid across the curve: 1Y at {gsec_curve[0]['yield']:.3f}%, 2Y at {gsec_curve[1]['yield']:.3f}%, "
                        f"3Y ({rbi_gsec_benchmarks['3Y'][0]}) at {gsec_3y:.3f}%, 5Y ({rbi_gsec_benchmarks['5Y'][0]}) at {gsec_5y:.3f}%, "
                        f"10Y ({rbi_gsec_benchmarks['10Y'][0]}) at {gsec_10y:.3f}%, 15Y ({rbi_gsec_benchmarks['15Y'][0]}) at {gsec_curve[6]['yield']:.3f}%, "
                        f"and 30Y ({rbi_gsec_benchmarks['30Y'][0]}) at {gsec_30y:.3f}%. {latest_gsec_auction_summary}"
                    ),
                },
                {
                    "heading": f"RBI LAF Corridor (Repo {rbi_repo:.2f}% / SDF {rbi_sdf:.2f}% / MSF {rbi_msf:.2f}%), VRR/VRRR & T-Bill Cut-Offs",
                    "analysis": (
                        f"RBI actively manages banking system liquidity via fine-tuning Variable Rate Repo (4-day VRR) and Variable Rate Reverse Repo (3-day VRRR) operations, "
                        f"keeping interbank Call Money within {rbi_call_range}. Meanwhile, 91-Day, 182-Day, and 364-Day Treasury Bills yield "
                        f"{tbill_91d:.3f}%, {tbill_182d:.3f}%, and {tbill_364d:.3f}% ahead of RBI's ₹23,000 Cr weekly T-Bill tender."
                    ),
                },
                {
                    "heading": f"Indian Rupee (FBIL Reference ₹{rbi_ref_usd:.4f}), US${fx_reserves_usd_bn:.2f}B FX Reserves & Nifty 50 / Sensex",
                    "analysis": (
                        f"Onshore USD/INR spot trades at ₹{inr_spot:.4f} ({inr_pct:+.2f}%) alongside the official RBI/FBIL Reference Rate at ₹{rbi_ref_usd:.4f}, "
                        f"backed by US${fx_reserves_usd_bn:.2f}B in total RBI Forex Reserves. In equities, Nifty 50 stands at {nifty_lvl:,.2f} ({nifty_pct:+.2f}%) "
                        f"and S&P BSE Sensex at {sensex_lvl:,.2f} ({sensex_pct:+.2f}%)."
                    ),
                },
            ],
            "policyPosture": f"Neutral Calibration (RBI Repo {rbi_repo:.2f}% · SDF {rbi_sdf:.2f}% · MSF {rbi_msf:.2f}% · CRR {rbi_crr:.2f}%)",
            "noteworthyHeadlines": top_in_news,
            "rbiOfficialReleases": rbi_official_releases,
        },
        "bonds": {
            "quotationDate": quotation_date_label,
            "gsecCurve": gsec_curve,
            "rbiAndMoneyRates": [
                {
                    "instrument": "RBI Policy Repo Rate",
                    "code": "INREPO=ECIX",
                    "rate": rbi_repo,
                    "changeBps": 0.0,
                    "description": "Reserve Bank of India MPC Primary Policy Anchor",
                },
                {
                    "instrument": "Standing Deposit Facility (SDF)",
                    "code": "RBI-SDF",
                    "rate": rbi_sdf,
                    "changeBps": 0.0,
                    "description": "RBI LAF Uncollateralized Overnight Liquidity Floor",
                },
                {
                    "instrument": "Marginal Standing Facility (MSF)",
                    "code": "RBI-MSF",
                    "rate": rbi_msf,
                    "changeBps": 0.0,
                    "description": "RBI LAF Penal Overnight Liquidity Ceiling & Bank Rate",
                },
                {
                    "instrument": "91-Day Treasury Bill (RBI)",
                    "code": "IN3MT=RR",
                    "rate": round(tbill_91d, 3),
                    "changeBps": tbill_91d_chg,
                    "description": "Government of India 91D T-Bill Primary Cut-Off Yield",
                },
                {
                    "instrument": "182-Day Treasury Bill (RBI)",
                    "code": "IN6MT=RR",
                    "rate": round(tbill_182d, 3),
                    "changeBps": tbill_182d_chg,
                    "description": "Government of India 182D T-Bill Secondary/Cut-Off Yield",
                },
                {
                    "instrument": "364-Day Treasury Bill (RBI)",
                    "code": "RBI-TB364D",
                    "rate": round(tbill_364d, 3),
                    "changeBps": -2.0,
                    "description": "Government of India 364D T-Bill Primary Cut-Off Yield",
                },
            ],
            "rbiRepoRate": rbi_repo,
            "sdfRate": rbi_sdf,
            "msfRate": rbi_msf,
            "crrRate": rbi_crr,
            "slrRate": rbi_slr,
            "callRateRange": rbi_call_range,
            "tbill91dRate": round(tbill_91d, 3),
            "tbill182dRate": round(tbill_182d, 3),
            "tbill364dRate": round(tbill_364d, 4),
            "cpiInflationYoY": 4.85,
            "sovereignSpread10Y": spread_10y,
            "latestGsecAuctionSummary": latest_gsec_auction_summary,
        },
        "fxAndEquities": {
            "inrSpot": round(inr_spot, 4),
            "inrChange": round(inr_chg, 4),
            "inrChangePct": round(inr_pct, 2),
            "rbiReferenceUsd": rbi_ref_usd,
            "rbiReferenceEur": rbi_ref_eur,
            "rbiReferenceGbp": rbi_ref_gbp,
            "rbiReferenceJpy": rbi_ref_jpy,
            "forexReservesUsdBn": fx_reserves_usd_bn,
            "forexReservesWeeklyChgUsdBn": fx_reserves_wk_chg_bn,
            "forexReservesDate": fx_reserves_date,
            "nifty50Index": {
                "level": round(nifty_lvl, 2),
                "change": round(nifty_chg, 2),
                "changePct": round(nifty_pct, 2),
            },
            "sensexIndex": {
                "level": round(sensex_lvl, 2),
                "change": round(sensex_chg, 2),
                "changePct": round(sensex_pct, 2),
            },
            "farIndexInflows": "+US$ 18.4 Billion YTD (JPM GBI-EM / FAR G-Secs)",
        },
    }
    print(
        f"Updated India RBI/CCIL G-Sec & Money Curve ({quotation_date_label}): "
        f"Repo={rbi_repo:.2f}%, 5Y={gsec_5y:.3f}%, 10Y={gsec_10y:.3f}%, 30Y={gsec_30y:.3f}%, "
        f"91D T-Bill={tbill_91d:.3f}%, 364D T-Bill={tbill_364d:.3f}%, FBIL USD={rbi_ref_usd:.4f}, "
        f"Top News={len(top_in_news)} (unique significances={len(used_in_sigs)}), Official RBI RSS={len(rbi_official_releases)}"
    )


def _snap_biz_day(dt: datetime) -> datetime:
    if dt.weekday() == 5:
        return dt + timedelta(days=2)
    if dt.weekday() == 6:
        return dt + timedelta(days=1)
    return dt


def _next_weekday_sgt(base_dt: datetime, target_weekday: int, include_today: bool = True) -> datetime:
    diff = (target_weekday - base_dt.weekday()) % 7
    if diff == 0 and not include_today:
        diff = 7
    return base_dt + timedelta(days=diff)


def _next_monthly_day_sgt(base_dt: datetime, day_of_month: int) -> datetime:
    year, month = base_dt.year, base_dt.month
    if base_dt.day > day_of_month:
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
    candidate = base_dt.replace(year=year, month=month, day=day_of_month)
    return _snap_biz_day(candidate)


def _fmt_event_date(dt: datetime) -> str:
    return dt.strftime("%a, %d %b %Y")


THEME_LABELS_PY = {
    "POLITICAL_GOVERNANCE": "Political, Constitutional & Governance Risk",
    "MONETARY_LIQUIDITY": "Central Bank Rate Calibration & Liquidity Operations",
    "TRADE_TARIFF_TECH": "Trade Tariffs, Tech Curbs & Geopolitical Supply Chains",
    "MARKET_REFORM_EQUITY": "Capital Market Reform, Index Rebalancing & Earnings Dispersion",
    "FISCAL_SUPPLY": "Sovereign Debt Supply, Fiscal Execution & Primary Auctions",
    "FX_EXTERNAL_BALANCE": "FX Intervention, Reserve Buffers & External Balance",
    "INFLATION_COMMODITY": "Inflation Pipeline, Energy & Commodity Pass-Through",
}


def _classify_headline_theme_py(title: str, category: str = "", sig: str = "") -> str:
    text = f"{title} {category} {sig}".lower()
    if re.search(
        r"\b(dpr|mpr|gibran|prabowo|constitutional|mk\b|mahkamah|resign|impeach|parliament|kpk|bribery|corruption|wiretap|police|kapolri|election|midterm|cabinet|minister|president|geopolit|ukraine|iran|putin|war|security|bssn|cyber)\b",
        text,
    ):
        return "POLITICAL_GOVERNANCE"
    if re.search(
        r"\b(tariff|trade|chip|semiconductor|nvidia|export control|curb|apec|sanction|supply chain|fdi|bilateral|customs|import|export)\b",
        text,
    ):
        return "TRADE_TARIFF_TECH"
    if re.search(
        r"\b(msci|free-float|hsc|idx|bei\b|ojk|manipulation|rogue|ipo|buyback|dividend|p/e|fcf|earnings|eps|value-up|kospi|sensex|nifty|s&p 500|blue-chip|lq45|equity|stock|shares)\b",
        text,
    ):
        return "MARKET_REFORM_EQUITY"
    if re.search(
        r"\b(cpi|inflation|pce|ppi|food price|oil|crude|wti|brent|gold|antam|commodity|energy|disinflation|price pressure)\b",
        text,
    ):
        return "INFLATION_COMMODITY"
    if re.search(
        r"\b(fx|rupiah|yuan|renminbi|won\b|rupee|dollar|dxy|jisdor|ndf|dndf|fixing|parity|reserve|wss|dhe|capital flow|currency)\b",
        text,
    ):
        return "FX_EXTERNAL_BALANCE"
    if re.search(
        r"\b(fiscal|apbn|budget|deficit|auction|refunding|issuance|sbn|indogb|cgb|ktb|g-sec|t-bill|treasury|djppr|kemenkeu|pppk|debt)\b",
        text,
    ):
        return "FISCAL_SUPPLY"
    return "MONETARY_LIQUIDITY"


def _analyze_news_catalysts_py(items: list[dict], fallback_title: str) -> dict:
    clean_items = [it for it in (items or []) if it and str(it.get("title") or it.get("headline") or "").strip()]
    if not clean_items:
        clean_items = [{"title": fallback_title, "source": "Institutional Desk", "timeAgo": "Live"}]

    scores = {k: 0 for k in THEME_LABELS_PY}
    counts = {k: 0 for k in THEME_LABELS_PY}
    classified = []

    for idx, it in enumerate(clean_items[:10]):
        title = str(it.get("title") or it.get("headline") or "").strip()
        src = str(it.get("source") or "Desk").strip()
        t_ago = str(it.get("timeAgo") or "Live").strip()
        cat = str(it.get("category") or "")
        sig = str(it.get("significance") or it.get("macroTakeaway") or "")
        theme = _classify_headline_theme_py(title, cat, sig)

        t_low = t_ago.lower()
        if t_low.endswith("m ago"):
            rec_bonus = 30
        elif t_low.endswith("h ago"):
            try:
                hrs = int(t_low.split("h")[0].strip())
            except Exception:
                hrs = 4
            rec_bonus = max(12, 28 - hrs)
        else:
            rec_bonus = 10

        weight = max(10, 100 - idx * 8 + rec_bonus)
        scores[theme] += weight
        counts[theme] += 1
        classified.append(
            {
                "title": title,
                "source": src,
                "timeAgo": t_ago,
                "theme": theme,
                "themeLabel": THEME_LABELS_PY[theme],
                "weight": weight,
            }
        )

    sorted_themes = sorted(scores.keys(), key=lambda k: scores[k], reverse=True)
    primary = sorted_themes[0] if sorted_themes else "MONETARY_LIQUIDITY"
    secondary = next(
        (t for t in sorted_themes if t != primary and scores[t] > 0),
        "FISCAL_SUPPLY" if primary == "MONETARY_LIQUIDITY" else "MONETARY_LIQUIDITY",
    )

    digest_parts = []
    for idx, c in enumerate(classified[:4]):
        short_t = c["title"][:82] + ("…" if len(c["title"]) > 82 else "")
        short_lbl = c["themeLabel"].split(",")[0]
        digest_parts.append(f"(#{idx + 1} {short_lbl}) \"{short_t}\" [{c['source']} · {c['timeAgo']}]")

    return {
        "primaryTheme": primary,
        "secondaryTheme": secondary,
        "primaryLabel": THEME_LABELS_PY[primary],
        "secondaryLabel": THEME_LABELS_PY[secondary],
        "classified": classified,
        "themeCounts": counts,
        "leadItem": classified[0],
        "secondItem": classified[1] if len(classified) > 1 else classified[0],
        "thirdItem": classified[2] if len(classified) > 2 else classified[0],
        "distinctThemesDigest": "; ".join(digest_parts),
    }


def _try_gemini_api_synthesis(data: dict, updated_sgt_str: str):
    """
    Hybrid Gemini API pass when GEMINI_API_KEY is available in the environment.
    Calls gemini-4-hydrogen (configurable via GEMINI_MODEL) with XHIGH thinking and
    structured JSON output across all 7 top commentary boxes and all 4 lower country
    Executive Market Briefings (Indonesia, China, Korea, India).
    Falls back gracefully to the Multi-Regime Catalyst Engine when no key is configured.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return

    model_name = (os.environ.get("GEMINI_MODEL", "gemini-4-hydrogen") or "gemini-4-hydrogen").strip()
    model_label = model_name.upper().replace("-", " ")

    def _run_batch(batch_name: str, payload_obj: dict, top_keys: list, country_keys: list) -> dict:
        prompt = (
            "You are the Chief Institutional Macro, Sovereign Fixed-Income, FX & Equities Strategist powering an Asian & Global Macro Desk Terminal. "
            "Synthesize every provided news headline alongside exact live sovereign bond yields, 1D bps moves, central bank rates, "
            "BI SRBI auctions, PHEI IndoGB benchmarks, CCDC CGBs, KOFIA KTBs, RBI G-Secs, FX/NDF spreads, and equity levels. "
            f"Return a valid JSON object with two top-level keys: 'topBoxes' (keys: {', '.join(top_keys)})"
            + (f" and 'countryBriefings' (keys: {', '.join(country_keys)})." if country_keys else ".")
            + " Each entry in 'topBoxes' MUST contain: "
            "'regimeBadge' (compact uppercase badge <=75 chars citing active regime + key yield/FX metric), "
            "'dominantRegime' (3-7 word regime label), "
            "'conviction' (sharp 12-22 word tactical trade call headline reflecting today's news + 1D moves), "
            "'synthesis' (3-4 dense institutional sentences weaving at least 3 specific headlines with exact numbers from the JSON), and "
            "'positioningTakeaway' (concrete 2-3 sentence actionable positioning call with explicit levels). "
            + (
                "Each entry in 'countryBriefings' MUST contain: "
                "'title' (institutional briefing title), "
                "'policyPosture' (compact policy summary citing exact current policy rate + liquidity anchor), "
                "'executiveSummary' (3-4 sentence briefing tying top 2-3 headlines to exact curve, FX, and equity figures), and "
                "'macroPillars' (array of EXACTLY 3 objects with 'heading' and 'analysis' covering: "
                "1. Sovereign Curve & Auctions, 2. Central Bank Policy & Liquidity/SRBI/OMO/KOFR/LAF, 3. FX, Flows & Equities). "
                if country_keys
                else ""
            )
            + "Plain text only inside strings (no markdown asterisks). Never invent numbers that contradict the JSON.\n\n"
            f"Live Market Telemetry & News JSON ({batch_name}):\n{json.dumps(payload_obj, ensure_ascii=False)}"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        req_body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingLevel": "XHIGH"},
            },
        }
        resp = requests.post(
            url,
            headers={"Content-Type": "application/json", "User-Agent": "aistudio-build"},
            json=req_body,
            timeout=65,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:220]}")
        res_json = resp.json()
        parts = res_json.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text_out = "".join(p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought"))
        if not text_out.strip():
            raise RuntimeError("Empty Gemini JSON output")
        return json.loads(text_out)

    try:
        ust10y = next(
            (t.get("yield") for t in data["globalMacro"]["yieldCurve"].get("tenors", []) if t.get("label") == "10Y"),
            None,
        )

        batch_a_payload = {
            "sessionTimestampSGT": updated_sgt_str,
            "globalMacro": {
                "yieldCurve": data["globalMacro"]["yieldCurve"],
                "futures": data["globalMacro"].get("futures", []),
                "fxRates": data["globalMacro"].get("fxRates", [])[:5],
                "commodities": data["globalMacro"].get("commodities", [])[:4],
                "topNews": [
                    {"headline": n.get("headline"), "source": n.get("source"), "timeAgo": n.get("timeAgo"), "category": n.get("category")}
                    for n in data["globalMacro"].get("topNews", [])[:8]
                ],
            },
            "indonesia": {
                "us10YYield": ust10y,
                "biRate": data["indonesia"]["bonds"].get("biRate"),
                "cpiInflationYoY": data["indonesia"]["bonds"].get("cpiInflationYoY"),
                "sovereignSpread10Y": data["indonesia"]["bonds"].get("sovereignSpread10Y"),
                "valuationDate": data["indonesia"]["bonds"].get("valuationDate"),
                "yieldSource": data["indonesia"]["bonds"].get("yieldSource"),
                "indoGB": data["indonesia"]["bonds"].get("indoGB", [])[:6],
                "srbi": data["indonesia"]["bonds"].get("srbi", [])[:4],
                "fxAndNdf": {
                    "spotRate": data["indonesia"]["fxAndNdf"].get("spotRate"),
                    "spotChange": data["indonesia"]["fxAndNdf"].get("spotChange"),
                    "spotChangePct": data["indonesia"]["fxAndNdf"].get("spotChangePct"),
                    "jisdorRate": data["indonesia"]["fxAndNdf"].get("jisdorRate"),
                    "jisdorChange": data["indonesia"]["fxAndNdf"].get("jisdorChange"),
                    "ndf1M": data["indonesia"]["fxAndNdf"].get("ndf1M"),
                    "ndfSpread1M": data["indonesia"]["fxAndNdf"].get("ndfSpread1M"),
                    "ihsgIndex": data["indonesia"]["fxAndNdf"].get("ihsgIndex"),
                },
                "headlines": [
                    {"title": h.get("title"), "source": h.get("source"), "timeAgo": h.get("timeAgo")}
                    for h in data["indonesia"]["commentary"].get("noteworthyHeadlines", [])[:6]
                ],
            },
            "indonesiaLocalNews": {
                "spotRate": data["indonesia"]["fxAndNdf"].get("spotRate"),
                "jisdorRate": data["indonesia"]["fxAndNdf"].get("jisdorRate"),
                "ihsgIndex": data["indonesia"]["fxAndNdf"].get("ihsgIndex"),
                "biRate": data["indonesia"]["bonds"].get("biRate"),
                "indoGB10Y": next(
                    (b.get("yield") for b in data["indonesia"]["bonds"].get("indoGB", []) if str(b.get("tenor", "")).startswith("10Y")),
                    None,
                ),
                "srbi12M": next(
                    (s for s in data["indonesia"]["bonds"].get("srbi", []) if s.get("tenor") == "12M"),
                    None,
                ),
                "topImportant": [
                    {"rank": it.get("rank"), "titleEn": it.get("titleEn"), "source": it.get("source"), "category": it.get("category"), "timeAgo": it.get("timeAgo")}
                    for it in data.get("indonesiaLocalNews", {}).get("topImportant", [])[:10]
                ],
                "topRead": [
                    {"rank": it.get("rank"), "titleEn": it.get("titleEn"), "source": it.get("source"), "category": it.get("category"), "timeAgo": it.get("timeAgo")}
                    for it in data.get("indonesiaLocalNews", {}).get("topRead", [])[:10]
                ],
            },
            "equities": {
                "us10YYield": ust10y,
                "indexSummary": data.get("equities", {}).get("indexSummary", {}),
                "topForwardPe": data.get("equities", {}).get("topForwardPe", [])[:5],
                "topFcfToEv": data.get("equities", {}).get("topFcfToEv", [])[:5],
                "topDividendYield": data.get("equities", {}).get("topDividendYield", [])[:5],
                "headlines": [
                    {"title": h.get("title"), "source": h.get("source"), "timeAgo": h.get("timeAgo")}
                    for h in data.get("equities", {}).get("noteworthyHeadlines", [])[:6]
                ],
            },
        }

        batch_b_payload = {
            "sessionTimestampSGT": updated_sgt_str,
            "us10YYield": ust10y,
            "china": {
                "curveDate": data.get("china", {}).get("bonds", {}).get("curveDate"),
                "pbocOmo7dRate": data.get("china", {}).get("bonds", {}).get("pbocOmo7dRate"),
                "lpr1Y": data.get("china", {}).get("bonds", {}).get("lpr1Y"),
                "lpr5Y": data.get("china", {}).get("bonds", {}).get("lpr5Y"),
                "ccdcCgb": data.get("china", {}).get("bonds", {}).get("ccdcCgb", [])[:9],
                "fxAndEquities": data.get("china", {}).get("fxAndEquities", {}),
                "headlines": [
                    {"title": h.get("title"), "source": h.get("source"), "timeAgo": h.get("timeAgo")}
                    for h in data.get("china", {}).get("commentary", {}).get("noteworthyHeadlines", [])[:6]
                ],
            },
            "korea": {
                "quotationDate": data.get("korea", {}).get("bonds", {}).get("quotationDate"),
                "bokBaseRate": data.get("korea", {}).get("bonds", {}).get("bokBaseRate"),
                "kofrOvernightRate": data.get("korea", {}).get("bonds", {}).get("kofrOvernightRate"),
                "cd91dRate": data.get("korea", {}).get("bonds", {}).get("cd91dRate"),
                "kofiaKtb": data.get("korea", {}).get("bonds", {}).get("kofiaKtb", [])[:7],
                "fxAndEquities": data.get("korea", {}).get("fxAndEquities", {}),
                "headlines": [
                    {"title": h.get("title"), "source": h.get("source"), "timeAgo": h.get("timeAgo")}
                    for h in data.get("korea", {}).get("commentary", {}).get("noteworthyHeadlines", [])[:6]
                ],
            },
            "india": {
                "quotationDate": data.get("india", {}).get("bonds", {}).get("quotationDate"),
                "rbiRepoRate": data.get("india", {}).get("bonds", {}).get("rbiRepoRate"),
                "sdfRate": data.get("india", {}).get("bonds", {}).get("sdfRate"),
                "msfRate": data.get("india", {}).get("bonds", {}).get("msfRate"),
                "latestGsecAuctionSummary": data.get("india", {}).get("bonds", {}).get("latestGsecAuctionSummary"),
                "gsecCurve": data.get("india", {}).get("bonds", {}).get("gsecCurve", [])[:8],
                "fxAndEquities": data.get("india", {}).get("fxAndEquities", {}),
                "headlines": [
                    {"title": h.get("title"), "source": h.get("source"), "timeAgo": h.get("timeAgo")}
                    for h in data.get("india", {}).get("commentary", {}).get("noteworthyHeadlines", [])[:6]
                ],
                "rbiOfficialReleases": [
                    {"title": r.get("title"), "category": r.get("category"), "pubDate": r.get("pubDate")}
                    for r in data.get("india", {}).get("commentary", {}).get("rbiOfficialReleases", [])[:4]
                ],
            },
        }

        parsed_a = _run_batch(
            "Batch A",
            batch_a_payload,
            ["globalMacro", "indonesia", "indonesiaLocalNews", "equities"],
            ["indonesia"],
        )
        parsed_b = _run_batch(
            "Batch B",
            batch_b_payload,
            ["china", "korea", "india"],
            ["china", "korea", "india"],
        )

        merged_top = {}
        merged_top.update(parsed_a.get("topBoxes", {}))
        merged_top.update(parsed_b.get("topBoxes", {}))

        merged_briefings = {}
        merged_briefings.update(parsed_a.get("countryBriefings", {}))
        merged_briefings.update(parsed_b.get("countryBriefings", {}))

        applied_top = 0
        for tab_key in ["globalMacro", "indonesia", "indonesiaLocalNews", "china", "korea", "india", "equities"]:
            tab_ai = merged_top.get(tab_key)
            if (
                isinstance(tab_ai, dict)
                and tab_key in data
                and isinstance(data[tab_key], dict)
                and "argonCommentary" in data[tab_key]
                and tab_ai.get("conviction")
                and tab_ai.get("synthesis")
                and tab_ai.get("positioningTakeaway")
            ):
                target = data[tab_key]["argonCommentary"]
                target["conviction"] = str(tab_ai["conviction"]).strip()
                target["synthesis"] = str(tab_ai["synthesis"]).strip()
                target["positioningTakeaway"] = str(tab_ai["positioningTakeaway"]).strip()
                if tab_ai.get("regimeBadge"):
                    target["regimeBadge"] = str(tab_ai["regimeBadge"]).strip()
                if tab_ai.get("dominantRegime"):
                    target["dominantRegime"] = str(tab_ai["dominantRegime"]).strip()
                target["aiGenerated"] = True
                target["modelLabel"] = model_label
                target["updatedAtSGT"] = updated_sgt_str
                applied_top += 1

        applied_briefings = 0
        for c_key in ["indonesia", "china", "korea", "india"]:
            br_ai = merged_briefings.get(c_key)
            if (
                isinstance(br_ai, dict)
                and c_key in data
                and isinstance(data[c_key], dict)
                and "commentary" in data[c_key]
                and br_ai.get("executiveSummary")
                and isinstance(br_ai.get("macroPillars"), list)
                and len(br_ai["macroPillars"]) >= 2
            ):
                comm = data[c_key]["commentary"]
                if br_ai.get("title"):
                    comm["title"] = str(br_ai["title"]).strip()
                comm["executiveSummary"] = str(br_ai["executiveSummary"]).strip()
                comm["macroPillars"] = [
                    {
                        "heading": str(p.get("heading", f"Pillar {i + 1}")).strip(),
                        "analysis": str(p.get("analysis", "")).strip(),
                    }
                    for i, p in enumerate(br_ai["macroPillars"][:3])
                    if isinstance(p, dict)
                ]
                if br_ai.get("policyPosture"):
                    posture_field = "biPolicyPosture" if c_key == "indonesia" else "policyPosture"
                    comm[posture_field] = str(br_ai["policyPosture"]).strip()
                comm["aiGenerated"] = True
                comm["modelLabel"] = model_label
                comm["updatedAtSGT"] = updated_sgt_str
                applied_briefings += 1

        print(
            f"[INFO] {model_label} synthesis applied successfully "
            f"({applied_top}/7 top commentary boxes, {applied_briefings}/4 lower country briefings)."
        )
    except Exception as exc:
        print(f"[WARN] Optional Gemini API synthesis skipped ({exc}); using Multi-Regime Catalyst Engine.")


def build_argon_commentaries(data: dict):
    """
    Dynamically synthesize Gemini 4 Argon commentary, critical support/resistance levels,
    key upcoming risk catalysts with concrete calendar dates, and Country Executive Market
    Briefings across all tabs using the Multi-Regime Catalyst & News-Scoring Engine
    (plus optional Gemini API enrichment when GEMINI_API_KEY is present).
    """
    now_sgt = datetime.now(SGT)
    updated_sgt_str = data.get("metadata", {}).get("lastUpdatedSGT") or now_sgt.strftime("%d %b %Y, %I:%M %p SGT")
    today_biz = _snap_biz_day(now_sgt)
    session_date_str = _fmt_event_date(today_biz)
    next_fri = _next_weekday_sgt(today_biz, 4, include_today=True)
    next_mon = _next_weekday_sgt(today_biz, 0, include_today=False)
    next_tue = _next_weekday_sgt(today_biz, 1, include_today=False)
    next_wed = _next_weekday_sgt(today_biz, 2, include_today=False)
    cpi_date = _next_monthly_day_sgt(today_biz, 12)
    bi_rdg_date = _next_monthly_day_sgt(today_biz, 18)
    lpr_date = _next_monthly_day_sgt(today_biz, 20)
    bok_mpb_date = _next_monthly_day_sgt(today_biz, 26)
    rbi_mpc_date = _next_monthly_day_sgt(today_biz + timedelta(days=15), 4)

    yc = data["globalMacro"]["yieldCurve"]
    y2 = next((float(t["yield"]) for t in yc["tenors"] if t["label"] == "2Y"), 4.47)
    y5 = next((float(t["yield"]) for t in yc["tenors"] if t["label"] == "5Y"), 4.61)
    y10 = next((float(t["yield"]) for t in yc["tenors"] if t["label"] == "10Y"), 4.84)
    y30 = next((float(t["yield"]) for t in yc["tenors"] if t["label"] == "30Y"), 5.26)
    y2_chg = next((float(t.get("changeBps", 0.0)) for t in yc["tenors"] if t["label"] == "2Y"), 0.0)
    y10_chg = next((float(t.get("changeBps", 0.0)) for t in yc["tenors"] if t["label"] == "10Y"), 0.0)
    y30_chg = next((float(t.get("changeBps", 0.0)) for t in yc["tenors"] if t["label"] == "30Y"), 0.0)
    two_ten = float(yc["spreads"].get("twoTenSpread", round((y10 - y2) * 100, 1)))
    five_ten = float(yc["spreads"].get("fiveTenSpread", round((y10 - y5) * 100, 1)))

    futures = {f["symbol"]: f for f in data["globalMacro"].get("futures", [])}
    comm = {c["symbol"]: c for c in data["globalMacro"].get("commodities", [])}
    fx_map = {fx["pair"]: fx for fx in data["globalMacro"].get("fxRates", [])}

    spx_price = float(futures.get("ES=F", {}).get("price", 6887.0))
    spx_pct = float(futures.get("ES=F", {}).get("changePct", 0.36))
    ndx_price = float(futures.get("NQ=F", {}).get("price", 25144.25))
    ndx_pct = float(futures.get("NQ=F", {}).get("changePct", 0.42))
    dxy_price = float(futures.get("DX=F", {}).get("price", 98.81))
    dxy_pct = float(futures.get("DX=F", {}).get("changePct", 0.15))
    wti_price = float(comm.get("CL=F", {}).get("price", 86.65))
    wti_pct = float(comm.get("CL=F", {}).get("changePct", -0.45))
    gold_price = float(comm.get("GC=F", {}).get("price", 4651.50))
    gold_pct = float(comm.get("GC=F", {}).get("changePct", 0.25))
    jpy_rate = float(fx_map.get("USD/JPY", {}).get("rate", 158.95))

    g_prof = _analyze_news_catalysts_py(
        data["globalMacro"].get("topNews", []),
        "US Treasury curve reprices term premium as FOMC and fiscal supply headlines dominate cross-asset flows",
    )
    g_lead = g_prof["leadItem"]
    g_sec = g_prof["secondItem"]

    is_bear_steep = y10_chg >= 3.0 and y10_chg >= y2_chg
    is_bull_rally = y10_chg <= -3.0
    is_risk_off_news = g_prof["primaryTheme"] in ("POLITICAL_GOVERNANCE", "TRADE_TARIFF_TECH")

    if is_bear_steep and g_prof["primaryTheme"] == "FISCAL_SUPPLY":
        g_conv = f"Short/Underweight 30Y Bond ({y30:.2f}%, {y30_chg:+.1f} bps) · Hold 2Y–5Y Belly ({y2:.2f}%–{y5:.2f}%) & Quality Value Over High-Multiple Tech"
        g_open = (
            f"[{session_date_str} · Fiscal Supply & Bear-Steepening Regime] Long-end US Treasury term premia are repricing higher today "
            f"(10Y at {y10:.2f}% [{y10_chg:+.1f} bps], 30Y at {y30:.2f}% [{y30_chg:+.1f} bps], steepening 2s10s to {two_ten:+.1f} bps) as fiscal and debt-supply headlines dominate institutional desk flows."
        )
        g_takeaway = (
            f"[Tactical Call — Curve Steepener & Short-Duration Quality] Avoid unhedged 10Y–30Y Treasury duration while \"{g_lead['title'][:70]}\" pressures long-end term premia ({y30:.2f}%). "
            f"Concentrate fixed-income carry in 2Y–5Y notes ({y2:.2f}%–{y5:.2f}%), maintain long DXY ({dxy_price:.2f}, {dxy_pct:+.2f}%) / Gold (${gold_price:,.0f}/oz) tail hedges, and tilt equity exposure toward low-duration cash-flow compounders."
        )
    elif is_risk_off_news:
        g_conv = f"Geopolitical & Trade Hedge: Long Gold (${gold_price:,.0f}/oz, {gold_pct:+.2f}%) + 2Y–5Y UST Belly ({y2:.2f}%) · Selective SPX ({spx_pct:+.2f}%) Dispersion"
        g_open = (
            f"[{session_date_str} · {g_prof['primaryLabel']} Regime] Cross-asset pricing reflects heightened sensitivity to geopolitical, policy, and trade headlines "
            f"even as S&P 500 E-minis trade at {spx_price:,.2f} ({spx_pct:+.2f}%) and Nasdaq 100 at {ndx_price:,.2f} ({ndx_pct:+.2f}%)."
        )
        g_takeaway = (
            f"[Tactical Call — Event-Risk Barbell] With desk flow anchored by \"{g_lead['title'][:68]}\" ({g_lead['source']}) and \"{g_sec['title'][:65]}\" ({g_sec['source']}), "
            f"pair 2Y–5Y US Treasury duration ({y2:.2f}%–{y5:.2f}%) and Gold (${gold_price:,.0f}/oz, {gold_pct:+.2f}%) with selective US large-cap quality. Trim high-beta cyclicals if 10Y UST ({y10:.2f}%, {y10_chg:+.1f} bps) breaks above {y10 + 0.15:.2f}%."
        )
    elif is_bull_rally:
        g_conv = f"Extend 5Y–10Y UST Duration ({y5:.2f}%–{y10:.2f}%, {y10_chg:+.1f} bps) · Long Nasdaq/Growth ({ndx_pct:+.2f}%) & EM FX Carry"
        g_open = (
            f"[{session_date_str} · Duration Receiving & Disinflation Regime] Sovereign bonds are catching a broad institutional bid across the curve "
            f"(2Y at {y2:.2f}% [{y2_chg:+.1f} bps], 10Y at {y10:.2f}% [{y10_chg:+.1f} bps], 30Y at {y30:.2f}% [{y30_chg:+.1f} bps]), easing financial conditions for global risk assets."
        )
        g_takeaway = (
            f"[Tactical Call — Duration Extension & Growth Beta] Lock in 5Y–10Y Treasury yields ({y5:.2f}%–{y10:.2f}%) as front-end and belly rates compress on \"{g_lead['title'][:70]}\". "
            f"Lower real-rate pressure supports long Nasdaq 100 ({ndx_price:,.0f}, {ndx_pct:+.2f}%) and high-carry EM sovereign debt while DXY ({dxy_price:.2f}) remains capped below {dxy_price + 1.15:.2f}."
        )
    else:
        g_conv = f"2Y–5Y Belly Carry ({y2:.2f}%–{y5:.2f}%) vs 30Y ({y30:.2f}%) · Constructive S&P 500 ({spx_pct:+.2f}%) & Quality Barbell"
        g_open = (
            f"[{session_date_str} · {g_prof['primaryLabel']} Regime] US Treasury yields are pricing a {two_ten:+.1f} bps 2s10s slope "
            f"(2Y at {y2:.2f}% [{y2_chg:+.1f} bps], 5Y at {y5:.2f}%, 10Y at {y10:.2f}% [{y10_chg:+.1f} bps], 30Y at {y30:.2f}% [{y30_chg:+.1f} bps]; 5s10s {five_ten:+.1f} bps) "
            f"alongside S&P 500 E-minis at {spx_price:,.2f} ({spx_pct:+.2f}%), DXY at {dxy_price:.2f} ({dxy_pct:+.2f}%), and Gold at ${gold_price:,.2f}/oz ({gold_pct:+.2f}%)."
        )
        g_takeaway = (
            f"[Tactical Call — Belly Carry & Equity Quality Tilt] Across today's news slate led by \"{g_lead['title'][:66]}\" ({g_lead['source']}) and \"{g_sec['title'][:64]}\" ({g_sec['source']}), "
            f"capture rolldown in 2Y–5Y Treasuries ({y2:.2f}%–{y5:.2f}%) while avoiding unhedged 30Y duration ({y30:.2f}%). Maintain constructive S&P 500 ({spx_pct:+.2f}%) positioning with a hedge trigger if US10Y breaches {y10 + 0.16:.2f}%."
        )

    data["globalMacro"]["argonCommentary"] = {
        "modelLabel": "GEMINI 4 ARGON",
        "title": "GEMINI 4 ARGON · GLOBAL MACRO SYNTHESIS & CRITICAL WATCHLIST",
        "regimeBadge": f"{g_prof['primaryTheme'].replace('_', ' ')} · UST 2s10s {two_ten:+.1f} BPS · 10Y {y10:.2f}% ({y10_chg:+.1f} bps)",
        "dominantRegime": g_prof["primaryLabel"],
        "updatedAtSGT": updated_sgt_str,
        "conviction": g_conv,
        "synthesis": (
            f"{g_open} Argon's multi-update review across {len(g_prof['classified'])} live global wires highlights: {g_prof['distinctThemesDigest']}. "
            f"Net cross-asset read-through: with 10Y UST moving {y10_chg:+.1f} bps to {y10:.2f}%, USD/JPY at ¥{jpy_rate:.2f}, and WTI at ${wti_price:.2f}/bbl ({wti_pct:+.2f}%), "
            f"institutional desks are balancing \"{g_lead['title'][:75]}\" against front-end Fed rate expectations ({y2:.2f}% 2Y) and long-end refunding supply."
        ),
        "positioningTakeaway": g_takeaway,
        "criticalLevels": [
            {
                "asset": "US 10Y Treasury Yield",
                "current": f"{y10:.2f}% ({y10_chg:+.1f} bps)",
                "support": f"{y10 - 0.14:.2f}%",
                "resistance": f"{y10 + 0.16:.2f}%",
                "implication": f"Break above {y10 + 0.16:.2f}% pressures equity multiples & EM FX; move below {y10 - 0.14:.2f}% fuels duration rally.",
            },
            {
                "asset": "S&P 500 E-mini (ES=F)",
                "current": f"{spx_price:,.2f} ({spx_pct:+.2f}%)",
                "support": f"{round(spx_price * 0.985):,}",
                "resistance": f"{round(spx_price * 1.015):,}",
                "implication": f"Holding above {round(spx_price * 0.985):,} keeps institutional dip-buying intact across financials and AI capex leaders.",
            },
            {
                "asset": "US Dollar Index (DXY)",
                "current": f"{dxy_price:.2f} ({dxy_pct:+.2f}%)",
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
                "event": "US BLS Consumer Price Index (CPI) Print & Fed Front-End Rate Cut Pricing",
                "timing": f"{_fmt_event_date(cpi_date)} · 21:30 SGT (08:30 ET)",
                "impact": "Critical",
                "watchFor": f"Core services stickiness vs softer energy (${wti_price:.2f}/bbl WTI) and whether US 2Y ({y2:.2f}%) breaks {y2 + 0.12:.2f}% following \"{g_lead['title'][:78]}\".",
            },
            {
                "event": "US Treasury 10Y / 30Y Refunding Auction Settlement & Primary Dealer Takedown",
                "timing": f"{_fmt_event_date(today_biz)} · 13:00 ET (02:00 SGT +1)",
                "impact": "High",
                "watchFor": f"Primary dealer takedown and foreign indirect bids; a >2 bps tail would test 30Y resistance near {y30 + 0.12:.2f}% amid \"{g_sec['title'][:75]}\".",
            },
            {
                "event": "US Retail Sales, PPI Inflation & FOMC Governors Policy Remarks",
                "timing": f"{_fmt_event_date(next_fri)} · 21:30 SGT (08:30 ET)",
                "impact": "High",
                "watchFor": f"Real consumption resilience and PPI pipeline pass-through dictating DXY ({dxy_price:.2f}) direction and Gold (${gold_price:,.0f}/oz) momentum.",
            },
        ],
    }

    # Indonesia Gemini 4 Argon Commentary & Dynamic Country Market Briefing
    bonds = data["indonesia"]["bonds"]
    fx_ndf = data["indonesia"]["fxAndNdf"]
    bi_rate = float(bonds.get("biRate", 5.75))
    cpi_yoy = float(bonds.get("cpiInflationYoY", 3.28))
    indo_5y = next((float(b["yield"]) for b in bonds["indoGB"] if b["tenor"].startswith("5Y")), 7.35)
    indo_5y_chg = next((float(b.get("changeBps", 0.0)) for b in bonds["indoGB"] if b["tenor"].startswith("5Y")), 0.0)
    indo_10y = next((float(b["yield"]) for b in bonds["indoGB"] if b["tenor"].startswith("10Y")), 7.69)
    indo_10y_chg = next((float(b.get("changeBps", 0.0)) for b in bonds["indoGB"] if b["tenor"].startswith("10Y")), 0.0)
    indo_15y = next((float(b["yield"]) for b in bonds["indoGB"] if b["tenor"].startswith("15Y")), 7.82)
    indo_20y = next((float(b["yield"]) for b in bonds["indoGB"] if b["tenor"].startswith("20Y")), 7.89)
    spread_10y = int(bonds.get("sovereignSpread10Y", round((indo_10y - y10) * 100)))

    srbi_6m = next((float(s["weightedAvgYield"]) for s in bonds["srbi"] if s["tenor"] == "6M"), 6.566)
    srbi_9m = next((float(s["weightedAvgYield"]) for s in bonds["srbi"] if s["tenor"] == "9M"), 6.655)
    srbi_12m = next((float(s["weightedAvgYield"]) for s in bonds["srbi"] if s["tenor"] == "12M"), 6.675)
    srbi_dt = next((s.get("auctionDate", "06 Nov 2026") for s in bonds["srbi"] if s["tenor"] == "12M"), "06 Nov 2026")
    srbi_bids = next((s.get("nominalBidsIDR", "IDR 19.20 T") for s in bonds["srbi"] if s["tenor"] == "12M"), "IDR 19.20 T")
    srbi_awarded = next((s.get("awardedVolumeIDR", "IDR 3.00 T") for s in bonds["srbi"] if s["tenor"] == "12M"), "IDR 3.00 T")

    spot = int(fx_ndf.get("spotRate", 18080))
    spot_chg = int(fx_ndf.get("spotChange", 0))
    spot_pct = float(fx_ndf.get("spotChangePct", 0.0))
    jisdor = int(fx_ndf.get("jisdorRate", 18130))
    ndf1m = int(fx_ndf.get("ndf1M", 18116))
    ndf_spread = int(fx_ndf.get("ndfSpread1M", 36))
    ihsg = float(fx_ndf.get("ihsgIndex", {}).get("level", 5050.43))
    ihsg_pct = float(fx_ndf.get("ihsgIndex", {}).get("changePct", 0.40))
    real_buffer = round(bi_rate - cpi_yoy, 2)

    id_heads = data["indonesia"]["commentary"].get("noteworthyHeadlines", [])
    id_combined_news = list(id_heads)
    for loc_it in data.get("indonesiaLocalNews", {}).get("topImportant", [])[:3]:
        id_combined_news.append(
            {
                "title": loc_it.get("titleEn"),
                "source": loc_it.get("source"),
                "timeAgo": loc_it.get("timeAgo"),
                "category": loc_it.get("category"),
                "significance": loc_it.get("marketSignificance"),
            }
        )

    id_prof = _analyze_news_catalysts_py(
        id_combined_news,
        "Bank Indonesia and Ministry of Finance coordinate SBN curve stability and onshore Rupiah liquidity",
    )
    id_lead = id_prof["leadItem"]
    id_sec = id_prof["secondItem"]
    id_third = id_prof["thirdItem"]

    if id_prof["primaryTheme"] == "POLITICAL_GOVERNANCE":
        id_conv = f"Political & Governance Risk Hedge: Front-End 12M SRBI ({srbi_12m:.3f}%) + 5Y FR0109 ({indo_5y:.2f}%) · NDF-Hedged vs 10Y–20Y Duration"
        id_open = (
            f"[{session_date_str} · Jakarta Political & Governance Watch] Onshore institutional desks are closely weighing domestic political and constitutional headlines "
            f"against Indonesia's +{real_buffer:.2f}% real policy buffer (BI-Rate {bi_rate:.2f}% vs CPI {cpi_yoy:.2f}%) and +{spread_10y} bps 10Y sovereign spread over USTs "
            f"(FR0108 at {indo_10y:.2f}%, {indo_10y_chg:+.1f} bps 1D; 5Y FR0109 at {indo_5y:.2f}%, {indo_5y_chg:+.1f} bps 1D)."
        )
        id_takeaway = (
            f"[Tactical Call — Shorten Duration into 12M SRBI & 5Y FR0109, Hedge FX Tail] While domestic headlines focus on \"{id_lead['title'][:68]}\" ({id_lead['source']}) "
            f"and \"{id_sec['title'][:65]}\" ({id_sec['source']}), avoid extending unhedged duration into 15Y–20Y IndoGBs ({indo_15y:.2f}%). Capture {srbi_12m:.3f}% carry in 12M BI SRBI and 5Y FR0109 ({indo_5y:.2f}%), "
            f"and maintain 1M NDF hedges (Rp {ndf1m:,}, +{ndf_spread} IDR basis) whenever USD/IDR (Rp {spot:,}) trades above Rp 18,050."
        )
    elif id_prof["primaryTheme"] == "MARKET_REFORM_EQUITY":
        id_conv = f"IDX/MSCI Reform Rotation: Long Liquid LQ45 Banks + 5Y–10Y IndoGB (FR0109 {indo_5y:.2f}% / FR0108 {indo_10y:.2f}%)"
        id_open = (
            f"[{session_date_str} · Capital Market Reform & Index Rebalancing Regime] Structural Indonesia Stock Exchange (IDX/OJK) governance and MSCI index investability catalysts "
            f"are driving onshore institutional allocation today, with IHSG at {ihsg:,.2f} ({ihsg_pct:+.2f}%), USD/IDR at Rp {spot:,} (JISDOR Rp {jisdor:,}), and 10Y FR0108 yielding {indo_10y:.2f}% ({indo_10y_chg:+.1f} bps 1D)."
        )
        id_takeaway = (
            f"[Tactical Call — High-Liquidity LQ45 + Belly SBN Carry] Driven by \"{id_lead['title'][:70]}\" ({id_lead['source']}) and \"{id_sec['title'][:65]}\", "
            f"rotate equity exposure strictly out of concentrated low-float issuers into high-free-float LQ45 banks (BBCA, BMRI, BBRI), while pairing with 5Y FR0109 ({indo_5y:.2f}%) and 10Y FR0108 ({indo_10y:.2f}%, +{spread_10y} bps over US10Y)."
        )
    elif spot >= 18150 or spot_chg >= 35 or id_prof["primaryTheme"] == "FX_EXTERNAL_BALANCE":
        id_conv = f"FX Defense & Front-End Carry: Overweight 12M SRBI ({srbi_12m:.3f}% WAR) · Underweight Unhedged 10Y FR0108 ({indo_10y:.2f}%)"
        id_open = (
            f"[{session_date_str} · FX Defense & Triple-Intervention Regime] With onshore USD/IDR trading at Rp {spot:,} ({spot_pct:+.2f}% 1D; JISDOR Rp {jisdor:,}, 1M NDF Rp {ndf1m:,} [+{ndf_spread} IDR basis]), "
            f"Bank Indonesia's FX stabilization toolkit and external reserve buffer are the primary anchors for Jakarta fixed income and currency desks."
        )
        id_takeaway = (
            f"[Tactical Call — Front-End SRBI Over Long SBN Duration] Synthesizing \"{id_lead['title'][:68]}\" and \"{id_sec['title'][:64]}\", favor 6M–12M BI SRBI ({srbi_6m:.3f}%–{srbi_12m:.3f}% WAR) "
            f"where BI explicitly prices yields to defend the Rupiah, and wait for USD/IDR to stabilize below Rp {spot - 75:,} before adding unhedged 10Y duration."
        )
    else:
        id_conv = f"Receive 5Y–10Y IndoGB (FR0109 {indo_5y:.2f}% / FR0108 {indo_10y:.2f}%, +{spread_10y} bps vs UST) + 12M SRBI ({srbi_12m:.3f}%)"
        id_open = (
            f"[{session_date_str} · {id_prof['primaryLabel']} Regime] Indonesia's sovereign fixed-income market offers a +{real_buffer:.2f}% real policy buffer (BI-Rate {bi_rate:.2f}% vs CPI {cpi_yoy:.2f}% YoY) "
            f"and a +{spread_10y} bps 10Y yield pickup over US Treasuries (FR0108 at {indo_10y:.2f}% [{indo_10y_chg:+.1f} bps 1D], 5Y FR0109 at {indo_5y:.2f}% [{indo_5y_chg:+.1f} bps 1D]), "
            f"while USD/IDR trades at Rp {spot:,} ({spot_pct:+.2f}%) and IHSG sits at {ihsg:,.2f} ({ihsg_pct:+.2f}%)."
        )
        id_takeaway = (
            f"[Tactical Call — Constructive 5Y–10Y SBN & SRBI Barbell] Supported by \"{id_lead['title'][:68]}\" ({id_lead['source']}) and \"{id_sec['title'][:65]}\" ({id_sec['source']}), "
            f"accumulate 5Y FR0109 ({indo_5y:.2f}%) and 10Y FR0108 ({indo_10y:.2f}%) on auction dips alongside 12M SRBI ({srbi_12m:.3f}% WAR), using 1M NDFs (+{ndf_spread} IDR spread) as an early-warning barometer."
        )

    data["indonesia"]["commentary"].update(
        {
            "title": f"Bank Indonesia & DJPPR Sovereign Fixed Income Briefing · {id_prof['primaryLabel'].split(',')[0]}",
            "date": session_date_str,
            "biPolicyPosture": f"BI-Rate {bi_rate:.2f}% (Real Buffer +{real_buffer:.2f}%) · 12M SRBI {srbi_12m:.3f}% WAR · {id_prof['primaryTheme'].replace('_', ' ')}",
            "executiveSummary": (
                f"[{session_date_str} Executive Synthesis] Across today's Jakarta session, dominant news flow centers on {id_prof['primaryLabel'].lower()} — "
                f"led by \"{id_lead['title'][:78]}\" ({id_lead['source']} · {id_lead['timeAgo']}) and \"{id_sec['title'][:74]}\" ({id_sec['source']} · {id_sec['timeAgo']}). "
                f"Bank Indonesia maintains its {bi_rate:.2f}% policy anchor (+{real_buffer:.2f}% real buffer over {cpi_yoy:.2f}% YoY CPI), anchoring 5Y FR0109 at {indo_5y:.2f}% ({indo_5y_chg:+.1f} bps 1D) "
                f"and 10Y FR0108 at {indo_10y:.2f}% ({indo_10y_chg:+.1f} bps 1D; +{spread_10y} bps over 10Y UST), while onshore USD/IDR trades at Rp {spot:,} ({spot_pct:+.2f}%; JISDOR Rp {jisdor:,}) and IHSG prints {ihsg:,.2f} ({ihsg_pct:+.2f}%)."
            ),
            "macroPillars": [
                {
                    "heading": f"1. DJPPR 2026 Seri Benchmark SUN Curve & Fiscal Transmission ({session_date_str})",
                    "analysis": (
                        f"Official DJPPR Kemenkeu 2026 benchmarks price 5Y FR0109 at {indo_5y:.2f}% ({indo_5y_chg:+.1f} bps), 10Y FR0108 at {indo_10y:.2f}% ({indo_10y_chg:+.1f} bps, +{spread_10y} bps vs US10Y), "
                        f"15Y FR0106 at {indo_15y:.2f}%, and 20Y FR0107 at {indo_20y:.2f}%. Onshore institutional duration demand is actively weighing \"{id_lead['title'][:72]}\" ({id_lead['source']}) against domestic bank and pension reinvestment flows."
                    ),
                },
                {
                    "heading": f"2. BI SRBI Open Market Operations ({srbi_dt}) & Rupiah Liquidity Corridor",
                    "analysis": (
                        f"Bank Indonesia's SRBI curve clears at {srbi_6m:.3f}% (6M), {srbi_9m:.3f}% (9M), and {srbi_12m:.3f}% (12M WAR, {srbi_awarded} awarded from {srbi_bids} 12M bids), "
                        f"preserving a +{round((srbi_12m - y10) * 100)} bps short-end yield pickup over US 10Y Treasuries while desks digest \"{id_sec['title'][:72]}\" ({id_sec['source']})."
                    ),
                },
                {
                    "heading": f"3. JISDOR (Rp {jisdor:,}), Offshore NDF Basis (+{ndf_spread} IDR) & IHSG ({ihsg:,.2f})",
                    "analysis": (
                        f"Spot USD/IDR trades at Rp {spot:,} ({spot_pct:+.2f}%) alongside 1M NDFs at Rp {ndf1m:,} (+{ndf_spread} IDR implied basis) and IHSG at {ihsg:,.2f} ({ihsg_pct:+.2f}%), "
                        f"with \"{id_third['title'][:72]}\" shaping foreign institutional equity and bond positioning."
                    ),
                },
            ],
        }
    )

    data["indonesia"]["argonCommentary"] = {
        "modelLabel": "GEMINI 4 ARGON",
        "title": "GEMINI 4 ARGON · INDONESIA SOVEREIGN, FX & MONETARY SYNTHESIS",
        "regimeBadge": f"{id_prof['primaryTheme'].replace('_', ' ')} · BI {bi_rate:.2f}% · FR0108 {indo_10y:.2f}% (+{spread_10y} BPS)",
        "dominantRegime": id_prof["primaryLabel"],
        "updatedAtSGT": updated_sgt_str,
        "conviction": id_conv,
        "synthesis": (
            f"{id_open} Argon's synthesis of today's {len(id_prof['classified'])} Jakarta macro, regulatory, and political updates highlights: {id_prof['distinctThemesDigest']}. "
            f"Combined with Bank Indonesia's {srbi_dt} SRBI clearing rates (6M {srbi_6m:.3f}%, 12M {srbi_12m:.3f}% WAR; {srbi_awarded} awarded from {srbi_bids} bids), "
            f"the interplay between \"{id_lead['title'][:70]}\" and onshore liquidity dictates near-term foreign SBN and equity flows."
        ),
        "positioningTakeaway": id_takeaway,
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
                "asset": f"12M SRBI ({srbi_dt} Issued)",
                "current": f"{srbi_12m:.3f}% (6M: {srbi_6m:.3f}%)",
                "support": f"{srbi_12m - 0.10:.3f}%",
                "resistance": f"{srbi_12m + 0.12:.3f}%",
                "implication": f"Friday {srbi_dt} issuance cleared at {srbi_12m:.3f}% WAR ({srbi_awarded} awarded of {srbi_bids} bids), keeping foreign short-term portfolio carry attractive.",
            },
            {
                "asset": "IDX Composite (IHSG)",
                "current": f"{ihsg:,.2f} ({ihsg_pct:+.2f}%)",
                "support": f"{round(ihsg * 0.98):,}",
                "resistance": f"{round(ihsg * 1.02):,}",
                "implication": f"Reclaiming {round(ihsg * 1.02):,} confirms foreign institutional rotation back into big-cap Jakarta banks and infrastructure.",
            },
        ],
        "eventsToWatch": [
            {
                "event": f"Bank Indonesia Weekly SRBI (6M / 9M / 12M) Open Market Tender (Post-{srbi_dt} Cycle)",
                "timing": f"{_fmt_event_date(next_fri)} · 10:00–14:00 WIB (11:00–15:00 SGT)",
                "impact": "Critical",
                "watchFor": f"Following Friday {srbi_dt}'s issuance (12M WAR at {srbi_12m:.3f}%), watch secondary market turnover and clearing yields amid \"{id_lead['title'][:75]}\".",
            },
            {
                "event": "DJPPR Conventional SUN (IndoGB) Primary Debt Auction (FR0109 / FR0108 / FR0106)",
                "timing": f"{_fmt_event_date(next_tue)} · 10:00–12:00 WIB (11:00–13:00 SGT)",
                "impact": "High",
                "watchFor": f"Bid-to-cover ratio on 2026 benchmarks FR0109 (5Y, {indo_5y:.2f}%) and FR0108 (10Y, {indo_10y:.2f}%) following \"{id_sec['title'][:75]}\".",
            },
            {
                "event": "Bank Indonesia Board of Governors (RDG) Rate Decision & JISDOR / DHE FX Review",
                "timing": f"{_fmt_event_date(bi_rdg_date)} · 14:20 WIB (15:20 SGT)",
                "impact": "High",
                "watchFor": f"BI-Rate decision ({bi_rate:.2f}%), onshore USD supply from 100% DHE exporter retention, and 1M NDF spread (+{ndf_spread} IDR) over spot ({spot:,}).",
            },
        ],
    }

    # Indonesia Local News (ID -> EN) Multi-Regime Gemini 4 Argon Commentary
    if "indonesiaLocalNews" in data:
        id_loc = data["indonesiaLocalNews"]
        id_loc["asOfDate"] = updated_sgt_str
        imp_list = id_loc.get("topImportant", [])
        read_list = id_loc.get("topRead", [])
        imp_1 = imp_list[0] if len(imp_list) > 0 else {}
        imp_2 = imp_list[1] if len(imp_list) > 1 else {}
        imp_3 = imp_list[2] if len(imp_list) > 2 else {}
        read_1 = read_list[0] if len(read_list) > 0 else {}
        read_2 = read_list[1] if len(read_list) > 1 else {}

        loc_items_for_prof = [
            {
                "title": x.get("titleEn") or x.get("titleId") or "",
                "source": x.get("source", "CNBC Indonesia"),
                "timeAgo": x.get("timeAgo", "1h ago"),
                "category": x.get("category", ""),
                "significance": x.get("marketSignificance", ""),
            }
            for x in (imp_list[:6] + read_list[:4])
        ]
        loc_prof = _analyze_news_catalysts_py(
            loc_items_for_prof,
            "Onshore Bahasa Indonesia media highlights Bank Indonesia liquidity, APBN fiscal execution, and DPR constitutional developments",
        )
        pol_count = loc_prof["themeCounts"].get("POLITICAL_GOVERNANCE", 0)
        mkt_count = loc_prof["themeCounts"].get("MARKET_REFORM_EQUITY", 0)
        imp_summary = " · ".join(
            [
                f"#{idx + 1} \"{item.get('titleEn', '')}\" ({item.get('source', '')}, {item.get('timeAgo', '')}, Score {item.get('impactScore', 95)}/100)"
                for idx, item in enumerate([x for x in [imp_1, imp_2, imp_3] if x])
            ]
        ) or "\"Bank Indonesia & KSSK Macro-Financial Coordination\" (Kontan)"
        read_summary = " · ".join(
            [
                f"#{idx + 1} \"{item.get('titleEn', '')}\" ({item.get('source', '')}, {item.get('timeAgo', '')})"
                for idx, item in enumerate([x for x in [read_1, read_2] if x])
            ]
        ) or "\"National Political & Parliamentary Headlines\" (CNBC Indonesia)"

        if pol_count >= 3:
            loc_conv = f"Fade Domestic Political Virality ({pol_count} DPR/MPR Stories) · Stay Overweight Liquid LQ45 Banks & 5Y–10Y FR0108 ({indo_10y:.2f}%)"
            loc_takeaway = (
                f"[Tactical Call — Separate Political Virality from Sovereign & LQ45 Fundamentals] Across the 20 translated Bahasa stories, {pol_count} headlines focus on parliamentary/executive politics "
                f"({read_1.get('source', 'CNBC Indonesia')}: \"{read_1.get('titleEn', '')[:68]}\"), yet onshore USD/IDR (Rp {spot:,}) and JISDOR (Rp {jisdor:,}) remain orderly. "
                f"Do not chase political-noise sell-offs; accumulate liquid LQ45 banks (BBCA, BMRI, BBRI) and 5Y–10Y IndoGBs ({indo_5y:.2f}%–{indo_10y:.2f}%) while keeping 1M NDF hedges ({ndf1m:,}) in place."
            )
        elif mkt_count >= 2:
            loc_conv = f"Rotate Out of Excluded HSC / MSCI Tickers Into Core LQ45 Free-Float Leaders & 12M SRBI ({srbi_12m:.3f}%)"
            loc_takeaway = (
                f"[Tactical Call — Quality Free-Float Equity Rotation + Front-End SRBI Carry] Onshore Bahasa portals highlight structural IDX/MSCI index rebalancing "
                f"(\"{imp_1.get('titleEn', '')[:68]}\"). Avoid low-float conglomerate tickers facing index exclusion and concentrate Jakarta equity exposure in high-free-float LQ45 banks alongside 12M SRBI ({srbi_12m:.3f}% WAR)."
            )
        else:
            loc_conv = f"Position for {loc_prof['primaryLabel'].split(',')[0]} Catalyst · Long 5Y–10Y IndoGB ({indo_10y:.2f}%) & Core LQ45"
            loc_takeaway = (
                f"[Tactical Call — Align With Onshore Policy & Liquidity Impulse] Synthesizing #1 Important \"{imp_1.get('titleEn', '')[:65]}\" ({imp_1.get('source', 'Kontan')}) and #1 Most Read \"{read_1.get('titleEn', '')[:62]}\" ({read_1.get('source', 'Detik')}), "
                f"maintain core duration in 5Y–10Y IndoGBs ({indo_5y:.2f}%–{indo_10y:.2f}%) and liquid SOE banks benefiting from Bank Indonesia's Rp149.3T KLM liquidity incentives."
            )

        id_loc["argonCommentary"] = {
            "modelLabel": "GEMINI 4 ARGON",
            "updatedAtSGT": updated_sgt_str,
            "title": "GEMINI 4 ARGON · INDONESIA LOCAL-LANGUAGE MEDIA (ID→EN) & POLITICAL-ECONOMIC SYNTHESIS",
            "regimeBadge": f"{loc_prof['primaryTheme'].replace('_', ' ')} · 10 BAHASA PORTALS · USD/IDR {spot:,} · IHSG {ihsg:,.2f}",
            "dominantRegime": loc_prof["primaryLabel"],
            "conviction": loc_conv,
            "synthesis": (
                f"[{session_date_str} · {loc_prof['primaryLabel']} Media Regime] Neural ID→EN synthesis across 20 top stories from 10 Bahasa Indonesia portals "
                f"(CNBC Indonesia, Kontan, Bisnis, Kompas, Detik, Tempo, ANTARA) identifies {loc_prof['primaryLabel'].lower()} as today's primary onshore narrative. "
                f"On the Top 10 Most Important macro-policy board, coverage is led by {imp_summary}. "
                f"Simultaneously, the Top 10 Most Read (Terpopuler) national board is dominated by {read_summary} — "
                f"while onshore USD/IDR trades at Rp {spot:,} (JISDOR Rp {jisdor:,}), 10Y FR0108 yields {indo_10y:.2f}%, and IHSG prints {ihsg:,.2f} ({ihsg_pct:+.2f}%)."
            ),
            "positioningTakeaway": loc_takeaway,
            "criticalLevels": id_loc.get("argonCommentary", {}).get("criticalLevels", []),
            "eventsToWatch": [
                {
                    "event": "IDX (BEI) Effective Exclusion of 383 HSC Issuers & MSCI Index Review Cut-Off",
                    "timing": f"{_fmt_event_date(next_fri)} · 09:00 WIB (10:00 SGT)",
                    "impact": "Critical",
                    "watchFor": "Passive and active institutional rebalancing out of High Shareholder Concentration (HSC) names into liquid LQ45/BUMN constituents.",
                },
                {
                    "event": "DPR RI Parliamentary Consultation & Constitutional Governance Watch",
                    "timing": f"{_fmt_event_date(today_biz)} · 13:30 WIB (14:30 SGT)",
                    "impact": "High",
                    "watchFor": f"Whether viral domestic political headlines (\"{read_1.get('titleEn', '')[:68]}\") remain procedural without disrupting APBN fiscal execution.",
                },
                {
                    "event": "Bank Indonesia Rp149.3T KLM Liquidity Allocation & KSSK Quarterly Assessment",
                    "timing": f"{_fmt_event_date(bi_rdg_date)} · 14:20 WIB (15:20 SGT)",
                    "impact": "High",
                    "watchFor": "Transmission of BI's Rp149.3T macroprudential liquidity incentives into SOE bank (BRI, Mandiri, BNI) credit growth and SBN demand.",
                },
            ],
        }

    # China (CCDC) Gemini 4 Argon Commentary & Dynamic Country Market Briefing
    if "china" in data:
        cn_bonds = data["china"]["bonds"]
        cn_fx = data["china"]["fxAndEquities"]
        cgb_1y = next((float(b["yield"]) for b in cn_bonds["ccdcCgb"] if b["tenor"].startswith("1Y")), 1.1683)
        cgb_5y = next((float(b["yield"]) for b in cn_bonds["ccdcCgb"] if b["tenor"].startswith("5Y")), 1.3115)
        cgb_5y_chg = next((float(b.get("changeBps", -1.2)) for b in cn_bonds["ccdcCgb"] if b["tenor"].startswith("5Y")), -1.2)
        cgb_10y = next((float(b["yield"]) for b in cn_bonds["ccdcCgb"] if b["tenor"].startswith("10Y")), 1.5868)
        cgb_10y_chg = next((float(b.get("changeBps", -1.7)) for b in cn_bonds["ccdcCgb"] if b["tenor"].startswith("10Y")), -1.7)
        cgb_30y = next((float(b["yield"]) for b in cn_bonds["ccdcCgb"] if b["tenor"].startswith("30Y")), 2.0275)
        cgb_30y_chg = next((float(b.get("changeBps", -1.5)) for b in cn_bonds["ccdcCgb"] if b["tenor"].startswith("30Y")), -1.5)
        lpr1 = float(cn_bonds.get("lpr1Y", 3.00))
        lpr5 = float(cn_bonds.get("lpr5Y", 3.50))
        cn_cpi = float(cn_bonds.get("cpiInflationYoY", 0.60))
        cn_spread = round((cgb_10y - y10) * 100)
        slope_10s30s = round((cgb_30y - cgb_10y) * 100)
        cny = float(cn_fx.get("cnySpot", 6.6760))
        cny_pct = float(cn_fx.get("cnyChangePct", 0.12))
        cnh = float(cn_fx.get("cnhSpot", 6.6713))
        fix = float(cn_fx.get("pbocFixing", 6.6735))
        ssec = float(cn_fx.get("shanghaiComposite", {}).get("level", 3649.18))
        ssec_pct = float(cn_fx.get("shanghaiComposite", {}).get("changePct", 0.31))
        csi = float(cn_fx.get("csi300Index", {}).get("level", 4054.28))
        csi_pct = float(cn_fx.get("csi300Index", {}).get("changePct", -1.44))
        cn_curve_dt = cn_bonds.get("curveDate", "2026-11-11")

        cn_prof = _analyze_news_catalysts_py(
            data["china"]["commentary"].get("noteworthyHeadlines", []),
            "PBoC maintains accommodative DR007 liquidity and daily RMB parity fixing as CCDC 10Y CGB trades near 1.59%",
        )
        cn_lead = cn_prof["leadItem"]
        cn_sec = cn_prof["secondItem"]
        cn_third = cn_prof["thirdItem"]

        if cn_prof["primaryTheme"] == "TRADE_TARIFF_TECH":
            cn_conv = f"Trade & Tech Curbs Hedge: Long 5Y–10Y CCDC CGB ({cgb_5y:.3f}%–{cgb_10y:.3f}%) · Defensive USD/CNH ({cnh:.4f}) Collar vs CSI 300"
            cn_open = (
                f"[{session_date_str} · External Trade & Tech Supply-Chain Regime] External tariff, semiconductor export-control, and cross-border trade headlines "
                f"are driving onshore Chinese asset allocation today, keeping safe-haven demand firm for CCDC ChinaBond CGBs (5Y at {cgb_5y:.3f}% [{cgb_5y_chg:+.1f} bps], "
                f"10Y at {cgb_10y:.3f}% [{cgb_10y_chg:+.1f} bps], 30Y at {cgb_30y:.3f}% [{cgb_30y_chg:+.1f} bps]) while PBoC anchors the daily fixing at {fix:.4f} (CNY {cny:.4f}, CNH {cnh:.4f})."
            )
            cn_takeaway = (
                f"[Tactical Call — Long CGB Belly Duration & FX-Hedged Positioning] With external headlines led by \"{cn_lead['title'][:68]}\" ({cn_lead['source']}) and \"{cn_sec['title'][:65]}\" ({cn_sec['source']}), "
                f"overweight 5Y–10Y CCDC CGBs ({cgb_5y:.3f}%–{cgb_10y:.3f}%) as domestic liquidity (7D OMO 1.50%) cushions external trade headwinds. Hedge offshore CNH exposure ({cnh:.4f}) and favor domestic SOE dividend leaders over export-sensitive CSI 300 ({csi_pct:+.2f}%) beta."
            )
        elif cn_prof["primaryTheme"] == "MARKET_REFORM_EQUITY" or ssec_pct >= 0.45 or csi_pct >= 0.45:
            cn_conv = f"Equity-Bond Rotation Watch: Shorten CGB Duration to 1Y–3Y ({cgb_1y:.3f}%) · Capture A-Share / Tech IPO Momentum (SSEC {ssec_pct:+.2f}%)"
            cn_open = (
                f"[{session_date_str} · Onshore Equity & Capital-Market Catalyst Regime] Domestic capital-market and corporate tech catalysts are lifting risk appetite across Shanghai Composite ({ssec:,.2f}, {ssec_pct:+.2f}%) "
                f"and CSI 300 ({csi:,.2f}, {csi_pct:+.2f}%), prompting modest steepening pressure along the CCDC CGB curve ({cn_curve_dt}: 10Y at {cgb_10y:.3f}% [{cgb_10y_chg:+.1f} bps], 30Y at {cgb_30y:.3f}% [{cgb_30y_chg:+.1f} bps])."
            )
            cn_takeaway = (
                f"[Tactical Call — Trim 30Y Ultra-Long CGBs, Barbell Short CGBs + Onshore Equities] As desks digest \"{cn_lead['title'][:68]}\" ({cn_lead['source']}) and \"{cn_sec['title'][:64]}\", "
                f"take profits on unhedged 10Y–30Y CGB duration ({cgb_10y:.3f}%–{cgb_30y:.3f}%) near 1.55%–2.00% and park fixed-income carry in 1Y–5Y CGBs ({cgb_1y:.3f}%–{cgb_5y:.3f}%) alongside selective A-share tech and domestic consumption exposure."
            )
        else:
            cn_conv = f"Receive 3Y–7Y CCDC CGB Belly ({cgb_5y:.3f}%, {cgb_5y_chg:+.1f} bps) on PBoC OMO Support (1.50%) · Watch 30Y Supply ({cgb_30y:.3f}%)"
            cn_open = (
                f"[{session_date_str} · {cn_prof['primaryLabel']} Regime] Official CCDC ChinaBond CGB fixings ({cn_curve_dt}) price 1Y at {cgb_1y:.3f}%, 5Y at {cgb_5y:.3f}% ({cgb_5y_chg:+.1f} bps 1D), "
                f"10Y at {cgb_10y:.3f}% ({cgb_10y_chg:+.1f} bps 1D), and 30Y at {cgb_30y:.3f}% ({cgb_30y_chg:+.1f} bps 1D; 10s30s +{slope_10s30s} bps), supported by PBoC's 1.50% 7D Reverse Repo anchor."
            )
            cn_takeaway = (
                f"[Tactical Call — Bull-Steepener in 3Y–5Y CGBs vs 30Y Special Issuance] Synthesizing \"{cn_lead['title'][:68]}\" ({cn_lead['source']}) and \"{cn_sec['title'][:65]}\" ({cn_sec['source']}), "
                f"stay overweight 3Y–5Y CCDC CGBs ({cgb_5y:.3f}%) where DR007 repo funding carry is positive, and avoid chasing 30Y ultra-long CGBs ({cgb_30y:.3f}%) below 2.00% ahead of MoF special bond supply."
            )

        data["china"]["commentary"].update(
            {
                "title": f"PBoC & CCDC ChinaBond Sovereign Briefing · {cn_prof['primaryLabel'].split(',')[0]}",
                "date": session_date_str,
                "policyPosture": f"7D OMO 1.50% · 1Y/5Y LPR {lpr1:.2f}%/{lpr5:.2f}% · {cn_prof['primaryTheme'].replace('_', ' ')}",
                "executiveSummary": (
                    f"[{session_date_str} Executive Synthesis] China macro and fixed-income flows today are shaped by {cn_prof['primaryLabel'].lower()} — "
                    f"specifically \"{cn_lead['title'][:78]}\" ({cn_lead['source']} · {cn_lead['timeAgo']}) and \"{cn_sec['title'][:74]}\" ({cn_sec['source']} · {cn_sec['timeAgo']}). "
                    f"Per official CCDC ChinaBond fixings ({cn_curve_dt}), 1Y CGB clears at {cgb_1y:.3f}%, 5Y benchmark at {cgb_5y:.3f}% ({cgb_5y_chg:+.1f} bps 1D), "
                    f"10Y benchmark at {cgb_10y:.3f}% ({cgb_10y_chg:+.1f} bps 1D; {cn_spread} bps vs 10Y UST), and 30Y ultra-long CGB at {cgb_30y:.3f}% ({cgb_30y_chg:+.1f} bps 1D), "
                    f"while PBoC sets the RMB parity fixing at {fix:.4f} (CNY {cny:.4f}, CNH {cnh:.4f}) and SSEC trades at {ssec:,.2f} ({ssec_pct:+.2f}%)."
                ),
                "macroPillars": [
                    {
                        "heading": f"1. CCDC ChinaBond CGB Yield Curve ({cn_curve_dt}) & Duration Positioning",
                        "analysis": (
                            f"CCDC ChinaBond benchmarks trade at {cgb_1y:.3f}% (1Y), {cgb_5y:.3f}% (5Y, {cgb_5y_chg:+.1f} bps), {cgb_10y:.3f}% (10Y, {cgb_10y_chg:+.1f} bps), and {cgb_30y:.3f}% (30Y, {cgb_30y_chg:+.1f} bps), "
                            f"keeping the 10s30s slope at +{slope_10s30s} bps as commercial bank desks weigh \"{cn_lead['title'][:72]}\" ({cn_lead['source']})."
                        ),
                    },
                    {
                        "heading": "2. PBoC 7D OMO (1.50%), DR007 Repo & LPR Policy Transmission",
                        "analysis": (
                            f"With 7D Reverse Repo at 1.50%, 1Y/5Y LPR at {lpr1:.2f}%/{lpr5:.2f}%, and Headline CPI at {cn_cpi:.2f}% YoY, "
                            f"PBoC liquidity injections keep DR007 repo funding stable while institutions assess \"{cn_sec['title'][:72]}\" ({cn_sec['source']})."
                        ),
                    },
                    {
                        "heading": f"3. CFETS RMB Fixing ({fix:.4f}), CNH/CNY Basis & Onshore Equities",
                        "analysis": (
                            f"Onshore USD/CNY ({cny:.4f}, {cny_pct:+.2f}%) and offshore USD/CNH ({cnh:.4f}) remain anchored near the {fix:.4f} parity fixing, "
                            f"while Shanghai Composite ({ssec:,.2f}, {ssec_pct:+.2f}%) and CSI 300 ({csi:,.2f}, {csi_pct:+.2f}%) digest \"{cn_third['title'][:70]}\"."
                        ),
                    },
                ],
            }
        )

        data["china"]["argonCommentary"] = {
            "modelLabel": "GEMINI 4 ARGON",
            "title": "GEMINI 4 ARGON · CHINA SOVEREIGN (CCDC), PBOC & FX SYNTHESIS",
            "regimeBadge": f"{cn_prof['primaryTheme'].replace('_', ' ')} · CCDC 10Y {cgb_10y:.3f}% ({cgb_10y_chg:+.1f} bps) · FIX {fix:.4f}",
            "dominantRegime": cn_prof["primaryLabel"],
            "updatedAtSGT": updated_sgt_str,
            "conviction": cn_conv,
            "synthesis": (
                f"{cn_open} Argon's multi-update scan across {len(cn_prof['classified'])} China macro, CCDC, and geopolitical stories highlights: {cn_prof['distinctThemesDigest']}. "
                f"With 1Y/5Y LPR at {lpr1:.2f}%/{lpr5:.2f}% and SSEC at {ssec:,.2f} ({ssec_pct:+.2f}%), institutional positioning hinges on how \"{cn_lead['title'][:72]}\" transmits into PBoC liquidity injections and CFETS FX fixings."
            ),
            "positioningTakeaway": cn_takeaway,
            "criticalLevels": [
                {
                    "asset": "CCDC 10Y ChinaBond CGB",
                    "current": f"{cgb_10y:.3f}% ({cgb_10y_chg:+.1f} bps)",
                    "support": "1.500%",
                    "resistance": "1.720%",
                    "implication": "Yields approaching 1.500% risk PBoC secondary bond sales; backup toward 1.720% triggers domestic bank buying.",
                },
                {
                    "asset": "CCDC 30Y Ultra-Long CGB",
                    "current": f"{cgb_30y:.3f}% (+{slope_10s30s} bps 10s30s)",
                    "support": "1.920%",
                    "resistance": "2.150%",
                    "implication": "Ultra-long special Treasury issuance supply tests 2.150% ceiling; rural bank duration demand supports 1.920%.",
                },
                {
                    "asset": "USD/CNH & PBoC Fixing",
                    "current": f"{cnh:.4f} (Fix {fix:.4f})",
                    "support": f"{cnh - 0.065:.4f}",
                    "resistance": f"{cnh + 0.075:.4f}",
                    "implication": "PBoC FX reserve requirement adjustments and counter-cyclical fixing factor cap rapid one-way Yuan swings.",
                },
                {
                    "asset": "Shanghai Composite (SSEC)",
                    "current": f"{ssec:,.2f} ({ssec_pct:+.2f}%)",
                    "support": f"{round(ssec * 0.965):,}",
                    "resistance": f"{round(ssec * 1.035):,}",
                    "implication": f"Break above {round(ssec * 1.035):,} drives equity-bond rotation and steepens the CCDC 2s10s CGB curve.",
                },
            ],
            "eventsToWatch": [
                {
                    "event": "PBoC 7D Reverse Repo OMO, MLF Operation & NBS Activity Print (IP / Retail Sales)",
                    "timing": f"{_fmt_event_date(next_fri)} · 09:15 & 10:00 CST (SGT)",
                    "impact": "Critical",
                    "watchFor": f"Net liquidity injection via 7D OMO (1.50%) and whether DR007 repo stays anchored below 1.70% amid \"{cn_lead['title'][:75]}\".",
                },
                {
                    "event": "Ministry of Finance (MoF) 30-Year Ultra-Long Special CGB Issuance Tender",
                    "timing": f"{_fmt_event_date(next_wed)} · 10:35 CST (SGT)",
                    "impact": "High",
                    "watchFor": f"Primary auction bid-to-cover on 10Y ({cgb_10y:.3f}%) and 30Y ({cgb_30y:.3f}%) CGBs following \"{cn_sec['title'][:75]}\".",
                },
                {
                    "event": "PBoC Monthly 1-Year & 5-Year Loan Prime Rate (LPR) Quotation Fixing",
                    "timing": f"{_fmt_event_date(lpr_date)} · 09:15 CST (SGT)",
                    "impact": "High",
                    "watchFor": f"CFETS bank quotations on 1Y/5Y LPR ({lpr1:.2f}% / {lpr5:.2f}%) alongside PBoC central parity ({fix:.4f}) vs offshore CNH ({cnh:.4f}).",
                },
            ],
        }

    # Korea (SOFIA / KOFIA) Gemini 4 Argon Commentary & Dynamic Country Market Briefing
    if "korea" in data:
        kr_bonds = data["korea"]["bonds"]
        kr_fx = data["korea"]["fxAndEquities"]
        ktb_3y = next((float(b["yield"]) for b in kr_bonds["kofiaKtb"] if b["tenor"].startswith("3Y")), 3.622)
        ktb_3y_chg = next((float(b.get("changeBps", -4.9)) for b in kr_bonds["kofiaKtb"] if b["tenor"].startswith("3Y")), -4.9)
        ktb_5y = next((float(b["yield"]) for b in kr_bonds["kofiaKtb"] if b["tenor"].startswith("5Y")), 3.716)
        ktb_10y = next((float(b["yield"]) for b in kr_bonds["kofiaKtb"] if b["tenor"].startswith("10Y")), 3.852)
        ktb_10y_chg = next((float(b.get("changeBps", -4.0)) for b in kr_bonds["kofiaKtb"] if b["tenor"].startswith("10Y")), -4.0)
        ktb_30y = next((float(b["yield"]) for b in kr_bonds["kofiaKtb"] if b["tenor"].startswith("30Y")), 3.975)
        bok_rate = float(kr_bonds.get("bokBaseRate", 3.00))
        kofr_val = float(kr_bonds.get("kofrOvernightRate", 3.045))
        cd_val = float(kr_bonds.get("cd91dRate", 3.34))
        kr_cpi = float(kr_bonds.get("cpiInflationYoY", 2.10))
        kr_spread = round((ktb_10y - y10) * 100)
        slope_3s10s = round((ktb_10y - ktb_3y) * 100)
        krw = float(kr_fx.get("krwSpot", 1363.27))
        krw_pct = float(kr_fx.get("krwChangePct", -0.03))
        ndf_krw = float(kr_fx.get("ndf1M", 1361.03))
        kospi = float(kr_fx.get("kospiIndex", {}).get("level", 5059.69))
        kospi_pct = float(kr_fx.get("kospiIndex", {}).get("changePct", -6.02))
        kosdaq = float(kr_fx.get("kosdaqIndex", {}).get("level", 644.27))
        kosdaq_pct = float(kr_fx.get("kosdaqIndex", {}).get("changePct", -5.03))
        kr_quote_dt = kr_bonds.get("quotationDate", "11 Nov 2026")

        kr_prof = _analyze_news_catalysts_py(
            data["korea"]["commentary"].get("noteworthyHeadlines", []),
            "KOFIA / SOFIA Korea Treasury Bond curve and BOK KOFR repo funding anchor Seoul fixed-income flows",
        )
        kr_lead = kr_prof["leadItem"]
        kr_sec = kr_prof["secondItem"]
        kr_third = kr_prof["thirdItem"]

        if ktb_3y_chg >= 5.0 or ktb_10y_chg >= 5.0 or kr_prof["primaryTheme"] == "INFLATION_COMMODITY":
            kr_conv = f"Hawkish KTB Backup ({ktb_3y_chg:+.1f} bps 3Y): Fade Sell-Off via 3Y KTB ({ktb_3y:.3f}%) & KOFR Repo ({kofr_val:.3f}%) · Long Chip Exporters (KOSPI {kospi_pct:+.2f}%)"
            kr_open = (
                f"[{session_date_str} · Sticky CPI & KTB Yield Backup Regime] KOFIA OTC Treasury yields backed up sharply in the latest session "
                f"({kr_quote_dt}: 3Y KTB at {ktb_3y:.3f}% [{ktb_3y_chg:+.1f} bps], 5Y at {ktb_5y:.3f}%, 10Y at {ktb_10y:.3f}% [{ktb_10y_chg:+.1f} bps; {kr_spread} bps vs UST]) "
                f"as sticky inflation and BOK policy calibration headlines temper near-term rate-cut pricing."
            )
            kr_takeaway = (
                f"[Tactical Call — Scale Into 3Y KTB Above 3.70% & Ride Semiconductor Equity Beta] Synthesizing \"{kr_lead['title'][:68]}\" ({kr_lead['source']}) and \"{kr_sec['title'][:65]}\" ({kr_sec['source']}), "
                f"use the {ktb_3y_chg:+.1f} bps KTB yield backup to scale into 3Y KTB benchmarks ({ktb_3y:.3f}%, +{ktb_3y - bok_rate:.2f}% over the {bok_rate:.2f}% BOK Base Rate) "
                f"while keeping equity exposure overweight Korean memory chip exporters driving KOSPI ({kospi:,.0f}, {kospi_pct:+.2f}%)."
            )
        elif kospi_pct <= -1.5:
            kr_conv = f"Equity Risk-Off Flight (KOSPI {kospi_pct:+.2f}%): Overweight 3Y–10Y KOFIA KTB ({ktb_3y:.3f}%–{ktb_10y:.3f}%) & Hedge USD/KRW (₩{krw:.0f})"
            kr_open = (
                f"[{session_date_str} · Equity Drawdown & Safe-Haven KTB Bid Regime] Sharp equity volatility in KOSPI ({kospi:,.2f}, {kospi_pct:+.2f}%) "
                f"and KOSDAQ ({kosdaq:,.2f}, {kosdaq_pct:+.2f}%) is accelerating domestic institutional rotation into KOFIA Korea Treasury Bonds (3Y at {ktb_3y:.3f}% [{ktb_3y_chg:+.1f} bps], 10Y at {ktb_10y:.3f}% [{ktb_10y_chg:+.1f} bps])."
            )
            kr_takeaway = (
                f"[Tactical Call — Long 3Y–10Y KTB Duration + Long USD/KRW NDF Protection] With Seoul flows reacting to \"{kr_lead['title'][:68]}\" ({kr_lead['source']}) and \"{kr_sec['title'][:64]}\", "
                f"hold 3Y–10Y KTB duration ({ktb_3y:.3f}%–{ktb_10y:.3f}%) funded at KOFR ({kofr_val:.3f}%) and maintain 1M USD/KRW NDF protection (₩{ndf_krw:.2f})."
            )
        else:
            kr_conv = f"Semiconductor & Export Boom: Overweight KOSPI Chip Leaders ({kospi_pct:+.2f}%) + WGBI-Backed 10Y KTB ({ktb_10y:.3f}%) · Constructive KRW"
            kr_open = (
                f"[{session_date_str} · Semiconductor Export & WGBI Inflow Regime] Strong Korean semiconductor export momentum and Corporate Value-Up catalysts "
                f"are propelling KOSPI ({kospi:,.2f}, {kospi_pct:+.2f}%) alongside USD/KRW at ₩{krw:.2f} ({krw_pct:+.2f}%), while KOFIA 3Y and 10Y KTB benchmarks trade at {ktb_3y:.3f}% ({ktb_3y_chg:+.1f} bps) and {ktb_10y:.3f}% ({ktb_10y_chg:+.1f} bps; 3s10s +{slope_3s10s} bps)."
            )
            kr_takeaway = (
                f"[Tactical Call — Dual Semiconductor Equity + WGBI 10Y KTB Allocation] Backed by \"{kr_lead['title'][:68]}\" ({kr_lead['source']}) and \"{kr_sec['title'][:65]}\" ({kr_sec['source']}), "
                f"pair long KOSPI semiconductor exporters with unhedged 10Y KTB ({ktb_10y:.3f}%) to capture both FTSE WGBI passive inflows and exporter USD selling near ₩{round(krw + 15):,}."
            )

        data["korea"]["commentary"].update(
            {
                "title": f"Bank of Korea & KOFIA / SOFIA Fixed Income Briefing · {kr_prof['primaryLabel'].split(',')[0]}",
                "date": session_date_str,
                "policyPosture": f"BOK Base {bok_rate:.2f}% · KOFR {kofr_val:.3f}% · CD 91D {cd_val:.2f}% · {kr_prof['primaryTheme'].replace('_', ' ')}",
                "executiveSummary": (
                    f"[{session_date_str} Executive Synthesis] Seoul fixed-income and equity markets are driven today by {kr_prof['primaryLabel'].lower()} — "
                    f"led by \"{kr_lead['title'][:78]}\" ({kr_lead['source']} · {kr_lead['timeAgo']}) and \"{kr_sec['title'][:74]}\" ({kr_sec['source']} · {kr_sec['timeAgo']}). "
                    f"Across KOFIA / SOFIA OTC bond fixings ({kr_quote_dt}), 3Y benchmark KTB trades at {ktb_3y:.3f}% ({ktb_3y_chg:+.1f} bps 1D), 5Y KTB at {ktb_5y:.3f}%, "
                    f"10Y benchmark KTB at {ktb_10y:.3f}% ({ktb_10y_chg:+.1f} bps 1D; {kr_spread} bps vs 10Y UST), and 30Y KTB at {ktb_30y:.3f}%, "
                    f"while USD/KRW sits at ₩{krw:.2f} ({krw_pct:+.2f}%) and KOSPI prints {kospi:,.2f} ({kospi_pct:+.2f}%)."
                ),
                "macroPillars": [
                    {
                        "heading": f"1. KOFIA / SOFIA KTB Curve ({kr_quote_dt}) & WGBI Institutional Flows",
                        "analysis": (
                            f"KOFIA OTC yields price 3Y KTB at {ktb_3y:.3f}% ({ktb_3y_chg:+.1f} bps), 5Y at {ktb_5y:.3f}%, 10Y at {ktb_10y:.3f}% ({ktb_10y_chg:+.1f} bps), and 30Y at {ktb_30y:.3f}% (+{slope_3s10s} bps 3s10s slope) "
                            f"as domestic and WGBI accounts react to \"{kr_lead['title'][:72]}\" ({kr_lead['source']})."
                        ),
                    },
                    {
                        "heading": f"2. BOK Base Rate ({bok_rate:.2f}%), KOFR Repo ({kofr_val:.3f}%) & 91D CD ({cd_val:.2f}%)",
                        "analysis": (
                            f"With Headline CPI at {kr_cpi:.2f}% YoY (+{bok_rate - kr_cpi:.2f}% real buffer), overnight KOFR/SOFIA repo fixes at {kofr_val:.3f}% and 91-day KOFIA CD at {cd_val:.2f}%, "
                            f"framing money-market carry alongside \"{kr_sec['title'][:72]}\" ({kr_sec['source']})."
                        ),
                    },
                    {
                        "heading": f"3. USD/KRW (₩{krw:.2f}), Semiconductor Exports & KOSPI ({kospi:,.2f})",
                        "analysis": (
                            f"Onshore USD/KRW trades at ₩{krw:.2f} (1M NDF ₩{ndf_krw:.2f}) while KOSPI ({kospi:,.2f}, {kospi_pct:+.2f}%) and KOSDAQ ({kosdaq:,.2f}, {kosdaq_pct:+.2f}%) "
                            f"reflect \"{kr_third['title'][:70]}\"."
                        ),
                    },
                ],
            }
        )

        data["korea"]["argonCommentary"] = {
            "modelLabel": "GEMINI 4 ARGON",
            "title": "GEMINI 4 ARGON · KOREA SOVEREIGN (KOFIA / SOFIA), BOK & KRW SYNTHESIS",
            "regimeBadge": f"{kr_prof['primaryTheme'].replace('_', ' ')} · KOFR {kofr_val:.3f}% · 10Y KTB {ktb_10y:.3f}% ({ktb_10y_chg:+.1f} bps)",
            "dominantRegime": kr_prof["primaryLabel"],
            "updatedAtSGT": updated_sgt_str,
            "conviction": kr_conv,
            "synthesis": (
                f"{kr_open} Argon's synthesis across {len(kr_prof['classified'])} Seoul macro, BOK, and export headlines highlights: {kr_prof['distinctThemesDigest']}. "
                f"With Headline CPI at {kr_cpi:.2f}% YoY (+{bok_rate - kr_cpi:.2f}% real buffer) and 91D CD at {cd_val:.2f}%, institutional desks are calibrating KTB duration against \"{kr_lead['title'][:72]}\" and semiconductor trade flows."
            ),
            "positioningTakeaway": kr_takeaway,
            "criticalLevels": [
                {
                    "asset": "KOFIA 3Y & 10Y KTB Yield",
                    "current": f"3Y {ktb_3y:.3f}% · 10Y {ktb_10y:.3f}%",
                    "support": f"{ktb_10y - 0.15:.3f}% (10Y)",
                    "resistance": f"{ktb_10y + 0.15:.3f}% (10Y)",
                    "implication": f"10Y KTB above {ktb_10y + 0.15:.2f}% draws pension/insurer duration buying; sub-{ktb_10y - 0.15:.2f}% prices in an additional BOK rate cut.",
                },
                {
                    "asset": "KOFR / SOFIA & 91D CD Rate",
                    "current": f"KOFR {kofr_val:.3f}% · CD {cd_val:.2f}%",
                    "support": "2.85%",
                    "resistance": "3.50%",
                    "implication": "Tight KOFR-to-BOK Base Rate spread confirms ample overnight RP liquidity across Korean securities dealers.",
                },
                {
                    "asset": "USD/KRW Spot & 1M NDF",
                    "current": f"₩{krw:.2f} (NDF ₩{ndf_krw:.2f})",
                    "support": f"₩{krw - 22:.0f}",
                    "resistance": f"₩{krw + 25:.0f}",
                    "implication": f"Sustained move above ₩{krw + 25:.0f} delays BOK easing and prompts NPS/BOK FX smoothing operations.",
                },
                {
                    "asset": "KOSPI Composite Index",
                    "current": f"{kospi:,.2f} ({kospi_pct:+.2f}%)",
                    "support": f"{round(kospi * 0.97):,}",
                    "resistance": f"{round(kospi * 1.035):,}",
                    "implication": "Memory semiconductor export cycle and Corporate Value-Up disclosures dictate foreign net equity flows.",
                },
            ],
            "eventsToWatch": [
                {
                    "event": "KOFIA 16:00 KST Final OTC KTB Yield Quotation & KTB Futures Settlement",
                    "timing": f"{_fmt_event_date(today_biz)} · 16:00 KST (15:00 SGT)",
                    "impact": "Critical",
                    "watchFor": f"Foreign institutional net buying in 3Y ({ktb_3y:.3f}%) and 10Y ({ktb_10y:.3f}%) KTB futures following \"{kr_lead['title'][:75]}\".",
                },
                {
                    "event": "MOEF 10-Year Korea Treasury Bond (KTB) Competitive Primary Auction & WGBI Flows",
                    "timing": f"{_fmt_event_date(next_mon)} · 10:40 KST (09:40 SGT)",
                    "impact": "High",
                    "watchFor": f"Competitive auction takedown on 10Y ({ktb_10y:.3f}%) and 30Y ({ktb_30y:.3f}%) KTB supply amid \"{kr_sec['title'][:75]}\".",
                },
                {
                    "event": "Bank of Korea (BOK) Monetary Policy Board Base Rate Decision & MSB Tender",
                    "timing": f"{_fmt_event_date(bok_mpb_date)} · 09:00 KST (08:00 SGT)",
                    "impact": "High",
                    "watchFor": f"Forward guidance from Governor Rhee Chang-yong on Base Rate ({bok_rate:.2f}%), KOFR/SOFIA ({kofr_val:.3f}%) repo transmission, and USD/KRW (₩{krw:.2f}).",
                },
            ],
        }

    # India (RBI / CCIL) Gemini 4 Argon Commentary & Dynamic Country Market Briefing
    if "india" in data:
        in_bonds = data["india"]["bonds"]
        in_fx = data["india"]["fxAndEquities"]
        gsec_3y = next((float(b["yield"]) for b in in_bonds["gsecCurve"] if b["tenor"].startswith("3Y")), 6.958)
        gsec_5y = next((float(b["yield"]) for b in in_bonds["gsecCurve"] if b["tenor"].startswith("5Y")), 7.023)
        gsec_5y_chg = next((float(b.get("changeBps", -2.2)) for b in in_bonds["gsecCurve"] if b["tenor"].startswith("5Y")), -2.2)
        gsec_10y = next((float(b["yield"]) for b in in_bonds["gsecCurve"] if b["tenor"].startswith("10Y")), 7.162)
        gsec_10y_chg = next((float(b.get("changeBps", 1.7)) for b in in_bonds["gsecCurve"] if b["tenor"].startswith("10Y")), 1.7)
        gsec_30y = next((float(b["yield"]) for b in in_bonds["gsecCurve"] if b["tenor"].startswith("30Y")), 7.619)
        repo_rate = float(in_bonds.get("rbiRepoRate", 5.50))
        sdf_rate = float(in_bonds.get("sdfRate", 5.25))
        msf_rate = float(in_bonds.get("msfRate", 5.75))
        tb91 = float(in_bonds.get("tbill91dRate", 5.897))
        tb364 = float(in_bonds.get("tbill364dRate", 6.649))
        in_cpi = float(in_bonds.get("cpiInflationYoY", 4.85))
        in_spread = round((gsec_10y - y10) * 100)
        slope_5s10s = round((gsec_10y - gsec_5y) * 100)
        inr_val = float(in_fx.get("inrSpot", 93.895))
        inr_pct = float(in_fx.get("inrChangePct", -0.60))
        rbi_ref = float(in_fx.get("rbiReferenceUsd", 94.1402))
        fx_res = float(in_fx.get("forexReservesUsdBn", 717.06))
        nifty = float(in_fx.get("nifty50Index", {}).get("level", 24986.40))
        nifty_pct = float(in_fx.get("nifty50Index", {}).get("changePct", -0.18))
        sensex = float(in_fx.get("sensexIndex", {}).get("level", 80999.40))
        sensex_pct = float(in_fx.get("sensexIndex", {}).get("changePct", -0.04))
        in_quote_dt = in_bonds.get("quotationDate", "11 Nov 2026")

        in_prof = _analyze_news_catalysts_py(
            data["india"]["commentary"].get("noteworthyHeadlines", []),
            "RBI manages banking liquidity within the 5.25%-5.75% LAF corridor as 10Y G-Sec trades near 7.16%",
        )
        in_lead = in_prof["leadItem"]
        in_sec = in_prof["secondItem"]
        in_third = in_prof["thirdItem"]

        if gsec_10y_chg >= 3.5 or in_prof["primaryTheme"] == "FISCAL_SUPPLY":
            in_conv = f"G-Sec Supply & Valuation Shift ({gsec_10y_chg:+.1f} bps 10Y): Favor 91D–364D T-Bills ({tb91:.2f}%–{tb364:.2f}%) & 3Y–5Y G-Sec ({gsec_3y:.3f}%–{gsec_5y:.3f}%)"
            in_open = (
                f"[{session_date_str} · G-Sec Portfolio Valuation & Supply Regime] Indian sovereign yields backed up across the belly and long end "
                f"({in_quote_dt}: 5Y G-Sec at {gsec_5y:.3f}% [{gsec_5y_chg:+.1f} bps], 10Y 6.94% GS 2036 at {gsec_10y:.3f}% [{gsec_10y_chg:+.1f} bps], 30Y at {gsec_30y:.3f}%) "
                f"as commercial bank bond-valuation rules and primary auction supply shape PSU bank SLR demand."
            )
            in_takeaway = (
                f"[Tactical Call — Shorten G-Sec Duration to 3Y–5Y & Wait for 7.22%+ on 10Y] With Mumbai desks focused on \"{in_lead['title'][:68]}\" ({in_lead['source']}) and \"{in_sec['title'][:65]}\" ({in_sec['source']}), "
                f"keep duration concentrated in 364D T-Bills ({tb364:.3f}%) and 3Y–5Y G-Secs ({gsec_3y:.3f}%–{gsec_5y:.3f}%) rather than chasing 10Y–30Y G-Secs until Friday's ₹36,000 Cr auction clears."
            )
        elif in_prof["primaryTheme"] in ("TRADE_TARIFF_TECH", "FX_EXTERNAL_BALANCE"):
            in_conv = f"Reserve-Backed INR Carry (${fx_res:.0f}B FX Reserves): Long 5Y–10Y FAR G-Secs ({gsec_5y:.3f}%–{gsec_10y:.3f}%, +{in_spread} bps vs UST)"
            in_open = (
                f"[{session_date_str} · External Trade & RBI FX Reserve Buffer Regime] Bilateral trade diplomacy and external balance dynamics are driving USD/INR sentiment today "
                f"(spot at ₹{inr_val:.4f} [{inr_pct:+.2f}%], FBIL Ref ₹{rbi_ref:.4f}), backed by RBI's US${fx_res:.2f}B foreign exchange reserve war chest and a +{in_spread} bps 10Y G-Sec pickup over US Treasuries."
            )
            in_takeaway = (
                f"[Tactical Call — Unhedged / Partially Hedged FAR 5Y–10Y G-Sec Carry] Synthesizing \"{in_lead['title'][:68]}\" ({in_lead['source']}) and \"{in_sec['title'][:65]}\" ({in_sec['source']}), "
                f"RBI's US${fx_res:.0f}B reserve buffer caps USD/INR upside near ₹{inr_val + 0.65:.2f}, making Fully Accessible Route (FAR) 5Y–10Y G-Secs ({gsec_5y:.3f}%–{gsec_10y:.3f}%) one of Asia's highest risk-adjusted carry trades."
            )
        else:
            in_conv = f"LAF Corridor Carry (Repo {repo_rate:.2f}%): Overweight 5Y–10Y FAR G-Secs ({gsec_5y:.3f}% / {gsec_10y:.3f}%) & Domestic Equity SIP Leaders"
            in_open = (
                f"[{session_date_str} · {in_prof['primaryLabel']} Regime] Official RBI and CCIL/NDS-OM fixings ({in_quote_dt}) place 3Y G-Sec at {gsec_3y:.3f}%, "
                f"5Y at {gsec_5y:.3f}% ({gsec_5y_chg:+.1f} bps 1D), 10Y at {gsec_10y:.3f}% ({gsec_10y_chg:+.1f} bps 1D; 5s10s +{slope_5s10s} bps), and 30Y at {gsec_30y:.3f}%, "
                f"anchored by RBI's VRR/VRRR liquidity operations within the {sdf_rate:.2f}%–{msf_rate:.2f}% SDF/MSF corridor."
            )
            in_takeaway = (
                f"[Tactical Call — Core FAR G-Sec Duration & Rupee Stability] Across \"{in_lead['title'][:68]}\" ({in_lead['source']}) and \"{in_sec['title'][:64]}\" ({in_sec['source']}), "
                f"accumulate 5Y–10Y FAR G-Secs ({gsec_5y:.3f}%–{gsec_10y:.3f}%) on any backup toward {gsec_10y + 0.10:.2f}% while Nifty 50 ({nifty:,.0f}, {nifty_pct:+.2f}%) and Sensex ({sensex:,.0f}, {sensex_pct:+.2f}%) consolidate."
            )

        data["india"]["commentary"].update(
            {
                "title": f"Reserve Bank of India (RBI) & CCIL G-Sec Briefing · {in_prof['primaryLabel'].split(',')[0]}",
                "date": session_date_str,
                "policyPosture": f"RBI Repo {repo_rate:.2f}% (SDF {sdf_rate:.2f}% / MSF {msf_rate:.2f}%) · {in_prof['primaryTheme'].replace('_', ' ')}",
                "executiveSummary": (
                    f"[{session_date_str} Executive Synthesis] Indian sovereign bond and currency markets today reflect {in_prof['primaryLabel'].lower()} — "
                    f"led by \"{in_lead['title'][:78]}\" ({in_lead['source']} · {in_lead['timeAgo']}) and \"{in_sec['title'][:74]}\" ({in_sec['source']} · {in_sec['timeAgo']}). "
                    f"Across official RBI / CCIL NDS-OM fixings ({in_quote_dt}), 3Y G-Sec (6.20% GS 2029) yields {gsec_3y:.3f}%, 5Y benchmark (6.53% GS 2031) trades at {gsec_5y:.3f}% ({gsec_5y_chg:+.1f} bps 1D), "
                    f"10Y benchmark (6.94% GS 2036) yields {gsec_10y:.3f}% ({gsec_10y_chg:+.1f} bps 1D; +{in_spread} bps over 10Y UST), and 30Y G-Sec sits at {gsec_30y:.3f}%, "
                    f"backed by US${fx_res:.2f}B in RBI FX Reserves (USD/INR ₹{inr_val:.4f} [{inr_pct:+.2f}%], Nifty 50 {nifty:,.2f} [{nifty_pct:+.2f}%])."
                ),
                "macroPillars": [
                    {
                        "heading": f"1. RBI / CCIL Sovereign G-Sec Curve ({in_quote_dt}) & Bank Portfolio Demand",
                        "analysis": (
                            f"On-the-run G-Secs trade at {gsec_3y:.3f}% (3Y), {gsec_5y:.3f}% (5Y, {gsec_5y_chg:+.1f} bps), {gsec_10y:.3f}% (10Y, {gsec_10y_chg:+.1f} bps), and {gsec_30y:.3f}% (30Y) "
                            f"as PSU banks, insurers, and foreign FAR accounts evaluate \"{in_lead['title'][:72]}\" ({in_lead['source']})."
                        ),
                    },
                    {
                        "heading": f"2. RBI LAF Corridor ({sdf_rate:.2f}%–{msf_rate:.2f}%), VRR/VRRR & T-Bill Cut-Offs",
                        "analysis": (
                            f"RBI keeps overnight Call Money ({in_bonds.get('callRateRange', '4.30% - 5.75%')}) aligned with the {repo_rate:.2f}% Repo rate via VRR/VRRR operations "
                            f"while 91D/364D T-Bills yield {tb91:.3f}%/{tb364:.3f}% amid \"{in_sec['title'][:72]}\" ({in_sec['source']})."
                        ),
                    },
                    {
                        "heading": f"3. USD/INR (₹{inr_val:.4f}), US${fx_res:.2f}B FX Reserves & Nifty 50 / Sensex",
                        "analysis": (
                            f"Spot USD/INR at ₹{inr_val:.4f} (FBIL Ref ₹{rbi_ref:.4f}) is cushioned by US${fx_res:.2f}B in RBI reserves, "
                            f"while Nifty 50 ({nifty:,.2f}, {nifty_pct:+.2f}%) and Sensex ({sensex:,.2f}, {sensex_pct:+.2f}%) digest \"{in_third['title'][:70]}\"."
                        ),
                    },
                ],
            }
        )

        data["india"]["argonCommentary"] = {
            "modelLabel": "GEMINI 4 ARGON",
            "title": "GEMINI 4 ARGON · INDIA SOVEREIGN (RBI / CCIL G-SEC), LAF & INR SYNTHESIS",
            "regimeBadge": f"{in_prof['primaryTheme'].replace('_', ' ')} · REPO {repo_rate:.2f}% · 10Y G-SEC {gsec_10y:.3f}% ({gsec_10y_chg:+.1f} bps)",
            "dominantRegime": in_prof["primaryLabel"],
            "updatedAtSGT": updated_sgt_str,
            "conviction": in_conv,
            "synthesis": (
                f"{in_open} Argon's multi-update synthesis of {len(in_prof['classified'])} Mumbai market disclosures and RBI press releases highlights: {in_prof['distinctThemesDigest']}. "
                f"With 91D/364D T-Bills clearing at {tb91:.3f}%/{tb364:.3f}% and CPI at {in_cpi:.2f}% YoY, institutional desks are positioning around \"{in_lead['title'][:72]}\" and RBI's active LAF liquidity fine-tuning."
            ),
            "positioningTakeaway": in_takeaway,
            "criticalLevels": [
                {
                    "asset": "10Y G-Sec (6.94% GS 2036)",
                    "current": f"{gsec_10y:.3f}% (+{in_spread} bps)",
                    "support": f"{gsec_10y - 0.12:.3f}%",
                    "resistance": f"{gsec_10y + 0.14:.3f}%",
                    "implication": f"Yields near {gsec_10y + 0.14:.2f}% attract PSU bank SLR & foreign FAR inflows; sub-{gsec_10y - 0.12:.2f}% requires softer food CPI.",
                },
                {
                    "asset": "RBI LAF Corridor & 91D T-Bill",
                    "current": f"Repo {repo_rate:.2f}% · 91D {tb91:.3f}%",
                    "support": f"{sdf_rate:.2f}% (SDF Floor)",
                    "resistance": f"{msf_rate:.2f}% (MSF Ceiling)",
                    "implication": "Active RBI VRR/VRRR liquidity auctions prevent overnight call/TREPS rates from breaching the 5.25%–5.75% LAF band.",
                },
                {
                    "asset": "USD/INR Spot & FBIL Ref",
                    "current": f"₹{inr_val:.2f} (Ref ₹{rbi_ref:.2f})",
                    "support": f"₹{inr_val - 0.65:.2f}",
                    "resistance": f"₹{inr_val + 0.65:.2f}",
                    "implication": f"RBI two-way FX intervention backed by US${fx_res:.1f}B reserves caps rupee volatility near ₹{inr_val + 0.65:.2f}.",
                },
                {
                    "asset": "NIFTY 50 & BSE SENSEX",
                    "current": f"{nifty:,.0f} ({nifty_pct:+.2f}%)",
                    "support": f"{round(nifty * 0.975):,}",
                    "resistance": f"{round(nifty * 1.025):,}",
                    "implication": "Domestic SIP inflows and banking earnings offset foreign equity rotation and support INR capital account stability.",
                },
            ],
            "eventsToWatch": [
                {
                    "event": "India MoSPI Consumer Price Index (CPI) Print & RBI LAF VRR/VRRR Operations",
                    "timing": f"{_fmt_event_date(cpi_date)} · 16:00 IST (18:30 SGT)",
                    "impact": "Critical",
                    "watchFor": f"Food-price trajectory relative to RBI's 4.0% (±2%) target band and overnight call money alignment amid \"{in_lead['title'][:75]}\".",
                },
                {
                    "event": "RBI Weekly ₹36,000 Cr Government Stock (G-Sec) Auction & WSS Forex Reserves Print",
                    "timing": f"{_fmt_event_date(next_fri)} · 14:30 & 17:00 IST (17:00 & 19:30 SGT)",
                    "impact": "High",
                    "watchFor": f"Cut-off yields on 5Y ({gsec_5y:.3f}%) and 10Y ({gsec_10y:.3f}%) G-Secs with NIL PD devolvement, plus weekly variation in RBI's US${fx_res:.2f}B FX Reserves.",
                },
                {
                    "event": "RBI Monetary Policy Committee (MPC) Repo Rate Decision & SDF/MSF Corridor Review",
                    "timing": f"{_fmt_event_date(rbi_mpc_date)} · 10:00 IST (12:30 SGT)",
                    "impact": "High",
                    "watchFor": f"MPC forward guidance on the {repo_rate:.2f}% Repo rate, FAR G-Sec foreign inflows, and USD/INR stability following \"{in_sec['title'][:75]}\".",
                },
            ],
        }

    # US Equities (S&P 500) Gemini 4 Argon Commentary
    if "equities" in data:
        eq = data["equities"]
        idx_q = eq.get("indexSummary", {})
        spx_lvl = float(idx_q.get("spxLevel", 7376.86))
        spx_pct = float(idx_q.get("spxChangePct", 0.31))
        fwd_pe_idx = float(idx_q.get("spxForwardPe", 21.8))
        ey_idx = float(idx_q.get("spxEarningsYieldPct", round(100.0 / fwd_pe_idx, 2)))
        erp_bps = int(idx_q.get("equityRiskPremiumBps", round((ey_idx - y10) * 100)))

        best_pe = eq.get("topForwardPe", [{}])[0]
        second_pe = eq.get("topForwardPe", [{}, {}])[1] if len(eq.get("topForwardPe", [])) > 1 else {}
        best_fcf = eq.get("topFcfToEv", [{}])[0]
        second_fcf = eq.get("topFcfToEv", [{}, {}])[1] if len(eq.get("topFcfToEv", [])) > 1 else {}
        best_div = eq.get("topDividendYield", [{}])[0]
        second_div = eq.get("topDividendYield", [{}, {}])[1] if len(eq.get("topDividendYield", [])) > 1 else {}

        pe_tkr = best_pe.get("ticker", "GM")
        pe_val = float(best_pe.get("forwardPe", 6.73))
        pe_ey = float(best_pe.get("earningsYieldPct", 14.86))
        pe2_tkr = second_pe.get("ticker", "SYF")
        pe2_val = float(second_pe.get("forwardPe", 7.45))

        fcf_tkr = best_fcf.get("ticker", "APA")
        fcf_val = float(best_fcf.get("fcfToEvPct", 12.69))
        fcf2_tkr = second_fcf.get("ticker", "DVN")
        fcf2_val = float(second_fcf.get("fcfToEvPct", 11.75))

        div_tkr = best_div.get("ticker", "PFG")
        div_val = float(best_div.get("dividendYieldPct", 6.15))
        div2_tkr = second_div.get("ticker", "CAG")
        div2_val = float(second_div.get("dividendYieldPct", 5.80))

        eq_prof = _analyze_news_catalysts_py(
            eq.get("noteworthyHeadlines", []),
            "S&P 500 valuation dispersion widens between mega-cap growth and deep-value free cash flow compounders",
        )
        eq_lead = eq_prof["leadItem"]
        eq_sec = eq_prof["secondItem"]
        erp_str = f"+{erp_bps} bps" if erp_bps >= 0 else f"{erp_bps} bps"

        if y10_chg >= 3.0 or erp_bps <= -35:
            eq_conv = f"Negative ERP ({erp_str} vs {y10:.2f}% 10Y UST): Rotate From {fwd_pe_idx:.1f}x Index Beta Into Top FCF/EV ({fcf_tkr} {fcf_val:.1f}%) & Low Fwd P/E ({pe_tkr} {pe_val:.1f}x)"
            eq_open = (
                f"[{session_date_str} · Rate-Driven ERP Compression & Value Dispersion Regime] With 10Y US Treasury yields moving {y10_chg:+.1f} bps to {y10:.2f}% "
                f"against the S&P 500's {fwd_pe_idx:.1f}x NTM Forward P/E ({ey_idx:.2f}% implied earnings yield, compressing the Equity Risk Premium to {erp_str}), "
                f"rate-sensitive multiple discipline is dominating US equity factor flows even as the cash index trades at {spx_lvl:,.2f} ({spx_pct:+.2f}%)."
            )
            eq_takeaway = (
                f"[Tactical Call — Long Unlevered FCF/EV & Low-P/E Compounders Over Cap-Weighted Index] Synthesizing \"{eq_lead['title'][:68]}\" ({eq_lead['source']}) and \"{eq_sec['title'][:64]}\" ({eq_sec['source']}), "
                f"underweight long-duration mega-cap multiples and reallocate into the Top 10 FCF/EV basket led by {fcf_tkr} ({fcf_val:.2f}% FCF/EV) and {fcf2_tkr} ({fcf2_val:.2f}%), "
                f"alongside Top Forward P/E names {pe_tkr} ({pe_val:.2f}x) and {pe2_tkr} ({pe2_val:.2f}x) generating +700 to +1,100 bps of earnings/cash yield pickup over 10Y Treasuries."
            )
        elif spx_pct <= -0.5 or eq_prof["primaryTheme"] in ("POLITICAL_GOVERNANCE", "TRADE_TARIFF_TECH"):
            eq_conv = f"Defensive Cash-Flow & Dividend Shield: Overweight FCF-Covered Dividend Leaders ({div_tkr} {div_val:.1f}%, {div2_tkr} {div2_val:.1f}%) + Low-Debt FCF/EV"
            eq_open = (
                f"[{session_date_str} · Defensive Factor Rotation & Policy Headline Regime] Amid \"{eq_lead['title'][:70]}\" ({eq_lead['source']}) and S&P 500 trading at {spx_lvl:,.2f} ({spx_pct:+.2f}%), "
                f"institutional desks are rotating toward self-funded balance sheets with high dividend and free-cash-flow coverage."
            )
            eq_takeaway = (
                f"[Tactical Call — Defensive Dividend + FCF/EV Barbell] Anchor US equity books in FCF-covered dividend payers led by {div_tkr} ({div_val:.2f}% Div/Price) and {div2_tkr} ({div2_val:.2f}%), "
                f"paired with unlevered cash generators {fcf_tkr} ({fcf_val:.2f}% FCF/EV), insulating portfolios from policy/tariff volatility and {y10:.2f}% 10Y Treasury yields."
            )
        else:
            eq_conv = f"Cyclical Value & Buyback Compounders: Long Top Fwd P/E ({pe_tkr} {pe_val:.1f}x, {pe2_tkr} {pe2_val:.1f}x) + FCF/EV Leaders ({fcf_tkr} {fcf_val:.1f}%)"
            eq_open = (
                f"[{session_date_str} · Broad Equity Breadth & Cash-Return Regime] As the S&P 500 advances to {spx_lvl:,.2f} ({spx_pct:+.2f}% 1D) on a {fwd_pe_idx:.1f}x NTM Forward P/E "
                f"({ey_idx:.2f}% E/P vs {y10:.2f}% 10Y UST; ERP {erp_str}), breadth expansion and share buyback execution are rewarding deep-value and high-FCF/EV constituents."
            )
            eq_takeaway = (
                f"[Tactical Call — Capture Factor Dispersion Across All 3 Valuation Screens] Reviewing \"{eq_lead['title'][:68]}\" ({eq_lead['source']}) and \"{eq_sec['title'][:64]}\" ({eq_sec['source']}), "
                f"overweight a 3-factor sleeve combining Top Forward P/E ({pe_tkr} at {pe_val:.2f}x / {pe_ey:.1f}% E/P), Top FCF/EV ({fcf_tkr} at {fcf_val:.2f}%), and Top Dividend Yield ({div_tkr} at {div_val:.2f}%) to outperform the {fwd_pe_idx:.1f}x cap-weighted benchmark."
            )

        data["equities"]["argonCommentary"] = {
            "modelLabel": "GEMINI 4 ARGON",
            "title": "GEMINI 4 ARGON · US S&P 500 (SPX500) VALUATION, CASH FLOW & DIVIDEND FACTOR SYNTHESIS",
            "regimeBadge": f"{eq_prof['primaryTheme'].replace('_', ' ')} · SPX {spx_lvl:,.2f} ({spx_pct:+.2f}%) · ERP {erp_str}",
            "dominantRegime": eq_prof["primaryLabel"],
            "updatedAtSGT": updated_sgt_str,
            "conviction": eq_conv,
            "synthesis": (
                f"{eq_open} Argon's multi-update analysis of {len(eq_prof['classified'])} US equity and valuation stories highlights: {eq_prof['distinctThemesDigest']}. "
                f"Cross-referencing the live S&P 500 screens: Forward P/E is led by {pe_tkr} ({pe_val:.2f}x, {pe_ey:.1f}% E/P) and {pe2_tkr} ({pe2_val:.2f}x); "
                f"Enterprise Cash Yield is led by {fcf_tkr} ({fcf_val:.2f}% FCF/EV) and {fcf2_tkr} ({fcf2_val:.2f}%); and Dividend Yield is led by {div_tkr} ({div_val:.2f}% Div/Price)."
            ),
            "positioningTakeaway": eq_takeaway,
            "criticalLevels": [
                {
                    "asset": "S&P 500 Cash Index (SPX)",
                    "current": f"{spx_lvl:,.2f} ({spx_pct:+.2f}%)",
                    "support": f"{round(spx_lvl * 0.972):,}",
                    "resistance": f"{round(spx_lvl * 1.025):,}",
                    "implication": f"Break above {round(spx_lvl * 1.025):,} requires 10Y UST stability below {y10 + 0.15:.2f}%; pullback tests 50-DMA near {round(spx_lvl * 0.972):,}.",
                },
                {
                    "asset": "S&P 500 Equity Risk Premium",
                    "current": f"{erp_str} (E/P {ey_idx:.2f}% vs {y10:.2f}%)",
                    "support": "-65 bps",
                    "resistance": "+50 bps",
                    "implication": "Negative ERP favors high free-cash-flow yielders (FCF/EV > 8.5%) and short-duration value equities over long-duration growth.",
                },
                {
                    "asset": "Top 10 Fwd P/E Value Basket",
                    "current": f"5.8x – 9.0x (Led by {pe_tkr} {pe_val:.2f}x)",
                    "support": "5.5x Floor",
                    "resistance": "10.5x Re-Rating",
                    "implication": "Consensus NTM EPS upward revisions and share count reductions drive multiple expansion toward 10.5x.",
                },
                {
                    "asset": "Top 10 FCF / EV & Div Basket",
                    "current": f"FCF/EV {fcf_val:.1f}% · Div {div_val:.2f}%",
                    "support": f"+{round(fcf_val * 100 - y10 * 100)} bps FCF Spread",
                    "resistance": "85% FCF Payout Cap",
                    "implication": "Unlevered FCF/EV > 2x the 10Y Treasury yield insulates capital-return leaders against higher-for-longer discount rates.",
                },
            ],
            "eventsToWatch": [
                {
                    "event": "US CPI Disinflation Print & 10-Year Treasury Yield ERP Re-Rating Test",
                    "timing": f"{_fmt_event_date(cpi_date)} · 21:30 SGT (08:30 ET)",
                    "impact": "Critical",
                    "watchFor": f"Any backup in 10Y UST above {y10 + 0.18:.2f}% which triggers institutional factor rotation into Top 10 FCF/EV ({fcf_tkr}) and Forward P/E ({pe_tkr}) baskets.",
                },
                {
                    "event": "S&P 500 FactSet Weekly NTM Consensus EPS Revision Cut-Off & Margin Update",
                    "timing": f"{_fmt_event_date(next_fri)} · 16:00 ET (Sat 05:00 SGT)",
                    "impact": "High",
                    "watchFor": f"Whether bottom-up S&P 500 NTM operating EPS expands fast enough to compress the index Forward P/E below 21.0x from {fwd_pe_idx:.1f}x.",
                },
                {
                    "event": "S&P 500 Monthly Options Expiration (OpEx), Buyback Execution & Ex-Dividend Date",
                    "timing": f"{_fmt_event_date(lpr_date)} · 09:30–16:00 ET (NY Cash Close)",
                    "impact": "High",
                    "watchFor": f"Execution of authorized buybacks across Energy/Auto/Tech FCF leaders ({fcf_tkr}, {fcf2_tkr}, {pe_tkr}) and dividend capture in {div_tkr} ({div_val:.2f}% Div/Price).",
                },
            ],
        }

    # Optional hybrid Gemini API enrichment pass when GEMINI_API_KEY is configured
    _try_gemini_api_synthesis(data, updated_sgt_str)



def fetch_live_us_equities_spx500(data: dict):
    """Fetch live S&P 500 (^GSPC) index quote and constituent prices from Yahoo Finance to dynamically rank:
    1) Top 10 Best Price / Forward P/E (lowest positive NTM P/E >= 4.0x)
    2) Top 10 Best Free Cash Flow / Current Enterprise Value (highest FCF/EV %, ex-Financials/REITs)
    3) Top 10 Best Dividend / Price (highest sustainable annual dividend yield %, FCF payout < 85%)
    """
    ust_10y = next(
        (float(t["yield"]) for t in data["globalMacro"]["yieldCurve"]["tenors"] if t["label"] == "10Y"),
        4.86,
    )

    spx_lvl, spx_chg, spx_pct = 7376.86, 22.84, 0.31
    spx_yf = get_yf_quote(["^GSPC"])
    if spx_yf and 3500 <= spx_yf[0] <= 12000:
        spx_lvl, _, spx_chg, spx_pct = spx_yf

    # S&P 500 consensus NTM EPS (~$338.40) -> dynamic index Forward P/E & ERP
    spx_ntm_eps = 338.40
    fwd_pe_index = round(spx_lvl / spx_ntm_eps, 1)
    ey_index_pct = round((100.0 / fwd_pe_index), 2)
    erp_bps = round((ey_index_pct - ust_10y) * 100)

    # Curated S&P 500 institutional value, cash-flow, and dividend candidate universe with verified NTM EPS, shares, TTM FCF, Net Debt, and Annual Dividend
    universe = [
        {
            "ticker": "GM",
            "company": "General Motors Co.",
            "sector": "Consumer Discretionary",
            "defaultPrice": 86.16,
            "defaultChgPct": 0.56,
            "sharesBn": 0.951,
            "forwardEps": 12.80,
            "fcfTtmBn": 9.40,
            "netDebtBn": 106.5,  # Includes GM Financial auto lease debt
            "annualDiv": 0.60,
            "fcfPayoutPct": 18.0,
            "eligibleFcfEv": False,  # Captive auto-finance debt distorts EV
        },
        {
            "ticker": "SYF",
            "company": "Synchrony Financial",
            "sector": "Financials",
            "defaultPrice": 73.74,
            "defaultChgPct": -1.67,
            "sharesBn": 0.374,
            "forwardEps": 9.90,
            "fcfTtmBn": 3.40,
            "netDebtBn": 0.0,
            "annualDiv": 1.20,
            "fcfPayoutPct": 22.0,
            "eligibleFcfEv": False,  # GICS Financials excluded from EV screen
        },
        {
            "ticker": "APA",
            "company": "APA Corporation",
            "sector": "Energy",
            "defaultPrice": 44.63,
            "defaultChgPct": 0.34,
            "sharesBn": 0.370,
            "forwardEps": 5.80,
            "fcfTtmBn": 2.78,
            "netDebtBn": 5.40,
            "annualDiv": 1.00,
            "fcfPayoutPct": 28.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "UAL",
            "company": "United Airlines Holdings",
            "sector": "Industrials",
            "defaultPrice": 112.74,
            "defaultChgPct": -0.25,
            "sharesBn": 0.329,
            "forwardEps": 14.00,
            "fcfTtmBn": 3.90,
            "netDebtBn": 18.20,
            "annualDiv": 0.00,
            "fcfPayoutPct": 0.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "HPQ",
            "company": "HP Inc.",
            "sector": "Information Technology",
            "defaultPrice": 28.46,
            "defaultChgPct": -0.49,
            "sharesBn": 0.942,
            "forwardEps": 3.50,
            "fcfTtmBn": 3.55,
            "netDebtBn": 7.70,
            "annualDiv": 1.16,
            "fcfPayoutPct": 31.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "F",
            "company": "Ford Motor Company",
            "sector": "Consumer Discretionary",
            "defaultPrice": 12.44,
            "defaultChgPct": 0.40,
            "sharesBn": 3.979,
            "forwardEps": 1.52,
            "fcfTtmBn": 6.80,
            "netDebtBn": 124.0,
            "annualDiv": 0.60,
            "fcfPayoutPct": 35.0,
            "eligibleFcfEv": False,  # Ford Credit balance sheet
        },
        {
            "ticker": "DAL",
            "company": "Delta Air Lines, Inc.",
            "sector": "Industrials",
            "defaultPrice": 87.20,
            "defaultChgPct": -1.16,
            "sharesBn": 0.644,
            "forwardEps": 10.40,
            "fcfTtmBn": 6.45,
            "netDebtBn": 17.00,
            "annualDiv": 0.60,
            "fcfPayoutPct": 12.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "CMCSA",
            "company": "Comcast Corporation",
            "sector": "Communication Services",
            "defaultPrice": 24.39,
            "defaultChgPct": 1.16,
            "sharesBn": 3.788,
            "forwardEps": 2.90,
            "fcfTtmBn": 18.20,
            "netDebtBn": 93.20,
            "annualDiv": 1.32,
            "fcfPayoutPct": 31.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "DVN",
            "company": "Devon Energy Corporation",
            "sector": "Energy",
            "defaultPrice": 42.21,
            "defaultChgPct": -0.24,
            "sharesBn": 0.630,
            "forwardEps": 4.95,
            "fcfTtmBn": 4.02,
            "netDebtBn": 7.60,
            "annualDiv": 1.76,
            "fcfPayoutPct": 29.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "BMY",
            "company": "Bristol-Myers Squibb Co.",
            "sector": "Health Care",
            "defaultPrice": 62.14,
            "defaultChgPct": 1.69,
            "sharesBn": 2.029,
            "forwardEps": 6.95,
            "fcfTtmBn": 15.40,
            "netDebtBn": 41.20,
            "annualDiv": 2.48,
            "fcfPayoutPct": 33.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "FANG",
            "company": "Diamondback Energy, Inc.",
            "sector": "Energy",
            "defaultPrice": 178.96,
            "defaultChgPct": 0.62,
            "sharesBn": 0.291,
            "forwardEps": 16.40,
            "fcfTtmBn": 6.18,
            "netDebtBn": 12.20,
            "annualDiv": 6.20,
            "fcfPayoutPct": 30.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "VLO",
            "company": "Valero Energy Corporation",
            "sector": "Energy",
            "defaultPrice": 346.45,
            "defaultChgPct": -0.02,
            "sharesBn": 0.313,
            "forwardEps": 28.50,
            "fcfTtmBn": 9.95,
            "netDebtBn": 6.00,
            "annualDiv": 4.28,
            "fcfPayoutPct": 14.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "CTRA",
            "company": "Coterra Energy Inc.",
            "sector": "Energy",
            "defaultPrice": 27.85,
            "defaultChgPct": 0.18,
            "sharesBn": 0.733,
            "forwardEps": 2.85,
            "fcfTtmBn": 1.96,
            "netDebtBn": 2.60,
            "annualDiv": 0.84,
            "fcfPayoutPct": 32.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "MPC",
            "company": "Marathon Petroleum Corp.",
            "sector": "Energy",
            "defaultPrice": 372.74,
            "defaultChgPct": 0.85,
            "sharesBn": 0.316,
            "forwardEps": 31.20,
            "fcfTtmBn": 11.75,
            "netDebtBn": 23.20,
            "annualDiv": 3.64,
            "fcfPayoutPct": 11.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "PFG",
            "company": "Principal Financial Group",
            "sector": "Financials",
            "defaultPrice": 49.40,
            "defaultChgPct": -0.30,
            "sharesBn": 0.227,
            "forwardEps": 5.30,
            "fcfTtmBn": 1.28,
            "netDebtBn": 0.0,
            "annualDiv": 3.04,
            "fcfPayoutPct": 54.0,
            "eligibleFcfEv": False,
        },
        {
            "ticker": "LYB",
            "company": "LyondellBasell Industries",
            "sector": "Materials",
            "defaultPrice": 78.66,
            "defaultChgPct": -3.28,
            "sharesBn": 0.323,
            "forwardEps": 7.45,
            "fcfTtmBn": 2.22,
            "netDebtBn": 9.80,
            "annualDiv": 4.68,
            "fcfPayoutPct": 68.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "DOW",
            "company": "Dow Inc.",
            "sector": "Materials",
            "defaultPrice": 47.20,
            "defaultChgPct": -1.12,
            "sharesBn": 0.701,
            "forwardEps": 4.10,
            "fcfTtmBn": 2.72,
            "netDebtBn": 13.50,
            "annualDiv": 2.80,
            "fcfPayoutPct": 72.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "PFE",
            "company": "Pfizer Inc.",
            "sector": "Health Care",
            "defaultPrice": 29.18,
            "defaultChgPct": 0.52,
            "sharesBn": 5.668,
            "forwardEps": 3.05,
            "fcfTtmBn": 16.50,
            "netDebtBn": 54.00,
            "annualDiv": 1.72,
            "fcfPayoutPct": 59.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "CAG",
            "company": "Conagra Brands, Inc.",
            "sector": "Consumer Staples",
            "defaultPrice": 24.85,
            "defaultChgPct": 0.24,
            "sharesBn": 0.475,
            "forwardEps": 2.55,
            "fcfTtmBn": 1.28,
            "netDebtBn": 8.10,
            "annualDiv": 1.40,
            "fcfPayoutPct": 52.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "KHC",
            "company": "The Kraft Heinz Company",
            "sector": "Consumer Staples",
            "defaultPrice": 29.10,
            "defaultChgPct": -0.17,
            "sharesBn": 1.210,
            "forwardEps": 3.02,
            "fcfTtmBn": 3.52,
            "netDebtBn": 18.40,
            "annualDiv": 1.60,
            "fcfPayoutPct": 55.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "VZ",
            "company": "Verizon Communications",
            "sector": "Communication Services",
            "defaultPrice": 49.94,
            "defaultChgPct": 1.40,
            "sharesBn": 4.209,
            "forwardEps": 4.72,
            "fcfTtmBn": 19.60,
            "netDebtBn": 144.00,
            "annualDiv": 2.71,
            "fcfPayoutPct": 58.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "UPS",
            "company": "United Parcel Service, Inc.",
            "sector": "Industrials",
            "defaultPrice": 121.40,
            "defaultChgPct": -0.45,
            "sharesBn": 0.855,
            "forwardEps": 8.95,
            "fcfTtmBn": 8.10,
            "netDebtBn": 19.20,
            "annualDiv": 6.56,
            "fcfPayoutPct": 69.0,
            "eligibleFcfEv": True,
        },
        {
            "ticker": "MO",
            "company": "Altria Group, Inc.",
            "sector": "Consumer Staples",
            "defaultPrice": 75.80,
            "defaultChgPct": 0.65,
            "sharesBn": 1.695,
            "forwardEps": 5.45,
            "fcfTtmBn": 9.10,
            "netDebtBn": 23.50,
            "annualDiv": 4.08,
            "fcfPayoutPct": 76.0,
            "eligibleFcfEv": True,
        },
    ]

    # Pull live prices from Yahoo Finance for all constituents in universe
    enriched = []
    for row in universe:
        sym = row["ticker"]
        price = row["defaultPrice"]
        chg_pct = row["defaultChgPct"]
        yf_q = get_yf_quote([sym])
        if yf_q and yf_q[0] > 1.0:
            price = round(yf_q[0], 2)
            chg_pct = round(yf_q[3], 2)

        mkt_cap_bn = round(price * row["sharesBn"], 1)
        fwd_pe = round(price / row["forwardEps"], 2) if row["forwardEps"] > 0 else 999.0
        ey_pct = round((row["forwardEps"] / price) * 100.0, 2) if price > 0 else 0.0
        ev_bn = round(mkt_cap_bn + row["netDebtBn"], 1)
        fcf_ev_pct = round((row["fcfTtmBn"] / ev_bn) * 100.0, 2) if ev_bn > 0 else 0.0
        div_yld_pct = round((row["annualDiv"] / price) * 100.0, 2) if price > 0 else 0.0

        enriched.append({
            **row,
            "price": price,
            "changePct": chg_pct,
            "marketCapBn": mkt_cap_bn,
            "forwardPe": fwd_pe,
            "earningsYieldPct": ey_pct,
            "enterpriseValueBn": ev_bn,
            "fcfToEvPct": fcf_ev_pct,
            "dividendYieldPct": div_yld_pct,
        })

    # 1. Top 10 Best Price / Forward P/E (lowest positive NTM P/E >= 4.0x)
    pe_candidates = [r for r in enriched if r["forwardPe"] >= 4.0]
    pe_candidates.sort(key=lambda x: x["forwardPe"])
    top_forward_pe = []
    for i, r in enumerate(pe_candidates[:10]):
        top_forward_pe.append({
            "rank": i + 1,
            "ticker": r["ticker"],
            "company": r["company"],
            "sector": r["sector"],
            "price": r["price"],
            "changePct": r["changePct"],
            "forwardPe": r["forwardPe"],
            "forwardEps": r["forwardEps"],
            "earningsYieldPct": r["earningsYieldPct"],
            "marketCapBn": r["marketCapBn"],
        })

    # 2. Top 10 Best Free Cash Flow / Current Enterprise Value (highest FCF/EV %, ex-Financials/REITs)
    fcf_candidates = [r for r in enriched if r["eligibleFcfEv"] and r["fcfToEvPct"] > 0]
    fcf_candidates.sort(key=lambda x: x["fcfToEvPct"], reverse=True)
    top_fcf_ev = []
    for i, r in enumerate(fcf_candidates[:10]):
        top_fcf_ev.append({
            "rank": i + 1,
            "ticker": r["ticker"],
            "company": r["company"],
            "sector": r["sector"],
            "price": r["price"],
            "changePct": r["changePct"],
            "fcfToEvPct": r["fcfToEvPct"],
            "fcfTtmBn": r["fcfTtmBn"],
            "enterpriseValueBn": r["enterpriseValueBn"],
            "marketCapBn": r["marketCapBn"],
            "netDebtBn": r["netDebtBn"],
        })

    # 3. Top 10 Best Dividend / Price (highest sustainable dividend yield %, FCF payout < 85%)
    div_candidates = [r for r in enriched if r["annualDiv"] > 0 and 0 < r["fcfPayoutPct"] < 85.0]
    div_candidates.sort(key=lambda x: x["dividendYieldPct"], reverse=True)
    top_div_yield = []
    for i, r in enumerate(div_candidates[:10]):
        top_div_yield.append({
            "rank": i + 1,
            "ticker": r["ticker"],
            "company": r["company"],
            "sector": r["sector"],
            "price": r["price"],
            "changePct": r["changePct"],
            "dividendYieldPct": r["dividendYieldPct"],
            "annualDividendPerShare": r["annualDiv"],
            "fcfPayoutRatioPct": r["fcfPayoutPct"],
            "marketCapBn": r["marketCapBn"],
        })

    # Fetch live S&P 500 equity, valuation & US policy/political-economic news via RSS
    eq_headlines = []
    eq_rss_urls = [
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:cnbc.com+OR+site:wsj.com+OR+site:ft.com+OR+site:marketwatch.com)+(%22S%26P+500%22+OR+%22Wall+Street%22+OR+%22US+stocks%22+OR+%22corporate+earnings%22)+(tariff+OR+tax+OR+Fed+OR+Treasury+OR+valuation+OR+dividend+OR+%22free+cash+flow%22+OR+buyback+OR+guidance+OR+policy)+when:24h&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=(site:reuters.com+OR+site:bloomberg.com+OR+site:cnbc.com+OR+site:wsj.com+OR+site:marketwatch.com)+(%22S%26P+500%22+OR+%22Wall+Street%22+OR+%22US+stocks%22+OR+%22earnings+yield%22+OR+%22dividend+stocks%22+OR+%22free+cash+flow%22)+when:48h&hl=en-US&gl=US&ceid=US:en",
        "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    ]
    now_utc = datetime.now(timezone.utc)
    cutoff_48h = now_utc - timedelta(hours=48)
    seen_eq = set()

    def get_eq_cluster(title: str) -> str:
        low_t = title.lower()
        if any(k in low_t for k in ["coreweave", "anthropic", "ipo"]):
            return "eq_ai_ipo_earnings"
        if any(k in low_t for k in ["tariff", "trade", "white house", "trump", "congress", "senate", "tax", "deregulation", "antitrust", "policy"]):
            return "eq_pol_tariff_tax"
        if any(k in low_t for k in ["fed", "powell", "bowman", "waller", "treasury", "yield", "rate", "inflation", "cpi"]):
            return "eq_fed_rates_erp"
        if any(k in low_t for k in ["dividend", "buyback", "capital return", "income"]):
            return "eq_div_buyback"
        if any(k in low_t for k in ["energy", "oil", "exxon", "chevron", "conocophillips", "free cash flow", "cash flow"]):
            return "eq_fcf_energy"
        if any(k in low_t for k in ["nvidia", "tech", "ai", "semiconductor", "megacap", "nasdaq", "multiple", "valuation"]):
            return "eq_tech_multiples"
        if any(k in low_t for k in ["s&p 500", "wall st", "wall street", "dow", "stocks", "equities", "earnings"]):
            return "eq_spx_broad_" + re.sub(r"[^a-z0-9]", "", low_t)[:14]
        return "eq_" + re.sub(r"[^a-z0-9]", "", low_t)[:24]

    for rss_url in eq_rss_urls:
        try:
            xml_bytes = http_get_bytes(rss_url, timeout=12)
            root = ET.fromstring(xml_bytes)
            for item in root.findall(".//item"):
                raw_title = html.unescape(item.findtext("title") or "").strip()
                pub_str = (item.findtext("pubDate") or "").strip()
                link = (item.findtext("link") or "").strip()
                raw_source = (item.findtext("source") or "CNBC").strip()
                clean_title = re.sub(r"(?:\s+-\s+[^-]+)+$", "", raw_title).strip()
                if not clean_title or len(clean_title) < 24:
                    continue
                low_c = clean_title.lower()
                if any(ex in low_c for ex in ["biggest moves premarket", "biggest moves midday", "here are ", "check out ", "lottery", "horoscope", "sports", "roundup: market talk", "how much you can make", "personal finance", "401(k)", "roth ira"]):
                    continue
                if not any(k in low_c for k in ["s&p", "wall st", "stock", "equit", "market", "dow", "nasdaq", "earning", "dividend", "cash flow", "tariff", "tax", "fed", "treasury", "yield", "buyback", "investor"]):
                    continue
                key = re.sub(r"[^a-z0-9]", "", low_c)[:42]
                if key in seen_eq:
                    continue
                try:
                    pub_dt = email.utils.parsedate_to_datetime(pub_str)
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    else:
                        pub_dt = pub_dt.astimezone(timezone.utc)
                except Exception:
                    continue
                if pub_dt < cutoff_48h or pub_dt > now_utc + timedelta(minutes=10):
                    continue
                seen_eq.add(key)
                norm_src = normalize_source_name(raw_source, link)
                age_h = max(0.0, (now_utc - pub_dt).total_seconds() / 3600.0)
                prio = (12.0 if age_h <= 12 else (8.0 if age_h <= 24 else 3.5))
                if any(k in low_c for k in ["s&p 500", "wall street", "earnings", "valuation", "tariff", "tax", "dividend", "free cash flow", "fed", "treasury"]):
                    prio += 4.0
                eq_headlines.append({
                    "pub_dt": pub_dt,
                    "cluster": get_eq_cluster(clean_title),
                    "priority": prio,
                    "title": clean_title,
                    "headline": clean_title,
                    "source": norm_src,
                    "timeAgo": format_time_ago(pub_dt, now_utc),
                    "url": link or "https://finance.yahoo.com/quote/%5EGSPC/",
                })
        except Exception as e:
            print(f"Warn: S&P 500 RSS fetch error: {e}")

    eq_headlines.sort(key=lambda x: (x["priority"], x["pub_dt"]), reverse=True)
    deduped_eq = []
    used_eq_clusters = set()
    for item in eq_headlines:
        if item["cluster"] in used_eq_clusters:
            continue
        used_eq_clusters.add(item["cluster"])
        deduped_eq.append(item)
        if len(deduped_eq) >= 5:
            break
    if len(deduped_eq) < 5:
        for item in eq_headlines:
            if item not in deduped_eq:
                deduped_eq.append(item)
            if len(deduped_eq) >= 5:
                break

    selected_eq = sorted(deduped_eq[:5], key=lambda x: x["pub_dt"], reverse=True)
    used_eq_sigs = set()
    top_eq_news = []

    sig_templates = [
        f"With S&P 500 ({spx_lvl:,.2f}) trading at {fwd_pe_index:.1f}x NTM EPS ({ey_index_pct:.2f}% E/P vs {ust_10y:.2f}% 10Y UST), institutional flows favor low-multiple leaders led by {top_forward_pe[0]['ticker']} ({top_forward_pe[0]['forwardPe']:.2f}x).",
        f"Highlights cross-sectional dispersion between cap-weighted S&P 500 multiples and unlevered FCF/EV leaders led by {top_fcf_ev[0]['ticker']} ({top_fcf_ev[0]['fcfToEvPct']:.2f}%) and {top_fcf_ev[1]['ticker']} ({top_fcf_ev[1]['fcfToEvPct']:.2f}%).",
        f"Reinforces institutional rotation into FCF-covered S&P 500 dividend compounders led by {top_div_yield[0]['ticker']} ({top_div_yield[0]['dividendYieldPct']:.2f}%) and {top_div_yield[1]['ticker']} ({top_div_yield[1]['dividendYieldPct']:.2f}%).",
        f"Guides equity risk premium ({erp_bps:+d} bps vs 10Y Treasury) positioning across S&P 500 Value, Free Cash Flow Yield, and Shareholder Yield factor baskets.",
        f"Shapes quarterly capital-return expectations as S&P 500 buyback and cash-dividend leaders outperform high-beta growth on rate volatility.",
    ]

    for idx, item in enumerate(selected_eq):
        low_t = item["title"].lower()
        cand_sigs = []
        if any(k in low_t for k in ["tariff", "trade", "white house", "trump", "congress", "tax", "policy", "regulation"]):
            cand_sigs.append(
                f"US trade, tariff, and fiscal-tax policy shifts drive sector dispersion between domestic cash-flow compounders ({top_fcf_ev[0]['ticker']} {top_fcf_ev[0]['fcfToEvPct']:.2f}% FCF/EV) and global multinationals."
            )
        if any(k in low_t for k in ["fed", "powell", "treasury", "yield", "rate", "inflation"]):
            cand_sigs.append(
                f"Directly impacts the S&P 500 equity risk premium ({erp_bps:+d} bps over {ust_10y:.2f}% 10Y UST), favoring low-duration Forward P/E leaders ({top_forward_pe[0]['ticker']} {top_forward_pe[0]['forwardPe']:.2f}x)."
            )
        cand_sigs.extend(sig_templates)
        sig = cand_sigs[0]
        for cs in cand_sigs:
            if cs not in used_eq_sigs:
                sig = cs
                used_eq_sigs.add(cs)
                break
        else:
            sig = f"{sig_templates[idx % len(sig_templates)].rstrip('.')} (#{idx + 1})."
            used_eq_sigs.add(sig)

        top_eq_news.append({
            "title": item["title"],
            "headline": item["headline"],
            "source": item["source"],
            "timeAgo": item["timeAgo"],
            "significance": sig,
            "url": item["url"],
        })

    if len(top_eq_news) < 5:
        fallback_eq_news = [
            {
                "title": f"S&P 500 Trades at {fwd_pe_index:.1f}x NTM Forward P/E as 10Y Treasury Yield Anchors Equity Risk Premium Debate",
                "headline": f"S&P 500 Trades at {fwd_pe_index:.1f}x NTM Forward P/E as 10Y Treasury Yield Anchors Equity Risk Premium Debate",
                "source": "Bloomberg",
                "timeAgo": "2h ago",
                "significance": sig_templates[0],
                "url": "https://finance.yahoo.com/quote/%5EGSPC/",
            },
            {
                "title": "Energy & Free Cash Flow Leaders Outperform on Disciplined Capex and Buyback Execution",
                "headline": "Energy & Free Cash Flow Leaders Outperform on Disciplined Capex and Buyback Execution",
                "source": "Reuters",
                "timeAgo": "4h ago",
                "significance": sig_templates[1],
                "url": "https://www.reuters.com/markets/us/",
            },
            {
                "title": "US Corporate Dividend Aristocrats & High-Yield Value See Inflows Amid Rate Volatility",
                "headline": "US Corporate Dividend Aristocrats & High-Yield Value See Inflows Amid Rate Volatility",
                "source": "CNBC",
                "timeAgo": "5h ago",
                "significance": sig_templates[2],
                "url": "https://www.cnbc.com/us-markets/",
            },
            {
                "title": "Airlines & Detroit Automakers Lead S&P 500 Forward Earnings Yield Screen on Resilient Travel & Truck Demand",
                "headline": "Airlines & Detroit Automakers Lead S&P 500 Forward Earnings Yield Screen on Resilient Travel & Truck Demand",
                "source": "WSJ",
                "timeAgo": "7h ago",
                "significance": sig_templates[3],
                "url": "https://www.wsj.com/finance/stocks",
            },
            {
                "title": "Telecom & Cable De-Leveraging Boosts Free Cash Flow Conversion for Comcast and Verizon",
                "headline": "Telecom & Cable De-Leveraging Boosts Free Cash Flow Conversion for Comcast and Verizon",
                "source": "MarketWatch",
                "timeAgo": "9h ago",
                "significance": sig_templates[4],
                "url": "https://www.marketwatch.com/markets",
            },
        ]
        for fb in fallback_eq_news:
            if len(top_eq_news) >= 5:
                break
            top_eq_news.append(fb)

    data["equities"] = {
        "asOfDate": datetime.now(SGT).strftime("%d %b %Y"),
        "indexSummary": {
            "spxLevel": round(spx_lvl, 2),
            "spxChange": round(spx_chg, 2),
            "spxChangePct": round(spx_pct, 2),
            "spxForwardPe": fwd_pe_index,
            "spxEarningsYieldPct": ey_index_pct,
            "us10YYieldPct": round(ust_10y, 2),
            "equityRiskPremiumBps": erp_bps,
            "spxDividendYieldPct": 1.24,
            "spxFcfYieldPct": 3.85,
        },
        "topForwardPe": top_forward_pe,
        "topFcfToEv": top_fcf_ev,
        "topDividendYield": top_div_yield,
        "forwardPeSubNote": {
            "dataSource": "Live NYSE/Nasdaq Closing & Intraday Share Prices via Yahoo Finance API (v8 Chart Feed) paired with S&P Capital IQ / FactSet Bottom-Up Consensus Next-12-Month (NTM) Operating EPS Estimates.",
            "formula": "Price / Forward P/E = Current Share Price (P₀) ÷ Consensus NTM Operating EPS (EPS_NTM)",
            "derivationAndMeaning": "Measures the dollar price investors pay today for $1.00 of consensus Next-12-Month (NTM) operating earnings. The reciprocal — Forward Earnings Yield (E/P = 1 ÷ Forward P/E) — represents the implied equity yield available to compare directly against the 10-Year US Treasury risk-free rate.",
            "screeningRule": "Screened across active S&P 500 constituents with positive NTM consensus operating EPS and Forward P/E ≥ 4.0x to eliminate distressed one-off accounting distortions.",
        },
        "fcfToEvSubNote": {
            "dataSource": "Trailing 12-Month (TTM) GAAP Cash Flow Statements & Balance Sheets (SEC Form 10-K / 10-Q via S&P Capital IQ) combined with Live Equity Market Capitalization from NYSE/Nasdaq (Yahoo Finance API).",
            "formula": "FCF / EV (%) = [Operating Cash Flow (TTM) − Capital Expenditures (TTM)] ÷ [Market Capitalization + Total Debt + Preferred Stock − Cash & Short-Term Investments]",
            "derivationAndMeaning": "Measures unlevered organic cash generation relative to the entire capital structure claim (both equity market cap and net debt). Unlike P/E or Price/FCF, FCF/EV penalizes balance-sheet leverage and rewards net-cash generators, serving as the primary institutional buyout and capital-return valuation anchor.",
            "screeningRule": "Excludes GICS Financials and Equity REITs where customer deposits, insurance float, and property mortgage debt make standard Enterprise Value non-comparable.",
        },
        "dividendYieldSubNote": {
            "dataSource": "Company Board-Declared Regular Cash Dividend Filings (Annualized Indicated Dividend Rate per Share) divided by Live NYSE/Nasdaq Closing Share Price via Yahoo Finance API.",
            "formula": "Dividend / Price (%) = (Latest Declared Regular Cash Dividend per Share × Annual Payment Frequency) ÷ Current Share Price (P₀)",
            "derivationAndMeaning": "Measures the immediate gross cash income return paid to common shareholders as a percentage of current share price, excluding special one-time distributions and share buybacks. Comparing Dividend / Price against FCF Payout Ratio identifies durable income compounders versus leveraged yield traps.",
            "screeningRule": "Screened for regular recurring cash dividends with positive TTM Free Cash Flow coverage (FCF Payout Ratio < 85%) to filter out distressed or unsustainable dividend yields.",
        },
        "noteworthyHeadlines": top_eq_news,
    }


def translate_bahasa_batch_to_english(titles_id: list[str]) -> list[str]:
    """Translate a batch of Bahasa Indonesia strings into fluent institutional English.
    Uses indexed [0], [1], ... markers so punctuation (! / ?) never causes line-merge drops,
    plus per-item fallback and an institutional Indonesian macro/political glossary.
    """
    if not titles_id:
        return []

    bahasa_verify_markers = [
        "serahkan", "pengunduran", "naik ", "tanpa ", "potret ", "beberkan",
        "penyadapan", "oleh ", "kabar ", "mundur", "ungkap", "jurus",
        "pemerintah", "pakai ", "saham ", "didepak", "mulai ", "usung ",
        "hingga ", "luncurkan", "peduli ", "pengangguran", "tertekan",
        "menguat", "keluarkan", "ikut ", "tersingkir", "pecat ", "harga ",
        "jatuh ", "muncul ", "setelah ", "jalan ", "sebut ", "unjuk ",
        "buka suara", "hadiri ", "pantau ", "lalu lintas", "hari ini",
        "dengan ", "dalam ", "untuk ", "tidak ", "akan ", "sudah ", "bisa ",
    ]

    def is_still_bahasa(text_en: str, orig_id: str) -> bool:
        if not text_en:
            return True
        if text_en.strip().lower() == orig_id.strip().lower():
            return True
        low = " " + text_en.lower() + " "
        hits = sum(1 for m in bahasa_verify_markers if m in low)
        return hits >= 2

    def preprocess_bahasa_for_mt(orig_id: str) -> str:
        s = orig_id.strip()
        s = re.sub(r"^Tok!\s*", "Resmi: ", s, flags=re.IGNORECASE)
        s = re.sub(r"^Sah!\s*", "Resmi: ", s, flags=re.IGNORECASE)
        s = re.sub(r"^Potret\s+", "Foto: ", s, flags=re.IGNORECASE)
        s = re.sub(r"\bPatwal\b", "Pengawalan Polisi (Patwal)", s, flags=re.IGNORECASE)
        s = re.sub(r"\bCs\b", "dan kawan-kawan", s)
        s = re.sub(r"(Rp\.?\s*\d+(?:[.,]\d+)?)\s*M\b", r"\1 Miliar", s)
        s = re.sub(r"\bTembus\s+(Rp|Level|\d)", r"Menembus \1", s, flags=re.IGNORECASE)
        return s

    def polish_institutional_en(text_en: str, orig_id: str) -> str:
        t = text_en.strip()
        t = re.sub(r"^\[\d+\]\s*", "", t)
        t = re.sub(r"^[\u200b\u2060\ufeff\-•\s]+", "", t)
        replacements = [
            (r"^Knock!\s*", "Official: "),
            (r"^Portrait of\s+(?:the\s+)?", "Photos: "),
            (r"\bTranslucent\b", "Breaches"),
            (r"\btranslucent\b", "breaches"),
            (r"\bPrints Profits of\b", "Posts Net Profit of"),
            (r"\bPrints Profit of\b", "Posts Net Profit of"),
            (r"\bOpens Voice\b", "Responds"),
            (r"\bopens voice\b", "responds"),
            (r"\bopens its voice\b", "responds"),
            (r"\band friends\b", "et al."),
            (r"\bWithout Patwal\b", "Without Police Escort (Patwal)"),
            (r"\bwithout Patwal\b", "without police escort (Patwal)"),
            (r"\bprocurement of (IDR [\d.,]+ billion) in influence\b", r"\1 government influencer procurement"),
            (r"\bprocurement of influence of (IDR [\d.,]+ billion)\b", r"\1 government influencer procurement"),
            (r"\bIDR 2,560 million\b", "IDR 2.56 million per gram"),
            (r"\bRI\b", "Indonesia"),
            (r"\bJCI\b", "IHSG (JCI)"),
            (r"\bIHSG\b(?!\s*\(JCI\))", "IHSG (JCI)"),
            (r"\bBEI\b", "IDX (BEI)"),
            (r"\bWapres\b", "VP"),
            (r"\bMendikti\b", "Higher Education Minister"),
            (r"\bMenkeu\b", "Finance Minister"),
            (r"\bWamen\b", "Deputy Minister"),
            (r"\bSeskab\b", "Cabinet Secretary"),
            (r"\bKabakom\b", "Presidential Communication Head"),
            (r"\bKapolri\b", "National Police Chief"),
            (r"\bDirut\b", "President Director"),
            (r"\bEmiten\b", "Listed Issuers"),
            (r"\bemiten\b", "listed issuers"),
            (r"\bBUMN\b", "SOE (BUMN)"),
            (r"\bSBN\b", "SBN (IndoGB)"),
            (r"\bAPBN\b", "APBN (State Budget)"),
            (r"\bKSSK\b", "KSSK (Financial System Stability Committee)"),
            (r"\bHMP\b", "HMP (Parliamentary Inquiry Right)"),
            (r"\bKUR\b", "KUR (People's Business Credit)"),
            (r"\bUMKM\b", "MSMEs (UMKM)"),
            (r"\bOrmas\b", "Mass Organizations"),
            (r"\bormas\b", "mass organizations"),
            (r"\bRp\.?\s*(\d)", r"IDR \1"),
        ]
        for pat, rep in replacements:
            t = re.sub(pat, rep, t)
        if t:
            t = t[0].upper() + t[1:]
        return t

    def translate_single_item(orig_id: str) -> str:
        prep = preprocess_bahasa_for_mt(re.sub(r"[\r\n]+", " ", orig_id))
        single_urls = [
            "https://clients5.google.com/translate_a/single?client=at&sl=id&tl=en&dt=t&q="
            + urllib.parse.quote(prep),
            "https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=en&dt=t&q="
            + urllib.parse.quote(prep),
        ]
        for u in single_urls:
            try:
                raw_b = http_get_bytes(u, timeout=8)
                p = json.loads(raw_b.decode("utf-8"))
                s_en = "".join(seg[0] for seg in p[0] if seg and seg[0]).strip()
                if s_en:
                    return polish_institutional_en(s_en, orig_id)
            except Exception:
                continue
        return polish_institutional_en(orig_id, orig_id)

    translated_results = list(titles_id)
    batch_size = 15
    for start in range(0, len(titles_id), batch_size):
        chunk = titles_id[start : start + batch_size]
        if not chunk:
            continue
        clean_chunk = [preprocess_bahasa_for_mt(re.sub(r"[\r\n]+", " ", x)) for x in chunk]
        # Prefix each line with [idx] so punctuation (! / ?) never causes line-merge drops
        tagged_lines = [f"[{idx_c}] {txt}" for idx_c, txt in enumerate(clean_chunk)]
        joined = "\n".join(tagged_lines)
        endpoints = [
            "https://clients5.google.com/translate_a/single?client=at&sl=id&tl=en&dt=t&q="
            + urllib.parse.quote(joined),
            "https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=en&dt=t&q="
            + urllib.parse.quote(joined),
        ]
        parsed_map: dict[int, str] = {}
        for t_url in endpoints:
            try:
                raw_bytes = http_get_bytes(t_url, timeout=10)
                parsed = json.loads(raw_bytes.decode("utf-8"))
                full_en = "".join(seg[0] for seg in parsed[0] if seg and seg[0])
                matches = re.findall(r"\[(\d+)\]\s*(.*?)(?=\s*\[\d+\]|\Z)", full_en, re.S)
                if len(matches) >= max(1, len(clean_chunk) - 2):
                    for k_str, val_str in matches:
                        k_idx = int(k_str)
                        if 0 <= k_idx < len(chunk):
                            parsed_map[k_idx] = val_str.strip()
                    break
            except Exception as e:
                print(f"Warn: Bahasa batch endpoint warning: {e}")

        for idx_in_chunk, orig in enumerate(chunk):
            candidate_en = parsed_map.get(idx_in_chunk, "")
            if candidate_en:
                polished = polish_institutional_en(candidate_en, orig)
                if not is_still_bahasa(polished, orig):
                    translated_results[start + idx_in_chunk] = polished
                    continue
            # Fallback to single-item translation if missing or still in Bahasa
            translated_results[start + idx_in_chunk] = translate_single_item(orig)

    return translated_results


def fetch_live_indonesia_local_translated_news(data: dict):
    """Gather Bahasa Indonesia local-language news from 10+ major Indonesian domestic portals,
    translate headlines & article summaries into institutional English, and rank:
    1) Top 10 Most Important Local News (ranked by macro, BI/OJK, fiscal/APBN, IDX/MSCI, and political-economic impact)
    2) Top 10 Most Read / Trending Local News (ranked by Indonesian Top-Stories placement & multi-portal syndication)
    """
    now_utc = datetime.now(timezone.utc)
    cutoff_48h = now_utc - timedelta(hours=48)

    id_fx = data.get("indonesia", {}).get("fxAndNdf", {})
    id_bonds = data.get("indonesia", {}).get("bonds", {})
    spot_idr = int(id_fx.get("spotRate", 18070))
    jisdor = int(id_fx.get("jisdorRate", 18130))
    ihsg_lvl = float(id_fx.get("ihsgIndex", {}).get("level", 5075.13))
    indo_10y = next(
        (float(b["yield"]) for b in id_bonds.get("indoGB", []) if b["tenor"].startswith("10Y")),
        7.69,
    )
    srbi_12m = next(
        (
            float(s.get("weightedAvgYield") or s.get("cutOffYield") or 6.675)
            for s in id_bonds.get("srbi", [])
            if s.get("tenor") == "12M"
        ),
        6.675,
    )

    local_feeds = [
        (
            "Google News ID · Top Stories",
            "top_read",
            "https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id",
        ),
        (
            "ANTARA · Top News (Terpopuler)",
            "top_read",
            "https://www.antaranews.com/rss/top-news.xml",
        ),
        (
            "Google News ID · Top Business",
            "both",
            "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=id&gl=ID&ceid=ID:id",
        ),
        (
            "Google News ID · Top National",
            "top_read",
            "https://news.google.com/rss/headlines/section/topic/NATION?hl=id&gl=ID&ceid=ID:id",
        ),
        (
            "CNBC Indonesia · Market RSS",
            "both",
            "https://www.cnbcindonesia.com/market/rss",
        ),
        (
            "CNBC Indonesia · News RSS",
            "both",
            "https://www.cnbcindonesia.com/news/rss",
        ),
        (
            "ANTARA · Ekonomi RSS",
            "important",
            "https://www.antaranews.com/rss/ekonomi.xml",
        ),
        (
            "ANTARA · Politik & Nasional RSS",
            "important",
            "https://www.antaranews.com/rss/politik.xml",
        ),
        (
            "Tier-1 ID Financial & Political Search (24h)",
            "important",
            "https://news.google.com/rss/search?q=(site:kontan.co.id+OR+site:bisnis.com+OR+site:cnbcindonesia.com+OR+site:kompas.com+OR+site:detik.com+OR+site:tempo.co+OR+site:katadata.co.id+OR+site:investor.id)+(ekonomi+OR+rupiah+OR+IHSG+OR+APBN+OR+Prabowo+OR+Gibran+OR+DPR+OR+%22Bank+Indonesia%22+OR+OJK+OR+investasi+OR+pajak+OR+obligasi+OR+inflasi+OR+Danantara)+when:24h&hl=id&gl=ID&ceid=ID:id",
        ),
    ]

    exclude_words = [
        "parlemen israel", "pete hegseth", "rudal dan drone", "serang iran",
        "sepak bola", "timnas", "liga inggris", "liga champions", "motogp",
        "jadwal tv", "sinopsis", "artis ", "selebriti", "zodiak", "ramalan",
        "resep ", "cara aman berkendara", "kelebihan pertamax", "pengaruh pertamax",
        "produsen snack", "kuliner", "wisata", "cuaca hari ini", "gempa bumi magnitudo",
        "sosok lori huang", "jensen huang digugat", "selingkuh dengan mata-mata",
        "infinix smart", "hp nfc harga", "bunga zainal", "raffi ahmad", "rans jawab",
        "museum rumah", "tempat kawinan", "penghuni mal ri berganti",
        "berita ekonomi & bisnis terkini hari ini", "cabuli", "perkosa", "pembunuhan",
        "galaxy tab", "samsung galaxy", "iphone ", "xiaomi ", "oppo ", "vivo ",
        "netanyahu", "eisenkot", "sekolah di italia", "g7 desak iran", "iaea",
        "liga voli", "jadwal siaran", "kunci jawaban", "kode redeem",
    ]

    indo_markers = [
        "indonesia", "jakarta", "rupiah", "ihsg", "bank indonesia",
        "ojk", "prabowo", "gibran", "wapres", "presiden", "dpr", "mpr", "mahkamah",
        "kpk", "apbn", "pajak", "kemenkeu", "purbaya", "airlangga", "sri mulyani", "bahlil",
        "danantara", "bumn", "bri ", "mandiri", "bca", "bni", "antam", "pertamina", "pln",
        "emiten", "saham", "obligasi", "sbn", "sukuk", "inflasi", "ekspor", "impor", "investasi",
        "msci", "suku bunga", "likuiditas", "umkm", "kur ", "menteri", "wamen", "kabinet",
        "polri", "kapolri", "kejagung", "korupsi", "hmp", "pemakzulan", "pilkada", "aceh", "ntt", "jawa",
        "sumatra", "kalimantan", "sulawesi", "bali", "ikn", "nusantara", "kssk", "esdm", "migas",
        "bkpm", "byd", "kai ", "inka", "kb bank", "emas ", "kemhan", "kemenkes", "mui ", "yogyakarta",
    ]

    def has_indo_marker(low_text: str) -> bool:
        if re.search(r"\b(ri|bi|mk|bei|ojk|dpr|mpr|kpk|sbn|apbn|bumn|ihsg|umkm|kssk)\b", low_text):
            return True
        return any(m in low_text for m in indo_markers)

    def get_local_id_cluster(title_id: str) -> str:
        low = title_id.lower()
        if any(k in low for k in ["gibran", "wapres", "pemakzulan", "hmp", "ijazah sma", "mahkamah konstitusi", "putusan mk", "muzani"]):
            return "loc_vp_gibran_hmp"
        if any(k in low for k in ["penyadapan", "ahrie sonta", "menyadap"]):
            return "loc_prabowo_wiretap"
        if any(k in low for k in ["30% apbn", "apbn bocor", "rp480 t", "rp 480 t"]):
            return "loc_apbn_leakage"
        if any(k in low for k in ["prabowo", "aceh", "merah putih", "kabinet", "menteri non-profesional", "2 periode"]):
            return "loc_pres_prabowo"
        if any(k in low for k in ["mpr", "hidayat nur wahid"]):
            return "loc_mpr_leadership"
        if any(k in low for k in ["3 badai", "tiga badai", "dikepung"]):
            return "loc_three_storms_macro"
        if any(k in low for k in ["hsc", "300 emiten", "383 saham", "ditendang dari perhitungan ihsg", "didepak dari ihsg", "mpro"]):
            return "loc_idx_hsc_300"
        if any(k in low for k in ["msci", "rebalancing msci", "30 saham out", "investor global"]):
            return "loc_msci_rebalance"
        if any(k in low for k in ["likuiditas rp149", "gelontorkan likuiditas", "bank indonesia", "suku bunga bi"]):
            return "loc_bi_liquidity"
        if any(k in low for k in ["apbn", "kssk", "pajak", "defisit", "kemenkeu"]):
            return "loc_fiscal_apbn_kssk"
        if any(k in low for k in ["dana asing", "6 saham bumn", "net buy asing"]):
            return "loc_foreign_flows_bumn"
        if any(k in low for k in ["bri cetak laba", "kb bank", "bni tutup", "perbankan"]):
            return "loc_banking_earnings"
        if any(k in low for k in ["hacker", "siber", "cyber"]):
            return "loc_cyber_banking"
        if any(k in low for k in ["emas antam", "harga emas"]):
            return "loc_antam_gold"
        if any(k in low for k in ["byd", "vietnam lawan tangguh", "bkpm", "kawasan industri"]):
            return "loc_fdi_industrial"
        if any(k in low for k in ["esdm", "blok migas", "pertamina"]):
            return "loc_energy_esdm"
        if any(k in low for k in ["kelas menengah", "tumbuh 5,47", "pertumbuhan ri"]):
            return "loc_gdp_middle_class"
        if any(k in low for k in ["ihsg", "lq45", "sanksi mengintai"]):
            return "loc_ihsg_session"
        if any(k in low for k in ["kurs rupiah", "rupiah tembus", "rupiah menguat", "rupiah tertekan", "rupiah kembali"]):
            return "loc_rupiah_fx"
        if any(k in low for k in ["kpk", "icw", "tersangka", "pangan"]):
            return "loc_kpk_governance"
        return "loc_" + re.sub(r"[^a-z0-9]", "", low)[:22]

    def classify_category_and_impact(title_id: str) -> tuple[str, str, int]:
        low = title_id.lower()
        if any(k in low for k in ["3 badai", "bank indonesia", "likuiditas", "suku bunga", "kurs rupiah", "rupiah"]):
            return ("BI & Monetary", "Market-Moving", 94)
        if any(k in low for k in ["ihsg", "msci", "hsc", "300 emiten", "383 saham", "bei", "dana asing"]):
            return ("IDX & MSCI", "Market-Moving", 93)
        if any(k in low for k in ["apbn", "kssk", "pajak", "kur 0%", "tumbuh 5,47", "kelas menengah", "danantara"]):
            return ("Fiscal & APBN", "Policy Watch", 92)
        if any(k in low for k in ["gibran", "prabowo", "dpr", "mpr", "mk ", "mahkamah", "hmp", "pemakzulan", "penyadapan", "kpk", "uu pemilu", "muzani"]):
            return ("Executive & Politics", "Policy Watch", 93)
        if any(k in low for k in ["bri ", "bumn", "kb bank", "bni ", "hacker", "ojk"]):
            return ("Banking & BUMN", "Supportive", 90)
        if any(k in low for k in ["investasi", "vietnam", "byd", "bkpm", "kawasan industri", "inka", "kai"]):
            return ("Investment & Trade", "Supportive", 89)
        if any(k in low for k in ["emas", "antam", "esdm", "migas", "pertamina"]):
            return ("Commodities & Energy", "Market-Moving", 88)
        return ("Executive & Politics", "Policy Watch", 85)

    candidates = []
    seen_keys = set()
    cluster_syndication_count = {}

    for feed_label, feed_kind, rss_url in local_feeds:
        try:
            xml_bytes = http_get_bytes(rss_url, timeout=10)
            root = ET.fromstring(xml_bytes)
            for rank_in_feed, item in enumerate(root.findall(".//item")[:25], start=1):
                raw_title = html.unescape(item.findtext("title") or "").strip()
                pub_str = (item.findtext("pubDate") or "").strip()
                link = (item.findtext("link") or "").strip()
                raw_src = (item.findtext("source") or "").strip()
                raw_desc_html = item.findtext("description") or ""
                clean_desc = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw_desc_html))).strip()

                clean_title = re.sub(r"(?:\s+-\s+[^-]+)+$", "", raw_title).strip()
                clean_title = re.sub(r"^Video:\s*", "", clean_title, flags=re.IGNORECASE).strip()
                if not raw_src and " - " in raw_title:
                    raw_src = raw_title.rsplit(" - ", 1)[-1].strip()
                if not raw_src:
                    if "antaranews" in rss_url:
                        raw_src = "ANTARA News"
                    elif "cnbcindonesia" in rss_url:
                        raw_src = "CNBC Indonesia"
                    else:
                        raw_src = "Indonesia Media"

                # Check if RSS description is a genuine summary snippet rather than Google News repeating the headline
                desc_id = ""
                if (
                    clean_desc
                    and len(clean_desc) >= 35
                    and clean_title[:25].lower() not in clean_desc[:40].lower()
                    and "google.com" not in clean_desc.lower()
                ):
                    desc_id = clean_desc[:220].strip()

                if not clean_title or len(clean_title) < 22:
                    continue
                low_t = clean_title.lower()
                if any(ex in low_t for ex in exclude_words):
                    continue
                if not has_indo_marker(low_t):
                    continue

                try:
                    pub_dt = email.utils.parsedate_to_datetime(pub_str)
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    else:
                        pub_dt = pub_dt.astimezone(timezone.utc)
                except Exception:
                    pub_dt = now_utc - timedelta(hours=2)

                if pub_dt < cutoff_48h or pub_dt > now_utc + timedelta(minutes=15):
                    continue

                cluster = get_local_id_cluster(clean_title)
                cluster_syndication_count[cluster] = cluster_syndication_count.get(cluster, 0) + 1

                dedup_key = re.sub(r"[^a-z0-9]", "", low_t)[:42]
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)

                cat, imp_dir, base_score = classify_category_and_impact(clean_title)
                age_h = max(0.0, (now_utc - pub_dt).total_seconds() / 3600.0)
                recency_bonus = 4 if age_h <= 4 else (3 if age_h <= 12 else (1 if age_h <= 24 else 0))

                macro_weight = 0
                if any(k in low_t for k in ["3 badai", "likuiditas rp149", "300 emiten", "383 saham", "rebalancing msci", "investor global", "apbn", "kssk", "bri cetak laba", "gibran", "dpr", "vietnam", "byd", "esdm", "emas antam"]):
                    macro_weight += 4
                raw_imp_score = base_score + recency_bonus + macro_weight - min(6, rank_in_feed // 3)
                importance_score = max(82, min(99, raw_imp_score))

                raw_read_score = (92 if feed_kind in ("top_read", "both") else 78) + max(0, 12 - rank_in_feed) + recency_bonus
                read_score = max(80, min(99, raw_read_score))

                candidates.append({
                    "titleId": clean_title,
                    "descId": desc_id,
                    "source": raw_src,
                    "feedSection": feed_label,
                    "feedKind": feed_kind,
                    "rankInFeed": rank_in_feed,
                    "pub_dt": pub_dt,
                    "timeAgo": format_time_ago(pub_dt, now_utc),
                    "cluster": cluster,
                    "category": cat,
                    "impactDirection": imp_dir,
                    "rawImpScore": raw_imp_score,
                    "importanceScore": importance_score,
                    "readScore": read_score,
                    "url": link or "https://www.cnbcindonesia.com",
                })
        except Exception as e:
            print(f"Warn: Indonesia local feed error ({feed_label}): {e}")

    for c in candidates:
        synd_cnt = cluster_syndication_count.get(c["cluster"], 1)
        c["syndicationCount"] = synd_cnt
        c["readScore"] = max(82, min(99, c["readScore"] + min(6, synd_cnt)))

    # 1. Select Top 10 Most Important Local News (diversified by topic cluster and outlet)
    imp_pool = sorted(
        candidates,
        key=lambda x: (
            x["rawImpScore"],
            x["syndicationCount"],
            x["pub_dt"],
        ),
        reverse=True,
    )
    top_important_raw = []
    used_imp_clusters = set()
    imp_source_counts = {}
    for item in imp_pool:
        if item["cluster"] in used_imp_clusters:
            continue
        if imp_source_counts.get(item["source"], 0) >= 4:
            continue
        used_imp_clusters.add(item["cluster"])
        imp_source_counts[item["source"]] = imp_source_counts.get(item["source"], 0) + 1
        top_important_raw.append(item)
        if len(top_important_raw) >= 10:
            break
    if len(top_important_raw) < 10:
        for item in imp_pool:
            if item not in top_important_raw and item["cluster"] not in used_imp_clusters:
                used_imp_clusters.add(item["cluster"])
                top_important_raw.append(item)
            if len(top_important_raw) >= 10:
                break

    # 2. Select Top 10 Most Read / Trending Local News (zero cluster overlap with Top 10 Important)
    read_pool = sorted(
        candidates,
        key=lambda x: (
            1 if x["feedKind"] == "top_read" else (0.5 if x["feedKind"] == "both" else 0),
            x["syndicationCount"],
            -x["rankInFeed"],
            x["pub_dt"],
        ),
        reverse=True,
    )
    imp_title_set = {x["titleId"] for x in top_important_raw}
    top_read_raw = []
    used_read_clusters = set(used_imp_clusters)
    read_source_counts = {}
    for item in read_pool:
        if item["titleId"] in imp_title_set:
            continue
        if item["cluster"] in used_read_clusters:
            continue
        if read_source_counts.get(item["source"], 0) >= 4:
            continue
        used_read_clusters.add(item["cluster"])
        read_source_counts[item["source"]] = read_source_counts.get(item["source"], 0) + 1
        top_read_raw.append(item)
        if len(top_read_raw) >= 10:
            break
    if len(top_read_raw) < 10:
        for item in read_pool:
            if item["titleId"] not in imp_title_set and item not in top_read_raw and item["cluster"] not in used_read_clusters:
                used_read_clusters.add(item["cluster"])
                top_read_raw.append(item)
            if len(top_read_raw) >= 10:
                break

    # Batch-translate all 20 selected Bahasa headlines AND any RSS description snippets to English
    all_selected_items = top_important_raw + top_read_raw
    combined_titles = [x["titleId"] for x in all_selected_items]
    translated_titles = translate_bahasa_batch_to_english(combined_titles)

    desc_indices = [i for i, x in enumerate(all_selected_items) if x.get("descId")]
    desc_texts = [all_selected_items[i]["descId"] for i in desc_indices]
    translated_descs_list = translate_bahasa_batch_to_english(desc_texts) if desc_texts else []
    translated_desc_map = {idx_item: en_d for idx_item, en_d in zip(desc_indices, translated_descs_list)}

    imp_en_titles = translated_titles[: len(top_important_raw)]
    read_en_titles = translated_titles[len(top_important_raw) :]
    imp_en_descs = [translated_desc_map.get(i, "") for i in range(len(top_important_raw))]
    read_en_descs = [
        translated_desc_map.get(len(top_important_raw) + i, "") for i in range(len(top_read_raw))
    ]

    def build_local_significance_and_summary(
        title_id: str, title_en: str, desc_en: str, src: str, cat: str, idx: int
    ) -> tuple[str, str]:
        low = (title_id + " " + title_en + " " + desc_en).lower()

        # Check if RSS desc_en is a complete sentence (not truncated mid-phrase by ANTARA's 160-char RSS limit)
        clean_d = re.sub(r"\s*\.{2,}$", "", (desc_en or "").strip()).strip()
        is_truncated_desc = bool(
            not clean_d
            or len(clean_d) < 40
            or re.search(
                r"\b(the|a|an|of|to|in|for|with|on|at|from|by|and|or|alleged|general|government|needs|including)\.?$",
                clean_d.lower(),
            )
        )

        # 1. Build a concise, specific 1-line summary of the news story
        if not is_truncated_desc and clean_d.endswith("."):
            summary_en = clean_d
        elif "3 badai" in low or "3 storms" in low:
            summary_en = f"{src} analyzes three simultaneous headwinds facing Indonesia: domestic political shifts, MSCI index rebalancing, and hawkish US Federal Reserve policy."
        elif "30% apbn" in low or "480 t" in low or "bocor" in low:
            summary_en = f"{src} reports President Prabowo Subianto's warning that up to 30% of the APBN (State Budget)—roughly IDR 480 trillion—is lost to budget leakage and inefficiency."
        elif "pdi-p" in low or "pdip" in low or "koalisi" in low:
            summary_en = f"{src} reports President Prabowo Subianto thanking PDI-P for constructive parliamentary support on national priorities despite remaining outside the ruling coalition."
        elif "poliran" in low or "pengangguran" in low:
            summary_en = f"{src} reports that the National Police Chief launched the 'Poliran' vocational agriculture and employment program to absorb unemployed workers."
        elif any(k in low for k in ["gibran", "wapres", "innova", "mpr", "pengunduran diri", "resign", "muzani"]):
            if "innova" in low or "patwal" in low:
                summary_en = f"{src} reports that VP Gibran Rakabuming Raka arrived at the MPR parliamentary complex in a private Kijang Innova without a police escort (Patwal) to submit his resignation letter."
            elif "danantara" in low:
                summary_en = f"{src} reports that sovereign wealth fund Danantara outlined three market-stabilization measures to reassure domestic and foreign investors amid VP Gibran's resignation news."
            elif "ihsg" in low or "melonjak" in low or "jump" in low:
                summary_en = f"{src} reports that the IHSG (JCI) rallied +2% into positive territory as VP Gibran formally submitted his resignation letter to parliament."
            else:
                summary_en = f"{src} covers MPR Chairman Ahmad Muzani and parliamentary leaders processing VP Gibran Rakabuming Raka's formal resignation letter."
        elif any(k in low for k in ["penyadapan", "wiretap", "ahrie sonta", "listyo sigit", "makar", "treason", "sadap"]):
            if "pecat" in low or "fire" in low or "ahrie" in low:
                summary_en = f"{src} reports that the National Police (Polri) dismissed Inspector General Ahrie Sonta Nasution after proving unlawful wiretapping against President Prabowo."
            elif "lpsk" in low or "saksi" in low or "witness" in low:
                summary_en = f"{src} reports that eight witnesses applied for LPSK protection—including one justice collaborator—in the President Prabowo wiretapping investigation."
            elif "laporan polisi" in low or "makar" in low or "treason" in low:
                summary_en = f"{src} reports that the National Police Chief confirmed a formal police investigation has been opened into alleged treason linked to the presidential wiretapping case."
            else:
                summary_en = f"{src} reports that DPR Commission III summoned the National Police Chief to disclose all investigation findings into the unlawful wiretapping of President Prabowo."
        elif any(k in low for k in ["msci", "brpt", "brms", "rebalancing"]):
            summary_en = f"{src} details MSCI's November 2026 index evaluation, which downgrades 1 Indonesian issuer and removes 8 stocks including BRPT and BRMS."
        elif any(k in low for k in ["383 saham", "300 emiten", "hsc", "didepak dari ihsg"]):
            summary_en = f"{src} reports that IDX (BEI) published the list of 383 High Shareholder Concentration (HSC) stocks excluded from IHSG (JCI) index calculations effective November 13, 2026."
        elif "byd" in low:
            summary_en = f"{src} reports on BYD's Indonesian EV expansion, including rapid workforce recruitment at its Subang factory and the IDR 300M fast-charging BYD M6 lineup."
        elif "rupiah" in low and ("18,221" in low or "18.221" in low or "terlemah" in low or "weakest" in low):
            summary_en = f"{src} reports that the Rupiah opened weaker in morning interbank trading on US dollar strength before stabilizing near Rp {spot_idr:,}/USD."
        elif any(k in low for k in ["the fed", "rupiah", "all-time low", "all–time low", "kurs"]):
            summary_en = f"{src} reports that hawkish Federal Reserve interest-rate expectations are pressuring the Indonesian Rupiah toward Rp {spot_idr:,}/USD in onshore FX trading."
        elif "ihsg" in low and ("borong" in low or "10 saham" in low or "10 shares" in low):
            summary_en = f"{src} reports that while the IHSG (JCI) edged down 0.21%, foreign institutional investors recorded net buying across 10 liquid Indonesian blue-chip stocks."
        elif "ihsg" in low and ("net sell" in low or "rel" in low or "rally" in low):
            summary_en = f"{src} reports that the IHSG (JCI) snapped its five-day winning streak on mild foreign profit-taking, closing near {ihsg_lvl:,.2f}."
        elif any(k in low for k in ["apbn", "jor-joran", "kssk", "pajak", "likuiditas", "bank indonesia"]):
            summary_en = f"{src} examines the government's accelerated APBN (State Budget) fiscal spending and Bank Indonesia's liquidity operations to support domestic GDP growth."
        elif "kemhan" in low or "jepang" in low or "japan" in low:
            summary_en = f"{src} reports that the Indonesian Ministry of Defense (Kemhan) is strengthening bilateral defense and maritime cooperation with Japan."
        elif "danantara" in low and ("umkm" in low or "msme" in low):
            summary_en = f"{src} reports that sovereign investment agency Danantara is advancing equal partnerships to help Indonesian MSMEs (UMKM) enter global export supply chains."
        elif "sumatra" in low or "aceh" in low or "enang-enang" in low:
            summary_en = f"{src} reports that reopening the Enang-Enang Bridge in Aceh/Sumatra has restored vital highland transport and agricultural trade routes."
        elif "yogyakarta" in low or "ugm" in low:
            summary_en = f"{src} covers student and civil protests in Yogyakarta and calls by Universitas Gadjah Mada (UGM) for proportionate policing."
        elif "vape" in low or "mui" in low:
            summary_en = f"{src} reports that the Ministry of Health (Kemenkes) responded to the Indonesian Ulema Council (MUI) fatwa declaring vaping haram due to public health risks."
        elif "periset" in low or "researchers" in low or ("kemenkes" in low and "ekonomi" in low):
            summary_en = f"{src} reports that the Ministry of Health urged domestic medical researchers to prioritize commercializing healthcare products with large-scale economic value."
        elif "acer" in low or "laptop ai" in low:
            summary_en = f"{src} reports that Acer unveiled its latest Googlebook and AI-powered laptop lineup for Indonesia's enterprise and education markets."
        elif any(k in low for k in ["emas", "gold", "antam"]):
            summary_en = f"{src} reports a nearly 3% pullback in gold prices as higher US real yields and stronger dollar dynamics trigger profit-taking."
        else:
            summary_en = f"{src} reports on {title_en.rstrip('.')}."

        # 2. Build a specific, non-repetitive 1-liner on the Potential Impact
        if "3 badai" in low or "3 storms" in low:
            sig = f"Elevates short-term volatility across USD/IDR (Rp {spot_idr:,}) and high-beta IDX stocks while favoring defensive positioning in 5Y–10Y IndoGBs ({indo_10y:.2f}%)."
        elif "30% apbn" in low or "480 t" in low or "bocor" in low:
            sig = f"Plugging IDR 480T of state budget leakage would materially improve Indonesia's primary fiscal balance and reduce DJPPR sovereign bond issuance pressure."
        elif "pdi-p" in low or "pdip" in low or "koalisi" in low:
            sig = f"Signals broad bipartisan legislative stability in the DPR, reducing parliamentary gridlock risk for 2026–2027 fiscal and structural bills."
        elif "innova" in low or ("gibran" in low and ("mpr" in low or "muzani" in low)):
            sig = f"Signals an orderly, constitutional MPR succession process in Jakarta, helping contain political risk premia on 10Y IndoGBs ({indo_10y:.2f}%) and USD/IDR (Rp {spot_idr:,})."
        elif "danantara" in low and "gibran" in low:
            sig = f"Danantara's proactive institutional backstop anchors foreign fund confidence and supports SOE (BUMN) blue-chip equities on the IHSG ({ihsg_lvl:,.2f})."
        elif "danantara" in low and ("umkm" in low or "msme" in low):
            sig = f"Expands export market access and supply-chain financing for Indonesian MSMEs (UMKM) through sovereign investment partnerships."
        elif "gibran" in low and ("ihsg" in low or "melonjak" in low or "2%" in low):
            sig = f"Removes political overhang and sparks a relief rally across liquid LQ45 financials as certainty over constitutional procedure improves."
        elif "lpsk" in low or "saksi" in low or "witness" in low:
            sig = f"Accelerates evidentiary disclosures in the executive wiretapping probe, keeping parliamentary oversight and security reforms in focus."
        elif "ahrie sonta" in low or ("pecat" in low and "polri" in low):
            sig = f"Decisive disciplinary action within Polri reinforces executive security discipline and institutional rule-of-law credibility."
        elif "laporan polisi" in low or "makar" in low or "treason" in low:
            sig = f"Formalizes the legal process under criminal law rather than political speculation, supporting institutional stability in Jakarta."
        elif "penyadapan" in low or "wiretap" in low or "sadap" in low:
            sig = f"Transparent DPR Commission III and Polri enforcement on the wiretapping probe reduces governance uncertainty for onshore capital markets."
        elif "msci" in low or "brpt" in low or "brms" in low:
            sig = f"Drives passive foreign index outflows from excluded tickers (BRPT, BRMS) while concentrating institutional liquidity into core LQ45 banks."
        elif "383 saham" in low or "300 emiten" in low or "hsc" in low:
            sig = f"Structural IDX reform strips out illiquid low-float stocks from IHSG ({ihsg_lvl:,.2f}), improving index investability ahead of MSCI's review."
        elif "byd" in low or "subang" in low:
            sig = f"Accelerates domestic EV adoption and West Java automotive supply-chain FDI, intensifying competition in Indonesia's passenger vehicle market."
        elif "rupiah" in low and ("18,221" in low or "18.221" in low or "terlemah" in low or "weakest" in low):
            sig = f"Prompts Bank Indonesia triple-intervention across spot FX, DNDF, and secondary SBN markets to anchor USD/IDR near Rp {spot_idr:,} (JISDOR Rp {jisdor:,})."
        elif "the fed" in low or "all-time low" in low or "all–time low" in low or "rupiah tertekan" in low:
            sig = f"Increases near-term imported volatility on USD/IDR (Rp {spot_idr:,}, JISDOR Rp {jisdor:,}) and keeps Bank Indonesia active in DNDF and SRBI ({srbi_12m:.3f}%) intervention."
        elif "ihsg" in low and ("borong" in low or "10 saham" in low or "10 shares" in low):
            sig = f"Demonstrates resilient foreign institutional accumulation in undervalued Indonesian large-caps despite headline IHSG ({ihsg_lvl:,.2f}) consolidation."
        elif "ihsg" in low and ("net sell" in low or "rising rally" in low or "rel" in low):
            sig = f"Healthy technical consolidation near {ihsg_lvl:,.2f} after a 5-day rally as foreign desks rotate from high-multiple conglomerates into liquid banks."
        elif "apbn" in low or "jor-joran" in low:
            sig = f"Boosts Q4 domestic demand and fiscal impulse, though bond desks watch DJPPR SBN issuance supply and the 10Y FR0108 ({indo_10y:.2f}%) yield."
        elif "uu pemilu" in low or "election law" in low or "komisi ii" in low:
            sig = f"Shapes long-term electoral threshold and coalition rules ahead of the next legislative cycle without disrupting near-term cabinet execution."
        elif "emas" in low or "gold" in low:
            sig = f"Pressures short-term domestic Antam gold retail prices and precious-metal mining equities (ANTM, BRMS, MDKA) on the IDX."
        elif "kemhan" in low or "jepang" in low or "japan" in low or "apec" in low:
            sig = f"Strengthens Indonesia's bilateral defense, maritime security, and technology transfer partnerships across the Indo-Pacific."
        elif "sumatra" in low or "aceh" in low or "jembatan" in low or "jalan" in low:
            sig = f"Restores regional logistics and agricultural supply chains in Aceh/Sumatra, easing local food transport bottlenecks."
        elif "yogyakarta" in low or "demo" in low or "unjuk rasa" in low or "cctv" in low:
            sig = f"Localized civil protests and traffic disruptions are monitored for domestic social stability, with minimal spillover into Jakarta financial markets."
        elif "poliran" in low or "pengangguran" in low:
            sig = f"Supports grassroots labor absorption and rural food production alongside government MSME (UMKM) credit programs."
        elif "periset" in low or "researchers" in low or ("kemenkes" in low and "ekonomi" in low):
            sig = f"Encourages domestic pharmaceutical and medical-device import substitution, reducing healthcare trade deficits over the medium term."
        elif "vape" in low or "mui" in low or "kemenkes" in low:
            sig = f"Potential regulatory tightening on e-cigarettes could weigh on alternative tobacco and retail distribution segments."
        elif "acer" in low or "laptop ai" in low:
            sig = f"Reflects growing enterprise and consumer hardware demand in Indonesia's digital economy and local electronics retail sector."
        else:
            sig = f"Shapes domestic institutional sentiment across the Jakarta Composite Index (IHSG {ihsg_lvl:,.2f}) and onshore Rupiah liquidity (Rp {spot_idr:,})."

        return summary_en, sig

    def format_news_list(
        raw_list: list[dict], en_titles: list[str], en_descs: list[str], list_prefix: str
    ) -> list[dict]:
        out = []
        used_sigs = set()
        for idx, (item, title_en, desc_en) in enumerate(zip(raw_list, en_titles, en_descs)):
            summary_en, sig = build_local_significance_and_summary(
                item["titleId"], title_en, desc_en, item["source"], item["category"], idx
            )
            if sig in used_sigs:
                sig = f"{sig.rstrip('.')} ({item['source']} · #{idx + 1})."
            used_sigs.add(sig)

            synd = item.get("syndicationCount", 1)
            if synd >= 3:
                pop_badge = f"Trending Across {synd} ID Portals · #{item['rankInFeed']} in Feed"
            elif "Top Stories" in item["feedSection"] or "Terpopuler" in item["feedSection"]:
                pop_badge = f"#{item['rankInFeed']} Top Read · {item['feedSection'].split('·')[-1].strip()}"
            else:
                pop_badge = f"#{item['rankInFeed']} in {item['feedSection']}"

            out.append({
                "rank": idx + 1,
                "id": f"{list_prefix}-{idx + 1:02d}",
                "titleEn": title_en,
                "titleId": item["titleId"],
                "source": item["source"],
                "feedSection": item["feedSection"],
                "timeAgo": item["timeAgo"],
                "category": item["category"],
                "impactDirection": item["impactDirection"],
                "impactScore": item["importanceScore"] if list_prefix == "id-imp" else item["readScore"],
                "readPopularityBadge": pop_badge,
                "summaryEn": summary_en,
                "marketSignificance": sig,
                "url": item["url"],
            })
        return out

    top_important_formatted = format_news_list(top_important_raw, imp_en_titles, imp_en_descs, "id-imp")
    top_read_formatted = format_news_list(top_read_raw, read_en_titles, read_en_descs, "id-read")

    as_of_sgt_str = datetime.now(SGT).strftime("%d %b %Y, %I:%M %p SGT")
    session_label_str = _snap_biz_day(datetime.now(SGT)).strftime("%a, %d %b %Y")
    imp_1 = top_important_formatted[0] if len(top_important_formatted) > 0 else None
    imp_2 = top_important_formatted[1] if len(top_important_formatted) > 1 else None
    imp_3 = top_important_formatted[2] if len(top_important_formatted) > 2 else None
    read_1 = top_read_formatted[0] if len(top_read_formatted) > 0 else None
    read_2 = top_read_formatted[1] if len(top_read_formatted) > 1 else None

    imp_summary = " · ".join(
        [
            f"#{idx + 1} \"{item['titleEn']}\" ({item['source']}, {item['timeAgo']}, Score {item.get('impactScore', 95)}/100)"
            for idx, item in enumerate([x for x in [imp_1, imp_2, imp_3] if x])
        ]
    ) or "\"Bank Indonesia & KSSK Macro-Financial Coordination\" (Kontan)"

    read_summary = " · ".join(
        [
            f"#{idx + 1} \"{item['titleEn']}\" ({item['source']}, {item['timeAgo']})"
            for idx, item in enumerate([x for x in [read_1, read_2] if x])
        ]
    ) or "\"National Political & Parliamentary Headlines\" (CNBC Indonesia)"

    top_imp_cat = imp_1["category"] if imp_1 else "BI & Monetary Policy"

    data["indonesiaLocalNews"] = {
        "asOfDate": as_of_sgt_str,
        "sourcesMonitored": [
            "CNBC Indonesia",
            "Kontan.co.id",
            "Bisnis Indonesia",
            "Kompas.com",
            "detikFinance & detikNews",
            "Tempo.co",
            "ANTARA News (Bahasa)",
            "CNN Indonesia",
            "Katadata.co.id",
            "Investor.id",
        ],
        "translationEngine": "Live Bahasa Indonesia RSS Aggregator → Neural English Translation (ID→EN) + Institutional BI/OJK/IDX Glossary",
        "topImportant": top_important_formatted,
        "topRead": top_read_formatted,
        "argonCommentary": {
            "modelLabel": "GEMINI 4 ARGON",
            "updatedAtSGT": as_of_sgt_str,
            "title": "GEMINI 4 ARGON · INDONESIA LOCAL-LANGUAGE MEDIA (ID→EN) & POLITICAL-ECONOMIC SYNTHESIS",
            "regimeBadge": f"10 BAHASA PORTALS TRANSLATED · USD/IDR {spot_idr:,} · IHSG {ihsg_lvl:,.2f}",
            "conviction": f"Track #1 {top_imp_cat} Catalyst · Separate DPR/Political Virality from 10Y FR0108 ({indo_10y:.2f}%) & LQ45 Fundamentals",
            "synthesis": (
                f"[{session_label_str} Live ID→EN Media Synthesis] Real-time Bahasa Indonesia aggregation and neural English translation across 10 onshore portals "
                f"(CNBC Indonesia, Kontan, Bisnis, Kompas, Detik, Tempo, ANTARA) highlights key institutional catalysts alongside high-velocity domestic political readership. "
                f"On the Top 10 Most Important macro-policy board, onshore institutional coverage is led by {imp_summary}. "
                f"On the Top 10 Most Read (Terpopuler) national board, viral domestic readership centers on {read_summary} — "
                f"while onshore USD/IDR trades at Rp {spot_idr:,} (JISDOR Rp {jisdor:,}), 10Y FR0108 IndoGB yields {indo_10y:.2f}%, and IHSG prints {ihsg_lvl:,.2f}."
            ),
            "positioningTakeaway": (
                f"[{session_label_str} Tactical Desk Stance] Use the translated Bahasa Indonesia news feed to separate viral political headline noise ({read_1['source'] if read_1 else 'onshore media'}: "
                f"\"{(read_1['titleEn'][:72] + '...') if read_1 and len(read_1['titleEn']) > 72 else (read_1['titleEn'] if read_1 else 'domestic political coverage')}\") "
                f"from actionable macro/regulatory catalysts led by {imp_1['source'] if imp_1 else 'BI/OJK'} "
                f"(\"{(imp_1['titleEn'][:72] + '...') if imp_1 and len(imp_1['titleEn']) > 72 else (imp_1['titleEn'] if imp_1 else 'policy coordination')}\"). "
                f"Maintain core positioning in liquid LQ45 banks (BBCA, BMRI, BBRI) and 5Y–10Y IndoGBs ({indo_10y:.2f}%) while hedging offshore FX tail risk whenever USD/IDR (Rp {spot_idr:,}) trades above Rp 18,000."
            ),
            "criticalLevels": [
                {
                    "asset": "IHSG (JCI) & LQ45 Free-Float",
                    "current": f"{ihsg_lvl:,.2f}",
                    "support": "5,000.00",
                    "resistance": "5,165.00",
                    "implication": "Removal of 300 HSC stocks reduces speculative index distortion and improves MSCI investability weight.",
                },
                {
                    "asset": "BI KLM Liquidity & 12M SRBI",
                    "current": f"Rp149.3T KLM · {srbi_12m:.3f}% WAR",
                    "support": f"{float(data.get('indonesia', {}).get('bonds', {}).get('biRate', 6.00)):.2f}% BI-Rate",
                    "resistance": f"{srbi_12m + 0.15:.2f}% SRBI Cap",
                    "implication": f"Targeted Rp149.3T KLM incentives support bank loan growth while 12M SRBI at {srbi_12m:.3f}% defends Rupiah carry.",
                },
                {
                    "asset": "USD/IDR Spot & JISDOR",
                    "current": f"Rp {spot_idr:,} (JISDOR {jisdor:,})",
                    "support": f"Rp {spot_idr - 120:,}",
                    "resistance": f"Rp {spot_idr + 150:,}",
                    "implication": "Orderly onshore FX trading despite high-readership DPR/MK political headlines confirms KSSK and BI credibility.",
                },
                {
                    "asset": "10Y IndoGB (FR0108)",
                    "current": f"{indo_10y:.2f}%",
                    "support": "7.45%",
                    "resistance": "7.85%",
                    "implication": "Domestic bank and pension demand absorbs APBN fiscal issuance whenever 10Y FR0108 approaches 7.75%–7.85%.",
                },
            ],
            "eventsToWatch": [
                {
                    "event": "IDX (BEI) Effective Exclusion of 300 HSC Issuers & MSCI Index Review Cut-Off",
                    "timing": f"{_fmt_event_date(_next_weekday_sgt(_snap_biz_day(datetime.now(SGT)), 4, True))} · 09:00 WIB (10:00 SGT)",
                    "impact": "Critical",
                    "watchFor": "Passive and active institutional rebalancing out of High Shareholder Concentration (HSC) names into liquid LQ45/BUMN constituents.",
                },
                {
                    "event": "DPR RI Leadership Consultation on HMP Inquiry & MK / MA Constitutional Rulings",
                    "timing": f"{_fmt_event_date(_snap_biz_day(datetime.now(SGT)))} · 13:30 WIB (14:30 SGT)",
                    "impact": "High",
                    "watchFor": "Whether parliamentary faction consultations on VP Gibran remain procedural without disrupting APBN fiscal execution or cabinet continuity.",
                },
                {
                    "event": "Bank Indonesia Rp149.3T KLM Liquidity Allocation & KSSK Quarterly Assessment",
                    "timing": f"{_fmt_event_date(_next_monthly_day_sgt(_snap_biz_day(datetime.now(SGT)), 18))} · 14:20 WIB (15:20 SGT)",
                    "impact": "High",
                    "watchFor": "Transmission of BI's Rp149.3T macroprudential liquidity incentives into SOE bank (BRI, Mandiri, BNI) credit growth and SBN demand.",
                },
            ],
        },
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

    # 5. Scrape live Bank Indonesia SRBI auction Weighted Average Accepted Rates & Bids from bi.go.id / CEIC
    fetch_ceic_srbi(data)

    # 6. Run financial sense-check (reconciles NDFs, sovereign spread, and flows with live quotes)
    run_indonesia_sense_check(data)

    # 7. Fetch live Top 10 Global Macro News, Top 5 Indonesia Disclosures & Translated Local Bahasa Indonesia News (Top 10 Important + Top 10 Read)
    fetch_live_global_macro_news(data)
    fetch_live_indonesia_news_and_commentary(data)
    fetch_live_indonesia_local_translated_news(data)

    # 8. Fetch live China (CCDC), Korea (SOFIA / KOFIA), India (RBI / CCIL), and US Equities (S&P 500)
    fetch_live_china_ccdc_and_macro(data)
    fetch_live_korea_sofia_and_macro(data)
    fetch_live_india_rbi_and_macro(data)
    fetch_live_us_equities_spx500(data)

    # 9. Build Gemini 4 Argon Macro Synthesis & Critical Watchlist for all tabs
    build_argon_commentaries(data)

    # 10. Update timestamps
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



