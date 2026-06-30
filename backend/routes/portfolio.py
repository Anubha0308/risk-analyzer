from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
import os
import joblib
import yfinance as yf
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats

from auth_utils import get_current_user
from database import portfolios_collection, holdings_collection, user_info_collection
from utils.feature_engineering import get_features, FEATURES
from utils.portfolio_utils import get_portfolio_with_holdings
from utils.exchange_price import get_exchange_rate

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
        "currency_type" : holding["currency_type"]
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


def _empty_analysis(portfolio_id: str, name: str) -> dict:
    return {
        "portfolio_id": portfolio_id,
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


def _value_over_time(holdings: list[dict], base_currency: str = "USD") -> list[dict]:
    if not holdings:
        return []

    frames = []
    holding_info = {}

    for h in holdings:
        sym = h["symbol"].upper()
        qty = float(h["quantity"])
        buy_date = h.get("buy_date")
        currency_type = h.get("currency_type", "USD")

        holding_info[sym] = {
            "quantity": holding_info.get(sym, {}).get("quantity", 0) + qty,
            "buy_date": buy_date,
            "currency_type": currency_type,
        }

        try:
            hist = yf.Ticker(sym).history(period="6mo")

            if hist.empty:
                continue

            close_series = hist["Close"].astype(float)
            if currency_type.upper() != base_currency.upper():
                fx_multiplier = get_exchange_rate(
                    from_currency=currency_type,
                    to_currency=base_currency,
                )
                close_series = close_series * fx_multiplier

            frames.append(close_series.rename(sym))

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




def _analyze_fx_trend(close: pd.Series) -> dict:

    prices = close.values.astype(float)
    n      = len(prices)
    mean_price = prices.mean()

    x = np.arange(n)
    slope, intercept, r_value, p_value, _ = scipy_stats.linregress(x, prices)
    r_squared        = float(r_value ** 2)
    # Express slope as daily % of mean so it's currency-scale independent
    slope_pct_per_day = float((slope / mean_price) * 100) if mean_price else 0.0

    s = pd.Series(prices)
    short_ma = s.rolling(10).mean()
    long_ma  = s.rolling(30).mean()

    # Current gap as % of long MA
    curr_short = float(short_ma.iloc[-1]) if not np.isnan(short_ma.iloc[-1]) else 0.0
    curr_long  = float(long_ma.iloc[-1])  if not np.isnan(long_ma.iloc[-1])  else 0.0
    short_above_long = curr_short > curr_long
    ma_gap_pct = float(((curr_short - curr_long) / curr_long) * 100) if curr_long else 0.0

    # Find how many days ago the last crossover happened
    diff_sign = np.sign(short_ma.values - long_ma.values)
    crossover_days_ago = n   # default: no crossover found in window
    for i in range(n - 2, 29, -1):       # need ≥30 rows for long_ma to be valid
        if not np.isnan(diff_sign[i]) and not np.isnan(diff_sign[i - 1]):
            if diff_sign[i] != diff_sign[i - 1]:
                crossover_days_ago = n - 1 - i
                break

    if n >= 35:
        gap_now  = float(short_ma.iloc[-1] - long_ma.iloc[-1])
        gap_prev = float(short_ma.iloc[-6] - long_ma.iloc[-6])
        gap_widening = abs(gap_now) > abs(gap_prev)
    else:
        gap_widening = False

    # ── Signal 3: Rolling volatility ─────────────────────────────────────
    daily_returns = s.pct_change().dropna()
    current_vol_ann = float(daily_returns.iloc[-20:].std() * np.sqrt(252)) if len(daily_returns) >= 20 else 0.0
    hist_vol_ann    = float(daily_returns.std() * np.sqrt(252)) if len(daily_returns) > 1 else 0.0
    vol_ratio       = (current_vol_ann / hist_vol_ann) if hist_vol_ann > 0 else 1.0

    if vol_ratio > 1.4:
        vol_label = "high"
    elif vol_ratio < 0.7:
        vol_label = "low"
    else:
        vol_label = "normal"

    
    slope_vote   = 1.0 if slope_pct_per_day > 0 else -1.0
    slope_weight = r_squared                          # 0.0 – 1.0

    # MA vote: direction of gap, weighted by gap size (capped at 1).
    #   Larger gap = stronger momentum signal.
    ma_vote   = 1.0 if short_above_long else -1.0
    ma_weight = min(abs(ma_gap_pct) / 1.0, 1.0)     # 1% gap → full weight

    net_score = (slope_vote * slope_weight) + (ma_vote * ma_weight)
    # net_score range: [-2, +2]

    if net_score > 0.15:
        trend_direction = "weakening"       # USDINR trending up → INR weakening
    elif net_score < -0.15:
        trend_direction = "strengthening"   # USDINR trending down → INR strengthening
    else:
        trend_direction = "neutral"

    abs_score = abs(net_score)
    if abs_score >= 1.2:
        trend_strength = "strong"
    elif abs_score >= 0.5:
        trend_strength = "moderate"
    else:
        trend_strength = "weak"

    if crossover_days_ago <= 7:
        trend_maturity = "early"
    elif not gap_widening:
        trend_maturity = "fading"
    else:
        trend_maturity = "established"

    return {
        # Raw signal values — exposed in API response for frontend charts
        "slope_pct_per_day":  round(slope_pct_per_day, 5),
        "r_squared":          round(r_squared, 3),
        "ma_gap_pct":         round(ma_gap_pct, 3),
        "short_above_long":   short_above_long,
        "crossover_days_ago": crossover_days_ago,
        "gap_widening":       gap_widening,
        "current_vol_ann":    round(current_vol_ann, 4),
        "hist_vol_ann":       round(hist_vol_ann, 4),
        "vol_ratio":          round(vol_ratio, 3),
        "vol_label":          vol_label,
        # Composite labels consumed by _build_fx_recommendation
        "trend_direction":    trend_direction,   # "weakening" | "strengthening" | "neutral"
        "trend_strength":     trend_strength,    # "strong" | "moderate" | "weak"
        "trend_maturity":     trend_maturity,    # "early" | "established" | "fading"
        "net_score":          round(net_score, 3),
    }


def _build_fx_recommendation(
    usd_pct:    float,
    inr_pct:    float,
    signal:     dict,          # output of _analyze_fx_trend
    fx_change_30d: float | None,
    fx_change_90d: float | None,
    usd_pl_pct: float,
    inr_pl_pct: float,
) -> str:
    """
      - trend_direction  (which way to tilt)
      - trend_strength   (how strongly to say it)
      - trend_maturity   (how confident to sound)
      - vol_label        (whether to add a hedging caveat)
    strong + established → 8–12 %   (assertive, specific number)
    moderate + established → 4–7 %  (directional, specific number)
    weak OR early OR fading → no %  (watch and wait language)
    high volatility → always soften + add hedging note
    """

    direction  = signal["trend_direction"]
    strength   = signal["trend_strength"]
    maturity   = signal["trend_maturity"]
    vol_label  = signal["vol_label"]
    r_sq       = signal["r_squared"]
    gap_wide   = signal["gap_widening"]
    cross_days = signal["crossover_days_ago"]

    parts = []

    if direction == "weakening":
        change_desc = (
            f"~{abs(fx_change_30d):.1f}% over 30 days"
            + (f" and ~{abs(fx_change_90d):.1f}% over 90 days" if fx_change_90d is not None else "")
            if fx_change_30d is not None else "over the recent window"
        )
        if strength == "strong" and maturity == "established":
            parts.append(
                f"INR is in a confirmed, sustained weakening trend ({change_desc}). "
                f"The regression line fits tightly (R²={r_sq:.2f}) and the short-term "
                f"moving average has been above the long-term MA for {cross_days} days "
                f"with a widening gap — all three signals agree."
            )
        elif maturity == "early":
            parts.append(
                f"INR may be beginning to weaken ({change_desc}), but the moving average "
                f"crossover only happened {cross_days} day(s) ago — too early to confirm. "
                f"Monitor over the next 1–2 weeks before acting."
            )
        elif maturity == "fading":
            parts.append(
                f"INR has been weakening ({change_desc}) but momentum appears to be fading "
                f"— the MA gap is narrowing. The trend may be losing steam."
            )
        else:  # moderate / established
            parts.append(
                f"INR shows a moderate weakening trend ({change_desc}). "
                f"Moving averages support the direction but conviction is not yet strong "
                f"(R²={r_sq:.2f})."
            )

    elif direction == "strengthening":
        change_desc = (
            f"~{abs(fx_change_30d):.1f}% over 30 days"
            + (f" and ~{abs(fx_change_90d):.1f}% over 90 days" if fx_change_90d is not None else "")
            if fx_change_30d is not None else "over the recent window"
        )
        if strength == "strong" and maturity == "established":
            parts.append(
                f"INR is in a confirmed strengthening trend ({change_desc}). "
                f"Regression and moving averages are aligned (R²={r_sq:.2f}, "
                f"crossover {cross_days} days ago, gap widening)."
            )
        elif maturity == "early":
            parts.append(
                f"INR may be starting to strengthen ({change_desc}), but the crossover "
                f"is only {cross_days} day(s) old. Wait for confirmation before rebalancing."
            )
        elif maturity == "fading":
            parts.append(
                f"INR was strengthening ({change_desc}) but the trend appears to be fading. "
                f"Avoid adding INR exposure until the direction re-confirms."
            )
        else:
            parts.append(
                f"INR shows a moderate strengthening trend ({change_desc}). "
                f"The signal exists but is not yet strong enough for large rebalancing."
            )

    else:  # neutral
        parts.append(
            "USD/INR shows no clear directional trend. "
            "Regression slope is flat and moving averages are tightly clustered — "
            "currency is not a meaningful driver of returns right now."
        )

    can_give_specific_pct = (
        direction != "neutral"
        and maturity != "early"
        and vol_label != "high"
    )

    if direction == "weakening":
        if usd_pct < 45:
            if can_give_specific_pct:
                shift_pct = "8–12%" if strength == "strong" and maturity == "established" else "4–7%"
                parts.append(
                    f"Your USD allocation is {usd_pct:.1f}% — below optimal for this environment. "
                    f"Consider shifting {shift_pct} from INR to USD stocks."
                )
            else:
                parts.append(
                    f"Your USD allocation ({usd_pct:.1f}%) is on the lower side. "
                    f"Hold off on large shifts until the trend matures or volatility settles."
                )
        elif usd_pct > 70:
            parts.append(
                f"USD allocation ({usd_pct:.1f}%) is already high. "
                f"The trend favours USD but further concentration adds US-market risk. "
                f"No additional shift recommended."
            )
        else:
            parts.append(
                f"USD allocation ({usd_pct:.1f}%) is within a reasonable band. "
                f"{'Maintain or modestly tilt toward USD.' if maturity == 'established' else 'Monitor before acting.'}"
            )

    elif direction == "strengthening":
        if inr_pct < 40:
            if can_give_specific_pct:
                shift_pct = "8–12%" if strength == "strong" and maturity == "established" else "4–7%"
                parts.append(
                    f"Your INR allocation is only {inr_pct:.1f}%. "
                    f"Consider shifting {shift_pct} from USD to NSE stocks."
                )
            else:
                parts.append(
                    f"Your INR allocation ({inr_pct:.1f}%) is low but the signal is not "
                    f"strong enough yet to justify a large shift. Watch the trend."
                )
        elif inr_pct > 75:
            parts.append(
                f"INR allocation ({inr_pct:.1f}%) is dominant. "
                f"Rupee strength supports this but maintain at least 25–30% in USD for global diversification."
            )
        else:
            parts.append(
                f"INR allocation ({inr_pct:.1f}%) is reasonable. "
                f"{'Consider a modest tilt toward INR.' if maturity == 'established' else 'Hold and monitor.'}"
            )

    else:  # neutral
        parts.append(
            f"Current split — USD {usd_pct:.1f}% / INR {inr_pct:.1f}% — is fine to maintain. "
            f"Focus on stock-level risk and sector diversification instead."
        )

    if vol_label == "high":
        parts.append(
            f"Note: FX volatility is elevated right now "
            f"(current annualised vol is {signal['vol_ratio']:.1f}x the historical average). "
            f"Avoid large rebalancing until the rate stabilises — "
            f"high FX swings increase execution risk."
        )
    elif vol_label == "low" and direction != "neutral":
        parts.append(
            f"FX volatility is unusually low ({signal['vol_ratio']:.1f}x historical), "
            f"which makes this a lower-risk window to execute any rebalancing if you choose to act."
        )

    pl_diff = usd_pl_pct - inr_pl_pct
    if abs(pl_diff) >= 5:
        if pl_diff > 0:
            parts.append(
                f"USD holdings are outperforming INR holdings by {pl_diff:.1f}% in total returns"
                f"{'— consistent with the FX trend.' if direction == 'weakening' else ', though this diverges from the FX signal.'}"
            )
        else:
            parts.append(
                f"INR holdings are outperforming USD holdings by {abs(pl_diff):.1f}% in total returns"
                f"{'— consistent with the FX trend.' if direction == 'strengthening' else ', though this diverges from the FX signal.'}"
            )

    return " ".join(parts)


def _currency_fx_insight(
    rows: list[dict],
    base_currency: str,
    total_value: float,
) -> dict:
    

    usd_value = sum(r["current_value"] for r in rows if r.get("currency_type") == "USD")
    inr_value = sum(r["current_value"] for r in rows if r.get("currency_type") == "INR")

    usd_pct = (usd_value / total_value * 100) if total_value else 0.0
    inr_pct = (inr_value / total_value * 100) if total_value else 0.0

    usd_pl = sum(r["pl_amount"] for r in rows if r.get("currency_type") == "USD")
    inr_pl = sum(r["pl_amount"] for r in rows if r.get("currency_type") == "INR")

    usd_pl_pct = (usd_pl / usd_value * 100) if usd_value > 0 else 0.0
    inr_pl_pct = (inr_pl / inr_value * 100) if inr_value > 0 else 0.0

    fx_rate_current: float | None = None
    fx_change_30d:   float | None = None
    fx_change_90d:   float | None = None
    signal: dict | None = None

    try:
        fx_hist = yf.Ticker("USDINR=X").history(period="6mo")

        if not fx_hist.empty:
            close = fx_hist["Close"].dropna()
            fx_rate_current = float(close.iloc[-1])

            if len(close) >= 22:
                fx_change_30d = float(
                    (close.iloc[-1] - close.iloc[-22]) / close.iloc[-22] * 100
                )
            if len(close) >= 60:
                fx_change_90d = float(
                    (close.iloc[-1] - close.iloc[-60]) / close.iloc[-60] * 100
                )

            if len(close) >= 35:
                signal = _analyze_fx_trend(close)

    except Exception:
        pass  # graceful degradation: return allocation data without trend signal

    # ── 3. Build recommendation ───────────────────────────────────────────
    if signal is not None:
        recommendation = _build_fx_recommendation(
            usd_pct, inr_pct, signal,
            fx_change_30d, fx_change_90d,
            usd_pl_pct, inr_pl_pct,
        )
    else:
        # Fallback when yfinance failed or not enough history
        recommendation = (
            "FX trend data unavailable. "
            f"Current split: USD {usd_pct:.1f}% / INR {inr_pct:.1f}%. "
            "Check your connection and try again."
        )
    
    usd_allocation_pct = round(usd_pct, 2)
    inr_allocation_pct = round(inr_pct, 2)
    
    usd_pl_pct = round(usd_pl_pct, 2)
    inr_pl_pct = round(inr_pl_pct, 2)
    usdinrallocation=[]
    usdinr_pl_pct=[]
    usdinrallocation.append({"name" : "usd", "value": usd_allocation_pct})
    usdinrallocation.append({"name" :"inr" ,"value":inr_allocation_pct})
    usdinr_pl_pct.append({"name": "usd" ,"value":usd_pl_pct})
    usdinr_pl_pct.append({"name": "inr","value":inr_pl_pct})
    
    return {
        # Allocation
        "usdinrallocation" : usdinrallocation,
        "usdinr_pl_pct" : usdinr_pl_pct,
        # Raw FX numbers
        "fx_rate_current":    round(fx_rate_current, 4) if fx_rate_current else None,
        "fx_change_30d_pct":  round(fx_change_30d, 3) if fx_change_30d is not None else None,
        # Multi-signal analysis (all sub-fields from _analyze_fx_trend exposed
        # so the frontend can build charts from raw values if needed)
        "trend_signal":       signal,
        # Final output
        "recommendation":     recommendation,
    }


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
async def get_portfolio(portfolio_id: str, user: str = Depends(get_current_user)):
    try:
        # Use shared utility to fetch portfolio and holdings
        portfolio, holdings = get_portfolio_with_holdings(portfolio_id, user)

        serialized_holdings = [_serialize_holding(h) for h in holdings]

        return {
            "name": portfolio["name"],
            "holdings": serialized_holdings,
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
        currency_type = yf.Ticker(symbol).info.get("currency")
        
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
                "currency_type" : currency_type,
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
                "currency_type": currency_type
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
        portfolio_name = data.get("name")
        if not portfolio_id:
            raise HTTPException(status_code=400, detail="portfolioId is required")

        portfolio, db_holdings = get_portfolio_with_holdings(portfolio_id, user)

        user_info = user_info_collection.find_one({"email": user}) or {}
        base_currency = (user_info.get("base_currency") or "USD").upper()
        
        if not db_holdings:
            return {
                "success": True,
                "resultData": _empty_analysis(str(portfolio["_id"]), portfolio["name"]),
            }

        rows = []
        total_value = 0.0
        total_cost = 0.0
        total_day_change = 0.0
        risk_weight_sum = 0.0

        for h in db_holdings:
            qty = float(h["quantity"])
            buy_price = float(h["price"])
            snap = _symbol_snapshot(h["symbol"])
            asset_currency = h.get("currency_type", "USD")

            current_price = snap["current_price"] if snap["current_price"] else buy_price
            fx_multiplier = get_exchange_rate(
                from_currency=asset_currency,
                to_currency=base_currency,
            )

            current_price_usd = current_price * fx_multiplier
            buy_price_usd = buy_price * fx_multiplier
            current_value = qty * current_price_usd
            cost_basis = qty * buy_price_usd#cost price (jisme buy kiya tha)
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
                    "avg_buy_price_usd": round(buy_price_usd, 2),
                    "current_price": round(current_price, 2),
                    "current_price_usd": round(current_price_usd, 2),
                    "current_value": round(current_value, 2),
                    "currency_type": asset_currency,
                    "fx_rate": round(fx_multiplier, 6),
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

        currency_insight = _currency_fx_insight(rows, base_currency, total_value)

        result_data = {
            "portfolio_id": str(portfolio_id),
            "portfolio_name": portfolio_name,
            "base_currency": base_currency,
            "summary": {
                "total_value": round(total_value, 2),
                "total_value_change": round(total_day_change, 2),
                "total_value_change_pct": round(total_value_change_pct, 2),
                "total_pl": round(total_pl, 2),
                "total_pl_pct": round(total_pl_pct, 2),
                "portfolio_risk_score": round(portfolio_risk_score, 2),
                "portfolio_risk_label": _risk_label(portfolio_risk_score),
            },
            "value_over_time": _value_over_time(db_holdings, base_currency),
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
            "currency_insight": currency_insight,   # ← NEW: FX trend + rebalancing advice
        }

        return {"success": True, "resultData": result_data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))