from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from models.habit import HabitTracking
from schemas.schedule import DayTimelineOut, PrayerTimesOut
from services.prayer_service import PrayerFetchError, PrayerParseError, PrayerService
from services.timeline_service import TimelineService

router = APIRouter(prefix="/api", tags=["schedule"])


class HabitTrackingPatch(BaseModel):
    is_done: bool
    note: str | None = None


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
    row.is_done = body.is_done
    if body.note is not None:
        row.note = body.note
    db.commit()
    return {"id": row.id, "is_done": row.is_done, "note": row.note}
