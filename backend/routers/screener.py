from fastapi import APIRouter, Depends, Query

from screener import run_screener, UNIVERSE
from dependencies import get_current_user

router = APIRouter()


def _parse(s: str | None) -> list[str] | None:
    return [x.strip() for x in s.split(",") if x.strip()] if s else None


@router.get("")
def get_screener(
    signals:    str | None = Query(None),
    rsi:        str | None = Query(None),
    macd:       str | None = Query(None),
    sma_cross:  str | None = Query(None),
    day_change: str | None = Query(None),
    _: str = Depends(get_current_user),
):
    result = run_screener(
        signals    = _parse(signals),
        rsi        = _parse(rsi),
        macd       = _parse(macd),
        sma_cross  = _parse(sma_cross),
        day_change = _parse(day_change),
    )
    return {**result, "universe_size": len(UNIVERSE)}
