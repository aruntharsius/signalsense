export interface PriceData {
  price: number | null;
  change: number | null;
  pct: number | null;
}

export interface TickerInfo {
  longName?: string;
  sector?: string;
  marketCap?: number;
  trailingPE?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  averageVolume?: number;
  targetMeanPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;
  recommendationKey?: string;
  recommendationMean?: number;
  numberOfAnalystOpinions?: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  volume?: number;
  averageVolume10days?: number;
  open?: number;
  previousClose?: number;
  dayHigh?: number;
  dayLow?: number;
  [key: string]: unknown;
}

export interface IndicatorSummary {
  close?: number | null;
  volume?: number | null;
  RSI?: number | null;
  MACD?: number | null;
  MACD_Signal?: number | null;
  MACD_Hist?: number | null;
  SMA_20?: number | null;
  SMA_50?: number | null;
  EMA_20?: number | null;
  EMA_50?: number | null;
  BB_Upper?: number | null;
  BB_Mid?: number | null;
  BB_Lower?: number | null;
  ATR?: number | null;
  OBV?: number | null;
  STOCH_K?: number | null;
  STOCH_D?: number | null;
  volume_trend?: string;
  price_trend_5d?: string;
}

export interface NewsItem {
  title?: string;
  link?: string;
  publisher?: string;
  providerPublishTime?: number;
}

export interface WatchlistRow {
  ticker: string;
  price: number | null;
  change: number | null;
  pct: number | null;
  rsi: number | null;
  macd_cross: "Bull" | "Bear" | null;
  sma_cross: "Golden" | "Death" | null;
  signal: "BUY" | "SELL" | "HOLD" | "—";
  error: boolean;
}

export interface AIAnalysis {
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  bias: "Bullish" | "Bearish" | "Neutral";
  summary: string;
  key_factors: string[];
  risk_note: string;
  support?: number | null;
  resistance?: number | null;
}

export interface BacktestTrade {
  entry_date:   string;
  exit_date:    string;
  direction:    "LONG" | "SHORT";
  entry_price:  number;
  exit_price:   number;
  exit_reason:  "TARGET" | "STOP" | "TIMEOUT";
  pnl_pct:      number;
  holding_days: number;
}

export interface BacktestMetrics {
  total_trades:     number;
  win_rate:         number;
  avg_win_pct:      number;
  avg_loss_pct:     number;
  profit_factor:    number;
  total_return_pct: number;
  max_drawdown_pct: number;
}

export interface BacktestResult {
  ticker:       string;
  strategy:     string;
  period_days:  number;
  metrics:      BacktestMetrics;
  trades:       BacktestTrade[];
  equity_curve: { date: string; value: number }[];
}

export interface ScreenerRow {
  ticker:     string;
  price:      number | null;
  pct:        number | null;
  signal:     "BUY" | "SELL" | "HOLD";
  rsi:        number | null;
  macd_cross: "Bull" | "Bear" | null;
  sma_cross:  "Golden" | "Death" | null;
}

export interface ScreenerResult {
  results:        ScreenerRow[];
  total_screened: number;
  total_matched:  number;
  duration_ms:    number;
  universe_size:  number;
}

export interface ScreenerFilters {
  signals:    string[];
  rsi:        string[];
  macd:       string[];
  sma_cross:  string[];
  day_change: string[];
}

export const PERIOD_OPTS: Record<string, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "2Y": 730,
};

export const DEFAULT_INDICATORS = ["SMA_20", "EMA_20", "RSI", "MACD", "BB"];

export const INDICATOR_OPTIONS: Record<string, string> = {
  SMA_20: "SMA 20",
  SMA_50: "SMA 50",
  EMA_20: "EMA 20",
  EMA_50: "EMA 50",
  RSI: "RSI (14)",
  MACD: "MACD",
  BB: "Bollinger Bands",
  ATR: "ATR (14)",
  OBV: "OBV",
  STOCH: "Stochastic",
};
