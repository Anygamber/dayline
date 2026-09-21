from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from crm.deps import get_current_user
from crm.models import User
from crm.schemas import LoginRequest, TokenResponse, UserOut
from crm.security import create_access_token, verify_password
from database import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["crm-auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalars(select(User).where(User.username == body.username.strip())).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Учётная запись отключена",
        )

    token = create_access_token(
        subject=user.username,
        role=user.role.value,
        user_id=user.id,
    )
    return TokenResponse(
        access_token=token,
        role=user.role,
        full_name=user.full_name,
        department=user.department,
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
