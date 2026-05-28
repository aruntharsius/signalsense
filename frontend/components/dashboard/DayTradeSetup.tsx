"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import type { IndicatorSummary } from "@/lib/types";

type SigKind  = "ok" | "no" | "neut";
type Direction = "LONG" | "SHORT" | "NEUTRAL";

interface Signal { kind: SigKind; desc: string; }
interface StrategyResult {
  direction: Direction;
  signals:   Signal[];
  bull:      number;
  bear:      number;
  stop:      number | null;
  t1:        number | null;
  t2:        number | null;
  risk:      number | null;
  entryNote: string;
}

// ── Strategy helpers ──────────────────────────────────────────────────────────

function momentumStrategy(s: IndicatorSummary, price: number, atr: number): StrategyResult {
  const sigs: Signal[] = [];
  let bull = 0, bear = 0;

  if (s.RSI != null) {
    if (s.RSI < 50) { bull++; sigs.push({ kind: "ok", desc: `RSI ${s.RSI.toFixed(1)} below midline — bullish bias` }); }
    else            { bear++; sigs.push({ kind: "no", desc: `RSI ${s.RSI.toFixed(1)} above midline — bearish bias` }); }
  }
  if (s.MACD != null && s.MACD_Signal != null) {
    if (s.MACD > s.MACD_Signal) { bull++; sigs.push({ kind: "ok", desc: "MACD above signal line — upward momentum" }); }
    else                        { bear++; sigs.push({ kind: "no", desc: "MACD below signal line — downward momentum" }); }
  }
  if (s.SMA_20 != null && s.SMA_50 != null) {
    if (s.SMA_20 > s.SMA_50) { bull++; sigs.push({ kind: "ok", desc: `Golden Cross: SMA20 (${s.SMA_20.toFixed(2)}) > SMA50 (${s.SMA_50.toFixed(2)})` }); }
    else                     { bear++; sigs.push({ kind: "no", desc: `Death Cross: SMA20 (${s.SMA_20.toFixed(2)}) < SMA50 (${s.SMA_50.toFixed(2)})` }); }
  }
  if (s.EMA_20 != null) {
    if (price > s.EMA_20) { bull++; sigs.push({ kind: "ok", desc: `Price above EMA20 (${s.EMA_20.toFixed(2)}) — short-term bullish` }); }
    else                  { bear++; sigs.push({ kind: "no", desc: `Price below EMA20 (${s.EMA_20.toFixed(2)}) — short-term bearish` }); }
  }
  if (sigs.length === 0) sigs.push({ kind: "neut", desc: "Enable RSI, MACD, SMA to see signals" });

  const dir  = bull > bear ? "LONG" : bear > bull ? "SHORT" : "NEUTRAL";
  const risk = atr * 1.5;
  const stop = dir === "LONG" ? price - risk : dir === "SHORT" ? price + risk : null;
  const t1   = dir === "LONG" ? price + risk : dir === "SHORT" ? price - risk : null;
  const t2   = dir === "LONG" ? price + risk * 2 : dir === "SHORT" ? price - risk * 2 : null;
  const note = dir === "LONG"
    ? `Momentum long at $${price.toFixed(2)}. Stop $${stop?.toFixed(2)}. Trail stop to breakeven once T1 is hit.`
    : dir === "SHORT"
    ? `Momentum short at $${price.toFixed(2)}. Stop $${stop?.toFixed(2)}. Cover 50% at T1.`
    : "Mixed signals — wait for RSI, MACD, and price to align before entering.";

  return { direction: dir, signals: sigs, bull, bear, stop, t1, t2, risk, entryNote: note };
}

