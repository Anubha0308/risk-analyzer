from fastapi import APIRouter, Depends, HTTPException
import traceback
import joblib
import os
import yfinance as yf
import math
import numpy as np

from utils.feature_engineering import get_features, FEATURES
from auth_utils import get_current_user
from database import user_info_collection
from utils.redis_client import set_cache, get_cache
from utils.redis_keys import prediction_key

# ---------------- ROUTER ----------------
router = APIRouter()

# ---------------- LOAD MODEL ----------------
# Get the directory where this file is located, then navigate to model
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "model", "stock_risk_model.pkl")

try:
    if not os.path.exists(MODEL_PATH):
        print(f"Model file not found at: {MODEL_PATH}")
        model = None
    else:
        model = joblib.load(MODEL_PATH)
        print(f"Model loaded successfully from: {MODEL_PATH}")
except Exception as e:
    print("Failed to load ML model")
    print(e)
    model = None



# check for prediction in cache if available then it is cache hit else when we have cache miss then do the prediction and set in the cache
# we have to make sure charts_data is JSON serializable
def clean_json_value(value):
    if value is None:
        return None

    if isinstance(value, (float, np.floating)):
        value = float(value)
        if math.isnan(value) or math.isinf(value):
            return None
        return value

    if isinstance(value, (int, np.integer)):
        return int(value)

    if isinstance(value, dict):
        return {k: clean_json_value(v) for k, v in value.items()}

    if isinstance(value, list):
        return [clean_json_value(v) for v in value]

    return value

def get_cached_prediction(key: str):
    cached_result = get_cache(key)
    if cached_result is not None:
        #we need to convert the cached_result back to feasible format
        return cached_result
    return None

