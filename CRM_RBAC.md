# Clinic CRM — RBAC

Медицинская CRM с ролями (FastAPI + SQLite JWT + Expo).

## Бэкенд (порт **8001**)

```powershell
cd c:\Users\user\Projects\Custom
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

### Роли

| Роль | Логин / пароль | Доступ |
|------|----------------|--------|
| superadmin | director / director123 | Пользователи, очередь, аналитика, логи |
| reception | admin / admin123 | Очередь, статусы, аналитика |
| hostess | hostess / hostess123 | Отметка прибытия, просмотр очереди |
| doctor | doctor / doctor123 | Только своя очередь, «На приёме» / «Завершено» |
| support | support / support123 | Только логи (без изменения медданных) |

### API

- `POST /api/v1/auth/login` → JWT
- `GET /api/v1/auth/me`
- `GET /api/v1/queue` (+ arrive / start / complete)
- `GET /api/v1/admin/users` (superadmin)
- `GET /api/v1/support/logs` (support + superadmin)
- `GET /api/v1/rbac/capabilities`

Swagger: http://127.0.0.1:8001/docs

Таблица `users`: id, username, password_hash, full_name, role, department, is_active.

## Expo (Web + Mobile)

`metro.config.js` добавляет расширение **`.wasm`** для `expo-sqlite` / wa-sqlite в браузере.

```powershell
cd c:\Users\user\Projects\Custom\mobile
npm install
npx expo start
```

- Экран `/login` (stack `Login`) сохраняет JWT в **SecureStore** (native) или **AsyncStorage** (web).
- После входа UI зависит от роли (`ClinicHomeScreen` + `capabilities`).

API URL по умолчанию: `http://127.0.0.1:8001`  
Переопределение: `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8001`

На физическом телефоне укажите LAN-IP ПК, не `127.0.0.1`.
