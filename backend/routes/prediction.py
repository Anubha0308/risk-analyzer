from fastapi import APIRouter, Depends, HTTPException
import traceback
import joblib
import os

from utils.feature_engineering import get_features, FEATURES
from auth_utils import get_current_user

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


# ---------------- PREDICTION ENDPOINT ----------------
@router.get("/predict/risk/{symbol}")
def predict_risk(symbol: str, user: str = Depends(get_current_user)):
    try:
        if model is None:
            raise HTTPException(
                status_code=500,
                detail="ML model not loaded"
            )

        # -------- Fetch features and chart series --------
        features_df, chart_data, current_price, error_msg = get_features(symbol)

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

        # -------- Build reasons --------
        rsi = float(features_df.iloc[0].get("rsi", 0))
        sma20 = float(features_df.iloc[0].get("sma_20", 0))
        sma50 = float(features_df.iloc[0].get("sma_50", 0))
        vol = float(features_df.iloc[0].get("volatility", 0))

        reasons = []
        if rsi >= 70:
            reasons.append(f"RSI at {rsi:.1f} indicates overbought momentum")
        elif rsi <= 30:
            reasons.append(f"RSI at {rsi:.1f} indicates oversold momentum")
        else:
            reasons.append(f"RSI at {rsi:.1f} indicates stable momentum")

        if sma20 > sma50:
            reasons.append("Price is above short-term and medium-term averages")
        else:
            reasons.append("Price is below medium-term average, showing weaker trend")

        if vol >= 0.04:
            reasons.append("Elevated 10-day volatility")
        else:
            reasons.append("Volatility is relatively contained")

        risk_level = (
            "HIGH" if risk_score > 0.6
            else "MEDIUM" if risk_score > 0.4
            else "LOW"
        )

        recommendation = (
            "High downside risk — consider selling"
            if risk_score > 0.6
            else "Moderate risk — monitor closely"
            if risk_score > 0.4
            else "Low risk — hold"
        )

        return {
            "symbol": symbol.upper(),
            "risk_score": round(float(risk_score), 3),
            "risk_level": risk_level,
            "recommendation": recommendation,
            "reasons": reasons,
            "charts": chart_data or {},
            "current_price": round(float(current_price), 2)
        }

    except HTTPException:
        raise

    except Exception as e:
        print("❌ Prediction error:")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail="Unexpected error during prediction"
        )
