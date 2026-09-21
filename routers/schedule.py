from datetime import date as date_cls

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from models.day_interval import DayInterval
from models.habit import Habit, HabitTracking
from schemas.schedule import DayTimelineOut, PrayerTimesOut
from services.habit_scoring import normalize_status, score_for_status
from services.prayer_service import PrayerFetchError, PrayerParseError, PrayerService
from services.timeline_service import TimelineService

router = APIRouter(prefix="/api", tags=["schedule"])


class HabitTrackingPatch(BaseModel):
    is_done: bool | None = None
    status: str | None = Field(
        default=None, description="pending | done | skipped"
    )
    note: str | None = None


class HabitDayStatusBody(BaseModel):
    """Mark a habit for a calendar day by id or slug (creates tracking if needed)."""

    status: str = Field(description="pending | done | skipped")
    habit_id: int | None = None
    slug: str | None = None
    date: date_cls | None = None
    region: str | None = None
    note: str | None = None


def _apply_status(row: HabitTracking, status: str) -> None:
    row.status = status
    row.is_done = status == "done"


def _tracking_response(row: HabitTracking) -> dict:
    status = row.status or ("done" if row.is_done else "pending")
    score = score_for_status(status)
    return {
        "id": row.id,
        "habit_id": row.habit_id,
        "is_done": row.is_done,
        "status": status,
        "is_skipped": status == "skipped",
        "note": row.note,
        "xp_delta": score["xp_delta"],
        "honor_delta": score["honor_delta"],
        "skip_penalty_factor": 1.3,
    }


@router.get("/prayer-times", response_model=PrayerTimesOut)
def get_prayer_times(
    region: str | None = Query(
        default=None,
        description="Город/регион namozvaqti.uz, например toshkent, samarqand",
    ),
    force_refresh: bool = Query(
        default=False,
        description="Игнорировать суточный кэш и заново запросить namozvaqti.uz",
    ),
    db: Session = Depends(get_db),
) -> PrayerTimesOut:
    settings = get_settings()
    service = PrayerService(db, settings)
    try:
        row, cached = service.get_or_fetch_today(region, force_refresh=force_refresh)
    except PrayerFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except PrayerParseError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return PrayerTimesOut(
        date=row.date,
        region=row.region,
        fajr=row.fajr,
        dhuhr=row.dhuhr,
        asr=row.asr,
        maghrib=row.maghrib,
        isha=row.isha,
        source=row.source,
        fetched_at=row.fetched_at,
        cached=cached,
    )


@router.get("/day-timeline", response_model=DayTimelineOut)
def get_day_timeline(
    region: str | None = Query(
        default=None,
        description="Город/регион namozvaqti.uz, например toshkent",
    ),
    db: Session = Depends(get_db),
) -> DayTimelineOut:
    settings = get_settings()
    service = TimelineService(db, settings)
    try:
        return service.get_day_timeline(region)
    except PrayerFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except PrayerParseError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.patch("/habit-trackings/{tracking_id}")
def patch_habit_tracking(
    tracking_id: int,
    body: HabitTrackingPatch,
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(HabitTracking, tracking_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Habit tracking not found")

    status = normalize_status(
        status=body.status,
        is_done=body.is_done,
        is_skipped=(body.status or "").lower() == "skipped" if body.status else None,
    )
    if body.status is None and body.is_done is None:
        raise HTTPException(
            status_code=422, detail="Provide status or is_done"
        )

    _apply_status(row, status)
    if body.note is not None:
        row.note = body.note
    db.commit()
    db.refresh(row)
    return _tracking_response(row)


@router.post("/habit-day-status")
def set_habit_day_status(
    body: HabitDayStatusBody,
    db: Session = Depends(get_db),
) -> dict:
    """
    Set done / skipped / pending for a habit on a given date.
    Finds or creates today's HabitTracking row — never deletes history.
    """
    status = normalize_status(status=body.status)
    habit: Habit | None = None
    if body.habit_id is not None:
        habit = db.get(Habit, body.habit_id)
    elif body.slug:
        habit = db.scalars(select(Habit).where(Habit.slug == body.slug)).first()
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    settings = get_settings()
    region = body.region or settings.default_region
    on_date = body.date
    if on_date is None:
        from datetime import datetime
        from zoneinfo import ZoneInfo

        on_date = datetime.now(ZoneInfo(settings.timezone)).date()

    # Ensure prayer intervals exist for the day (creates DayInterval rows).
    prayer_service = PrayerService(db, settings)
    try:
        prayer_row, _ = prayer_service.get_or_fetch_today(region)
    except (PrayerFetchError, PrayerParseError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    TimelineService(db, settings)._ensure_habit_trackings(
        on_date, region, list(prayer_row.intervals)
    )

    trackings = list(
        db.scalars(
            select(HabitTracking).where(
                HabitTracking.habit_id == habit.id,
                HabitTracking.date == on_date,
            )
        ).all()
    )
    if not trackings:
        # Attach to default interval or first interval of the day.
        intervals = list(
            db.scalars(
                select(DayInterval)
                .where(DayInterval.date == on_date, DayInterval.region == region)
                .order_by(DayInterval.sort_order)
            ).all()
        )
        target = None
        if habit.default_interval_code:
            target = next(
                (i for i in intervals if i.code == habit.default_interval_code),
                None,
            )
        if target is None and intervals:
            target = intervals[0]
        if target is None:
            raise HTTPException(status_code=404, detail="No day intervals for date")
        row = HabitTracking(
            habit_id=habit.id,
            interval_id=target.id,
            date=on_date,
            is_done=status == "done",
            status=status,
            note=body.note,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _tracking_response(row)

    for row in trackings:
        _apply_status(row, status)
        if body.note is not None:
            row.note = body.note
    db.commit()
    db.refresh(trackings[0])
    return _tracking_response(trackings[0])
