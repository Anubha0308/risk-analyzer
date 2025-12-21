from fastapi import APIRouter, HTTPException, Depends
import traceback
import yfinance as yf
import joblib
import os

from utils.feature_engineering import build_features
from main import get_current_user  # reuse auth

router = APIRouter(prefix="/predict", tags=["Prediction"])

# Load model ONCE
MODEL_PATH = os.path.join("model", "stock_risk_model.pkl")
model = joblib.load(MODEL_PATH)

@router.get("/risk/{symbol}")
def predict_risk(symbol: str, user: str = Depends(get_current_user)):
    """
    Predict downside risk for a given stock symbol
    """

    try:
        df = yf.download(symbol, period="6mo", auto_adjust=False, progress=False)

        if df.empty:
            raise HTTPException(status_code=404, detail="Invalid stock symbol")

        features = build_features(df)
        risk_prob = model.predict_proba([features])[0][1]

        if risk_prob > 0.6:
            level = "HIGH"
            recommendation = "High downside risk — consider selling"
        elif risk_prob > 0.4:
            level = "MEDIUM"
            recommendation = "Moderate risk — monitor closely"
        else:
            level = "LOW"
            recommendation = "Low risk — hold"

        return {
            "symbol": symbol.upper(),
            "risk_score": round(float(risk_prob), 3),
            "risk_level": level,
            "recommendation": recommendation
        }

    except Exception as e:
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail=str(e))