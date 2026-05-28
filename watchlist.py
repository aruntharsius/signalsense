"""
watchlist.py — Per-user watchlist persistence and row data fetching.
"""

import json
import os
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

WATCHLIST_FILE = os.path.join(os.path.dirname(__file__), "watchlist.json")


def _load_all() -> dict:
    if not os.path.exists(WATCHLIST_FILE):
        return {}
    try:
        with open(WATCHLIST_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_all(data: dict) -> None:
    with open(WATCHLIST_FILE, "w") as f:
        json.dump(data, f, indent=2)


def load_watchlist(username: str) -> List[str]:
    return _load_all().get(username, [])


def save_watchlist(username: str, tickers: List[str]) -> None:
    data = _load_all()
    data[username] = tickers
    _save_all(data)


def add_ticker(username: str, ticker: str) -> List[str]:
    tickers = load_watchlist(username)
    t = ticker.strip().upper()
    if t and t not in tickers:
        tickers.append(t)
        save_watchlist(username, tickers)
    return tickers


def remove_ticker(username: str, ticker: str) -> List[str]:
    tickers = load_watchlist(username)
    tickers = [t for t in tickers if t != ticker.strip().upper()]
    save_watchlist(username, tickers)
    return tickers


def get_watchlist_row_data(ticker: str) -> Dict[str, Any]:
    """Fetch price + indicator snapshot for one watchlist row. Reuses cached data_fetcher calls."""
    from data_fetcher import fetch_stock_data, get_current_price
    from indicators import compute_indicators, build_indicator_summary, DEFAULT_INDICATORS

    end = date.today().strftime("%Y-%m-%d")
    start = (date.today() - timedelta(days=120)).strftime("%Y-%m-%d")

    price, change, pct = get_current_price(ticker)
    df_raw = fetch_stock_data(ticker, start, end)

    row: Dict[str, Any] = {
        "ticker": ticker,
        "price": price,
        "change": change,
        "pct": pct,
        "rsi": None,
        "macd_cross": None,
        "sma_cross": None,
        "signal": "—",
        "error": False,
    }

    if df_raw is None or df_raw.empty:
        row["error"] = True
        return row

    df = compute_indicators(df_raw, DEFAULT_INDICATORS)
    ind = build_indicator_summary(df)

    row["rsi"] = ind.get("RSI")

    macd = ind.get("MACD")
    macd_sig = ind.get("MACD_Signal")
    if macd is not None and macd_sig is not None:
        row["macd_cross"] = "Bull" if macd > macd_sig else "Bear"

    sma20 = ind.get("SMA_20")
    sma50 = ind.get("SMA_50")
    if sma20 is not None and sma50 is not None:
        row["sma_cross"] = "Golden" if sma20 > sma50 else "Death"

    # Simple 3-signal majority vote
    bull = sum([
        row["rsi"] is not None and row["rsi"] < 45,
        row["macd_cross"] == "Bull",
        row["sma_cross"] == "Golden",
    ])
    bear = sum([
        row["rsi"] is not None and row["rsi"] > 60,
        row["macd_cross"] == "Bear",
        row["sma_cross"] == "Death",
    ])

    row["signal"] = "BUY" if bull >= 2 else "SELL" if bear >= 2 else "HOLD"
    return row
