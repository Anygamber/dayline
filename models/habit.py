from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING, Literal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

if TYPE_CHECKING:
    from models.day_interval import DayInterval

TimingMode = Literal["first_n", "last_n", "after_start", "anytime"]


class Habit(Base):
    """Habit definition with optional intra-block timing window."""

    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_interval_code: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    # first_n | last_n | after_start | anytime
    timing_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="anytime")
    start_offset_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    trackings: Mapped[list[HabitTracking]] = relationship(
        "HabitTracking",
        back_populates="habit",
        cascade="all, delete-orphan",
    )


class HabitTracking(Base):
    """Per-day completion mark for a habit within a specific day interval."""

    __tablename__ = "habits_tracking"
    __table_args__ = (
        UniqueConstraint(
            "habit_id",
            "interval_id",
            "date",
            name="uq_habits_tracking_habit_interval_date",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    habit_id: Mapped[int] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    interval_id: Mapped[int] = mapped_column(
        ForeignKey("day_intervals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    habit: Mapped[Habit] = relationship("Habit", back_populates="trackings")
    interval: Mapped[DayInterval] = relationship("DayInterval", back_populates="habit_trackings")


def _to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _from_minutes(total: int) -> time:
    total = total % (24 * 60)
    return time(total // 60, total % 60)


def resolve_habit_window(
    *,
    block_start: time,
    block_end: time,
    wraps_midnight: bool,
    timing_mode: str,
    start_offset_minutes: int | None,
    duration_minutes: int | None,
) -> tuple[time | None, time | None, str]:
    """
    Return (window_start, window_end, human hint) inside a day block.
    """
    bs = _to_minutes(block_start)
    be = _to_minutes(block_end)
    if wraps_midnight or bs > be:
        length = 24 * 60 - bs + be
    else:
        length = max(0, be - bs)

    def abs_at(offset: int) -> time:
        return _from_minutes(bs + offset)

    mode = timing_mode or "anytime"
    if mode == "anytime" or length <= 0:
        return block_start, block_end, "в течение блока"

    if mode == "first_n":
        dur = duration_minutes or 0
        end_off = min(dur, length)
        hint = f"первые {dur} мин"
        return abs_at(0), abs_at(end_off), hint

    if mode == "last_n":
        dur = duration_minutes or 0
        start_off = max(0, length - dur)
        hint = f"последние {dur} мин"
        return abs_at(start_off), block_end if not wraps_midnight else abs_at(length), hint

    if mode == "after_start":
        start_off = start_offset_minutes or 0
        if duration_minutes is None:
            hint = f"с +{start_off} мин"
            return abs_at(start_off), block_end if not wraps_midnight else abs_at(length), hint
        end_off = min(start_off + duration_minutes, length)
        hint = f"+{start_off} мин · {duration_minutes} мин"
        return abs_at(start_off), abs_at(end_off), hint

    return block_start, block_end, "в течение блока"


def is_now_in_habit_window(
    now: time,
    window_start: time | None,
    window_end: time | None,
    *,
    wraps_midnight: bool = False,
) -> bool:
    if window_start is None or window_end is None:
        return True
    ns, ws, we = _to_minutes(now), _to_minutes(window_start), _to_minutes(window_end)
    if wraps_midnight and ws > we:
        return ns >= ws or ns < we
    if ws <= we:
        return ws <= ns < we
    return ns >= ws or ns < we
