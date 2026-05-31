from fastapi import APIRouter, Depends, HTTPException
import traceback
import joblib
import os
import yfinance as yf
import pandas as pd
import numpy as np
from scipy.optimize import minimize

from auth_utils import get_current_user
from utils.portfolio_utils import get_portfolio_with_holdings
from utils.market_data import get_price_history, get_current_price_info
from utils.feature_engineering import get_features


router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "model", "stock_risk_model.pkl")

try:
    if not os.path.exists(MODEL_PATH):
        model = None
    else:
        model = joblib.load(MODEL_PATH)
except Exception as e:
    print("❌ Failed to load ML model")
    print(e)
    model = None

def _serialize_holding(holding: dict) -> dict:
    return {
        "_id": str(holding["_id"]),
        "symbol": holding["symbol"],
        "quantity": holding["quantity"],
        "price": holding["price"],
        "buy_date": holding["buy_date"],
    }
    
def portfolio_objective(weights, expected_returns, cov_matrix, risk_scores):
    portfolio_return = np.dot(weights, expected_returns)
    portfolio_volatility = np.sqrt(weights.T @ cov_matrix @ weights)
    portfolio_ml_risk = np.dot(weights, risk_scores)

    lambda_volatility = 1
    gamma_ml_risk = 0.5

    score = (
        portfolio_return
        - lambda_volatility * portfolio_volatility
        - gamma_ml_risk * portfolio_ml_risk
    )

    return -score


@router.get("/optimize_portfolio/{portfolio_id}")
def optimize_portfolio(portfolio_id: str, user: str = Depends(get_current_user)):
   
    try:
        
        portfolio, holdings = get_portfolio_with_holdings(portfolio_id, user)
        
        if not holdings:
            raise HTTPException(status_code=400, detail="Portfolio has no holdings to optimize")
        
        close_prices = {}
        expected_returns = []
        risk_scores = []
        
        serialized_holdings = [_serialize_holding(h) for h in holdings]
        
        
        n = len(serialized_holdings)
        if n == 1:
            return {
                "message": "Optimization requires at least 2-3 stocks. With only one stock, diversification is not possible.",
                "suggestions": [{
                    "symbol": serialized_holdings[0]["symbol"],
                    "current_weight": 100,
                    "suggested_weight": 100,
                    "action": "Hold / Review risk",
                    "note": "Add more stocks to enable portfolio optimization."
                }]
            }
        
        for h in serialized_holdings:
            symbol = h["symbol"].upper()

            df, error_msg = get_price_history(symbol, period="1y", min_rows=252)

            if df is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to get price history for {symbol}: {error_msg}"
                )

            close_prices[symbol] = df["Close"]

            features_df, _, _, _, error_msg = get_features(symbol)

            if features_df is None or features_df.empty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to get features for {symbol}: {error_msg}"
                )

            risk_score = float(model.predict_proba(features_df)[0][1])

            daily_return = df["Close"].pct_change().dropna()
            historical_return = float(daily_return.mean() * 252)

            expected_return = historical_return - (risk_score * 0.05)

            h["risk_score"] = round(risk_score, 4)
            h["historical_return"] = round(historical_return, 4)
            h["expected_return"] = round(expected_return, 4)

            expected_returns.append(expected_return)
            risk_scores.append(risk_score)
            
        prices_df = pd.DataFrame(close_prices).dropna()
        returns_df = prices_df.pct_change().dropna()
        
        if returns_df.empty:
            raise HTTPException(status_code=400, detail="Not enough aligned price data for optimization")

        cov_matrix = returns_df.cov().values * 252

        expected_returns = np.array(expected_returns)
        risk_scores = np.array(risk_scores)

        initial_weights = np.array([1 / n] * n)
        
        constraints = (
            {"type": "eq", "fun": lambda weights: np.sum(weights) - 1}
        )
        if n == 2:
            max_weight = 0.80
        elif n == 3:
            max_weight = 0.60
        else:
            max_weight = 0.30
            
        bounds =tuple((0, max_weight) for _ in range(n))
        result = minimize(
            portfolio_objective,
            initial_weights,
            args=(expected_returns, cov_matrix, risk_scores),
            method="SLSQP",
            bounds=bounds,
            constraints=constraints
        )
        
        if not result.success:
            raise HTTPException(status_code=500, detail="Optimization failed: " + result.message)
        
        optimized_weights = result.x
        total_current_value = 0
        
        for h in serialized_holdings:
            symbol = h["symbol"].upper()
            latest_price = float(close_prices[symbol].iloc[-1])
            h["current_price"] = round(latest_price, 2)
            h["current_value"] = latest_price * h["quantity"]
            total_current_value += h["current_value"]
        
        suggestions = []
        
        for i, h in enumerate(serialized_holdings):
            current_weight  = h["current_value"] / total_current_value if total_current_value > 0 else 0
            
            suggested_weight = optimized_weights[i]

            difference = suggested_weight - current_weight

            if difference > 0.03:
                action = "Increase"
            elif difference < -0.03:
                action = "Reduce"
            else:
                action = "Hold"

            suggestions.append({
                "symbol": h["symbol"],
                "current_weight": round(current_weight * 100, 2),
                "suggested_weight": round(suggested_weight * 100, 2),
                "difference": round(difference * 100, 2),
                "action": action,
                "risk_score": h["risk_score"],
                "historical_return": round(h["historical_return"] * 100, 2),
                "expected_return": round(h["expected_return"] * 100, 2),
            })
            
        return {
            "portfolio_id": portfolio_id,
            "optimization_method": "Mean-Variance Optimization with ML downside-risk penalty",
            "suggestions": suggestions
        } #this is response returned to frontend after optimization
        
        
    
    except HTTPException:
        raise
    except Exception as e:
        print("❌ Portfolio optimization error:")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail="Error optimizing portfolio"
        )

#in portfolio optimization we require only the close prices of each stock in portfolio for past 1 year
#o the required columns are close only