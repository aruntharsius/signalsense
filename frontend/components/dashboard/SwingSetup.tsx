"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import type { IndicatorSummary } from "@/lib/types";

type SigKind   = "ok" | "no" | "neut";
type Direction = "LONG" | "SHORT" | "NEUTRAL";

interface Signal { kind: SigKind; desc: string; }
interface SwingResult {
  direction:  Direction;
  signals:    Signal[];
  bull:       number;
  bear:       number;
  stop:       number | null;
  t1:         number | null;
  t2:         number | null;
  stopRisk:   number | null;
  holdNote:   string;
  entryNote:  string;
}

// ── Strategy functions ────────────────────────────────────────────────────────

function trendPullbackStrategy(s: IndicatorSummary, price: number, atr: number): SwingResult {
  const sigs: Signal[] = [];
  let bull = 0, bear = 0;

  if (s.SMA_20 != null && s.SMA_50 != null) {
    if (s.SMA_20 > s.SMA_50) { bull += 2; sigs.push({ kind: "ok", desc: `Golden Cross — SMA20 (${s.SMA_20.toFixed(2)}) > SMA50 (${s.SMA_50.toFixed(2)}), uptrend confirmed` }); }
    else                     { bear += 2; sigs.push({ kind: "no", desc: `Death Cross — SMA20 (${s.SMA_20.toFixed(2)}) < SMA50 (${s.SMA_50.toFixed(2)}), downtrend confirmed` }); }
  } else {
    sigs.push({ kind: "neut", desc: "Enable SMA 20 & SMA 50 for trend detection" });
  }

  if (s.EMA_20 != null) {
    const distPct = Math.abs(price - s.EMA_20) / s.EMA_20 * 100;
    const nearEma = distPct < 3;
    if (price < s.EMA_20 * 1.03 && price > s.EMA_20 * 0.97) {
      bull += 2;
      sigs.push({ kind: "ok", desc: `Price within 3% of EMA20 ($${s.EMA_20.toFixed(2)}) — pullback entry zone` });
    } else if (price > s.EMA_20) {
      bull += 1;
      sigs.push({ kind: nearEma ? "ok" : "neut", desc: `Price above EMA20 ($${s.EMA_20.toFixed(2)}) — trend intact${nearEma ? ", approaching entry zone" : ", wait for pullback"}` });
    } else {
      bear += 1;
      sigs.push({ kind: "no", desc: `Price below EMA20 ($${s.EMA_20.toFixed(2)}) — downtrend in control` });
    }
  }

  if (s.SMA_50 != null) {
    if (price > s.SMA_50) { bull += 1; sigs.push({ kind: "ok", desc: `Price above SMA50 ($${s.SMA_50.toFixed(2)}) — uptrend support intact` }); }
    else                  { bear += 1; sigs.push({ kind: "no", desc: `Price below SMA50 ($${s.SMA_50.toFixed(2)}) — major support broken` }); }
  }

  if (s.MACD != null && s.MACD_Signal != null) {
    if (s.MACD > s.MACD_Signal) { bull += 1; sigs.push({ kind: "ok", desc: "MACD bullish — momentum supports the uptrend" }); }
    else                        { bear += 1; sigs.push({ kind: "no", desc: "MACD bearish — trend momentum weakening" }); }
  }

  if (s.RSI != null) {
    if (s.RSI >= 40 && s.RSI <= 60) { bull += 1; sigs.push({ kind: "ok", desc: `RSI ${s.RSI.toFixed(0)} cooling from extremes — healthy pullback RSI` }); }
    else if (s.RSI < 40)            { sigs.push({ kind: "neut", desc: `RSI ${s.RSI.toFixed(0)} oversold — caution, deeper pullback possible` }); }
    else                            { sigs.push({ kind: "neut", desc: `RSI ${s.RSI.toFixed(0)} elevated — wait for RSI to cool before entry` }); }
  }

  const dir      = bull > bear ? "LONG" : bear > bull ? "SHORT" : "NEUTRAL";
  const stopRisk = atr * 2.5;
  const stop     = dir === "LONG" ? price - stopRisk : dir === "SHORT" ? price + stopRisk : null;
  const t1       = dir === "LONG" ? price + atr * 4  : dir === "SHORT" ? price - atr * 4  : null;
  const t2       = dir === "LONG" ? price + atr * 8  : dir === "SHORT" ? price - atr * 8  : null;

  const entryNote = dir === "LONG"
    ? `Buy pullback to EMA20 area ($${s.EMA_20?.toFixed(2) ?? "—"}). Stop $${stop?.toFixed(2)} below SMA50. Hold 3–15 days targeting $${t2?.toFixed(2) ?? "—"}.`
    : dir === "SHORT"
    ? `Short rally to EMA20 area ($${s.EMA_20?.toFixed(2) ?? "—"}). Stop $${stop?.toFixed(2)} above SMA50. Hold 3–15 days targeting $${t2?.toFixed(2) ?? "—"}.`
    : "No clear trend direction — wait for Golden or Death Cross before entering.";

  return { direction: dir, signals: sigs, bull, bear, stop, t1, t2, stopRisk, holdNote: "3–15 day hold", entryNote };
}

