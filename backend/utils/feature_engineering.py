import pandas as pd
import numpy as np
import pandas_ta as ta
from utils.market_data import get_price_history,get_current_price_info
# -------------------------------------------------
# FEATURES (must match training-time order exactly)
#
# NOTE: these formulas mirror ml/features.py (the training pipeline). If you
# change one, change it there too and retrain. The model-v2 feature set is
# scale-free so it transfers across tickers of very different price levels.
# -------------------------------------------------
FEATURES = [
    "rsi",
    "macd_norm",
    "atr_pct",
    "close_to_sma20",
    "sma20_to_sma50",
    "vol_zscore",
    "dist_from_high_20",
    "dist_from_low_20",
    "return_5d",
    "mkt_rel_ret_5d",
]

# Raw columns kept on the returned row for the human-readable reasons /
# notification text only. They are NOT model inputs (callers select FEATURES).
SIDE_COLUMNS = ["sma_20", "sma_50", "volatility", "macd"]

# Market benchmark for the market-relative return feature (same as training).
MARKET_BENCHMARK = "SPY"


def _benchmark_return_5d(index: pd.DatetimeIndex) -> pd.Series:
    """5-day return of the market benchmark, aligned to ``index``.

    Returns a Series of 0.0 (neutral) if the benchmark can't be fetched so a
    transient data issue degrades rather than breaks predictions.
    """
    try:
        spy_df, _ = get_price_history(MARKET_BENCHMARK, period="6mo", min_rows=50)
        if spy_df is None or spy_df.empty:
            raise ValueError("benchmark history unavailable")
        spy_ret = spy_df["Close"].pct_change(5, fill_method=None)
        spy_ret.index = pd.to_datetime(spy_ret.index).tz_localize(None).normalize()
        aligned = spy_ret.reindex(
            pd.to_datetime(index).tz_localize(None).normalize()
        )
        aligned.index = index
        return aligned
    except Exception as e:
        print(f"⚠️  benchmark return unavailable ({e}); using 0.0 (neutral)")
        return pd.Series(0.0, index=index)


# -------------------------------------------------
# Build features from raw OHLCV dataframe
# -------------------------------------------------
def build_features(df: pd.DataFrame) -> pd.Series:
    """
    Builds model-ready features from raw OHLCV stock data.
    Used internally for inference. Returns the latest row containing the model
    FEATURES (in order) plus SIDE_COLUMNS for the reason/notification text.
    """

    # Ensure numeric types
    numeric_cols = ["Open", "High", "Low", "Close", "Volume"]
    # Only convert columns that exist
    existing_cols = [col for col in numeric_cols if col in df.columns]
    if existing_cols:
        df[existing_cols] = df[existing_cols].apply(pd.to_numeric, errors="coerce")

    close = df["Close"]

    # ---- raw indicators (side columns + inputs to scale-free features) ----
    df["rsi"] = ta.rsi(close, length=14)

    # MACD - pandas_ta.macd returns DataFrame with columns: MACD_12_26_9, ...
    macd_result = ta.macd(close)
    if macd_result is not None and not macd_result.empty and "MACD_12_26_9" in macd_result.columns:
        df["macd"] = macd_result["MACD_12_26_9"]
    else:
        df["macd"] = np.nan

    df["volatility"] = close.pct_change(fill_method=None).rolling(10).std()
    df["sma_20"] = ta.sma(close, length=20)
    df["sma_50"] = ta.sma(close, length=50)

    atr = ta.atr(df["High"], df["Low"], close, length=14)
    df["return_5d"] = close.pct_change(5, fill_method=None)

    # ---- scale-free model features (mirror ml/features.py) ----------------
    df["macd_norm"] = df["macd"] / close
    df["atr_pct"] = atr / close
    df["close_to_sma20"] = close / df["sma_20"] - 1.0
    df["sma20_to_sma50"] = df["sma_20"] / df["sma_50"] - 1.0

    vol_mean = df["Volume"].rolling(20).mean()
    vol_std = df["Volume"].rolling(20).std()
    df["vol_zscore"] = (df["Volume"] - vol_mean) / vol_std

    df["dist_from_high_20"] = close / close.rolling(20).max() - 1.0
    df["dist_from_low_20"] = close / close.rolling(20).min() - 1.0

    # market-relative momentum (same benchmark/definition as training)
    df["mkt_rel_ret_5d"] = df["return_5d"] - _benchmark_return_5d(df.index)

    # Drop incomplete rows (but keep track of original length)
    original_len = len(df)
    needed = list(dict.fromkeys(FEATURES + SIDE_COLUMNS))
    df.dropna(subset=needed, inplace=True)

    if df.empty:
        raise ValueError(f"All {original_len} rows were dropped due to NaN values after feature calculation")

    # Ensure all features are present
    missing_features = [f for f in needed if f not in df.columns]
    if missing_features:
        raise ValueError(f"Missing required features: {missing_features}")

    # Return latest row with FEATURES (in order) + side columns
    feature_row = df[needed].iloc[-1]

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
    chart_df["volatility"] = chart_df["Close"].pct_change(fill_method= None).rolling(10).std()

    # Remove rows that still have NaNs after indicator calculation
    chart_df.dropna(subset=["Close", "sma_20", "sma_50", "volatility"], inplace=True)

    # Keep the most recent 90 trading days
    chart_df = chart_df.tail(90)

    if chart_df.empty:
        return None
    
    #this already is in JSON form i think because goint to frontend for graph plotting
    return {
        "dates": chart_df.index.strftime("%Y-%m-%d").tolist(),
        "price": chart_df["Close"].round(2).tolist(),
        "sma_20": chart_df["sma_20"].round(2).tolist(),
        "sma_50": chart_df["sma_50"].round(2).tolist(),
        "volatility": chart_df["volatility"].round(4).tolist(),
    }

    
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
