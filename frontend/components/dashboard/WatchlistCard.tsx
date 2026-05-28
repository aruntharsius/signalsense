"use client";

import { SignalBadge } from "@/components/ui/Badge";
import type { WatchlistRow } from "@/lib/types";
import { removeFromWatchlist } from "@/lib/api";

interface Props {
  row: WatchlistRow;
  onAnalyse: (ticker: string) => void;
  onRemoved: () => void;
}

function Chip({ label, variant }: { label: string; variant: "bull" | "bear" | "neut" }) {
  return (
    <span className={`inline-flex items-center text-[0.62rem] font-semibold font-mono px-1.5 py-0.5 rounded border ${
      variant === "bull" ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D15] dark:border-[#00FF9D35] dark:text-[#00FF9D]"
      : variant === "bear" ? "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005515] dark:border-[#FF005535] dark:text-[#FF0055]"
      : "bg-slate-100 dark:bg-[#1a2540] border-slate-200 dark:border-[#243050] text-slate-600 dark:text-slate-400"
    }`}>
      {label}
    </span>
  );
}

export function WatchlistCard({ row, onAnalyse, onRemoved }: Props) {
  const up = (row.pct ?? 0) >= 0;

  async function handleRemove() {
    await removeFromWatchlist(row.ticker);
    onRemoved();
  }

  return (
    <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg2 dark:bg-dark-bg2 p-3 mb-2 animate-fade-in">
      <div className="flex items-start gap-2">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">{row.ticker}</p>
          <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
            <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
              {row.price != null ? `$${row.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
            </span>
            {row.pct != null && (
              <span
                className={`text-xs font-semibold font-mono ${up ? "text-emerald-600 dark:text-[#00FF9D]" : "text-red-600 dark:text-[#FF0055]"}`}
                style={{ textShadow: up ? "0 0 8px #00FF9D44" : "0 0 8px #FF005544" }}
              >
                {up ? "▲" : "▼"} {Math.abs(row.pct).toFixed(2)}%
              </span>
            )}
            <SignalBadge signal={row.signal} />
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {row.rsi != null && (
              <Chip
                label={`RSI ${row.rsi.toFixed(1)}`}
                variant={row.rsi > 70 ? "bear" : row.rsi < 30 ? "bull" : "neut"}
              />
            )}
            <Chip
              label={row.macd_cross === "Bull" ? "MACD ↑" : row.macd_cross === "Bear" ? "MACD ↓" : "MACD —"}
              variant={row.macd_cross === "Bull" ? "bull" : row.macd_cross === "Bear" ? "bear" : "neut"}
            />
            <Chip
              label={row.sma_cross === "Golden" ? "Golden ✦" : row.sma_cross === "Death" ? "Death ✗" : "SMA —"}
              variant={row.sma_cross === "Golden" ? "bull" : row.sma_cross === "Death" ? "bear" : "neut"}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 items-center shrink-0 pt-0.5">
          <button
            onClick={() => onAnalyse(row.ticker)}
            title={`Analyse ${row.ticker}`}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-light-border dark:border-dark-border bg-slate-50 dark:bg-[#1a2540] text-slate-600 dark:text-slate-400 hover:text-sky-600 hover:border-sky-300 hover:bg-sky-50 dark:hover:text-[#00C8FF] dark:hover:border-[#00C8FF55] dark:hover:bg-[#00C8FF0A] transition-colors"
          >
            📊
          </button>
          <button
            onClick={handleRemove}
            title={`Remove ${row.ticker}`}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-light-border dark:border-dark-border bg-slate-50 dark:bg-[#1a2540] text-slate-600 dark:text-slate-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 dark:hover:text-[#FF0055] dark:hover:border-[#FF005555] dark:hover:bg-[#FF00550A] transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
