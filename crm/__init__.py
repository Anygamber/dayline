from crm.models import User
from crm.roles import UserRole
from crm.routers_auth import router as auth_router
from crm.routers_clinic import router as clinic_router

__all__ = [
    "User",
    "UserRole",
    "auth_router",
    "clinic_router",
]
