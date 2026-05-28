"use client";

import { useState } from "react";
import type React from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import type { TickerInfo, IndicatorSummary, NewsItem, AIAnalysis } from "@/lib/types";
import { runAnalysis } from "@/lib/api";

interface Props {
  ticker: string;
  info: TickerInfo;
  news: NewsItem[];
  summary: IndicatorSummary;
}

const TABS = ["🔍 Analysis", "📰 News"] as const;
type Tab = typeof TABS[number];

// ── News sentiment ───────────────────────────────────────────────────────────

const BULL_KW = [
  "beat", "beats", "surges", "surge", "rally", "rallies", "upgrade", "upgraded",
  "buy", "strong", "growth", "gain", "gains", "rises", "soars", "soared",
  "outperforms", "exceeds", "record", "profit", "profits", "bullish", "positive",
  "breakthrough", "partnership", "deal", "raises guidance", "raises forecast",
  "better than expected", "above estimates", "dividend", "buyback",
];

const BEAR_KW = [
  "miss", "misses", "missed", "falls", "fall", "drops", "drop", "decline",
  "declines", "downgrade", "downgraded", "sell", "weak", "loss", "losses",
  "lawsuit", "investigation", "concern", "warning", "cut", "cuts", "layoff",
  "layoffs", "fraud", "bearish", "negative", "below estimates", "disappoints",
  "disappointing", "worse than expected", "recall", "probe", "fine", "penalty",
];

function scoreSentiment(title = ""): "bullish" | "bearish" | "neutral" {
  const t = title.toLowerCase();
  const b = BULL_KW.filter((w) => t.includes(w)).length;
  const r = BEAR_KW.filter((w) => t.includes(w)).length;
  if (b > r) return "bullish";
  if (r > b) return "bearish";
  return "neutral";
}

// ── Glossary ────────────────────────────────────────────────────────────────

const GLOSSARY: Record<string, { title: string; what: string; action: string }> = {
  RSI:    { title: "RSI — Relative Strength Index",     what: "Momentum oscillator 0–100. Above 70 = overbought. Below 30 = oversold.",          action: "Above 70: Watch for pullback. Below 30: Potential buy. Divergence signals reversal." },
  MACD:   { title: "MACD (12, 26, 9)",                  what: "Difference between 12 and 26-day EMA. Signal line is 9-day EMA of MACD.",           action: "Bullish cross below zero: strong buy. Histogram shrinking: momentum fading." },
  SMA_20: { title: "SMA 20",                            what: "Average close over 20 days. Dynamic support/resistance.",                            action: "Price above: pullbacks are buy ops. Price below: rallies are sell ops." },
  SMA_50: { title: "SMA 50 — Golden/Death Cross",       what: "Average close over 50 days. SMA20 vs SMA50 defines Golden or Death Cross.",          action: "Golden Cross: medium-term buy. Death Cross: medium-term sell." },
  EMA_20: { title: "EMA 20",                            what: "Like SMA 20 but weights recent prices more heavily — faster signal.",                 action: "Above EMA 20: use as trailing stop. Below: EMA acts as resistance." },
  EMA_50: { title: "EMA 50",                            what: "Medium-term momentum, reacts faster than SMA 50.",                                   action: "Deep pullback to EMA 50 in uptrend: high-quality buy setup." },
  BB:     { title: "Bollinger Bands (20, 2σ)",          what: "SMA 20 ± 2 standard deviations. Expand in volatile markets.",                       action: "Band squeeze: trade the breakout direction. Walking the band: strong trend." },
  ATR:    { title: "ATR (14)",                          what: "Average daily price range. No direction signal — pure volatility measure.",           action: "Stop-loss: set 1.5–2× ATR from entry. Position size: Risk ÷ ATR." },
  OBV:    { title: "OBV — On-Balance Volume",           what: "Cumulative volume flow.",                                                             action: "OBV rising, price flat: breakout brewing. OBV falling as price rises: bearish divergence." },
  STOCH:  { title: "Stochastic (14, 3, 3)",             what: "%K vs %D. Compares close to high-low range over 14 periods.",                        action: "%K crosses %D in oversold: buy. %K crosses %D in overbought: sell." },
};

// ── Day trade terms glossary data ───────────────────────────────────────────

