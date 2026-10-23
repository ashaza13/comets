"""The daily reading: a short, horoscope-flavoured note on how your orbit is moving.

Claude sees numbers only (positions, moods and ratings for up to two weeks),
never names or anything anyone wrote.
"""

import json
from typing import Annotated, Protocol

import anthropic
from pydantic import BaseModel, BeforeValidator, Field

from app.config import Settings
from app.signals.extractor import _FALLBACK_MODELS
from app.spec import AXES, STAR_TYPE_IDS, STATEMENT_IDS


def _clamp(lo: float, hi: float):
    return BeforeValidator(lambda v: max(lo, min(hi, float(v))))


Signed = Annotated[float, _clamp(-1.0, 1.0)]
Unit = Annotated[float, _clamp(0.0, 1.0)]


class DayReading(BaseModel):
    day: int
    x: Signed
    y: Signed
    z: Signed
    hue: Annotated[float, BeforeValidator(lambda v: float(v) % 360.0)]
    saturation: Unit
    energy: Unit
    statement: str | None = None
    response: int | None = Field(None, ge=1, le=5)


class ReadingRequest(BaseModel):
    days: list[DayReading] = Field(min_length=1, max_length=14)
    star_type: str = Field(pattern="^[a-z-]+$")
    streak: int = Field(ge=0, le=3650)


class ReadingResponse(BaseModel):
    reading: str


class ReadingError(RuntimeError):
    pass


class Reader(Protocol):
    def __call__(self, request: ReadingRequest) -> str: ...


_axis_lines = "\n".join(f"  {a['key']}: -1 = {a['negative']}, +1 = {a['positive']}" for a in AXES)

SYSTEM_PROMPT = f"""\
You write the daily reading for a personality comet: a playful, horoscope-flavoured
note on how someone's comet has been moving, grounded strictly in their numbers.

Each day has a position on three axes (−1 to +1):
{_axis_lines}
and a mood: hue (0 angry · 60 joyful · 120 calm · 200 reflective · 270 anxious),
saturation (intensity) and energy (0 depleted … 1 buzzing). Some days include
a statement they rated from 1 (very inaccurate) to 5 (very accurate).
Statement ids: {", ".join(STATEMENT_IDS)}.
Star types: {", ".join(STAR_TYPE_IDS)}.

Write two or three sentences, at most 60 words, in the second person. Use cosmic
imagery lightly. Point to real patterns (a mood that has warmed for three days,
energy dipping, drifting towards imaginative) and today's mood. Never predict
events, give advice about health or relationships, or make clinical claims; this
is a reflection, not a forecast. Plain text only: no headings, lists or emoji.
"""


def build_message(request: ReadingRequest) -> str:
    return "Their orbit, oldest day first:\n" + json.dumps(request.model_dump(), separators=(",", ":"))


class ClaudeReader:
    def __init__(self, settings: Settings, client: anthropic.Anthropic | None = None):
        self._settings = settings
        self._client = client or anthropic.Anthropic()

    def __call__(self, request: ReadingRequest) -> str:
        s = self._settings
        fallback = (
            {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
            if s.llm_model in _FALLBACK_MODELS
            else {}
        )
        try:
            response = self._client.beta.messages.create(
                model=s.llm_model,
                max_tokens=400,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": build_message(request)}],
                output_config={"effort": "low"},
                **fallback,
            )
        except anthropic.RateLimitError as e:
            raise ReadingError("The stars are busy right now — try again in a moment.") from e
        except anthropic.APIStatusError as e:
            raise ReadingError(f"Reading request failed ({e.status_code}).") from e
        except anthropic.APIConnectionError as e:
            raise ReadingError("Could not reach the model provider.") from e

        if response.stop_reason == "refusal":
            raise ReadingError("No reading today.")
        text = " ".join(b.text for b in response.content if getattr(b, "type", None) == "text").strip()
        if not text:
            raise ReadingError("No reading today.")
        return text
