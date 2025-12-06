from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class AttendanceResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    break_start: Optional[datetime] = None
    break_end: Optional[datetime] = None
    location: Optional[str] = None
    status: str
    notes: Optional[str] = None
    work_hours: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class AttendanceStats(BaseModel):
    user_id: int
    name: str
    email: str
    total_days: int
    present_days: int
    break_days: int
    attendance_rate: float

class AttendanceAnalytics(BaseModel):
    total_records: int
    date_range: Dict[str, str]
    status_breakdown: Dict[str, int]
    daily_trend: List[Dict[str, Any]]
    employee_stats: List[Dict[str, Any]]
    summary: Dict[str, Any]
    
    class Config:
        from_attributes = True

class AttendanceCreate(BaseModel):
    user_id: int
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: str = "checked_in"
    location: Optional[str] = None
    notes: Optional[str] = None

class AttendanceUpdate(BaseModel):
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    break_start: Optional[datetime] = None
    break_end: Optional[datetime] = None
    status: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    work_hours: Optional[str] = None