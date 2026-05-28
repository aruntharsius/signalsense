import { clsx } from "clsx";

type Variant = "bull" | "bear" | "neutral" | "accent";

const variants: Record<Variant, string> = {
  bull:    "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00FF9D18] dark:border-[#00FF9D40] dark:text-[#00FF9D]",
  bear:    "bg-red-50 border-red-200 text-red-600 dark:bg-[#FF005518] dark:border-[#FF005540] dark:text-[#FF0055]",
  neutral: "bg-slate-100 border-slate-200 text-slate-600 dark:bg-[#1a2540] dark:border-[#243050] dark:text-slate-400",
  accent:  "bg-sky-50 border-sky-200 text-sky-600 dark:bg-[#00C8FF12] dark:border-[#00C8FF35] dark:text-[#00C8FF]",
};

export function Badge({
  variant = "neutral",
  children,
  className,
}: {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border font-mono",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function SignalBadge({ signal }: { signal: "BUY" | "SELL" | "HOLD" | "—" }) {
  const v: Variant =
    signal === "BUY" ? "bull" : signal === "SELL" ? "bear" : "accent";
  return (
    <span
      className={clsx(
        "inline-block text-xs font-bold font-mono px-3 py-1 rounded-lg border tracking-wider",
        signal === "BUY"
          ? "bg-emerald-50 border-emerald-300 text-emerald-600 dark:bg-[#00FF9D15] dark:border-[#00FF9D55] dark:text-[#00FF9D]"
          : signal === "SELL"
          ? "bg-red-50 border-red-300 text-red-600 dark:bg-[#FF005515] dark:border-[#FF005555] dark:text-[#FF0055]"
          : "bg-sky-50 border-sky-300 text-sky-600 dark:bg-[#00C8FF10] dark:border-[#00C8FF40] dark:text-[#00C8FF]"
      )}
    >
      {signal}
    </span>
  );
}
