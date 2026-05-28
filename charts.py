"""
charts.py — Plotly chart builders optimised for touch/mobile.
Supports dark (default) and light themes via the `light` parameter.
"""

import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
from typing import List


# ── Shared trace colours (same in both themes) ───────────────────────────────
_TRACE = {
    "up":       "#26a69a",
    "down":     "#ef5350",
    "sma20":    "#f39c12",
    "sma50":    "#8e44ad",
    "ema20":    "#2980b9",
    "ema50":    "#1abc9c",
    "bb_fill_d":"rgba(100,149,237,0.10)",
    "bb_fill_l":"rgba(100,149,237,0.13)",
    "bb_line":  "rgba(100,149,237,0.60)",
    "macd":     "#2196F3",
    "signal":   "#FF9800",
    "hist_pos": "#26a69a",
    "hist_neg": "#ef5350",
    "rsi":      "#9c27b0",
}


def _theme(light: bool) -> dict:
    """Return palette dict for the requested theme."""
    if light:
        return dict(
            bg="#f8fafc",
            grid="rgba(0,0,0,0.07)",
            text="#1e293b",
            zero_line="rgba(0,0,0,0.20)",
            midline="rgba(0,0,0,0.18)",
            modebar_active="#1e293b",
        )
    return dict(
        bg="#0e1117",
        grid="rgba(255,255,255,0.06)",
        text="#e0e0e0",
        zero_line="rgba(255,255,255,0.25)",
        midline="rgba(255,255,255,0.30)",
        modebar_active="#ffffff",
    )


def _layout_base(t: dict, height: int, title_text: str = "") -> dict:
    """Build the update_layout kwargs from a theme dict."""
    # When a title is present, push the top margin up so the legend
    # (anchored top-right) and the title (top-left) never overlap.
    top_margin = 54 if title_text else 36
    base = dict(
        paper_bgcolor=t["bg"],
        plot_bgcolor=t["bg"],
        font=dict(color=t["text"], family="Space Grotesk, Inter, system-ui, sans-serif", size=12),
        margin=dict(l=8, r=8, t=top_margin, b=8),
        height=height,
        xaxis=dict(
            showgrid=True,
            gridcolor=t["grid"],
            rangeslider=dict(visible=False),
            showspikes=True,
            spikemode="across",
            spikecolor=t["text"],
            spikethickness=1,
            color=t["text"],
        ),
        legend=dict(orientation="h", yanchor="bottom", y=1.01, xanchor="right", x=1,
                    font=dict(color=t["text"])),
        dragmode="pan",
        hovermode="x unified",
        modebar=dict(
            orientation="v",
            bgcolor="rgba(0,0,0,0)",
            color=t["text"],
            activecolor=t["modebar_active"],
        ),
        newshape=dict(line_color=t["text"]),
    )
    if title_text:
        base["title"] = dict(text=title_text, x=0.0,
                             font=dict(size=15, color=t["text"]))
    return base


def _apply_yaxes(fig: go.Figure, t: dict, **extra) -> None:
    fig.update_yaxes(
        showgrid=True,
        gridcolor=t["grid"],
        showspikes=True,
        spikemode="across",
        spikecolor=t["text"],
        spikethickness=1,
        color=t["text"],
        **extra,
    )


# ─────────────────────────────────────────────────────────────────────────────

def build_candlestick_chart(
    df: pd.DataFrame,
    selected_indicators: List[str],
    ticker: str,
    light: bool = False,
) -> go.Figure:
    """Main price chart with optional overlay indicators."""
    t = _theme(light)
    has_volume = "Volume" in df.columns
    row_heights = [0.72, 0.28] if has_volume else [1.0]
    rows = 2 if has_volume else 1

    fig = make_subplots(
        rows=rows, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.02,
        row_heights=row_heights,
    )

    fig.add_trace(
        go.Candlestick(
            x=df.index,
            open=df["Open"], high=df["High"], low=df["Low"], close=df["Close"],
            name="Price",
            increasing=dict(line=dict(color=_TRACE["up"]),   fillcolor=_TRACE["up"]),
            decreasing=dict(line=dict(color=_TRACE["down"]), fillcolor=_TRACE["down"]),
            whiskerwidth=0.8,
        ),
        row=1, col=1,
    )

    overlay_map = {
        "SMA_20": ("SMA 20", _TRACE["sma20"], "dot"),
        "SMA_50": ("SMA 50", _TRACE["sma50"], "dot"),
        "EMA_20": ("EMA 20", _TRACE["ema20"], "solid"),
        "EMA_50": ("EMA 50", _TRACE["ema50"], "solid"),
    }
    for key, (name, color, dash) in overlay_map.items():
        if key in selected_indicators and key in df.columns:
            fig.add_trace(
                go.Scatter(x=df.index, y=df[key], name=name,
                           line=dict(color=color, width=1.5, dash=dash), mode="lines"),
                row=1, col=1,
            )

    if "BB" in selected_indicators and "BB_Upper" in df.columns:
        bb_fill = _TRACE["bb_fill_l"] if light else _TRACE["bb_fill_d"]
        fig.add_trace(
            go.Scatter(x=df.index, y=df["BB_Upper"], name="BB Upper",
                       line=dict(color=_TRACE["bb_line"], width=1), mode="lines"),
            row=1, col=1,
        )
        fig.add_trace(
            go.Scatter(x=df.index, y=df["BB_Lower"], name="BB Lower",
                       fill="tonexty", fillcolor=bb_fill,
                       line=dict(color=_TRACE["bb_line"], width=1), mode="lines"),
            row=1, col=1,
        )

    if has_volume and rows == 2:
        colors = [
            _TRACE["up"] if c >= o else _TRACE["down"]
            for c, o in zip(df["Close"], df["Open"])
        ]
        fig.add_trace(
            go.Bar(x=df.index, y=df["Volume"], name="Volume",
                   marker_color=colors, opacity=0.7),
            row=2, col=1,
        )
        fig.update_yaxes(title_text="Volume", title_font=dict(color=t["text"]), row=2, col=1)

    fig.update_layout(
        **_layout_base(t, 480),
        title=dict(text=f"<b>{ticker}</b> — Price Chart", x=0.0,
                   font=dict(size=16, color=t["text"])),
    )
    _apply_yaxes(fig, t)
    fig.update_yaxes(title_text="Price (USD)", title_font=dict(color=t["text"]), row=1, col=1)
    return fig


