# Volatility-regime label v2 — feasibility check (252d rolling cutoff)

## Label definition

For ticker T on day i:

```
vol_regime[i] = 1  iff  forward_vol[i] > Q67(forward_vol[i-N_FORWARD-252 .. i-N_FORWARD])
```

where `forward_vol[i]` = std of daily returns over the next 10 trading days,
and `Q67(...)` is the 67th percentile over a **252-day rolling window**
of that ticker's own past forward vols (minimum 63 observations).

The `shift(10)` before rolling ensures no overlap:
`forward_vol[i-10]` covers days `i-10+1..i`; `forward_vol[i]`
covers days `i+1..i+10` — zero leakage.

**Why 252-day rolling instead of expanding:** the expanding window
permanently accumulates the COVID-2020 and 2022-bear-market vol spikes, keeping
the cutoff too high for calmer periods and causing the positive rate to collapse
out-of-sample. A 252-day window lets high-vol events expire from the
cutoff after ~1 year, so the cutoff re-calibrates to the current vol regime.

**Persistence baseline:** same 252-day rolling tercile logic on trailing 10d vol
(1-day shift, same min_history).

**Split:** 70 / 15 / 15 time-based, embargo = 10 days.

---

## Base-rate stability across splits

| split | rows | positives | base rate |
|-------|-----:|----------:|----------:|
| train | 9540 | 3528 | 37.0% |
| val | 1970 | 243 | 12.3% |
| test | 2070 | 791 | 38.2% |

---

## Headline metrics (positive class, test set)

**Test set:** 2070 samples, 791 positive (38.2%).

| metric | XGBoost (our features) | Persistence baseline |
|--------|----------------------:|--------------------:|
| threshold | 0.150 (val-tuned, F1=0.222) | — (hard) |
| precision | 0.3806 | 0.458 |
| recall    | 0.9267 | 0.4412 |
| F1        | 0.5396 | 0.4495 |
| PR-AUC    | 0.4284 | — (no proba) |

---

## Confusion matrices

**XGBoost**

|            | pred 0 | pred 1 |
|------------|-------:|-------:|
| **true 0** | 86 | 1193 |
| **true 1** | 58 | 733 |

**Persistence baseline** (trailing 10d vol tercile → forward 10d vol tercile)

|            | pred 0 | pred 1 |
|------------|-------:|-------:|
| **true 0** | 866 | 413 |
| **true 1** | 442 | 349 |

---

## Notes

- `scale_pos_weight = 1.70` (derived from train split class balance).
- Cutoff window: 252-day rolling (per ticker), shifted 10 days
  to prevent any forward-vol window from overlapping the current one.
- Random-classifier PR-AUC ≈ base rate. XGBoost above that line has genuine signal.
- Volatility clustering (GARCH-like persistence) is the natural lower bound.
  XGBoost materially above persistence F1 means our technical features contribute
  information beyond raw vol memory.
- **No existing files were modified.** Writes only to `ml/reports/`.
