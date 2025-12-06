from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    on_hold = "on_hold"
    cancelled = "cancelled"

class TaskPriority(str, Enum):
    urgent = "urgent"
    high = "high"
    normal = "normal"
    low = "low"

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    assigned_to: Optional[int] = None  # Can be null for unassigned tasks
    team_id: Optional[int] = None
    status: TaskStatus = TaskStatus.pending
    priority: TaskPriority = TaskPriority.normal
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    location: Optional[str] = None
    equipment_needed: Optional[str] = None
    is_urgent: bool = False

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    location: Optional[str] = None
    equipment_needed: Optional[str] = None
    is_urgent: Optional[bool] = None
    progress_percentage: Optional[int] = Field(None, ge=0, le=100)
    last_update: Optional[str] = None

class TaskAssignment(BaseModel):
    task_id: int
    assigned_to: int
    assigned_by: int

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    assigned_to: Optional[int]
    assigned_by: Optional[int]
    team_id: Optional[int]
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    estimated_hours: Optional[float]
    actual_hours: Optional[float]
    location: Optional[str]
    equipment_needed: Optional[str]
    is_urgent: bool
    progress_percentage: int
    last_update: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    # Related data
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    assigner_name: Optional[str] = None

    class Config:
        from_attributes = True

class TeamMemberResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    
    class Config:
        from_attributes = True

class TaskStats(BaseModel):
    total_tasks: int
    pending_tasks: int
    in_progress_tasks: int
    completed_tasks: int
    overdue_tasks: int
    urgent_tasks: int
    unassigned_tasks: int