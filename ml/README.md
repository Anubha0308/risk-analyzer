# RiskAI — Model v2 training pipeline

This folder retrains the downside-risk classifier that powers
`GET /predict/risk/{symbol}`. The model predicts **P(a stock falls more than 5%
over the next 7 trading days)**. v1 was trained in Colab notebooks and shipped
with several defects; v2 fixes them with a reproducible, importable pipeline.

> **The live model is never touched by this pipeline.** Training writes only to
> `ml/models/stock_risk_model_v2.pkl`. Swapping it into
> `backend/model/stock_risk_model.pkl` is a separate, manually-reviewed step.

---

## How to run

```bash
# from the repo root, using the backend venv (has pandas-ta, yfinance, xgboost)
backend/venv/Scripts/python.exe -m ml.train
```

First run downloads ~6 years of daily bars for 10 tickers + SPY and caches them
under `ml/data/raw/`. Later runs are offline and deterministic.

Outputs:
- `ml/models/stock_risk_model_v2.pkl` — the new fitted XGBoost model
- `ml/models/decision_threshold.json` — the val-tuned decision threshold
- `ml/reports/comparison_report.md` — old-vs-new metrics on the test set

---

## Module layout

| File | Responsibility |
|------|----------------|
| `config.py` | tickers, dates, paths, **feature contract**, split config, hyperparameters |
| `data_loader.py` | download + cache raw OHLCV via yfinance |
| `features.py` | **single source of truth** for feature math (mirrored in the backend) |
| `model.py` | time-based split, RF/XGB builders, threshold tuning, TimeSeriesSplit CV |
| `evaluate.py` | positive-class metrics + comparison report renderer |
| `train.py` | orchestrates the whole run |

---

## The four defects and how v2 fixes them

### (a) Chronological leakage — `train_test_split(shuffle=True)` on time series

v1 shuffled rows before splitting, so the model trained on future bars and was
"tested" on randomly interleaved past bars. On time series this leaks the future
into training and inflates every metric.

**Fix:** `model.time_based_split()` sorts on the **unique trading dates shared
across all tickers** and cuts chronologically: oldest **70%** → train, next
**15%** → validation, most-recent **15%** → test. No row is ever shuffled.

Because the label looks **7 trading days into the future**, a row near a split
boundary could otherwise "see" prices from the next split. We therefore apply a
**7-day embargo** (`EMBARGO_DAYS`): the last 7 trading dates of train (and of
val) are dropped so no training label overlaps the validation/test window. Any
cross-validation uses `TimeSeriesSplit` (expanding window), never k-fold.

### (b) Raw price levels don't transfer across tickers

v1 fed **`sma_20` and `sma_50` as raw dollar values**. A $900 stock and a $30
stock produce SMAs two orders of magnitude apart, so a tree trained mostly on
high-priced names learns split points that are meaningless for cheap ones. The
feature is not comparable across the cross-section.

**Fix:** every v2 feature is **scale-free** (a ratio, a z-score, or a bounded
oscillator):

| v2 feature | formula | what it captures |
|------------|---------|------------------|
| `rsi` | RSI(14) | momentum, already 0–100 |
| `macd_norm` | MACD / Close | trend impulse, normalised by price |
| `atr_pct` | ATR(14) / Close | **true-range volatility**, normalised by price |
| `close_to_sma20` | Close / SMA20 − 1 | distance from the short-term trend |
| `sma20_to_sma50` | SMA20 / SMA50 − 1 | **trend slope** (replaces the two raw SMAs) |
| `vol_zscore` | 20-day z-score of Volume | **relative volume** spike/dry-up |
| `dist_from_high_20` | Close / 20-day high − 1 | drawdown from recent high (≤ 0) |
| `dist_from_low_20` | Close / 20-day low − 1 | rebound from recent low (≥ 0) |
| `return_5d` | 5-day % return | short-horizon momentum |
| `mkt_rel_ret_5d` | `return_5d` − market `return_5d` | **market-relative** momentum |

The two raw SMAs (and raw `volatility`/`macd`) are still computed and returned
by the backend as **non-model side columns** so the human-readable reasons and
notification text keep working unchanged — they just no longer feed the model.

**Market-relative return — a deliberate design choice.** The brief asked for
"stock return minus the mean return of all tickers that day." A literal
universe-mean is only defined for the 10 training tickers, but the live app lets
users predict **any** symbol. So the market leg is defined as the return of a
**market benchmark (`SPY`)**, computed **identically in training and at
inference**. This (1) generalises to unseen tickers, (2) avoids train/serve
skew, and (3) is the standard finance definition of market-relative (excess)
return. SPY is a cap-weighted proxy for "the average stock's move that day."

### (c) Misleading accuracy on a ~13% positive class

v1 reported 77% accuracy but **0.29 precision** on the positive class — a model
that mostly predicts "not risky" scores high accuracy while being nearly useless
for the thing we actually care about (catching drops).

**Fix:**
- **Accuracy is dropped as a headline metric.** We report **precision, recall,
  F1 and PR-AUC for the positive class**, plus the confusion matrix.
- **XGBoost with `scale_pos_weight = #neg / #pos`** so the gradient updates
  weight the rare positive class proportionally (set from the training split,
  not hard-coded).
- **The decision threshold is tuned on the validation set to maximise
  positive-class F1** rather than defaulting to 0.5. Both the baseline and the
  new model are tuned the same way, so the comparison is fair.

> `risk_score` in the API stays a **probability in [0, 1]** (frozen contract).
> The tuned threshold is the binary risky/not-risky cut used for evaluation and
> is saved to `decision_threshold.json` for the reviewer. It does **not** change
> the API response shape or the existing HIGH/MEDIUM/LOW cutoffs.

### (d) Weak / collinear feature set

v1's `sma_20` and `sma_50` are ~0.99 correlated (both track price level), and
`return_5d`/`return_20d` overlap heavily — redundant inputs that add variance
without signal.

**Fix:** the collinear raw SMAs are collapsed into one **ratio** feature
(`sma20_to_sma50`), the level dependence is removed, and `return_20d` is dropped
in favour of a complementary set (true-range volatility, relative volume,
distance-from-high/low, and market-relative momentum) that captures distinct,
less-correlated aspects of the setup.

---

## Train / serve consistency

`ml/features.py` and `backend/utils/feature_engineering.py` implement the **same
formulas**. They are separate files only because the backend is what gets
deployed (the `ml/` harness is not). **If you change a formula in one, change it
in the other and retrain** — there is a comment to that effect at the top of
both. The backend keeps the 5-value `get_features()` return signature and the
`charts.*` structure untouched, so the frontend needs no changes.

## Evaluation protocol (what the comparison actually measures)

Both models are scored on the **same untouched test window** (the most-recent
~15% of dates):

- **v1 / baseline** — `RandomForestClassifier` (same hyperparameters as the
  original notebook) trained on the **raw-price** feature set.
- **v2 / new** — `XGBoost` + `scale_pos_weight` trained on the **scale-free**
  feature set.

Each model is fit on the train split, has its threshold tuned on the validation
split, and is evaluated once on the test split. The saved artifact is exactly
the model whose test metrics are reported (trained on the train split) — no
quiet refit — so the numbers you review match the `.pkl` you would swap in.

See `ml/reports/comparison_report.md` for the latest numbers.
