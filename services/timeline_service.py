"""Day timeline: current prayer-bounded interval + linked habits."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from zoneinfo import ZoneInfo

from config import Settings, get_settings
from models.day_interval import DayInterval
from models.habit import (
    Habit,
    HabitTracking,
    is_now_in_habit_window,
    resolve_habit_window,
)
from schemas.schedule import (
    DayIntervalOut,
    DayTimelineOut,
    HabitItemOut,
    NextPrayerOut,
    PrayerTimesOut,
)
from services.prayer_service import (
    PrayerService,
    find_current_interval_code,
    is_time_in_interval,
    next_prayer_info,
    normalize_region,
)


class TimelineService:
    def __init__(self, db: Session, settings: Settings | None = None) -> None:
        self.db = db
        self.settings = settings or get_settings()
        self.prayer_service = PrayerService(db, self.settings)

    def get_day_timeline(self, region: str | None = None) -> DayTimelineOut:
        region = normalize_region(region or self.settings.default_region)
        prayer_row, cached = self.prayer_service.get_or_fetch_today(region)
        now = datetime.now(ZoneInfo(self.settings.timezone))
        current_time = now.time().replace(microsecond=0)

        self._ensure_habit_trackings(prayer_row.date, region, prayer_row.intervals)

        intervals = (
            self.db.scalars(
                select(DayInterval)
                .where(DayInterval.date == prayer_row.date, DayInterval.region == region)
                .options(
                    selectinload(DayInterval.habit_trackings).selectinload(HabitTracking.habit)
                )
                .order_by(DayInterval.sort_order)
            )
            .unique()
            .all()
        )

        data = self.prayer_service.to_data(prayer_row)
        current_code = find_current_interval_code(data, current_time)

        interval_outs: list[DayIntervalOut] = []
        current_interval: DayIntervalOut | None = None

        for interval in intervals:
            wraps = interval.code == "son"
            is_current = is_time_in_interval(
                current_time,
                interval.start_time,
                interval.end_time,
                wraps_midnight=wraps,
            ) or interval.code == current_code

            habit_rows: list[HabitItemOut] = []
            for tracking in sorted(
                interval.habit_trackings,
                key=lambda t: (
                    t.habit.sort_order if t.habit else 0,
                    t.habit_id,
                ),
            ):
                habit = tracking.habit
                if habit is None or not habit.is_active:
                    continue
                w_start, w_end, hint = resolve_habit_window(
                    block_start=interval.start_time,
                    block_end=interval.end_time,
                    wraps_midnight=wraps,
                    timing_mode=habit.timing_mode or "anytime",
                    start_offset_minutes=habit.start_offset_minutes,
                    duration_minutes=habit.duration_minutes,
                )
                active_window = is_now_in_habit_window(
                    current_time,
                    w_start,
                    w_end,
                    wraps_midnight=wraps and habit.timing_mode == "anytime",
                )
                habit_rows.append(
                    HabitItemOut(
                        id=tracking.id,
                        habit_id=tracking.habit_id,
                        slug=habit.slug,
                        title=habit.title,
                        description=habit.description,
                        is_done=tracking.is_done,
                        note=tracking.note,
                        timing_mode=habit.timing_mode or "anytime",
                        start_offset_minutes=habit.start_offset_minutes,
                        duration_minutes=habit.duration_minutes,
                        window_start=w_start,
                        window_end=w_end,
                        timing_hint=hint,
                        is_active_window=active_window and is_current,
                    )
                )
            habits = habit_rows
            done = sum(1 for h in habits if h.is_done)
            progress = (done / len(habits)) if habits else 0.0

            item = DayIntervalOut(
                id=interval.id,
                code=interval.code,
                label=interval.label,
                start_time=interval.start_time,
                end_time=interval.end_time,
                sort_order=interval.sort_order,
                is_current=is_current,
                wraps_midnight=wraps,
                habits=habits,
                progress=progress,
            )
            interval_outs.append(item)
            if is_current:
                current_interval = item

        nxt = next_prayer_info(data, current_time)
        next_out = NextPrayerOut(**nxt) if nxt else None

        prayer_out = PrayerTimesOut(
            date=prayer_row.date,
            region=prayer_row.region,
            fajr=prayer_row.fajr,
            dhuhr=prayer_row.dhuhr,
            asr=prayer_row.asr,
            maghrib=prayer_row.maghrib,
            isha=prayer_row.isha,
            sunrise=data.sunrise,
            source=prayer_row.source,
            fetched_at=prayer_row.fetched_at,
            cached=cached,
        )

        return DayTimelineOut(
            date=prayer_row.date,
            region=region,
            current_time=current_time,
            prayer_times=prayer_out,
            next_prayer=next_out,
            current_interval=current_interval,
            intervals=interval_outs,
        )

    def _ensure_habit_trackings(
        self,
        on_date,
        region: str,
        intervals: list[DayInterval],
    ) -> None:
        """Attach active habits to today's matching intervals if not yet tracked."""
        if not intervals:
            return

        habits = self.db.scalars(select(Habit).where(Habit.is_active.is_(True))).all()
        if not habits:
            return

        intervals_by_code = {item.code: item for item in intervals}
        existing = {
            (t.habit_id, t.interval_id)
            for t in self.db.scalars(
                select(HabitTracking).where(HabitTracking.date == on_date)
            ).all()
        }

        created = False
        for habit in habits:
            target_codes = (
                [habit.default_interval_code]
                if habit.default_interval_code
                else list(intervals_by_code.keys())
            )
            for code in target_codes:
                if not code:
                    continue
                interval = intervals_by_code.get(code)
                if interval is None:
                    continue
                key = (habit.id, interval.id)
                if key in existing:
                    continue
                self.db.add(
                    HabitTracking(
                        habit_id=habit.id,
                        interval_id=interval.id,
                        date=on_date,
                        is_done=False,
                    )
                )
                existing.add(key)
                created = True

        if created:
            self.db.commit()
