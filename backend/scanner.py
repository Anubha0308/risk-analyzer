# scanner.py
import os
import sys
import joblib
import traceback

from datetime import datetime, timezone, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from utils.feature_engineering import get_features, FEATURES
from database import user_info_collection, user_stocks_info_collection, notifications_collection

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



def get_previous_risk(user_email: str, symbol: str) -> float | None:
    user_data = user_stocks_info_collection.find_one({"email": user_email})
    if not user_data or "stocks" not in user_data:
        return None
    for stock in user_data["stocks"]:
        if stock.get("symbol") == symbol:
            return stock.get("risk_score")
    return None


def already_notified(user_email: str, symbol: str, notif_type: str) -> bool:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    return notifications_collection.find_one({
        "user_email": user_email,
        "ticker":     symbol,
        "type":       notif_type,
        "created_at": {"$gte": since}
    }) is not None


def save_notification(user_email: str, symbol: str, notif_type: str,
                      message: str, risk_score: float):
    if already_notified(user_email, symbol, notif_type):
        return

    notifications_collection.insert_one({
        "user_email": user_email,
        "ticker":     symbol,
        "type":       notif_type,
        "message":    message,
        "risk_score": round(risk_score, 3),
        "is_read":    False,
        "created_at": datetime.now(timezone.utc)
    })


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

    risk_score = model.predict_proba(X)[0][1]
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
    risk_score    = data["risk_score"]
    rsi           = data["rsi"]
    macd          = data["macd"]
    volatility    = data["volatility"]
    sma_20        = data["sma_20"]
    sma_50        = data["sma_50"]
    return_5d     = data["return_5d"]
    previous_risk = get_previous_risk(user_email, symbol)
    return_pct    = round(return_5d * 100, 2)

    # ── MARKET-BASED ───────────────────────────────────────

    if risk_score > 0.6:
        save_notification(
            user_email, symbol, "high_risk",
            f"{symbol} is at HIGH downside risk — model score: {risk_score:.0%}. Consider reviewing your position.",
            risk_score
        )

    if rsi >= 70:
        save_notification(
            user_email, symbol, "rsi_overbought",
            f"{symbol} RSI is at {rsi:.1f} — overbought territory. Potential pullback ahead.",
            risk_score
        )
    elif rsi <= 30:
        save_notification(
            user_email, symbol, "rsi_oversold",
            f"{symbol} RSI is at {rsi:.1f} — oversold territory. Potential recovery signal.",
            risk_score
        )

    if macd > 0:
        save_notification(
            user_email, symbol, "macd_bullish",
            f"{symbol} MACD is above signal line ({macd:.3f}) — bullish momentum signal.",
            risk_score
        )
    elif macd < 0:
        save_notification(
            user_email, symbol, "macd_bearish",
            f"{symbol} MACD is below signal line ({macd:.3f}) — bearish momentum signal.",
            risk_score
        )

    if sma_20 > sma_50:
        save_notification(
            user_email, symbol, "sma_bullish",
            f"{symbol} short-term average (SMA20) is above medium-term (SMA50) — bullish trend signal.",
            risk_score
        )
    elif sma_20 < sma_50:
        save_notification(
            user_email, symbol, "sma_bearish",
            f"{symbol} short-term average (SMA20) is below medium-term (SMA50) — bearish trend signal.",
            risk_score
        )

    if volatility >= 0.04:
        save_notification(
            user_email, symbol, "volatility_spike",
            f"{symbol} is showing elevated volatility ({volatility:.4f}) — market may be unstable.",
            risk_score
        )

    if return_5d >= 0.05:
        save_notification(
            user_email, symbol, "return_up_5d",
            f"{symbol} moved up {return_pct}% in the last 5 trading days.",
            risk_score
        )
    elif return_5d <= -0.05:
        save_notification(
            user_email, symbol, "return_down_5d",
            f"{symbol} dropped {abs(return_pct)}% in the last 5 trading days.",
            risk_score
        )

    # ── USER-SPECIFIC ──────────────────────────────────────

    if previous_risk is not None:
        if (risk_score - previous_risk) >= 0.2:
            save_notification(
                user_email, symbol, "risk_increased",
                f"{symbol} downside risk increased from {previous_risk:.2f} to {risk_score:.2f} since your last analysis.",
                risk_score
            )

        if previous_risk > 0.6 and risk_score < 0.4:
            save_notification(
                user_email, symbol, "risk_cleared",
                f"{symbol} downside risk improved from {previous_risk:.2f} to {risk_score:.2f} — looking healthier.",
                risk_score
            )



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