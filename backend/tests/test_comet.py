from hypothesis import given
from hypothesis import strategies as st

from app.comet import apply_observation
from app.signals.models import CometState, EmotionReading, InterestReading, Observation, PersonalityReading


def obs(x=None, y=None, z=None, confidence=0.8, interests=(), hue=None, sat=None, light=None):
    return Observation(
        personality=PersonalityReading(x=x, y=y, z=z),
        emotion=EmotionReading(hue=hue, saturation=sat, lightness=light),
        interests=[InterestReading(domain=d, depth=v) for d, v in interests],
        confidence=confidence,
        reasoning="test",
    )


def test_repeated_readings_converge_to_reading_not_bound():
    state = CometState()
    for _ in range(30):
        state = apply_observation(state, obs(x=-0.6))
    assert abs(state.personality.x + 0.6) < 0.02


def test_null_axis_leaves_position_unchanged():
    state = apply_observation(CometState(), obs(x=0.5))
    after = apply_observation(state, obs(y=0.3))
    assert after.personality.x == state.personality.x
    assert after.uncertainty.x > state.uncertainty.x  # process noise only


def test_uncertainty_shrinks_with_evidence():
    state = CometState()
    for _ in range(5):
        state = apply_observation(state, obs(x=0.2, y=0.2, z=0.2))
    assert state.uncertainty.x < 0.3


def test_low_confidence_moves_less():
    strong = apply_observation(CometState(), obs(x=1.0, confidence=1.0))
    weak = apply_observation(CometState(), obs(x=1.0, confidence=0.1))
    assert weak.personality.x < strong.personality.x


def test_hue_wraps_the_short_way():
    state = CometState()
    state.emotion.hue = 350
    after = apply_observation(state, obs(hue=10, confidence=1.0))
    assert after.emotion.hue > 350 or after.emotion.hue < 10


def test_interests_grow_and_fade():
    state = apply_observation(CometState(), obs(interests=[("music", 0.9)]))
    grown = state.interests["music"]
    assert grown > 0
    faded = apply_observation(state, obs())
    assert faded.interests["music"] < grown


def test_message_count_increments():
    assert apply_observation(CometState(), obs()).message_count == 1


readings = st.one_of(st.none(), st.floats(-1, 1))
units = st.one_of(st.none(), st.floats(0, 1))


@given(
    st.lists(
        st.tuples(readings, readings, readings, st.floats(0, 1), units, units, st.floats(0, 1)),
        max_size=25,
    )
)
def test_state_stays_in_range(steps):
    state = CometState()
    for x, y, z, conf, sat, light, depth in steps:
        state = apply_observation(
            state, obs(x=x, y=y, z=z, confidence=conf, sat=sat, light=light, hue=200, interests=[("art", depth)])
        )
    for axis in ("x", "y", "z"):
        assert -1.0 <= getattr(state.personality, axis) <= 1.0
        assert 0.0 <= getattr(state.uncertainty, axis) <= 1.0
    assert 0.0 <= state.emotion.hue < 360
    assert 0.0 <= state.emotion.saturation <= 1.0
    assert 0.0 <= state.emotion.lightness <= 1.0
    assert all(0.0 <= v <= 1.0 for v in state.interests.values())
