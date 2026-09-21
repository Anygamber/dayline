"""Client and cache layer for namozvaqti.uz prayer schedules."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from config import Settings, get_settings
from models.day_interval import DayInterval
from models.prayer_time import PrayerTime

logger = logging.getLogger(__name__)

# HTML element ids on https://namozvaqti.uz/shahar/{region}
_PRAYER_HTML_IDS = {
    "fajr": "bomdod",
    "sunrise": "quyosh",
    "dhuhr": "peshin",
    "asr": "asr",
    "maghrib": "shom",
    "isha": "hufton",  # site uses "hufton", label is "Xufton"
}

_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")

# Hard constants for Dayline night cycle
XUFTON_HARD_END = time(22, 0)
SUHOOR_BEFORE_FAJR_MINUTES = 40

# 8 cyclic day blocks (display order: Сон → … → Хуфтон)
INTERVAL_DEFINITIONS: tuple[tuple[str, str], ...] = (
    ("son", "Сон"),
    ("suhoor", "Сухур"),
    ("bomdod", "Бомдод"),
    ("avvalo", "Аввало"),
    ("peshin", "Пешин"),
    ("asr", "Аср"),
    ("shom", "Шом"),
    ("xufton", "Хуфтон"),
)


class PrayerServiceError(Exception):
    """Base error for prayer schedule operations."""


class PrayerFetchError(PrayerServiceError):
    """Network / HTTP failure when talking to namozvaqti.uz."""


class PrayerParseError(PrayerServiceError):
    """HTML structure changed or times could not be parsed."""


@dataclass(frozen=True, slots=True)
class PrayerTimesData:
    date: date
    region: str
    fajr: time
    dhuhr: time
    asr: time
    maghrib: time
    isha: time
    sunrise: time | None = None
    source: str = "namozvaqti.uz"


def normalize_region(region: str) -> str:
    slug = region.strip().lower().replace(" ", "").replace("'", "").replace("ʻ", "")
    aliases = {
        "tashkent": "toshkent",
        "ташкент": "toshkent",
        "тошкент": "toshkent",
        "samarkand": "samarqand",
        "fergana": "fargona",
        "farg'ona": "fargona",
        "kokand": "qoqon",
        "qo'qon": "qoqon",
        "bukhara": "buxoro",
    }
    return aliases.get(slug, slug)


def parse_hhmm(value: str) -> time:
    match = _TIME_RE.match(value.strip())
    if not match:
        raise PrayerParseError(f"Invalid time value: {value!r}")
    hour, minute = int(match.group(1)), int(match.group(2))
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise PrayerParseError(f"Time out of range: {value!r}")
    return time(hour=hour, minute=minute)


def _local_today(tz_name: str) -> date:
    return datetime.now(ZoneInfo(tz_name)).date()


def _local_now(tz_name: str) -> datetime:
    return datetime.now(ZoneInfo(tz_name))


class NamozVaqtiClient:
    """Fetches and parses today's prayer times from namozvaqti.uz city pages."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def city_url(self, region: str) -> str:
        return f"{self.settings.namozvaqti_base_url.rstrip('/')}/shahar/{normalize_region(region)}"

    def fetch_html(self, region: str) -> str:
        url = self.city_url(region)
        try:
            with httpx.Client(
                timeout=self.settings.http_timeout_seconds,
                follow_redirects=True,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (compatible; PrayerHabitsBot/1.0; "
                        "+https://namozvaqti.uz)"
                    ),
                    "Accept-Language": "uz,ru;q=0.9,en;q=0.8",
                },
            ) as client:
                response = client.get(url)
                response.raise_for_status()
                return response.text
        except httpx.TimeoutException as exc:
            raise PrayerFetchError(f"Timeout while requesting {url}") from exc
        except httpx.HTTPStatusError as exc:
            raise PrayerFetchError(
                f"namozvaqti.uz returned HTTP {exc.response.status_code} for {url}"
            ) from exc
        except httpx.HTTPError as exc:
            raise PrayerFetchError(f"Network error while requesting {url}: {exc}") from exc

    def parse_times(self, html: str, *, region: str, on_date: date) -> PrayerTimesData:
        soup = BeautifulSoup(html, "html.parser")
        parsed: dict[str, time] = {}

        for key, element_id in _PRAYER_HTML_IDS.items():
            node = soup.find(id=element_id)
            if node is None:
                if key == "sunrise":
                    continue  # optional; fall back in build_interval_specs
                raise PrayerParseError(
                    f"Element id={element_id!r} not found on namozvaqti.uz page "
                    f"(region={region})"
                )
            raw = node.get_text(strip=True)
            try:
                parsed[key] = parse_hhmm(raw)
            except PrayerParseError as exc:
                raise PrayerParseError(
                    f"Failed to parse {key} ({element_id}) value {raw!r}"
                ) from exc

        return PrayerTimesData(
            date=on_date,
            region=normalize_region(region),
            fajr=parsed["fajr"],
            sunrise=parsed.get("sunrise"),
            dhuhr=parsed["dhuhr"],
            asr=parsed["asr"],
            maghrib=parsed["maghrib"],
            isha=parsed["isha"],
        )

    def fetch_today(self, region: str, *, on_date: date | None = None) -> PrayerTimesData:
        region = normalize_region(region)
        on_date = on_date or _local_today(self.settings.timezone)
        html = self.fetch_html(region)
        return self.parse_times(html, region=region, on_date=on_date)


