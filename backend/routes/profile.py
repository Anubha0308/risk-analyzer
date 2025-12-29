from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import traceback

from auth_utils import get_current_user
from database import user_info_collection


router=APIRouter(prefix="/profile",tags=["profile"])

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    watchlist: Optional[List[str]] = None

@router.get("/")
async def get_profile(user: str = Depends(get_current_user)):
    try:
        profile= user_info_collection.find_one({"email":user})
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        # Remove MongoDB _id field for JSON serialization
        if "_id" in profile:
            profile["_id"] = str(profile["_id"])
        return profile
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/")
async def update_profile(
    update_data: UpdateProfileRequest,
    user: str = Depends(get_current_user)
):
    try:
        update_dict = {}
        if update_data.full_name is not None:
            update_dict["full_name"] = update_data.full_name
        if update_data.watchlist is not None:
            update_dict["watchlist"] = update_data.watchlist
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        result = user_info_collection.update_one(
            {"email": user},
            {"$set": update_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        # Return updated profile
        updated_profile = user_info_collection.find_one({"email": user})
        if "_id" in updated_profile:
            updated_profile["_id"] = str(updated_profile["_id"])
        return updated_profile
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))