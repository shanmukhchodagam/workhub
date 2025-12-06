from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class PermissionRequest(Base):
    __tablename__ = "permission_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # worker requesting
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # assigned manager
    
    # Request details
    request_type = Column(String, nullable=False)  # overtime, vacation, sick_leave, special_access, early_leave
    title = Column(String, nullable=False)  # brief title of request
    description = Column(Text, nullable=False)  # detailed description
    requested_date = Column(DateTime(timezone=True), nullable=True)  # when they want the permission
    requested_hours = Column(String, nullable=True)  # for overtime requests
    
    # Manager response
    status = Column(String, default="pending")  # pending, approved, rejected, under_review
    manager_response = Column(Text, nullable=True)  # manager's comments/reason
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # which manager approved
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    priority = Column(String, default="normal")  # urgent, high, normal, low
    is_urgent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    requester = relationship("User", foreign_keys=[user_id])
    manager = relationship("User", foreign_keys=[manager_id])
    approver = relationship("User", foreign_keys=[approved_by])