def build_rsi_chart(df: pd.DataFrame, light: bool = False) -> go.Figure:
    """RSI line chart with overbought/oversold zones."""
    t = _theme(light)
    fig = go.Figure()

    rsi = df.get("RSI", pd.Series(dtype=float))

    fig.add_hrect(y0=70, y1=100, fillcolor="rgba(239,83,80,0.10)",  line_width=0)
    fig.add_hrect(y0=0,  y1=30,  fillcolor="rgba(38,166,154,0.10)", line_width=0)
    fig.add_hline(y=70, line=dict(color=_TRACE["down"],  dash="dash", width=1))
    fig.add_hline(y=30, line=dict(color=_TRACE["up"],    dash="dash", width=1))
    fig.add_hline(y=50, line=dict(color=t["midline"],    dash="dot",  width=1))

    fig.add_trace(
        go.Scatter(
            x=df.index, y=rsi, name="RSI (14)",
            line=dict(color=_TRACE["rsi"], width=2), mode="lines",
            fill="tozeroy", fillcolor="rgba(156,39,176,0.08)",
        )
    )

    fig.update_layout(**_layout_base(t, 230, "<b>RSI (14)</b>"))
    _apply_yaxes(fig, t, range=[0, 100])
    return fig


def build_macd_chart(df: pd.DataFrame, light: bool = False) -> go.Figure:
    """MACD with signal line and histogram."""
    t = _theme(light)
    fig = go.Figure()

    if "MACD" not in df.columns:
        return fig

    hist   = df["MACD_Hist"]
    colors = [_TRACE["hist_pos"] if v >= 0 else _TRACE["hist_neg"] for v in hist]

    fig.add_trace(go.Bar(x=df.index, y=hist, name="Histogram",
                         marker_color=colors, opacity=0.8))
    fig.add_trace(go.Scatter(x=df.index, y=df["MACD"], name="MACD",
                             line=dict(color=_TRACE["macd"], width=2), mode="lines"))
    fig.add_trace(go.Scatter(x=df.index, y=df["MACD_Signal"], name="Signal",
                             line=dict(color=_TRACE["signal"], width=2), mode="lines"))
    fig.add_hline(y=0, line=dict(color=t["zero_line"], width=1))

    fig.update_layout(**_layout_base(t, 230, "<b>MACD (12, 26, 9)</b>"))
    _apply_yaxes(fig, t)
    return fig


def build_stoch_chart(df: pd.DataFrame, light: bool = False) -> go.Figure:
    """Stochastic oscillator chart."""
    t = _theme(light)
    fig = go.Figure()
    if "STOCH_K" not in df.columns:
        return fig

    fig.add_hrect(y0=80, y1=100, fillcolor="rgba(239,83,80,0.10)",  line_width=0)
    fig.add_hrect(y0=0,  y1=20,  fillcolor="rgba(38,166,154,0.10)", line_width=0)
    fig.add_hline(y=80, line=dict(color=_TRACE["down"], dash="dash", width=1))
    fig.add_hline(y=20, line=dict(color=_TRACE["up"],   dash="dash", width=1))

    fig.add_trace(go.Scatter(x=df.index, y=df["STOCH_K"], name="%K",
                             line=dict(color="#00bcd4", width=2), mode="lines"))
    fig.add_trace(go.Scatter(x=df.index, y=df["STOCH_D"], name="%D",
                             line=dict(color="#ff9800", width=1.5, dash="dot"), mode="lines"))

    fig.update_layout(**_layout_base(t, 220, "<b>Stochastic</b>"))
    _apply_yaxes(fig, t, range=[0, 100])
    return fig