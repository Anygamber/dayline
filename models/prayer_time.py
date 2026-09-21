from __future__ import annotations

from datetime import date, datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, String, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

if TYPE_CHECKING:
    from models.day_interval import DayInterval


class PrayerTime(Base):
    """Daily prayer schedule for a region (cached from namozvaqti.uz)."""

    __tablename__ = "prayer_times"
    __table_args__ = (
        UniqueConstraint("date", "region", name="uq_prayer_times_date_region"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    fajr: Mapped[time] = mapped_column(Time, nullable=False)  # Bomdod
    dhuhr: Mapped[time] = mapped_column(Time, nullable=False)  # Peshin / Zuhr
    asr: Mapped[time] = mapped_column(Time, nullable=False)
    maghrib: Mapped[time] = mapped_column(Time, nullable=False)  # Shom
    isha: Mapped[time] = mapped_column(Time, nullable=False)  # Xufton / Hufton

    source: Mapped[str] = mapped_column(String(128), nullable=False, default="namozvaqti.uz")
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    intervals: Mapped[list[DayInterval]] = relationship(
        "DayInterval",
        back_populates="prayer_time",
        cascade="all, delete-orphan",
        order_by="DayInterval.sort_order",
    )
