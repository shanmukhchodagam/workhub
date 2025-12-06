from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class IncidentBase(BaseModel):
    description: str
    severity: str  # low, medium, high, critical
    image_url: Optional[str] = None

class IncidentCreate(IncidentBase):
    pass

class IncidentUpdate(BaseModel):
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    resolution: Optional[str] = None
    image_url: Optional[str] = None

class IncidentResponse(IncidentBase):
    id: int
    reported_by: int
    reported_by_name: str
    reported_by_email: str
    status: str = "open"
    resolution: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class IncidentStats(BaseModel):
    total_incidents: int
    open_incidents: int
    resolved_incidents: int
    critical_incidents: int
    high_incidents: int
    medium_incidents: int
    low_incidents: int
    incidents_by_status: dict
    incidents_by_severity: dict
    recent_incidents: list[IncidentResponse]
    monthly_trend: list[dict]