from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from app.core.websocket import manager
from app.core.config import settings
import json
import redis.asyncio as redis
import asyncio
import httpx
from app.core.database import AsyncSessionLocal
from app.models.message import Message
from app.models.user import User
from sqlalchemy import select

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db, AsyncSessionLocal
from app.models.chat_session import ChatSession
from app.models.message import Message
from app.models.user import User
from app.routers.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

redis_client = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)

# Agent service URL
AGENT_SERVICE_URL = "http://agent_service:8001"

async def process_message_with_agent(message: str, sender_id: int, chat_id: int):
    """Send message to AI agent for processing"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{AGENT_SERVICE_URL}/process-message",
                json={
                    "message": message,
                    "sender_id": sender_id,
                    "chat_id": chat_id
                },
                timeout=10.0
            )
            if response.status_code == 200:
                result = response.json()
                print(f"🤖 Agent processed message: Intent={result['intent']}, Confidence={result['confidence']}")
                return result
            else:
                print(f"❌ Agent request failed: {response.status_code}")
                return None
    except Exception as e:
        print(f"❌ Error calling agent: {e}")
        return None

@router.websocket("/ws/worker/{client_id}")
async def websocket_worker_endpoint(websocket: WebSocket, client_id: int):
    await manager.connect_worker(websocket, client_id)
    print(f"Worker {client_id} connected to WebSocket")
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received message from worker {client_id}: {data}")
            
            # ALL messages go to both AI and Manager - no keyword filtering
            async with AsyncSessionLocal() as session:
                # Get worker info
                result = await session.execute(select(User).where(User.id == client_id))
                user = result.scalar_one_or_none()
                
                if not user:
                    print(f"User {client_id} not found!")
                    continue

                # Find or Create Chat Session
                result = await session.execute(
                    select(ChatSession).where(
                        ChatSession.user_id == client_id,
                        ChatSession.team_id == user.team_id
                    ).order_by(ChatSession.created_at.desc())
                )
                chat_session = result.scalars().first()
                
                if not chat_session:
                    chat_session = ChatSession(user_id=client_id, team_id=user.team_id)
                    session.add(chat_session)
                    await session.commit()
                    await session.refresh(chat_session)
                
                # Save message to database
                message = Message(content=data, chat_id=chat_session.id, sender="Worker")
                session.add(message)
                await session.commit()
                await session.refresh(message)
                
                print(f"Message saved to database with ID: {message.id}")
                
                # 🤖 CALL AI AGENT TO PROCESS MESSAGE
                agent_result = await process_message_with_agent(data, client_id, chat_session.id)
                if agent_result:
                    # Send agent response back to worker
                    await manager.send_to_worker(client_id, f"🤖 AI: {agent_result['response']}")
                    
                    # If agent flagged for manager attention, add urgent tag
                    if agent_result.get('requires_manager_attention'):
                        data = f"⚠️ URGENT: {data} (AI detected: {agent_result['intent']})"
                
                # Find team manager and send ALL messages to manager
                manager_result = await session.execute(
                    select(User).where(
                        User.team_id == user.team_id,
                        User.role == "Manager"
                    )
                )
                team_manager = manager_result.scalar_one_or_none()
                
                if team_manager:
                    print(f"Sending worker message to manager: {team_manager.id}")
                    # Send to manager via WebSocket with agent context
                    message_data = {
                        "type": "worker_message",
                        "content": data,
                        "sender_id": client_id,
                        "sender_name": user.full_name or user.email,
                        "timestamp": message.created_at.isoformat(),
                        "agent_analysis": agent_result if agent_result else None
                    }
                    success = await manager.send_to_manager(team_manager.id, message_data)
                    print(f"Message sent to manager: {success}")
                else:
                    print(f"No manager found for team {user.team_id}")
            
            # Also send to AI for processing
            message_data = {
                "sender_id": client_id,
                "content": data,
                "chat_id": chat_session.id
            }
            await redis_client.publish("workhub_chat", json.dumps(message_data))
            
            # Echo back to worker
            await manager.send_to_worker(client_id, f"You: {data}")
            
    except WebSocketDisconnect:
        print(f"Worker {client_id} disconnected from WebSocket")
        manager.disconnect_worker(client_id)


@router.websocket("/ws/manager/{client_id}")
async def websocket_manager_endpoint(websocket: WebSocket, client_id: int):
    await manager.connect_manager(websocket, client_id)
    print(f"Manager {client_id} connected to WebSocket")
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received data from manager {client_id}: {data}")
            # Manager WebSocket is mainly for receiving messages, 
            # actual sending happens through the REST API endpoint
    except WebSocketDisconnect:
        print(f"Manager {client_id} disconnected from WebSocket")
        manager.disconnect_manager(client_id)

# New API endpoints for manager messaging
class MessageRequest(BaseModel):
    recipient_id: int
    content: str

@router.get("/my-messages")
async def get_my_chat_messages(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get chat messages for the current worker/employee"""
    # Get the latest chat session for this user
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.user_id == current_user.id
        ).order_by(ChatSession.created_at.desc())
    )
    chat_session = result.scalars().first()
    
    if not chat_session:
        return []
    
    # Get all messages from this chat session
    result = await db.execute(
        select(Message).where(
            Message.chat_id == chat_session.id
        ).order_by(Message.created_at)
    )
    messages = result.scalars().all()
    
    return [{
        "id": msg.id,
        "content": msg.content,
        "sender": msg.sender,
        "created_at": msg.created_at.isoformat()
    } for msg in messages]

