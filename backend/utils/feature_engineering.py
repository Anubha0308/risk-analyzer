import pandas as pd
import numpy as np
import pandas_ta as ta
import yfinance as yf

# -------------------------------------------------
# FEATURES (must match training-time order exactly)
# -------------------------------------------------
FEATURES = [
    "rsi",
    "macd",
    "volatility",
    "sma_20",
    "sma_50",
    "return_5d",
    "return_20d"
]

# -------------------------------------------------
# Build features from raw OHLCV dataframe
# -------------------------------------------------
def build_features(df: pd.DataFrame) -> pd.Series:
    """
    Builds model-ready features from raw OHLCV stock data.
    Used internally for inference.
    """

    # Ensure numeric types
    numeric_cols = ["Open", "High", "Low", "Close", "Volume"]
    # Only convert columns that exist
    existing_cols = [col for col in numeric_cols if col in df.columns]
    if existing_cols:
        df[existing_cols] = df[existing_cols].apply(pd.to_numeric, errors="coerce")

    # Technical indicators
    df["rsi"] = ta.rsi(df["Close"], length=14)
    
    # MACD - pandas_ta.macd returns DataFrame with columns: MACD_12_26_9, MACDs_12_26_9, MACDh_12_26_9
    macd_result = ta.macd(df["Close"])
    if macd_result is not None and not macd_result.empty and "MACD_12_26_9" in macd_result.columns:
        df["macd"] = macd_result["MACD_12_26_9"]
    else:
        # Fallback if MACD calculation fails or column name differs
        df["macd"] = np.nan
    
    df["volatility"] = df["Close"].pct_change().rolling(10).std()
    df["sma_20"] = ta.sma(df["Close"], length=20)
    df["sma_50"] = ta.sma(df["Close"], length=50)

    # Returns
    df["return_5d"] = df["Close"].pct_change(5)
    df["return_20d"] = df["Close"].pct_change(20)

    # Drop incomplete rows (but keep track of original length)
    original_len = len(df)
    df.dropna(inplace=True)
    
    if df.empty:
        raise ValueError(f"All {original_len} rows were dropped due to NaN values after feature calculation")

    # Ensure all features are present
    missing_features = [f for f in FEATURES if f not in df.columns]
    if missing_features:
        raise ValueError(f"Missing required features: {missing_features}")

    # Return latest feature row in correct order
    feature_row = df[FEATURES].iloc[-1]
    
    # Check for any NaN values in the feature row
    if feature_row.isnull().any():
        return None
    
    return feature_row


# -------------------------------------------------
# Helpers for charts
# -------------------------------------------------
def _prepare_chart_data(df: pd.DataFrame):
    """
    Build chart-ready series for the last ~90 trading days.
    """
    chart_df = df.copy()

    # Indicators needed for the frontend graphs
    chart_df["sma_20"] = ta.sma(chart_df["Close"], length=20)
    chart_df["sma_50"] = ta.sma(chart_df["Close"], length=50)
    chart_df["volatility"] = chart_df["Close"].pct_change().rolling(10).std()

    # Remove rows that still have NaNs after indicator calculation
    chart_df.dropna(subset=["Close", "sma_20", "sma_50", "volatility"], inplace=True)

    # Keep the most recent 90 trading days
    chart_df = chart_df.tail(90)

    if chart_df.empty:
        return None

    return {
        "dates": chart_df.index.strftime("%Y-%m-%d").tolist(),
        "price": chart_df["Close"].round(2).tolist(),
        "sma_20": chart_df["sma_20"].round(2).tolist(),
        "sma_50": chart_df["sma_50"].round(2).tolist(),
        "volatility": chart_df["volatility"].round(4).tolist(),
    }


# -------------------------------------------------
# PUBLIC FUNCTION USED BY FASTAPI
# -------------------------------------------------
def get_features(symbol: str):
    """
    Fetches stock data using yfinance and returns
    a single-row DataFrame suitable for ML inference.
    Returns (DataFrame or None, chart_data or None, error_message or None)
    """
    error_msg = None
    
    try:
        # Use yf.Ticker for more reliable single symbol downloads
        ticker = yf.Ticker(symbol.upper())
        
        # Try history() first
        try:
            df = ticker.history(period="6mo")
        except Exception as history_error:
            print(f"ticker.history() failed for {symbol}: {history_error}")
            df = None
        
        # If history() fails or returns empty, try alternative method
        if df is None or (hasattr(df, 'empty') and df.empty):
            print(f"First attempt failed, trying yf.download() for {symbol}")
            # Fallback: try download method
            try:
                df = yf.download(symbol.upper(), period="6mo", progress=False)
                # yf.download can return empty DataFrame if it fails silently
                # Also handle MultiIndex columns from download
                if df is not None and not df.empty and isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
            except Exception as download_error:
                error_msg = f"Failed to download data for symbol {symbol}: {str(download_error)}"
                print(error_msg)
                import traceback
                traceback.print_exc()
                return None, None, error_msg
                
        if df is None or (hasattr(df, 'empty') and df.empty):
            error_msg = f"Failed to download data for symbol {symbol}. Please check if the symbol is valid and try again."
            print(error_msg)
            print(f"Ticker object created: {ticker}")
            print(f"DataFrame shape: {df.shape if df is not None else 'None'}")
            return None, None, error_msg

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
            return None, None, error_msg

        # Need at least 50 rows for SMA_50 to work
        if len(df) < 50:
            error_msg = f"Insufficient data: only {len(df)} rows available, need at least 50"
            print(error_msg)
            return None, None, error_msg

        chart_data = _prepare_chart_data(df.copy())

        feature_row = build_features(df.copy())

        if feature_row is None:
            error_msg = "build_features returned None - likely all rows dropped due to NaN values"
            print(error_msg)
            return None, None, error_msg

        # Model expects 2D input (DataFrame, not Series)
        return feature_row.to_frame().T, chart_data, None

    except ValueError as ve:
        error_msg = f"ValueError in feature engineering: {str(ve)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return None, None, error_msg
    except Exception as e:
        error_msg = f"Unexpected error fetching features for {symbol}: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return None, None, error_msg
