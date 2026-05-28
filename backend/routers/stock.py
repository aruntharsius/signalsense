import math
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from data_fetcher import (
    fetch_stock_data, fetch_ticker_info, get_current_price,
    fetch_news, POPULAR_TICKERS,
)
from dependencies import get_current_user

router = APIRouter()


def _safe(v):
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return None


def _clean_info(info: dict) -> dict:
    out = {}
    for k, v in info.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            out[k] = None
        elif isinstance(v, (str, int, float, bool, type(None))):
            out[k] = v
    return out


@router.get("/popular")
def popular_tickers():
    return {"tickers": POPULAR_TICKERS}


@router.get("/{ticker}/price")
def price(ticker: str, _: str = Depends(get_current_user)):
    p, c, pct = get_current_price(ticker)
    return {"price": _safe(p), "change": _safe(c), "pct": _safe(pct)}


@router.get("/{ticker}/info")
def ticker_info(ticker: str, _: str = Depends(get_current_user)):
    return _clean_info(fetch_ticker_info(ticker))


@router.get("/{ticker}/news")
def news(ticker: str, _: str = Depends(get_current_user)):
    return {"news": fetch_news(ticker)[:12]}


@router.get("/{ticker}/data")
def stock_data(
    ticker: str,
    period: int = Query(180),
    interval: str = Query("1d"),
    _: str = Depends(get_current_user),
):
    end   = date.today().strftime("%Y-%m-%d")
    start = (date.today() - timedelta(days=period)).strftime("%Y-%m-%d")
    df = fetch_stock_data(ticker, start, end, interval=interval)
    if df is None or df.empty:
        raise HTTPException(404, detail=f"No data for {ticker}")
    df_out = df.copy()
    df_out.index = df_out.index.strftime("%Y-%m-%d")
    records = df_out.reset_index().rename(columns={"index": "date", "Date": "date"})
    return {"data": records.where(records.notna(), None).to_dict(orient="records")}