function breakoutSwingStrategy(s: IndicatorSummary, price: number, atr: number): SwingResult {
  const sigs: Signal[] = [];
  let bull = 0, bear = 0;
  let bandWidth = 0;

  if (s.BB_Upper != null && s.BB_Lower != null && s.BB_Mid != null) {
    bandWidth = s.BB_Upper - s.BB_Lower;
    const bwPct = (bandWidth / s.BB_Mid) * 100;
    if (bwPct < 4)       sigs.push({ kind: "ok",   desc: `Tight consolidation — band width ${bwPct.toFixed(1)}%. Potential breakout building` });
    else if (bwPct < 7)  sigs.push({ kind: "ok",   desc: `Moderate compression (${bwPct.toFixed(1)}%) — watch for directional close` });
    else                 sigs.push({ kind: "neut",  desc: `Wide bands (${bwPct.toFixed(1)}%) — no squeeze, breakout already extended` });

    if      (price > s.BB_Upper) { bull += 2; sigs.push({ kind: "ok", desc: `Bullish breakout — price above BB Upper ($${s.BB_Upper.toFixed(2)})` }); }
    else if (price < s.BB_Lower) { bear += 2; sigs.push({ kind: "no", desc: `Bearish breakdown — price below BB Lower ($${s.BB_Lower.toFixed(2)})` }); }
    else if (price > s.BB_Mid)   { bull += 1; sigs.push({ kind: "neut", desc: `Price above midline ($${s.BB_Mid.toFixed(2)}) — bullish bias, no breakout yet` }); }
    else                         { bear += 1; sigs.push({ kind: "neut", desc: `Price below midline ($${s.BB_Mid.toFixed(2)}) — bearish bias, no breakdown yet` }); }
  } else {
    sigs.push({ kind: "neut", desc: "Enable Bollinger Bands for breakout detection" });
  }

  if (s.MACD != null && s.MACD_Signal != null) {
    if (s.MACD > s.MACD_Signal) { bull += 1; sigs.push({ kind: "ok", desc: "MACD bullish — confirms upside breakout" }); }
    else                        { bear += 1; sigs.push({ kind: "no", desc: "MACD bearish — confirms downside breakdown" }); }
  }

  if (s.RSI != null) {
    if      (s.RSI >= 55 && s.RSI <= 75) { bull += 1; sigs.push({ kind: "ok", desc: `RSI ${s.RSI.toFixed(0)} — healthy breakout momentum range` }); }
    else if (s.RSI >= 25 && s.RSI <= 45) { bear += 1; sigs.push({ kind: "no", desc: `RSI ${s.RSI.toFixed(0)} — confirms bearish breakdown` }); }
    else if (s.RSI > 75)                 { sigs.push({ kind: "neut", desc: `RSI ${s.RSI.toFixed(0)} overbought — late-stage breakout, reduce size` }); }
  }

  if (s.SMA_20 != null && s.SMA_50 != null) {
    if (s.SMA_20 > s.SMA_50) { bull += 1; sigs.push({ kind: "ok", desc: "Golden Cross supports the upside breakout direction" }); }
    else                     { bear += 1; sigs.push({ kind: "no", desc: "Death Cross supports the downside breakdown direction" }); }
  }

  const dir      = bull > bear ? "LONG" : bear > bull ? "SHORT" : "NEUTRAL";
  const proj     = bandWidth > 0 ? bandWidth : atr * 4;
  const stopRisk = atr * 2.0;
  const stop     = dir === "LONG"
    ? (s.BB_Mid ? Math.min(price - stopRisk, s.BB_Mid) : price - stopRisk)
    : dir === "SHORT"
    ? (s.BB_Mid ? Math.max(price + stopRisk, s.BB_Mid) : price + stopRisk)
    : null;
  const t1 = dir === "LONG" ? price + proj * 0.6 : dir === "SHORT" ? price - proj * 0.6 : null;
  const t2 = dir === "LONG" ? price + proj * 1.2 : dir === "SHORT" ? price - proj * 1.2 : null;

  const entryNote = dir === "LONG"
    ? `Breakout long confirmed. Enter on close above BB Upper. Stop at BB midline ($${s.BB_Mid?.toFixed(2) ?? "—"}). Target: band-width projection. Hold 5–20 days.`
    : dir === "SHORT"
    ? `Breakdown short confirmed. Enter on close below BB Lower. Stop at BB midline ($${s.BB_Mid?.toFixed(2) ?? "—"}). Hold 5–20 days.`
    : "No confirmed breakout — wait for a full daily candle close outside the Bollinger Bands with increasing volume.";

  return { direction: dir, signals: sigs, bull, bear, stop, t1, t2, stopRisk, holdNote: "5–20 day hold", entryNote };
}

