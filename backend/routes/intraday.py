from fastapi import APIRouter, Depends
import yfinance as yf
from auth_utils import get_current_user

router = APIRouter()

def _prepare_intraday_data(symbol : str):
    try:
        df = yf.Ticker(symbol.upper()).history(period="1d", interval="30m")
        if df is None or df.empty:
            # Fallback to a wider window if the market hasn't opened yet today
            df = yf.Ticker(symbol).history(period="1d", interval="60m")
            if df is None or df.empty:
                return None
        df=df.reset_index()
        
        if "Datetime" in df.columns:
            time_series = df["Datetime"].dt.strftime("%H:%M")#datetime object into formatted date string
        elif "Date" in df.columns:
            time_series = df["Date"].dt.strftime("%H:%M")
        else:
            return None
        
        return {
            "times": time_series.tolist(),
            "prices" : df["Close"].round(2).tolist(),
            "volume" : df["Volume"].astype(int).tolist()
        }
        
    except Exception as e:
        print(f"Failed to compile intraday chart for {symbol}: {e}")
        return None
    
    
@router.get("/intraday-chart/{symbol}")
def get_intraday(symbol : str, user: str = Depends(get_current_user)):
    return _prepare_intraday_data(symbol)