function meanReversionStrategy(s: IndicatorSummary, price: number, atr: number): StrategyResult {
  const sigs: Signal[] = [];
  let bull = 0, bear = 0;

  if (s.RSI != null) {
    if      (s.RSI < 30) { bull += 2; sigs.push({ kind: "ok", desc: `RSI ${s.RSI.toFixed(1)} — strongly oversold, high-probability bounce` }); }
    else if (s.RSI < 40) { bull++;    sigs.push({ kind: "ok", desc: `RSI ${s.RSI.toFixed(1)} — approaching oversold, watch for reversal candle` }); }
    else if (s.RSI > 70) { bear += 2; sigs.push({ kind: "no", desc: `RSI ${s.RSI.toFixed(1)} — strongly overbought, fade opportunity` }); }
    else if (s.RSI > 60) { bear++;    sigs.push({ kind: "no", desc: `RSI ${s.RSI.toFixed(1)} — approaching overbought, watch for rejection` }); }
    else                 {            sigs.push({ kind: "neut", desc: `RSI ${s.RSI.toFixed(1)} — mid-range, no reversion edge yet` }); }
  }
  if (s.BB_Lower != null && s.BB_Upper != null && s.BB_Mid != null) {
    if      (price < s.BB_Lower * 1.005) { bull++; sigs.push({ kind: "ok", desc: `Price at/below BB Lower ($${s.BB_Lower.toFixed(2)}) — bounce to midline ($${s.BB_Mid.toFixed(2)})` }); }
    else if (price > s.BB_Upper * 0.995) { bear++; sigs.push({ kind: "no", desc: `Price at/above BB Upper ($${s.BB_Upper.toFixed(2)}) — fade to midline ($${s.BB_Mid.toFixed(2)})` }); }
    else {
      const pctFromMid = ((price - s.BB_Mid) / s.BB_Mid) * 100;
      if      (pctFromMid < -2) { bull++; sigs.push({ kind: "ok", desc: `Price ${Math.abs(pctFromMid).toFixed(1)}% below midline — gravitational pull upward` }); }
      else if (pctFromMid >  2) { bear++; sigs.push({ kind: "no", desc: `Price ${pctFromMid.toFixed(1)}% above midline — gravitational pull downward` }); }
      else                      {         sigs.push({ kind: "neut", desc: "Price hugging midline — no reversion setup" }); }
    }
  } else {
    sigs.push({ kind: "neut", desc: "Enable Bollinger Bands for reversion targets" });
  }
  if (s.MACD_Hist != null) {
    const histTurning = Math.abs(s.MACD_Hist) < 0.5;
    if (histTurning) sigs.push({ kind: "ok", desc: "MACD histogram near zero — momentum shift possible" });
  }

  const dir  = bull > bear ? "LONG" : bear > bull ? "SHORT" : "NEUTRAL";
  const risk = atr * 1.0;
  const stop = dir === "LONG" ? price - risk : dir === "SHORT" ? price + risk : null;
  const t1   = s.BB_Mid ?? (dir === "LONG" ? price + atr * 1.5 : dir === "SHORT" ? price - atr * 1.5 : null);
  const t2   = dir === "LONG" ? price + risk * 2.5 : dir === "SHORT" ? price - risk * 2.5 : null;
  const note = dir === "LONG"
    ? `Reversion long at $${price.toFixed(2)}. Target BB midline $${s.BB_Mid?.toFixed(2) ?? "—"}. Stop $${stop?.toFixed(2)} (1× ATR).`
    : dir === "SHORT"
    ? `Reversion short at $${price.toFixed(2)}. Target BB midline $${s.BB_Mid?.toFixed(2) ?? "—"}. Stop $${stop?.toFixed(2)} (1× ATR).`
    : "Price is mid-band with neutral RSI — no reversion edge. Wait for price to reach BB extremes.";

  return { direction: dir, signals: sigs, bull, bear, stop, t1, t2, risk, entryNote: note };
}