const DAY_TRADE_GLOSSARY = [
  {
    heading: "Setup terms",
    items: [
      { term: "Entry",          def: "The price at which you open the trade. Shown as the current market price — wait for a confirmation candle before committing." },
      { term: "Stop Loss",      def: "Maximum loss you accept. If price reaches this level, exit immediately — no exceptions. Protects your capital from runaway losses." },
      { term: "Risk / Share",   def: "Dollar distance between entry and stop (Entry − Stop). Multiply by position size to get total dollar risk per trade." },
      { term: "T1 (Target 1)",  def: "First profit target. Take partial profits here (50–75% of position). Move your stop to breakeven once T1 is hit." },
      { term: "T2 (Target 2)",  def: "Extended profit target. Let the remaining position run with a trailing stop. Only reached when momentum is strong." },
      { term: "R:R Ratio",      def: "Risk-to-Reward ratio. 1:2 means you risk $1 to make $2. Aim for at least 1:1.5 — even a 50% win rate is profitable at 1:2." },
      { term: "ATR",            def: "Average True Range — average daily price swing over 14 days. Stops set at 1–1.5× ATR avoid being shaken out by normal volatility." },
      { term: "Position Size",  def: "Number of shares = (Account risk $) ÷ (Risk per share). E.g. risking $100 with a $2 stop → 50 shares." },
    ],
  },
  {
    heading: "Strategy concepts",
    items: [
      { term: "Momentum",       def: "Trade in the direction of current trend strength — MACD, RSI, and moving average alignment all pointing the same way. Enter early, exit before reversal." },
      { term: "Mean Reversion", def: "Price tends to return to its average after extremes. Buy oversold dips (RSI < 30, price at BB Lower), sell overbought spikes — target the BB midline." },
      { term: "Trend Follow",   def: "Enter on pullbacks within an established trend (Golden/Death Cross). Buy dips to EMA20 in an uptrend; sell rallies to EMA20 in a downtrend." },
      { term: "Breakout",       def: "Enter when price closes outside the Bollinger Bands after a squeeze (narrow bands). Targets project the full band-width beyond the breakout point." },
      { term: "BB Squeeze",     def: "Bollinger Bands narrowing below ~4% of price. Signals low volatility compression before an explosive directional move. Direction confirmed by MACD." },
    ],
  },
  {
    heading: "Signal terms",
    items: [
      { term: "Golden Cross",   def: "SMA 20 crosses above SMA 50. Medium-term bullish signal — uptrend likely to continue. Use pullbacks as long entries." },
      { term: "Death Cross",    def: "SMA 20 crosses below SMA 50. Medium-term bearish signal — downtrend likely to continue. Use rallies as short entries." },
      { term: "MACD Cross",     def: "MACD line crossing above/below the signal line. Bullish cross = buy pressure building. Histogram confirms: growing bars = strengthening, shrinking = fading." },
      { term: "RSI",            def: "0–100 momentum gauge. Above 70 = overbought (possible pullback). Below 30 = oversold (possible bounce). Best used at extremes, not mid-range." },
      { term: "Confirmation",   def: "A candle that closes in the intended direction after a signal. Always wait for a confirmed close — entering on a wick can be a false signal." },
      { term: "Trailing Stop",  def: "A stop that moves with the price to lock in profits. Once T1 is hit, move stop to breakeven; after T2, trail by 0.5–1× ATR below each higher close." },
    ],
  },
];

// ── Shared collapsible block ─────────────────────────────────────────────────

function GlossaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-light-border dark:border-dark-border">
      <summary className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer rounded-xl bg-light-bg2 dark:bg-dark-bg2 hover:bg-slate-50 dark:hover:bg-[#1a2540] list-none select-none">
        {title}
      </summary>
      <div className="p-3 space-y-2 bg-light-bg2 dark:bg-dark-bg2 rounded-b-xl">
        {children}
      </div>
    </details>
  );
}

// ── Trade note ───────────────────────────────────────────────────────────────

interface TradeAdvice {
  bias:       "bullish" | "bearish";
  narrative:  string;
  entry:      number;
  accumulate: number;
  stop:       number;
  t1:         number;
  t2:         number;
}

