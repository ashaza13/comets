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
# How well you know each friend (and they you) adds up over this many days.
BOND_DAYS = 30
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


class Bond(BaseModel):
    """How well you and one friend know each other, over the last BOND_DAYS."""

    member_id: str
    # Your points guessing them, out of the most you could have scored.
    you_know: int
    you_max: int
    # Their points guessing you.
    knows_you: int
    knows_you_max: int


class CrewDay(BaseModel):
    day: int
    statement_id: str
    # Who has answered today (not what they said).
    answered: list[str]
    # Your own answer: 1–5, 0 if skipped, null if not given yet.
    my_answer: int | None
    guesses: list[Guess]
    board: list[BoardRow]
    bonds: list[Bond]


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


def _pair_scores(fields: dict[str, int]) -> dict[tuple[str, str], tuple[int, int]]:
    """(points, most possible) for each guesser→target pair revealed on one day."""
    answers, guesses = _parse(fields)
    scores: dict[tuple[str, str], tuple[int, int]] = {}
    for pair, guess in guesses.items():
        actual = answers.get(pair[1])
        p = points(guess, actual) if actual is not None else None
        if p is not None:
            scores[pair] = (p, max(POINTS.values()))
    return scores


def crew_day(day: int, me: str, members: list[str], history: list[dict[str, int]]) -> CrewDay:
    """Today as `me` sees it. `history` holds the stored fields for each day,
    oldest first, ending with today."""
    today = history[-1] if history else {}
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
    week = [day_points(fields) for fields in history[-WEEK_DAYS:]]
    board = [
        BoardRow(member_id=m, today=week[-1].get(m, 0) if week else 0, week=sum(d.get(m, 0) for d in week))
        for m in members
    ]
    board.sort(key=lambda r: (-r.week, -r.today))

    totals: dict[tuple[str, str], list[int]] = {}
    for fields in history[-BOND_DAYS:]:
        for pair, (p, most) in _pair_scores(fields).items():
            if me in pair:
                t = totals.setdefault(pair, [0, 0])
                t[0] += p
                t[1] += most
    bonds = []
    for m in members:
        if m == me:
            continue
        you = totals.get((me, m), [0, 0])
        them = totals.get((m, me), [0, 0])
        bonds.append(Bond(member_id=m, you_know=you[0], you_max=you[1], knows_you=them[0], knows_you_max=them[1]))

    return CrewDay(
        day=day,
        statement_id=daily_statement(day),
        answered=[m for m in members if m in answers],
        my_answer=answers.get(me),
        guesses=mine,
        board=board,
        bonds=bonds,
    )