function oversoldReversalStrategy(s: IndicatorSummary, price: number, atr: number): SwingResult {
  const sigs: Signal[] = [];
  let bull = 0, bear = 0;

  if (s.RSI != null) {
    if      (s.RSI < 30) { bull += 2; sigs.push({ kind: "ok", desc: `RSI ${s.RSI.toFixed(0)} — strongly oversold, high-probability multi-day bounce` }); }
    else if (s.RSI < 40) { bull += 1; sigs.push({ kind: "ok", desc: `RSI ${s.RSI.toFixed(0)} — approaching oversold, watch for reversal candle` }); }
    else if (s.RSI > 70) { bear += 2; sigs.push({ kind: "no", desc: `RSI ${s.RSI.toFixed(0)} — strongly overbought, multi-day fade likely` }); }
    else if (s.RSI > 60) { bear += 1; sigs.push({ kind: "no", desc: `RSI ${s.RSI.toFixed(0)} — entering overbought zone, watch for rejection` }); }
    else                 {            sigs.push({ kind: "neut", desc: `RSI ${s.RSI.toFixed(0)} — mid-range, no reversal edge` }); }
  }

  if (s.BB_Lower != null && s.BB_Upper != null && s.BB_Mid != null) {
    if      (price <= s.BB_Lower * 1.01) { bull += 1; sigs.push({ kind: "ok", desc: `Price at/near BB Lower ($${s.BB_Lower.toFixed(2)}) — bounce target: midline $${s.BB_Mid.toFixed(2)}` }); }
    else if (price >= s.BB_Upper * 0.99) { bear += 1; sigs.push({ kind: "no", desc: `Price at/near BB Upper ($${s.BB_Upper.toFixed(2)}) — fade target: midline $${s.BB_Mid.toFixed(2)}` }); }
    else {
      const pct = ((price - s.BB_Mid) / s.BB_Mid) * 100;
      if (pct < -3) { bull += 1; sigs.push({ kind: "ok", desc: `Price ${Math.abs(pct).toFixed(1)}% below BB midline — gravitational pull to $${s.BB_Mid.toFixed(2)}` }); }
      else if (pct > 3) { bear += 1; sigs.push({ kind: "no", desc: `Price ${pct.toFixed(1)}% above BB midline — gravitational pull downward` }); }
      else sigs.push({ kind: "neut", desc: "Price near midline — no extremes to revert from" });
    }
  } else {
    sigs.push({ kind: "neut", desc: "Enable Bollinger Bands to identify reversion targets" });
  }

  if (s.MACD_Hist != null) {
    const turning = Math.abs(s.MACD_Hist) < 0.4;
    if (turning) { bull += 1; sigs.push({ kind: "ok", desc: `MACD histogram near zero — momentum shift in progress` }); }
    else if (s.MACD_Hist > 0) sigs.push({ kind: "neut", desc: "MACD histogram positive — wait for bearish reversal signal" });
    else sigs.push({ kind: "neut", desc: "MACD histogram negative — wait for it to flatten before entering" });
  }

  if (s.SMA_50 != null) {
    if (price < s.SMA_50) { bull += 1; sigs.push({ kind: "ok", desc: `Below SMA50 ($${s.SMA_50.toFixed(2)}) — SMA50 acts as multi-day bounce target` }); }
    else                  { bear += 1; sigs.push({ kind: "no", desc: `Above SMA50 ($${s.SMA_50.toFixed(2)}) — SMA50 acts as multi-day resistance target` }); }
  }

  const qualified = Math.max(bull, bear) >= 2;
  const dir       = qualified ? (bull > bear ? "LONG" : bear > bull ? "SHORT" : "NEUTRAL") : "NEUTRAL";
  const stopRisk  = atr * 2.0;
  const stop      = dir === "LONG" ? price - stopRisk : dir === "SHORT" ? price + stopRisk : null;
  const t1        = s.BB_Mid ?? (dir === "LONG" ? price + atr * 3.5 : dir === "SHORT" ? price - atr * 3.5 : null);
  const t2        = dir === "LONG" ? price + atr * 7 : dir === "SHORT" ? price - atr * 7 : null;

  const entryNote = dir === "LONG"
    ? `Reversal long. Confirm with a bullish candle (hammer / engulfing). Target BB midline $${s.BB_Mid?.toFixed(2) ?? "—"}, then $${t2?.toFixed(2) ?? "—"}. Stop 2× ATR below entry.`
    : dir === "SHORT"
    ? `Reversal short. Confirm with a bearish candle (shooting star / engulfing). Target BB midline $${s.BB_Mid?.toFixed(2) ?? "—"}. Stop 2× ATR above entry.`
    : "RSI/BB not at actionable extremes yet. Wait for RSI < 35 or > 65 and price at BB bands before considering entry.";

  return { direction: dir, signals: sigs, bull, bear, stop, t1, t2, stopRisk, holdNote: "5–15 day hold", entryNote };
}

