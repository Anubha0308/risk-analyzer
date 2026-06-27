"""Scale-free feature engineering — the single source of truth for v2.

The exact same formulas are mirrored in
``backend/utils/feature_engineering.py`` for inference. If you change a formula
here, change it there too (and retrain). The two files are kept separate only
because the backend is what gets deployed; ml/ is the training harness.

Design goals (see ml/README.md for the full rationale):
  * every model feature is SCALE-FREE so it transfers across tickers whose
    prices differ by 10-100x (defect b);
  * features are chosen to minimise collinearity (defect d);
  * raw SMA20/SMA50/volatility/macd are kept as NON-model side columns so the
    backend's reason/notification text keeps working unchanged.
"""

import numpy as np
import pandas as pd
import pandas_ta as ta

from ml import config


def _market_return_5d(benchmark_close: pd.Series) -> pd.Series:
    """5-day return of the market benchmark, indexed by date."""
    ret = benchmark_close.pct_change(5, fill_method=None)
    ret.name = "mkt_ret_5d"
    return ret


def add_features(
    df: pd.DataFrame,
    benchmark_close: pd.Series,
    with_label: bool = True,
) -> pd.DataFrame:
    """Add all model features + side columns (+ label) to one ticker's OHLCV.

    Parameters
    ----------
    df : OHLCV DataFrame indexed by datetime (columns Open/High/Low/Close/Volume)
    benchmark_close : market benchmark Close series indexed by datetime
    with_label : whether to compute the forward-looking training label
    """
    df = df.copy()
    close = df["Close"]

    # ---- raw indicators (some become side columns, some feed scale-free feats)
    df["rsi"] = ta.rsi(close, length=14)

    macd_res = ta.macd(close)
    if macd_res is not None and "MACD_12_26_9" in macd_res.columns:
        df["macd"] = macd_res["MACD_12_26_9"]
    else:
        df["macd"] = np.nan

    df["sma_20"] = ta.sma(close, length=20)
    df["sma_50"] = ta.sma(close, length=50)
    df["volatility"] = close.pct_change(fill_method=None).rolling(10).std()

    atr = ta.atr(df["High"], df["Low"], close, length=14)
    df["return_5d"] = close.pct_change(5, fill_method=None)
    df["return_20d"] = close.pct_change(20, fill_method=None)

    # ---- scale-free model features ----------------------------------------
    df["macd_norm"] = df["macd"] / close
    df["atr_pct"] = atr / close
    df["close_to_sma20"] = close / df["sma_20"] - 1.0
    df["sma20_to_sma50"] = df["sma_20"] / df["sma_50"] - 1.0

    vol_mean = df["Volume"].rolling(20).mean()
    vol_std = df["Volume"].rolling(20).std()
    df["vol_zscore"] = (df["Volume"] - vol_mean) / vol_std

    df["dist_from_high_20"] = close / close.rolling(20).max() - 1.0
    df["dist_from_low_20"] = close / close.rolling(20).min() - 1.0

    # market-relative momentum: stock 5d return minus market 5d return
    mkt_ret = _market_return_5d(benchmark_close)
    df = df.join(mkt_ret, how="left")
    df["mkt_rel_ret_5d"] = df["return_5d"] - df["mkt_ret_5d"]

    # ---- label (forward 7-day drop > 5%) ----------------------------------
    if with_label:
        fwd = close.shift(-config.LABEL_HORIZON_DAYS) / close - 1.0
        df["label"] = (fwd < config.LABEL_DROP_THRESHOLD).astype(int)

    return df


def build_training_frame(
    universe: dict[str, pd.DataFrame],
    benchmark: pd.DataFrame,
) -> pd.DataFrame:
    """Combine every ticker into one long, date-indexed training DataFrame.

    Label: vol_regime = 1 when forward-N-day realized vol exceeds the per-ticker
    67th percentile of a trailing ROLL_WINDOW-day distribution (cutoff derived
    from past data only — zero leakage).  Base rate is stable (~33%) across
    splits because the rolling window lets regime shocks expire.

    Output columns include all MODEL_FEATURES, OLD_FEATURES, SIDE_COLUMNS plus
    'stock', 'date', 'forward_vol', and 'label'.
    """
    benchmark_close = benchmark["Close"]
    needed = sorted(set(config.MODEL_FEATURES) | set(config.OLD_FEATURES))
    frames = []

    for symbol, df in universe.items():
        feat = add_features(df, benchmark_close, with_label=False)

        # Forward realized vol: std of daily returns over next N_FORWARD days
        ret = feat["Close"].pct_change(fill_method=None)
        feat["forward_vol"] = ret.rolling(config.VOL_REGIME_N_FORWARD).std().shift(
            -config.VOL_REGIME_N_FORWARD
        )

        # Per-ticker rolling tercile cutoff (shifted N_FORWARD back → no overlap)
        fwd_shifted = feat["forward_vol"].shift(config.VOL_REGIME_N_FORWARD)
        cutoff = fwd_shifted.rolling(
            config.VOL_REGIME_ROLL_WINDOW,
            min_periods=config.VOL_REGIME_MIN_HISTORY,
        ).quantile(2 / 3)

        feat["label"] = np.where(
            cutoff.isna() | feat["forward_vol"].isna(),
            np.nan,
            (feat["forward_vol"] > cutoff).astype(float),
        )

        feat["stock"] = symbol
        feat["date"] = feat.index
        feat = feat.dropna(subset=needed + ["label"])
        feat["label"] = feat["label"].astype(int)
        frames.append(feat)

    combined = pd.concat(frames, ignore_index=True)
    combined.sort_values(["date", "stock"], inplace=True)
    combined.reset_index(drop=True, inplace=True)
    return combined
