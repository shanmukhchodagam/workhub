from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(Text)
    severity = Column(String, default="low")  # low, medium, high, critical
    status = Column(String, default="open")  # open, in_progress, resolved, closed
    resolution = Column(Text, nullable=True)
    reported_by = Column(Integer, ForeignKey("users.id"))
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
