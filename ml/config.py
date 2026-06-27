"""Central configuration for the model-v2 training pipeline.

Everything that defines the *model contract* or the *experiment* lives here so
the run is reproducible and auditable from a single file.
"""

import os

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
ML_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(ML_DIR, "data", "raw")
MODELS_DIR = os.path.join(ML_DIR, "models")
REPORTS_DIR = os.path.join(ML_DIR, "reports")

# Output artifact for the NEW model. We deliberately do NOT touch the live
# backend/model/stock_risk_model.pkl — the swap is a separate, reviewed step.
V2_MODEL_PATH = os.path.join(MODELS_DIR, "stock_risk_model_v2.pkl")
THRESHOLD_PATH = os.path.join(MODELS_DIR, "decision_threshold.json")
COMPARISON_REPORT_PATH = os.path.join(REPORTS_DIR, "comparison_report.md")

for _d in (RAW_DIR, MODELS_DIR, REPORTS_DIR):
    os.makedirs(_d, exist_ok=True)

# --------------------------------------------------------------------------- #
# Data universe  (matches the original Colab notebooks for a fair comparison)
# --------------------------------------------------------------------------- #
TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
    "META", "NVDA", "NFLX", "JPM", "DIS",
]

# Market benchmark used to build the market-relative return feature.
# See README: SPY generalises "mean return of all tickers" to a proper market
# index so the feature is computable for ANY ticker at inference time, not just
# the 10 training tickers. The SAME definition is used in train and serve.
MARKET_BENCHMARK = "SPY"

START_DATE = "2019-01-01"
END_DATE = "2024-12-31"

# --------------------------------------------------------------------------- #
# Label — vol-regime: forward N-day realized vol in top tercile (per ticker)
# --------------------------------------------------------------------------- #
# Predicts P(forward-10d realized vol > 67th pctile of that ticker's own
# trailing 252-day vol distribution). 252d window lets regime shocks (COVID,
# 2022 bear) expire from the cutoff after ~1 year, keeping the positive rate
# stable across splits (~33%).  Cutoff is shifted N_FORWARD days back so the
# window never overlaps the current forward window — zero leakage.
VOL_REGIME_N_FORWARD   = 10   # forward days for realized vol
VOL_REGIME_ROLL_WINDOW = 252  # trailing window for per-ticker tercile cutoff
VOL_REGIME_MIN_HISTORY = 63   # min past obs before emitting a label (~3 months)

# Kept so add_features(with_label=True) still works; not used by the pipeline.
LABEL_HORIZON_DAYS   = 7
LABEL_DROP_THRESHOLD = -0.05

# --------------------------------------------------------------------------- #
# Feature contract
# --------------------------------------------------------------------------- #
# NEW model features — all scale-free so they transfer across tickers of very
# different price levels (defect b) and with low collinearity (defect d).
MODEL_FEATURES = [
    "rsi",                 # momentum oscillator, already 0-100 (scale-free)
    "macd_norm",           # MACD / Close  -> scale-free version of MACD
    "atr_pct",             # ATR(14) / Close -> scale-free volatility
    "close_to_sma20",      # Close / SMA20 - 1  -> distance from short trend
    "sma20_to_sma50",      # SMA20 / SMA50 - 1  -> trend slope (replaces raw SMAs)
    "vol_zscore",          # 20d z-score of Volume -> relative volume
    "dist_from_high_20",   # Close / 20d-high - 1  (<= 0)
    "dist_from_low_20",    # Close / 20d-low  - 1  (>= 0)
    "return_5d",           # 5d return (already scale-free)
    "mkt_rel_ret_5d",      # 5d return minus market 5d return (cross-sectional)
]

# OLD model features — exactly what v1 (the live RF) was trained on. Kept ONLY
# so we can rebuild the baseline and score it on the same time-based test set.
OLD_FEATURES = [
    "rsi", "macd", "volatility", "sma_20", "sma_50", "return_5d", "return_20d",
]

# Raw columns the backend needs for the human-readable reasons / notification
# text even though they are NOT model inputs anymore. build_features keeps them
# as side columns so prediction.py and scanner.py keep working unchanged.
SIDE_COLUMNS = ["sma_20", "sma_50", "volatility", "macd"]

# --------------------------------------------------------------------------- #
# Time-based split  (NO shuffling, train on past / test on future)
# --------------------------------------------------------------------------- #
TRAIN_FRAC = 0.70   # earliest 70% of trading dates
VAL_FRAC = 0.15     # next 15% — combined with train for CV threshold tuning
# remaining 15% -> test (most recent), evaluated once
EMBARGO_DAYS = VOL_REGIME_N_FORWARD  # must be >= N_FORWARD so no forward window bleeds

# --------------------------------------------------------------------------- #
# Model hyperparameters
# --------------------------------------------------------------------------- #
RANDOM_STATE = 42

# Baseline RandomForest — identical to the original v1 notebook so the
# comparison isolates the effect of the new features + proper split.
RF_PARAMS = dict(
    n_estimators=200,
    max_depth=8,
    random_state=RANDOM_STATE,
    class_weight="balanced",
    n_jobs=-1,
)

# New XGBoost. scale_pos_weight handles the ~13% positive class (defect c).
# It is set at train time to (#neg / #pos) on the training split.
XGB_PARAMS = dict(
    n_estimators=400,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=5,
    reg_lambda=1.0,
    objective="binary:logistic",
    eval_metric="aucpr",
    random_state=RANDOM_STATE,
    n_jobs=-1,
)

N_CV_SPLITS = 5  # TimeSeriesSplit folds for the CV sanity check
