from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    
    # Assignment
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # manager who assigned
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    
    # Status and Priority
    status = Column(String, default="pending")  # pending, in_progress, completed, on_hold, cancelled
    priority = Column(String, default="normal")  # urgent, high, normal, low
    
    # Timing
    due_date = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    estimated_hours = Column(Float, nullable=True)
    actual_hours = Column(Float, nullable=True)
    
    # Location and Requirements
    location = Column(String, nullable=True)  # where task needs to be done
    equipment_needed = Column(Text, nullable=True)  # tools/equipment required
    is_urgent = Column(Boolean, default=False)
    
    # Progress tracking
    progress_percentage = Column(Integer, default=0)  # 0-100
    last_update = Column(Text, nullable=True)  # latest progress update from worker
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    assignee = relationship("User", foreign_keys=[assigned_to])
    assigner = relationship("User", foreign_keys=[assigned_by])
