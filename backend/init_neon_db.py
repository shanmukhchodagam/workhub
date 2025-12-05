import asyncio
from app.core.database import engine, Base
from app.models.user import User
from app.models.team import Team
from app.models.message import Message
from app.models.chat_session import ChatSession
from app.models.document import Document

async def init_db():
    print("Creating all tables in Neon database...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ All tables created successfully!")

if __name__ == "__main__":
    asyncio.run(init_db())
