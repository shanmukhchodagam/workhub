from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.models.team import Team
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    team_name: str # Manager creates a team

class Token(BaseModel):
    access_token: str
    token_type: str

class UserProfile(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    team_id: int
    force_reset: bool

class ProfileUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@router.post("/register/manager", response_model=Token)
async def register_manager(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    try:
        # Check if email exists
        result = await db.execute(select(User).where(User.email == user_in.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        
        # Create Team
        new_team = Team(name=user_in.team_name, plan_type="Free")
        db.add(new_team)
        await db.commit()
        await db.refresh(new_team)
        
        # Create Manager User
        hashed_password = get_password_hash(user_in.password)
        new_user = User(
            email=user_in.email,
            full_name=user_in.full_name,
            hashed_password=hashed_password,
            role="Manager",
            team_id=new_team.id
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        access_token_expires = timedelta(minutes=1440)
        access_token = create_access_token(
            data={"sub": new_user.email, "role": new_user.role, "user_id": new_user.id, "team_id": new_team.id},
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error registering manager: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Server Error: {str(e)}",
        )

class UserRegisterEmployee(BaseModel):
    email: str
    password: str
    full_name: str

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        from jose import jwt, JWTError
        from app.core.security import ALGORITHM
        from app.core.config import settings
        
        # print(f"DEBUG: Validating token: {token[:10]}...") 
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            print("DEBUG: Token missing 'sub' (email)")
            raise credentials_exception
    except JWTError as e:
        print(f"DEBUG: JWT Validation Error: {e}")
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        print(f"DEBUG: User not found for email: {email}")
        raise credentials_exception
    return user

@router.post("/register/employee", response_model=Token)
async def register_employee(
    user_in: UserRegisterEmployee, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "Manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers can register employees"
        )

    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Create Employee User linked to Manager's Team
    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hashed_password,
        role="Employee",
        team_id=current_user.team_id,
        force_reset=True # Employees must reset password on first login
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Return token for the new user (optional, or just success message)
    # For now, let's return a token so they can be auto-logged in if needed, 
    # or the manager can see it worked.
    access_token_expires = timedelta(minutes=1440)
    access_token = create_access_token(
        data={"sub": new_user.email, "role": new_user.role, "user_id": new_user.id, "team_id": current_user.team_id, "force_reset": True},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    # OAuth2PasswordRequestForm uses 'username' field, but we treat it as email
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=1440)
    access_token = create_access_token(
        data={
            "sub": user.email, 
            "role": user.role, 
            "user_id": user.id, 
            "team_id": user.team_id,
            "force_reset": user.force_reset
        },
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserProfile)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user profile information"""
    return UserProfile(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        team_id=current_user.team_id,
        force_reset=current_user.force_reset
    )

@router.put("/profile")
async def update_profile(
    profile_update: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile (name and/or email)"""
    if profile_update.email:
        # Check if email is already taken by another user
        result = await db.execute(
            select(User).where(User.email == profile_update.email, User.id != current_user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        current_user.email = profile_update.email
    
    if profile_update.full_name:
        current_user.full_name = profile_update.full_name
    
    await db.commit()
    await db.refresh(current_user)
    
    return {"message": "Profile updated successfully"}

@router.post("/change-password")
async def change_password(
    password_change: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change user password"""
    # Verify current password
    if not verify_password(password_change.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(password_change.new_password)
    current_user.force_reset = False  # Clear force_reset flag if it was set
    
    await db.commit()
    
    return {"message": "Password changed successfully"}

@router.post("/logout")
async def logout():
    """Logout endpoint (client-side token removal)"""
    # Since we're using JWT, logout is handled client-side by removing the token
    # This endpoint exists for consistency and future enhancements (e.g., token blacklisting)
    return {"message": "Logged out successfully"}

@router.get("/team-members")
async def get_team_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all team members for the current user's team"""
    if current_user.role != "Manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers can view team members"
        )
    
    result = await db.execute(
        select(User).where(User.team_id == current_user.team_id).order_by(User.created_at)
    )
    team_members = result.scalars().all()
    
    return [{
        "id": member.id,
        "email": member.email,
        "full_name": member.full_name,
        "role": member.role,
        "created_at": member.created_at.isoformat(),
        "force_reset": member.force_reset
    } for member in team_members]

@router.put("/update-member/{member_id}")
async def update_team_member(
    member_id: int,
    update_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update team member information"""
    if current_user.role != "Manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers can update team members"
        )
    
    # Get the member to update
    result = await db.execute(
        select(User).where(
            User.id == member_id, 
            User.team_id == current_user.team_id,
            User.role != "Manager"  # Prevent editing other managers
        )
    )
    member = result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found or cannot be edited"
        )
    
    # Check if email is already taken by another user
    if update_data.email and update_data.email != member.email:
        result = await db.execute(
            select(User).where(User.email == update_data.email, User.id != member.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        member.email = update_data.email
    
    if update_data.full_name:
        member.full_name = update_data.full_name
    
    await db.commit()
    await db.refresh(member)
    
    return {"message": "Team member updated successfully"}

@router.delete("/delete-member/{member_id}")
async def delete_team_member(
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete team member"""
    if current_user.role != "Manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers can delete team members"
        )
    
    # Get the member to delete
    result = await db.execute(
        select(User).where(
            User.id == member_id, 
            User.team_id == current_user.team_id,
            User.role != "Manager"  # Prevent deleting other managers
        )
    )
    member = result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found or cannot be deleted"
        )
    
    await db.delete(member)
    await db.commit()
    
    return {"message": "Team member deleted successfully"}