function buildTradeAdvice(
  ticker: string,
  info: TickerInfo,
  summary: IndicatorSummary
): TradeAdvice | null {
  const price = summary.close;
  if (!price) return null;

  const name   = (info.longName as string | undefined) || ticker;
  const atr    = (summary.ATR as number | null) ?? price * 0.02;
  const rsi    = summary.RSI    as number | null;
  const macd   = summary.MACD   as number | null;
  const macdS  = summary.MACD_Signal as number | null;
  const sma20  = summary.SMA_20 as number | null;
  const sma50  = summary.SMA_50 as number | null;
  const ema20  = summary.EMA_20 as number | null;
  const trend  = summary.price_trend_5d;
  const vol    = summary.volume_trend;

  let bull = 0, bear = 0;
  if (rsi  !== null) { if (rsi  > 55) bull++; else if (rsi  < 45) bear++; }
  if (macd !== null && macdS !== null) { if (macd > macdS) bull++; else bear++; }
  if (sma20 !== null && sma50 !== null) { if (sma20 > sma50) bull++; else bear++; }
  if (sma20 !== null) { if (price > sma20) bull++; else bear++; }
  if (trend === "up") bull++; else if (trend === "down") bear++;

  const isBull = bull >= bear;
  const f = (n: number) => `$${n.toFixed(2)}`;

  const maLabel = sma20
    ? `20-day moving average (${f(sma20)})`
    : ema20 ? `20-day EMA (${f(ema20)})` : "key moving average";

  if (isBull) {
    const entry      = price;
    const accumulate = +(price - atr * 0.5).toFixed(2);
    const stop       = +(price - atr * 1.5).toFixed(2);
    const t1         = +(price + atr * 2.0).toFixed(2);
    const t2         = +(price + atr * 4.0).toFixed(2);
    const mid        = +((t1 + t2) / 2).toFixed(2);

    const open = trend === "up"
      ? `${name} has been gaining strength, with price action indicating continued upward momentum.`
      : trend === "down"
      ? `${name} has been pulling back recently, potentially offering an entry opportunity ahead of a recovery.`
      : `${name} has been consolidating, with technical indicators pointing toward a potential upside move.`;

    const confirms: string[] = [];
    if (sma20 && price > sma20)              confirms.push(`price is trading above the ${maLabel}, indicating bullishness`);
    if (rsi   && rsi  > 50)                  confirms.push(`RSI at ${rsi.toFixed(0)} shows healthy momentum`);
    if (macd  && macdS && macd > macdS)      confirms.push(`MACD is showing a bullish crossover`);
    if (sma20 && sma50 && sma20 > sma50)     confirms.push(`a golden cross formation reinforces the uptrend`);
    if (vol === "rising")                    confirms.push(`rising volume supports the move`);

    const tech = confirms.length
      ? confirms.slice(0, 2)
          .map((c, i) => i === 0 ? c[0].toUpperCase() + c.slice(1) : c)
          .join(", and ") + ". "
      : "";

    const narrative =
      `${open} ${tech}Going ahead, we expect the rally to gain further momentum, ` +
      `potentially lifting the stock to ${f(t2)} in the near-term. ` +
      `Therefore, participants can consider buying at ${f(entry)} and accumulate if the price dips to ${f(accumulate)}. ` +
      `Place stop-loss at ${f(stop)}. ` +
      `When the price touches ${f(t1)}, raise the stop-loss to ${f(entry)}. ` +
      `Tighten the stop-loss to ${f(+(stop + (entry - stop) * 0.85).toFixed(2))} when the stock hits ${f(mid)}. ` +
      `Book profits at ${f(t2)}.`;

    return { bias: "bullish", narrative, entry, accumulate, stop, t1, t2 };
  } else {
    const entry      = price;
    const accumulate = +(price + atr * 0.5).toFixed(2);
    const stop       = +(price + atr * 1.5).toFixed(2);
    const t1         = +(price - atr * 2.0).toFixed(2);
    const t2         = +(price - atr * 4.0).toFixed(2);

    const open = trend === "down"
      ? `${name} has been under sustained selling pressure, with the price action showing continued weakness.`
      : trend === "up"
      ? `${name} has been rallying into resistance, and indicators suggest the upside may be limited.`
      : `${name} has been struggling to hold key levels, with indicators pointing toward further downside.`;

    const confirms: string[] = [];
    if (sma20 && price < sma20)             confirms.push(`price has slipped below the ${maLabel}, indicating weakness`);
    if (rsi   && rsi  < 50)                 confirms.push(`RSI at ${rsi.toFixed(0)} reflects bearish momentum`);
    if (macd  && macdS && macd < macdS)     confirms.push(`MACD is showing a bearish crossover`);
    if (sma20 && sma50 && sma20 < sma50)    confirms.push(`a death cross formation reinforces the downtrend`);

    const tech = confirms.length
      ? confirms.slice(0, 2)
          .map((c, i) => i === 0 ? c[0].toUpperCase() + c.slice(1) : c)
          .join(", and ") + ". "
      : "";

    const narrative =
      `${open} ${tech}Going ahead, we expect the selling pressure to persist, ` +
      `potentially dragging the stock to ${f(t2)} in the near-term. ` +
      `Therefore, participants can consider selling at ${f(entry)} and add on any rallies to ${f(accumulate)}. ` +
      `Place stop-loss at ${f(stop)}. ` +
      `When the price falls to ${f(t1)}, lower the stop-loss to ${f(entry)}. ` +
      `Book profits at ${f(t2)}.`;

    return { bias: "bearish", narrative, entry, accumulate, stop, t1, t2 };
  }
}

