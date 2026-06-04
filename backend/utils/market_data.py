import pandas as pd
import yfinance as yf
from database import stock_price_history_collection
from datetime import timezone,datetime

from utils.redis_client import get_cache, set_cache
from utils.redis_keys import stock_history_key


REQUIRED_COLS = ["Open", "High", "Low", "Close", "Volume"]

def save_price_history(symbol: str, df: pd.DataFrame):
    symbol = symbol.upper()
    now = datetime.now(timezone.utc)

    for date, row in df.iterrows():
        date_str = pd.to_datetime(date).strftime("%Y-%m-%d")

        stock_price_history_collection.update_one(
            {"symbol": symbol, "date": date_str},
            {
                "$set": {
                    "symbol": symbol,
                    "date": date_str,
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": int(row["Volume"]),
                    "source": "yfinance",
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now
                }
            },
            upsert=True
        )


def mongo_docs_to_dataframe(docs):
    if not docs:
        return None

    df = pd.DataFrame(docs)

    df.rename(columns={
        "open": "Open",
        "high": "High",
        "low": "Low",
        "close": "Close",
        "volume": "Volume"
    }, inplace=True)

    df["date"] = pd.to_datetime(df["date"])
    df.set_index("date", inplace=True)
    df.sort_index(inplace=True)

    return df[REQUIRED_COLS]


def get_cached_price_history(symbol: str, min_rows: int = 50):
    docs = list(
        stock_price_history_collection.find(
            {"symbol": symbol.upper()},
            {
                "_id": 0,
                "date": 1,
                "open": 1,
                "high": 1,
                "low": 1,
                "close": 1,
                "volume": 1,
            }
        ).sort("date", 1)
    )

    if len(docs) < min_rows:
        return None

    return mongo_docs_to_dataframe(docs)

def download_price_history(symbol: str, period: str = "6mo"):
    symbol = symbol.upper()
    ticker = yf.Ticker(symbol)
    error_msg = None
    
    try:
        df = ticker.history(period=period)
    except Exception as history_error:
        print(f"ticker.history() failed for {symbol}: {history_error}")
        df = None
    
    # If history() fails or returns empty, try alternative method
    if df is None or (hasattr(df, 'empty') and df.empty):
        print(f"First attempt failed, trying yf.download() for {symbol}")
        # Fallback: try download method
        try:
            df = yf.download(symbol.upper(), period=period, progress=False)
            # yf.download can return empty DataFrame if it fails silently
            # Also handle MultiIndex columns from download
            if df is not None and not df.empty and isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
        except Exception as download_error:
            error_msg = f"Failed to download data for symbol {symbol}: {str(download_error)}"
            print(error_msg)
            import traceback
            traceback.print_exc()
            return None, error_msg
            
    if df is None or (hasattr(df, 'empty') and df.empty):
        error_msg = f"Failed to download data for symbol {symbol}. Please check if the symbol is valid and try again."
        print(error_msg)
        print(f"Ticker object created: {ticker}")
        print(f"DataFrame shape: {df.shape if df is not None else 'None'}")
        return None, error_msg

    # Handle MultiIndex columns (yfinance sometimes returns these)
    if isinstance(df.columns, pd.MultiIndex):
        # Flatten column names by taking the first level
        df.columns = df.columns.get_level_values(0)

    # Ensure we have the required columns
    required_cols = ["Open", "High", "Low", "Close", "Volume"]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        error_msg = f"Missing required columns: {missing_cols}. Available: {df.columns.tolist()}"
        print(error_msg)
        return None, error_msg

    # Need at least 50 rows for SMA_50 to work
    if len(df) < 50:
        error_msg = f"Insufficient data: only {len(df)} rows available, need at least 50"
        print(error_msg)
        return None, error_msg
    
    return df,None

def get_redis_cached_result(key: str, min_rows: int):
    redis_cached_data = get_cache(key)

    if not redis_cached_data:
        return None

    df = pd.DataFrame(redis_cached_data)

    if len(df) < min_rows:
        return None

    df["date"] = pd.to_datetime(df["date"])#because in redis we by default store in str form
    df.set_index("date", inplace=True)#make date index
    df.sort_index(inplace=True)

    return df[REQUIRED_COLS]


def set_redis_cache(key: str, df: pd.DataFrame):
    cache_df = df.copy()

    cache_df = cache_df[REQUIRED_COLS]
    cache_df = cache_df.reset_index()

    cache_df.rename(columns={"index": "date"}, inplace=True)

    cache_df["date"] = cache_df["date"].astype(str)

    data = cache_df.to_dict(orient="records")#converts rows into list of dictionaries with column namw serving as keys 

    set_cache(key, data, ttl=60 * 60 * 6)
     
def get_price_history(symbol: str, period: str = "1y", min_rows=None):
    symbol = symbol.upper()
    
    #check if present in redis cache first
    cache_key = stock_history_key(symbol)
    redis_cached_df = get_redis_cached_result(cache_key, min_rows)

    if redis_cached_df is not None:
        return redis_cached_df, None
    
    
    cached_df = get_cached_price_history(symbol, min_rows=min_rows)

    if cached_df is not None and len(cached_df) >= min_rows:
        #before returning set cache
        set_redis_cache(cache_key, cached_df)
        return cached_df, None
   
    df, error_msg = download_price_history(symbol, period=period)

    if df is None:
        return None, error_msg

    save_price_history(symbol, df)
    
    #cache the stock_history
    set_redis_cache(cache_key, df)
    
    return df, None

def get_current_price_info(symbol: str, df: pd.DataFrame):
    symbol = symbol.upper()
    ticker = yf.Ticker(symbol)

    current_price = None
    prev_close = None

    try:
        fast = ticker.fast_info
        current_price = fast.get("last_price")
        prev_close = fast.get("previous_close")
    except Exception:
        pass

    if prev_close is None and len(df) >= 2:
        prev_close = df["Close"].iloc[-2]

    if current_price is None and len(df) >= 1:
        current_price = df["Close"].iloc[-1]

    if prev_close is not None and prev_close != 0 and current_price is not None:
        price_change_pct = round((current_price - prev_close) / prev_close * 100, 2)
    else:
        price_change_pct = None

    return current_price, prev_close, price_change_pct #okok prev_close is used here 
