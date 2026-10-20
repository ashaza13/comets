import pytest
from pydantic import ValidationError

from app.signals.models import Observation


def test_out_of_range_values_are_clamped():
    o = Observation.model_validate(
        {
            "personality": {"x": 1.7, "y": -3, "z": None},
            "emotion": {"hue": 400, "saturation": 1.4, "lightness": -0.2},
            "interests": [{"domain": "music", "depth": 2}],
            "confidence": 1.2,
            "reasoning": "r",
        }
    )
    assert o.personality.x == 1.0 and o.personality.y == -1.0 and o.personality.z is None
    assert o.emotion.hue == 40 and o.emotion.saturation == 1.0 and o.emotion.lightness == 0.0
    assert o.interests[0].depth == 1.0 and o.confidence == 1.0


def test_unknown_domain_rejected():
    with pytest.raises(ValidationError):
        Observation.model_validate(
            {
                "personality": {},
                "emotion": {},
                "interests": [{"domain": "astrology", "depth": 0.5}],
                "confidence": 0.5,
                "reasoning": "r",
            }
        )