function trendContinuationStrategy(s: IndicatorSummary, price: number, atr: number): StrategyResult {
  const sigs: Signal[] = [];
  let bull = 0, bear = 0;

  if (s.SMA_20 != null && s.SMA_50 != null) {
    if (s.SMA_20 > s.SMA_50) { bull += 2; sigs.push({ kind: "ok", desc: `Golden Cross confirmed — primary uptrend active` }); }
    else                     { bear += 2; sigs.push({ kind: "no", desc: `Death Cross confirmed — primary downtrend active` }); }
  } else {
    sigs.push({ kind: "neut", desc: "Enable SMA 20 & SMA 50 for trend detection" });
  }
  if (s.EMA_20 != null) {
    const nearEma = Math.abs(price - s.EMA_20) / s.EMA_20 < 0.01;
    if (price > s.EMA_20) { bull++; sigs.push({ kind: "ok", desc: `Price above EMA20 ($${s.EMA_20.toFixed(2)})${nearEma ? " — at pullback entry zone" : " — trend intact"}` }); }
    else                  { bear++; sigs.push({ kind: "no", desc: `Price below EMA20 ($${s.EMA_20.toFixed(2)})${nearEma ? " — at short entry zone (rally to EMA)" : " — trend broken"}` }); }
  }
  if (s.EMA_50 != null) {
    if (price > s.EMA_50) { bull++; sigs.push({ kind: "ok", desc: `Price above EMA50 ($${s.EMA_50.toFixed(2)}) — intermediate uptrend intact` }); }
    else                  { bear++; sigs.push({ kind: "no", desc: `Price below EMA50 ($${s.EMA_50.toFixed(2)}) — intermediate downtrend` }); }
  }
  if (s.MACD != null && s.MACD_Signal != null) {
    const histGrowing = s.MACD_Hist != null && s.MACD_Hist > 0;
    if (s.MACD > s.MACD_Signal) { bull++; sigs.push({ kind: "ok", desc: `MACD bullish${histGrowing ? " — histogram growing, trend strengthening" : " — watch for histogram fade"}` }); }
    else                        { bear++; sigs.push({ kind: "no", desc: `MACD bearish${s.MACD_Hist != null && s.MACD_Hist < 0 ? " — selling pressure continues" : " — recovery possible"}` }); }
  }

  const dir  = bull > bear ? "LONG" : bear > bull ? "SHORT" : "NEUTRAL";
  const risk = atr * 1.2;
  const stopBase = dir === "LONG" ? price - risk : dir === "SHORT" ? price + risk : null;
  const stop = dir === "LONG" && s.SMA_20 != null
    ? Math.min(stopBase!, s.SMA_20 - atr * 0.3)
    : dir === "SHORT" && s.SMA_20 != null
    ? Math.max(stopBase!, s.SMA_20 + atr * 0.3)
    : stopBase;
  const t1   = dir === "LONG" ? price + atr * 2 : dir === "SHORT" ? price - atr * 2 : null;
  const t2   = dir === "LONG" ? price + atr * 3.5 : dir === "SHORT" ? price - atr * 3.5 : null;
  const note = dir === "LONG"
    ? `Trend long. Buy pullbacks to EMA20 ($${s.EMA_20?.toFixed(2) ?? "—"}). Stop below SMA20 at $${stop?.toFixed(2)}. Let T2 run with a trailing stop.`
    : dir === "SHORT"
    ? `Trend short. Sell rallies to EMA20 ($${s.EMA_20?.toFixed(2) ?? "—"}). Stop above SMA20 at $${stop?.toFixed(2)}.`
    : "No clear trend — Golden/Death Cross not confirmed. Sit out until trend establishes.";

  return { direction: dir, signals: sigs, bull, bear, stop, t1, t2, risk, entryNote: note };
}