def _add_minutes(t: time, minutes: int) -> time:
    total = (t.hour * 60 + t.minute + minutes) % (24 * 60)
    return time(total // 60, total % 60)


def suhoor_start(fajr: time) -> time:
    """Сухур starts exactly 40 minutes before Бомдод."""
    return _add_minutes(fajr, -SUHOOR_BEFORE_FAJR_MINUTES)


def resolve_sunrise(prayer: PrayerTimesData) -> time:
    if prayer.sunrise is not None:
        return prayer.sunrise
    return _add_minutes(prayer.fajr, 40)


def build_interval_specs(prayer: PrayerTimesData) -> list[dict]:
    """
    8 closed cyclic blocks:

    Хуфтон (isha → 22:00) → Сон (22:00 → сухур) → Сухур → Бомдод →
    Аввало → Пешин → Аср → Шом → Хуфтон …

    Display / sort order starts at Сон (night), then morning→evening→Хуфтон.
    Сон wraps midnight: start=22:00, end=suhoor_start.
    """
    sunrise = resolve_sunrise(prayer)
    suh = suhoor_start(prayer.fajr)
    isha = prayer.isha
    xufton_end = XUFTON_HARD_END

    # If Isha is at/after 22:00, keep a zero-width Хуфтон and start Сон at 22:00.
    if isha >= xufton_end:
        xufton_end = isha

    bounds: list[tuple[str, str, time, time, bool]] = [
        # wraps_midnight
        ("son", "Сон", XUFTON_HARD_END, suh, True),
        ("suhoor", "Сухур", suh, prayer.fajr, False),
        ("bomdod", "Бомдод", prayer.fajr, sunrise, False),
        ("avvalo", "Аввало", sunrise, prayer.dhuhr, False),
        ("peshin", "Пешин", prayer.dhuhr, prayer.asr, False),
        ("asr", "Аср", prayer.asr, prayer.maghrib, False),
        ("shom", "Шом", prayer.maghrib, isha, False),
        ("xufton", "Хуфтон", isha, xufton_end, False),
    ]

    specs: list[dict] = []
    for order, (code, label, start, end, wraps) in enumerate(bounds):
        specs.append(
            {
                "code": code,
                "label": label,
                "start_time": start,
                "end_time": end,
                "sort_order": order,
                "wraps_midnight": wraps,
            }
        )
    return specs


def is_time_in_interval(
    now: time,
    start: time,
    end: time,
    *,
    wraps_midnight: bool = False,
    inclusive_end: bool = False,
) -> bool:
    """Inclusive start, exclusive end; sleep wraps across midnight."""
    if wraps_midnight:
        # e.g. 22:00 → 04:10 : active if now >= 22:00 OR now < 04:10
        return now >= start or now < end
    if inclusive_end:
        return start <= now <= end
    return start <= now < end


def find_current_interval_code(prayer: PrayerTimesData, now: time) -> str | None:
    specs = build_interval_specs(prayer)
    for spec in specs:
        if is_time_in_interval(
            now,
            spec["start_time"],
            spec["end_time"],
            wraps_midnight=bool(spec.get("wraps_midnight")),
        ):
            return spec["code"]
    return None


NEXT_PRAYER_SEQUENCE: tuple[tuple[str, str], ...] = (
    ("fajr", "Бомдод"),
    ("dhuhr", "Пешин"),
    ("asr", "Аср"),
    ("maghrib", "Шом"),
    ("isha", "Хуфтон"),
)


def next_prayer_info(prayer: PrayerTimesData, now: time) -> dict | None:
    for key, label in NEXT_PRAYER_SEQUENCE:
        t = getattr(prayer, key)
        if now < t:
            now_m = now.hour * 60 + now.minute
            t_m = t.hour * 60 + t.minute
            return {
                "code": key,
                "label": label,
                "time": t,
                "minutes_remaining": t_m - now_m,
            }
    # After Isha → next is tomorrow's Fajr (show tonight remaining conceptually)
    fajr_m = prayer.fajr.hour * 60 + prayer.fajr.minute + 24 * 60
    now_m = now.hour * 60 + now.minute
    return {
        "code": "fajr",
        "label": "Бомдод (завтра)",
        "time": prayer.fajr,
        "minutes_remaining": fajr_m - now_m,
    }


class PrayerService:
    """
    Resolves today's prayer times with SQLite day-level cache.

    Cache key: (date, region). On cache miss the service hits namozvaqti.uz once,
    stores prayer_times + day_intervals, then reuses the row for the rest of the day.
    """

    def __init__(
        self,
        db: Session,
        settings: Settings | None = None,
        client: NamozVaqtiClient | None = None,
    ) -> None:
        self.db = db
        self.settings = settings or get_settings()
        self.client = client or NamozVaqtiClient(self.settings)

    def get_or_fetch_today(
        self,
        region: str | None = None,
        *,
        force_refresh: bool = False,
    ) -> tuple[PrayerTime, bool]:
        """
        Return (prayer_time_row, cached).

        `cached=True` means the row was already in SQLite for today's date.
        """
        region = normalize_region(region or self.settings.default_region)
        today = _local_today(self.settings.timezone)

        if not force_refresh:
            existing = self._get_cached(today, region)
            codes = {i.code for i in (existing.intervals if existing else [])}
            if existing is not None and len(existing.intervals) >= 8 and "son" in codes:
                logger.debug("Prayer cache hit for %s %s", today, region)
                return existing, True

        data = self.client.fetch_today(region, on_date=today)
        row = self._upsert(data)
        return row, False

    def _get_cached(self, on_date: date, region: str) -> PrayerTime | None:
        stmt = (
            select(PrayerTime)
            .where(PrayerTime.date == on_date, PrayerTime.region == region)
            .options(selectinload(PrayerTime.intervals))
        )
        return self.db.scalars(stmt).first()

    def _upsert(self, data: PrayerTimesData) -> PrayerTime:
        existing = self._get_cached(data.date, data.region)
        now_utc = datetime.now(timezone.utc)

        if existing is None:
            row = PrayerTime(
                date=data.date,
                region=data.region,
                fajr=data.fajr,
                dhuhr=data.dhuhr,
                asr=data.asr,
                maghrib=data.maghrib,
                isha=data.isha,
                source=data.source,
                fetched_at=now_utc,
            )
            self.db.add(row)
            self.db.flush()
        else:
            row = existing
            row.fajr = data.fajr
            row.dhuhr = data.dhuhr
            row.asr = data.asr
            row.maghrib = data.maghrib
            row.isha = data.isha
            row.source = data.source
            row.fetched_at = now_utc
            # Replace intervals on refresh
            for interval in list(row.intervals):
                self.db.delete(interval)
            self.db.flush()

        for spec in build_interval_specs(data):
            self.db.add(
                DayInterval(
                    prayer_time_id=row.id,
                    date=data.date,
                    region=data.region,
                    code=spec["code"],
                    label=spec["label"],
                    start_time=spec["start_time"],
                    end_time=spec["end_time"],
                    sort_order=spec["sort_order"],
                )
            )

        self.db.commit()
        self.db.refresh(row)
        # reload intervals
        return self._get_cached(data.date, data.region) or row

    def to_data(self, row: PrayerTime) -> PrayerTimesData:
        return PrayerTimesData(
            date=row.date,
            region=row.region,
            fajr=row.fajr,
            dhuhr=row.dhuhr,
            asr=row.asr,
            maghrib=row.maghrib,
            isha=row.isha,
            source=row.source,
        )
