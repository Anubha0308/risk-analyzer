from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
import os
import joblib
import yfinance as yf
import pandas as pd

from auth_utils import get_current_user
from database import portfolios_collection, holdings_collection
from utils.feature_engineering import get_features, FEATURES

router = APIRouter()

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_MODEL_PATH = os.path.join(_BASE_DIR, "model", "stock_risk_model.pkl")
try:
    _model = joblib.load(_MODEL_PATH) if os.path.exists(_MODEL_PATH) else None
except Exception:
    _model = None


def _parse_portfolio_id(portfolio_id: str) -> ObjectId:
    try:
        return ObjectId(portfolio_id) #from frontend we receive the portfolio id as a string so we need to convert it to an ObjectId
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid portfolio id")


def _get_owned_portfolio(portfolio_id: str, user: str) -> dict:
    oid = _parse_portfolio_id(portfolio_id)
    portfolio = portfolios_collection.find_one({"_id": oid, "email": user})
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio


def _serialize_holding(holding: dict) -> dict:
    return {
        "_id": str(holding["_id"]),
        "symbol": holding["symbol"],
        "quantity": holding["quantity"],
        "price": holding["price"],
        "buy_date": holding["buy_date"],
    }


def _risk_level(score: float) -> str:
    if score > 0.6:
        return "High"
    if score > 0.4:
        return "Medium"
    return "Low"


def _risk_label(score: float) -> str:
    if score > 0.6:
        return "High Risk"
    if score > 0.4:
        return "Moderate Risk"
    return "Low Risk"


def _empty_analysis(name: str) -> dict:
    return {
        "portfolio_name": name,
        "summary": {
            "total_value": 0,
            "total_value_change": 0,
            "total_value_change_pct": 0,
            "total_pl": 0,
            "total_pl_pct": 0,
            "portfolio_risk_score": 0,
            "portfolio_risk_label": "Low Risk",
        },
        "value_over_time": [],
        "risk_contribution": [],
        "sector_allocation": [],
        "holdings": [],
        "holdings_totals": {
            "current_value": 0,
            "pl_amount": 0,
            "pl_pct": 0,
        },
        "ai_suggestion": "Add holdings to analyze your portfolio.",
        "risk_alert": "No holdings in this portfolio yet.",
    }


def _symbol_snapshot(symbol: str) -> dict:
    """Current price, risk score, sector, and company name for one ticker."""
    sym = symbol.upper()
    company_name = sym
    sector = "Other"
    current_price = None
    price_change_pct = 0.0
    risk_score = 0.5

    try:
        info = yf.Ticker(sym).info or {}
        company_name = (
            info.get("shortName")
            or info.get("longName")
            or info.get("displayName")
            or sym
        )
        sector = info.get("sector") or "Other"
    except Exception:
        pass

    if _model is not None:
        try:
            features_df, _, price_change_pct, feat_price, _ = get_features(sym)
            if features_df is not None and not features_df.empty:
                X = features_df[FEATURES]
                if not X.isnull().any().any():
                    risk_score = float(_model.predict_proba(X)[0][1])
                if feat_price is not None:
                    current_price = float(feat_price)
        except Exception:
            pass

    if current_price is None:
        try:
            hist = yf.Ticker(sym).history(period="5d")
            if not hist.empty:
                current_price = float(hist["Close"].iloc[-1])
                if len(hist) >= 2:
                    prev = float(hist["Close"].iloc[-2])
                    if prev:
                        price_change_pct = ((current_price - prev) / prev) * 100
        except Exception:
            current_price = None

    return {
        "company_name": company_name,
        "sector": sector,
        "current_price": current_price,
        "price_change_pct": float(price_change_pct or 0),
        "risk_score": round(risk_score, 3),
        "risk_level": _risk_level(risk_score),
    }


