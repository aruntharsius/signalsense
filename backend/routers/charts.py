import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from data_fetcher import fetch_stock_data
from indicators import compute_indicators, DEFAULT_INDICATORS
from charts import build_candlestick_chart, build_rsi_chart, build_macd_chart, build_stoch_chart
from dependencies import get_current_user

router = APIRouter()


@router.get("/{ticker}")
def get_charts(
    ticker: str,
    period: int  = Query(180),
    indicators: str = Query(",".join(DEFAULT_INDICATORS)),
    light: bool  = Query(False),
    _: str = Depends(get_current_user),
):
    ind_list = [i.strip() for i in indicators.split(",") if i.strip()]
    end   = date.today().strftime("%Y-%m-%d")
    start = (date.today() - timedelta(days=period)).strftime("%Y-%m-%d")

    df_raw = fetch_stock_data(ticker, start, end)
    if df_raw is None or df_raw.empty:
        raise HTTPException(404, detail=f"No data for {ticker}")

    df = compute_indicators(df_raw, ind_list)

    result: dict = {
        "candlestick": json.loads(
            build_candlestick_chart(df, ind_list, ticker, light=light).to_json()
        )
    }
    if "RSI"  in ind_list and "RSI"     in df.columns:
        result["rsi"]   = json.loads(build_rsi_chart(df,   light=light).to_json())
    if "MACD" in ind_list and "MACD"    in df.columns:
        result["macd"]  = json.loads(build_macd_chart(df,  light=light).to_json())
    if "STOCH" in ind_list and "STOCH_K" in df.columns:
        result["stoch"] = json.loads(build_stoch_chart(df, light=light).to_json())

    return result
