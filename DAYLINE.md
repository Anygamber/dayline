# Dayline — Habitify × Todoist × Namoz Vaqti

Гибрид трекера привычек и таск-менеджера с **динамическим днём по намазам**.

## 8 суточных блоков (цикл)

Порядок отображения: **Сон → Сухур → Бомдод → Аввало → Пешин → Аср → Шом → Хуфтон**

| Код | Название | Границы |
|-----|----------|---------|
| `xufton` | Хуфтон | Isha → **22:00** (жёстко) |
| `son` | Сон | **22:00** → старт Сухура (через полночь) |
| `suhoor` | Сухур | Бомдод **− 40 мин** → Бомдод |
| `bomdod` | Бомдод | Fajr → sunrise (Quyosh) |
| `avvalo` | Аввало | sunrise → Пешин |
| `peshin` | Пешин | Dhuhr → Asr |
| `asr` | Аср | Asr → Maghrib |
| `shom` | Шом | Maghrib → Isha |

Цикл без разрывов: Хуфтон → Сон → Сухур → Бомдод → Аввало → Пешин → Аср → Шом → Хуфтон.

## API

```
GET /api/day-timeline?region=toshkent
```

Поля интервала: `code`, `label`, `start_time`, `end_time`, `wraps_midnight`, `is_current`, `progress`.

## Запуск

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8001
# прототип: http://127.0.0.1:8001/
cd mobile && npx expo start
```
