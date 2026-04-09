from fastapi import APIRouter, HTTPException, Query
import yfinance as yf
import httpx

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

@router.get("/search")
async def search_stocks(q: str = Query(..., min_length=1), limit: int = 6):
    """
    Proxy Yahoo Finance search through backend to avoid browser CORS issues.
    """
    try:
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {
            "q": q,
            "quotesCount": min(max(int(limit), 1), 10),
            "newsCount": 0,
            "enableFuzzyQuery": "false",
        }
        headers = {
            # Yahoo sometimes blocks requests without a UA
            "User-Agent": "Mozilla/5.0 (compatible; RiskAI/1.0)",
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        quotes = data.get("quotes") or []
        out = []
        for item in quotes:
            symbol = item.get("symbol")
            qtype = item.get("quoteType")
            if not symbol or qtype not in ("EQUITY", "ETF"):
                continue
            out.append(
                {
                    "symbol": symbol,
                    "name": item.get("shortname") or item.get("longname") or item.get("name") or symbol,
                    "exchange": item.get("exchDisp") or item.get("exchange") or "",
                }
            )
            if len(out) >= min(max(int(limit), 1), 10):
                break

        return {"quotes": out}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Search provider error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
