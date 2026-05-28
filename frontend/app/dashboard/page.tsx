"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { RefreshCw } from "lucide-react";

import { Header } from "@/components/dashboard/Header";
import { PriceHeader } from "@/components/dashboard/PriceHeader";
import { IndicatorSnapshot } from "@/components/dashboard/IndicatorSnapshot";
import { DayTradeSetup } from "@/components/dashboard/DayTradeSetup";
import { ChartSection } from "@/components/dashboard/ChartSection";
import { AnalysisPanel } from "@/components/dashboard/AnalysisPanel";
import { WatchlistCard } from "@/components/dashboard/WatchlistCard";
import { WatchlistBrief } from "@/components/dashboard/WatchlistBrief";
import { BacktestPanel } from "@/components/dashboard/BacktestPanel";
import { ScreenerPanel } from "@/components/dashboard/ScreenerPanel";

import {
  fetchPrice, fetchInfo, fetchNews,
  fetchIndicators, fetchCharts,
  fetchWatchlist, addToWatchlist,
} from "@/lib/api";

import type {
  PriceData, TickerInfo, IndicatorSummary, NewsItem, WatchlistRow,
} from "@/lib/types";
import { PERIOD_OPTS, DEFAULT_INDICATORS, INDICATOR_OPTIONS } from "@/lib/types";

type MainTab = "watchlist" | "analysis" | "backtest" | "screener";

