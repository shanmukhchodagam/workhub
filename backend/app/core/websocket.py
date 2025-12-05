# No changes needed for imports in websocket.py as it only uses standard libs
from typing import List, Dict
from fastapi import WebSocket
import json

class ConnectionManager:
    def __init__(self):
        # Map user IDs to their WebSocket connections
        self.worker_connections: Dict[int, WebSocket] = {}
        self.manager_connections: Dict[int, WebSocket] = {}

    async def connect_worker(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.worker_connections[user_id] = websocket

    async def connect_manager(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.manager_connections[user_id] = websocket

    def disconnect_worker(self, user_id: int):
        if user_id in self.worker_connections:
            del self.worker_connections[user_id]

    def disconnect_manager(self, user_id: int):
        if user_id in self.manager_connections:
            del self.manager_connections[user_id]

    async def broadcast_to_managers(self, message: dict):
        """Broadcast message to all managers"""
        disconnected = []
        for user_id, connection in self.manager_connections.items():
            try:
                await connection.send_json(message)
            except:
                disconnected.append(user_id)
        
        # Clean up disconnected connections
        for user_id in disconnected:
            self.disconnect_manager(user_id)

    async def send_to_manager(self, user_id: int, message: dict):
        """Send message to specific manager"""
        print(f"Attempting to send to manager {user_id}: {message}")
        if user_id in self.manager_connections:
            try:
                print(f"Found manager connection for {user_id}, sending message")
                await self.manager_connections[user_id].send_json(message)
                print(f"Message sent successfully to manager {user_id}")
                return True
            except Exception as e:
                print(f"Error sending to manager {user_id}: {e}")
                self.disconnect_manager(user_id)
        else:
            print(f"No manager connection found for user_id {user_id}")
            print(f"Available manager connections: {list(self.manager_connections.keys())}")
        return False

    async def send_to_worker(self, user_id: int, message: str):
        """Send message to specific worker"""
        if user_id in self.worker_connections:
            try:
                await self.worker_connections[user_id].send_text(message)
                return True
            except:
                self.disconnect_worker(user_id)
        return False

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()
