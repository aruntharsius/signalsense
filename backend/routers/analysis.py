import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from data_fetcher import fetch_ticker_info
from ai_analysis import run_ai_analysis
from dependencies import get_current_user

router = APIRouter()


class AnalysisRequest(BaseModel):
    indicator_summary: dict
    api_key: Optional[str] = None


@router.post("/{ticker}")
def analyze(
    ticker: str,
    body: AnalysisRequest,
    _: str = Depends(get_current_user),
):
    api_key = body.api_key or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(400, detail="No Anthropic API key provided")

    info   = fetch_ticker_info(ticker)
    result = run_ai_analysis(ticker, body.indicator_summary, info, api_key)
    if result is None:
        raise HTTPException(502, detail="AI analysis failed — check your API key")
    return result
