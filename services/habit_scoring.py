"""Habit completion / skip scoring (honor + XP deltas)."""

from __future__ import annotations

# Skip penalty is 30% harsher than the positive reward for the same habit.
SKIP_PENALTY_FACTOR = 1.3

# Default reward weights when habit has no importance metadata on the server.
DEFAULT_SUCCESS_XP = 10
DEFAULT_SUCCESS_HONOR = 1


def score_for_status(
    status: str,
    *,
    success_xp: int = DEFAULT_SUCCESS_XP,
    success_honor: int = DEFAULT_SUCCESS_HONOR,
) -> dict[str, int | str]:
    """
    Return xp_delta / honor_delta for a day-status transition target.

    - done: +success_xp, +success_honor
    - skipped: −success × 1.3 (rounded)
    - pending: 0 (clear mark)
    """
    status = (status or "pending").strip().lower()
    if status == "done":
        return {
            "status": "done",
            "xp_delta": int(success_xp),
            "honor_delta": int(success_honor),
        }
    if status == "skipped":
        return {
            "status": "skipped",
            "xp_delta": -int(round(success_xp * SKIP_PENALTY_FACTOR)),
            "honor_delta": -int(round(max(1, success_honor) * SKIP_PENALTY_FACTOR)),
        }
    return {"status": "pending", "xp_delta": 0, "honor_delta": 0}


def normalize_status(
    *,
    status: str | None = None,
    is_done: bool | None = None,
    is_skipped: bool | None = None,
) -> str:
    if status:
        s = status.strip().lower()
        if s in ("done", "skipped", "pending"):
            return s
    if is_skipped:
        return "skipped"
    if is_done is True:
        return "done"
    if is_done is False and is_skipped is False:
        return "pending"
    if is_done is False:
        return "pending"
    return "pending"
