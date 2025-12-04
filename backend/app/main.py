from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.core.config import settings
from app.routers import tasks, incidents, chat
from app.core.websocket import manager
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

redis_client = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)

async def redis_listener():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("workhub_responses")
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            sender_id = data.get("sender_id")
            content = data.get("content")
            
            # Broadcast to workers (simplified)
            for ws in manager.worker_connections:
                 await manager.send_personal_message(f"Agent: {content}", ws)
            
            # Notify manager
            await manager.broadcast_to_managers({
                "type": "agent_response",
                "content": content,
                "sender_id": sender_id
            })

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    asyncio.create_task(redis_listener())

@app.get("/")
async def root():
    return {"message": "Workhub API is running"}