function goldenCrossRideStrategy(s: IndicatorSummary, price: number, atr: number): SwingResult {
  const sigs: Signal[] = [];
  let bull = 0, bear = 0;

  if (s.SMA_20 != null && s.SMA_50 != null) {
    if (s.SMA_20 > s.SMA_50) { bull += 2; sigs.push({ kind: "ok", desc: `Golden Cross active — SMA20 ($${s.SMA_20.toFixed(2)}) above SMA50 ($${s.SMA_50.toFixed(2)})` }); }
    else                     { bear += 2; sigs.push({ kind: "no", desc: `Death Cross active — SMA20 ($${s.SMA_20.toFixed(2)}) below SMA50 ($${s.SMA_50.toFixed(2)})` }); }
  } else {
    sigs.push({ kind: "neut", desc: "Enable SMA 20 & SMA 50 to detect Golden/Death Cross" });
  }

  if (s.SMA_20 != null) {
    if (price > s.SMA_20) { bull += 1; sigs.push({ kind: "ok", desc: `Price above SMA20 ($${s.SMA_20.toFixed(2)}) — use as trailing stop level` }); }
    else                  { bear += 1; sigs.push({ kind: "no", desc: `Price broke below SMA20 ($${s.SMA_20.toFixed(2)}) — setup invalidated` }); }
  }

  if (s.SMA_50 != null) {
    if (price > s.SMA_50) { bull += 1; sigs.push({ kind: "ok", desc: `Price above SMA50 ($${s.SMA_50.toFixed(2)}) — uptrend support holds` }); }
    else                  { bear += 1; sigs.push({ kind: "no", desc: `Price below SMA50 ($${s.SMA_50.toFixed(2)}) — trend structure broken` }); }
  }

  if (s.MACD != null && s.MACD_Signal != null) {
    const aboveZero = s.MACD > 0;
    if (s.MACD > s.MACD_Signal) { bull += 1; sigs.push({ kind: "ok", desc: `MACD bullish${aboveZero ? " above zero line — strong uptrend" : " — momentum recovering"}` }); }
    else                        { bear += 1; sigs.push({ kind: "no", desc: "MACD bearish — trend momentum fading" }); }
  }

  if (s.RSI != null) {
    if      (s.RSI >= 50 && s.RSI <= 70) { bull += 1; sigs.push({ kind: "ok", desc: `RSI ${s.RSI.toFixed(0)} — healthy uptrend range (50–70)` }); }
    else if (s.RSI >= 30 && s.RSI <= 50) { bear += 1; sigs.push({ kind: "no", desc: `RSI ${s.RSI.toFixed(0)} — bearish range, downtrend in control` }); }
    else if (s.RSI > 70)                 { sigs.push({ kind: "neut", desc: `RSI ${s.RSI.toFixed(0)} overbought — trend intact but near-term pullback likely` }); }
    else                                 { sigs.push({ kind: "neut", desc: `RSI ${s.RSI.toFixed(0)} oversold within a trend — potential deep pullback entry` }); }
  }

  const dir      = bull > bear ? "LONG" : bear > bull ? "SHORT" : "NEUTRAL";
  const stopBase = dir === "LONG"
    ? (s.SMA_20 ? Math.min(price - atr * 3, s.SMA_20 - atr * 0.5) : price - atr * 3)
    : dir === "SHORT"
    ? (s.SMA_20 ? Math.max(price + atr * 3, s.SMA_20 + atr * 0.5) : price + atr * 3)
    : null;
  const stopRisk = stopBase ? Math.abs(price - stopBase) : atr * 3;
  const stop     = stopBase;
  const t1       = dir === "LONG" ? price + atr * 5  : dir === "SHORT" ? price - atr * 5  : null;
  const t2       = dir === "LONG" ? price + atr * 10 : dir === "SHORT" ? price - atr * 10 : null;

  const sma20Str = s.SMA_20?.toFixed(2) ?? "—";
  const entryNote = dir === "LONG"
    ? `Trend ride long. Trail stop below SMA20 ($${sma20Str}) — exit if daily close breaks below it. Let T2 run. Typical hold: 10–20 days.`
    : dir === "SHORT"
    ? `Trend ride short. Trail stop above SMA20 ($${sma20Str}). Exit on daily close above SMA20. Typical hold: 10–20 days.`
    : "No Golden/Death Cross confirmed. Wait for SMA20/50 crossover before entering.";

  return { direction: dir, signals: sigs, bull, bear, stop, t1, t2, stopRisk, holdNote: "10–20 day hold", entryNote };
}

