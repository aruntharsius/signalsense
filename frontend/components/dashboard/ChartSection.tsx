"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface ChartData {
  candlestick?: object;
  rsi?: object;
  macd?: object;
  stoch?: object;
}

interface Props {
  charts: ChartData;
}

function Expander({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg2 dark:bg-dark-bg2 overflow-hidden mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1a2540] transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}

const plotConfig = { scrollZoom: true, displaylogo: false, responsive: true };

export function ChartSection({ charts }: Props) {
  return (
    <div className="mt-1">
      <div className="my-3 border-t border-light-border dark:border-dark-border" />

      <Expander title="📈  Price Chart">
        {charts.candlestick && (
          <Plot
            data={(charts.candlestick as { data: Plotly.Data[] }).data}
            layout={(charts.candlestick as { layout: Partial<Plotly.Layout> }).layout}
            config={plotConfig}
            style={{ width: "100%" }}
            useResizeHandler
          />
        )}
      </Expander>

      {(charts.rsi || charts.macd) && (
        <Expander title="📊  RSI & MACD">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {charts.rsi && (
              <Plot
                data={(charts.rsi as { data: Plotly.Data[] }).data}
                layout={(charts.rsi as { layout: Partial<Plotly.Layout> }).layout}
                config={plotConfig}
                style={{ width: "100%" }}
                useResizeHandler
              />
            )}
            {charts.macd && (
              <Plot
                data={(charts.macd as { data: Plotly.Data[] }).data}
                layout={(charts.macd as { layout: Partial<Plotly.Layout> }).layout}
                config={plotConfig}
                style={{ width: "100%" }}
                useResizeHandler
              />
            )}
          </div>
        </Expander>
      )}

      {charts.stoch && (
        <Expander title="📊  Stochastic">
          <Plot
            data={(charts.stoch as { data: Plotly.Data[] }).data}
            layout={(charts.stoch as { layout: Partial<Plotly.Layout> }).layout}
            config={plotConfig}
            style={{ width: "100%" }}
            useResizeHandler
          />
        </Expander>
      )}
    </div>
  );
}
