import { Card, CardTitle } from "@/components/ui/Card";
import type { IndicatorSummary } from "@/lib/types";

interface Props {
  summary: IndicatorSummary;
}

function SnapCard({
  label, value, sub, pillClass, pill, action,
}: {
  label: string;
  value: string;
  sub?: string;
  pillClass?: string;
  pill?: string;
  action?: string;
}) {
  return (
    <Card className="text-sm">
      <CardTitle>{label}</CardTitle>
      <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 leading-tight">
        {value}
      </p>
      {sub && <p className="text-[0.68rem] text-slate-500 mt-0.5">{sub}</p>}
      {pill && (
        <span className={`inline-flex items-center gap-1 text-[0.68rem] font-semibold px-2 py-0.5 rounded-full border mt-1.5 ${pillClass}`}>
          {pill}
        </span>
      )}
      {action && (
        <p className="text-[0.68rem] text-slate-500 mt-2 leading-relaxed border-t border-slate-200 dark:border-dark-border pt-2">
          {action}
        </p>
      )}
    </Card>
  );
}

export function IndicatorSnapshot({ summary }: Props) {
  const { RSI: rsi, MACD: macd, MACD_Signal: macdSig, SMA_20: sma20, SMA_50: sma50, EMA_20: ema20 } = summary;

  const rsiPill =
    rsi == null       ? undefined
    : rsi > 70        ? { cls: "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005518] dark:border-[#FF005540] dark:text-[#FF0055]", txt: "🔴 May pull back" }
    : rsi < 30        ? { cls: "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D18] dark:border-[#00FF9D40] dark:text-[#00FF9D]", txt: "🟢 Potential bounce" }
    :                   { cls: "bg-sky-50 border-sky-200 text-sky-600 dark:bg-[#00C8FF12] dark:border-[#00C8FF35] dark:text-[#00C8FF]", txt: "🟡 Neutral zone" };

  const macdBull = macd != null && macdSig != null && macd > macdSig;
  const smaGolden = sma20 != null && sma50 != null && sma20 > sma50;

  return (
    <div>
      <p className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 mt-3">
        Indicator Snapshot
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

        {rsi != null && (
          <SnapCard
            label="RSI (14)"
            value={rsi.toFixed(1)}
            sub={rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : "Neutral"}
            pillClass={rsiPill?.cls}
            pill={rsiPill?.txt}
            action={
              rsi > 70 ? `At ${rsi.toFixed(1)}, RSI is overbought. Watch for a reversal.`
              : rsi < 30 ? `At ${rsi.toFixed(1)}, RSI signals oversold — look for a bounce.`
              : `At ${rsi.toFixed(1)}, RSI is neutral.`
            }
          />
        )}

        {macd != null && macdSig != null && (
          <SnapCard
            label="MACD"
            value={macd.toFixed(3)}
            sub={macdBull ? "Bullish Cross ↑" : "Bearish Cross ↓"}
            pillClass={macdBull
              ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D18] dark:border-[#00FF9D40] dark:text-[#00FF9D]"
              : "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005518] dark:border-[#FF005540] dark:text-[#FF0055]"}
            pill={macdBull ? "🟢 Bullish momentum" : "🔴 Bearish momentum"}
            action={macdBull
              ? `MACD (${macd.toFixed(3)}) above signal — upward momentum active.`
              : `MACD (${macd.toFixed(3)}) below signal — downward momentum dominates.`}
          />
        )}

        {sma20 != null && sma50 != null ? (
          <SnapCard
            label="SMA 20 / 50"
            value={`${sma20.toFixed(2)} / ${sma50.toFixed(2)}`}
            sub={smaGolden ? "Golden Cross 🌟" : "Death Cross ⚫"}
            pillClass={smaGolden
              ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D18] dark:border-[#00FF9D40] dark:text-[#00FF9D]"
              : "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005518] dark:border-[#FF005540] dark:text-[#FF0055]"}
            pill={smaGolden ? "🟢 Bullish trend" : "🔴 Bearish trend"}
            action={smaGolden
              ? `SMA 20 > SMA 50: Golden Cross. Pullbacks are buy opportunities.`
              : `SMA 20 < SMA 50: Death Cross. Rallies are exit opportunities.`}
          />
        ) : ema20 != null ? (
          <SnapCard
            label="EMA 20"
            value={ema20.toFixed(2)}
            sub="20-day exponential MA"
          />
        ) : null}

      </div>

      {/* RSI gauge */}
      {rsi != null && (
        <div className="mt-2">
          <div className="relative h-2.5 rounded-full overflow-hidden"
               style={{ background: "linear-gradient(to right, #00FF9D, #fbbf24, #FF0055)" }}>
            <div
              className="absolute top-0 h-full w-0.5 rounded-sm bg-white dark:bg-gray-900"
              style={{ left: `${Math.min(Math.max(rsi, 0), 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[0.6rem] text-slate-500 dark:text-slate-400 mt-0.5">
            {["0", "30", "50", "70", "100"].map((v) => <span key={v}>{v}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
