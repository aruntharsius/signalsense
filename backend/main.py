"""
main.py — SignalSense FastAPI backend.
Run: uvicorn main:app --reload --port 8000
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR    = os.path.dirname(BACKEND_DIR)

# backend/data_fetcher.py (no Streamlit) takes priority over root's version
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(1, ROOT_DIR)

# Register backend data_fetcher so watchlist.py's lazy imports pick it up
import data_fetcher as _backend_df
sys.modules["data_fetcher"] = _backend_df

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, stock, charts, indicators, analysis, watchlist, backtest, screener

app = FastAPI(title="SignalSense API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://signalsense-sable.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/api/auth",       tags=["auth"])
app.include_router(stock.router,      prefix="/api/stock",      tags=["stock"])
app.include_router(charts.router,     prefix="/api/charts",     tags=["charts"])
app.include_router(indicators.router, prefix="/api/indicators", tags=["indicators"])
app.include_router(analysis.router,   prefix="/api/analysis",   tags=["analysis"])
app.include_router(watchlist.router,  prefix="/api/watchlist",  tags=["watchlist"])
app.include_router(backtest.router,   prefix="/api/backtest",   tags=["backtest"])
app.include_router(screener.router,   prefix="/api/screener",   tags=["screener"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
