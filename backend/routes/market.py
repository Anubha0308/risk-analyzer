from fastapi import APIRouter, HTTPException
import yfinance as yf

router = APIRouter(prefix="/market", tags=["market"])

MAJOR_MARKET_TICKERS = ["^GSPC", "^IXIC", "^DJI"]

SECTOR_FALLBACKS = {
    "Technology": ["MSFT", "AAPL", "NVDA", "GOOGL", "META", "ORCL", "ADBE"],
    "Financial Services": ["JPM", "BAC", "V", "MA", "GS", "MS"],
    "Healthcare": ["JNJ", "PFE", "MRK", "UNH", "ABT"],
    "Consumer Cyclical": ["AMZN", "TSLA", "HD", "NKE", "SBUX"],
    "Consumer Defensive": ["PG", "KO", "PEP", "WMT", "COST"],
    "Energy": ["XOM", "CVX", "COP", "SLB", "BP"],
    "Industrials": ["BA", "CAT", "GE", "MMM", "HON"],
    "Communication Services": ["GOOGL", "META", "NFLX", "DIS", "TMUS"],
    "Utilities": ["NEE", "DUK", "SO", "AEP", "EXC"],
    "Real Estate": ["AMT", "PLD", "CCI", "EQIX", "SPG"],
    "Basic Materials": ["LIN", "APD", "ECL", "NEM", "FCX"],
}


@router.get("/similar/{symbol}")
async def get_similar_stocks(symbol: str):
    """
    Returns a small list of similar stocks for UI suggestions.
    Uses sector when available, otherwise falls back to popular tickers.
    """
    try:
        sym = symbol.upper()
        t = yf.Ticker(sym)

        info = {}
        try:
            info = t.info or {}
        except Exception:
            info = {}

        sector = info.get("sector")
        industry = info.get("industry")
        short_name = info.get("shortName") or info.get("longName")

        candidates = []
        if sector and sector in SECTOR_FALLBACKS:
            candidates = SECTOR_FALLBACKS[sector]
        else:
            # broad fallback
            candidates = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM", "V", "JNJ"]

        # de-dupe and remove the queried symbol
        seen = set([sym])
        result = []
        for c in candidates:
            c_up = c.upper()
            if c_up in seen:
                continue
            seen.add(c_up)
            result.append(
                {
                    "symbol": c_up,
                    "name": None,
                    "reason": f"Same sector: {sector}" if sector else "Popular related ticker",
                }
            )
            if len(result) >= 8:
                break

        # include a bit of metadata for the main symbol (optional, handy for frontend)
        return {
            "symbol": sym,
            "name": short_name,
            "sector": sector,
            "industry": industry,
            "similar": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/news")
async def get_market_news():
    try:
        all_news = []
        seen_titles = set()

        for symbol in MAJOR_MARKET_TICKERS:
            ticker = yf.Ticker(symbol)
            news = ticker.news or []

            for item in news:
                content = item.get("content", {})

                title = content.get("title")
                link = content.get("canonicalUrl", {}).get("url")
                publisher = content.get("provider", {}).get("displayName")
                published = content.get("pubDate")

                # Skip bad / duplicate entries
                if not title or title in seen_titles:
                    continue

                seen_titles.add(title)

                all_news.append({
                    "title": title,
                    "link": link,
                    "publisher": publisher,
                    "published": published,
                })

        if not all_news:
            raise HTTPException(status_code=404, detail="No market news found")

        # Limit headlines for UI cleanliness
        return {
            "news": all_news[:15]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
