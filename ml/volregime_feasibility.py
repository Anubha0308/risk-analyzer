"""Volatility-regime label — feasibility check (standalone, read-only).

Hypothesis: forward-10d realized vol in the top tercile per ticker is more
learnable from our existing scale-free features than the 7-day-drop label.

Writes ONLY: ml/reports/volregime_feasibility.md
Changes nothing else.

Run from repo root:
    NUMBA_DISABLE_JIT=1 backend/venv/Scripts/python.exe -m ml.volregime_feasibility
"""

import os

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_fscore_support,
)

from ml import config, data_loader, features
from ml.model import build_xgb, tune_threshold

N_FORWARD = 10          # days ahead for realized vol
EMBARGO = N_FORWARD     # ≥ N_FORWARD so no forward window bleeds across a boundary
REPORT_PATH = os.path.join(config.REPORTS_DIR, "volregime_feasibility.md")


# ---------------------------------------------------------------------------
# Frame construction
# ---------------------------------------------------------------------------

def _build_frame(universe: dict, benchmark: pd.DataFrame) -> pd.DataFrame:
    benchmark_close = benchmark["Close"]
    needed = sorted(set(config.MODEL_FEATURES) | set(config.OLD_FEATURES))
    frames = []
    for symbol, raw_df in universe.items():
        feat = features.add_features(raw_df, benchmark_close, with_label=False)
        ret = feat["Close"].pct_change(fill_method=None)
        # forward_vol[i] = std(ret[i+1] .. ret[i+N])
        feat["forward_vol"] = ret.rolling(N_FORWARD).std().shift(-N_FORWARD)
        feat["trailing_vol"] = feat["volatility"]   # 10d trailing std, already present
        feat["stock"] = symbol
        feat["date"] = feat.index
        feat = feat.dropna(subset=needed + ["forward_vol"])
        frames.append(feat)
    combined = pd.concat(frames, ignore_index=True)
    combined.sort_values(["date", "stock"], inplace=True)
    combined.reset_index(drop=True, inplace=True)
    return combined


# ---------------------------------------------------------------------------
# Split  (same 70/15/15 fractions; embargo = N_FORWARD for clean boundaries)
# ---------------------------------------------------------------------------

def _split(df: pd.DataFrame):
    dates = np.sort(df["date"].unique())
    n = len(dates)
    train_end = int(n * config.TRAIN_FRAC)
    val_end   = int(n * (config.TRAIN_FRAC + config.VAL_FRAC))

    train_dates = dates[:train_end]
    val_dates   = dates[train_end:val_end]
    test_dates  = dates[val_end:]

    train_dates = train_dates[:-EMBARGO] if len(train_dates) > EMBARGO else train_dates
    val_dates   = val_dates[:-EMBARGO]   if len(val_dates)   > EMBARGO else val_dates

    return (
        df[df["date"].isin(train_dates)].copy(),
        df[df["date"].isin(val_dates)].copy(),
        df[df["date"].isin(test_dates)].copy(),
    )


# ---------------------------------------------------------------------------
# Label assignment  (tercile cutoffs derived from training rows only)
# ---------------------------------------------------------------------------

