import math
import uuid
from app.signals.models import (
    SessionState,
    SignalDeltas,
    PersonalityPosition,
    EmotionState,
    HistoryEntry,
)

# In-memory store; replace with Redis/DB for persistence across restarts
_sessions: dict[str, SessionState] = {}

# How strongly each new message pulls the accumulated state toward its signal.
# Lower = more inertia (early messages dominate less).
_PERSONALITY_LR = 0.25
_EMOTION_LR = 0.35
_INTEREST_LR = 0.30
_INTEREST_MAX_DEPTH = 3.0


# ── Conversation phase prompts ─────────────────────────────────────────────────

_PHASE_PROMPTS = [
    # 0 – Calibrate (emotional state, low stakes)
    "What's been on your mind lately? Could be anything — work, something you saw, a feeling you can't shake.",
    "How has your energy been recently? What's been pulling at your attention?",
    # 2 – Surface (interests, richest language)
    "Tell me about something you know deeply — explain it to a curious friend who's never heard of it.",
    "What's something you've been genuinely excited about recently, even if it seems small?",
    # 4 – Anchor (values, personality)
    "Who do you deeply admire, and what exactly is it about them that gets to you?",
    "What would you do with a completely unexpected free week — no obligations, no guilt?",
    # 6 – Direct (trajectory)
    "Where do you feel you're headed right now? What's pulling you forward?",
]


def _get_prompt_suggestion(message_count: int) -> str | None:
    idx = min(message_count, len(_PHASE_PROMPTS) - 1)
    return _PHASE_PROMPTS[idx] if message_count < len(_PHASE_PROMPTS) else None


# ── Hue interpolation (circular) ───────────────────────────────────────────────

def _lerp_hue(current: float, target: float, t: float) -> float:
    diff = ((target - current + 180) % 360) - 180
    return (current + diff * t) % 360


def _lerp(current: float, target: float, t: float) -> float:
    return current + (target - current) * t


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# ── State mutation ─────────────────────────────────────────────────────────────

def apply_deltas(state: SessionState, deltas: SignalDeltas) -> SessionState:
    c = deltas.confidence

    # Personality — shift current position by delta * learning_rate * confidence
    p = state.personality
    d = deltas.personality
    state.personality = PersonalityPosition(
        x=_clamp(p.x + d.x * _PERSONALITY_LR * c, -1.0, 1.0),
        y=_clamp(p.y + d.y * _PERSONALITY_LR * c, -1.0, 1.0),
        z=_clamp(p.z + d.z * _PERSONALITY_LR * c, -1.0, 1.0),
    )

    # Emotion — blend toward target values where signal was present
    em = state.emotion
    t = deltas.emotion
    lr = _EMOTION_LR * c
    state.emotion = EmotionState(
        hue=_lerp_hue(em.hue, t.hue, lr) if t.hue is not None else em.hue,
        saturation=_lerp(em.saturation, t.saturation, lr) if t.saturation is not None else em.saturation,
        lightness=_lerp(em.lightness, t.lightness, lr) if t.lightness is not None else em.lightness,
    )

    # Interests — add delta to accumulated depth, clamp 0–max
    for interest in deltas.interests:
        current = state.interests.get(interest.domain, 0.0)
        updated = _clamp(
            current + interest.depth_delta * _INTEREST_LR * c,
            0.0,
            _INTEREST_MAX_DEPTH,
        )
        state.interests[interest.domain] = updated

    return state


# ── CRUD ───────────────────────────────────────────────────────────────────────

def create_session() -> SessionState:
    session_id = str(uuid.uuid4())
    state = SessionState(session_id=session_id)
    _sessions[session_id] = state
    return state


def get_session(session_id: str) -> SessionState | None:
    return _sessions.get(session_id)


def update_session(session_id: str, text: str, deltas: SignalDeltas) -> SessionState:
    state = _sessions[session_id]
    state = apply_deltas(state, deltas)
    state.history.append(HistoryEntry(input_text=text, deltas=deltas))
    state.message_count += 1
    _sessions[session_id] = state
    return state


def get_prompt_suggestion(session_id: str) -> str | None:
    state = _sessions.get(session_id)
    if state is None:
        return None
    return _get_prompt_suggestion(state.message_count)
