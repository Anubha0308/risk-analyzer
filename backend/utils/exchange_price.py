import yfinance as yf

def get_exchange_rate(from_currency: str, to_currency: str) -> float:
    
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()
    
    if from_currency == to_currency:
        return 1.0
        
    pair_symbol = f"{from_currency}{to_currency}=X"
    try:
        ticker = yf.Ticker(pair_symbol)
        live_rate = ticker.fast_info.get("last_price")
        
        if live_rate is None:
            # Fallback to history check if fast_info fails
            df = ticker.history(period="1d")
            if not df.empty:
                live_rate = float(df["Close"].iloc[-1])
                
        if live_rate:
            return float(live_rate)
            
        raise ValueError("Could not extract rate values.")
    except Exception as e:
        print(f"FX Fetch failed for {pair_symbol}: {e}. Falling back to standard estimates.")
        fallbacks = {
            "USDINR": 83.5,
            "INRUSD": 0.012
        }
        return fallbacks.get(f"{from_currency}{to_currency}", 1.0)