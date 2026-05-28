"""
ai_analysis.py — Claude-powered trade signal generation.
"""

import anthropic
import json
from typing import Dict, Any, Optional


def build_analysis_prompt(ticker: str, summary: Dict[str, Any], info: dict) -> str:
    """Construct a structured prompt with all available market data."""

    company = info.get("longName", ticker)
    sector = info.get("sector", "N/A")
    market_cap = info.get("marketCap", None)
    cap_str = f"${market_cap / 1e9:.2f}B" if market_cap else "N/A"

    def fmt(val, decimals=2, suffix=""):
        if val is None:
            return "N/A"
        return f"{val:.{decimals}f}{suffix}"

    price = summary.get("close")
    rsi = summary.get("RSI")
    macd = summary.get("MACD")
    macd_sig = summary.get("MACD_Signal")
    bb_upper = summary.get("BB_Upper")
    bb_lower = summary.get("BB_Lower")
    sma20 = summary.get("SMA_20")
    sma50 = summary.get("SMA_50")
    ema20 = summary.get("EMA_20")
    vol_trend = summary.get("volume_trend", "unknown")
    price_trend = summary.get("price_trend_5d", "unknown")

    prompt = f"""You are a professional quantitative analyst. Analyse the following technical data for {company} ({ticker}) and provide a concise trading signal.

## Company Info
- Ticker: {ticker}
- Company: {company}
- Sector: {sector}
- Market Cap: {cap_str}

## Current Market Data
- Price: ${fmt(price)}
- 5-Day Price Trend: {price_trend}
- Volume Trend (5d vs prior 5d): {vol_trend}

## Technical Indicators (latest values)
- RSI (14): {fmt(rsi)} {"[OVERBOUGHT >70]" if rsi and rsi > 70 else "[OVERSOLD <30]" if rsi and rsi < 30 else ""}
- MACD: {fmt(macd)} | Signal: {fmt(macd_sig)} | Cross: {"BULLISH" if macd and macd_sig and macd > macd_sig else "BEARISH" if macd and macd_sig else "N/A"}
- SMA 20: {fmt(sma20)} | SMA 50: {fmt(sma50)} | Golden/Death Cross: {"GOLDEN" if sma20 and sma50 and sma20 > sma50 else "DEATH" if sma20 and sma50 else "N/A"}
- EMA 20: {fmt(ema20)}
- Bollinger Upper: {fmt(bb_upper)} | Lower: {fmt(bb_lower)} | Band Width: {fmt((bb_upper - bb_lower) / ((bb_upper + bb_lower) / 2) * 100 if bb_upper and bb_lower else None, 2, "%")}
- BB Position: {"Near Upper (potential resistance)" if price and bb_upper and price > bb_upper * 0.98 else "Near Lower (potential support)" if price and bb_lower and price < bb_lower * 1.02 else "Mid-band (neutral)"}

## Required Output
Respond ONLY with a valid JSON object (no markdown, no explanation outside JSON):
{{
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": <integer 0-100>,
  "bias": "Bullish" | "Bearish" | "Neutral",
  "summary": "<2-3 sentence plain-English analysis of the technicals>",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "risk_note": "<one sentence caution or risk to watch>",
  "support": <price level or null>,
  "resistance": <price level or null>
}}
"""
    return prompt


def run_ai_analysis(
    ticker: str,
    summary: Dict[str, Any],
    info: dict,
    api_key: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Call Claude and return parsed JSON analysis.
    Returns None on any error.
    """
    client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()

    prompt = build_analysis_prompt(ticker, summary, info)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except json.JSONDecodeError:
        # Best-effort: extract JSON object from response
        import re
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
        return None
    except Exception:
        return None
