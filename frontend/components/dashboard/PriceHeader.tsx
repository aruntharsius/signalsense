import { Card } from "@/components/ui/Card";
import type { PriceData, TickerInfo } from "@/lib/types";

function fmt(v: number | null | undefined, decimals = 2, prefix = "") {
  if (v == null) return "—";
  return `${prefix}${v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

interface Props {
  ticker: string;
  priceData: PriceData;
  info: TickerInfo;
}

export function PriceHeader({ ticker, priceData, info }: Props) {
  const { price, change, pct } = priceData;
  const up = (change ?? 0) >= 0;

  const stats = [
    ["Mkt Cap",  info.marketCap ? `$${(info.marketCap / 1e9).toFixed(2)}B` : "—"],
    ["P/E",      info.trailingPE ? `${info.trailingPE.toFixed(1)}x` : "—"],
    ["52W H",    fmt(info.fiftyTwoWeekHigh, 2, "$")],
    ["52W L",    fmt(info.fiftyTwoWeekLow,  2, "$")],
    ["Avg Vol",  info.averageVolume ? `${(info.averageVolume / 1e6).toFixed(1)}M` : "—"],
    ["Sector",   (info.sector as string) || "—"],
  ];

  return (
    <Card className="mb-2">
      <p className="text-[0.7rem] text-slate-500 mb-1">
        {ticker} · {(info.longName as string) || ticker}
      </p>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-3xl font-bold font-mono text-slate-900 dark:text-slate-100 leading-none">
          {price != null ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
        </span>
        {change != null && pct != null && (
          <span
            className={`text-sm font-semibold font-mono ${up ? "text-emerald-600 dark:text-[#00FF9D]" : "text-red-600 dark:text-[#FF0055]"}`}
            style={{ textShadow: up ? "0 0 10px #00FF9D55" : "0 0 10px #FF005555" }}
          >
            {up ? "▲" : "▼"} ${Math.abs(change).toFixed(2)} ({Math.abs(pct).toFixed(2)}%)
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {stats.map(([label, val]) => (
          <span
            key={label}
            className="text-[0.68rem] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1a2540] border border-slate-200 dark:border-[#243050] text-slate-500"
          >
            {label} <strong className="text-slate-700 dark:text-slate-300">{val}</strong>
          </span>
        ))}
      </div>
    </Card>
  );
}
