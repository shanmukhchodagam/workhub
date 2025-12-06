from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, and_, extract, select, desc, update
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.core.database import get_db
from app.models.incident import Incident
from app.models.user import User
from app.schemas.incident import IncidentResponse, IncidentCreate, IncidentUpdate, IncidentStats
from app.routers.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/incidents", response_model=List[IncidentResponse])
async def get_incidents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter by status"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    date_from: Optional[date] = Query(None, description="Start date"),
    date_to: Optional[date] = Query(None, description="End date"),
    search: Optional[str] = Query(None, description="Search in description or reporter name")
):
    """Get incidents with optional filters"""
    try:
        # Build query with join to get user info
        query = select(Incident, User).join(User, Incident.reported_by == User.id)
        
        # Apply filters
        conditions = []
        if status:
            conditions.append(Incident.status == status)
        if severity:
            conditions.append(Incident.severity == severity)
        if date_from:
            conditions.append(func.date(Incident.created_at) >= date_from)
        if date_to:
            conditions.append(func.date(Incident.created_at) <= date_to)
        if search:
            search_condition = (
                func.lower(Incident.description).contains(func.lower(search)) |
                func.lower(User.full_name).contains(func.lower(search)) |
                func.lower(User.email).contains(func.lower(search))
            )
            conditions.append(search_condition)
            
        if conditions:
            query = query.where(and_(*conditions))
            
        # Default to last 30 days if no date filter
        if not date_from and not date_to:
            thirty_days_ago = datetime.now().date() - timedelta(days=30)
            query = query.where(func.date(Incident.created_at) >= thirty_days_ago)
            
        query = query.order_by(desc(Incident.created_at))
        result = await db.execute(query)
        records = result.all()
        
        return [
            IncidentResponse(
                id=incident.id,
                description=incident.description,
                severity=incident.severity,
                status=incident.status,
                resolution=incident.resolution,
                reported_by=incident.reported_by,
                reported_by_name=user.full_name or user.email.split('@')[0],
                reported_by_email=user.email,
                image_url=incident.image_url,
                created_at=incident.created_at,
                updated_at=incident.updated_at
            )
            for incident, user in records
        ]
    except Exception as e:
        logger.error(f"Error fetching incidents: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch incidents")

@router.get("/incidents/stats", response_model=IncidentStats)
async def get_incident_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None)
):
    """Get incident statistics"""
    try:
        # Default to current month if no dates provided
        if not date_from or not date_to:
            today = datetime.now().date()
            date_from = date(today.year, today.month, 1)
            date_to = today
            
        # Base filter
        date_filter = and_(
            func.date(Incident.created_at) >= date_from,
            func.date(Incident.created_at) <= date_to
        )
        
        # Total incidents count
        total_query = select(func.count(Incident.id)).where(date_filter)
        total_result = await db.execute(total_query)
        total_incidents = total_result.scalar() or 0
        
        # Status breakdown
        status_query = select(
            Incident.status,
            func.count(Incident.id)
        ).where(date_filter).group_by(Incident.status)
        status_result = await db.execute(status_query)
        status_data = dict(status_result.all())
        
        # Severity breakdown
        severity_query = select(
            Incident.severity,
            func.count(Incident.id)
        ).where(date_filter).group_by(Incident.severity)
        severity_result = await db.execute(severity_query)
        severity_data = dict(severity_result.all())
        
        # Recent incidents
        recent_query = select(Incident, User).join(User, Incident.reported_by == User.id).where(
            date_filter
        ).order_by(desc(Incident.created_at)).limit(5)
        recent_result = await db.execute(recent_query)
        recent_records = recent_result.all()
        
        recent_incidents = [
            IncidentResponse(
                id=incident.id,
                description=incident.description,
                severity=incident.severity,
                status=incident.status,
                resolution=incident.resolution,
                reported_by=incident.reported_by,
                reported_by_name=user.full_name or user.email.split('@')[0],
                reported_by_email=user.email,
                image_url=incident.image_url,
                created_at=incident.created_at,
                updated_at=incident.updated_at
            )
            for incident, user in recent_records
        ]
        
        # Monthly trend (last 6 months)
        monthly_trend = []
        for i in range(6):
            month_date = date_to.replace(day=1) - timedelta(days=30*i)
            month_start = month_date.replace(day=1)
            next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
            month_end = next_month - timedelta(days=1)
            
            month_query = select(func.count(Incident.id)).where(
                and_(
                    func.date(Incident.created_at) >= month_start,
                    func.date(Incident.created_at) <= month_end
                )
            )
            month_result = await db.execute(month_query)
            month_count = month_result.scalar() or 0
            
            monthly_trend.append({
                "month": month_start.strftime("%Y-%m"),
                "count": month_count
            })
        
        return IncidentStats(
            total_incidents=total_incidents,
            open_incidents=status_data.get("open", 0),
            resolved_incidents=status_data.get("resolved", 0),
            critical_incidents=severity_data.get("critical", 0),
            high_incidents=severity_data.get("high", 0),
            medium_incidents=severity_data.get("medium", 0),
            low_incidents=severity_data.get("low", 0),
            incidents_by_status=status_data,
            incidents_by_severity=severity_data,
            recent_incidents=recent_incidents,
            monthly_trend=list(reversed(monthly_trend))
        )
        
    except Exception as e:
        logger.error(f"Error fetching incident stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch incident statistics")

@router.post("/incidents", response_model=IncidentResponse)
async def create_incident(
    incident_data: IncidentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new incident"""
    try:
        new_incident = Incident(
            description=incident_data.description,
            severity=incident_data.severity,
            reported_by=current_user.id,
            image_url=incident_data.image_url
        )
        
        db.add(new_incident)
        await db.commit()
        await db.refresh(new_incident)
        
        return IncidentResponse(
            id=new_incident.id,
            description=new_incident.description,
            severity=new_incident.severity,
            status=new_incident.status,
            resolution=new_incident.resolution,
            reported_by=new_incident.reported_by,
            reported_by_name=current_user.full_name or current_user.email.split('@')[0],
            reported_by_email=current_user.email,
            image_url=new_incident.image_url,
            created_at=new_incident.created_at,
            updated_at=new_incident.updated_at
        )
        
    except Exception as e:
        logger.error(f"Error creating incident: {e}")
        raise HTTPException(status_code=500, detail="Failed to create incident")

@router.put("/incidents/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: int,
    incident_data: IncidentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an incident (managers can update any, workers can only update their own)"""
    try:
        # Get incident with user info
        query = select(Incident, User).join(User, Incident.reported_by == User.id).where(Incident.id == incident_id)
        result = await db.execute(query)
        record = result.first()
        
        if not record:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        incident, user = record
        
        # Check permissions
        if current_user.role != "Manager" and incident.reported_by != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this incident")
        
        # Update incident
        update_data = {k: v for k, v in incident_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now()
        
        update_query = update(Incident).where(Incident.id == incident_id).values(**update_data)
        await db.execute(update_query)
        await db.commit()
        
        # Fetch updated incident
        await db.refresh(incident)
        
        return IncidentResponse(
            id=incident.id,
            description=incident.description,
            severity=incident.severity,
            status=incident.status,
            resolution=incident.resolution,
            reported_by=incident.reported_by,
            reported_by_name=user.full_name or user.email.split('@')[0],
            reported_by_email=user.email,
            image_url=incident.image_url,
            created_at=incident.created_at,
            updated_at=incident.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating incident: {e}")
        raise HTTPException(status_code=500, detail="Failed to update incident")
