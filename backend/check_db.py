import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def check_schema():
    async with AsyncSessionLocal() as session:
        print("Checking tables...")
        result = await session.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
        tables = result.fetchall()
        print("Tables found:", [t[0] for t in tables])
        
        for table in tables:
            t_name = table[0]
            print(f"\nColumns in {t_name}:")
            cols = await session.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{t_name}'"))
            for col in cols:
                print(f"  - {col[0]} ({col[1]})")

if __name__ == "__main__":
    asyncio.run(check_schema())