function breakoutStrategy(s: IndicatorSummary, price: number, atr: number): StrategyResult {
  const sigs: Signal[] = [];
  let bull = 0, bear = 0;

  let bandWidth = 0;
  if (s.BB_Upper != null && s.BB_Lower != null && s.BB_Mid != null) {
    bandWidth = s.BB_Upper - s.BB_Lower;
    const bwPct = (bandWidth / s.BB_Mid) * 100;
    if (bwPct < 3.5)       sigs.push({ kind: "ok",   desc: `Tight squeeze — band width ${bwPct.toFixed(1)}%. Breakout imminent` });
    else if (bwPct < 6)    sigs.push({ kind: "ok",   desc: `Moderate compression — band width ${bwPct.toFixed(1)}%` });
    else                   sigs.push({ kind: "neut",  desc: `Wide bands (${bwPct.toFixed(1)}%) — breakout already underway or no setup` });

    if      (price > s.BB_Upper) { bull += 2; sigs.push({ kind: "ok", desc: `Price above BB Upper ($${s.BB_Upper.toFixed(2)}) — confirmed upside breakout` }); }
    else if (price < s.BB_Lower) { bear += 2; sigs.push({ kind: "no", desc: `Price below BB Lower ($${s.BB_Lower.toFixed(2)}) — confirmed downside breakout` }); }
    else if (price > s.BB_Mid)   { bull++;    sigs.push({ kind: "ok", desc: `Price above midline — biased toward upper band breakout` }); }
    else                         { bear++;    sigs.push({ kind: "no", desc: `Price below midline — biased toward lower band breakdown` }); }
  } else {
    sigs.push({ kind: "neut", desc: "Enable Bollinger Bands for breakout detection" });
  }
  if (s.MACD_Hist != null) {
    if      (s.MACD_Hist > 0 && s.MACD != null && s.MACD_Signal != null && s.MACD > s.MACD_Signal)
      { bull++; sigs.push({ kind: "ok", desc: "MACD histogram positive — confirms bullish breakout momentum" }); }
    else if (s.MACD_Hist < 0)
      { bear++; sigs.push({ kind: "no", desc: "MACD histogram negative — confirms bearish breakdown" }); }
  }
  if (s.RSI != null) {
    if (s.RSI > 50 && s.RSI < 80) { bull++; sigs.push({ kind: "ok", desc: `RSI ${s.RSI.toFixed(1)} — momentum in bullish range` }); }
    else if (s.RSI < 50 && s.RSI > 20) { bear++; sigs.push({ kind: "no", desc: `RSI ${s.RSI.toFixed(1)} — momentum in bearish range` }); }
  }

  const dir  = bull > bear ? "LONG" : bear > bull ? "SHORT" : "NEUTRAL";
  const risk = atr;
  const stop = dir === "LONG"
    ? (s.BB_Mid ? Math.min(price - risk, s.BB_Mid) : price - risk)
    : dir === "SHORT"
    ? (s.BB_Mid ? Math.max(price + risk, s.BB_Mid) : price + risk)
    : null;
  const projectionBase = bandWidth > 0 ? bandWidth : atr * 3;
  const t1   = dir === "LONG" ? price + projectionBase * 0.5 : dir === "SHORT" ? price - projectionBase * 0.5 : null;
  const t2   = dir === "LONG" ? price + projectionBase       : dir === "SHORT" ? price - projectionBase       : null;
  const note = dir === "LONG"
    ? `Upside breakout. Enter near $${price.toFixed(2)}. Stop at BB midline/ATR ($${stop?.toFixed(2)}). T2 projects full band width.`
    : dir === "SHORT"
    ? `Downside breakdown. Enter near $${price.toFixed(2)}. Stop at BB midline ($${stop?.toFixed(2)}). Target: band width projection.`
    : "No breakout direction confirmed. Wait for price to close outside the bands before entry.";

  return { direction: dir, signals: sigs, bull, bear, stop, t1, t2, risk, entryNote: note };
}

// ── Strategy registry ─────────────────────────────────────────────────────────

type StrategyKey = "momentum" | "mean_reversion" | "trend" | "breakout";