export default function DashboardPage() {
  const router   = useRouter();
  const { theme } = useTheme();
  const light    = theme === "light";

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem("ss_token")) router.replace("/login");
  }, [router]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [mainTab,   setMainTab]   = useState<MainTab>("watchlist");
  const [ticker,    setTicker]    = useState("AAPL");
  const [input,     setInput]     = useState("AAPL");
  const [tfLabel,   setTfLabel]   = useState("6M");
  const [indicators, setIndicators] = useState<string[]>(DEFAULT_INDICATORS);

  const [priceData, setPriceData]   = useState<PriceData | null>(null);
  const [info,      setInfo]        = useState<TickerInfo | null>(null);
  const [summary,   setSummary]     = useState<IndicatorSummary | null>(null);
  const [charts,    setCharts]      = useState<Record<string, unknown> | null>(null);
  const [news,      setNews]        = useState<NewsItem[]>([]);
  const [loading,   setLoading]     = useState(false);
  const [error,     setError]       = useState("");

  // Watchlist state
  const [watchlist,    setWatchlist]    = useState<WatchlistRow[]>([]);
  const [wlLoading,    setWlLoading]    = useState(false);
  const [newTicker,    setNewTicker]    = useState("");
  const [addLoading,   setAddLoading]   = useState(false);

  const period = PERIOD_OPTS[tfLabel];

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadAnalysis = useCallback(async (t: string) => {
    setLoading(true); setError("");
    try {
      const [price, inf, ind, ch, nws] = await Promise.all([
        fetchPrice(t),
        fetchInfo(t),
        fetchIndicators(t, period, indicators),
        fetchCharts(t, period, indicators, light),
        fetchNews(t),
      ]);
      setPriceData(price);
      setInfo(inf as TickerInfo);
      setSummary(ind.summary as IndicatorSummary);
      setCharts(ch as Record<string, unknown>);
      setNews((nws.news ?? []) as NewsItem[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period, indicators, light]);

  useEffect(() => { loadAnalysis(ticker); }, [ticker, tfLabel, light]); // eslint-disable-line

  const loadWatchlist = useCallback(async () => {
    setWlLoading(true);
    try {
      const data = await fetchWatchlist();
      setWatchlist(data.watchlist);
    } catch {
      // silently ignore
    } finally {
      setWlLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === "watchlist") loadWatchlist();
  }, [mainTab, loadWatchlist]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleTickerSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim().toUpperCase();
    if (t) { setTicker(t); setInput(t); }
  }

  function handleAnalyseWatchlistTicker(t: string) {
    setTicker(t);
    setInput(t);
    setMainTab("analysis");
    loadAnalysis(t);
  }

  async function handleAddTicker() {
    const t = newTicker.trim().toUpperCase();
    if (!t) return;
    setAddLoading(true);
    try {
      await addToWatchlist(t);
      setNewTicker("");
      loadWatchlist();
    } finally {
      setAddLoading(false);
    }
  }

  function toggleIndicator(key: string) {
    setIndicators((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-slate-700 dark:text-slate-300">

      {/* ── Mobile bottom tab nav ─────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-white dark:bg-dark-bg2 border-t border-light-border dark:border-dark-border"
           style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {(["watchlist", "analysis", "backtest", "screener"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[0.6rem] font-semibold uppercase tracking-wide transition-colors ${
              mainTab === tab
                ? "text-sky-600 dark:text-[#00C8FF]"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            <span className="text-[1.25rem] leading-none">
              {tab === "watchlist" ? "📋" : tab === "analysis" ? "📊" : tab === "backtest" ? "📈" : "🔍"}
            </span>
            <span>{tab === "watchlist" ? "Watch" : tab === "analysis" ? "Analysis" : tab === "backtest" ? "Backtest" : "Screener"}</span>
          </button>
        ))}
      </nav>

      <div className="max-w-[1440px] mx-auto px-4 pb-24 lg:pb-8 pt-3">
        <Header />

        {/* ── Desktop tab nav (top) ──────────────────────────────────────── */}
        <div className="hidden lg:flex gap-0.5 border-b border-light-border dark:border-dark-border mb-4">
          {(["watchlist", "analysis", "backtest", "screener"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className={`px-5 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                mainTab === tab
                  ? "bg-light-bg2 dark:bg-dark-bg2 text-sky-600 dark:text-[#00C8FF] border border-b-0 border-light-border dark:border-dark-border"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {tab === "watchlist" ? "📋  Watchlist"
                : tab === "analysis" ? "📊  Analysis"
                : tab === "backtest" ? "📈  Backtest"
                : "🔍  Screener"}
            </button>
          ))}
        </div>

        {/* ══ ANALYSIS TAB ═══════════════════════════════════════════════════ */}
        {mainTab === "analysis" && (
          <div className="animate-fade-in">
            {/* Controls */}
            <div className="flex gap-2 mb-3 flex-wrap items-start">
              <form onSubmit={handleTickerSubmit} className="flex gap-2 flex-1 min-w-[200px]">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value.toUpperCase())}
                  placeholder="AAPL, TSLA, SPY…"
                  className="flex-1 px-4 py-2 rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg3 text-slate-800 dark:text-slate-200 font-mono text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00C8FF]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00C8FF1A] border border-[#00C8FF55] text-[#00C8FF] text-sm font-semibold hover:bg-[#00C8FF2A] transition-colors"
                >
                  Go
                </button>
              </form>

              {/* Indicator picker */}
              <details className="relative">
                <summary className="px-3 py-2 rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg3 text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:border-[#00C8FF55] list-none">
                  ⚙️ Indicators
                </summary>
                <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-dark-bg2 border border-light-border dark:border-dark-border rounded-xl p-3 shadow-xl w-56">
                  {Object.entries(INDICATOR_OPTIONS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 py-1 cursor-pointer hover:text-[#00C8FF] text-sm">
                      <input
                        type="checkbox"
                        checked={indicators.includes(key)}
                        onChange={() => toggleIndicator(key)}
                        className="accent-[#00C8FF]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </details>
            </div>

            {/* Timeframe strip */}
            <div className="flex gap-1.5 mb-3 pb-3 border-b border-light-border dark:border-dark-border overflow-x-auto">
              {Object.keys(PERIOD_OPTS).map((lbl) => (
                <button
                  key={lbl}
                  onClick={() => setTfLabel(lbl)}
                  className={`px-3.5 py-1.5 rounded-md text-[0.72rem] font-semibold font-mono border transition-colors whitespace-nowrap ${
                    tfLabel === lbl
                      ? "bg-[#00C8FF1A] border-[#00C8FF55] text-[#00C8FF]"
                      : "border-light-border dark:border-dark-border text-slate-500 hover:border-[#00C8FF44] hover:text-[#00C8FF]"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-3 px-4 py-3 rounded-xl bg-[#FF005510] border border-[#FF005533] text-[#FF0055] text-sm">
                ❌ {error}
              </div>
            )}

            {loading && (
              <div className="text-center py-12 text-slate-500 text-sm">
                <div className="inline-block animate-spin mr-2">⚙️</div>
                Fetching {ticker}…
              </div>
            )}

            {!loading && priceData && info && summary && charts && (
              <div className="grid grid-cols-1 lg:grid-cols-[3.5fr_2.5fr] gap-4">
                {/* Left — charts + indicators */}
                <div>
                  <PriceHeader ticker={ticker} priceData={priceData} info={info} />
                  <IndicatorSnapshot summary={summary} />
                  <DayTradeSetup summary={summary} price={priceData.price} />
                  <ChartSection charts={charts as Parameters<typeof ChartSection>[0]["charts"]} />
                </div>

                {/* Right — analysis panel */}
                <div>
                  <AnalysisPanel
                    ticker={ticker}
                    info={info}
                    news={news}
                    summary={summary}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ WATCHLIST TAB ══════════════════════════════════════════════════ */}
        {mainTab === "watchlist" && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">

              {/* ── Left: list ─────────────────────────────────────────────── */}
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
                  My Watchlist
                </p>

                {/* Add ticker row */}
                <div className="flex gap-2 mb-4">
                  <input
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTicker()}
                    placeholder="e.g. NVDA, SPY…"
                    className="flex-1 px-4 py-2 rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg3 text-slate-800 dark:text-slate-200 font-mono text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-[#00C8FF]"
                  />
                  <button
                    onClick={handleAddTicker}
                    disabled={addLoading || !newTicker}
                    className="px-4 py-2 rounded-xl bg-sky-50 border border-sky-300 text-sky-600 dark:bg-[#00C8FF1A] dark:border-[#00C8FF55] dark:text-[#00C8FF] text-sm font-semibold hover:bg-sky-100 dark:hover:bg-[#00C8FF2A] disabled:opacity-40 transition-colors"
                  >
                    ＋ Add
                  </button>
                  <button
                    onClick={loadWatchlist}
                    disabled={wlLoading}
                    className="px-3 py-2 rounded-xl border border-light-border dark:border-dark-border text-slate-500 hover:text-sky-600 hover:border-sky-300 dark:hover:text-[#00C8FF] dark:hover:border-[#00C8FF55] transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={15} className={wlLoading ? "animate-spin" : ""} />
                  </button>
                </div>

                {wlLoading && (
                  <p className="text-center text-slate-500 text-sm py-8">Loading watchlist…</p>
                )}

                {!wlLoading && watchlist.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <p className="text-3xl mb-2">📋</p>
                    <p className="font-semibold mb-1">Your watchlist is empty</p>
                    <p className="text-sm">Add a ticker above to start tracking stocks.</p>
                  </div>
                )}

                {!wlLoading && watchlist.map((row) => (
                  <WatchlistCard
                    key={row.ticker}
                    row={row}
                    onAnalyse={handleAnalyseWatchlistTicker}
                    onRemoved={loadWatchlist}
                  />
                ))}

                {watchlist.length > 0 && (
                  <p className="text-[0.65rem] text-slate-500 mt-3">
                    {watchlist.length} ticker{watchlist.length !== 1 ? "s" : ""} · Signal = majority vote of RSI, MACD, SMA · Data cached 5 min
                  </p>
                )}
              </div>

              {/* ── Right: brief ───────────────────────────────────────────── */}
              <div className="lg:sticky lg:top-4">
                {!wlLoading && watchlist.length > 0 ? (
                  <WatchlistBrief rows={watchlist} />
                ) : !wlLoading && (
                  <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg2 dark:bg-dark-bg2 p-8 text-center text-slate-500">
                    <p className="text-2xl mb-2">📊</p>
                    <p className="text-sm">Your brief will appear here once you add tickers to your watchlist.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ══ BACKTEST TAB ═══════════════════════════════════════════════════ */}
        {mainTab === "backtest" && (
          <div className="animate-fade-in max-w-5xl">
            <BacktestPanel />
          </div>
        )}

        {/* ══ SCREENER TAB ═══════════════════════════════════════════════════ */}
        {mainTab === "screener" && (
          <div className="animate-fade-in max-w-5xl">
            <ScreenerPanel onAnalyse={handleAnalyseWatchlistTicker} />
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 text-[0.67rem] text-slate-500 bg-[#FF005508] border border-[#FF005525] rounded-xl px-4 py-3 leading-relaxed">
          <strong className="text-[#FF0055]">⚠️ DISCLAIMER — EDUCATIONAL USE ONLY.</strong>{" "}
          SignalSense is for informational and educational purposes only. Nothing here constitutes
          financial, investment, legal, or tax advice. Technical indicators and AI signals are not
          guarantees of future performance. Trading involves significant risk. Always do your own
          due diligence and consult a licensed financial advisor.
        </div>
      </div>
    </div>
  );
}
