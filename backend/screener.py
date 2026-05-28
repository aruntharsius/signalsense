"""
screener.py — Screens a curated stock universe against indicator conditions.
Uses ThreadPoolExecutor to fetch tickers in parallel.
"""

import math
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from typing import Any

from data_fetcher import fetch_stock_data
from indicators import compute_indicators

# ── Universe ──────────────────────────────────────────────────────────────────

UNIVERSE: list[str] = [
    # Mega-cap tech
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "INTC",
    "QCOM", "CRM", "ORCL", "ADBE", "NFLX", "PYPL", "UBER", "SHOP", "SNOW",
    # Finance
    "JPM", "BAC", "GS", "MS", "WFC", "V", "MA", "AXP",
    # Healthcare
    "JNJ", "PFE", "UNH", "ABBV", "MRK", "LLY", "AMGN",
    # Consumer
    "WMT", "TGT", "COST", "HD", "NKE", "MCD", "SBUX", "KO", "PEP", "AMZN",
    # Energy
    "XOM", "CVX", "COP", "SLB",
    # Industrial
    "BA", "CAT", "GE", "HON", "UPS", "FDX",
    # Broad ETFs
    "SPY", "QQQ", "IWM", "GLD", "TLT",
    # High-interest names
    "COIN", "PLTR", "SQ", "RBLX", "SNAP", "HOOD", "SOFI",
]

# Deduplicate while preserving order
_seen: set[str] = set()
UNIVERSE = [t for t in UNIVERSE if not (t in _seen or _seen.add(t))]  # type: ignore[func-returns-value]

_INDICATORS   = ["SMA_20", "SMA_50", "EMA_20", "RSI", "MACD", "BB", "ATR"]
_PERIOD_DAYS  = 90   # warm-up window; enough for SMA50 + all other indicators
_MAX_WORKERS  = 14


# ── Per-ticker fetch & compute ────────────────────────────────────────────────

def _screen_ticker(ticker: str) -> dict[str, Any] | None:
    try:
        end   = date.today().strftime("%Y-%m-%d")
        start = (date.today() - timedelta(days=_PERIOD_DAYS)).strftime("%Y-%m-%d")

        df_raw = fetch_stock_data(ticker, start, end)
        if df_raw is None or df_raw.empty:
            return None

        df  = compute_indicators(df_raw, _INDICATORS)
        if len(df) < 2:
            return None

        last = df.iloc[-1]
        prev = df.iloc[-2]

        def safe(col, src=last):
            v = src.get(col) if hasattr(src, "get") else getattr(src, col, None)
            try:
                f = float(v)
                return None if (math.isnan(f) or math.isinf(f)) else f
            except Exception:
                return None

        price      = safe("Close")
        prev_close = safe("Close", prev)
        pct        = round((price - prev_close) / prev_close * 100, 2) if price and prev_close else None
        rsi        = safe("RSI")
        macd       = safe("MACD")
        macd_sig   = safe("MACD_Signal")
        sma20      = safe("SMA_20")
        sma50      = safe("SMA_50")

        # Signal: majority vote of RSI, MACD, SMA (mirrors watchlist logic)
        bull, bear = 0, 0
        if rsi is not None:
            if rsi < 50: bull += 1
            else:        bear += 1
        if macd is not None and macd_sig is not None:
            if macd > macd_sig: bull += 1
            else:               bear += 1
        if sma20 is not None and sma50 is not None:
            if sma20 > sma50: bull += 1
            else:             bear += 1
        signal = "BUY" if bull > bear else "SELL" if bear > bull else "HOLD"

        return {
            "ticker":     ticker,
            "price":      round(price, 2) if price else None,
            "pct":        pct,
            "signal":     signal,
            "rsi":        round(rsi, 1) if rsi is not None else None,
            "macd_cross": ("Bull" if macd > macd_sig else "Bear") if macd is not None and macd_sig is not None else None,
            "sma_cross":  ("Golden" if sma20 > sma50 else "Death") if sma20 is not None and sma50 is not None else None,
        }
    except Exception:
        return None


# ── Filter logic ──────────────────────────────────────────────────────────────

def _matches(
    row:        dict[str, Any],
    signals:    list[str] | None,
    rsi:        list[str] | None,
    macd:       list[str] | None,
    sma_cross:  list[str] | None,
    day_change: list[str] | None,
) -> bool:
    if signals and row["signal"] not in signals:
        return False

    if rsi:
        r  = row.get("rsi")
        ok = False
        for b in rsi:
            if b == "oversold"   and r is not None and r < 30:          ok = True; break
            if b == "midlow"     and r is not None and r < 45:          ok = True; break
            if b == "neutral"    and r is not None and 45 <= r <= 55:   ok = True; break
            if b == "midhigh"    and r is not None and r > 55:          ok = True; break
            if b == "overbought" and r is not None and r > 70:          ok = True; break
        if not ok:
            return False

    if macd and row.get("macd_cross") not in macd:
        return False

    if sma_cross and row.get("sma_cross") not in sma_cross:
        return False

    if day_change:
        p  = row.get("pct")
        ok = False
        for b in day_change:
            if b == "positive"    and p is not None and p > 0:   ok = True; break
            if b == "negative"    and p is not None and p < 0:   ok = True; break
            if b == "strong_up"   and p is not None and p > 2:   ok = True; break
            if b == "strong_down" and p is not None and p < -2:  ok = True; break
        if not ok:
            return False

    return True


# ── Public entry point ────────────────────────────────────────────────────────

def run_screener(
    signals:    list[str] | None = None,
    rsi:        list[str] | None = None,
    macd:       list[str] | None = None,
    sma_cross:  list[str] | None = None,
    day_change: list[str] | None = None,
) -> dict[str, Any]:
    t0      = time.time()
    matched: list[dict[str, Any]] = []

    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as ex:
        futures = {ex.submit(_screen_ticker, t): t for t in UNIVERSE}
        for future in as_completed(futures):
            row = future.result()
            if row and _matches(row, signals, rsi, macd, sma_cross, day_change):
                matched.append(row)

    # Sort: BUY → SELL → HOLD, then RSI ascending (most oversold first)
    matched.sort(key=lambda r: (
        0 if r["signal"] == "BUY" else 1 if r["signal"] == "SELL" else 2,
        r["rsi"] if r["rsi"] is not None else 50,
    ))

    return {
        "results":       matched,
        "total_screened": len(UNIVERSE),
        "total_matched":  len(matched),
        "duration_ms":    round((time.time() - t0) * 1000),
    }
