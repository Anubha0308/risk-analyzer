"""Model builders, the strict time-based split, and threshold tuning."""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score
from sklearn.model_selection import TimeSeriesSplit
from xgboost import XGBClassifier

from ml import config


# --------------------------------------------------------------------------- #
# Strict time-based split (defect a): earliest dates -> train, latest -> test.
# No row shuffling. An embargo gap purges rows whose forward label would peek
# across a split boundary.
# --------------------------------------------------------------------------- #
def time_based_split(df: pd.DataFrame):
    """Split the combined frame chronologically into train / val / test.

    Boundaries are computed on the set of unique trading dates (shared across
    all tickers) so the whole cross-section moves forward together.
    Returns (train_df, val_df, test_df).
    """
    dates = np.sort(df["date"].unique())
    n = len(dates)
    train_end = int(n * config.TRAIN_FRAC)
    val_end = int(n * (config.TRAIN_FRAC + config.VAL_FRAC))

    train_dates = dates[:train_end]
    val_dates = dates[train_end:val_end]
    test_dates = dates[val_end:]

    # Embargo: drop the last EMBARGO_DAYS trading dates of train (and of val) so
    # a 7-day-forward label in the earlier split cannot use prices that fall in
    # the next split.
    emb = config.EMBARGO_DAYS
    train_dates = train_dates[:-emb] if emb and len(train_dates) > emb else train_dates
    val_dates = val_dates[:-emb] if emb and len(val_dates) > emb else val_dates

    train_df = df[df["date"].isin(train_dates)].copy()
    val_df = df[df["date"].isin(val_dates)].copy()
    test_df = df[df["date"].isin(test_dates)].copy()
    return train_df, val_df, test_df


# --------------------------------------------------------------------------- #
# Model builders
# --------------------------------------------------------------------------- #
def build_rf() -> RandomForestClassifier:
    """Baseline RandomForest, identical to the original v1 notebook."""
    return RandomForestClassifier(**config.RF_PARAMS)


def build_xgb(y_train: pd.Series) -> XGBClassifier:
    """XGBoost with scale_pos_weight set from the training class balance."""
    pos = int((y_train == 1).sum())
    neg = int((y_train == 0).sum())
    spw = (neg / pos) if pos else 1.0
    return XGBClassifier(scale_pos_weight=spw, **config.XGB_PARAMS)


# --------------------------------------------------------------------------- #
# Threshold tuning on the validation set for positive-class F1 (defect c).
# The model's risk_score stays a probability; this threshold is the binary
# risky/not-risky cut used for evaluation and reported for the swap reviewer.
# --------------------------------------------------------------------------- #
def tune_threshold(y_true, proba, grid=None) -> tuple[float, float]:
    """Return (best_threshold, best_f1) maximising positive-class F1."""
    if grid is None:
        grid = np.linspace(0.05, 0.95, 91)
    best_t, best_f1 = 0.5, -1.0
    for t in grid:
        f1 = f1_score(y_true, (proba >= t).astype(int), zero_division=0)
        if f1 > best_f1:
            best_f1, best_t = f1, float(t)
    return best_t, best_f1


def tune_threshold_balanced(y_true, proba, grid=None) -> tuple[float, float]:
    """Return (threshold, f1) where |precision − recall| is minimised.

    Avoids the degenerate "predict everything positive" solution that maximises
    raw F1 when the positive-class rate is high (~33%).  The balanced operating
    point keeps both precision and recall meaningful.
    """
    from sklearn.metrics import precision_recall_fscore_support as prf

    if grid is None:
        grid = np.linspace(0.05, 0.95, 91)
    arr = np.asarray(proba, dtype=float)

    best_t, best_f1, min_gap = 0.5, 0.0, float("inf")
    for t in grid:
        preds = (arr >= t).astype(int)
        p, r, f, _ = prf(y_true, preds, labels=[1], average="binary", zero_division=0)
        p, r, f = float(p), float(r), float(f)
        if f <= 0:
            continue
        gap = abs(p - r)
        if gap < min_gap or (gap == min_gap and f > best_f1):
            min_gap, best_t, best_f1 = gap, t, f
    return float(best_t), float(best_f1)


def tune_threshold_via_cv(
    model_factory,
    X: pd.DataFrame,
    y: pd.Series,
    grid=None,
) -> tuple[float, float]:
    """Pool held-out probabilities across TimeSeriesSplit CV folds, then find
    the threshold where precision ≈ recall (balanced operating point).

    Using the balanced criterion rather than raw-F1 max avoids the degenerate
    "predict everything positive" solution that maximises F1 at high base rates.
    """
    tscv = TimeSeriesSplit(n_splits=config.N_CV_SPLITS)
    all_proba: list[float] = []
    all_labels: list[int] = []
    for tr_idx, va_idx in tscv.split(X):
        mdl = model_factory(y.iloc[tr_idx])
        mdl.fit(X.iloc[tr_idx], y.iloc[tr_idx])
        proba = mdl.predict_proba(X.iloc[va_idx])[:, 1]
        all_proba.extend(proba.tolist())
        all_labels.extend(y.iloc[va_idx].tolist())
    return tune_threshold_balanced(np.array(all_labels), np.array(all_proba), grid=grid)


def timeseries_cv_pr_auc(model_factory, X: pd.DataFrame, y: pd.Series) -> list[float]:
    """TimeSeriesSplit CV sanity check; returns per-fold PR-AUC of positive class."""
    from sklearn.metrics import average_precision_score

    tscv = TimeSeriesSplit(n_splits=config.N_CV_SPLITS)
    scores = []
    for tr_idx, va_idx in tscv.split(X):
        mdl = model_factory(y.iloc[tr_idx])
        mdl.fit(X.iloc[tr_idx], y.iloc[tr_idx])
        proba = mdl.predict_proba(X.iloc[va_idx])[:, 1]
        scores.append(float(average_precision_score(y.iloc[va_idx], proba)))
    return scores
