from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, and_, extract, select, desc, update
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.core.database import get_db, AsyncSessionLocal
from app.models.permission_request import PermissionRequest
from app.models.user import User
from app.models.chat_session import ChatSession
from app.models.message import Message
from app.schemas.permission import PermissionRequestResponse, PermissionRequestCreate, PermissionRequestUpdate, PermissionStats
from app.routers.auth import get_current_user
from app.core.websocket import manager
import logging
import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Redis client for chat notifications
redis_client = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)

async def send_permission_notification(
    worker_id: int, 
    permission_request: PermissionRequest, 
    approver_name: str, 
    status: str,
    manager_response: Optional[str] = None
):
    """Send a notification to the worker about their permission request status change"""
    try:
        async with AsyncSessionLocal() as db:
            # Get worker info
            worker_query = select(User).where(User.id == worker_id)
            worker_result = await db.execute(worker_query)
            worker = worker_result.scalar_one_or_none()
            
            if not worker:
                logger.error(f"Worker {worker_id} not found")
                return
            
            # Find or create chat session for this worker
            chat_query = select(ChatSession).where(
                ChatSession.user_id == worker_id,
                ChatSession.team_id == worker.team_id
            ).order_by(ChatSession.created_at.desc())
            
            chat_result = await db.execute(chat_query)
            chat_session = chat_result.scalars().first()
            
            if not chat_session:
                chat_session = ChatSession(user_id=worker_id, team_id=worker.team_id)
                db.add(chat_session)
                await db.commit()
                await db.refresh(chat_session)
            
            # Create notification message based on status
            if status == "approved":
                emoji = "✅"
                action = "approved"
                color = "success"
            elif status == "rejected":
                emoji = "❌"
                action = "rejected"
                color = "danger"
            else:
                emoji = "ℹ️"
                action = "updated"
                color = "info"
            
            # Build notification message
            notification_text = f"{emoji} **Permission {action.upper()}** by {approver_name}\n\n"
            notification_text += f"**Request:** {permission_request.title}\n"
            notification_text += f"**Type:** {permission_request.request_type.replace('_', ' ').title()}\n"
            notification_text += f"**Status:** {status.title()}\n"
            
            if manager_response:
                notification_text += f"**Manager Notes:** {manager_response}\n"
            
            notification_text += f"\n*Request submitted: {permission_request.created_at.strftime('%Y-%m-%d %H:%M')}*"
            
            # Save notification as a chat message
            notification_message = Message(
                content=notification_text,
                chat_id=chat_session.id,
                sender="System"  # System message to differentiate from regular chat
            )
            db.add(notification_message)
            await db.commit()
            
            # Send real-time notification via WebSocket if worker is connected
            await manager.send_to_worker(worker_id, f"🔔 Permission Update: {notification_text}")
            
            # Also publish via Redis for real-time updates
            await redis_client.publish(
                f"chat_{chat_session.id}", 
                f"🤖 System: {notification_text}"
            )
            
            logger.info(f"Permission notification sent to worker {worker_id} for request {permission_request.id}")
            
    except Exception as e:
        logger.error(f"Failed to send permission notification to worker {worker_id}: {e}")

@router.get("/permissions", response_model=List[PermissionRequestResponse])
async def get_permission_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter by status"),
    request_type: Optional[str] = Query(None, description="Filter by request type"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    date_from: Optional[date] = Query(None, description="Start date"),
    date_to: Optional[date] = Query(None, description="End date"),
    search: Optional[str] = Query(None, description="Search in title, description or requester name")
):
    """Get permission requests with optional filters"""
    try:
        # Build simple query for permission requests
        query = select(PermissionRequest)
        
        # Apply filters
        conditions = []
        if status:
            conditions.append(PermissionRequest.status == status)
        if request_type:
            conditions.append(PermissionRequest.request_type == request_type)
        if priority:
            conditions.append(PermissionRequest.priority == priority)
        if date_from:
            conditions.append(func.date(PermissionRequest.created_at) >= date_from)
        if date_to:
            conditions.append(func.date(PermissionRequest.created_at) <= date_to)
            
        if conditions:
            query = query.where(and_(*conditions))
            
        # Default to last 30 days if no date filter
        if not date_from and not date_to:
            thirty_days_ago = datetime.now().date() - timedelta(days=30)
            query = query.where(func.date(PermissionRequest.created_at) >= thirty_days_ago)
            
        query = query.order_by(desc(PermissionRequest.created_at))
        result = await db.execute(query)
        permission_requests = result.scalars().all()
        
        # Get user data for each request and build responses
        responses = []
        for request in permission_requests:
            # Get requester info
            requester_query = select(User).where(User.id == request.user_id)
            requester_result = await db.execute(requester_query)
            requester = requester_result.scalar_one_or_none()
            
            if requester:  # Only add if we have requester data
                # Apply search filter here if needed
                if search:
                    search_lower = search.lower()
                    if not (
                        search_lower in request.title.lower() or
                        search_lower in request.description.lower() or
                        search_lower in requester.full_name.lower() if requester.full_name else False or
                        search_lower in requester.email.lower()
                    ):
                        continue  # Skip this record if search doesn't match
                
                # Get manager and approver info if they exist
                manager = None
                if request.manager_id:
                    manager_query = select(User).where(User.id == request.manager_id)
                    manager_result = await db.execute(manager_query)
                    manager = manager_result.scalar_one_or_none()
                
                approver = None
                if request.approved_by:
                    approver_query = select(User).where(User.id == request.approved_by)
                    approver_result = await db.execute(approver_query)
                    approver = approver_result.scalar_one_or_none()
                
                responses.append(PermissionRequestResponse(
                    id=request.id,
                    request_type=request.request_type,
                    title=request.title,
                    description=request.description,
                    requested_date=request.requested_date,
                    requested_hours=request.requested_hours,
                    priority=request.priority,
                    is_urgent=request.is_urgent,
                    user_id=request.user_id,
                    requester_name=requester.full_name or requester.email.split('@')[0],
                    requester_email=requester.email,
                    manager_id=request.manager_id,
                    manager_name=manager.full_name if manager else None,
                    status=request.status,
                    manager_response=request.manager_response,
                    approved_by=request.approved_by,
                    approver_name=approver.full_name if approver else None,
                    approved_at=request.approved_at,
                    created_at=request.created_at,
                    updated_at=request.updated_at
                ))
        
        return responses
        
    except Exception as e:
        logger.error(f"Error fetching permission requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch permission requests")

