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


def _summarize_chart(chart_data: dict) -> str:
    """Condense last-30-day chart arrays into a readable text block for Groq.
    Sends interpreted stats, never raw arrays."""
    try:
        def clean(arr):
            return [x for x in (arr or []) if x is not None]

        prices = clean(chart_data.get("price"))[-30:]
        sma20  = clean(chart_data.get("sma_20"))[-30:]
        sma50  = clean(chart_data.get("sma_50"))[-30:]
        vols   = clean(chart_data.get("volatility"))[-30:]

        if not prices or not sma20 or not sma50 or not vols:
            return ""

        cur_price, cur_sma20, cur_sma50, cur_vol = prices[-1], sma20[-1], sma50[-1], vols[-1]

        rel20 = (cur_price - cur_sma20) / cur_sma20 * 100
        rel50 = (cur_price - cur_sma50) / cur_sma50 * 100
        sma_signal = "SMA-20 above SMA-50 (short-term uptrend)" if cur_sma20 > cur_sma50 else "SMA-20 below SMA-50 (short-term downtrend)"

        crossover_note = ""
        if len(sma20) >= 6 and len(sma50) >= 6:
            if (sma20[-6] < sma50[-6]) and (cur_sma20 >= cur_sma50):
                crossover_note = " A golden cross (SMA-20 crossing above SMA-50) occurred in the last 5 days."
            elif (sma20[-6] > sma50[-6]) and (cur_sma20 <= cur_sma50):
                crossover_note = " A death cross (SMA-20 crossing below SMA-50) occurred in the last 5 days."

        early_vol = sum(vols[:5]) / 5 if len(vols) >= 5 else vols[0]
        vol_trend = "rising" if cur_vol > early_vol * 1.15 else "falling" if cur_vol < early_vol * 0.85 else "broadly stable"
        ann_vol = cur_vol * (252 ** 0.5) * 100

        # Broader-trend context: did the most recent price diverge from where it spent most of the period?
        days_above_sma50 = sum(1 for p, s in zip(prices, sma50) if p > s)
        trend_context = ""
        if days_above_sma50 >= 20 and cur_price < cur_sma50:
            trend_context = (
                f" Broader context: price was above the 50-day average for {days_above_sma50} of the last"
                f" {len(prices)} sessions but has recently fallen below it."
            )
        elif days_above_sma50 <= len(prices) - 20 and cur_price > cur_sma50:
            trend_context = (
                f" Broader context: price was below the 50-day average for most of the last"
                f" {len(prices)} sessions but has recently risen above it."
            )

        # Recent sharp move: 5-session price change >= 4%
        recent_move = ""
        if len(prices) >= 6:
            pct5 = (cur_price - prices[-6]) / prices[-6] * 100
            if pct5 <= -4:
                recent_move = f" The price declined sharply ({abs(pct5):.1f}%) over the last 5 sessions."
            elif pct5 >= 4:
                recent_move = f" The price surged ({pct5:.1f}%) over the last 5 sessions."

        return (
            f"Price is {'%.1f' % abs(rel20)}% {'above' if rel20 >= 0 else 'below'} its 20-day moving average "
            f"and {'%.1f' % abs(rel50)}% {'above' if rel50 >= 0 else 'below'} its 50-day moving average. "
            f"{sma_signal}.{crossover_note}"
            f"{trend_context}{recent_move} "
            f"30-day annualized volatility is {ann_vol:.1f}% and has been {vol_trend} over the period."
        )
    except Exception:
        return ""


def infer_chart(symbol: str, chart_data: dict) -> dict:
    """Call Groq with a chart summary and return a plain-English inference (max 3 sentences)."""
    client = _get_client()
    if not client:
        return {"inference": None}

    summary = _summarize_chart(chart_data)
    if not summary:
        return {"inference": None}

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a financial educator explaining stock chart patterns to a non-expert retail investor. "
                        "HARD LIMIT: Your entire response must be exactly 2 or 3 sentences — never 4 or more. "
                        "Count your sentences before you respond. Stop writing after the 3rd sentence.\n"
                        "Rules:\n"
                        "- Write in plain English. No jargon dumps. Spell out what terms mean if you use them.\n"
                        "- Sentence 1 (one sentence only): describe the moving-average relationship — is short-term "
                        "momentum strengthening or weakening? ONLY IF the summary contains the exact label "
                        "'Broader context:', add a subordinate clause to this same sentence acknowledging the "
                        "divergence, e.g. '...following a sharp recent drop' or '...despite holding above its "
                        "averages for most of the period.' If 'Broader context:' does not appear in the summary, "
                        "do NOT use 'despite', 'following a recent drop', or any similar qualifier.\n"
                        "- Sentence 2: describe what the volatility trend means for the investor — "
                        "is the stock becoming more or less turbulent, and what does that imply for near-term risk?\n"
                        "- Sentence 3 (optional, only include if genuinely useful): note whether the trend picture "
                        "and volatility read point the same direction or diverge — e.g. trend improving but vol also "
                        "rising is a mixed signal worth flagging. Skip this sentence if it would just be filler.\n"
                        "- Never repeat raw numbers from the summary. Interpret, don't recite.\n"
                        "- Never make price predictions or buy/sell recommendations.\n"
                        "- Write as a single continuous paragraph. No line breaks between sentences."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"30-day technical summary for {symbol}:\n\n"
                        f"{summary}\n\n"
                        "Write the interpretation now."
                    ),
                },
            ],
            max_tokens=160,
            temperature=0.2,
        )
        text = (response.choices[0].message.content or "").strip()
        # Hard cap: split on sentence boundaries and keep at most 3.
        if text:
            parts = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)
            if len(parts) > 3:
                text = " ".join(parts[:3])
                if not text[-1] in ".!?":
                    text += "."
        return {"inference": text or None}
    except Exception:
        return {"inference": None}
