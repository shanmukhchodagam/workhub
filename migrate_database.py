"""
Database Migration Script for WorkHub Platform
Adds attendance tracking, permission requests, and enhanced task management
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

# Database connection URL (using same as backend)
DATABASE_URL = "postgresql://neondb_owner:npg_j4WT9JuyPwgk@ep-royal-lab-a1t6h3fg-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?ssl=require"

async def run_migration():
    """Execute database migration"""
    conn = None
    try:
        # Connect to database
        conn = await asyncpg.connect(DATABASE_URL)
        print("✅ Connected to database")
        
        # Create attendance table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                check_in_time TIMESTAMPTZ,
                check_out_time TIMESTAMPTZ,
                break_start TIMESTAMPTZ,
                break_end TIMESTAMPTZ,
                location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'checked_out',
                notes TEXT,
                work_hours VARCHAR(20),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        print("✅ Created attendance table")
        
        # Create permission_requests table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS permission_requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                manager_id INTEGER REFERENCES users(id),
                request_type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                requested_date TIMESTAMPTZ,
                requested_hours VARCHAR(20),
                status VARCHAR(50) DEFAULT 'pending',
                manager_response TEXT,
                approved_by INTEGER REFERENCES users(id),
                approved_at TIMESTAMPTZ,
                priority VARCHAR(20) DEFAULT 'normal',
                is_urgent BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        print("✅ Created permission_requests table")
        
        # Enhance tasks table with new columns
        try:
            await conn.execute("""
                ALTER TABLE tasks 
                ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id),
                ADD COLUMN IF NOT EXISTS team_id INTEGER,
                ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal',
                ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS estimated_hours FLOAT,
                ADD COLUMN IF NOT EXISTS actual_hours FLOAT,
                ADD COLUMN IF NOT EXISTS location VARCHAR(255),
                ADD COLUMN IF NOT EXISTS equipment_needed TEXT,
                ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS last_update TEXT,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
            """)
            print("✅ Enhanced tasks table")
        except Exception as e:
            print(f"⚠️  Tasks table enhancement warning (might already exist): {e}")
        
        # Create indexes for better performance
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_permission_requests_user ON permission_requests(user_id);
            CREATE INDEX IF NOT EXISTS idx_permission_requests_manager ON permission_requests(manager_id);
            CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
        """)
        print("✅ Created database indexes")
        
        # Insert some sample data for testing
        print("\n🔄 Adding sample data...")
        
        # Sample attendance records
        await conn.execute("""
            INSERT INTO attendance (user_id, check_in_time, status, location, notes) 
            VALUES 
                (1, NOW() - INTERVAL '2 hours', 'checked_in', 'Main Building', 'Regular check-in'),
                (2, NOW() - INTERVAL '3 hours', 'on_break', 'Warehouse A', 'Lunch break')
            ON CONFLICT DO NOTHING;
        """)
        
        # Sample permission requests  
        await conn.execute("""
            INSERT INTO permission_requests (user_id, manager_id, request_type, title, description, priority) 
            VALUES 
                (1, 1, 'overtime', 'Weekend Overtime Request', 'Need overtime approval for urgent project completion', 'high'),
                (2, 1, 'vacation', 'Annual Leave Request', 'Requesting 3 days off for family vacation', 'normal')
            ON CONFLICT DO NOTHING;
        """)
        
        # Sample enhanced tasks
        await conn.execute("""
            INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, status, location, progress_percentage) 
            VALUES 
                ('Inventory Count - Section A', 'Complete inventory count for warehouse section A', 1, 1, 'high', 'in_progress', 'Warehouse A', 60),
                ('Safety Equipment Check', 'Inspect all safety equipment in main building', 2, 1, 'urgent', 'pending', 'Main Building', 0)
            ON CONFLICT DO NOTHING;
        """)
        
        print("✅ Sample data added")
        print("\n🎉 Database migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        if conn:
            await conn.close()
            print("🔌 Database connection closed")

if __name__ == "__main__":
    asyncio.run(run_migration())