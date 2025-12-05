from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    plan_type = Column(String, default="Free") # Free, Pro, Enterprise
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    members = relationship("User", back_populates="team")
    documents = relationship("Document", back_populates="team")
    chat_sessions = relationship("ChatSession", back_populates="team")
