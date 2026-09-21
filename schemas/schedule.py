from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field


class PrayerTimesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    region: str
    fajr: time
    dhuhr: time
    asr: time
    maghrib: time
    isha: time
    sunrise: time | None = None
    source: str
    fetched_at: datetime | None = None
    cached: bool = False


class HabitItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    habit_id: int
    slug: str | None = None
    title: str
    description: str | None = None
    is_done: bool
    status: str = "pending"
    is_skipped: bool = False
    note: str | None = None
    timing_mode: str = "anytime"
    start_offset_minutes: int | None = None
    duration_minutes: int | None = None
    window_start: time | None = None
    window_end: time | None = None
    timing_hint: str | None = None
    is_active_window: bool = False


class DayIntervalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    label: str
    start_time: time
    end_time: time
    sort_order: int
    is_current: bool = False
    wraps_midnight: bool = False
    habits: list[HabitItemOut] = Field(default_factory=list)
    progress: float = 0.0


class NextPrayerOut(BaseModel):
    code: str
    label: str
    time: time
    minutes_remaining: int


class DayTimelineOut(BaseModel):
    date: date
    region: str
    current_time: time
    prayer_times: PrayerTimesOut
    next_prayer: NextPrayerOut | None = None
    current_interval: DayIntervalOut | None
    intervals: list[DayIntervalOut]
