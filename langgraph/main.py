import os
import redis
import json
import time
from agent import app

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

print("Attempting to connect to Redis...", flush=True)
r = redis.from_url(REDIS_URL)
pubsub = r.pubsub()
pubsub.subscribe("workhub_chat")

print("Agent service started, listening on 'workhub_chat'...")

for message in pubsub.listen():
    if message["type"] == "message":
        data = json.loads(message["data"])
        sender_id = data.get("sender_id")
        content = data.get("content")
        
        print(f"Received message: {content} from {sender_id}")
        
        # Invoke LangGraph agent
        initial_state = {"messages": [content], "sender_id": sender_id, "intent": ""}
        result = app.invoke(initial_state)
        
        response_content = result["messages"][-1]
        
        # Publish response back to Redis (or call backend)
        # Here we publish to a channel that backend listens to, or just print for now
        # For the MVP, let's assume backend listens to 'workhub_responses'
        
        response_data = {
            "sender_id": sender_id,
            "content": response_content
        }
        r.publish("workhub_responses", json.dumps(response_data))
        print(f"Sent response: {response_content}")