@router.get("/messages/{worker_id}")
async def get_chat_messages(
    worker_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get chat messages between manager and specific worker"""
    if current_user.role != "Manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers can access chat messages"
        )
    
    # Verify worker is in same team
    result = await db.execute(
        select(User).where(
            User.id == worker_id,
            User.team_id == current_user.team_id
        )
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker not found in your team"
        )
    
    # Get or create chat session between manager and worker
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.user_id == worker_id,
            ChatSession.team_id == current_user.team_id
        ).order_by(ChatSession.created_at.desc())
    )
    chat_session = result.scalars().first()
    
    if not chat_session:
        return []
    
    # Get all messages from this chat session
    result = await db.execute(
        select(Message).where(
            Message.chat_id == chat_session.id
        ).order_by(Message.created_at)
    )
    messages = result.scalars().all()
    
    return [{
        "id": msg.id,
        "content": msg.content,
        "sender": msg.sender,
        "created_at": msg.created_at.isoformat()
    } for msg in messages]

@router.post("/send-message")
async def send_message_to_worker(
    message_request: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send message from manager to worker"""
    if current_user.role != "Manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers can send messages to workers"
        )
    
    # Verify worker is in same team
    result = await db.execute(
        select(User).where(
            User.id == message_request.recipient_id,
            User.team_id == current_user.team_id
        )
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker not found in your team"
        )
    
    # Get or create chat session
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.user_id == worker.id,
            ChatSession.team_id == current_user.team_id
        ).order_by(ChatSession.created_at.desc())
    )
    chat_session = result.scalars().first()
    
    if not chat_session:
        chat_session = ChatSession(
            user_id=worker.id,
            team_id=current_user.team_id
        )
        db.add(chat_session)
        await db.commit()
        await db.refresh(chat_session)
    
    # Save message
    message = Message(
        content=message_request.content,
        chat_id=chat_session.id,
        sender="Manager"
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    
    # Send message to worker via WebSocket
    await manager.send_to_worker(
        worker.id,
        f"Manager: {message_request.content}"
    )
    
    # Also send confirmation back to manager via WebSocket
    manager_message_data = {
        "type": "manager_message_sent",
        "content": message_request.content,
        "recipient_id": worker.id,
        "recipient_name": worker.full_name or worker.email,
        "timestamp": message.created_at.isoformat()
    }
    await manager.send_to_manager(current_user.id, manager_message_data)
    
    return {"message": "Message sent successfully"}
