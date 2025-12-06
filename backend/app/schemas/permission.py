from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PermissionRequestBase(BaseModel):
    request_type: str  # overtime, vacation, sick_leave, special_access, early_leave
    title: str
    description: str
    requested_date: Optional[datetime] = None
    requested_hours: Optional[str] = None
    priority: str = "normal"  # urgent, high, normal, low
    is_urgent: bool = False

class PermissionRequestCreate(PermissionRequestBase):
    pass

class PermissionRequestUpdate(BaseModel):
    status: Optional[str] = None  # pending, approved, rejected, under_review
    manager_response: Optional[str] = None
    priority: Optional[str] = None

class PermissionRequestResponse(PermissionRequestBase):
    id: int
    user_id: int
    requester_name: str
    requester_email: str
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    status: str
    manager_response: Optional[str] = None
    approved_by: Optional[int] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PermissionStats(BaseModel):
    total_requests: int
    pending_requests: int
    approved_requests: int
    rejected_requests: int
    urgent_requests: int
    requests_by_status: dict
    requests_by_type: dict
    requests_by_priority: dict
    recent_requests: list[PermissionRequestResponse]
    monthly_trend: list[dict]