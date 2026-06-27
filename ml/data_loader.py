"""Raw OHLCV loading for the training pipeline.

Downloads daily bars once via yfinance and caches them to ``ml/data/raw`` as
CSVs so re-runs are fast and fully reproducible (offline after the first run).
"""

import os
import pandas as pd
import yfinance as yf

from ml import config

REQUIRED_COLS = ["Open", "High", "Low", "Close", "Volume"]


def _csv_path(symbol: str) -> str:
    return os.path.join(config.RAW_DIR, f"{symbol.upper()}.csv")


def _flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    """yfinance can return MultiIndex columns for a single ticker; flatten them."""
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df


def download_symbol(symbol: str, force: bool = False) -> pd.DataFrame:
    """Return a clean OHLCV DataFrame indexed by date, using the CSV cache."""
    path = _csv_path(symbol)

    if os.path.exists(path) and not force:
        df = pd.read_csv(path, index_col=0, parse_dates=True)
    else:
        raw = yf.download(
            symbol,
            start=config.START_DATE,
            end=config.END_DATE,
            auto_adjust=True,
            progress=False,
        )
        if raw is None or raw.empty:
            raise RuntimeError(f"yfinance returned no data for {symbol}")
        raw = _flatten_columns(raw)
        raw.index.name = "Date"
        raw.to_csv(path)
        df = raw

    df = _flatten_columns(df)
    df[REQUIRED_COLS] = df[REQUIRED_COLS].apply(pd.to_numeric, errors="coerce")
    df = df[REQUIRED_COLS].dropna()
    df.index = pd.to_datetime(df.index)
    df.sort_index(inplace=True)
    return df


def load_universe(force: bool = False) -> dict[str, pd.DataFrame]:
    """Load all training tickers. Returns {symbol: OHLCV DataFrame}."""
    data = {}
    for symbol in config.TICKERS:
        print(f"  loading {symbol} ...")
        data[symbol] = download_symbol(symbol, force=force)
    return data


def load_benchmark(force: bool = False) -> pd.DataFrame:
    """Load the market benchmark (SPY) OHLCV used for market-relative return."""
    print(f"  loading benchmark {config.MARKET_BENCHMARK} ...")
    return download_symbol(config.MARKET_BENCHMARK, force=force)
