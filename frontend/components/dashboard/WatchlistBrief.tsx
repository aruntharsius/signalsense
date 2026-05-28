import type { WatchlistRow } from "@/lib/types";

type InsightKind = "ok" | "no" | "neut";
type Tone = "bull" | "bear" | "neut";

interface TickerBrief {
  ticker:   string;
  pct:      number | null;
  signal:   WatchlistRow["signal"];
  insights: { kind: InsightKind; text: string }[];
  tone:     Tone;
}

function buildBrief(rows: WatchlistRow[]): TickerBrief[] {
  return rows
    .filter((r) => !r.error)
    .map((row) => {
      const insights: { kind: InsightKind; text: string }[] = [];
      let bull = 0, bear = 0;

      if (row.rsi != null) {
        if      (row.rsi < 30) { bull += 2; insights.push({ kind: "ok",   text: `RSI ${row.rsi.toFixed(1)} — strongly oversold, bounce likely` }); }
        else if (row.rsi < 45) { bull++;    insights.push({ kind: "ok",   text: `RSI ${row.rsi.toFixed(1)} — approaching oversold` }); }
        else if (row.rsi > 70) { bear += 2; insights.push({ kind: "no",   text: `RSI ${row.rsi.toFixed(1)} — overbought, pullback risk` }); }
        else if (row.rsi > 60) { bear++;    insights.push({ kind: "no",   text: `RSI ${row.rsi.toFixed(1)} — elevated, watch for rejection` }); }
        else                   {            insights.push({ kind: "neut",  text: `RSI ${row.rsi.toFixed(1)} — neutral momentum` }); }
      }

      if      (row.macd_cross === "Bull") { bull++; insights.push({ kind: "ok", text: "MACD bullish — upward momentum" }); }
      else if (row.macd_cross === "Bear") { bear++; insights.push({ kind: "no", text: "MACD bearish — downward pressure" }); }

      if      (row.sma_cross === "Golden") { bull++; insights.push({ kind: "ok", text: "Golden Cross — medium-term uptrend" }); }
      else if (row.sma_cross === "Death")  { bear++; insights.push({ kind: "no", text: "Death Cross — medium-term downtrend" }); }

      const tone: Tone = bull > bear ? "bull" : bear > bull ? "bear" : "neut";
      return { ticker: row.ticker, pct: row.pct, signal: row.signal, insights, tone };
    });
}

function overallVerdict(bull: number, bear: number, total: number): string {
  if (total === 0) return "No data available.";
  if (bull > bear && bull >= Math.ceil(total * 0.6))
    return `Bullish bias. ${bull} of ${total} ticker${total !== 1 ? "s" : ""} show positive momentum.`;
  if (bear > bull && bear >= Math.ceil(total * 0.6))
    return `Caution warranted. ${bear} of ${total} ticker${total !== 1 ? "s" : ""} show weakening signals.`;
  if (bull > bear) return "Slightly bullish. More setups forming than fading.";
  if (bear > bull) return "Slightly cautious. More signals weakening than strengthening.";
  return "Mixed signals. Watch for a clearer directional bias to develop.";
}

interface Props { rows: WatchlistRow[] }

