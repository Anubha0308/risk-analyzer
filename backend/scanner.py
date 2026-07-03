# scanner.py
import os
import sys
import joblib
import traceback

from datetime import datetime, timezone, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from utils.feature_engineering import get_features, FEATURES
from database import user_info_collection, notifications_collection

# ── Model — same pattern as prediction.py ───────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))  # scanner.py is at root
MODEL_PATH = os.path.join(BASE_DIR, "model", "stock_risk_model.pkl")

try:
    if not os.path.exists(MODEL_PATH):
        model = None
    else:
        model = joblib.load(MODEL_PATH)
except Exception:
    model = None



_SEVERITY_RANK = {"high": 3, "medium": 2, "low": 1}


def _collect_signals(risk_score, rsi, macd, volatility, sma_20, sma_50, return_5d):
    """Return all triggered signals as dicts with severity, key, and display label."""
    signals = []
    return_pct = round(return_5d * 100, 2)

    # High severity
    if risk_score > 0.6:
        signals.append({"severity": "high",   "key": "high_risk",
                        "label": f"Risk Score: {risk_score:.0%}"})
    if rsi >= 70:
        signals.append({"severity": "high",   "key": "rsi_overbought",
                        "label": f"RSI Overbought ({rsi:.1f})"})
    elif rsi <= 30:
        signals.append({"severity": "high",   "key": "rsi_oversold",
                        "label": f"RSI Oversold ({rsi:.1f})"})
    if volatility >= 0.04:
        signals.append({"severity": "high",   "key": "volatility_spike",
                        "label": f"High Volatility ({volatility:.4f})"})

    # Medium severity
    if macd > 0:
        signals.append({"severity": "medium", "key": "macd_bullish",  "label": "MACD Bullish"})
    elif macd < 0:
        signals.append({"severity": "medium", "key": "macd_bearish",  "label": "MACD Bearish"})
    if sma_20 > sma_50:
        signals.append({"severity": "medium", "key": "sma_bullish",   "label": "SMA Bullish Crossover"})
    elif sma_20 < sma_50:
        signals.append({"severity": "medium", "key": "sma_bearish",   "label": "SMA Bearish Crossover"})

    # Low severity
    if return_5d >= 0.05:
        signals.append({"severity": "low",    "key": "return_up_5d",
                        "label": f"Up {return_pct}% in 5 days"})
    elif return_5d <= -0.05:
        signals.append({"severity": "low",    "key": "return_down_5d",
                        "label": f"Down {abs(return_pct)}% in 5 days"})

    return signals


_BULLISH_KEYS = {"macd_bullish", "sma_bullish", "return_up_5d"}
_BEARISH_KEYS = {"macd_bearish", "sma_bearish", "return_down_5d"}


def _build_title_and_severity(signals):
    """Derive a single title and severity level from the full signal set."""
    top = max(signals, key=lambda s: _SEVERITY_RANK[s["severity"]])
    severity = top["severity"]
    keys = {s["key"] for s in signals}

    if severity == "high":
        if "high_risk" in keys:
            title = "High Risk Detected"
        elif "rsi_overbought" in keys:
            title = "RSI Alert: Overbought"
        elif "rsi_oversold" in keys:
            title = "RSI Alert: Oversold"
        else:
            title = "Volatility Alert"
    else:
        bullish = len(keys & _BULLISH_KEYS)
        bearish = len(keys & _BEARISH_KEYS)
        if bullish > bearish:
            title = "Bullish Technical Setup"
        elif bearish > bullish:
            title = "Bearish Technical Setup"
        else:
            title = "Mixed Signals Detected"

    return title, severity


def _already_notified(user_email: str, symbol: str, signal_keys: list) -> bool:
    """True if an identical signal set was already written for this user+ticker in the last 24 h."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    return notifications_collection.find_one({
        "user_email":        user_email,
        "ticker":            symbol,
        "triggered_signals": {"$all": signal_keys, "$size": len(signal_keys)},
        "created_at":        {"$gte": since},
    }) is not None


# ───────────────────────────────────────────────────────────
# PREDICT ONCE PER SYMBOL
# ───────────────────────────────────────────────────────────

def predict_symbol(symbol: str) -> dict | None:
    if model is None:
        return None

    try:
        result = get_features(symbol)
        # handle both 4-value error return and 5-value success return
        if len(result) == 4:
            return None
        features_df, _, _, _, _ = result
    except Exception:
        return None

    if features_df is None or features_df.empty:
        return None

    try:
        X = features_df[FEATURES]
    except KeyError:
        return None

    if X.isnull().any().any():
        return None

    risk_score = float(model.predict_proba(X)[0][1])
    row        = features_df.iloc[0]

    return {
        "risk_score": risk_score,
        "rsi":        float(row.get("rsi",        0)),
        "macd":       float(row.get("macd",        0)),
        "volatility": float(row.get("volatility",  0)),
        "sma_20":     float(row.get("sma_20",      0)),
        "sma_50":     float(row.get("sma_50",      0)),
        "return_5d":  float(row.get("return_5d",   0)),
    }



def notify_user(user_email: str, symbol: str, data: dict):
    signals = _collect_signals(
        data["risk_score"], data["rsi"], data["macd"],
        data["volatility"], data["sma_20"], data["sma_50"], data["return_5d"],
    )

    if not signals:
        return

    signal_keys = sorted(s["key"] for s in signals)

    if _already_notified(user_email, symbol, signal_keys):
        return

    title, severity = _build_title_and_severity(signals)

    n = len(signals)
    if n == 1:
        message = f"{symbol}: {signals[0]['label']}"
    else:
        bullets  = "\n".join(f"• {s['label']}" for s in signals)
        message  = f"{symbol} triggered {n} signals:\n{bullets}"

    notifications_collection.insert_one({
        "user_email":        user_email,
        "ticker":            symbol,
        "title":             title,
        "message":           message,
        "severity":          severity,
        "triggered_signals": signal_keys,
        "risk_score":        round(data["risk_score"], 3),
        "is_read":           False,
        "created_at":        datetime.now(timezone.utc),
    })

    



def run_scan():
    symbol_to_users: dict[str, list[str]] = {}

    users = user_info_collection.find(#from user_info_collection get all users who have {non-empty} watchlist and get their email and watchlist
        {"watchlist": {"$exists": True, "$ne": []}},
        {"email": 1, "watchlist": 1}#1 1 means return only email and watchlist fields
    )

    for user in users:
        email   = user.get("email")
        tickers = user.get("watchlist", [])
        if not email or not tickers:
            continue
        for symbol in tickers:
            symbol_to_users.setdefault(symbol, []).append(email)#assign email to each symbol in watchlist

    if not symbol_to_users:
        return

    for symbol, user_emails in symbol_to_users.items():
        try:
            data = predict_symbol(symbol)
            if data is None:
                continue
            for user_email in user_emails:
                try:
                    notify_user(user_email, symbol, data)
                except Exception:
                    traceback.print_exc()
        except Exception:
            traceback.print_exc()


if __name__ == "__main__": #start from here when we run scanner.py directly
    run_scan()