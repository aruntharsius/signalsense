"""
backtest.py — Rule-based strategy backtester.
Mirrors the signal logic from the frontend DayTradeSetup strategies.
"""

import math
import pandas as pd
from typing import Any


# ── Signal functions (one per strategy) ──────────────────────────────────────

def _momentum_signal(row: pd.Series) -> int:
    bull, bear = 0, 0
    rsi      = row.get("RSI")
    macd     = row.get("MACD")
    macd_sig = row.get("MACD_Signal")
    sma20    = row.get("SMA_20")
    sma50    = row.get("SMA_50")
    ema20    = row.get("EMA_20")
    close    = row["Close"]

    if _ok(rsi):
        if rsi < 50: bull += 1
        else:        bear += 1
    if _ok(macd) and _ok(macd_sig):
        if macd > macd_sig: bull += 1
        else:               bear += 1
    if _ok(sma20) and _ok(sma50):
        if sma20 > sma50: bull += 1
        else:             bear += 1
    if _ok(ema20):
        if close > ema20: bull += 1
        else:             bear += 1

    return _vote(bull, bear)


def _mean_reversion_signal(row: pd.Series) -> int:
    bull, bear = 0, 0
    rsi      = row.get("RSI")
    close    = row["Close"]
    bb_lower = row.get("BB_Lower")
    bb_upper = row.get("BB_Upper")

    if _ok(rsi):
        if   rsi < 30: bull += 2
        elif rsi < 40: bull += 1
        elif rsi > 70: bear += 2
        elif rsi > 60: bear += 1

    if _ok(bb_lower) and _ok(bb_upper):
        if   close <= bb_lower * 1.005: bull += 1
        elif close >= bb_upper * 0.995: bear += 1

    return _vote(bull, bear)


def _trend_signal(row: pd.Series) -> int:
    bull, bear = 0, 0
    sma20    = row.get("SMA_20")
    sma50    = row.get("SMA_50")
    ema20    = row.get("EMA_20")
    ema50    = row.get("EMA_50")
    macd     = row.get("MACD")
    macd_sig = row.get("MACD_Signal")
    close    = row["Close"]

    if _ok(sma20) and _ok(sma50):
        if sma20 > sma50: bull += 2
        else:             bear += 2
    if _ok(ema20):
        if close > ema20: bull += 1
        else:             bear += 1
    if _ok(ema50):
        if close > ema50: bull += 1
        else:             bear += 1
    if _ok(macd) and _ok(macd_sig):
        if macd > macd_sig: bull += 1
        else:               bear += 1

    return _vote(bull, bear)


def _breakout_signal(row: pd.Series) -> int:
    bull, bear = 0, 0
    close    = row["Close"]
    bb_upper = row.get("BB_Upper")
    bb_lower = row.get("BB_Lower")
    bb_mid   = row.get("BB_Mid")
    macd     = row.get("MACD")
    macd_sig = row.get("MACD_Signal")
    rsi      = row.get("RSI")

    if _ok(bb_upper) and _ok(bb_lower) and _ok(bb_mid) and bb_mid > 0:
        bw_pct = (bb_upper - bb_lower) / bb_mid * 100
        if bw_pct < 4:  # squeeze required
            if   close > bb_upper: bull += 2
            elif close < bb_lower: bear += 2
            elif close > bb_mid:   bull += 1
            else:                  bear += 1

    if _ok(macd) and _ok(macd_sig):
        if macd > macd_sig: bull += 1
        else:               bear += 1
    if _ok(rsi):
        if 50 < rsi < 80:   bull += 1
        elif 20 < rsi < 50: bear += 1

    # Breakout needs at least 2 bull/bear signals to fire
    if bull >= 2 and bull > bear: return 1
    if bear >= 2 and bear > bull: return -1
    return 0


# ATR risk multipliers per strategy (matches frontend)
_STRATEGIES: dict[str, tuple] = {
    "momentum":       (_momentum_signal,       1.5),
    "mean_reversion": (_mean_reversion_signal,  1.0),
    "trend":          (_trend_signal,            1.2),
    "breakout":       (_breakout_signal,         1.0),
}


# ── Simulation ────────────────────────────────────────────────────────────────

MAX_HOLD   = 15   # days before force-exit at close
COOLDOWN   = 2    # bars to wait after closing before re-entering


