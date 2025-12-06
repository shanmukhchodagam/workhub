#!/usr/bin/env python3
import asyncio
import asyncpg
import sys

DATABASE_URL = "postgresql://neondb_owner:npg_j4WT9JuyPwgk@ep-royal-lab-a1t6h3fg-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?ssl=require"

async def run_migration():
    conn = None
    try:
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
        
        print("🎉 Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(run_migration())