@router.get("/permissions/stats", response_model=PermissionStats)
async def get_permission_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None)
):
    """Get permission request statistics"""
    try:
        # Default to current month if no dates provided
        if not date_from or not date_to:
            today = datetime.now().date()
            date_from = date(today.year, today.month, 1)
            date_to = today
            
        # Base filter
        date_filter = and_(
            func.date(PermissionRequest.created_at) >= date_from,
            func.date(PermissionRequest.created_at) <= date_to
        )
        
        # Total requests count
        total_query = select(func.count(PermissionRequest.id)).where(date_filter)
        total_result = await db.execute(total_query)
        total_requests = total_result.scalar() or 0
        
        # Status breakdown
        status_query = select(
            PermissionRequest.status,
            func.count(PermissionRequest.id)
        ).where(date_filter).group_by(PermissionRequest.status)
        status_result = await db.execute(status_query)
        status_data = dict(status_result.all())
        
        # Type breakdown
        type_query = select(
            PermissionRequest.request_type,
            func.count(PermissionRequest.id)
        ).where(date_filter).group_by(PermissionRequest.request_type)
        type_result = await db.execute(type_query)
        type_data = dict(type_result.all())
        
        # Priority breakdown
        priority_query = select(
            PermissionRequest.priority,
            func.count(PermissionRequest.id)
        ).where(date_filter).group_by(PermissionRequest.priority)
        priority_result = await db.execute(priority_query)
        priority_data = dict(priority_result.all())
        
        # Urgent requests count
        urgent_query = select(func.count(PermissionRequest.id)).where(
            and_(date_filter, PermissionRequest.is_urgent == True)
        )
        urgent_result = await db.execute(urgent_query)
        urgent_requests = urgent_result.scalar() or 0
        
        # Recent requests (simplified)
        recent_query = select(PermissionRequest).where(date_filter).order_by(
            desc(PermissionRequest.created_at)
        ).limit(5)
        recent_result = await db.execute(recent_query)
        recent_requests_raw = recent_result.scalars().all()
        
        # Get recent requests with user info
        recent_requests = []
        for request in recent_requests_raw:
            requester_query = select(User).where(User.id == request.user_id)
            requester_result = await db.execute(requester_query)
            requester = requester_result.scalar_one_or_none()
            
            if requester:
                recent_requests.append(PermissionRequestResponse(
                    id=request.id,
                    request_type=request.request_type,
                    title=request.title,
                    description=request.description,
                    requested_date=request.requested_date,
                    requested_hours=request.requested_hours,
                    priority=request.priority,
                    is_urgent=request.is_urgent,
                    user_id=request.user_id,
                    requester_name=requester.full_name or requester.email.split('@')[0],
                    requester_email=requester.email,
                    manager_id=request.manager_id,
                    manager_name=None,
                    status=request.status,
                    manager_response=request.manager_response,
                    approved_by=request.approved_by,
                    approver_name=None,
                    approved_at=request.approved_at,
                    created_at=request.created_at,
                    updated_at=request.updated_at
                ))
        
        # Monthly trend (last 6 months)
        monthly_trend = []
        for i in range(6):
            month_date = date_to.replace(day=1) - timedelta(days=30*i)
            month_start = month_date.replace(day=1)
            next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
            month_end = next_month - timedelta(days=1)
            
            month_query = select(func.count(PermissionRequest.id)).where(
                and_(
                    func.date(PermissionRequest.created_at) >= month_start,
                    func.date(PermissionRequest.created_at) <= month_end
                )
            )
            month_result = await db.execute(month_query)
            month_count = month_result.scalar() or 0
            
            monthly_trend.append({
                "month": month_start.strftime("%Y-%m"),
                "count": month_count
            })
        
        return PermissionStats(
            total_requests=total_requests,
            pending_requests=status_data.get("pending", 0),
            approved_requests=status_data.get("approved", 0),
            rejected_requests=status_data.get("rejected", 0),
            urgent_requests=urgent_requests,
            requests_by_status=status_data,
            requests_by_type=type_data,
            requests_by_priority=priority_data,
            recent_requests=recent_requests,
            monthly_trend=list(reversed(monthly_trend))
        )
        
    except Exception as e:
        logger.error(f"Error fetching permission stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch permission statistics")

