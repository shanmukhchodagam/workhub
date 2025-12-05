import asyncio
from sqlalchemy import text
from app.core.database import engine

async def reset_db():
    print("Dropping ALL tables with CASCADE...")
    async with engine.begin() as conn:
        # Execute commands separately
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO neondb_owner"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
    print("✅ All old tables dropped!")
    
    print("\nCreating new tables with correct schema...")
    from app.core.database import Base
    from app.models.user import User
    from app.models.team import Team
    from app.models.message import Message
    from app.models.chat_session import ChatSession
    from app.models.document import Document
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ All tables created successfully!")
    
    print("\n📋 Tables created:")
    print("  - teams (id, name, plan_type, created_at)")
    print("  - users (id, team_id, email, hashed_password, role, force_reset, full_name, created_at)")
    print("  - chat_sessions (id, user_id, team_id, created_at)")
    print("  - messages (id, chat_id, sender, content, created_at)")
    print("  - documents (id, team_id, file_url, status, created_at)")

if __name__ == "__main__":
    asyncio.run(reset_db())
