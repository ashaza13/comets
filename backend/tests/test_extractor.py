from types import SimpleNamespace

import pytest

from app.config import Settings
from app.signals.extractor import ClaudeExtractor, ExtractionError
from app.signals.models import EmotionReading, Observation, PersonalityReading

READING = Observation(
    personality=PersonalityReading(), emotion=EmotionReading(), interests=[], confidence=0.3, reasoning="r"
)


class FakeMessages:
    def __init__(self, response):
        self.response = response
        self.kwargs = None

    def parse(self, **kwargs):
        self.kwargs = kwargs
        return self.response


def make(response):
    messages = FakeMessages(response)
    client = SimpleNamespace(beta=SimpleNamespace(messages=messages))
    return ClaudeExtractor(Settings(), client=client), messages


def test_returns_parsed_output_and_sends_schema():
    extract, messages = make(SimpleNamespace(stop_reason="end_turn", parsed_output=READING))
    assert extract("hello", "Q?") == READING
    assert messages.kwargs["output_format"] is Observation
    assert messages.kwargs["fallbacks"] == "default"
    assert "Q?" in messages.kwargs["messages"][0]["content"]


def test_refusal_raises():
    extract, _ = make(SimpleNamespace(stop_reason="refusal", parsed_output=None))
    with pytest.raises(ExtractionError):
        extract("hello", None)