@router.post("/permissions", response_model=PermissionRequestResponse)
async def create_permission_request(
    permission_data: PermissionRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new permission request"""
    try:
        new_request = PermissionRequest(
            user_id=current_user.id,
            request_type=permission_data.request_type,
            title=permission_data.title,
            description=permission_data.description,
            requested_date=permission_data.requested_date,
            requested_hours=permission_data.requested_hours,
            priority=permission_data.priority,
            is_urgent=permission_data.is_urgent
        )
        
        db.add(new_request)
        await db.commit()
        await db.refresh(new_request)
        
        return PermissionRequestResponse(
            id=new_request.id,
            request_type=new_request.request_type,
            title=new_request.title,
            description=new_request.description,
            requested_date=new_request.requested_date,
            requested_hours=new_request.requested_hours,
            priority=new_request.priority,
            is_urgent=new_request.is_urgent,
            user_id=new_request.user_id,
            requester_name=current_user.full_name or current_user.email.split('@')[0],
            requester_email=current_user.email,
            manager_id=new_request.manager_id,
            manager_name=None,
            status=new_request.status,
            manager_response=new_request.manager_response,
            approved_by=new_request.approved_by,
            approver_name=None,
            approved_at=new_request.approved_at,
            created_at=new_request.created_at,
            updated_at=new_request.updated_at
        )
        
    except Exception as e:
        logger.error(f"Error creating permission request: {e}")
        raise HTTPException(status_code=500, detail="Failed to create permission request")

@router.put("/permissions/{request_id}", response_model=PermissionRequestResponse)
async def update_permission_request(
    request_id: int,
    permission_data: PermissionRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a permission request (managers can approve/reject, workers can edit their own pending requests)"""
    try:
        # Get the permission request
        request_query = select(PermissionRequest).where(PermissionRequest.id == request_id)
        request_result = await db.execute(request_query)
        permission_request = request_result.scalar_one_or_none()
        
        if not permission_request:
            raise HTTPException(status_code=404, detail="Permission request not found")
        
        # Check permissions
        is_owner = permission_request.user_id == current_user.id
        is_manager = current_user.role == "Manager"
        
        if not is_owner and not is_manager:
            raise HTTPException(status_code=403, detail="Not authorized to update this request")
        
        # Workers can only edit their own pending requests
        if is_owner and not is_manager and permission_request.status != "pending":
            raise HTTPException(status_code=403, detail="Can only edit pending requests")
        
        # Update permission request
        update_data = {k: v for k, v in permission_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now()
        
        # If manager is approving/rejecting, set approval info
        if is_manager and permission_data.status in ["approved", "rejected"]:
            update_data["approved_by"] = current_user.id
            update_data["approved_at"] = datetime.now()
        
        update_query = update(PermissionRequest).where(PermissionRequest.id == request_id).values(**update_data)
        await db.execute(update_query)
        await db.commit()
        
        # Fetch updated request with user info
        await db.refresh(permission_request)
        
        # Send notification to worker if manager approved/rejected the request
        if is_manager and permission_data.status in ["approved", "rejected"]:
            await send_permission_notification(
                worker_id=permission_request.user_id,
                permission_request=permission_request,
                approver_name=current_user.full_name or current_user.email.split('@')[0],
                status=permission_data.status,
                manager_response=permission_data.manager_response
            )
        
        # Get requester info
        requester_query = select(User).where(User.id == permission_request.user_id)
        requester_result = await db.execute(requester_query)
        requester = requester_result.scalar_one_or_none()
        
        return PermissionRequestResponse(
            id=permission_request.id,
            request_type=permission_request.request_type,
            title=permission_request.title,
            description=permission_request.description,
            requested_date=permission_request.requested_date,
            requested_hours=permission_request.requested_hours,
            priority=permission_request.priority,
            is_urgent=permission_request.is_urgent,
            user_id=permission_request.user_id,
            requester_name=requester.full_name if requester else "",
            requester_email=requester.email if requester else "",
            manager_id=permission_request.manager_id,
            manager_name=None,
            status=permission_request.status,
            manager_response=permission_request.manager_response,
            approved_by=permission_request.approved_by,
            approver_name=current_user.full_name if permission_request.approved_by == current_user.id else None,
            approved_at=permission_request.approved_at,
            created_at=permission_request.created_at,
            updated_at=permission_request.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating permission request: {e}")
        raise HTTPException(status_code=500, detail="Failed to update permission request")