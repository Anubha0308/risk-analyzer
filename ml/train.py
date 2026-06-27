"""End-to-end training orchestrator for the vol-regime model.

Run from the repo root with the backend venv:

    backend/venv/Scripts/python.exe -m ml.train

Steps:
  1. load + cache raw OHLCV (10 tickers + SPY benchmark)
  2. engineer scale-free features + vol-regime label
  3. strict time-based split (train=oldest / val / test=newest) with embargo
  4. baseline RandomForest (raw-price features) vs XGBoost (scale-free features)
     — both trained on the vol-regime label
  5. tune XGBoost decision threshold via TimeSeriesSplit CV on train+val
     (avoids calibrating on the anomalous 12%-positive-rate val window)
  6. TimeSeriesSplit CV sanity check (PR-AUC) for the new model
  7. evaluate both on the SAME untouched test set and write comparison report
  8. save the new XGBoost to ml/models/stock_risk_model_v2.pkl  (live pkl untouched)
"""

import json

import joblib
import numpy as np
import pandas as pd

from ml import config, data_loader, evaluate, features, model


def _split_summary(name, frame):
    pos = int((frame["label"] == 1).sum())
    n = len(frame)
    d0, d1 = frame["date"].min(), frame["date"].max()
    print(
        f"  {name:5s}: {n:6d} rows | pos {pos:5d} ({100*pos/max(n,1):4.1f}%) "
        f"| {pd.Timestamp(d0).date()} -> {pd.Timestamp(d1).date()}"
    )


def main():
    print("=" * 70)
    print("RiskAI vol-regime training pipeline")
    print("=" * 70)

    print("\n[1/8] Loading data ...")
    universe = data_loader.load_universe()
    benchmark = data_loader.load_benchmark()

    print("\n[2/8] Engineering features + vol-regime label ...")
    df = features.build_training_frame(universe, benchmark)
    print(f"  combined dataset: {df.shape[0]} rows, "
          f"{df['label'].mean()*100:.1f}% positive")

    print(f"\n[3/8] Time-based split (no shuffle, embargo "
          f"{config.EMBARGO_DAYS}d) ...")
    train_df, val_df, test_df = model.time_based_split(df)
    _split_summary("train", train_df)
    _split_summary("val", val_df)
    _split_summary("test", test_df)

    y_train = train_df["label"]
    y_val   = val_df["label"]
    y_test  = test_df["label"]

    # ---------------- Baseline: RandomForest on OLD (raw-price) features -----
    print("\n[4/8] Training baseline RandomForest (raw-price features, vol-regime label) ...")
    Xtr_old  = train_df[config.OLD_FEATURES]
    Xval_old = val_df[config.OLD_FEATURES]
    Xte_old  = test_df[config.OLD_FEATURES]

    rf = model.build_rf()
    rf.fit(Xtr_old, y_train)
    rf_val_proba  = rf.predict_proba(Xval_old)[:, 1]
    rf_thr, rf_val_f1 = model.tune_threshold(y_val, rf_val_proba)
    rf_test_proba = rf.predict_proba(Xte_old)[:, 1]
    old_metrics   = evaluate.positive_class_metrics(y_test, rf_test_proba, rf_thr)
    print(f"  RF val-tuned threshold={rf_thr:.3f} (val F1={rf_val_f1:.3f})")

    # ---------------- New: XGBoost on scale-free features --------------------
    print("\n[5/8] Training XGBoost (scale-free features, vol-regime label) ...")
    Xtr_new  = train_df[config.MODEL_FEATURES]
    Xval_new = val_df[config.MODEL_FEATURES]
    Xte_new  = test_df[config.MODEL_FEATURES]

    xgb = model.build_xgb(y_train)
    xgb.fit(Xtr_new, y_train)
    print(f"  XGB scale_pos_weight={xgb.get_params()['scale_pos_weight']:.2f}")

    # Threshold via CV on train+val — avoids the anomalous 12%-positive val window
    print("  Tuning threshold via TimeSeriesSplit CV on train+val ...")
    trainval_df = pd.concat([train_df, val_df]).sort_values(["date", "stock"])
    X_tv = trainval_df[config.MODEL_FEATURES]
    y_tv = trainval_df["label"]
    xgb_thr, xgb_cv_f1 = model.tune_threshold_via_cv(model.build_xgb, X_tv, y_tv)
    print(f"  CV-balanced threshold={xgb_thr:.3f} (balanced-point F1={xgb_cv_f1:.3f})")

    xgb_test_proba = xgb.predict_proba(Xte_new)[:, 1]
    new_metrics    = evaluate.positive_class_metrics(y_test, xgb_test_proba, xgb_thr)

    # Also show numbers at default 0.5 for transparency
    xgb_val_proba_at_half = xgb.predict_proba(Xval_new)[:, 1]

    # ---------------- TimeSeriesSplit CV sanity check -----------------------
    print("\n[6/8] TimeSeriesSplit CV (PR-AUC) for XGBoost ...")
    cv_scores = model.timeseries_cv_pr_auc(model.build_xgb, X_tv, y_tv)
    print(f"  per-fold PR-AUC: {[round(s, 3) for s in cv_scores]}")
    print(f"  mean PR-AUC: {np.mean(cv_scores):.3f} +/- {np.std(cv_scores):.3f}")

    # ---------------- Comparison report -------------------------------------
    print("\n[7/8] Comparison report (positive class, same test set):")
    old_at_half = evaluate.positive_class_metrics(y_test, rf_test_proba, 0.5)
    new_at_half = evaluate.positive_class_metrics(y_test, xgb_test_proba, 0.5)
    extra = {
        "RF @0.5 (precision/recall/F1)":
            f"{old_at_half['precision']}/{old_at_half['recall']}/{old_at_half['f1']}",
        "XGB @0.5 (precision/recall/F1)":
            f"{new_at_half['precision']}/{new_at_half['recall']}/{new_at_half['f1']}",
        "XGB threshold tuning method":
            "TimeSeriesSplit CV (pooled) on train+val — avoids anomalous val base rate",
        "XGB TimeSeriesSplit CV PR-AUC":
            f"{np.mean(cv_scores):.3f} +/- {np.std(cv_scores):.3f}",
    }
    report = evaluate.render_comparison(old_metrics, new_metrics, extra)
    print("\n" + report)
    with open(config.COMPARISON_REPORT_PATH, "w", encoding="utf-8") as fh:
        fh.write(report)
    print(f"  report written to {config.COMPARISON_REPORT_PATH}")

    # ---------------- Persist new model (live pkl untouched) ----------------
    print("\n[8/8] Saving v2 artifact (NOT swapping live model) ...")
    joblib.dump(xgb, config.V2_MODEL_PATH)
    with open(config.THRESHOLD_PATH, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "decision_threshold": xgb_thr,
                "tuned_on": "TimeSeriesSplit CV pooled probabilities (train+val), balanced precision=recall criterion",
                "note": (
                    "risk_score stays a probability in [0,1]. "
                    "Threshold is the binary high/not-high vol-regime cut for evaluation; "
                    "it does NOT change the API response shape."
                ),
                "label": (
                    "vol_regime=1 when forward-10d realized vol > 67th pctile of "
                    "that ticker's trailing 252-day forward-vol distribution"
                ),
                "features": config.MODEL_FEATURES,
            },
            fh,
            indent=2,
        )
    print(f"  model  -> {config.V2_MODEL_PATH}")
    print(f"  thresh -> {config.THRESHOLD_PATH}")
    print("\nDone. Live backend/model/stock_risk_model.pkl was NOT modified.")


if __name__ == "__main__":
    main()