const STRATEGIES: Record<StrategyKey, {
  label: string; icon: string; desc: string;
  brief: { what: string; when: string; howItWorks: string; watchOut: string };
  fn: (s: IndicatorSummary, p: number, a: number) => StrategyResult;
}> = {
  momentum: {
    label: "Momentum", icon: "⚡", desc: "MACD + RSI + SMA alignment",
    brief: {
      what:       "Ride the wave. If a stock is already moving strongly in one direction, you trade with it — not against it.",
      when:       "Use this when the stock has been making consistent higher highs (or lower lows) with increasing volume.",
      howItWorks: "The setup checks that MACD is pointing in the same direction as RSI and the moving averages. When all three agree, the odds of continuation are higher. You enter after confirmation and ride the move until momentum starts to fade.",
      watchOut:   "Momentum can stall fast near earnings, news events, or key resistance levels. Never chase a stock that's already up big — wait for a small pullback first.",
    },
    fn: momentumStrategy,
  },
  mean_reversion: {
    label: "Mean Reversion", icon: "↩️", desc: "RSI + BB extremes → midline target",
    brief: {
      what:       "Buy the dip, sell the spike. Prices rarely stay at extremes for long — they tend to \"snap back\" toward their average.",
      when:       "Use this when a stock has dropped sharply and looks oversold (RSI below 30, price near the lower Bollinger Band), or spiked up and looks overbought (RSI above 70, price near the upper band).",
      howItWorks: "The setup identifies when price has stretched too far from its average (the BB midline). You trade the snap-back, targeting a return to that midline. The entry is at the extreme; the exit is near the middle.",
      watchOut:   "A stock in a strong downtrend can keep making new lows — oversold can get more oversold. Always wait for a reversal candle (like a hammer or engulfing candle) before entering.",
    },
    fn: meanReversionStrategy,
  },
  trend: {
    label: "Trend Follow", icon: "📈", desc: "MA structure + pullback to EMA entry",
    brief: {
      what:       "Go with the big picture. Instead of predicting a turn, you wait for a trend to be confirmed, then enter on a pullback at a good price.",
      when:       "Use this when SMA 20 is clearly above SMA 50 (uptrend) or below it (downtrend). You're looking for the trend to already be established — not forming.",
      howItWorks: "After a Golden Cross confirms the uptrend, price rarely goes straight up — it dips back to the EMA 20 before continuing higher. That dip is your entry. You're buying at a discount within an already-proven trend, with a stop just below the SMA 20 line.",
      watchOut:   "Trends end. If price closes below SMA 50 in an uptrend (or above it in a downtrend), the setup is invalidated — exit and reassess. Don't hold through a trend break hoping it recovers.",
    },
    fn: trendContinuationStrategy,
  },
  breakout: {
    label: "Breakout", icon: "🚀", desc: "BB squeeze + band-width projection target",
    brief: {
      what:       "Catch the explosion. After a period of calm (tight Bollinger Bands), stocks often make a sharp, fast move. This strategy positions you just as that move begins.",
      when:       "Use this when Bollinger Bands have been squeezing tighter for several days (band width below ~4%). The tighter and longer the squeeze, the bigger the potential move.",
      howItWorks: "A BB squeeze means the market is holding its breath. When price finally breaks above the upper band (or below the lower band), that's the trigger. Your profit target is the width of the squeeze projected from the breakout point.",
      watchOut:   "Fake breakouts are common. Wait for a full candle close outside the band — not just a wick. Also check that volume is increasing on the breakout candle; a low-volume breakout often reverses quickly.",
    },
    fn: breakoutStrategy,
  },
};

// ── Beginner brief ────────────────────────────────────────────────────────────

interface BriefProps {
  brief: { what: string; when: string; howItWorks: string; watchOut: string };
}

