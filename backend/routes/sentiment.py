from fastapi import APIRouter, Depends

from auth_utils import get_current_user
from utils.redis_client import get_cache, set_cache
from utils.redis_keys import sentiment_key
from utils.sentiment import fetch_headlines, score_headlines

router = APIRouter()

_SENTIMENT_TTL = 60 * 60 * 6  # 6 hours — news cycles are slow relative to price moves
_MIN_HEADLINES = 2


@router.get("/predict/sentiment/{symbol}")
def get_sentiment(symbol: str, user: str = Depends(get_current_user)):
    symbol_upper = symbol.upper()
    cache_key = sentiment_key(symbol_upper)

    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    headlines = fetch_headlines(symbol_upper)

    if len(headlines) < _MIN_HEADLINES:
        # Do NOT cache — headlines may appear on the next call
        return {
            "symbol": symbol_upper,
            "sentiment_score": None,
            "sentiment_summary": "Insufficient news coverage",
            "headlines": [],
        }

    result = score_headlines(headlines, symbol_upper)

    response = {
        "symbol": symbol_upper,
        "sentiment_score": result["sentiment_score"],
        "sentiment_summary": result["sentiment_summary"],
        "headlines": headlines,
    }

    # Only cache a successful score — Groq failures should be retried next call
    if result["sentiment_score"] is not None:
        set_cache(cache_key, response, ttl=_SENTIMENT_TTL)

    return response
