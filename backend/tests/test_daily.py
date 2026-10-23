from datetime import UTC, date, datetime
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from app.daily import daily_statement, day_number, seed_from, server_day
from app.groups import MemoryStore, UpstashStore
from app.main import app, get_reader, get_store
from app.reading import ClaudeReader, ReadingError, ReadingRequest
from app.spec import STAR_TYPE_IDS, STATEMENT_IDS
from tests.test_groups import FakeRedis

client = TestClient(app)


@pytest.fixture
def store():
    s = MemoryStore()
    app.dependency_overrides[get_store] = lambda: s
    yield s
    app.dependency_overrides.pop(get_store, None)


def test_days_and_statements_match_the_frontend():
    assert day_number(date(2026, 10, 1)) == 1
    assert day_number(date(2026, 10, 22)) == 22
    # FNV-1a, as in frontend/src/lib/seed.ts (checked against the same values there).
    assert seed_from("day-1") == 1328657491
    # The same days and ids are asserted in frontend/src/lib/__tests__/daily.test.ts.
    assert [daily_statement(d) for d in (1, 2, 3, 12, 13, 22, 100)] == [
        "parties",
        "art",
        "abstract-interest",
        "vivid-imagination",
        "parties",
        "art",
        "talk-a-lot",
    ]
    for d in range(1, 400):
        assert daily_statement(d) != daily_statement(d - 1)
        assert daily_statement(d) in STATEMENT_IDS
    # Every statement comes round once in each run of twelve days.
    assert sorted(daily_statement(d) for d in range(13, 25)) == sorted(STATEMENT_IDS)


def answer(day: int, response: int = 4, star: str = "pulsar", ip: str = "203.0.113.9"):
    return client.post(
        f"/daily/{day}/answer",
        json={"statement_id": daily_statement(day), "response": response, "star_type": star},
        headers={"x-real-ip": ip},
    )


def test_each_person_counts_once_a_day(store):
    today = server_day()
    first = answer(today, 4)
    assert first.status_code == 200 and first.json()["counted"] is True
    again = answer(today, 1)
    assert again.json()["counted"] is False
    answer(today, 2, "red-dwarf", ip="198.51.100.2")
    body = client.get(f"/daily/{today}").json()
    assert body["answers"] == {"1": 0, "2": 1, "3": 0, "4": 1, "5": 0}
    assert body["stars"]["pulsar"] == 1 and body["stars"]["red-dwarf"] == 1
    assert set(body["stars"]) == set(STAR_TYPE_IDS)
    assert body["statement_id"] == daily_statement(today)


def test_rejects_other_days_statements_and_stars(store):
    today = server_day()
    assert answer(today + 5).status_code == 422
    wrong = next(s for s in STATEMENT_IDS if s != daily_statement(today))
    r = client.post(f"/daily/{today}/answer", json={"statement_id": wrong, "response": 3, "star_type": "pulsar"})
    assert r.status_code == 422
    assert answer(today, star="black-hole").status_code == 422
    assert answer(today, response=6).status_code == 422


def test_daily_needs_a_store():
    app.dependency_overrides[get_store] = lambda: None
    try:
        assert client.get(f"/daily/{server_day()}").status_code == 503
    finally:
        app.dependency_overrides.pop(get_store, None)


def test_upstash_hash_counters():
    redis = FakeRedis()
    s = UpstashStore("https://redis.example", "token", httpx.Client(transport=httpx.MockTransport(redis.handle)))
    s.incr_hash("h", "r4", 60)
    s.incr_hash("h", "r4", 60)
    s.incr_hash("h", "r1")
    assert s.get_hash("h") == {"r4": 2, "r1": 1}
    assert redis.ttl["h"] == 60
    assert s.get_hash("missing") == {}


DAYS = [
    {
        "day": 21,
        "x": 0.4,
        "y": -0.2,
        "z": 0.6,
        "hue": 60,
        "saturation": 0.7,
        "energy": 0.8,
        "statement": "art",
        "response": 5,
    }
]


def test_reading_endpoint(store):
    seen = []
    app.dependency_overrides[get_reader] = lambda: lambda req: seen.append(req) or "Your comet is warming."
    try:
        r = client.post("/reading", json={"days": DAYS, "star_type": "supernova", "streak": 3})
        assert r.status_code == 200 and r.json() == {"reading": "Your comet is warming."}
        assert seen[0].days[0].x == 0.4
        assert client.post("/reading", json={"days": [], "star_type": "supernova", "streak": 3}).status_code == 422

        def fail(req):
            raise ReadingError("No reading today.")

        app.dependency_overrides[get_reader] = lambda: fail
        assert client.post("/reading", json={"days": DAYS, "star_type": "supernova", "streak": 3}).status_code == 502
    finally:
        app.dependency_overrides.pop(get_reader, None)


def test_readings_are_rate_limited(store):
    app.dependency_overrides[get_reader] = lambda: lambda req: "ok"
    try:
        codes = [
            client.post("/reading", json={"days": DAYS, "star_type": "nebula", "streak": 1}).status_code
            for _ in range(21)
        ]
        assert codes[:20] == [200] * 20 and codes[20] == 429
    finally:
        app.dependency_overrides.pop(get_reader, None)


class FakeAnthropic:
    def __init__(self, response):
        self.calls = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))
        self._response = response

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


def test_claude_reader_sends_numbers_only_and_returns_text():
    from app.config import Settings

    text = SimpleNamespace(type="text", text="  A warm drift towards the imaginative. ")
    fake = FakeAnthropic(SimpleNamespace(stop_reason="end_turn", content=[text]))
    reader = ClaudeReader(Settings(llm_model="claude-sonnet-5-5"), client=fake)
    req = ReadingRequest(days=DAYS, star_type="supernova", streak=3)
    assert reader(req) == "A warm drift towards the imaginative."
    sent = fake.calls[0]["messages"][0]["content"]
    assert '"x":0.4' in sent and "supernova" in sent
    assert fake.calls[0]["betas"] == ["server-side-fallback-2026-07-01"]

    refusal = FakeAnthropic(SimpleNamespace(stop_reason="refusal", content=[]))
    with pytest.raises(ReadingError):
        ClaudeReader(Settings(llm_model="claude-sonnet-5-5"), client=refusal)(req)


def test_server_day_uses_utc():
    assert server_day(datetime(2026, 10, 1, 23, 59, tzinfo=UTC)) == 1