def _assign_labels(target_df: pd.DataFrame, train_df: pd.DataFrame) -> pd.DataFrame:
    """Add vol_regime and trailing_tercile columns to target_df."""
    out = target_df.copy()
    out["vol_regime"]       = -1
    out["trailing_tercile"] = -1

    for symbol in out["stock"].unique():
        sym_m   = out["stock"] == symbol
        tr_rows = train_df[train_df["stock"] == symbol]
        if tr_rows.empty:
            continue
        fwd_cut = tr_rows["forward_vol"].quantile(2 / 3)
        trl_cut = tr_rows["trailing_vol"].quantile(2 / 3)
        out.loc[sym_m, "vol_regime"]       = (out.loc[sym_m, "forward_vol"]  > fwd_cut).astype(int)
        out.loc[sym_m, "trailing_tercile"] = (out.loc[sym_m, "trailing_vol"] > trl_cut).astype(int)

    return out


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def _metrics(y_true, proba_or_pred, threshold: float | None = None) -> dict:
    arr    = np.asarray(proba_or_pred, dtype=float)
    y_pred = (arr >= threshold).astype(int) if threshold is not None else arr.astype(int)
    p, r, f, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=[1], average="binary", zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    try:
        prauc = float(average_precision_score(y_true, arr))
    except Exception:
        prauc = None
    return dict(
        precision=round(float(p), 4),
        recall=round(float(r), 4),
        f1=round(float(f), 4),
        pr_auc=round(prauc, 4) if prauc is not None else None,
        cm=cm.tolist(),
    )


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def _render_report(
    xgb_m: dict,
    base_m: dict,
    xgb_thr: float,
    xgb_val_f1: float,
    n_total: int,
    n_pos: int,
    spw: float,
) -> str:
    def fmt_cm(cm):
        (tn, fp), (fn, tp) = cm
        return (
            f"|            | pred 0 | pred 1 |\n"
            f"|------------|-------:|-------:|\n"
            f"| **true 0** | {tn} | {fp} |\n"
            f"| **true 1** | {fn} | {tp} |"
        )

    base_rate  = 100 * n_pos / max(n_total, 1)
    prauc_str  = str(xgb_m["pr_auc"]) if xgb_m["pr_auc"] is not None else "—"

    lines = [
        "# Volatility-regime label — feasibility check",
        "",
        "**Label:** `vol_regime = 1` if the **forward 10-day realized volatility**",
        "(std of daily returns over the next 10 trading days) exceeds the",
        "**per-ticker top-tercile cutoff**. Cutoffs are derived exclusively from",
        "training-split rows to prevent leakage.",
        "",
        f"**Test set:** {n_total} samples, {n_pos} positive",
        f"({base_rate:.1f}% base rate — expected ≈ 33 % by construction).",
        "",
        "**Features:** the same 10 scale-free `MODEL_FEATURES` as the main XGBoost.",
        "",
        f"**Split:** same 70 / 15 / 15 time-based fractions; embargo = {EMBARGO} days",
        f"(increased from 7 → {EMBARGO} to match N_FORWARD so no forward window",
        "bleeds across a split boundary).",
        "",
        "---",
        "",
        "## Headline metrics (positive class, test set)",
        "",
        "| metric | XGBoost (our features) | Persistence baseline |",
        "|--------|----------------------:|--------------------:|",
        f"| threshold | {xgb_thr:.3f} (val-tuned, F1={xgb_val_f1:.3f}) | — (hard) |",
        f"| precision | {xgb_m['precision']} | {base_m['precision']} |",
        f"| recall    | {xgb_m['recall']} | {base_m['recall']} |",
        f"| F1        | {xgb_m['f1']} | {base_m['f1']} |",
        f"| PR-AUC    | {prauc_str} | — (no proba) |",
        "",
        "---",
        "",
        "## Confusion matrices",
        "",
        "**XGBoost**",
        "",
        fmt_cm(xgb_m["cm"]),
        "",
        "**Persistence baseline** (trailing 10d vol tercile → forward 10d vol tercile)",
        "",
        fmt_cm(base_m["cm"]),
        "",
        "---",
        "",
        "## Notes",
        "",
        f"- `scale_pos_weight = {spw:.2f}` — should be ≈ 2 since the class is ≈33% positive.",
        "- A random classifier at 33% base rate achieves precision ≈ 0.33 and PR-AUC ≈ 0.33.",
        "  Any model above that line has genuine signal.",
        "- Volatility clustering (GARCH-like persistence) means the persistence baseline",
        "  is a strong lower bound. If XGBoost significantly outperforms it, the additional",
        "  features are contributing beyond raw persistence.",
        "- **No existing files were modified.** This script is append-only to",
        "  `ml/reports/`. The live pkl and all v2 model files are untouched.",
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("Volatility-regime feasibility check")
    print("=" * 60)

    print("\n[1/6] Loading cached OHLCV ...")
    universe  = data_loader.load_universe()
    benchmark = data_loader.load_benchmark()

    print("\n[2/6] Building feature frame + forward_vol ...")
    df = _build_frame(universe, benchmark)
    print(f"  {df.shape[0]} rows, {df['stock'].nunique()} tickers")

    print(f"\n[3/6] Time-based split (embargo={EMBARGO}d) ...")
    train_df, val_df, test_df = _split(df)
    for name, sp in [("train", train_df), ("val", val_df), ("test", test_df)]:
        d0 = pd.Timestamp(sp["date"].min()).date()
        d1 = pd.Timestamp(sp["date"].max()).date()
        print(f"  {name:5s}: {len(sp):6d} rows | {d0} -> {d1}")

    print("\n[4/6] Assigning vol_regime labels (cutoffs from train only) ...")
    train_df = _assign_labels(train_df, train_df)
    val_df   = _assign_labels(val_df,   train_df)
    test_df  = _assign_labels(test_df,  train_df)
    for name, sp in [("train", train_df), ("val", val_df), ("test", test_df)]:
        pos = (sp["vol_regime"] == 1).sum()
        print(f"  {name:5s}: {len(sp)} rows | vol_regime=1: {pos} ({100*pos/max(len(sp),1):.1f}%)")

    print("\n[5/6] Training XGBoost on vol_regime ...")
    y_tr  = train_df["vol_regime"]
    y_val = val_df["vol_regime"]
    y_te  = test_df["vol_regime"]

    xgb = build_xgb(y_tr)
    xgb.fit(train_df[config.MODEL_FEATURES], y_tr)
    val_proba  = xgb.predict_proba(val_df[config.MODEL_FEATURES])[:, 1]
    thr, val_f1 = tune_threshold(y_val, val_proba)
    test_proba = xgb.predict_proba(test_df[config.MODEL_FEATURES])[:, 1]
    spw = xgb.get_params()["scale_pos_weight"]
    print(f"  val-tuned threshold={thr:.3f}  (val F1={val_f1:.3f})")
    print(f"  scale_pos_weight={spw:.2f}")

    print("\n[6/6] Evaluating on test set ...")
    xgb_m  = _metrics(y_te, test_proba, threshold=thr)
    base_m = _metrics(y_te, test_df["trailing_tercile"].values)
    base_m["pr_auc"] = None  # hard classifier — no probability output

    n_pos   = int((y_te == 1).sum())
    n_total = len(y_te)
    print(f"  base rate : {100*n_pos/max(n_total,1):.1f}%")
    print(f"  XGB       : P={xgb_m['precision']}  R={xgb_m['recall']}  "
          f"F1={xgb_m['f1']}  PR-AUC={xgb_m['pr_auc']}")
    print(f"  Baseline  : P={base_m['precision']}  R={base_m['recall']}  "
          f"F1={base_m['f1']}")

    report = _render_report(xgb_m, base_m, thr, val_f1, n_total, n_pos, spw)
    with open(REPORT_PATH, "w", encoding="utf-8") as fh:
        fh.write(report)
    print(f"\nReport -> {REPORT_PATH}")


if __name__ == "__main__":
    main()
