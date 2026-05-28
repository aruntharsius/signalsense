import math

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from watchlist import load_watchlist, add_ticker, remove_ticker, get_watchlist_row_data
from dependencies import get_current_user

router = APIRouter()


def _clean(row: dict) -> dict:
    return {
        k: (None if isinstance(v, float) and (math.isnan(v) or math.isinf(v)) else v)
        for k, v in row.items()
    }


class TickerBody(BaseModel):
    ticker: str


@router.get("")
def get_watchlist(username: str = Depends(get_current_user)):
    tickers = load_watchlist(username)
    return {"watchlist": [_clean(get_watchlist_row_data(t)) for t in tickers]}


@router.post("")
def add_to_watchlist(body: TickerBody, username: str = Depends(get_current_user)):
    return {"watchlist": add_ticker(username, body.ticker)}


@router.delete("/{ticker}")
def remove_from_watchlist(ticker: str, username: str = Depends(get_current_user)):
    return {"watchlist": remove_ticker(username, ticker)}
