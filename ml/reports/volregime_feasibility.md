# Volatility-regime label — feasibility check

**Label:** `vol_regime = 1` if the **forward 10-day realized volatility**
(std of daily returns over the next 10 trading days) exceeds the
**per-ticker top-tercile cutoff**. Cutoffs are derived exclusively from
training-split rows to prevent leakage.

**Test set:** 2180 samples, 369 positive
(16.9% base rate — expected ≈ 33 % by construction).

**Features:** the same 10 scale-free `MODEL_FEATURES` as the main XGBoost.

**Split:** same 70 / 15 / 15 time-based fractions; embargo = 10 days
(increased from 7 → 10 to match N_FORWARD so no forward window
bleeds across a split boundary).

---

## Headline metrics (positive class, test set)

| metric | XGBoost (our features) | Persistence baseline |
|--------|----------------------:|--------------------:|
| threshold | 0.120 (val-tuned, F1=0.191) | — (hard) |
| precision | 0.1713 | 0.1772 |
| recall    | 0.8753 | 0.1897 |
| F1        | 0.2865 | 0.1832 |
| PR-AUC    | 0.2155 | — (no proba) |

---

## Confusion matrices

**XGBoost**

|            | pred 0 | pred 1 |
|------------|-------:|-------:|
| **true 0** | 248 | 1563 |
| **true 1** | 46 | 323 |

**Persistence baseline** (trailing 10d vol tercile → forward 10d vol tercile)

|            | pred 0 | pred 1 |
|------------|-------:|-------:|
| **true 0** | 1486 | 325 |
| **true 1** | 299 | 70 |

---

## Notes

- `scale_pos_weight = 2.00` — should be ≈ 2 since the class is ≈33% positive.
- A random classifier at 33% base rate achieves precision ≈ 0.33 and PR-AUC ≈ 0.33.
  Any model above that line has genuine signal.
- Volatility clustering (GARCH-like persistence) means the persistence baseline
  is a strong lower bound. If XGBoost significantly outperforms it, the additional
  features are contributing beyond raw persistence.
- **No existing files were modified.** This script is append-only to
  `ml/reports/`. The live pkl and all v2 model files are untouched.