// ── Strategy registry ─────────────────────────────────────────────────────────

type StrategyKey = "trend_pullback" | "swing_breakout" | "reversal" | "golden_cross_ride";

const STRATEGIES: Record<StrategyKey, {
  label: string; icon: string; desc: string;
  brief: { what: string; when: string; howItWorks: string; watchOut: string };
  fn:    (s: IndicatorSummary, p: number, a: number) => SwingResult;
}> = {
  trend_pullback: {
    label: "Trend Pullback", icon: "↩️", desc: "Golden Cross + price pulls back to EMA20",
    brief: {
      what:       "Buy the dip within a confirmed uptrend. Instead of chasing a breakout, you wait for price to pull back to a key moving average and enter at a better price.",
      when:       "Use when SMA20 is above SMA50 (Golden Cross confirmed) and price has pulled back toward EMA20 after a recent rally. You're buying a discount in an already-proven uptrend.",
      howItWorks: "The Golden Cross tells you the medium-term trend is up. Price rarely goes straight up — it pulls back to EMA20 before continuing. That pullback is your entry. The stop goes just below SMA50 (the trend support). Targets are set using ATR to project how far the next leg up can reach.",
      watchOut:   "If price closes below SMA50, the trend is likely broken — exit and don't add. Also avoid entries when RSI is already above 65 — the pullback may not have finished yet.",
    },
    fn: trendPullbackStrategy,
  },
  swing_breakout: {
    label: "Breakout", icon: "🚀", desc: "BB squeeze → multi-day breakout projection",
    brief: {
      what:       "Capture the explosive move after a multi-day consolidation. When a stock compresses into a tight range, the eventual breakout often travels the full width of that range.",
      when:       "Use when Bollinger Bands have been squeezing for 5+ days and price closes decisively above the upper band (or below the lower band). Best combined with a Golden Cross background trend.",
      howItWorks: "The squeeze is the setup; the close outside the band is the trigger. Your profit target is the band-width projected from the breakout point. This gives a data-derived, objective target rather than a guess. Stop goes at the BB midline so you're out quickly if it's a false breakout.",
      watchOut:   "Never enter on a wick — only on a full candle close outside the bands. A breakout on weak volume often reverses within 1–2 days. If price re-enters the bands the next day, exit.",
    },
    fn: breakoutSwingStrategy,
  },
  reversal: {
    label: "Reversal", icon: "🔄", desc: "Oversold/overbought extreme → BB midline target",
    brief: {
      what:       "Catch a multi-day bounce from an extreme oversold or overbought reading. Prices rarely stay at extremes — they snap back to their average.",
      when:       "Use when RSI is below 35 (oversold) or above 65 (overbought) AND price is near the corresponding Bollinger Band. Both conditions must line up — RSI alone is not enough.",
      howItWorks: "When a stock is oversold and sitting on the BB Lower band, you're buying fear at an extreme. The target is the BB midline (the 20-day average) which tends to act as a magnet. The stop is placed 2× ATR below entry to survive the final capitulation shake-out.",
      watchOut:   "Oversold in a strong downtrend can get more oversold. Always wait for a bullish confirmation candle (hammer, engulfing) before entering — don't buy just because RSI is low. The candle tells you sellers are exhausted.",
    },
    fn: oversoldReversalStrategy,
  },
  golden_cross_ride: {
    label: "Golden Cross Ride", icon: "✨", desc: "SMA20/50 cross → trail stop below SMA20",
    brief: {
      what:       "Ride the medium-term trend by using the Golden Cross as your entry filter and SMA20 as a dynamic trailing stop that moves up with the stock.",
      when:       "Use after a confirmed Golden Cross (SMA20 > SMA50), when price is above both MAs and RSI is in the 50–70 range. This is a patient strategy — expect to hold 2–4 weeks.",
      howItWorks: "The Golden Cross signals that the medium-term trend has shifted bullish. You enter and then let SMA20 do the work — as long as price stays above SMA20, you stay in the trade. When price eventually closes below SMA20, you exit with your profits. Targets are set wide (5–10× ATR) because this is a trend-following strategy, not a short-term trade.",
      watchOut:   "This is a slow strategy — it requires patience. Don't exit on normal intraday dips below SMA20; only a full daily candle close below it triggers the exit. Also be aware that Golden Cross signals have a lag — by the time it fires, the stock may have already rallied 10–20%.",
    },
    fn: goldenCrossRideStrategy,
  },
};

