import asyncio
import asyncpg
import json
from datetime import datetime
from typing import Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()

class DatabaseProcessor:
    """Handles all database operations for the agent"""
    
    def __init__(self):
        self.db_url = os.getenv("DATABASE_URL")
        self.connection = None
    
    async def connect(self):
        """Connect to the database"""
        try:
            self.connection = await asyncpg.connect(self.db_url)
            print("✅ Connected to database")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
    
    async def disconnect(self):
        """Disconnect from database"""
        if self.connection:
            await self.connection.close()
            print("📴 Disconnected from database")
    
    async def update_task_progress(self, sender_id: int, message: str, entities: Dict) -> bool:
        """Update task progress based on worker message"""
        try:
            # Extract progress indicators
            progress_keywords = {
                "started": 10, "begun": 15, "beginning": 10,
                "progress": 50, "halfway": 50, "almost": 80,
                "completed": 100, "finished": 100, "done": 100
            }
            
            progress = 0
            status = "in_progress"
            
            for keyword, value in progress_keywords.items():
                if keyword in message.lower():
                    progress = value
                    if value == 100:
                        status = "completed"
                    break
            
            # Find active task for this worker
            task_query = """
                SELECT id FROM tasks 
                WHERE assigned_to = $1 AND status = 'pending' 
                ORDER BY created_at DESC LIMIT 1
            """
            
            task_result = await self.connection.fetchval(task_query, sender_id)
            
            if task_result:
                # Update task
                update_query = """
                    UPDATE tasks 
                    SET status = $1, updated_at = NOW()
                    WHERE id = $2
                """
                
                await self.connection.execute(
                    update_query, status, task_result
                )
                
                print(f"✅ Updated task {task_result} - Status: {status}")
                return True
            else:
                print("⚠️ No active task found for worker")
                return False
                
        except Exception as e:
            print(f"❌ Task update failed: {e}")
            return False
    
    async def create_incident_record(self, sender_id: int, message: str, entities: Dict) -> bool:
        """Create incident report from worker message"""
        try:
            # Determine severity based on keywords
            severity_map = {
                "emergency": "critical",
                "urgent": "critical", 
                "critical": "critical",
                "serious": "high",
                "danger": "high",
                "safety": "high",
                "injury": "high",
                "fire": "critical",
                "gas": "critical",
                "problem": "medium",
                "issue": "medium",
                "broken": "medium"
            }
            
            severity = "low"
            for keyword, level in severity_map.items():
                if keyword in message.lower():
                    severity = level
                    break
            
            # Extract location from entities
            location = "Not specified"
            if entities.get("locations"):
                location = entities["locations"][0]
            
            # Create incident record
            insert_query = """
                INSERT INTO incidents (
                    reported_by, description, severity, 
                    created_at
                ) VALUES ($1, $2, $3, NOW())
                RETURNING id
            """
            
            title = f"Worker Report - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            
            incident_id = await self.connection.fetchval(
                insert_query, sender_id, message, 
                severity
            )
            
            print(f"🚨 Created incident #{incident_id} - Severity: {severity}")
            return True
            
        except Exception as e:
            print(f"❌ Incident creation failed: {e}")
            return False
    
    async def create_permission_request(self, sender_id: int, message: str, entities: Dict) -> bool:
        """Create permission request from worker message"""
        try:
            # Categorize permission type
            permission_types = {
                "overtime": ["overtime", "extra hours", "weekend", "holiday"],
                "access": ["access", "restricted", "locked", "secure"],
                "equipment": ["equipment", "machine", "tool", "vehicle"],
                "leave": ["leave", "time off", "sick", "vacation"],
                "general": []
            }
            
            perm_type = "general"
            for p_type, keywords in permission_types.items():
                if any(keyword in message.lower() for keyword in keywords):
                    perm_type = p_type
                    break
            
            # Create permission request (assuming we need to create this table)
            # For now, let's log it properly
            print(f"📋 Permission request: {perm_type} - {message}")
            
            # TODO: Create permissions table if it doesn't exist
            # For now, return success
            return True
            
        except Exception as e:
            print(f"❌ Permission request failed: {e}")
            return False
    
    async def update_attendance_record(self, sender_id: int, message: str, entities: Dict) -> bool:
        """Update attendance based on worker message"""
        try:
            # Determine attendance action
            attendance_actions = {
                "check_in": ["check in", "arrived", "here", "present", "on site"],
                "check_out": ["check out", "leaving", "finished", "going home"],
                "break_start": ["break", "lunch", "rest"],
                "break_end": ["back", "return", "resume"]
            }
            
            action = "check_in"  # default
            for act, keywords in attendance_actions.items():
                if any(keyword in message.lower() for keyword in keywords):
                    action = act
                    break
            
            # Log attendance (assuming attendance table structure)
            print(f"⏰ Attendance: {action} for worker {sender_id}")
            
            # TODO: Implement actual attendance table update
            return True
            
        except Exception as e:
            print(f"❌ Attendance update failed: {e}")
            return False
    
    async def log_general_message(self, sender_id: int, message: str, entities: Dict) -> bool:
        """Log general messages for manager review"""
        try:
            print(f"📝 General message logged from worker {sender_id}: {message}")
            # TODO: Create message log table
            return True
        except Exception as e:
            print(f"❌ Message logging failed: {e}")
            return False

# Global database processor instance
db_processor = DatabaseProcessor()

async def execute_database_action(action: str, sender_id: int, message: str, entities: Dict) -> bool:
    """Execute the appropriate database action"""
    
    if not db_processor.connection:
        await db_processor.connect()
    
    action_map = {
        "update_task_progress": db_processor.update_task_progress,
        "create_incident_record": db_processor.create_incident_record,
        "create_permission_request": db_processor.create_permission_request,
        "update_attendance_record": db_processor.update_attendance_record,
        "log_general_message": db_processor.log_general_message
    }
    
    handler = action_map.get(action)
    if handler:
        return await handler(sender_id, message, entities)
    else:
        print(f"❌ Unknown action: {action}")
        return False

# Test function
async def test_database():
    """Test database operations"""
    await db_processor.connect()
    
    # Test task update
    await db_processor.update_task_progress(
        1, "Just finished the electrical work in Building A", 
        {"locations": ["Building A"]}
    )
    
    # Test incident creation
    await db_processor.create_incident_record(
        1, "There's a water leak in the basement - urgent!", 
        {"locations": ["basement"], "urgency": ["urgent"]}
    )
    
    await db_processor.disconnect()

if __name__ == "__main__":
    asyncio.run(test_database())