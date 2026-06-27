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
        print(f"❌ Model file not found at: {MODEL_PATH}")
        model = None
    else:
        model = joblib.load(MODEL_PATH)
        print(f"✅ Model loaded successfully from: {MODEL_PATH}")
except Exception as e:
    print("❌ Failed to load ML model")
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
def predict_risk(symbol: str, user: str = Depends(get_current_user)):#here user is email 
    try:
        if model is None:
            raise HTTPException(
                status_code=500,
                detail="ML model not loaded"
            )

        company_name = None
        try:
            info = yf.Ticker(symbol.upper()).info or {}
            company_name = info.get("shortName") or info.get("longName") or info.get("displayName")
        except Exception:
            company_name = None
            
        #check for redis cache here
        cache_key = prediction_key(symbol.upper())
        cached_prediction = get_cached_prediction(cache_key)
        if cached_prediction is not None:
            user_info_collection.update_one(
                {"email": user},
                {"$pull": {"recently_viewed": symbol}}
            )

            # 2. Push to front & limit to 6
            user_info_collection.update_one(
                {"email": user},
                {
                    "$push": {
                        "recently_viewed": {
                            "$each": [symbol],
                            "$position": 0,
                            "$slice": 6
                        }
                    }
                }
            )
            return clean_json_value(cached_prediction)
        
        # -------- Fetch features and chart series --------
        features_df, chart_data, price_change_pct, current_price, error_msg = get_features(symbol)

        if features_df is None or features_df.empty:
            detail = error_msg if error_msg else "Feature generation failed"
            raise HTTPException(
                status_code=500,
                detail=detail
            )

        # -------- Select required features --------
        try:
            X = features_df[FEATURES]
        except KeyError:
            raise HTTPException(
                status_code=500,
                detail="Feature mismatch between training and inference"
            )

        if X.isnull().any().any():
            raise HTTPException(
                status_code=500,
                detail="Invalid (NaN) feature values"
            )

        # -------- Predict --------
        risk_score = model.predict_proba(X)[0][1]
        
        #---------Update user's recently viewed stocks--------
        # 1. Remove if already present
        user_info_collection.update_one(
            {"email": user},
            {"$pull": {"recently_viewed": symbol}}
        )

        # 2. Push to front & limit to 6
        user_info_collection.update_one(
            {"email": user},
            {
                "$push": {
                    "recently_viewed": {
                        "$each": [symbol],
                        "$position": 0,
                        "$slice": 6
                    }
                }
            }
        )

        # -------- Build reasons --------
        # risk_score = P(forward-10d realized vol in top tercile of this stock's
        # own recent history). Reasons explain what's driving the vol-regime score.
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
            "Elevated volatility risk relative to this stock's own history — review position sizing"
            if risk_score > 0.65
            else "Moderate volatility risk — monitor position closely"
            if risk_score > 0.45
            else "Volatility risk is contained — hold"
        )

        # Reasons must be internally consistent: never say "vol is contained"
        # when risk_score is elevated, or vice versa.
        reasons = []

        if rsi >= 70:
            reasons.append(
                f"RSI at {rsi:.1f} — overbought momentum often precedes a volatility pickup"
            )
        elif rsi <= 30:
            reasons.append(
                f"RSI at {rsi:.1f} — oversold conditions can trigger sharp volatility swings"
            )
        else:
            reasons.append(
                f"RSI at {rsi:.1f} — momentum is neutral, not materially adding to volatility risk"
            )

        if sma20 < sma50:
            reasons.append(
                "Short-term average is below medium-term — trend weakness is a volatility amplifier"
            )
        else:
            reasons.append(
                "Short-term average is above medium-term — trend is supportive, muting volatility risk"
            )

        if vol >= 0.04:
            reasons.append(
                "Trailing 10-day realized volatility is elevated — reinforces the high volatility-regime score"
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
                    "Trailing 10-day realized volatility is contained — conditions are calmer than this stock's recent norms"
                )

        response ={
            "symbol": symbol.upper(),
            "company_name": company_name,
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

    except Exception :
        print("❌ Prediction error:")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail="Unexpected error during prediction"
        )
