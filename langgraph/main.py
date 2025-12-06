from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import redis
import json
import asyncio
from datetime import datetime
from agent import process_worker_message
from database_processor import execute_database_action, db_processor
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="WorkHub AI Agent", version="1.0.0")

# Redis connection for real-time communication
try:
    redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379"))
    print("✅ Connected to Redis")
except Exception as e:
    print(f"❌ Redis connection failed: {e}")
    redis_client = None

class WorkerMessage(BaseModel):
    message: str
    sender_id: int
    chat_id: int

class AgentResponse(BaseModel):
    intent: str
    confidence: float
    response: str
    database_action: str
    requires_manager_attention: bool
    entities: Dict[str, Any]

@app.on_event("startup")
async def startup():
    """Initialize database connection on startup"""
    await db_processor.connect()
    print("🚀 WorkHub Agent started successfully!")

@app.on_event("shutdown") 
async def shutdown():
    """Clean up connections on shutdown"""
    await db_processor.disconnect()
    print("👋 WorkHub Agent shutting down")

@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {"status": "🤖 WorkHub Agent is running!", "version": "1.0.0"}

@app.post("/process-message", response_model=AgentResponse)
async def process_message(message_data: WorkerMessage):
    """
    Main endpoint to process worker messages
    Called by the backend when workers send messages
    """
    try:
        print(f"📨 Processing message from worker {message_data.sender_id}")
        print(f"💬 Message: {message_data.message}")
        
        # Process the message through our AI agent
        result = await process_worker_message(
            message_data.message, 
            message_data.sender_id
        )
        
        print(f"🎯 Intent: {result['intent']} (confidence: {result['confidence']:.2f})")
        print(f"🔧 Action: {result['database_action']}")
        
        # Execute database action
        db_success = await execute_database_action(
            result['database_action'],
            message_data.sender_id,
            message_data.message,
            result['entities']
        )
        
        if not db_success:
            print("⚠️ Database action failed, but continuing...")
        
        # Send real-time notification to manager if needed
        if result['requires_manager_attention']:
            await notify_manager(message_data, result)
        
        # Publish response back to chat via Redis
        await publish_agent_response(message_data.chat_id, result['response_message'])
        
        return AgentResponse(
            intent=result['intent'],
            confidence=result['confidence'],
            response=result['response_message'],
            database_action=result['database_action'],
            requires_manager_attention=result['requires_manager_attention'],
            entities=result['entities']
        )
        
    except Exception as e:
        print(f"❌ Error processing message: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process message: {str(e)}")

async def notify_manager(message_data: WorkerMessage, result: Dict):
    """Send notification to manager about important worker messages"""
    try:
        notification = {
            "type": "agent_alert",
            "worker_id": message_data.sender_id,
            "intent": result['intent'],
            "original_message": message_data.message,
            "confidence": result['confidence'],
            "action_taken": result['database_action'],
            "timestamp": result['timestamp']
        }
        
        if redis_client:
            # Publish to manager channel
            redis_client.publish(
                f"manager_notifications", 
                json.dumps(notification)
            )
            print(f"🔔 Manager notified about {result['intent']} from worker {message_data.sender_id}")
        
    except Exception as e:
        print(f"❌ Failed to notify manager: {e}")

async def publish_agent_response(chat_id: int, response: str):
    """Publish agent response back to chat via Redis"""
    try:
        chat_message = {
            "type": "agent_response", 
            "chat_id": chat_id,
            "content": response,
            "sender": "🤖 WorkHub AI",
            "timestamp": datetime.now().isoformat()
        }
        
        if redis_client:
            redis_client.publish(
                f"chat_{chat_id}",
                json.dumps(chat_message)
            )
            print(f"💬 Response sent to chat {chat_id}")
            
    except Exception as e:
        print(f"❌ Failed to publish response: {e}")

@app.post("/test-message")
async def test_message_endpoint():
    """Test endpoint to verify agent is working"""
    test_messages = [
        {"message": "Just finished the plumbing repair in Building A", "sender_id": 1, "chat_id": 1},
        {"message": "There's a gas leak in the basement - urgent!", "sender_id": 2, "chat_id": 2},
        {"message": "Can I get approval for overtime this weekend?", "sender_id": 3, "chat_id": 3}
    ]
    
    results = []
    
    for msg_data in test_messages:
        message = WorkerMessage(**msg_data)
        result = await process_message(message)
        results.append({
            "input": msg_data["message"],
            "intent": result.intent,
            "confidence": result.confidence,
            "response": result.response
        })
    
    return {"test_results": results}

@app.get("/stats")
async def get_agent_stats():
    """Get agent performance statistics"""
    # TODO: Implement stats tracking
    return {
        "total_messages_processed": "Coming soon",
        "intent_accuracy": "Coming soon", 
        "database_actions_executed": "Coming soon"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
