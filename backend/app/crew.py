"""Know your crew: the daily guessing game inside a constellation.

Each day every member answers the day's statement for themselves, then guesses
how a few friends answered it. Answers and guesses are kept per constellation
per day, and both are final once given, so nobody can change their answer after
seeing a guess, or guess again after a reveal. A friend's answer is only shown
to someone who has guessed it.
"""

from pydantic import BaseModel, Field

from app.daily import TALLY_TTL_SECONDS, daily_statement

# Kept as long as the anonymous tallies.
CREW_TTL_SECONDS = TALLY_TTL_SECONDS
# The board adds up this many days, ending today.
WEEK_DAYS = 7
# A skipped statement is stored as this, so guesses on it are void rather than pending.
SKIPPED = 0

# Points for a guess, by how far off it was: exact, then one step away.
POINTS = {0: 3, 1: 1}


def day_key(group_id: str, day: int) -> str:
    return f"crew:{group_id}:{day}"


def answer_field(member_id: str) -> str:
    return f"a:{member_id}"


def guess_field(guesser: str, target: str) -> str:
    return f"g:{guesser}:{target}"


def points(guess: int, actual: int) -> int | None:
    """Points for guessing `guess` when the answer was `actual`; None when the
    friend skipped, so there was nothing to guess."""
    if actual == SKIPPED:
        return None
    return POINTS.get(abs(guess - actual), 0)


class AnswerIn(BaseModel):
    # Null when you skipped today's statement.
    response: int | None = Field(None, ge=1, le=5)


class GuessIn(BaseModel):
    guess: int = Field(ge=1, le=5)


class Guess(BaseModel):
    target: str
    guess: int
    # The friend's answer once they've given it: 0 if they skipped, null while pending.
    actual: int | None
    points: int | None


class BoardRow(BaseModel):
    member_id: str
    today: int
    week: int


class CrewDay(BaseModel):
    day: int
    statement_id: str
    # Who has answered today (not what they said).
    answered: list[str]
    # Your own answer: 1–5, 0 if skipped, null if not given yet.
    my_answer: int | None
    guesses: list[Guess]
    board: list[BoardRow]


def _parse(fields: dict[str, int]) -> tuple[dict[str, int], dict[tuple[str, str], int]]:
    answers: dict[str, int] = {}
    guesses: dict[tuple[str, str], int] = {}
    for field, value in fields.items():
        kind, _, rest = field.partition(":")
        if kind == "a":
            answers[rest] = value
        elif kind == "g":
            guesser, _, target = rest.partition(":")
            guesses[(guesser, target)] = value
    return answers, guesses


def day_points(fields: dict[str, int]) -> dict[str, int]:
    """Each guesser's points for one day, from revealed guesses only."""
    answers, guesses = _parse(fields)
    totals: dict[str, int] = {}
    for (guesser, target), guess in guesses.items():
        actual = answers.get(target)
        p = points(guess, actual) if actual is not None else None
        if p is not None:
            totals[guesser] = totals.get(guesser, 0) + p
    return totals


def crew_day(day: int, me: str, members: list[str], week: list[dict[str, int]]) -> CrewDay:
    """Today as `me` sees it. `week` holds the stored fields for each day of the
    week, oldest first, ending with today."""
    today = week[-1] if week else {}
    answers, guesses = _parse(today)
    mine = [
        Guess(
            target=target,
            guess=guess,
            actual=answers.get(target),
            points=points(guess, answers[target]) if target in answers else None,
        )
        for (guesser, target), guess in guesses.items()
        if guesser == me and target in members
    ]
    per_day = [day_points(fields) for fields in week]
    board = [
        BoardRow(member_id=m, today=per_day[-1].get(m, 0) if per_day else 0, week=sum(d.get(m, 0) for d in per_day))
        for m in members
    ]
    board.sort(key=lambda r: (-r.week, -r.today))
    return CrewDay(
        day=day,
        statement_id=daily_statement(day),
        answered=[m for m in members if m in answers],
        my_answer=answers.get(me),
        guesses=mine,
        board=board,
    )
