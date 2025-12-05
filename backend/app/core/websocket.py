# No changes needed for imports in websocket.py as it only uses standard libs
from typing import List, Dict
from fastapi import WebSocket
import json

class ConnectionManager:
    def __init__(self):
        # active_connections: List[WebSocket] = []
        self.worker_connections: List[WebSocket] = []
        self.manager_connections: List[WebSocket] = []

    async def connect_worker(self, websocket: WebSocket):
        await websocket.accept()
        self.worker_connections.append(websocket)

    async def connect_manager(self, websocket: WebSocket):
        await websocket.accept()
        self.manager_connections.append(websocket)

    def disconnect_worker(self, websocket: WebSocket):
        if websocket in self.worker_connections:
            self.worker_connections.remove(websocket)

    def disconnect_manager(self, websocket: WebSocket):
        if websocket in self.manager_connections:
            self.manager_connections.remove(websocket)

    async def broadcast_to_managers(self, message: dict):
        for connection in self.manager_connections:
            await connection.send_json(message)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()
