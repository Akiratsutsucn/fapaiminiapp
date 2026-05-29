"""Demand routes for C-end."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...core.security import get_current_user
from ...models.demand import Demand
from ...schemas import DemandCreate, DemandOut

router = APIRouter()


@router.post("", response_model=DemandOut)
async def create_demand(
    body: DemandCreate,
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    demand = Demand(
        user_id=int(user_data["sub"]),
        name=body.name,
        gender=body.gender,
        phone=body.phone,
        city=body.city or "",
        purpose=body.purpose,
        budget=body.budget,
        own_funds=body.own_funds,
        target_district=body.target_district,
        remark=body.remark,
        source=body.source or "demand-form",
    )
    db.add(demand)
    await db.commit()
    await db.refresh(demand)
    return DemandOut.model_validate(demand)
