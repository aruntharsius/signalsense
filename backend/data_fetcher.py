"""
data_fetcher.py — Stock data retrieval with caching (no Streamlit dependency).
"""

import threading
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Tuple

from cachetools import TTLCache, cached

_stock_cache = TTLCache(maxsize=256, ttl=300)
_info_cache  = TTLCache(maxsize=256, ttl=300)
_news_cache  = TTLCache(maxsize=256, ttl=300)
_stock_lock  = threading.RLock()
_info_lock   = threading.RLock()
_news_lock   = threading.RLock()


@cached(cache=_stock_cache, lock=_stock_lock)
def fetch_stock_data(
    ticker: str,
    start_date: str,
    end_date: str,
    interval: str = "1d",
) -> Optional[pd.DataFrame]:
    try:
        t = ticker.strip().upper()
        df = yf.download(
            t,
            start=start_date,
            end=end_date,
            interval=interval,
            progress=False,
            auto_adjust=True,
        )
        if df is None or df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df.index = pd.to_datetime(df.index)
        df.sort_index(inplace=True)
        return df
    except Exception:
        return None


@cached(cache=_info_cache, lock=_info_lock)
def fetch_ticker_info(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker.strip().upper())
        return t.info or {}
    except Exception:
        return {}


def get_current_price(ticker: str) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    end = datetime.today().strftime("%Y-%m-%d")
    start = (datetime.today() - timedelta(days=7)).strftime("%Y-%m-%d")
    df = fetch_stock_data(ticker, start, end, interval="1d")
    if df is None or len(df) < 2:
        return None, None, None
    price = float(df["Close"].iloc[-1])
    prev  = float(df["Close"].iloc[-2])
    change = price - prev
    pct    = (change / prev) * 100
    return price, change, pct


@cached(cache=_news_cache, lock=_news_lock)
def fetch_news(ticker: str) -> list:
    try:
        t = yf.Ticker(ticker.strip().upper())
        return t.news or []
    except Exception:
        return []


POPULAR_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
    "NVDA", "META", "NFLX", "AMD", "SPY",
]
