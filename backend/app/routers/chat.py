from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.websocket import manager
from app.core.config import settings
import json
import redis.asyncio as redis
import asyncio

router = APIRouter()

redis_client = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)

@router.websocket("/ws/worker/{client_id}")
async def websocket_worker_endpoint(websocket: WebSocket, client_id: int):
    await manager.connect_worker(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            
            # Save to DB (mock)
            
            # Publish to Redis for Agent
            message_data = {
                "sender_id": client_id,
                "content": data
            }
            await redis_client.publish("workhub_chat", json.dumps(message_data))
            
            # Echo back to worker
            await manager.send_personal_message(f"You: {data}", websocket)
            
            # Notify managers
            await manager.broadcast_to_managers({
                "type": "new_message",
                "content": data,
                "sender_id": client_id
            })
    except WebSocketDisconnect:
        manager.disconnect_worker(websocket)

@router.websocket("/ws/manager/{client_id}")
async def websocket_manager_endpoint(websocket: WebSocket, client_id: int):
    await manager.connect_manager(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_manager(websocket)
