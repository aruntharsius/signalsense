"""
indicators.py — Technical indicator calculations via pandas_ta.
"""

import pandas as pd
import numpy as np
import pandas_ta as ta
from typing import Dict, Any


def compute_indicators(df: pd.DataFrame, selected: list[str]) -> pd.DataFrame:
    """
    Attach selected technical indicators to the OHLCV DataFrame.
    `selected` is a list of indicator names matching the INDICATOR_DEFS keys.
    """
    df = df.copy()

    # Ensure column names are plain strings
    df.columns = [str(c) for c in df.columns]

    if "SMA_20" in selected:
        df["SMA_20"] = ta.sma(df["Close"], length=20)
    if "SMA_50" in selected:
        df["SMA_50"] = ta.sma(df["Close"], length=50)
    if "EMA_20" in selected:
        df["EMA_20"] = ta.ema(df["Close"], length=20)
    if "EMA_50" in selected:
        df["EMA_50"] = ta.ema(df["Close"], length=50)

    if "RSI" in selected:
        df["RSI"] = ta.rsi(df["Close"], length=14)

    if "MACD" in selected:
        macd = ta.macd(df["Close"], fast=12, slow=26, signal=9)
        if macd is not None and not macd.empty:
            df["MACD"] = macd.iloc[:, 0]
            df["MACD_Signal"] = macd.iloc[:, 1]
            df["MACD_Hist"] = macd.iloc[:, 2]

    if "BB" in selected:
        bb = ta.bbands(df["Close"], length=20, std=2)
        if bb is not None and not bb.empty:
            df["BB_Upper"] = bb.iloc[:, 0]
            df["BB_Mid"] = bb.iloc[:, 1]
            df["BB_Lower"] = bb.iloc[:, 2]

    if "ATR" in selected:
        df["ATR"] = ta.atr(df["High"], df["Low"], df["Close"], length=14)

    if "OBV" in selected:
        df["OBV"] = ta.obv(df["Close"], df["Volume"])

    if "STOCH" in selected:
        stoch = ta.stoch(df["High"], df["Low"], df["Close"])
        if stoch is not None and not stoch.empty:
            df["STOCH_K"] = stoch.iloc[:, 0]
            df["STOCH_D"] = stoch.iloc[:, 1]

    return df


def build_indicator_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Extract latest indicator values for use in AI prompt / summary card.
    Returns a flat dict of label → value.
    """
    row = df.iloc[-1]
    summary: Dict[str, Any] = {}

    def safe(col):
        val = row.get(col, np.nan)
        return None if pd.isna(val) else float(val)

    summary["close"] = safe("Close")
    summary["volume"] = safe("Volume")

    for col in ["SMA_20", "SMA_50", "EMA_20", "EMA_50", "RSI",
                "MACD", "MACD_Signal", "MACD_Hist",
                "BB_Upper", "BB_Mid", "BB_Lower",
                "ATR", "OBV", "STOCH_K", "STOCH_D"]:
        summary[col] = safe(col)

    # Volume trend: compare last 5 days vs prior 5 days
    if len(df) >= 10:
        recent_vol = df["Volume"].iloc[-5:].mean()
        prior_vol = df["Volume"].iloc[-10:-5].mean()
        summary["volume_trend"] = "increasing" if recent_vol > prior_vol else "decreasing"
    else:
        summary["volume_trend"] = "unknown"

    # Price trend: simple 5-day slope direction
    if len(df) >= 5:
        closes = df["Close"].iloc[-5:].values
        slope = np.polyfit(range(len(closes)), closes, 1)[0]
        summary["price_trend_5d"] = "up" if slope > 0 else "down"
    else:
        summary["price_trend_5d"] = "unknown"

    return summary


INDICATOR_OPTIONS = {
    "SMA_20": "SMA 20",
    "SMA_50": "SMA 50",
    "EMA_20": "EMA 20",
    "EMA_50": "EMA 50",
    "RSI": "RSI (14)",
    "MACD": "MACD",
    "BB": "Bollinger Bands",
    "ATR": "ATR (14)",
    "OBV": "OBV",
    "STOCH": "Stochastic",
}

DEFAULT_INDICATORS = ["SMA_20", "EMA_20", "RSI", "MACD", "BB"]
