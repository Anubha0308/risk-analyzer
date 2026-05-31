"""Shared portfolio utilities to avoid duplicate database queries"""

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException
from database import portfolios_collection, holdings_collection


def get_portfolio_by_id(portfolio_id: str, user_email: str) -> dict:
    
    try:
        oid = ObjectId(portfolio_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid portfolio id")
    
    portfolio = portfolios_collection.find_one({"_id": oid, "email": user_email})
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    return portfolio


def get_portfolio_holdings(portfolio_id: str, user_email: str) -> list[dict]:
    
    holdings = list(
        holdings_collection.find(
            {"portfolio_id": portfolio_id, "email": user_email}
        )
    )
    return holdings


def get_portfolio_with_holdings(portfolio_id: str, user_email: str) -> tuple[dict, list[dict]]:
    
    portfolio = get_portfolio_by_id(portfolio_id, user_email)
    pid = str(portfolio["_id"])
    holdings = get_portfolio_holdings(pid, user_email)
    
    return portfolio, holdings
