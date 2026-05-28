"""
data_fetcher.py — Stock data retrieval with caching and error handling.
"""

import yfinance as yf
import pandas as pd
import streamlit as st
from datetime import datetime, timedelta
from typing import Optional, Tuple


@st.cache_data(ttl=300)  # Cache for 5 minutes
def fetch_stock_data(
    ticker: str,
    start_date: str,
    end_date: str,
    interval: str = "1d",
) -> Optional[pd.DataFrame]:
    """
    Fetch OHLCV data for a ticker from Yahoo Finance.
    Returns None on failure so callers can handle gracefully.
    """
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
        # Flatten MultiIndex columns if present (yfinance ≥ 0.2.x)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df.index = pd.to_datetime(df.index)
        df.sort_index(inplace=True)
        return df
    except Exception:
        return None


@st.cache_data(ttl=300)
def fetch_ticker_info(ticker: str) -> dict:
    """Return basic info dict from yfinance Ticker object."""
    try:
        t = yf.Ticker(ticker.strip().upper())
        info = t.info or {}
        return info
    except Exception:
        return {}


def get_current_price(ticker: str) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """
    Return (price, change_dollars, change_pct) for the most recent close.
    Uses a 5-day window so we always have at least two data points for delta.
    """
    end = datetime.today().strftime("%Y-%m-%d")
    start = (datetime.today() - timedelta(days=7)).strftime("%Y-%m-%d")
    df = fetch_stock_data(ticker, start, end, interval="1d")
    if df is None or len(df) < 2:
        return None, None, None
    price = float(df["Close"].iloc[-1])
    prev = float(df["Close"].iloc[-2])
    change = price - prev
    pct = (change / prev) * 100
    return price, change, pct


@st.cache_data(ttl=300)
def fetch_news(ticker: str) -> list:
    """Return list of news dicts from yfinance."""
    try:
        t = yf.Ticker(ticker.strip().upper())
        return t.news or []
    except Exception:
        return []


POPULAR_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
    "NVDA", "META", "NFLX", "AMD", "SPY",
]
