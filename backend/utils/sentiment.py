import os
import re
import json

import yfinance as yf
from dotenv import load_dotenv

load_dotenv()

try:
    from groq import Groq as _Groq
    _GROQ_AVAILABLE = True
except ImportError:
    _GROQ_AVAILABLE = False

_groq_client = None


def _get_client():
    global _groq_client
    if not _GROQ_AVAILABLE:
        return None
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return None
        _groq_client = _Groq(api_key=api_key, timeout=5.0)
    return _groq_client


def fetch_headlines(symbol: str) -> list:
    try:
        news = yf.Ticker(symbol.upper()).news or []
        titles = []
        for item in news:
            title = item.get("content", {}).get("title")
            if title:
                titles.append(title)
            if len(titles) >= 5:
                break
        return titles
    except Exception:
        return []


def score_headlines(headlines: list) -> dict:
    client = _get_client()
    if not client:
        return {"sentiment_score": None, "sentiment_summary": None}

    numbered = "\n".join(f"{i + 1}. {h}" for i, h in enumerate(headlines))

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a financial sentiment analyst. "
                        "Respond only with valid JSON and nothing else."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Score the market sentiment based on these recent headlines:\n"
                        f"{numbered}\n\n"
                        'Return exactly: {"score": <float -1.0 to 1.0>, '
                        '"rationale": "<one sentence, max 15 words>"}'
                    ),
                },
            ],
            max_tokens=100,
            temperature=0.1,
        )

        text = (response.choices[0].message.content or "").strip()

        # Extract first {...} block defensively — model may add preamble text
        match = re.search(r"\{[^}]+\}", text, re.DOTALL)
        if not match:
            return {"sentiment_score": None, "sentiment_summary": None}

        parsed = json.loads(match.group())
        score = float(parsed.get("score", 0.0))
        score = max(-1.0, min(1.0, score))
        rationale = str(parsed.get("rationale", ""))[:200]

        return {"sentiment_score": round(score, 3), "sentiment_summary": rationale}

    except Exception:
        return {"sentiment_score": None, "sentiment_summary": None}
