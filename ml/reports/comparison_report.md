# Vol-regime model — comparison on the SAME time-based test set

All metrics are for the **positive class** (positive = forward-10d realized vol in top tercile of that ticker's own 252-day trailing distribution), evaluated on the most-recent ~15% of trading dates that neither model was trained on. Accuracy is omitted as the class is ~33% positive by construction.

## Headline metrics (positive class)

| metric | RF — RandomForest (raw-price features, vol-regime label) | XGB — XGBoost (scale-free features, vol-regime label) |
|--------|----------------------------------------------------------:|-------------------------------------------------------:|
| decision threshold | 0.29 | 0.52 |
| precision | 0.3958 | 0.4713 |
| recall | 0.9045 | 0.2543 |
| F1 | 0.5506 | 0.3304 |
| PR-AUC | 0.4301 | 0.4459 |

Test set: 2150 samples, 806 positive (37.5%).

## Confusion matrices

**RF — RandomForest (raw-price features, vol-regime label)**

|            | pred 0 | pred 1 |
|------------|-------:|-------:|
| **true 0** | 231 | 1113 |
| **true 1** | 77 | 729 |

**XGB — XGBoost (scale-free features, vol-regime label)**

|            | pred 0 | pred 1 |
|------------|-------:|-------:|
| **true 0** | 1114 | 230 |
| **true 1** | 601 | 205 |

## Notes

- **RF @0.5 (precision/recall/F1):** 0.4308/0.2432/0.3109
- **XGB @0.5 (precision/recall/F1):** 0.4694/0.2854/0.3549
- **XGB threshold tuning method:** TimeSeriesSplit CV (pooled) on train+val — avoids anomalous val base rate
- **XGB TimeSeriesSplit CV PR-AUC:** 0.417 +/- 0.271