// ── Brief ────────────────────────────────────────────────────────────────────

function StrategyBrief({ brief }: { brief: typeof STRATEGIES[StrategyKey]["brief"] }) {
  return (
    <details className="mb-3 rounded-xl border border-sky-200 bg-sky-50 dark:border-[#00C8FF33] dark:bg-[#00C8FF0A]">
      <summary className="flex items-center gap-2 px-4 py-2.5 text-[0.75rem] font-semibold text-sky-600 dark:text-[#00C8FF] cursor-pointer list-none select-none hover:bg-sky-100 dark:hover:bg-[#00C8FF10]">
        <span>💡</span>
        <span>How this strategy works (beginner guide)</span>
      </summary>
      <div className="px-4 pb-4 pt-3 space-y-3">
        {([
          { icon: "📌", label: "What it is",    text: brief.what },
          { icon: "🕐", label: "When to use",   text: brief.when },
          { icon: "⚙️", label: "How it works",  text: brief.howItWorks },
          { icon: "⚠️", label: "Watch out for", text: brief.watchOut },
        ] as const).map(({ icon, label, text }) => (
          <div key={label}>
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">{icon} {label}</p>
            <p className="text-[0.75rem] text-slate-600 dark:text-slate-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

// ── Strategy card ─────────────────────────────────────────────────────────────

function SwingCard({ result, entry }: { result: SwingResult; entry: number }) {
  const { direction: dir, signals, bull, bear, stop, t1, t2, stopRisk, holdNote, entryNote } = result;
  const total    = bull + bear;
  const quality  = Math.max(bull, bear);
  const qualPct  = total ? Math.round((quality / total) * 100) : 0;
  const qualLbl  = qualPct >= 75 ? "Strong" : qualPct >= 50 ? "Moderate" : "Weak";
  const qualColor = qualPct >= 75 ? "var(--color-bull)" : qualPct >= 50 ? "#fbbf24" : "var(--color-bear)";
  const dirColor  = dir === "LONG" ? "var(--color-bull)" : dir === "SHORT" ? "var(--color-bear)" : "var(--color-acc)";
  const rr        = stopRisk && t2 ? Math.abs(t2 - entry) / stopRisk : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold font-mono text-sm" style={{ color: dirColor }}>
          {dir === "LONG" ? "↑ LONG SETUP" : dir === "SHORT" ? "↓ SHORT SETUP" : "— NO CLEAR SETUP"}
        </span>
        <span className="text-[0.65rem] font-semibold text-slate-500 dark:text-slate-400">{holdNote}</span>
      </div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[0.7rem] font-semibold" style={{ color: qualColor }}>{qualLbl} ({quality}/{total})</span>
        {rr && <span className="text-[0.65rem] text-slate-500">R:R ≈ 1:{rr.toFixed(1)}</span>}
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-[#1a2540] overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all" style={{ width: `${qualPct}%`, background: qualColor }} />
      </div>

      {/* Levels */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { lbl: "Entry",     val: `$${entry.toFixed(2)}`, sub: "current price",              color: undefined },
          { lbl: "Stop Loss", val: stop ? `$${stop.toFixed(2)}` : "—",
            sub: stop ? `${(((stop - entry) / entry) * 100).toFixed(1)}%` : "—", color: "var(--color-bear)" },
          { lbl: "Risk/Share", val: stopRisk ? `$${stopRisk.toFixed(2)}` : "—", sub: "2–3× ATR", color: undefined },
        ].map(({ lbl, val, sub, color }) => (
          <div key={lbl} className="rounded-lg border border-light-border dark:border-dark-border bg-light-bg3 dark:bg-dark-bg3 p-2.5">
            <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">{lbl}</p>
            <p className="text-base font-bold font-mono leading-tight" style={{ color: color ?? undefined }}>{val}</p>
            <p className="text-[0.62rem] text-slate-500 font-mono">{sub}</p>
          </div>
        ))}
      </div>

      {t1 && t2 && (
        <Card className="mb-3 p-3">
          <CardTitle>Swing Targets</CardTitle>
          {[
            { lbl: "T1 · Partial exit", price: t1, note: "Take 50% off position" },
            { lbl: "T2 · Full target",  price: t2, note: "Trail stop on remainder" },
          ].map(({ lbl, price: tp, note }) => (
            <div key={lbl} className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-dark-border last:border-0 text-sm">
              <span className="text-slate-500 text-xs font-semibold min-w-[100px]">{lbl}</span>
              <span className="font-bold font-mono" style={{ color: dirColor }}>
                ${tp.toFixed(2)}{" "}
                <span className="text-[0.68rem] opacity-70">({(((tp - entry) / entry) * 100).toFixed(1)}%)</span>
              </span>
              <span className="text-[0.65rem] text-slate-500 text-right flex-1 pl-2">{note}</span>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-3 mb-3">
        <CardTitle>Signal Checklist</CardTitle>
        <div className="space-y-1">
          {signals.map(({ kind, desc }, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className={`mt-0.5 shrink-0 font-bold ${kind === "ok" ? "text-emerald-600 dark:text-[#00FF9D]" : kind === "no" ? "text-red-600 dark:text-[#FF0055]" : "text-slate-500 dark:text-slate-400"}`}>
                {kind === "ok" ? "✓" : kind === "no" ? "✗" : "–"}
              </span>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="text-[0.74rem] text-slate-600 dark:text-slate-400 leading-relaxed bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 dark:bg-[#00C8FF0A] dark:border-[#00C8FF22]">
        📅 {entryNote}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  summary: IndicatorSummary;
  price:   number | null;
}

export function SwingSetup({ summary, price }: Props) {
  const [activeStrategy, setActiveStrategy] = useState<StrategyKey>("trend_pullback");
  const atr = summary.ATR;

  if (!price || !atr) {
    return (
      <div>
        <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 mt-3">
          Swing Trade Setup
        </p>
        <Card>
          <p className="text-xs text-slate-500 text-center py-2">Insufficient data to compute swing setup.</p>
        </Card>
      </div>
    );
  }

  const result = STRATEGIES[activeStrategy].fn(summary, price, atr);

  return (
    <div>
      <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 mt-3">
        Swing Trade Setup <span className="text-slate-400 dark:text-slate-500 font-normal normal-case tracking-normal">(3–20 day hold)</span>
      </p>

      <div className="flex gap-1.5 mb-3 flex-wrap">
        {(Object.keys(STRATEGIES) as StrategyKey[]).map((key) => {
          const st     = STRATEGIES[key];
          const active = key === activeStrategy;
          return (
            <button
              key={key}
              onClick={() => setActiveStrategy(key)}
              title={st.desc}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[0.72rem] font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-sky-50 border-sky-300 text-sky-600 dark:bg-[#00C8FF1A] dark:border-[#00C8FF55] dark:text-[#00C8FF]"
                  : "border-light-border dark:border-dark-border text-slate-500 hover:border-sky-300 hover:text-sky-600 dark:hover:border-[#00C8FF44] dark:hover:text-[#00C8FF] bg-white dark:bg-dark-bg3"
              }`}
            >
              <span>{st.icon}</span>
              <span>{st.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[0.68rem] text-slate-500 mb-3 italic">{STRATEGIES[activeStrategy].desc}</p>
      <StrategyBrief brief={STRATEGIES[activeStrategy].brief} />
      <SwingCard result={result} entry={price} />
    </div>
  );
}
