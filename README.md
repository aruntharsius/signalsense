# 📡 SignalSense — AI-Powered Stock Technical Analysis

> **Educational purposes only.** Not financial advice.

## Features

| Feature | Details |
|---|---|
| **Real-time Data** | Yahoo Finance via `yfinance` (no API key needed) |
| **10 Indicators** | SMA 20/50, EMA 20/50, RSI, MACD, Bollinger Bands, ATR, OBV, Stochastic |
| **AI Signals** | Claude-powered Buy / Sell / Hold + confidence + key factors |
| **Touch Charts** | Plotly candlestick with pinch-zoom on mobile |
| **Mobile-First** | Dark UI, responsive layout, large tap targets |

## Quick Start

```bash
# 1. Clone / navigate to project
cd signalsense

# 2. Create virtualenv (Python 3.10+)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set API key (or use the sidebar in-app)
cp .env.example .env
# Edit .env and add your Anthropic key

# 5. Run
streamlit run app.py
```

Open `http://localhost:8501` — or scan the local network URL on your phone.

## Project Structure

```
signalsense/
├── app.py             # Streamlit entry point, layout, UI
├── data_fetcher.py    # yfinance data fetching + caching
├── indicators.py      # pandas_ta indicator calculations
├── charts.py          # Plotly chart builders
├── ai_analysis.py     # Claude API prompt + response parsing
├── requirements.txt
├── .env.example
└── README.md
```

## Getting an Anthropic API Key

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create an account / sign in
3. Navigate to **API Keys** → **Create Key**
4. Paste into the SignalSense sidebar (or `.env`)

## Disclaimer

SignalSense is for **educational and informational purposes only**.  
Nothing here is financial advice. Trading involves significant risk.  
Always consult a licensed financial advisor before investing.
