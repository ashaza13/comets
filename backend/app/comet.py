"""Pure state update: fold one Observation into the accumulated CometState."""

from app.signals.models import CometState, EmotionState, Observation, Vec3

# Personality is estimated with a per-axis scalar Kalman filter. Each reading is
# treated as a noisy measurement of where the person sits; low confidence means
# a noisier measurement and therefore a smaller step.
_MEASUREMENT_NOISE = 0.5
# Added to the variance each message so the estimate never freezes — people move.
_PROCESS_NOISE = 0.01
_MIN_CONFIDENCE = 0.05

_EMOTION_RATE = 0.45  # emotion is a state, so it follows readings quickly
_INTEREST_RATE = 0.5  # how far a fully-confident, fully-deep reading closes the gap to 1
_INTEREST_DECAY = 0.97  # unmentioned interests fade slowly
_INTEREST_FLOOR = 0.01  # below this a domain is dropped


def _kalman(estimate: float, variance: float, reading: float | None, confidence: float) -> tuple[float, float]:
    variance += _PROCESS_NOISE
    if reading is None or confidence <= 0:
        return estimate, min(variance, 1.0)
    noise = _MEASUREMENT_NOISE / max(confidence, _MIN_CONFIDENCE)
    gain = variance / (variance + noise)
    return estimate + gain * (reading - estimate), (1 - gain) * variance


def _lerp(current: float, target: float | None, t: float) -> float:
    return current if target is None else current + (target - current) * t


def _lerp_hue(current: float, target: float | None, t: float) -> float:
    if target is None:
        return current
    diff = ((target - current + 180) % 360) - 180
    return (current + diff * t) % 360


def apply_observation(state: CometState, obs: Observation) -> CometState:
    c = obs.confidence

    position, variance = {}, {}
    for axis in ("x", "y", "z"):
        position[axis], variance[axis] = _kalman(
            getattr(state.personality, axis),
            getattr(state.uncertainty, axis),
            getattr(obs.personality, axis),
            c,
        )

    rate = _EMOTION_RATE * c
    em, target = state.emotion, obs.emotion
    emotion = EmotionState(
        hue=_lerp_hue(em.hue, target.hue, rate),
        saturation=_lerp(em.saturation, target.saturation, rate),
        lightness=_lerp(em.lightness, target.lightness, rate),
    )

    interests = {d: v * _INTEREST_DECAY for d, v in state.interests.items()}
    for reading in obs.interests:
        current = interests.get(reading.domain.value, 0.0)
        interests[reading.domain.value] = current + (1.0 - current) * reading.depth * c * _INTEREST_RATE
    interests = {d: v for d, v in interests.items() if v >= _INTEREST_FLOOR}

    return CometState(
        personality=Vec3(**position),
        uncertainty=Vec3(**variance),
        emotion=emotion,
        interests=interests,
        message_count=state.message_count + 1,
    )
