"use client";

import { useState } from "react";
import { fetchScreener, addToWatchlist } from "@/lib/api";
import type { ScreenerFilters, ScreenerResult, ScreenerRow } from "@/lib/types";

// ── Filter definitions ────────────────────────────────────────────────────────

const FILTER_GROUPS: {
  key: keyof ScreenerFilters;
  label: string;
  options: { value: string; label: string; desc: string }[];
}[] = [
  {
    key: "signals",
    label: "Signal",
    options: [
      { value: "BUY",  label: "BUY",  desc: "Majority of RSI, MACD & SMA are bullish" },
      { value: "SELL", label: "SELL", desc: "Majority of RSI, MACD & SMA are bearish" },
      { value: "HOLD", label: "HOLD", desc: "Mixed or inconclusive indicators" },
    ],
  },
  {
    key: "rsi",
    label: "RSI Range",
    options: [
      { value: "oversold",   label: "Oversold (<30)",      desc: "High-probability bounce zone" },
      { value: "midlow",     label: "Approaching (<45)",   desc: "Entering bullish territory" },
      { value: "neutral",    label: "Neutral (45–55)",     desc: "No clear RSI edge" },
      { value: "midhigh",    label: "Elevated (>55)",      desc: "Entering bearish territory" },
      { value: "overbought", label: "Overbought (>70)",    desc: "Pullback risk zone" },
    ],
  },
  {
    key: "macd",
    label: "MACD",
    options: [
      { value: "Bull", label: "Bullish cross", desc: "MACD above signal line — upward momentum" },
      { value: "Bear", label: "Bearish cross", desc: "MACD below signal line — downward pressure" },
    ],
  },
  {
    key: "sma_cross",
    label: "Moving Avg",
    options: [
      { value: "Golden", label: "Golden Cross", desc: "SMA20 > SMA50 — medium-term uptrend" },
      { value: "Death",  label: "Death Cross",  desc: "SMA20 < SMA50 — medium-term downtrend" },
    ],
  },
  {
    key: "day_change",
    label: "Day Change",
    options: [
      { value: "positive",    label: "Up day (>0%)",     desc: "Positive close vs yesterday" },
      { value: "strong_up",   label: "Strong up (>2%)",  desc: "Notable intraday strength" },
      { value: "negative",    label: "Down day (<0%)",   desc: "Negative close vs yesterday" },
      { value: "strong_down", label: "Strong down (<−2%)", desc: "Notable intraday weakness" },
    ],
  },
];

const EMPTY_FILTERS: ScreenerFilters = {
  signals: [], rsi: [], macd: [], sma_cross: [], day_change: [],
};

// ── Result row ────────────────────────────────────────────────────────────────

