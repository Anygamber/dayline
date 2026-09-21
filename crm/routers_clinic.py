"""Protected clinic endpoints demonstrating RBAC."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from crm.deps import get_current_user, require_roles
from crm.models import User
from crm.roles import UserRole
from crm.schemas import QueueItemOut, SupportLogOut, UserOut
from database import get_db

router = APIRouter(prefix="/api/v1", tags=["crm"])


@dataclass
class QueueItem:
    id: int
    patient_name: str
    doctor_username: str | None
    status: str  # waiting | arrived | in_progress | done
    department: str | None = None
    arrived_at: str | None = None


# In-memory demo queue (persists for process lifetime; enough for RBAC demo)
_QUEUE: list[QueueItem] = [
    QueueItem(1, "Алиева М.К.", "doctor", "waiting", "Терапия"),
    QueueItem(2, "Каримов Д.С.", "doctor", "waiting", "Терапия"),
    QueueItem(3, "Рахимова Н.А.", "doctor", "arrived", "Терапия", arrived_at="09:12"),
]
_SUPPORT_LOGS: list[dict] = [
    {
        "id": 1,
        "level": "info",
        "message": "CRM API started",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
]


def _append_log(message: str, level: str = "info") -> None:
    _SUPPORT_LOGS.append(
        {
            "id": len(_SUPPORT_LOGS) + 1,
            "level": level,
            "message": message,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )


def _to_out(item: QueueItem) -> QueueItemOut:
    return QueueItemOut(
        id=item.id,
        patient_name=item.patient_name,
        doctor_username=item.doctor_username,
        status=item.status,
        department=item.department,
        arrived_at=item.arrived_at,
    )


@router.get(
    "/queue",
    response_model=list[QueueItemOut],
    summary="Живая очередь клиники",
)
def get_queue(
    user: User = Depends(
        require_roles(
            UserRole.SUPERADMIN,
            UserRole.RECEPTION,
            UserRole.HOSTESS,
            UserRole.DOCTOR,
        )
    ),
) -> list[QueueItemOut]:
    items = _QUEUE
    if user.role == UserRole.DOCTOR:
        items = [q for q in items if q.doctor_username == user.username and q.status != "done"]
    return [_to_out(q) for q in items]


@router.post(
    "/queue/{item_id}/arrive",
    response_model=QueueItemOut,
    summary="Отметить прибытие пациента (холл)",
)
def mark_arrived(
    item_id: int,
    user: User = Depends(
        require_roles(UserRole.SUPERADMIN, UserRole.RECEPTION, UserRole.HOSTESS)
    ),
) -> QueueItemOut:
    item = next((q for q in _QUEUE if q.id == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    item.status = "arrived"
    item.arrived_at = datetime.now(timezone.utc).strftime("%H:%M")
    _append_log(f"{user.username} отметил прибытие #{item_id} ({item.patient_name})")
    return _to_out(item)


@router.post(
    "/queue/{item_id}/start",
    response_model=QueueItemOut,
    summary="Взять пациента на приём",
)
def start_visit(
    item_id: int,
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.DOCTOR)),
) -> QueueItemOut:
    item = next((q for q in _QUEUE if q.id == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    if user.role == UserRole.DOCTOR and item.doctor_username != user.username:
        raise HTTPException(status_code=403, detail="Это не ваш пациент")
    item.status = "in_progress"
    _append_log(f"{user.username} начал приём #{item_id}")
    return _to_out(item)


@router.post(
    "/queue/{item_id}/complete",
    response_model=QueueItemOut,
    summary="Завершить приём",
)
def complete_visit(
    item_id: int,
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.DOCTOR)),
) -> QueueItemOut:
    item = next((q for q in _QUEUE if q.id == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    if user.role == UserRole.DOCTOR and item.doctor_username != user.username:
        raise HTTPException(status_code=403, detail="Это не ваш пациент")
    item.status = "done"
    _append_log(f"{user.username} завершил приём #{item_id}")
    return _to_out(item)


@router.get(
    "/admin/users",
    response_model=list[UserOut],
    summary="Список пользователей (только директор)",
)
def list_users(
    user: User = Depends(require_roles(UserRole.SUPERADMIN)),
    db: Session = Depends(get_db),
) -> list[User]:
    _ = user
    return list(db.scalars(select(User).order_by(User.id)).all())


@router.get(
    "/support/logs",
    response_model=list[SupportLogOut],
    summary="Логи мониторинга (support, без изменения медданных)",
)
def support_logs(
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.SUPPORT)),
) -> list[SupportLogOut]:
    _ = user
    return [SupportLogOut(**row) for row in _SUPPORT_LOGS]


@router.get("/rbac/capabilities")
def capabilities(user: User = Depends(get_current_user)) -> dict:
    """Frontend helper: which UI panels the role may see."""
    role = user.role
    return {
        "role": role.value,
        "full_name": user.full_name,
        "can_manage_users": role == UserRole.SUPERADMIN,
        "can_view_full_queue": role in {UserRole.SUPERADMIN, UserRole.RECEPTION, UserRole.HOSTESS},
        "can_view_doctor_queue": role in {UserRole.SUPERADMIN, UserRole.DOCTOR},
        "can_mark_arrival": role in {UserRole.SUPERADMIN, UserRole.RECEPTION, UserRole.HOSTESS},
        "can_run_visit": role in {UserRole.SUPERADMIN, UserRole.DOCTOR},
        "can_view_analytics": role in {UserRole.SUPERADMIN, UserRole.RECEPTION},
        "can_view_logs": role in {UserRole.SUPERADMIN, UserRole.SUPPORT},
        "read_only_medical": role == UserRole.SUPPORT,
    }
