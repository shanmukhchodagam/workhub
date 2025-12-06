from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, and_, extract, select
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.core.database import get_db
from app.models.attendance import Attendance
from app.models.user import User
from app.schemas.attendance import AttendanceResponse, AttendanceAnalytics, AttendanceStats
from app.routers.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/attendance", response_model=List[AttendanceResponse])
async def get_attendance_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    date_from: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    user_id: Optional[int] = Query(None, description="Filter by specific user"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by user name or email")
):
    """Get attendance records with optional filters"""
    try:
        # Build query
        query = select(Attendance, User).join(User, Attendance.user_id == User.id)
        
        # Apply filters
        conditions = []
        if date_from:
            conditions.append(func.date(Attendance.created_at) >= date_from)
        if date_to:
            conditions.append(func.date(Attendance.created_at) <= date_to)
        if user_id:
            conditions.append(Attendance.user_id == user_id)
        if status:
            conditions.append(Attendance.status == status)
        if search:
            # Search in user's full name or email
            search_condition = func.lower(User.full_name).contains(func.lower(search)) | func.lower(User.email).contains(func.lower(search))
            conditions.append(search_condition)
            
        if conditions:
            query = query.where(and_(*conditions))
            
        # Default to last 30 days if no date filter
        if not date_from and not date_to:
            thirty_days_ago = datetime.now().date() - timedelta(days=30)
            query = query.where(func.date(Attendance.created_at) >= thirty_days_ago)
            
        query = query.order_by(Attendance.created_at.desc())
        result = await db.execute(query)
        records = result.all()
        
        return [
            AttendanceResponse(
                id=attendance.id,
                user_id=attendance.user_id,
                user_name=user.full_name or user.email.split('@')[0],
                check_in_time=attendance.check_in_time,
                check_out_time=attendance.check_out_time,
                break_start=attendance.break_start,
                break_end=attendance.break_end,
                location=attendance.location,
                status=attendance.status,
                notes=attendance.notes,
                work_hours=attendance.work_hours,
                created_at=attendance.created_at
            )
            for attendance, user in records
        ]
    except Exception as e:
        logger.error(f"Error fetching attendance records: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch attendance records")

@router.get("/attendance/analytics", response_model=AttendanceAnalytics)
async def get_attendance_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None)
):
    """Get attendance analytics and statistics"""
    try:
        # Default to current month if no dates provided
        if not date_from or not date_to:
            today = datetime.now().date()
            date_from = date(today.year, today.month, 1)
            date_to = today
        
        # Basic counts
        count_query = select(func.count(Attendance.id)).where(
            and_(
                func.date(Attendance.created_at) >= date_from,
                func.date(Attendance.created_at) <= date_to
            )
        )
        total_result = await db.execute(count_query)
        total_records = total_result.scalar() or 0
        
        # Status breakdown
        status_query = select(
            Attendance.status,
            func.count(Attendance.id)
        ).where(
            and_(
                func.date(Attendance.created_at) >= date_from,
                func.date(Attendance.created_at) <= date_to
            )
        ).group_by(Attendance.status)
        
        status_result = await db.execute(status_query)
        status_breakdown = {status: count for status, count in status_result.all()}
        
        # Simple analytics response
        return AttendanceAnalytics(
            total_records=total_records,
            date_range={
                "from": str(date_from),
                "to": str(date_to)
            },
            status_breakdown=status_breakdown,
            daily_trend=[],  # Simplified for now
            employee_stats=[],  # Simplified for now
            summary={
                "total_employees": 0,
                "average_attendance_rate": 0,
                "most_active_day": None,
                "total_check_ins": status_breakdown.get('checked_in', 0),
                "total_breaks": status_breakdown.get('on_break', 0)
            }
        )
        
    except Exception as e:
        logger.error(f"Error fetching attendance analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch attendance analytics")

@router.get("/attendance/user/{user_id}", response_model=List[AttendanceResponse])
async def get_user_attendance(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, description="Number of days to look back")
):
    """Get attendance records for a specific user"""
    try:
        start_date = datetime.now().date() - timedelta(days=days)
        
        query = select(Attendance, User).join(User, Attendance.user_id == User.id).where(
            and_(
                Attendance.user_id == user_id,
                func.date(Attendance.created_at) >= start_date
            )
        ).order_by(Attendance.created_at.desc())
        
        result = await db.execute(query)
        records = result.all()
        
        if not records:
            raise HTTPException(status_code=404, detail="No attendance records found for this user")
        
        return [
            AttendanceResponse(
                id=attendance.id,
                user_id=attendance.user_id,
                user_name=user.full_name or user.email.split('@')[0],
                check_in_time=attendance.check_in_time,
                check_out_time=attendance.check_out_time,
                break_start=attendance.break_start,
                break_end=attendance.break_end,
                location=attendance.location,
                status=attendance.status,
                notes=attendance.notes,
                work_hours=attendance.work_hours,
                created_at=attendance.created_at
            )
            for attendance, user in records
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user attendance: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user attendance")

@router.post("/attendance/{user_id}/manual")
async def create_manual_attendance(
    user_id: int,
    attendance_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually create attendance record (for managers)"""
    try:
        # Verify user exists
        user_query = select(User).where(User.id == user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_attendance = Attendance(
            user_id=user_id,
            check_in_time=attendance_data.get('check_in_time'),
            check_out_time=attendance_data.get('check_out_time'),
            status=attendance_data.get('status', 'checked_in'),
            location=attendance_data.get('location', ''),
            notes=attendance_data.get('notes', 'Manually created by manager')
        )
        
        db.add(new_attendance)
        await db.commit()
        await db.refresh(new_attendance)
        
        return {"message": "Attendance record created successfully", "id": new_attendance.id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating manual attendance: {e}")
        raise HTTPException(status_code=500, detail="Failed to create attendance record")