function ResultRow({
  row, onAnalyse,
}: { row: ScreenerRow; onAnalyse: (t: string) => void }) {
  const [added, setAdded] = useState(false);
  const up = (row.pct ?? 0) >= 0;

  async function handleAdd() {
    await addToWatchlist(row.ticker);
    setAdded(true);
  }

  return (
    <tr className="border-b border-light-border dark:border-dark-border hover:bg-slate-50 dark:hover:bg-[#0D1420] transition-colors group">
      {/* Ticker */}
      <td className="px-4 py-3">
        <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
          {row.ticker}
        </span>
      </td>

      {/* Price */}
      <td className="px-3 py-3 text-sm font-mono text-right text-slate-700 dark:text-slate-300">
        {row.price != null ? `$${row.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
      </td>

      {/* Day % */}
      <td className="px-3 py-3 text-right">
        {row.pct != null ? (
          <span className={`text-sm font-semibold font-mono ${up ? "text-emerald-600 dark:text-[#00FF9D]" : "text-red-600 dark:text-[#FF0055]"}`}>
            {up ? "▲" : "▼"} {Math.abs(row.pct).toFixed(2)}%
          </span>
        ) : <span className="text-slate-400">—</span>}
      </td>

      {/* Signal */}
      <td className="px-3 py-3 text-center">
        <span className={`text-[0.68rem] font-bold px-2 py-0.5 rounded border ${
          row.signal === "BUY"
            ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D15] dark:border-[#00FF9D40] dark:text-[#00FF9D]"
            : row.signal === "SELL"
            ? "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005515] dark:border-[#FF005540] dark:text-[#FF0055]"
            : "bg-slate-100 border-slate-200 text-slate-500 dark:bg-[#1a2540] dark:border-[#243050] dark:text-slate-400"
        }`}>
          {row.signal}
        </span>
      </td>

      {/* RSI */}
      <td className="px-3 py-3 text-center">
        {row.rsi != null ? (
          <span className={`text-sm font-semibold font-mono ${
            row.rsi < 30 ? "text-emerald-600 dark:text-[#00FF9D]"
            : row.rsi > 70 ? "text-red-600 dark:text-[#FF0055]"
            : "text-slate-600 dark:text-slate-400"
          }`}>
            {row.rsi.toFixed(1)}
          </span>
        ) : <span className="text-slate-400">—</span>}
      </td>

      {/* MACD */}
      <td className="px-3 py-3 text-center">
        {row.macd_cross ? (
          <span className={`text-[0.65rem] font-semibold px-1.5 py-0.5 rounded border ${
            row.macd_cross === "Bull"
              ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D15] dark:border-[#00FF9D40] dark:text-[#00FF9D]"
              : "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005515] dark:border-[#FF005540] dark:text-[#FF0055]"
          }`}>
            {row.macd_cross === "Bull" ? "↑ Bull" : "↓ Bear"}
          </span>
        ) : <span className="text-slate-400 text-xs">—</span>}
      </td>

      {/* SMA Cross */}
      <td className="px-3 py-3 text-center">
        {row.sma_cross ? (
          <span className={`text-[0.65rem] font-semibold px-1.5 py-0.5 rounded border ${
            row.sma_cross === "Golden"
              ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D15] dark:border-[#00FF9D40] dark:text-[#00FF9D]"
              : "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005515] dark:border-[#FF005540] dark:text-[#FF0055]"
          }`}>
            {row.sma_cross === "Golden" ? "✦ Golden" : "✗ Death"}
          </span>
        ) : <span className="text-slate-400 text-xs">—</span>}
      </td>

      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAnalyse(row.ticker)}
            className="text-xs px-2.5 py-1 rounded-lg border border-sky-300 text-sky-600 bg-sky-50 hover:bg-sky-100 dark:border-[#00C8FF55] dark:text-[#00C8FF] dark:bg-[#00C8FF0A] dark:hover:bg-[#00C8FF15] transition-colors font-semibold"
          >
            Analyse →
          </button>
          <button
            onClick={handleAdd}
            disabled={added}
            className="text-xs px-2 py-1 rounded-lg border border-light-border dark:border-dark-border text-slate-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:text-[#00FF9D] dark:hover:border-[#00FF9D44] dark:hover:bg-[#00FF9D0A] disabled:opacity-40 transition-colors"
            title="Add to watchlist"
          >
            {added ? "✓" : "+"}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Filter checkbox ───────────────────────────────────────────────────────────

function FilterCheckbox({
  checked, onChange, label, desc,
}: { checked: boolean; onChange: () => void; label: string; desc: string }) {
  return (
    <label className="flex items-start gap-2 py-1.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 shrink-0 accent-sky-600 dark:accent-[#00C8FF] cursor-pointer"
      />
      <div>
        <p className={`text-[0.78rem] font-semibold leading-tight transition-colors ${
          checked ? "text-sky-600 dark:text-[#00C8FF]" : "text-slate-700 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-[#00C8FF]"
        }`}>{label}</p>
        <p className="text-[0.67rem] text-slate-400 dark:text-slate-500 leading-snug">{desc}</p>
      </div>
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { onAnalyse: (ticker: string) => void }

export function ScreenerPanel({ onAnalyse }: Props) {
  const [filters,  setFilters]  = useState<ScreenerFilters>(EMPTY_FILTERS);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [result,   setResult]   = useState<ScreenerResult | null>(null);

  function toggle(group: keyof ScreenerFilters, value: string) {
    setFilters((prev) => {
      const arr = prev[group] as string[];
      return {
        ...prev,
        [group]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }

  const activeCount = Object.values(filters).flat().length;

  async function handleRun() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await fetchScreener(filters);
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS);
    setResult(null);
    setError("");
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Stock Screener
      </p>

      {/* Filter panel */}
      <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg2 dark:bg-dark-bg2 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4 mb-4">
          {FILTER_GROUPS.map(({ key, label, options }) => (
            <div key={key}>
              <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                {label}
              </p>
              <div className="space-y-0.5">
                {options.map((opt) => (
                  <FilterCheckbox
                    key={opt.value}
                    checked={(filters[key] as string[]).includes(opt.value)}
                    onChange={() => toggle(key, opt.value)}
                    label={opt.label}
                    desc={opt.desc}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 pt-3 border-t border-light-border dark:border-dark-border flex-wrap">
          <button
            onClick={handleRun}
            disabled={loading}
            className="px-5 py-2 rounded-xl font-semibold text-sm bg-sky-50 border border-sky-300 text-sky-600 hover:bg-sky-100 dark:bg-[#00C8FF1A] dark:border-[#00C8FF55] dark:text-[#00C8FF] dark:hover:bg-[#00C8FF2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Screening…" : `🔍 Screen Universe`}
          </button>
          {activeCount > 0 && (
            <button
              onClick={handleClear}
              className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-[0.68rem] text-slate-400 italic">
            {activeCount > 0
              ? `${activeCount} filter${activeCount !== 1 ? "s" : ""} active — conditions are AND-combined`
              : "Select filters above, then run"}
          </span>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 dark:bg-[#FF005510] dark:border-[#FF005533] dark:text-[#FF0055] text-sm">
          ❌ {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-slate-500">
          <div className="inline-block animate-spin text-2xl mb-3">⚙️</div>
          <p className="text-sm font-medium">Screening universe…</p>
          <p className="text-xs text-slate-400 mt-1">Fetching indicators for up to {60} stocks in parallel</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="rounded-xl border border-light-border dark:border-dark-border overflow-hidden">
          {/* Results header */}
          <div className="px-4 py-3 bg-light-bg2 dark:bg-dark-bg2 border-b border-light-border dark:border-dark-border flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {result.total_matched === 0
                  ? "No matches found"
                  : `${result.total_matched} match${result.total_matched !== 1 ? "es" : ""}`}
              </p>
              <p className="text-[0.62rem] text-slate-500 mt-0.5">
                Screened {result.total_screened} stocks · {(result.duration_ms / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="flex gap-1.5">
              <span className="text-[0.68rem] font-semibold px-2.5 py-1 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D18] dark:border-[#00FF9D40] dark:text-[#00FF9D]">
                {result.results.filter((r) => r.signal === "BUY").length} BUY
              </span>
              <span className="text-[0.68rem] font-semibold px-2.5 py-1 rounded-full border bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005518] dark:border-[#FF005540] dark:text-[#FF0055]">
                {result.results.filter((r) => r.signal === "SELL").length} SELL
              </span>
            </div>
          </div>

          {result.total_matched === 0 ? (
            <div className="p-10 text-center text-slate-500 bg-light-bg2 dark:bg-dark-bg2">
              <p className="text-2xl mb-2">🔍</p>
              <p className="font-semibold">No stocks matched your filters</p>
              <p className="text-sm mt-1">Try removing one or more conditions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-dark-bg3 border-b border-light-border dark:border-dark-border">
                    {([
                      ["Ticker",    "text-left"],
                      ["Price",     "text-right"],
                      ["Day %",     "text-right"],
                      ["Signal",    "text-center"],
                      ["RSI",       "text-center"],
                      ["MACD",      "text-center"],
                      ["SMA Cross", "text-center"],
                      ["",          "text-right"],
                    ] as [string, string][]).map(([h, align]) => (
                      <th key={h} className={`px-3 py-2.5 text-[0.6rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap ${align} ${h === "Ticker" ? "pl-4" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-light-bg2 dark:bg-dark-bg2">
                  {result.results.map((row) => (
                    <ResultRow key={row.ticker} row={row} onAnalyse={onAnalyse} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
