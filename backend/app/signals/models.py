from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field

from app.spec import DOMAIN_IDS

# Built from spec.json so the structured-output schema only offers known domains.
Domain = StrEnum("Domain", {d: d for d in DOMAIN_IDS})


def _clamper(lo: float, hi: float):
    def clamp(v):
        if v is None:
            return None
        return max(lo, min(hi, float(v)))

    return BeforeValidator(clamp)


# Ranges are enforced by clamping rather than rejecting, so a slightly
# out-of-range model value nudges the comet instead of discarding the reading.
Signed = Annotated[float, _clamper(-1.0, 1.0)]
Unit = Annotated[float, _clamper(0.0, 1.0)]
Hue = Annotated[float, BeforeValidator(lambda v: None if v is None else float(v) % 360.0)]


# ── Extractor output (one reading of one message) ──────────────────────────────


class PersonalityReading(BaseModel):
    """Where this text places the writer on each axis, or null when there is no signal."""

    x: Signed | None = Field(None, description="-1 introverted … +1 extroverted, null if no signal")
    y: Signed | None = Field(None, description="-1 concrete … +1 abstract, null if no signal")
    z: Signed | None = Field(None, description="-1 practical … +1 imaginative, null if no signal")


class EmotionReading(BaseModel):
    hue: Hue | None = Field(None, description="0 angry · 60 joyful · 120 calm · 200 reflective · 270 anxious")
    saturation: Unit | None = Field(None, description="0 flat/numb … 1 vivid emotion")
    lightness: Unit | None = Field(None, description="0 depleted … 1 highly energised")


class InterestReading(BaseModel):
    domain: Domain
    depth: Unit = Field(description="0 passing mention … 1 expert-level depth shown in this text")


class Observation(BaseModel):
    personality: PersonalityReading
    emotion: EmotionReading
    interests: list[InterestReading]
    confidence: Unit = Field(description="0 almost no signal … 1 rich, clear signal")
    reasoning: str = Field(description="One short sentence on the primary reading")


# ── Accumulated comet state (owned by the client, sent back on each request) ───


class Vec3(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class EmotionState(BaseModel):
    hue: float = 200.0  # reflective blue
    saturation: float = 0.3
    lightness: float = 0.5


class CometState(BaseModel):
    personality: Vec3 = Field(default_factory=Vec3)
    # Variance of the personality estimate per axis: 1 = knows nothing, → 0 = certain.
    uncertainty: Vec3 = Field(default_factory=lambda: Vec3(x=1.0, y=1.0, z=1.0))
    emotion: EmotionState = Field(default_factory=EmotionState)
    interests: dict[str, float] = Field(default_factory=dict)  # domain -> depth 0–1
    message_count: int = 0


# ── API shapes ─────────────────────────────────────────────────────────────────


class ObserveRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    prompt: str | None = Field(None, max_length=500)
    state: CometState | None = None


class ObserveResponse(BaseModel):
    observation: Observation
    state: CometState
    next_prompt: str | None = None
