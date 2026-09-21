from sqlalchemy import select
from sqlalchemy.orm import Session

from crm.models import User
from crm.roles import UserRole
from crm.security import hash_password


DEMO_USERS: list[dict] = [
    {
        "username": "director",
        "password": "director123",
        "full_name": "Главный врач И.И. Петров",
        "role": UserRole.SUPERADMIN,
        "department": "Администрация",
    },
    {
        "username": "admin",
        "password": "admin123",
        "full_name": "Администратор С.А. Юнусова",
        "role": UserRole.RECEPTION,
        "department": "Ресепшн",
    },
    {
        "username": "hostess",
        "password": "hostess123",
        "full_name": "Хостес А.В. Норова",
        "role": UserRole.HOSTESS,
        "department": "Холл",
    },
    {
        "username": "doctor",
        "password": "doctor123",
        "full_name": "Врач-терапевт К.М. Саидов",
        "role": UserRole.DOCTOR,
        "department": "Терапия",
    },
    {
        "username": "support",
        "password": "support123",
        "full_name": "Техподдержка IT",
        "role": UserRole.SUPPORT,
        "department": "IT",
    },
]


def seed_crm_users(db: Session) -> None:
    for item in DEMO_USERS:
        exists = db.scalars(select(User).where(User.username == item["username"])).first()
        if exists is not None:
            continue
        db.add(
            User(
                username=item["username"],
                password_hash=hash_password(item["password"]),
                full_name=item["full_name"],
                role=item["role"],
                department=item["department"],
                is_active=True,
            )
        )
    db.commit()
