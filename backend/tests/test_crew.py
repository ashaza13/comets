import httpx
import pytest
from fastapi.testclient import TestClient

from app.crew import crew_day, day_points, points
from app.daily import daily_statement, server_day
from app.groups import MemoryStore, UpstashStore, public_id
from app.main import app, get_store
from app.signals.models import CometState
from tests.test_groups import FakeRedis

client = TestClient(app)
A, B, C = "a" * 24, "b" * 24, "c" * 24


@pytest.fixture
def store():
    s = MemoryStore()
    app.dependency_overrides[get_store] = lambda: s
    yield s
    app.dependency_overrides.pop(get_store, None)


def crew(*names_and_secrets: tuple[str, str]) -> str:
    group_id = client.post("/groups").json()["id"]
    for name, secret in names_and_secrets:
        client.put(f"/groups/{group_id}/members/{secret}", json={"name": name, "state": CometState().model_dump()})
    return group_id


def url(group_id: str, secret: str, day: int | None = None) -> str:
    return f"/groups/{group_id}/members/{secret}/days/{day or server_day()}"


def test_points():
    assert points(4, 4) == 3
    assert points(3, 4) == 1
    assert points(1, 4) == 0
    # A skipped answer can't be guessed.
    assert points(4, 0) is None


def test_answer_then_guess_then_reveal(store):
    g = crew(("Ahmed", A), ("Sara", B), ("Lee", C))
    a, b, c = (public_id(g, s) for s in (A, B, C))

    # You answer before you guess.
    assert client.put(f"{url(g, A)}/guesses/{b}", json={"guess": 4}).status_code == 409
    r = client.put(f"{url(g, A)}/answer", json={"response": 2}).json()
    assert r["my_answer"] == 2 and r["answered"] == [a]
    assert r["statement_id"] == daily_statement(server_day())

    # A guess on a friend who hasn't answered stays pending.
    r = client.put(f"{url(g, A)}/guesses/{b}", json={"guess": 4}).json()
    assert r["guesses"] == [{"target": b, "guess": 4, "actual": None, "points": None}]

    # Once they answer, it's revealed and scored.
    client.put(f"{url(g, B)}/answer", json={"response": 5})
    r = client.get(url(g, A)).json()
    assert r["guesses"] == [{"target": b, "guess": 4, "actual": 5, "points": 1}]

    # Answers and guesses are final.
    client.put(f"{url(g, B)}/answer", json={"response": 4})
    client.put(f"{url(g, A)}/guesses/{b}", json={"guess": 5})
    assert client.get(url(g, A)).json()["guesses"][0] == {"target": b, "guess": 4, "actual": 5, "points": 1}

    # Sara guesses Ahmed exactly; Lee never answered.
    client.put(f"{url(g, B)}/guesses/{a}", json={"guess": 2})
    client.put(f"{url(g, B)}/guesses/{c}", json={"guess": 3})
    r = client.get(url(g, B)).json()
    assert {x["target"]: x["points"] for x in r["guesses"]} == {a: 3, c: None}
    board = {row["member_id"]: row for row in r["board"]}
    assert board[b]["today"] == 3 and board[a]["today"] == 1 and board[c]["today"] == 0
    assert [row["member_id"] for row in r["board"]][0] == b


def test_answers_are_only_shown_to_those_who_guessed(store):
    g = crew(("Ahmed", A), ("Sara", B), ("Lee", C))
    b = public_id(g, B)
    client.put(f"{url(g, B)}/answer", json={"response": 5})
    r = client.get(url(g, C)).json()
    # Lee sees that Sara answered, not what she said.
    assert r["answered"] == [b] and r["guesses"] == [] and r["my_answer"] is None
    assert "5" not in str(r["answered"])


def test_skips_void_guesses(store):
    g = crew(("Ahmed", A), ("Sara", B))
    a, b = public_id(g, A), public_id(g, B)
    client.put(f"{url(g, A)}/answer", json={"response": None})
    client.put(f"{url(g, B)}/answer", json={"response": 3})
    r = client.put(f"{url(g, B)}/guesses/{a}", json={"guess": 3}).json()
    assert r["guesses"] == [{"target": a, "guess": 3, "actual": 0, "points": None}]
    assert client.get(url(g, A)).json()["my_answer"] == 0
    assert b in client.get(url(g, A)).json()["answered"]


def test_rejections(store):
    g = crew(("Ahmed", A), ("Sara", B))
    a = public_id(g, A)
    client.put(f"{url(g, A)}/answer", json={"response": 3})
    # Not yourself, not strangers, not outsiders, not other days, not out-of-range guesses.
    assert client.put(f"{url(g, A)}/guesses/{a}", json={"guess": 3}).status_code == 422
    assert client.put(f"{url(g, A)}/guesses/{'f' * 12}", json={"guess": 3}).status_code == 422
    assert client.put(f"{url(g, 'd' * 24)}/answer", json={"response": 3}).status_code == 403
    assert client.get(url(g, "d" * 24)).status_code == 403
    assert client.put(f"{url(g, A, server_day() + 5)}/answer", json={"response": 3}).status_code == 422
    assert client.put(f"{url(g, A)}/guesses/{public_id(g, B)}", json={"guess": 6}).status_code == 422
    assert client.get(url("abcdefghij", A)).status_code == 404


def test_the_week_adds_up():
    today = {"a:x": 4, "a:y": 2, "g:x:y": 2, "g:y:x": 3}
    yesterday = {"a:x": 1, "a:y": 5, "g:x:y": 5}
    assert day_points(today) == {"x": 3, "y": 1}
    r = crew_day(30, "x", ["x", "y", "gone"], [yesterday, today])
    assert [(row.member_id, row.today, row.week) for row in r.board] == [("x", 3, 6), ("y", 1, 1), ("gone", 0, 0)]
    # Guesses on someone who has left aren't listed.
    assert crew_day(30, "x", ["x"], [today]).guesses == []


def test_upstash_set_once_and_read_many():
    redis = FakeRedis()
    s = UpstashStore("https://redis.example", "token", httpx.Client(transport=httpx.MockTransport(redis.handle)))
    assert s.set_hash_nx("d1", "a:x", 4, 60) is True
    assert s.set_hash_nx("d1", "a:x", 2, 60) is False
    assert s.get_hashes(["d0", "d1"]) == [{}, {"a:x": 4}]
    assert redis.ttl["d1"] == 60
    assert s.get_hashes([]) == []
