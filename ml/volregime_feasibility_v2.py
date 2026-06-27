"""Volatility-regime label v2 — rolling/expanding cutoff feasibility check.

Fixes the label-construction problem in volregime_feasibility.py: fixed
per-ticker tercile cutoffs derived from 2019-2023 training data (which include
the 2020 COVID crash and 2022 bear market) don't transfer to the calm 2024 test
window, causing the base rate to collapse from ~33% → ~17%.

Fix: for each ticker on each day, the tercile cutoff is computed from an
expanding window of PAST forward vols, shifted back by N_FORWARD days so the
cutoff window never overlaps the current forward window. The cutoff adapts to the
current volatility regime, keeping the positive rate near 33% in all splits.

Writes ONLY: ml/reports/volregime_feasibility_v2.md
Changes nothing else.

Run from repo root:
    NUMBA_DISABLE_JIT=1 backend/venv/Scripts/python.exe -m ml.volregime_feasibility_v2
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

N_FORWARD    = 10   # days ahead for realized vol
ROLL_WINDOW  = 252  # rolling-window size for the tercile cutoff (~1 trading year)
MIN_HISTORY  = 63   # minimum observations before emitting a label (~3 months)
REPORT_PATH  = os.path.join(config.REPORTS_DIR, "volregime_feasibility_v2.md")


# ---------------------------------------------------------------------------
# Frame construction (same as v1)
# ---------------------------------------------------------------------------

def _build_frame(universe: dict, benchmark: pd.DataFrame) -> pd.DataFrame:
    benchmark_close = benchmark["Close"]
    needed = sorted(set(config.MODEL_FEATURES) | set(config.OLD_FEATURES))
    frames = []
    for symbol, raw_df in universe.items():
        feat = features.add_features(raw_df, benchmark_close, with_label=False)
        ret = feat["Close"].pct_change(fill_method=None)
        # forward_vol[i] = std(ret[i+1] .. ret[i+N_FORWARD])
        feat["forward_vol"]  = ret.rolling(N_FORWARD).std().shift(-N_FORWARD)
        feat["trailing_vol"] = feat["volatility"]   # 10d trailing std, already present
        feat["stock"] = symbol
        feat["date"]  = feat.index
        feat = feat.dropna(subset=needed + ["forward_vol"])
        frames.append(feat)
    combined = pd.concat(frames, ignore_index=True)
    combined.sort_values(["date", "stock"], inplace=True)
    combined.reset_index(drop=True, inplace=True)
    return combined


# ---------------------------------------------------------------------------
# Rolling/expanding labels (per ticker, zero leakage)
# ---------------------------------------------------------------------------

def _add_rolling_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    For each ticker independently (sorted by date):

      vol_regime[i] = 1  if forward_vol[i]  > expanding_67pct(forward_vol[0 .. i-N_FORWARD])
      trailing_tercile[i] = 1  if trailing_vol[i] > expanding_67pct(trailing_vol[0 .. i-1])

    Leakage proof:
      forward_vol[i]           covers ret[i+1 .. i+N_FORWARD]
      forward_vol[i-N_FORWARD] covers ret[i-N_FORWARD+1 .. i]  ← no overlap
    So shift(N_FORWARD) before rolling() ensures the cutoff never sees any
    return that feeds into forward_vol[i].

    Rolling window (ROLL_WINDOW=252 days) rather than expanding: the cutoff
    is always derived from the past ~1 trading year, so post-high-vol spikes
    (COVID 2020, 2022 bear market) expire from the window and the cutoff
    re-calibrates to the current vol regime, keeping the positive rate near
    33% across all splits.
    """
    out_frames = []
    for symbol, grp in df.groupby("stock", sort=False):
        grp = grp.sort_values("date").copy()

        # forward-vol cutoff: shift by N_FORWARD, then 252d rolling quantile
        fwd_shifted = grp["forward_vol"].shift(N_FORWARD)
        fwd_cutoff  = fwd_shifted.rolling(ROLL_WINDOW, min_periods=MIN_HISTORY).quantile(2 / 3)
        grp["vol_regime"] = np.where(
            fwd_cutoff.isna(),
            np.nan,
            (grp["forward_vol"] > fwd_cutoff).astype(float),
        )

        # trailing-vol cutoff for the persistence baseline: shift by 1
        trl_shifted = grp["trailing_vol"].shift(1)
        trl_cutoff  = trl_shifted.rolling(ROLL_WINDOW, min_periods=MIN_HISTORY).quantile(2 / 3)
        grp["trailing_tercile"] = np.where(
            trl_cutoff.isna(),
            np.nan,
            (grp["trailing_vol"] > trl_cutoff).astype(float),
        )

        out_frames.append(grp)

    result = pd.concat(out_frames, ignore_index=True)
    result.sort_values(["date", "stock"], inplace=True)
    result.reset_index(drop=True, inplace=True)
    return result


