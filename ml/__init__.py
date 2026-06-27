"""RiskAI model-v2 training package.

A reproducible pipeline that retrains the downside-risk classifier with a
strict time-based split, scale-free cross-ticker features, and XGBoost with
`scale_pos_weight` for the imbalanced positive ("will drop >5% in 7 days")
class.

Modules:
    config       - tickers, dates, paths, feature lists, model hyperparameters
    data_loader  - download / cache raw OHLCV via yfinance
    features     - scale-free feature engineering (single source of truth)
    model        - model builders + decision-threshold tuning
    evaluate     - positive-class metrics + old-vs-new comparison report
    train        - end-to-end orchestrator (run: ``python -m ml.train``)
"""
