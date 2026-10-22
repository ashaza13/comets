from fastapi.testclient import TestClient

from app.main import app, get_extractor
from app.signals.extractor import ExtractionError, build_user_message
from app.signals.models import EmotionReading, InterestReading, Observation, PersonalityReading
from app.spec import PROMPTS

calls = []


def fake_extractor(text, prompt):
    calls.append((text, prompt))
    return Observation(
        personality=PersonalityReading(x=0.5),
        emotion=EmotionReading(hue=60, saturation=0.8, lightness=0.9),
        interests=[InterestReading(domain="science", depth=0.7)],
        confidence=0.9,
        reasoning="Enthusiastic about science.",
    )


def failing_extractor(text, prompt):
    raise ExtractionError("nope")


client = TestClient(app)


def test_observe_without_state_starts_fresh():
    app.dependency_overrides[get_extractor] = lambda: fake_extractor
    r = client.post("/observe", json={"text": "I love telescopes", "prompt": PROMPTS[0]})
    assert r.status_code == 200
    body = r.json()
    assert body["state"]["message_count"] == 1
    assert body["state"]["personality"]["x"] > 0
    assert "science" in body["state"]["interests"]
    assert body["next_prompt"] == PROMPTS[1]
    assert calls[-1] == ("I love telescopes", PROMPTS[0])


def test_observe_round_trips_client_state():
    app.dependency_overrides[get_extractor] = lambda: fake_extractor
    first = client.post("/observe", json={"text": "one"}).json()["state"]
    second = client.post("/observe", json={"text": "two", "state": first}).json()
    assert second["state"]["message_count"] == 2
    assert second["state"]["uncertainty"]["x"] < first["uncertainty"]["x"]


def test_blank_text_rejected():
    app.dependency_overrides[get_extractor] = lambda: fake_extractor
    assert client.post("/observe", json={"text": "   "}).status_code == 422


def test_extraction_error_is_502():
    app.dependency_overrides[get_extractor] = lambda: failing_extractor
    r = client.post("/observe", json={"text": "hello"})
    assert r.status_code == 502 and r.json()["detail"] == "nope"


def test_next_prompt_ends_after_sequence():
    app.dependency_overrides[get_extractor] = lambda: fake_extractor
    state = None
    for _ in range(len(PROMPTS)):
        body = client.post("/observe", json={"text": "x", "state": state}).json()
        state = body["state"]
    assert body["next_prompt"] is None


def test_user_message_includes_question():
    assert "Question asked: Q?" in build_user_message("A", "Q?")
    assert "free writing" in build_user_message("A", None)