# ---------------------------------------------------------------------------
# Split (same 70/15/15 fractions; embargo = N_FORWARD for clean boundaries)
# ---------------------------------------------------------------------------

def _split(df: pd.DataFrame):
    dates = np.sort(df["date"].unique())
    n = len(dates)
    train_end = int(n * config.TRAIN_FRAC)
    val_end   = int(n * (config.TRAIN_FRAC + config.VAL_FRAC))

    train_dates = dates[:train_end]
    val_dates   = dates[train_end:val_end]
    test_dates  = dates[val_end:]

    train_dates = train_dates[:-N_FORWARD] if len(train_dates) > N_FORWARD else train_dates
    val_dates   = val_dates[:-N_FORWARD]   if len(val_dates)   > N_FORWARD else val_dates

    return (
        df[df["date"].isin(train_dates)].copy(),
        df[df["date"].isin(val_dates)].copy(),
        df[df["date"].isin(test_dates)].copy(),
    )


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def _metrics(y_true, proba_or_pred, threshold=None) -> dict:
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

def _render_report(xgb_m, base_m, xgb_thr, xgb_val_f1, split_stats, spw):
    def fmt_cm(cm):
        (tn, fp), (fn, tp) = cm
        return (
            f"|            | pred 0 | pred 1 |\n"
            f"|------------|-------:|-------:|\n"
            f"| **true 0** | {tn} | {fp} |\n"
            f"| **true 1** | {fn} | {tp} |"
        )

    n_test     = split_stats["test"]["n"]
    pos_test   = split_stats["test"]["pos"]
    base_rate  = 100 * pos_test / max(n_test, 1)
    prauc_str  = str(xgb_m["pr_auc"]) if xgb_m["pr_auc"] is not None else "—"

    split_rows = []
    for name in ("train", "val", "test"):
        s   = split_stats[name]
        pct = 100 * s["pos"] / max(s["n"], 1)
        split_rows.append(f"| {name} | {s['n']} | {s['pos']} | {pct:.1f}% |")

    lines = [
        f"# Volatility-regime label v2 — feasibility check ({ROLL_WINDOW}d rolling cutoff)",
        "",
        "## Label definition",
        "",
        "For ticker T on day i:",
        "",
        "```",
        "vol_regime[i] = 1  iff  forward_vol[i] > Q67(forward_vol[i-N_FORWARD-252 .. i-N_FORWARD])",
        "```",
        "",
        f"where `forward_vol[i]` = std of daily returns over the next {N_FORWARD} trading days,",
        f"and `Q67(...)` is the 67th percentile over a **{ROLL_WINDOW}-day rolling window**",
        f"of that ticker's own past forward vols (minimum {MIN_HISTORY} observations).",
        "",
        f"The `shift({N_FORWARD})` before rolling ensures no overlap:",
        f"`forward_vol[i-{N_FORWARD}]` covers days `i-{N_FORWARD}+1..i`; `forward_vol[i]`",
        f"covers days `i+1..i+{N_FORWARD}` — zero leakage.",
        "",
        f"**Why {ROLL_WINDOW}-day rolling instead of expanding:** the expanding window",
        "permanently accumulates the COVID-2020 and 2022-bear-market vol spikes, keeping",
        "the cutoff too high for calmer periods and causing the positive rate to collapse",
        f"out-of-sample. A {ROLL_WINDOW}-day window lets high-vol events expire from the",
        "cutoff after ~1 year, so the cutoff re-calibrates to the current vol regime.",
        "",
        "**Persistence baseline:** same 252-day rolling tercile logic on trailing 10d vol",
        "(1-day shift, same min_history).",
        "",
        "**Split:** 70 / 15 / 15 time-based, embargo = 10 days.",
        "",
        "---",
        "",
        "## Base-rate stability across splits",
        "",
        "| split | rows | positives | base rate |",
        "|-------|-----:|----------:|----------:|",
    ] + split_rows + [
        "",
        "---",
        "",
        "## Headline metrics (positive class, test set)",
        "",
        f"**Test set:** {n_test} samples, {pos_test} positive ({base_rate:.1f}%).",
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
        f"- `scale_pos_weight = {spw:.2f}` (derived from train split class balance).",
        f"- Cutoff window: {ROLL_WINDOW}-day rolling (per ticker), shifted {N_FORWARD} days",
        "  to prevent any forward-vol window from overlapping the current one.",
        "- Random-classifier PR-AUC ≈ base rate. XGBoost above that line has genuine signal.",
        "- Volatility clustering (GARCH-like persistence) is the natural lower bound.",
        "  XGBoost materially above persistence F1 means our technical features contribute",
        "  information beyond raw vol memory.",
        "- **No existing files were modified.** Writes only to `ml/reports/`.",
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print(f"Volatility-regime feasibility v2 ({ROLL_WINDOW}d rolling cutoff)")
    print("=" * 60)

    print("\n[1/7] Loading cached OHLCV ...")
    universe  = data_loader.load_universe()
    benchmark = data_loader.load_benchmark()

    print("\n[2/7] Building feature frame + forward_vol ...")
    df_raw = _build_frame(universe, benchmark)
    n_raw  = df_raw.shape[0]
    print(f"  {n_raw} rows, {df_raw['stock'].nunique()} tickers")

    print(f"\n[3/7] Computing {ROLL_WINDOW}d rolling labels (min_history={MIN_HISTORY}) ...")
    df = _add_rolling_labels(df_raw)
    df = df.dropna(subset=["vol_regime", "trailing_tercile"])
    df["vol_regime"]       = df["vol_regime"].astype(int)
    df["trailing_tercile"] = df["trailing_tercile"].astype(int)
    n_dropped = n_raw - df.shape[0]
    print(f"  {df.shape[0]} rows after warm-up drop ({n_dropped} removed)")
    print(f"  overall vol_regime=1 rate: {100*(df['vol_regime']==1).mean():.1f}%")

    print(f"\n[4/7] Time-based split (embargo={N_FORWARD}d) ...")
    train_df, val_df, test_df = _split(df)
    split_stats = {}
    for name, sp in [("train", train_df), ("val", val_df), ("test", test_df)]:
        pos = int((sp["vol_regime"] == 1).sum())
        n   = len(sp)
        d0  = pd.Timestamp(sp["date"].min()).date()
        d1  = pd.Timestamp(sp["date"].max()).date()
        split_stats[name] = {"n": n, "pos": pos}
        print(f"  {name:5s}: {n:6d} rows | pos={pos} ({100*pos/max(n,1):.1f}%) "
              f"| {d0} -> {d1}")

    print("\n[5/7] Training XGBoost on vol_regime ...")
    y_tr  = train_df["vol_regime"]
    y_val = val_df["vol_regime"]
    y_te  = test_df["vol_regime"]

    xgb = build_xgb(y_tr)
    xgb.fit(train_df[config.MODEL_FEATURES], y_tr)
    val_proba   = xgb.predict_proba(val_df[config.MODEL_FEATURES])[:, 1]
    thr, val_f1 = tune_threshold(y_val, val_proba)
    test_proba  = xgb.predict_proba(test_df[config.MODEL_FEATURES])[:, 1]
    spw = xgb.get_params()["scale_pos_weight"]
    print(f"  val-tuned threshold = {thr:.3f}  (val F1 = {val_f1:.3f})")
    print(f"  scale_pos_weight    = {spw:.2f}")

    print("\n[6/7] Evaluating on test set ...")
    xgb_m  = _metrics(y_te, test_proba, threshold=thr)
    base_m = _metrics(y_te, test_df["trailing_tercile"].values)
    base_m["pr_auc"] = None   # hard classifier — no probability output

    n_pos   = split_stats["test"]["pos"]
    n_total = split_stats["test"]["n"]
    print(f"  base rate : {100*n_pos/max(n_total,1):.1f}%")
    print(f"  XGB       : P={xgb_m['precision']}  R={xgb_m['recall']}  "
          f"F1={xgb_m['f1']}  PR-AUC={xgb_m['pr_auc']}")
    print(f"  Baseline  : P={base_m['precision']}  R={base_m['recall']}  "
          f"F1={base_m['f1']}")

    print("\n[7/7] Writing report ...")
    report = _render_report(xgb_m, base_m, thr, val_f1, split_stats, spw)
    with open(REPORT_PATH, "w", encoding="utf-8") as fh:
        fh.write(report)
    print(f"  Report -> {REPORT_PATH}")


if __name__ == "__main__":
    main()
