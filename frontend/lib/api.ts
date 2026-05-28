const BASE = "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ss_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("ss_token");
    window.location.href = "/login";
    throw new Error("Unauthorised");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<void> {
  const data = await request<{ access_token: string; token_type: string }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ username, password }) }
  );
  localStorage.setItem("ss_token", data.access_token);
}

export function logout(): void {
  localStorage.removeItem("ss_token");
  window.location.href = "/login";
}

// ── Stock ─────────────────────────────────────────────────────────────────────

export const fetchPrice = (ticker: string) =>
  request<{ price: number | null; change: number | null; pct: number | null }>(
    `/stock/${ticker}/price`
  );

export const fetchInfo = (ticker: string) =>
  request<Record<string, unknown>>(`/stock/${ticker}/info`);

export const fetchNews = (ticker: string) =>
  request<{ news: Array<Record<string, unknown>> }>(`/stock/${ticker}/news`);

// ── Indicators ────────────────────────────────────────────────────────────────

export const fetchIndicators = (
  ticker: string,
  period: number,
  indicators: string[]
) =>
  request<{ summary: Record<string, number | null | string>; indicator_list: string[] }>(
    `/indicators/${ticker}?period=${period}&indicators=${indicators.join(",")}`
  );

// ── Charts ────────────────────────────────────────────────────────────────────

export const fetchCharts = (
  ticker: string,
  period: number,
  indicators: string[],
  light: boolean
) =>
  request<Record<string, unknown>>(
    `/charts/${ticker}?period=${period}&indicators=${indicators.join(",")}&light=${light}`
  );

// ── AI Analysis ───────────────────────────────────────────────────────────────

export const runAnalysis = (
  ticker: string,
  indicator_summary: Record<string, unknown>,
  api_key: string
) =>
  request<Record<string, unknown>>(`/analysis/${ticker}`, {
    method: "POST",
    body: JSON.stringify({ indicator_summary, api_key }),
  });

// ── Watchlist ─────────────────────────────────────────────────────────────────

export const fetchWatchlist = () =>
  request<{ watchlist: Array<Record<string, unknown>> }>("/watchlist");

export const addToWatchlist = (ticker: string) =>
  request<{ watchlist: string[] }>("/watchlist", {
    method: "POST",
    body: JSON.stringify({ ticker }),
  });

export const removeFromWatchlist = (ticker: string) =>
  request<{ watchlist: string[] }>(`/watchlist/${ticker}`, { method: "DELETE" });

// ── Screener ──────────────────────────────────────────────────────────────────

export const fetchScreener = (filters: import("./types").ScreenerFilters) => {
  const p = new URLSearchParams();
  if (filters.signals.length)    p.set("signals",    filters.signals.join(","));
  if (filters.rsi.length)        p.set("rsi",        filters.rsi.join(","));
  if (filters.macd.length)       p.set("macd",       filters.macd.join(","));
  if (filters.sma_cross.length)  p.set("sma_cross",  filters.sma_cross.join(","));
  if (filters.day_change.length) p.set("day_change", filters.day_change.join(","));
  const qs = p.toString();
  return request<import("./types").ScreenerResult>(`/screener${qs ? `?${qs}` : ""}`);
};

// ── Backtest ──────────────────────────────────────────────────────────────────

export const fetchBacktest = (ticker: string, strategy: string, period: number) =>
  request<import("./types").BacktestResult>(
    `/backtest/${ticker}?strategy=${strategy}&period=${period}`
  );