# ---------------- PREDICTION ENDPOINT ----------------
@router.get("/predict/risk/{symbol}")
def predict_risk(symbol: str, user: str = Depends(get_current_user)):
    try:
        if model is None:
            raise HTTPException(
                status_code=500,
                detail="ML model not loaded"
            )

        symbol_upper = symbol.upper()

        #idhar par pulling fresh real-time asset info on every single request
        currency_type = "USD"
        company_name = None
        current_price = None
        price_change_pct = None

        try:
            ticker = yf.Ticker(symbol_upper)
            info = ticker.info or {}
            company_name = info.get("shortName") or info.get("longName") or info.get("displayName")
            currency_type = info.get("currency")

            fast = ticker.fast_info
            current_price = fast.get("last_price")
            prev_close = fast.get("previous_close")
            # fast_info returns NaN (not None) when no live quote is available
            if current_price is not None and math.isnan(float(current_price)):
                current_price = None
            if prev_close is not None and math.isnan(float(prev_close)):
                prev_close = None
            # fallback to info fields if fast_info had no live quote
            if current_price is None:
                current_price = (
                    info.get("regularMarketPrice")
                    or info.get("currentPrice")
                    or info.get("previousClose")
                )

            if current_price is not None and prev_close:
                price_change_pct = round((current_price - prev_close) / prev_close * 100, 2)
        except Exception:
            pass

        cache_key = prediction_key(symbol_upper)
        cached_prediction = get_cached_prediction(cache_key)

        if cached_prediction is not None:
            _update_recently_viewed(user, symbol_upper)

            cached_prediction["current_price"] = round(float(current_price), 2) if current_price is not None else cached_prediction.get("current_price")
            cached_prediction["price_change"] = price_change_pct if price_change_pct is not None else cached_prediction.get("price_change")
            cached_prediction["company_name"] = company_name or cached_prediction.get("company_name")
            cached_prediction["currency_type"] = currency_type or cached_prediction.get("currency_type")

            return clean_json_value(cached_prediction)

        features_df, chart_data, fallback_change, fallback_price, error_msg = get_features(symbol_upper)

        if features_df is None or features_df.empty:
            detail = error_msg if error_msg else "Feature generation failed"
            raise HTTPException(status_code=500, detail=detail)

        if current_price is None:
            current_price = fallback_price
        if price_change_pct is None:
            price_change_pct = fallback_change

        try:
            X = features_df[FEATURES]
        except KeyError:
            raise HTTPException(status_code=500, detail="Feature mismatch between training and inference")

        if X.isnull().any().any():
            raise HTTPException(status_code=500, detail="Invalid (NaN) feature values")

        risk_score = model.predict_proba(X)[0][1]

        # Update user tracking
        _update_recently_viewed(user, symbol_upper)

        # -------- Build risk label + reasons --------
        # risk_score = P(forward-10d realized vol in top tercile of this stock's
        # own recent history). Thresholds anchored to the model's tuned decision
        # threshold (0.52); HIGH requires a clear margin above it to avoid over-flagging.
        rsi   = float(features_df.iloc[0].get("rsi", 0))
        sma20 = float(features_df.iloc[0].get("sma_20", 0))
        sma50 = float(features_df.iloc[0].get("sma_50", 0))
        vol   = float(features_df.iloc[0].get("volatility", 0))

        # risk_level anchored to the model's tuned decision threshold (0.52).
        # HIGH requires a clear margin above that threshold to avoid over-flagging.
        risk_level = (
            "HIGH"   if risk_score > 0.65
            else "MEDIUM" if risk_score > 0.45
            else "LOW"
        )

        recommendation = (
            "Elevated volatility risk relative to this stock's own history - review position sizing"
            if risk_score > 0.65
            else "Moderate volatility risk - monitor position closely"
            if risk_score > 0.45
            else "Volatility risk is contained - hold"
        )

        # Reasons must be internally consistent: never say "vol is contained"
        # when risk_score is elevated, or vice versa.
        reasons = []

        if rsi >= 70:
            reasons.append(
                f"RSI at {rsi:.1f} - overbought momentum often precedes a volatility pickup"
            )
        elif rsi <= 30:
            reasons.append(
                f"RSI at {rsi:.1f} - oversold conditions can trigger sharp volatility swings"
            )
        else:
            reasons.append(
                f"RSI at {rsi:.1f} - momentum is neutral, not materially adding to volatility risk"
            )

        if sma20 < sma50:
            reasons.append(
                "Short-term average is below medium-term - trend weakness is a volatility amplifier"
            )
        else:
            reasons.append(
                "Short-term average is above medium-term - trend is supportive, muting volatility risk"
            )

        if vol >= 0.04:
            reasons.append(
                "Trailing 10-day realized volatility is elevated - reinforces the high volatility-regime score"
                if risk_score > 0.45
                else "Trailing 10-day realized volatility is elevated"
            )
        else:
            if risk_score > 0.45:
                reasons.append(
                    "Recent realized volatility is contained, but trend and momentum features are pushing the regime score higher"
                )
            else:
                reasons.append(
                    "Trailing 10-day realized volatility is contained - conditions are calmer than this stock's recent norms"
                )

        response = {
            "symbol": symbol_upper,
            "company_name": company_name,
            "currency_type": currency_type,
            "risk_score": round(float(risk_score), 3),
            "price_change": price_change_pct,
            "risk_level": risk_level,
            "recommendation": recommendation,
            "reasons": reasons,
            "charts": chart_data or {},
            "current_price": round(float(current_price), 2) if current_price is not None else None,
        }

        response = clean_json_value(response)

        set_cache(cache_key, response, ttl=60 * 30)
        return response

    except HTTPException:
        raise
    except Exception:
        print("❌ Prediction error:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Unexpected error during prediction")


def _update_recently_viewed(user: str, symbol: str):

    user_info_collection.update_one({"email": user}, {"$pull": {"recently_viewed": symbol}})
    user_info_collection.update_one(
        {"email": user},
        {"$push": {"recently_viewed": {"$each": [symbol], "$position": 0, "$slice": 6}}}
    )
