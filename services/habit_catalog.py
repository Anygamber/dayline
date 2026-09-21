"""Canonical Dayline habit catalog with intra-block timing."""

from __future__ import annotations

from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from models.habit import Habit, HabitTracking

# New Dayline habits — replaces any previous defaults.
DAYLINE_HABITS: list[dict] = [
    {
        "slug": "taxorat",
        "title": "taxorat",
        "description": "Первые 20 минут Сухура",
        "default_interval_code": "suhoor",
        "timing_mode": "first_n",
        "start_offset_minutes": 0,
        "duration_minutes": 20,
        "sort_order": 10,
    },
    {
        "slug": "taxajud",
        "title": "taxajud",
        "description": "Последние 20 минут Сухура (перед Бомдод)",
        "default_interval_code": "suhoor",
        "timing_mode": "last_n",
        "start_offset_minutes": None,
        "duration_minutes": 20,
        "sort_order": 20,
    },
    {
        "slug": "nafisbot",
        "title": "nafisbot",
        "description": "Первые 20 минут Бомдода",
        "default_interval_code": "bomdod",
        "timing_mode": "first_n",
        "start_offset_minutes": 0,
        "duration_minutes": 20,
        "sort_order": 30,
    },
    {
        "slug": "tilovat",
        "title": "tilovat",
        "description": "Сразу после nafisbot · 5 минут",
        "default_interval_code": "bomdod",
        "timing_mode": "after_start",
        "start_offset_minutes": 20,
        "duration_minutes": 5,
        "sort_order": 40,
    },
    {
        "slug": "jamoat",
        "title": "jamoat",
        "description": "Сразу после tilovat · 20 минут",
        "default_interval_code": "bomdod",
        "timing_mode": "after_start",
        "start_offset_minutes": 25,
        "duration_minutes": 20,
        "sort_order": 50,
    },
    {
        "slug": "ishroq",
        "title": "ishroq",
        "description": "Через 15 минут после начала Аввало",
        "default_interval_code": "avvalo",
        "timing_mode": "after_start",
        "start_offset_minutes": 15,
        "duration_minutes": None,
        "sort_order": 60,
    },
    {
        "slug": "qiroat",
        "title": "qiroat",
        "description": "В течение Аввало (гибко)",
        "default_interval_code": "avvalo",
        "timing_mode": "anytime",
        "start_offset_minutes": None,
        "duration_minutes": None,
        "sort_order": 70,
    },
    {
        "slug": "zeekr",
        "title": "zeekr",
        "description": "В течение Аввало (гибко)",
        "default_interval_code": "avvalo",
        "timing_mode": "anytime",
        "start_offset_minutes": None,
        "duration_minutes": None,
        "sort_order": 80,
    },
]

HABIT_CATALOG_VERSION = "dayline_v2_namoz_windows"


def _ensure_habit_columns(db: Session) -> None:
    """SQLite-friendly additive migration for new habit timing fields."""
    rows = db.execute(text("PRAGMA table_info(habits)")).mappings().all()
    names = {r["name"] for r in rows}
    alters: list[str] = []
    if "slug" not in names:
        alters.append("ALTER TABLE habits ADD COLUMN slug VARCHAR(64)")
    if "timing_mode" not in names:
        alters.append("ALTER TABLE habits ADD COLUMN timing_mode VARCHAR(32) DEFAULT 'anytime'")
    if "start_offset_minutes" not in names:
        alters.append("ALTER TABLE habits ADD COLUMN start_offset_minutes INTEGER")
    if "duration_minutes" not in names:
        alters.append("ALTER TABLE habits ADD COLUMN duration_minutes INTEGER")
    if "sort_order" not in names:
        alters.append("ALTER TABLE habits ADD COLUMN sort_order INTEGER DEFAULT 0")
    for stmt in alters:
        db.execute(text(stmt))
    if alters:
        db.commit()


def reset_and_seed_dayline_habits(db: Session, *, force: bool = False) -> None:
    """
    Install the Dayline catalog. Clears legacy habits when the slug set differs
    from DAYLINE_HABITS (or when force=True).
    """
    _ensure_habit_columns(db)

    expected = {item["slug"] for item in DAYLINE_HABITS}
    existing = list(db.scalars(select(Habit)).all())
    existing_slugs = {h.slug for h in existing if h.slug}

    if not force and existing_slugs == expected and len(existing) == len(DAYLINE_HABITS):
        by_slug = {h.slug: h for h in existing}
        dirty = False
        for item in DAYLINE_HABITS:
            row = by_slug[item["slug"]]
            for key in (
                "title",
                "description",
                "default_interval_code",
                "timing_mode",
                "start_offset_minutes",
                "duration_minutes",
                "sort_order",
            ):
                if getattr(row, key) != item[key]:
                    setattr(row, key, item[key])
                    dirty = True
            if not row.is_active:
                row.is_active = True
                dirty = True
        if dirty:
            db.commit()
        return

    db.execute(delete(HabitTracking))
    db.execute(delete(Habit))
    db.commit()

    for item in DAYLINE_HABITS:
        db.add(
            Habit(
                slug=item["slug"],
                title=item["title"],
                description=item["description"],
                default_interval_code=item["default_interval_code"],
                timing_mode=item["timing_mode"],
                start_offset_minutes=item["start_offset_minutes"],
                duration_minutes=item["duration_minutes"],
                sort_order=item["sort_order"],
                is_active=True,
            )
        )
    db.commit()