export function WatchlistBrief({ rows }: Props) {
  const briefs    = buildBrief(rows);
  const bullCount = briefs.filter((b) => b.tone === "bull").length;
  const bearCount = briefs.filter((b) => b.tone === "bear").length;
  const neutCount = briefs.filter((b) => b.tone === "neut").length;

  // bull first, then bear, then neutral
  const sorted = [
    ...briefs.filter((b) => b.tone === "bull"),
    ...briefs.filter((b) => b.tone === "bear"),
    ...briefs.filter((b) => b.tone === "neut"),
  ];

  const withPct  = rows.filter((r) => r.pct != null && !r.error).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const gainer   = withPct[0] ?? null;
  const loser    = withPct[withPct.length - 1] ?? null;
  const hasMovers = gainer && loser && gainer.ticker !== loser.ticker;

  const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg2 dark:bg-dark-bg2 overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-light-border dark:border-dark-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">📊 Watchlist Brief</p>
          <p className="text-[0.62rem] text-slate-500 dark:text-slate-400 mt-0.5">
            {now} · {rows.length} ticker{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-[0.68rem] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D18] dark:border-[#00FF9D40] dark:text-[#00FF9D]">
            {bullCount} bull
          </span>
          <span className="text-[0.68rem] font-bold px-2 py-0.5 rounded-full border bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005518] dark:border-[#FF005540] dark:text-[#FF0055]">
            {bearCount} bear
          </span>
          {neutCount > 0 && (
            <span className="text-[0.68rem] font-bold px-2 py-0.5 rounded-full border bg-slate-100 border-slate-200 text-slate-600 dark:bg-[#1a2540] dark:border-[#243050] dark:text-slate-400">
              {neutCount} neut
            </span>
          )}
        </div>
      </div>

      {/* Overall verdict */}
      <div className="px-4 py-2.5 border-b border-light-border dark:border-dark-border bg-slate-50 dark:bg-dark-bg3">
        <p className="text-[0.78rem] text-slate-600 dark:text-slate-400 leading-relaxed">
          {overallVerdict(bullCount, bearCount, briefs.length)}
        </p>
      </div>

      {/* Per-ticker insights */}
      <div className="divide-y divide-light-border dark:divide-dark-border">
        {sorted.map(({ ticker, pct, signal, insights, tone }) => {
          const up = (pct ?? 0) >= 0;
          const accentBorder =
            tone === "bull" ? "border-l-emerald-400 dark:border-l-[#00FF9D55]"
            : tone === "bear" ? "border-l-red-400 dark:border-l-[#FF005555]"
            : "border-l-slate-300 dark:border-l-slate-700";

          return (
            <div key={ticker} className={`px-4 py-3 border-l-[3px] ${accentBorder}`}>
              {/* Ticker row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">{ticker}</span>
                <div className="flex items-center gap-1.5">
                  {pct != null && (
                    <span className={`text-[0.68rem] font-semibold font-mono ${up ? "text-emerald-600 dark:text-[#00FF9D]" : "text-red-600 dark:text-[#FF0055]"}`}>
                      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
                    </span>
                  )}
                  <span className={`text-[0.62rem] font-bold px-1.5 py-0.5 rounded border ${
                    signal === "BUY"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D15] dark:border-[#00FF9D40] dark:text-[#00FF9D]"
                      : signal === "SELL"
                      ? "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005515] dark:border-[#FF005540] dark:text-[#FF0055]"
                      : "bg-slate-100 border-slate-200 text-slate-500 dark:bg-[#1a2540] dark:border-[#243050] dark:text-slate-400"
                  }`}>
                    {signal}
                  </span>
                </div>
              </div>

              {/* Insight bullets */}
              <div className="space-y-0.5">
                {insights.length > 0 ? insights.map(({ kind, text }, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[0.7rem] text-slate-600 dark:text-slate-400">
                    <span className={`shrink-0 font-bold leading-tight mt-px ${
                      kind === "ok"   ? "text-emerald-600 dark:text-[#00FF9D]"
                      : kind === "no" ? "text-red-600 dark:text-[#FF0055]"
                      : "text-slate-400"
                    }`}>
                      {kind === "ok" ? "✓" : kind === "no" ? "✗" : "–"}
                    </span>
                    <span>{text}</span>
                  </div>
                )) : (
                  <p className="text-[0.7rem] text-slate-400 dark:text-slate-500">No indicator data</p>
                )}
              </div>
            </div>
          );
        })}

        {rows.filter((r) => r.error).map((r) => (
          <div key={r.ticker} className="px-4 py-3 border-l-[3px] border-l-slate-200 dark:border-l-slate-700">
            <span className="text-sm font-bold font-mono text-slate-400 dark:text-slate-500">{r.ticker}</span>
            <p className="text-[0.7rem] text-slate-400 dark:text-slate-500 mt-0.5">Failed to load data</p>
          </div>
        ))}
      </div>

      {/* Top mover / loser strip */}
      {hasMovers && (
        <div className="px-4 py-3 border-t border-light-border dark:border-dark-border bg-slate-50 dark:bg-dark-bg3 flex gap-4">
          <div className="flex-1">
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">Top gainer</p>
            <p className="text-sm font-bold font-mono text-emerald-600 dark:text-[#00FF9D]">
              {gainer!.ticker}
              <span className="ml-1.5 text-xs">▲ {Math.abs(gainer!.pct ?? 0).toFixed(2)}%</span>
            </p>
          </div>
          <div className="flex-1 text-right">
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">Top loser</p>
            <p className="text-sm font-bold font-mono text-red-600 dark:text-[#FF0055]">
              {loser!.ticker}
              <span className="ml-1.5 text-xs">▼ {Math.abs(loser!.pct ?? 0).toFixed(2)}%</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
