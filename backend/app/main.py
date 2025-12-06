from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.core.config import settings
from app.routers import tasks, incidents, chat, auth, attendance, permissions
from app.core.websocket import manager
from app.models import User, Team, Task, Incident, Message, Attendance, PermissionRequest # Ensure models are loaded
import json
import redis.asyncio as redis
import asyncio

app = FastAPI(title="Workhub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(incidents.router)
app.include_router(chat.router)
app.include_router(auth.router)
app.include_router(attendance.router)
app.include_router(permissions.router)

redis_client = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)

async def redis_listener():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("workhub_responses")
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            sender_id = data.get("sender_id")
            content = data.get("content")
            
            # Send AI response to the specific worker
            await manager.send_to_worker(sender_id, f"Agent: {content}")
            
            # ALSO send AI response to manager so they can see the full conversation
            # First get the worker's team info to find the manager
            from app.core.database import AsyncSessionLocal
            from app.models.user import User
            from sqlalchemy import select
            
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == sender_id))
                worker = result.scalar_one_or_none()
                
                if worker and worker.team_id:
                    # Find team manager
                    manager_result = await db.execute(
                        select(User).where(
                            User.team_id == worker.team_id,
                            User.role == "Manager"
                        )
                    )
                    team_manager = manager_result.scalar_one_or_none()
                    
                    if team_manager:
                        # Send AI response to manager as well
                        ai_response_data = {
                            "type": "ai_response",
                            "content": content,
                            "worker_id": sender_id,
                            "worker_name": worker.full_name or worker.email,
                            "timestamp": "now"
                        }
                        await manager.send_to_manager(team_manager.id, ai_response_data)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    asyncio.create_task(redis_listener())

@app.get("/")
async def root():
    return {"message": "Workhub API is running"}
