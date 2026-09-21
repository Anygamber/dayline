from pydantic import BaseModel, ConfigDict, Field

from crm.roles import UserRole


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    full_name: str
    department: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: UserRole
    department: str | None = None
    is_active: bool


class QueueItemOut(BaseModel):
    id: int
    patient_name: str
    doctor_username: str | None
    status: str
    department: str | None = None
    arrived_at: str | None = None


class SupportLogOut(BaseModel):
    id: int
    level: str
    message: str
    created_at: str