function TradeNoteCard({ advice }: { advice: TradeAdvice }) {
  const bull = advice.bias === "bullish";
  const f    = (n: number) => `$${n.toFixed(2)}`;

  const levels = bull
    ? [
        { label: "Buy",        value: f(advice.entry),      color: "text-emerald-600 dark:text-[#00FF9D]" },
        { label: "Accumulate", value: f(advice.accumulate), color: "text-emerald-600 dark:text-[#00FF9D]" },
        { label: "Stop",       value: f(advice.stop),       color: "text-red-600 dark:text-[#FF0055]"     },
        { label: "Target 1",   value: f(advice.t1),         color: "text-sky-600 dark:text-[#00C8FF]"     },
        { label: "Target 2",   value: f(advice.t2),         color: "text-sky-600 dark:text-[#00C8FF]"     },
      ]
    : [
        { label: "Sell",       value: f(advice.entry),      color: "text-red-600 dark:text-[#FF0055]"     },
        { label: "Add",        value: f(advice.accumulate), color: "text-red-600 dark:text-[#FF0055]"     },
        { label: "Stop",       value: f(advice.stop),       color: "text-emerald-600 dark:text-[#00FF9D]" },
        { label: "Target 1",   value: f(advice.t1),         color: "text-sky-600 dark:text-[#00C8FF]"     },
        { label: "Target 2",   value: f(advice.t2),         color: "text-sky-600 dark:text-[#00C8FF]"     },
      ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <CardTitle>📝 Trade Note</CardTitle>
        <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full border ${
          bull
            ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D12] dark:border-[#00FF9D33] dark:text-[#00FF9D]"
            : "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005512] dark:border-[#FF005533] dark:text-[#FF0055]"
        }`}>
          {bull ? "BULLISH SETUP" : "BEARISH SETUP"}
        </span>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
        {advice.narrative}
      </p>

      <div className="grid grid-cols-5 gap-1.5">
        {levels.map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center gap-0.5 rounded-lg bg-light-bg3 dark:bg-dark-bg3 px-1.5 py-2 border border-light-border dark:border-dark-border">
            <span className="text-[0.55rem] font-bold uppercase tracking-wider text-slate-400">{label}</span>
            <span className={`text-[0.7rem] font-bold font-mono ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      <p className="text-[0.6rem] text-slate-400 mt-2.5 leading-relaxed">
        ⚠️ Rule-based levels derived from ATR. Not financial advice — confirm with your own analysis before trading.
      </p>
    </Card>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AnalysisPanel({ ticker, info, news, summary }: Props) {
  const tradeAdvice = buildTradeAdvice(ticker, info, summary);
  const [activeTab, setActiveTab] = useState<Tab>("🔍 Analysis");
  const [apiKey, setApiKey]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<AIAnalysis | null>(null);
  const [error, setError]       = useState("");

  async function handleAnalyse() {
    if (!apiKey) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await runAnalysis(ticker, summary as Record<string, unknown>, apiKey);
      setResult(res as unknown as AIAnalysis);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg2 dark:bg-dark-bg2 h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-light-border dark:border-dark-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-[0.75rem] font-medium py-2.5 px-2 transition-colors ${
              activeTab === tab
                ? "text-sky-600 border-b-2 border-sky-600 bg-white dark:bg-dark-bg2 dark:text-[#00C8FF] dark:border-[#00C8FF]"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-4 lg:overflow-y-auto lg:max-h-[calc(100vh-180px)]">

        {/* ── Analysis Tab ─────────────────────────────────────────────────── */}
        {activeTab === "🔍 Analysis" && (
          <div className="space-y-4 animate-fade-in">

            {/* Analyst consensus */}
            {info.targetMeanPrice && (
              <Card>
                <CardTitle>Analyst Consensus</CardTitle>
                {[
                  ["Analysts",      info.numberOfAnalystOpinions?.toString() ?? "—"],
                  ["Consensus",     (info.recommendationKey as string | undefined)?.replace("_", " ").toUpperCase() ?? "—"],
                  ["Price Target",  `$${(info.targetMeanPrice as number).toFixed(2)}`],
                  ["High Target",   info.targetHighPrice ? `$${(info.targetHighPrice as number).toFixed(2)}` : null],
                  ["Low Target",    info.targetLowPrice  ? `$${(info.targetLowPrice  as number).toFixed(2)}` : null],
                ].filter(([, v]) => v != null).map(([l, v]) => (
                  <div key={l as string} className="flex justify-between py-1.5 border-b border-slate-200 dark:border-dark-border last:border-0 text-sm">
                    <span className="text-slate-500 text-xs">{l}</span>
                    <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">{v}</span>
                  </div>
                ))}
              </Card>
            )}

            {/* Trade note */}
            {tradeAdvice && <TradeNoteCard advice={tradeAdvice} />}

            {/* AI analysis */}
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                AI Trade Signal
              </p>
              <input
                type="password"
                placeholder="Anthropic API key (sk-ant-…)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg3 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-[#00C8FF] mb-2"
              />
              <button
                onClick={handleAnalyse}
                disabled={!apiKey || loading}
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-sky-600 bg-sky-50 border border-sky-300 hover:bg-sky-100 dark:text-[#00C8FF] dark:bg-[#00C8FF1A] dark:border-[#00C8FF55] dark:hover:bg-[#00C8FF2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Claude is analysing…" : "🤖  Analyse with Claude"}
              </button>
              {error && <p className="text-red-600 dark:text-[#FF0055] text-xs mt-2">{error}</p>}
            </div>

            {result && (
              <Card className="animate-fade-in">
                <div className="flex items-start gap-4 flex-wrap mb-3">
                  <div className={`text-xl font-bold font-mono px-5 py-2.5 rounded-xl border ${
                    result.signal === "BUY"  ? "bg-emerald-50 border-emerald-300 text-emerald-600 dark:bg-[#00FF9D15] dark:border-[#00FF9D55] dark:text-[#00FF9D]"
                    : result.signal === "SELL" ? "bg-red-50 border-red-300 text-red-600 dark:bg-[#FF005515] dark:border-[#FF005555] dark:text-[#FF0055]"
                    : "bg-sky-50 border-sky-300 text-sky-600 dark:bg-[#00C8FF10] dark:border-[#00C8FF40] dark:text-[#00C8FF]"
                  }`}>
                    {result.signal}
                  </div>
                  <div>
                    <p className="text-[0.65rem] text-slate-500 mb-0.5">Bias</p>
                    <p className={`font-semibold ${
                      result.bias === "Bullish" ? "text-emerald-600 dark:text-[#00FF9D]" : result.bias === "Bearish" ? "text-red-600 dark:text-[#FF0055]" : "text-sky-600 dark:text-[#00C8FF]"
                    }`}>{result.bias}</p>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <p className="text-[0.65rem] text-slate-500 mb-1">Confidence — {result.confidence}%</p>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-[#1a2540] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${result.confidence}%`,
                          background: result.confidence >= 65 ? "var(--color-bull)" : result.confidence >= 45 ? "#fbbf24" : "var(--color-bear)"
                        }}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{result.summary}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {result.key_factors.map((f, i) => (
                    <span key={i} className="text-[0.7rem] px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-600 dark:bg-[#00C8FF11] dark:border-[#00C8FF33] dark:text-[#00C8FF]">{f}</span>
                  ))}
                </div>
                {result.risk_note && (
                  <div className="text-[0.72rem] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:text-[#FF0055CC] dark:bg-[#FF005508] dark:border-[#FF005533]">
                    ⚠️ {result.risk_note}
                  </div>
                )}
              </Card>
            )}

            {/* Indicator glossary */}
            <GlossaryBlock title="📖 Indicator glossary">
              {Object.entries(GLOSSARY).map(([key, g]) => (
                <div key={key} className="rounded-lg border border-light-border dark:border-dark-border bg-light-bg3 dark:bg-dark-bg3 p-3">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">{g.title}</p>
                  <p className="text-[0.7rem] text-slate-500 leading-relaxed mb-2">{g.what}</p>
                  <p className="text-[0.7rem] text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-dark-border pt-2"
                     dangerouslySetInnerHTML={{ __html: g.action }} />
                </div>
              ))}
            </GlossaryBlock>

            {/* Day trade terms glossary */}
            <GlossaryBlock title="📋 Day trade terms glossary">
              {DAY_TRADE_GLOSSARY.map(({ heading, items }) => (
                <div key={heading}>
                  <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400 mb-2 mt-1">
                    {heading}
                  </p>
                  <div className="space-y-2">
                    {items.map(({ term, def }) => (
                      <div key={term} className="rounded-lg border border-light-border dark:border-dark-border bg-light-bg3 dark:bg-dark-bg3 px-3 py-2.5">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">{term}</p>
                        <p className="text-[0.7rem] text-slate-500 leading-relaxed">{def}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </GlossaryBlock>
          </div>
        )}

        {/* ── News Tab ────────────────────────────────────────────────────── */}
        {activeTab === "📰 News" && (
          <div className="animate-fade-in">
            {news.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8">No recent news for {ticker}.</p>
            ) : (() => {
              const scored = news.map((item) => ({ item, sentiment: scoreSentiment(item.title) }));
              const bullCount = scored.filter((s) => s.sentiment === "bullish").length;
              const bearCount = scored.filter((s) => s.sentiment === "bearish").length;
              const neutCount = scored.filter((s) => s.sentiment === "neutral").length;
              const total     = scored.length;

              return (
                <>
                  {/* Aggregate bar */}
                  <div className="mb-4 rounded-xl border border-light-border dark:border-dark-border bg-light-bg3 dark:bg-dark-bg3 p-3">
                    <div className="flex gap-2 mb-2.5 flex-wrap">
                      <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-[#00FF9D12] dark:border-[#00FF9D33] dark:text-[#00FF9D]">
                        ▲ {bullCount} Bullish
                      </span>
                      <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 dark:bg-[#FF005512] dark:border-[#FF005533] dark:text-[#FF0055]">
                        ▼ {bearCount} Bearish
                      </span>
                      <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 dark:bg-[#1a2540] dark:border-[#243050] dark:text-slate-400">
                        — {neutCount} Neutral
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-[#1a2540] overflow-hidden flex">
                      <div className="h-full bg-emerald-500 dark:bg-[#00FF9D] transition-all" style={{ width: `${(bullCount / total) * 100}%` }} />
                      <div className="h-full bg-red-500 dark:bg-[#FF0055] transition-all"     style={{ width: `${(bearCount / total) * 100}%` }} />
                    </div>
                  </div>

                  {/* News list */}
                  <div className="space-y-0">
                    {scored.map(({ item, sentiment }, i) => (
                      <div key={i} className="flex gap-3 py-3 border-b border-slate-200 dark:border-dark-border last:border-0">
                        <span className={`mt-0.5 shrink-0 text-[0.55rem] font-bold px-1.5 py-0.5 rounded border h-fit ${
                          sentiment === "bullish"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D12] dark:border-[#00FF9D33] dark:text-[#00FF9D]"
                            : sentiment === "bearish"
                            ? "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005512] dark:border-[#FF005533] dark:text-[#FF0055]"
                            : "bg-slate-100 border-slate-200 text-slate-400 dark:bg-[#1a2540] dark:border-[#243050] dark:text-slate-500"
                        }`}>
                          {sentiment === "bullish" ? "BULL" : sentiment === "bearish" ? "BEAR" : "NEUT"}
                        </span>
                        <div className="min-w-0">
                          <a
                            href={item.link ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug hover:text-sky-600 dark:hover:text-[#00C8FF] transition-colors block mb-1"
                          >
                            {item.title}
                          </a>
                          <div className="flex gap-2 text-[0.63rem] text-slate-400">
                            {item.publisher && <span className="text-sky-600 dark:text-[#00C8FF] font-semibold">{item.publisher}</span>}
                            {item.providerPublishTime && (
                              <span>{new Date(item.providerPublishTime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
