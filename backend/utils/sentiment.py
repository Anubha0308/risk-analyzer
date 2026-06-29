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

# Corporate-suffix words to strip when deriving a keyword from shortName.
_CORP_SUFFIX = re.compile(
    r"\s*\b(inc\.?|corp\.?|co\.?|ltd\.?|plc\.?|llc\.?|holdings?|group|"
    r"company|companies|international|worldwide|technologies|technology|"
    r"pharmaceuticals?|bancorp|financial|services?|systems?)\b\.?",
    re.IGNORECASE,
)

# Short-form aliases for tickers where the formal name rarely appears verbatim
# in headlines (e.g. "Coke" instead of "Coca-Cola Company").
_ALIASES = {
    "KO":    ["coca-cola", "coke"],
    "JNJ":   ["johnson & johnson", "j&j"],
    "JPM":   ["jpmorgan", "j.p. morgan"],
    "GOOGL": ["alphabet", "google"],
    "GOOG":  ["alphabet", "google"],
    "META":  ["facebook", "instagram", "whatsapp"],
    "BRK.B": ["berkshire"],
    "BRK.A": ["berkshire"],
}

_MIN_POOL = 2  # minimum headlines before falling back to a lower tier


def _name_keywords(sym: str, short_name) -> set:
    """Return a set of lowercase strings any of which, if found in a headline
    title, confirms the article is about this company."""
    kws = {alias.lower() for alias in _ALIASES.get(sym, [])}
    if short_name:
        cleaned = _CORP_SUFFIX.sub("", short_name).strip(" ,.")
        if cleaned:
            kws.add(cleaned.lower())
    return kws


def _title_matches(title: str, keywords: set) -> bool:
    t = title.lower()
    return any(kw in t for kw in keywords)


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
        sym = symbol.upper()
        ticker = yf.Ticker(sym)
        news = ticker.news or []

        # Try to get company name for keyword matching. ticker.info is a lazy
        # call; wrap so a failure here doesn't block the whole fetch.
        short_name = None
        try:
            info = ticker.info or {}
            short_name = info.get("shortName") or info.get("longName")
        except Exception:
            pass

        keywords = _name_keywords(sym, short_name)

        name_matched = []  # Tier 1: company name/alias in headline title
        ticker_tagged = [] # Tier 2: Yahoo explicitly tagged article with symbol
        untagged = []      # Tier 3: everything else

        for item in news:
            content = item.get("content", {})
            title = content.get("title")
            if not title:
                continue

            entry = {
                "title": title,
                "source": (content.get("provider") or {}).get("displayName") or None,
                "url": (content.get("canonicalUrl") or {}).get("url") or None,
            }

            tagged_syms = {
                t.get("symbol", "").upper()
                for t in content.get("tickers", [])
            }

            if keywords and _title_matches(title, keywords):
                name_matched.append(entry)
            elif sym in tagged_syms:
                ticker_tagged.append(entry)
            else:
                untagged.append(entry)

        # Use the highest-precision pool that has enough headlines.
        # Each fallback step includes all items from higher tiers so we never
        # discard good headlines when widening the pool.
        if len(name_matched) >= _MIN_POOL:
            pool = name_matched
        elif len(name_matched) + len(ticker_tagged) >= _MIN_POOL:
            pool = name_matched + ticker_tagged
        else:
            pool = name_matched + ticker_tagged + untagged

        return pool[:5]

    except Exception:
        return []


def score_headlines(headlines: list, symbol: str = "") -> dict:
    client = _get_client()
    if not client:
        return {"sentiment_score": None, "sentiment_summary": None}

    numbered = "\n".join(
        f"{i + 1}. {h['title'] if isinstance(h, dict) else h}"
        for i, h in enumerate(headlines)
    )
    sym_label = symbol.upper() if symbol else "this stock"

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a financial news sentiment analyst scoring headlines for a specific stock.\n\n"
                        "Use the full -1.0 to +1.0 range:\n"
                        "  +0.8 to +1.0  strong positive: clear catalyst (earnings beat, major deal, FDA approval)\n"
                        "  +0.3 to +0.7  mildly positive: upgrade, solid guidance, modest good news\n"
                        "   0.0 to +0.2  slight positive or ambiguous\n"
                        "  -0.2 to -0.1  slight negative or mixed\n"
                        "  -0.7 to -0.3  mildly negative: miss, downgrade, lawsuit, settlement, recall\n"
                        "  -1.0 to -0.8  strong negative: fraud, collapse, major regulatory penalty\n\n"
                        "Calibration rules — read carefully:\n"
                        "- Most established-company news is mildly positive, mildly negative, or mixed. "
                        "Scores above 0.7 or below -0.7 are rare.\n"
                        "- Stable or unremarkable news scores near 0, not 0.6+. Do NOT default to high positive.\n"
                        "- Litigation, settlements, recalls, and downgrades must pull the score down "
                        "even when paired with positive items.\n\n"
                        "Your rationale MUST cite at least one specific named detail from the headlines — "
                        "a figure, product, ruling, person, event, or metric. "
                        "It must NOT use vague filler: 'recent developments', 'market performance', "
                        "'positive outlook', 'investor sentiment', 'future prospects'. "
                        "One sentence, 20-30 words.\n\n"
                        "Respond only with valid JSON, nothing else."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Score the news sentiment for {sym_label} based on these headlines:\n\n"
                        f"{numbered}\n\n"
                        "Weight any risks (litigation, settlement, downgrade, recall) against positives "
                        "rather than ignoring them.\n"
                        "If the headlines are too generic to extract a company-specific signal, "
                        'set score to 0.0 and state "headlines lack company-specific signal" in the rationale.\n\n'
                        'Return: {"score": <float -1.0 to 1.0>, '
                        '"rationale": "<specific one-sentence rationale, 20-30 words>"}'
                    ),
                },
            ],
            max_tokens=150,
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
