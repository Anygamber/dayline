from __future__ import annotations

from datetime import date, time
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

if TYPE_CHECKING:
    from models.habit import HabitTracking
    from models.prayer_time import PrayerTime


class DayInterval(Base):
    """Time block of a day bounded by consecutive prayer times (or midnight edges)."""

    __tablename__ = "day_intervals"
    __table_args__ = (
        UniqueConstraint(
            "date",
            "region",
            "code",
            name="uq_day_intervals_date_region_code",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    prayer_time_id: Mapped[int] = mapped_column(
        ForeignKey("prayer_times.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    code: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    prayer_time: Mapped[PrayerTime] = relationship("PrayerTime", back_populates="intervals")
    habit_trackings: Mapped[list[HabitTracking]] = relationship(
        "HabitTracking",
        back_populates="interval",
        cascade="all, delete-orphan",
    )
