# SignalSense — AI-Powered Stock Technical Analysis

> **Educational purposes only.** Not financial advice.

## Features

| Feature | Details |
|---|---|
| **Real-time Data** | Yahoo Finance via `yfinance` — no API key needed |
| **10 Indicators** | SMA 20/50, EMA 20/50, RSI, MACD, Bollinger Bands, ATR, OBV, Stochastic |
| **Trade Note** | Rule-based entry / stop / target levels generated from ATR and indicator signals |
| **AI Signals** | Claude-powered Buy / Sell / Hold with confidence score and key factors |
| **Backtesting** | Simulate 4 day-trade strategies (Momentum, Mean Reversion, Trend Follow, Breakout) against historical data |
| **Stock Screener** | Filter the S&P 500 universe by signal, RSI zone, MACD, moving-average cross, and day change |
| **Watchlist** | Track multiple tickers with live signals and a rule-based portfolio brief |
| **Charts** | Plotly candlestick with overlay indicators, pinch-zoom on mobile |
| **Mobile-First** | Responsive layout, bottom tab nav on mobile, light/dark mode |

---

## Project Structure

```
signalsense/
├── backend/                  # FastAPI backend
│   ├── main.py               # App entry point, router registration
│   ├── data_fetcher.py       # yfinance fetching + 5-min TTL cache
│   ├── backtest.py           # 4-strategy backtesting engine
│   ├── screener.py           # Parallel stock screener (~60 tickers)
│   ├── routers/
│   │   ├── auth.py           # JWT login / token
│   │   ├── stock.py          # Price, info, news
│   │   ├── indicators.py     # Technical indicator computation
│   │   ├── charts.py         # Plotly chart JSON
│   │   ├── analysis.py       # Claude AI analysis
│   │   ├── watchlist.py      # Watchlist CRUD
│   │   ├── backtest.py       # Backtest endpoint
│   │   └── screener.py       # Screener endpoint
│   └── requirements.txt
│
├── frontend/                 # Next.js 14 frontend
│   ├── app/
│   │   ├── dashboard/page.tsx
│   │   └── login/page.tsx
│   ├── components/dashboard/ # All dashboard panels and cards
│   ├── lib/
│   │   ├── api.ts            # Typed API client
│   │   └── types.ts          # Shared TypeScript types
│   └── package.json
│
├── indicators.py             # Shared indicator logic (used by backend)
└── README.md
```

---

## Running Locally

### Prerequisites

- Python 3.10+
- Node.js 18+

### 1. Backend (FastAPI)

```bash
# From the repo root
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server (runs on http://localhost:8000)
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### 2. Frontend (Next.js)

Open a second terminal from the repo root:

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start the dev server (runs on http://localhost:3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

> The frontend proxies all `/api/*` requests to the backend via `next.config.mjs`. No extra configuration needed for local development.

### Default Login

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `password` |

---

## Getting an Anthropic API Key (for AI signals)

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create an account / sign in
3. Navigate to **API Keys** → **Create Key**
4. Paste the key into the **AI Trade Signal** input in the Analysis panel

---

## Deployment

### Backend → Railway

1. Connect your GitHub repo to [Railway](https://railway.app)
2. Set the **Root Directory** to the repo root (leave blank)
3. Railway will detect `railway.json` and use the correct build and start commands automatically

### Frontend → Vercel

1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Set the **Root Directory** to `frontend/`
3. Add the environment variable:
   ```
   NEXT_PUBLIC_API_BASE = https://<your-railway-domain>/api
   ```
4. Deploy — Vercel builds and serves the Next.js app

---

## Disclaimer

SignalSense is for **educational and informational purposes only**.  
Nothing here is financial advice. Trading involves significant risk.  
Always consult a licensed financial advisor before investing.
