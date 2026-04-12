from fastapi import APIRouter, Depends, HTTPException
import traceback
from datetime import datetime, timezone

from auth_utils import get_current_user
from database import notifications_collection as notifications_col

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
@router.get("/")
async def get_notifications(user: str = Depends(get_current_user)):
    try:
        notifs = list(
            notifications_col.find(
                {"user_email": user, "is_read": False},  # ← only unread
                {"_id": 1, "ticker": 1, "message": 1, "risk_score": 1,
                 "is_read": 1, "created_at": 1}
            ).sort("created_at", -1).limit(20)
        )

        for n in notifs:
            n["_id"] = str(n["_id"])
            if isinstance(n.get("created_at"), datetime):
                n["created_at"] = n["created_at"].replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")

        return {"notifications": notifs, "unread_count": len(notifs)} 
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/mark-read")
async def mark_all_read(user: str = Depends(get_current_user)):
    notifications_col.delete_many({"user_email": user})  
    return {"status": "ok"}