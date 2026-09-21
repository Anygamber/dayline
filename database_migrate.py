"""Additive schema migrations — never drop or wipe user tables."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from database import SessionLocal, engine


def _sqlite_columns(db: Session, table: str) -> set[str]:
    rows = db.execute(text(f"PRAGMA table_info({table})")).mappings().all()
    return {r["name"] for r in rows}


def migrate_schema() -> None:
    """Safe additive columns for existing SQLite / cloud DBs."""
    if not str(engine.url).startswith("sqlite"):
        return

    with SessionLocal() as db:
        # habits_tracking.status (pending | done | skipped)
        if "habits_tracking" in {
            r[0]
            for r in db.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            ).all()
        }:
            cols = _sqlite_columns(db, "habits_tracking")
            if "status" not in cols:
                db.execute(
                    text(
                        "ALTER TABLE habits_tracking "
                        "ADD COLUMN status VARCHAR(16) DEFAULT 'pending'"
                    )
                )
                # Preserve existing completions — do not touch other rows.
                db.execute(
                    text(
                        "UPDATE habits_tracking SET status = 'done' "
                        "WHERE is_done = 1 AND (status IS NULL OR status = 'pending')"
                    )
                )
                db.execute(
                    text(
                        "UPDATE habits_tracking SET status = 'pending' "
                        "WHERE is_done = 0 AND status IS NULL"
                    )
                )
                db.commit()
