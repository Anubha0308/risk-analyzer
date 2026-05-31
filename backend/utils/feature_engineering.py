import pandas as pd
import numpy as np
import pandas_ta as ta
import yfinance as yf
from utils.market_data import get_price_history,get_current_price_info
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
    Returns (DataFrame or None, chart_data or None, current_price or None, error_message or None)
    """
    error_msg = None
    
    try:
        df, error_msg = get_price_history(symbol, period="6mo", min_rows=50)

        if df is None:
            return None, None, None, None, error_msg  # 5 values

        current_price, prev_close, price_change_pct = get_current_price_info(symbol, df)

        chart_data = _prepare_chart_data(df.copy())

        feature_row = build_features(df.copy())

        if feature_row is None:
            error_msg = "build_features returned None - likely all rows dropped due to NaN values"
            return None, None, None, None, error_msg  # 5 values

        return feature_row.to_frame().T, chart_data, price_change_pct, current_price, None

    except ValueError as ve:
        error_msg = f"ValueError in feature engineering: {str(ve)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return None, None, None, None, error_msg  # 5 values
    
    except Exception as e:
        error_msg = f"Unexpected error fetching features for {symbol}: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return None, None, None, None, error_msg  # 5 values
