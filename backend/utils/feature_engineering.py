import pandas as pd
import numpy as np
import pandas_ta as ta

#matches training-time feature order
FEATURES = [
    "rsi",
    "macd",
    "volatility",
    "sma_20",
    "sma_50",
    "return_5d",
    "return_20d"
]

def build_features(df: pd.DataFrame) -> pd.Series:
    """
    Builds model-ready features from raw OHLCV stock data.
    Used at inference time (backend).
    """

    # Ensure numeric types
    numeric_cols = ["Open", "High", "Low", "Close", "Volume"]
    df[numeric_cols] = df[numeric_cols].apply(pd.to_numeric, errors="coerce")

    # Technical indicators
    df["rsi"] = ta.rsi(df["Close"], length=14)
    df["macd"] = ta.macd(df["Close"])["MACD_12_26_9"]
    df["volatility"] = df["Close"].pct_change().rolling(10).std()
    df["sma_20"] = ta.sma(df["Close"], length=20)
    df["sma_50"] = ta.sma(df["Close"], length=50)

    # Returns
    df["return_5d"] = df["Close"].pct_change(5)
    df["return_20d"] = df["Close"].pct_change(20)

    # Drop rows with incomplete indicators
    df.dropna(inplace=True)

    # Return latest feature row in correct order
    return df[FEATURES].iloc[-1]
