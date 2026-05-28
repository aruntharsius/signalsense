from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from data_fetcher import fetch_stock_data
from indicators import compute_indicators
from backtest import run_backtest
from dependencies import get_current_user

router = APIRouter()

# Always compute the full indicator set for backtesting regardless of user selection
_ALL_INDICATORS = ["SMA_20", "SMA_50", "EMA_20", "EMA_50", "RSI", "MACD", "BB", "ATR"]


@router.get("/{ticker}")
def get_backtest(
    ticker: str,
    period:   int = Query(365),
    strategy: str = Query("momentum"),
    _: str = Depends(get_current_user),
):
    end   = date.today().strftime("%Y-%m-%d")
    start = (date.today() - timedelta(days=period)).strftime("%Y-%m-%d")

    df_raw = fetch_stock_data(ticker, start, end)
    if df_raw is None or df_raw.empty:
        raise HTTPException(404, detail=f"No data for {ticker}")

    df = compute_indicators(df_raw, _ALL_INDICATORS)

    try:
        result = run_backtest(df, strategy)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))

    return {"ticker": ticker, "strategy": strategy, "period_days": period, **result}
