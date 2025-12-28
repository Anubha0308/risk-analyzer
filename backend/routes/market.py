from fastapi import APIRouter, HTTPException
import yfinance as yf

router = APIRouter(prefix="/market", tags=["market"])

MAJOR_MARKET_TICKERS = ["^GSPC", "^IXIC", "^DJI"]

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
