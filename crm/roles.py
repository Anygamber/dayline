from enum import Enum


class UserRole(str, Enum):
    SUPERADMIN = "superadmin"
    RECEPTION = "reception"
    HOSTESS = "hostess"
    DOCTOR = "doctor"
    SUPPORT = "support"


ROLE_LABELS: dict[UserRole, str] = {
    UserRole.SUPERADMIN: "Главный врач / Директор",
    UserRole.RECEPTION: "Администратор / Ресепшн",
    UserRole.HOSTESS: "Хостес",
    UserRole.DOCTOR: "Врач",
    UserRole.SUPPORT: "Техподдержка",
}
