import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User

async def verify_users():
    async with AsyncSessionLocal() as session:
        print("Querying users table...")
        result = await session.execute(select(User))
        users = result.scalars().all()
        
        if not users:
            print("No users found in the database!")
        else:
            print(f"Found {len(users)} users:")
            for user in users:
                # Print email and a snippet of the hash to prove it's there
                hash_preview = user.hashed_password[:10] + "..." if user.hashed_password else "None"
                print(f"ID: {user.id}, Email: {user.email}, Role: {user.role}, Password Hash: {hash_preview}")

if __name__ == "__main__":
    asyncio.run(verify_users())
