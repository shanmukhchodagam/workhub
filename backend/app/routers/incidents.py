from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.incident import Incident

router = APIRouter(
    prefix="/incidents",
    tags=["incidents"],
    responses={404: {"description": "Not found"}},
)

@router.get("/")
async def get_incidents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Incident))
    incidents = result.scalars().all()
    return incidents