def run_backtest(df: pd.DataFrame, strategy: str) -> dict[str, Any]:
    if strategy not in _STRATEGIES:
        raise ValueError(f"Unknown strategy '{strategy}'. Choose from: {list(_STRATEGIES)}")

    signal_fn, atr_mult = _STRATEGIES[strategy]

    # Reset index so we can iterate by integer position with a Date column
    rows = df.reset_index()
    if "Date" not in rows.columns:
        rows = rows.rename(columns={rows.columns[0]: "Date"})

    n         = len(rows)
    trades    = []
    in_trade  = False
    cooldown  = 0
    entry_price = stop = target = direction = entry_date = entry_idx = None

    for i in range(n - 1):
        row = rows.iloc[i]

        if cooldown > 0:
            cooldown -= 1
            continue

        if not in_trade:
            sig = signal_fn(row)
            atr = row.get("ATR")
            if sig != 0 and _ok(atr) and atr > 0:
                direction   = sig
                entry_price = float(rows.iloc[i + 1]["Open"])
                risk        = atr * atr_mult
                stop        = entry_price - risk if direction == 1 else entry_price + risk
                target      = entry_price + risk if direction == 1 else entry_price - risk
                entry_date  = str(rows.iloc[i + 1]["Date"])[:10]
                entry_idx   = i + 1
                in_trade    = True
        else:
            holding = i + 1 - entry_idx
            nxt     = rows.iloc[i + 1]
            high    = float(nxt["High"])
            low     = float(nxt["Low"])
            exit_price  = None
            exit_reason = None

            if direction == 1:
                if   low  <= stop:   exit_price, exit_reason = stop,   "STOP"
                elif high >= target: exit_price, exit_reason = target, "TARGET"
            else:
                if   high >= stop:   exit_price, exit_reason = stop,   "STOP"
                elif low  <= target: exit_price, exit_reason = target, "TARGET"

            if exit_price is None and holding >= MAX_HOLD:
                exit_price, exit_reason = float(nxt["Close"]), "TIMEOUT"

            if exit_price is not None:
                pnl_pct = (
                    (exit_price - entry_price) / entry_price * 100
                    if direction == 1
                    else (entry_price - exit_price) / entry_price * 100
                )
                trades.append({
                    "entry_date":   entry_date,
                    "exit_date":    str(nxt["Date"])[:10],
                    "direction":    "LONG" if direction == 1 else "SHORT",
                    "entry_price":  round(entry_price, 2),
                    "exit_price":   round(exit_price, 2),
                    "exit_reason":  exit_reason,
                    "pnl_pct":      round(pnl_pct, 2),
                    "holding_days": holding,
                })
                in_trade = False
                cooldown = COOLDOWN

    # ── Metrics ───────────────────────────────────────────────────────────────
    if not trades:
        return {"trades": [], "metrics": _empty_metrics(), "equity_curve": []}

    wins   = [t for t in trades if t["pnl_pct"] > 0]
    losses = [t for t in trades if t["pnl_pct"] <= 0]

    gross_win  = sum(t["pnl_pct"] for t in wins)
    gross_loss = abs(sum(t["pnl_pct"] for t in losses))

    # Equity curve (compound, starts at 100)
    start_date = str(rows.iloc[0]["Date"])[:10]
    equity_curve = [{"date": start_date, "value": 100.0}]
    equity = 100.0
    for t in trades:
        equity *= (1 + t["pnl_pct"] / 100)
        equity_curve.append({"date": t["exit_date"], "value": round(equity, 2)})

    # Max drawdown
    peak   = 100.0
    max_dd = 0.0
    for pt in equity_curve:
        v = pt["value"]
        if v > peak:
            peak = v
        dd = (v - peak) / peak * 100
        if dd < max_dd:
            max_dd = dd

    profit_factor = (
        round(gross_win / gross_loss, 2) if gross_loss > 0
        else (99.0 if gross_win > 0 else 0.0)
    )

    metrics = {
        "total_trades":     len(trades),
        "win_rate":         round(len(wins) / len(trades), 3),
        "avg_win_pct":      round(gross_win  / len(wins)   if wins   else 0, 2),
        "avg_loss_pct":     round(-gross_loss / len(losses) if losses else 0, 2),
        "profit_factor":    profit_factor,
        "total_return_pct": round(equity - 100.0, 2),
        "max_drawdown_pct": round(max_dd, 2),
    }
    return {"trades": trades, "metrics": metrics, "equity_curve": equity_curve}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ok(v) -> bool:
    return v is not None and not (isinstance(v, float) and (math.isnan(v) or math.isinf(v)))

def _vote(bull: int, bear: int) -> int:
    if bull > bear: return 1
    if bear > bull: return -1
    return 0

def _empty_metrics() -> dict:
    return {
        "total_trades": 0, "win_rate": 0, "avg_win_pct": 0,
        "avg_loss_pct": 0, "profit_factor": 0,
        "total_return_pct": 0, "max_drawdown_pct": 0,
    }