def _value_over_time(holdings: list[dict]) -> list[dict]:
    if not holdings:
        return []

    frames = []
    holding_info = {}

    for h in holdings:
        sym = h["symbol"].upper()
        qty = float(h["quantity"])
        buy_date = h.get("buy_date")

        holding_info[sym] = {
            "quantity": holding_info.get(sym, {}).get("quantity", 0) + qty,
            "buy_date": buy_date
        }

        try:
            hist = yf.Ticker(sym).history(period="6mo")

            if hist.empty:
                continue

            frames.append(hist["Close"].rename(sym))

        except Exception:
            continue

    if not frames:
        return []

    prices = pd.concat(frames, axis=1).sort_index().ffill()

    portfolio_value = pd.Series(0.0, index=prices.index)

    for sym, info in holding_info.items():
        if sym not in prices.columns:
            continue

        qty = info["quantity"]
        buy_date = info.get("buy_date")

        stock_values = prices[sym] * qty

        if buy_date:
            buy_date = pd.to_datetime(buy_date)

            if stock_values.index.tz is not None and buy_date.tzinfo is None:
                buy_date = buy_date.tz_localize(stock_values.index.tz)

            stock_values = stock_values.where(stock_values.index >= buy_date, 0)

        portfolio_value += stock_values.fillna(0)

    weekly = portfolio_value.resample("W").last().dropna()

    return [
        {
            "date": idx.strftime("%d %b"),
            "value": round(float(val), 2)
        }
        for idx, val in weekly.items()
    ]


def _build_suggestions(
    risk_contribution: list[dict],
    sector_allocation: list[dict],
    portfolio_risk_score: float,
) -> tuple[str, str]:

    parts = []

    if risk_contribution:
        top = risk_contribution[0]

        if top["value"] >= 25:
            parts.append(
                f"Reduce {top['name']} allocation — it contributes {top['value']:.0f}% of portfolio risk."
            )

    if sector_allocation:
        top_sector = sector_allocation[0]

        if top_sector["value"] >= 40:
            parts.append(
                f"Increase diversification beyond {top_sector['name']} ({top_sector['value']:.0f}% of value)."
            )

    if portfolio_risk_score > 0.6:
        parts.append(
            "Portfolio risk is elevated — consider trimming high-risk positions."
        )

    ai_suggestion = (
        " ".join(parts)
        if parts
        else "Portfolio allocation looks balanced. Continue monitoring key positions."
    )

    label = _risk_label(portfolio_risk_score).replace(" Risk", "")

    if portfolio_risk_score > 0.6:
        risk_alert = (
            f"Your portfolio risk score is {label}. "
            "Consider diversifying more to reduce concentration risk."
        )

    elif portfolio_risk_score > 0.4:
        risk_alert = (
            f"Your portfolio risk score is {label}. "
            "Monitor high-risk holdings and sector concentration."
        )

    else:
        risk_alert = (
            f"Your portfolio risk score is {label}. "
            "Risk profile looks stable."
        )

    return ai_suggestion, risk_alert


@router.get("/get_portfolios")
async def get_portfolios(user: str = Depends(get_current_user)):
    try:
        portfolios_cursor = portfolios_collection.find(
            {"email": user},
            {"_id": 1, "name": 1},#getting only the id and name of the portfolio
        )
        #make it a list 
        portfolios = [
            {"_id": str(portfolio["_id"]), "name": portfolio["name"]} # we have the _id also in portfolios list 
            for portfolio in portfolios_cursor
        ]

        return {"portfolios": portfolios}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create_portfolio")