function StrategyBrief({ brief }: BriefProps) {
  return (
    <details className="mb-3 rounded-xl border border-sky-200 bg-sky-50 dark:border-[#00C8FF33] dark:bg-[#00C8FF0A] overflow-hidden">
      <summary className="flex items-center gap-2 px-4 py-2.5 text-[0.75rem] font-semibold text-sky-600 dark:text-[#00C8FF] cursor-pointer list-none select-none hover:bg-sky-100 dark:hover:bg-[#00C8FF10]">
        <span>💡</span>
        <span>How this strategy works (beginner guide)</span>
      </summary>
      <div className="px-4 pb-4 pt-3 space-y-3">
        {(
          [
            { icon: "📌", label: "What it is",    text: brief.what },
            { icon: "🕐", label: "When to use",   text: brief.when },
            { icon: "⚙️", label: "How it works",  text: brief.howItWorks },
            { icon: "⚠️", label: "Watch out for", text: brief.watchOut },
          ] as const
        ).map(({ icon, label, text }) => (
          <div key={label}>
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
              {icon} {label}
            </p>
            <p className="text-[0.75rem] text-slate-600 dark:text-slate-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

// ── Shared renderer ───────────────────────────────────────────────────────────

function StrategyCard({ result, entry }: { result: StrategyResult; entry: number }) {
  const { direction: dir, signals, bull, bear, stop, t1, t2, risk, entryNote } = result;
  const total    = bull + bear;
  const quality  = Math.max(bull, bear);
  const qualPct  = total ? Math.round((quality / total) * 100) : 0;
  const qualLbl  = qualPct >= 75 ? "Strong" : qualPct >= 50 ? "Moderate" : "Weak";
  const qualColor= qualPct >= 75 ? "var(--color-bull)" : qualPct >= 50 ? "#fbbf24" : "var(--color-bear)";
  const dirColor = dir === "LONG" ? "var(--color-bull)" : dir === "SHORT" ? "var(--color-bear)" : "var(--color-acc)";

  return (
    <div>
      {/* Direction + quality */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold font-mono text-sm" style={{ color: dirColor }}>
          {dir === "LONG" ? "↑ LONG SETUP" : dir === "SHORT" ? "↓ SHORT SETUP" : "— NO CLEAR SETUP"}
        </span>
        <span className="text-[0.7rem] font-semibold" style={{ color: qualColor }}>
          {qualLbl} ({quality}/{total})
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-[#1a2540] overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all" style={{ width: `${qualPct}%`, background: qualColor }} />
      </div>

      {/* Entry / Stop / Risk */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { lbl: "Entry",        val: `$${entry.toFixed(2)}`,          sub: risk ? `ATR = $${(risk / 1.5).toFixed(2)}` : "—",   color: undefined },
          { lbl: "Stop Loss",    val: stop ? `$${stop.toFixed(2)}` : "—", sub: stop ? `${(((stop - entry) / entry) * 100).toFixed(2)}%` : "—", color: "#FF0055" },
          { lbl: "Risk / Share", val: risk ? `$${risk.toFixed(2)}` : "—",  sub: "per share",                                   color: undefined },
        ].map(({ lbl, val, sub, color }) => (
          <div key={lbl} className="rounded-lg border border-light-border dark:border-dark-border bg-light-bg3 dark:bg-dark-bg3 p-2.5">
            <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">{lbl}</p>
            <p className="text-base font-bold font-mono leading-tight" style={{ color: color ?? undefined }}>{val}</p>
            <p className="text-[0.62rem] text-slate-500 font-mono">{sub}</p>
          </div>
        ))}
      </div>

      {/* Profit targets */}
      {t1 && t2 && (
        <Card className="mb-3 p-3">
          <CardTitle>Profit Targets</CardTitle>
          {[
            { lbl: "T1 · 1:1 R:R", price: t1, note: "Cover 50–75% of position" },
            { lbl: "T2 · Extended", price: t2, note: "Trail stop on remainder" },
          ].map(({ lbl, price: tp, note }) => (
            <div key={lbl} className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-dark-border last:border-0 text-sm">
              <span className="text-slate-500 text-xs font-semibold min-w-[90px]">{lbl}</span>
              <span className="font-bold font-mono" style={{ color: dirColor }}>
                ${tp.toFixed(2)}{" "}
                <span className="text-[0.68rem] opacity-70">
                  ({(((tp - entry) / entry) * 100).toFixed(2)}%)
                </span>
              </span>
              <span className="text-[0.65rem] text-slate-500 text-right flex-1 pl-2">{note}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Signal checklist */}
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

      {/* Entry note */}
      <div className="text-[0.74rem] text-slate-600 dark:text-slate-400 leading-relaxed bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 dark:bg-[#00C8FF0A] dark:border-[#00C8FF22]">
        ⚡ {entryNote}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  summary: IndicatorSummary;
  price:   number | null;
}

export function DayTradeSetup({ summary, price }: Props) {
  const [activeStrategy, setActiveStrategy] = useState<StrategyKey>("momentum");
  const atr = summary.ATR;

  if (!price || !atr) {
    return (
      <div>
        <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 mt-3">
          Day Trade Setup
        </p>
        <Card>
          <p className="text-xs text-slate-500 text-center py-2">
            Insufficient data to compute trade setup.
          </p>
        </Card>
      </div>
    );
  }

  const result = STRATEGIES[activeStrategy].fn(summary, price, atr);

  return (
    <div>
      <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 mt-3">
        Day Trade Setup
      </p>

      {/* Strategy tabs */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {(Object.keys(STRATEGIES) as StrategyKey[]).map((key) => {
          const st = STRATEGIES[key];
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

      {/* Beginner brief */}
      <StrategyBrief brief={STRATEGIES[activeStrategy].brief} />

      <StrategyCard result={result} entry={price} />
    </div>
  );
}
