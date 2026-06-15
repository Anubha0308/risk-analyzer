from fastapi import APIRouter, Depends, HTTPException, Request
import pandas as pd 
from utils.feature_engineering import _prepare_intraday_data
from auth_utils import get_current_user

router = APIRouter()

@router.get("/intraday-chart/{symbol}")
def get_intraday(symbol : str, user: str = Depends(get_current_user)):
    return _prepare_intraday_data(symbol)