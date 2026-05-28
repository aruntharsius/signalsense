import { ReactNode } from "react";
import { clsx } from "clsx";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border bg-light-bg2 dark:bg-dark-bg2 border-light-border dark:border-dark-border p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
      {children}
    </p>
  );
}