async def create_portfolio(request: Request, user: str = Depends(get_current_user)):
    try:
        data = await request.json()
        name = data.get("name")

        if not name or not str(name).strip():
            raise HTTPException(status_code=400, detail="Portfolio name is required")

        name = str(name).strip()
        if len(name) > 20:
            raise HTTPException(
                status_code=400,
                detail="Portfolio name should be less than 20 characters",
            )

        result = portfolios_collection.insert_one(
            {
                "email": user,
                "name": name,
                "created_at": datetime.now(timezone.utc),
            }
        )

        return {
            "success": True,
            "portfolio": {
                "_id": str(result.inserted_id),
                "name": name,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/rename_portfolio")
async def rename_portfolio(request: Request, user: str = Depends(get_current_user)):
    try:
        data = await request.json()
        portfolio_id = data.get("id")
        newname = data.get("name")
        oid =  _parse_portfolio_id(portfolio_id)
        
        if not newname or not str(newname).strip():
            raise HTTPException(status_code=400, detail="Portfolio name is required")
        
        portfolios_collection.update_one(
            {"_id": oid},
            {"$set": {"name": newname}}
        )
        return {"success": True}
        
    except HTTPException:  
        raise
    except Exception as e: 
        raise HTTPException(status_code=500, detail=str(e))
        
        
        
@router.get("/get_portfolio/{portfolio_id}")
async def get_portfolio(portfolio_id: str, user: str = Depends(get_current_user)):#in the body from frontend we receive id 
    try:
        portfolio = _get_owned_portfolio(portfolio_id, user)
        pid = str(portfolio["_id"])

        holdings_cursor = holdings_collection.find(
            {"portfolio_id": pid, "email": user}
        )

        holdings = [_serialize_holding(h) for h in holdings_cursor]

        return {
            "name": portfolio["name"],
            "holdings": holdings,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/add_stock")
async def add_stock(request: Request, user: str = Depends(get_current_user)):
    try:
        data = await request.json()
        portfolio_id = data.get("portfolioId")
        symbol = (data.get("symbol") or "").strip().upper()
        quantity = data.get("quantity")
        price = data.get("price")
        buydate = data.get("buyDate")

        if not portfolio_id:
            raise HTTPException(status_code=400, detail="portfolioId is required")
        if not symbol:
            raise HTTPException(status_code=400, detail="symbol is required")
        if not buydate:
            raise HTTPException(status_code=400, detail="buyDate is required")
        if quantity is None or price is None:
            raise HTTPException(status_code=400, detail="quantity and price are required")

        quantity = float(quantity)
        price = float(price)
        if quantity <= 0 or price <= 0:
            raise HTTPException(
                status_code=400,
                detail="quantity and price must be greater than zero",
            )

        _get_owned_portfolio(portfolio_id, user)
        pid = str(_parse_portfolio_id(portfolio_id))

        existing = holdings_collection.find_one(
            {"portfolio_id": pid, "email": user, "symbol": symbol}
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"{symbol} is already in this portfolio",
            )

        result = holdings_collection.insert_one(
            {
                "portfolio_id": pid,
                "email": user,
                "symbol": symbol,
                "quantity": quantity,
                "price": price,
                "buy_date": buydate,
                "created_at": datetime.now(timezone.utc),
            }
        )

        stock = _serialize_holding(
            {
                "_id": result.inserted_id,
                "symbol": symbol,
                "quantity": quantity,
                "price": price,
                "buy_date": buydate,
            }
        )

        return {"success": True, "stock": stock}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete_stock1")
async def delete_stock(request: Request, user: str = Depends(get_current_user)):
    try:
        data = await request.json()
        portfolio_id = data.get("portfolioId")
        stock_id = data.get("stockId")

        if not portfolio_id or not stock_id:
            raise HTTPException(
                status_code=400, detail="portfolioId and stockId are required"
            )

        _get_owned_portfolio(portfolio_id, user)
        pid = str(_parse_portfolio_id(portfolio_id))

        try:
            stock_oid = ObjectId(stock_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid stock id")

        result = holdings_collection.delete_one(
            {
                "_id": stock_oid,
                "portfolio_id": pid,
                "email": user,
            }
        )

        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Stock not found")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update_stock")
async def update_stock(request: Request, user: str = Depends(get_current_user)):
    try:
        data = await request.json()
        portfolio_id = data.get("portfolioId")
        stock_id = data.get("stockId")
        quantity = data.get("quantity")
        price = data.get("price")
        buydate = data.get("buy_date")

        if not portfolio_id or not stock_id:
            raise HTTPException(
                status_code=400, detail="portfolioId and stockId are required"
            )
        if quantity is None or price is None:
            raise HTTPException(status_code=400, detail="quantity and price are required")
        if not buydate:
            raise HTTPException(status_code=400, detail="buy_date is required")

        quantity = float(quantity)
        price = float(price)
        if quantity <= 0 or price <= 0:
            raise HTTPException(
                status_code=400,
                detail="quantity and price must be greater than zero",
            )

        _get_owned_portfolio(portfolio_id, user)
        pid = str(_parse_portfolio_id(portfolio_id))

        try:
            stock_oid = ObjectId(stock_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid stock id")

        result = holdings_collection.update_one(
            {
                "_id": stock_oid,
                "portfolio_id": pid,
                "email": user,
            },
            {"$set": {"quantity": quantity, "price": price, "buy_date": buydate}},
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Stock not found")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze_portfolio")
async def analyze_portfolio(request: Request, user: str = Depends(get_current_user)):
    try:
        data = await request.json()
        portfolio_id = data.get("portfolioId") or data.get("PortfolioId")
        if not portfolio_id:
            raise HTTPException(status_code=400, detail="portfolioId is required")

        portfolio = _get_owned_portfolio(portfolio_id, user)
        pid = str(portfolio["_id"])

        db_holdings = list(
            holdings_collection.find({"portfolio_id": pid, "email": user})
        )
        if not db_holdings:
            return {"success": True, "resultData": _empty_analysis(portfolio["name"])}

        rows = []
        total_value = 0.0
        total_cost = 0.0
        total_day_change = 0.0
        risk_weight_sum = 0.0

        for h in db_holdings:
            qty = float(h["quantity"])
            buy_price = float(h["price"])
            snap = _symbol_snapshot(h["symbol"])

            current_price = snap["current_price"] if snap["current_price"] else buy_price
            current_value = qty * current_price
            cost_basis = qty * buy_price
            pl_amount = current_value - cost_basis
            pl_pct = (pl_amount / cost_basis * 100) if cost_basis > 0 else 0.0
            day_change = current_value * (snap["price_change_pct"] / 100)

            total_value += current_value
            total_cost += cost_basis
            total_day_change += day_change
            risk_weight_sum += snap["risk_score"] * current_value

            rows.append(
                {
                    "_id": str(h["_id"]),
                    "symbol": h["symbol"].upper(),
                    "name": snap["company_name"],
                    "sector": snap["sector"],
                    "quantity": qty,
                    "avg_buy_price": round(buy_price, 2),
                    "current_price": round(current_price, 2),
                    "current_value": round(current_value, 2),
                    "pl_amount": round(pl_amount, 2),
                    "pl_pct": round(pl_pct, 2),
                    "risk_score": snap["risk_score"],
                    "risk_level": snap["risk_level"],
                }
            )

        total_pl = total_value - total_cost #this is the total profit or loss of the portfolio
        total_pl_pct = (total_pl / total_cost * 100) if total_cost > 0 else 0.0 #this is the profit or loss in percentage
        prev_value = total_value - total_day_change
        total_value_change_pct = ( #value change percentage 
            (total_day_change / prev_value * 100) if prev_value > 0 else 0.0
        )

        portfolio_risk_score = (
            risk_weight_sum / total_value if total_value > 0 else 0.0
        )

        risk_contribution = []

        if risk_weight_sum > 0:
            risk_contribution = [
                {
                    "name": r["symbol"],
                    "value": round((r["risk_score"] * r["current_value"]) / risk_weight_sum * 100, 1),
                }
                for r in rows
            ]
            risk_contribution.sort(key=lambda x: x["value"], reverse=True)


        sector_values = {}

        for r in rows:
            sector = r.get("sector") or "Others"
            sector_values[sector] = sector_values.get(sector, 0) + r["current_value"]


        sector_allocation = [
            {
                "name": sector,
                "value": round(value / total_value * 100, 1)
            }
            for sector, value in sorted(sector_values.items(), key=lambda x: -x[1])
        ]

        ai_suggestion, risk_alert = _build_suggestions(
            risk_contribution, sector_allocation, portfolio_risk_score
        )

        result_data = {
            "portfolio_name": portfolio["name"],
            "summary": {
                "total_value": round(total_value, 2),
                "total_value_change": round(total_day_change, 2),
                "total_value_change_pct": round(total_value_change_pct, 2),
                "total_pl": round(total_pl, 2),
                "total_pl_pct": round(total_pl_pct, 2),
                "portfolio_risk_score": round(portfolio_risk_score, 2),
                "portfolio_risk_label": _risk_label(portfolio_risk_score),
            },
            "value_over_time": _value_over_time(db_holdings),
            "risk_contribution": risk_contribution,
            "sector_allocation": sector_allocation,
            "holdings": rows,
            "holdings_totals": {
                "current_value": round(total_value, 2),
                "pl_amount": round(total_pl, 2),
                "pl_pct": round(total_pl_pct, 2),
            },
            "ai_suggestion": ai_suggestion,
            "risk_alert": risk_alert,
        }

        return {"success": True, "resultData": result_data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

