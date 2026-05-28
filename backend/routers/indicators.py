import math
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from data_fetcher import fetch_stock_data
from indicators import compute_indicators, build_indicator_summary, DEFAULT_INDICATORS
from dependencies import get_current_user

router = APIRouter()


@router.get("/{ticker}")
def get_indicators(
    ticker: str,
    period: int = Query(180),
    indicators: str = Query(",".join(DEFAULT_INDICATORS)),
    _: str = Depends(get_current_user),
):
    ind_list = [i.strip() for i in indicators.split(",") if i.strip()]
    end   = date.today().strftime("%Y-%m-%d")
    start = (date.today() - timedelta(days=period)).strftime("%Y-%m-%d")

    df_raw = fetch_stock_data(ticker, start, end)
    if df_raw is None or df_raw.empty:
        raise HTTPException(404, detail=f"No data for {ticker}")

    # Always compute ATR — required by the Day Trade Setup regardless of selection
    compute_list = ind_list if "ATR" in ind_list else ind_list + ["ATR"]
    df      = compute_indicators(df_raw, compute_list)
    summary = build_indicator_summary(df)

    clean = {}
    for k, v in summary.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            clean[k] = None
        else:
            clean[k] = v

    return {"summary": clean, "indicator_list": ind_list}
