"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { fetchBacktest } from "@/lib/api";
import type { BacktestResult, BacktestTrade, BacktestMetrics } from "@/lib/types";
import { useTheme } from "next-themes";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// ── Constants ─────────────────────────────────────────────────────────────────

type StrategyKey = "momentum" | "mean_reversion" | "trend" | "breakout"
  | "swing_pullback" | "swing_reversal" | "swing_golden_cross";

const STRATEGIES: Record<StrategyKey, { label: string; icon: string; group: "day" | "swing" }> = {
  momentum:          { label: "Momentum",       icon: "⚡",  group: "day"   },
  mean_reversion:    { label: "Mean Rev.",       icon: "↩️",  group: "day"   },
  trend:             { label: "Trend Follow",    icon: "📈",  group: "day"   },
  breakout:          { label: "Breakout",        icon: "🚀",  group: "day"   },
  swing_pullback:    { label: "Swing Pullback",  icon: "↩️",  group: "swing" },
  swing_reversal:    { label: "Swing Reversal",  icon: "🔄",  group: "swing" },
  swing_golden_cross:{ label: "Golden X Ride",   icon: "✨",  group: "swing" },
};

const PERIODS: { label: string; days: number }[] = [
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
];

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, positive,
}: { label: string; value: string; sub?: string; positive?: boolean }) {
  const color =
    positive === true  ? "text-emerald-600 dark:text-[#00FF9D]" :
    positive === false ? "text-red-600 dark:text-[#FF0055]"     :
    "text-slate-800 dark:text-slate-200";

  return (
    <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg2 dark:bg-dark-bg2 p-3">
      <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono leading-tight ${color}`}>{value}</p>
      {sub && <p className="text-[0.65rem] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Equity curve chart ────────────────────────────────────────────────────────

function EquityChart({
  curve, light,
}: { curve: { date: string; value: number }[]; light: boolean }) {
  const bg     = light ? "#f8fafc" : "#0e1117";
  const grid   = light ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.06)";
  const text   = light ? "#1e293b" : "#e0e0e0";
  const line   = light ? "#0284C7" : "#00C8FF";
  const fill   = light ? "rgba(2,132,199,0.08)" : "rgba(0,200,255,0.08)";
  const zero   = light ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.25)";

  const dates  = curve.map((p) => p.date);
  const values = curve.map((p) => p.value);

  const data: Plotly.Data[] = [
    {
      x: dates,
      y: values,
      type: "scatter",
      mode: "lines",
      name: "Portfolio",
      line: { color: line, width: 2 },
      fill: "tozeroy",
      fillcolor: fill,
    } as Plotly.Data,
  ];

  const layout: Partial<Plotly.Layout> = {
    paper_bgcolor: bg,
    plot_bgcolor:  bg,
    font: { color: text, family: "Space Grotesk, Inter, system-ui, sans-serif", size: 11 },
    margin: { l: 8, r: 8, t: 8, b: 8 },
    height: 220,
    xaxis: { showgrid: true, gridcolor: grid, color: text, rangeslider: { visible: false } },
    yaxis: { showgrid: true, gridcolor: grid, color: text },
    shapes: [{
      type: "line", x0: dates[0], x1: dates[dates.length - 1],
      y0: 100, y1: 100,
      line: { color: zero, dash: "dash", width: 1 },
    }],
    hovermode: "x unified",
    showlegend: false,
    dragmode: "pan",
  };

  return (
    <Plot
      data={data}
      layout={layout}
      config={{ displayModeBar: false, scrollZoom: true }}
      style={{ width: "100%" }}
    />
  );
}

// ── Trade table ───────────────────────────────────────────────────────────────

function TradeRow({ trade, i }: { trade: BacktestTrade; i: number }) {
  const win   = trade.pnl_pct > 0;
  const isLong = trade.direction === "LONG";
  return (
    <tr className={i % 2 === 0 ? "bg-light-bg2 dark:bg-dark-bg2" : "bg-light-bg3 dark:bg-dark-bg3"}>
      <td className="px-3 py-2 text-[0.72rem] font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {trade.entry_date}
      </td>
      <td className="px-3 py-2">
        <span className={`text-[0.68rem] font-bold ${isLong ? "text-emerald-600 dark:text-[#00FF9D]" : "text-red-600 dark:text-[#FF0055]"}`}>
          {isLong ? "▲ LONG" : "▼ SHORT"}
        </span>
      </td>
      <td className="px-3 py-2 text-[0.72rem] font-mono text-slate-700 dark:text-slate-300 text-right">
        ${trade.entry_price.toFixed(2)}
      </td>
      <td className="px-3 py-2 text-[0.72rem] font-mono text-slate-700 dark:text-slate-300 text-right">
        ${trade.exit_price.toFixed(2)}
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`text-[0.62rem] font-semibold px-1.5 py-0.5 rounded border ${
          trade.exit_reason === "TARGET"
            ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D15] dark:border-[#00FF9D40] dark:text-[#00FF9D]"
            : trade.exit_reason === "STOP"
            ? "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005515] dark:border-[#FF005540] dark:text-[#FF0055]"
            : "bg-slate-100 border-slate-200 text-slate-500 dark:bg-[#1a2540] dark:border-[#243050] dark:text-slate-400"
        }`}>
          {trade.exit_reason}
        </span>
      </td>
      <td className={`px-3 py-2 text-[0.75rem] font-bold font-mono text-right ${win ? "text-emerald-600 dark:text-[#00FF9D]" : "text-red-600 dark:text-[#FF0055]"}`}>
        {win ? "+" : ""}{trade.pnl_pct.toFixed(2)}%
      </td>
      <td className="px-3 py-2 text-[0.68rem] text-slate-500 text-center">
        {trade.holding_days}d
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BacktestPanel() {
  const { theme }  = useTheme();
  const light      = theme === "light";

  const [ticker,   setTicker]   = useState("AAPL");
  const [input,    setInput]    = useState("AAPL");
  const [strategy, setStrategy] = useState<StrategyKey>("momentum");
  const [period,   setPeriod]   = useState(365);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [result,   setResult]   = useState<BacktestResult | null>(null);

  async function handleRun() {
    const t = input.trim().toUpperCase();
    if (!t) return;
    setTicker(t);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await fetchBacktest(t, strategy, period);
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const m: BacktestMetrics | null = result?.metrics ?? null;

  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Strategy Backtest
      </p>

      {/* Controls */}
      <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg2 dark:bg-dark-bg2 p-4 space-y-3">
        {/* Ticker + run */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleRun()}
            placeholder="AAPL, TSLA…"
            className="flex-1 px-4 py-2 rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg3 text-slate-800 dark:text-slate-200 font-mono text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-[#00C8FF]"
          />
          <button
            onClick={handleRun}
            disabled={loading || !input}
            className="px-5 py-2 rounded-xl font-semibold text-sm bg-sky-50 border border-sky-300 text-sky-600 hover:bg-sky-100 dark:bg-[#00C8FF1A] dark:border-[#00C8FF55] dark:text-[#00C8FF] dark:hover:bg-[#00C8FF2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Running…" : "▶ Run"}
          </button>
        </div>

        {/* Strategy tabs */}
        {(["day", "swing"] as const).map((group) => (
          <div key={group}>
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
              {group === "day" ? "Day Trade" : "Swing Trade (3–20 days)"}
            </p>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {(Object.keys(STRATEGIES) as StrategyKey[])
                .filter((k) => STRATEGIES[k].group === group)
                .map((key) => {
                  const s      = STRATEGIES[key];
                  const active = key === strategy;
                  return (
                    <button
                      key={key}
                      onClick={() => setStrategy(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[0.72rem] font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? "bg-sky-50 border-sky-300 text-sky-600 dark:bg-[#00C8FF1A] dark:border-[#00C8FF55] dark:text-[#00C8FF]"
                          : "border-light-border dark:border-dark-border text-slate-500 hover:border-sky-300 hover:text-sky-600 dark:hover:border-[#00C8FF44] dark:hover:text-[#00C8FF] bg-white dark:bg-dark-bg3"
                      }`}
                    >
                      <span>{s.icon}</span><span>{s.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}

        {/* Period selector */}
        <div className="flex gap-1.5">
          {PERIODS.map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setPeriod(days)}
              className={`px-3.5 py-1.5 rounded-md text-[0.72rem] font-semibold font-mono border transition-colors ${
                period === days
                  ? "bg-sky-50 border-sky-300 text-sky-600 dark:bg-[#00C8FF1A] dark:border-[#00C8FF55] dark:text-[#00C8FF]"
                  : "border-light-border dark:border-dark-border text-slate-500 hover:border-sky-300 hover:text-sky-600 dark:hover:border-[#00C8FF44] dark:hover:text-[#00C8FF]"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[0.68rem] text-slate-400 self-center italic">
            Signal entry · 1:1 R:R · ATR stops
          </span>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 dark:bg-[#FF005510] dark:border-[#FF005533] dark:text-[#FF0055] text-sm">
          ❌ {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-500 text-sm">
          <div className="inline-block animate-spin mr-2">⚙️</div>
          Running backtest on {ticker}…
        </div>
      )}

      {result && !loading && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {result.ticker} · {STRATEGIES[result.strategy as StrategyKey]?.icon}{" "}
                {STRATEGIES[result.strategy as StrategyKey]?.label}
              </p>
              <p className="text-[0.65rem] text-slate-500 mt-0.5">
                {PERIODS.find((p) => p.days === result.period_days)?.label ?? `${result.period_days}d`} period ·{" "}
                {result.trades.length} trade{result.trades.length !== 1 ? "s" : ""} simulated
              </p>
            </div>
            {m && (
              <span className={`text-sm font-bold font-mono px-3 py-1 rounded-lg border ${
                m.total_return_pct >= 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D15] dark:border-[#00FF9D40] dark:text-[#00FF9D]"
                  : "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005515] dark:border-[#FF005540] dark:text-[#FF0055]"
              }`}>
                {m.total_return_pct >= 0 ? "+" : ""}{m.total_return_pct.toFixed(1)}% total
              </span>
            )}
          </div>

          {m && m.total_trades === 0 ? (
            <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg2 dark:bg-dark-bg2 p-8 text-center text-slate-500">
              <p className="text-2xl mb-2">🔍</p>
              <p className="font-semibold mb-1">No trades generated</p>
              <p className="text-sm">This strategy found no qualifying setups in the selected period. Try a longer period or a different strategy.</p>
            </div>
          ) : (
            <>
              {/* Metrics grid */}
              {m && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  <MetricCard label="Trades"        value={String(m.total_trades)} />
                  <MetricCard label="Win Rate"      value={`${(m.win_rate * 100).toFixed(0)}%`}
                    positive={m.win_rate >= 0.5} />
                  <MetricCard label="Avg Win"       value={`+${m.avg_win_pct.toFixed(2)}%`}
                    positive={true} />
                  <MetricCard label="Avg Loss"      value={`${m.avg_loss_pct.toFixed(2)}%`}
                    positive={false} />
                  <MetricCard label="Profit Factor" value={m.profit_factor.toFixed(2)}
                    positive={m.profit_factor >= 1} />
                  <MetricCard label="Max Drawdown"  value={`${m.max_drawdown_pct.toFixed(1)}%`}
                    positive={m.max_drawdown_pct > -10} />
                  <MetricCard label="Total Return"  value={`${m.total_return_pct >= 0 ? "+" : ""}${m.total_return_pct.toFixed(1)}%`}
                    positive={m.total_return_pct >= 0} />
                </div>
              )}

              {/* Equity curve */}
              {result.equity_curve.length > 1 && (
                <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg2 dark:bg-dark-bg2 overflow-hidden">
                  <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 px-4 pt-3 pb-1">
                    Equity Curve — Portfolio Value (Base 100)
                  </p>
                  <EquityChart curve={result.equity_curve} light={light} />
                </div>
              )}

              {/* Trade log */}
              {result.trades.length > 0 && (
                <div className="rounded-xl border border-light-border dark:border-dark-border overflow-hidden">
                  <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 px-4 pt-3 pb-2 bg-light-bg2 dark:bg-dark-bg2">
                    Trade Log · {result.trades.length} trades
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-dark-bg3 border-b border-light-border dark:border-dark-border">
                          {([
                            ["Entry Date", "text-left"],
                            ["Dir",        "text-left"],
                            ["Entry $",    "text-right"],
                            ["Exit $",     "text-right"],
                            ["Reason",     "text-center"],
                            ["P&L",        "text-right"],
                            ["Hold",       "text-center"],
                          ] as [string, string][]).map(([h, align]) => (
                            <th key={h} className={`px-3 py-2 text-[0.6rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap ${align}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-light-border dark:divide-dark-border">
                        {result.trades.map((trade, i) => (
                          <TradeRow key={i} trade={trade} i={i} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2 bg-light-bg2 dark:bg-dark-bg2 border-t border-light-border dark:border-dark-border text-[0.65rem] text-slate-400">
                    STOP = hit stop loss · TARGET = hit 1:1 R:R target · TIMEOUT = closed after {15} days
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
