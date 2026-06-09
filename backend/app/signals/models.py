from pydantic import BaseModel, Field
from typing import Optional


class PersonalityDelta(BaseModel):
    x: float = Field(0.0, ge=-1.0, le=1.0)  # social: introvert <-> extrovert
    y: float = Field(0.0, ge=-1.0, le=1.0)  # cognitive: concrete <-> abstract
    z: float = Field(0.0, ge=-1.0, le=1.0)  # engagement: analytical <-> creative


class EmotionTarget(BaseModel):
    # Targets in HSL space; null means "no signal, don't update"
    hue: Optional[float] = Field(None, ge=0.0, le=360.0)
    saturation: Optional[float] = Field(None, ge=0.0, le=1.0)
    lightness: Optional[float] = Field(None, ge=0.0, le=1.0)


class InterestDelta(BaseModel):
    domain: str
    depth_delta: float = Field(..., ge=-1.0, le=1.0)


class SignalDeltas(BaseModel):
    personality: PersonalityDelta
    emotion: EmotionTarget
    interests: list[InterestDelta]
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: str


# ── Accumulated state ──────────────────────────────────────────────────────────

class PersonalityPosition(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class EmotionState(BaseModel):
    hue: float = 200.0       # default: reflective blue
    saturation: float = 0.3
    lightness: float = 0.5


class HistoryEntry(BaseModel):
    input_text: str
    deltas: SignalDeltas


class SessionState(BaseModel):
    session_id: str
    personality: PersonalityPosition = PersonalityPosition()
    emotion: EmotionState = EmotionState()
    interests: dict[str, float] = {}   # domain -> depth score, clamped 0–3
    history: list[HistoryEntry] = []
    message_count: int = 0


# ── API shapes ─────────────────────────────────────────────────────────────────

class CreateSessionResponse(BaseModel):
    session_id: str


class MessageRequest(BaseModel):
    text: str


class MessageResponse(BaseModel):
    deltas: SignalDeltas
    state: SessionState
    prompt_suggestion: Optional[str] = None  # next conversational prompt to show user
