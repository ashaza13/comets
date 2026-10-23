"""The daily orbit: the statement everyone rates each day, and anonymous tallies.

Mirrors frontend/src/lib/daily.ts: days are counted from the same epoch and the
daily statement is picked with the same hash, so server and browser agree.
Tallies hold counts only: no names, ids or answers tied to anyone.
"""

from datetime import UTC, date, datetime

from pydantic import BaseModel, Field, field_validator

from app.spec import STAR_TYPE_IDS, STATEMENT_IDS

EPOCH = date(2026, 10, 1)  # Day 1
# Counted answers and per-day tallies are kept this long.
TALLY_TTL_SECONDS = 40 * 24 * 3600
# One counted answer per client per day; a little over a day absorbs time zones.
ANSWER_WINDOW_SECONDS = 26 * 3600


def day_number(on: date) -> int:
    return (on - EPOCH).days + 1


def server_day(now: datetime | None = None) -> int:
    return day_number((now or datetime.now(UTC)).date())


def seed_from(text: str) -> int:
    """FNV-1a, 32-bit: the same as frontend/src/lib/seed.ts."""
    h = 0x811C9DC5
    for ch in text:
        h = ((h ^ ord(ch)) * 0x01000193) & 0xFFFFFFFF
    return h


def mulberry32(seed: int):
    """The same small PRNG as frontend/src/lib/seed.ts, in 32-bit arithmetic."""
    a = seed & 0xFFFFFFFF

    def imul(x: int, y: int) -> int:
        return (x * y) & 0xFFFFFFFF

    def rand() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = imul(t ^ (t >> 15), t | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return rand


def deck(block: int) -> list[str]:
    """The statements in a seeded shuffled order for one run of days."""
    order = list(STATEMENT_IDS)
    rand = mulberry32(seed_from(f"deck-{block}"))
    for i in range(len(order) - 1, 0, -1):
        j = int(rand() * (i + 1))
        order[i], order[j] = order[j], order[i]
    return order


def daily_statement(day: int) -> str:
    """The statement everyone rates on `day`. The statements are dealt like a
    shuffled deck, one per day, so each comes round once per run of days, and a
    new deck never starts with the card the last one ended on."""
    n = len(STATEMENT_IDS)
    block, index = divmod(day - 1, n)
    order = deck(block)
    if order[0] == deck(block - 1)[-1]:
        order[0], order[1] = order[1], order[0]
    return order[index]


def is_current(day: int, now: datetime | None = None) -> bool:
    """Local days run up to a day either side of the server's UTC day."""
    return abs(day - server_day(now)) <= 1


class DailyAnswer(BaseModel):
    statement_id: str
    response: int = Field(ge=1, le=5)
    star_type: str

    @field_validator("star_type")
    @classmethod
    def _known_star(cls, v: str) -> str:
        if v not in STAR_TYPE_IDS:
            raise ValueError("unknown star type")
        return v


class Tallies(BaseModel):
    day: int
    statement_id: str
    # How many people gave each response (1–5) to the day's statement.
    answers: dict[str, int]
    # Check-ins by star type, across all days.
    stars: dict[str, int]
    # Whether this request was counted (False for a repeat the same day).
    counted: bool = False


def answers_key(day: int) -> str:
    return f"daily:{day}:answers"


STARS_KEY = "daily:stars"


def answered_key(day: int, client: str) -> str:
    return f"daily:{day}:answered:{client}"


def tallies(day: int, answers: dict[str, int], stars: dict[str, int], counted: bool = False) -> Tallies:
    return Tallies(
        day=day,
        statement_id=daily_statement(day),
        answers={str(r): answers.get(f"r{r}", 0) for r in range(1, 6)},
        stars={s: stars.get(s, 0) for s in STAR_TYPE_IDS},
        counted=counted,
    )
