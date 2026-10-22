import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.groups import MAX_MEMBERS, Member, MemberIn, MemoryStore, UpstashStore, public_id, to_member
from app.main import app, get_store
from app.signals.models import CometState

client = TestClient(app)
SECRET_A = "a" * 24
SECRET_B = "b" * 24


def state(x: float = 0.5, **interests: float) -> dict:
    return CometState(personality={"x": x, "y": -0.2, "z": 0.1}, interests=interests).model_dump()


@pytest.fixture
def store():
    s = MemoryStore()
    app.dependency_overrides[get_store] = lambda: s
    yield s
    app.dependency_overrides.pop(get_store, None)


def test_sharing_is_off_without_a_store():
    app.dependency_overrides[get_store] = lambda: None
    try:
        assert client.get("/sharing").json() == {"enabled": False}
        assert client.post("/groups").status_code == 503
    finally:
        app.dependency_overrides.pop(get_store, None)


def test_create_join_list_and_leave(store):
    assert client.get("/sharing").json() == {"enabled": True}
    group_id = client.post("/groups").json()["id"]

    r = client.put(f"/groups/{group_id}/members/{SECRET_A}", json={"name": "  Ahmed ", "state": state(0.7)})
    assert r.status_code == 200
    me = r.json()
    assert me["name"] == "Ahmed"
    assert me["id"] == public_id(group_id, SECRET_A)
    assert SECRET_A not in json.dumps(me)

    client.put(f"/groups/{group_id}/members/{SECRET_B}", json={"name": "Sara", "state": state(-0.4)})
    members = client.get(f"/groups/{group_id}").json()["members"]
    assert [m["name"] for m in members] == ["Ahmed", "Sara"]

    # Writing again with the same secret updates rather than duplicates.
    client.put(f"/groups/{group_id}/members/{SECRET_A}", json={"name": "Ahmed", "state": state(-0.9)})
    members = client.get(f"/groups/{group_id}").json()["members"]
    assert len(members) == 2
    assert next(m for m in members if m["name"] == "Ahmed")["personality"]["x"] == -0.9

    assert client.delete(f"/groups/{group_id}/members/{SECRET_B}").status_code == 204
    assert [m["name"] for m in client.get(f"/groups/{group_id}").json()["members"]] == ["Ahmed"]


def test_unknown_and_malformed_groups(store):
    assert client.get("/groups/abcdefghij").status_code == 404
    assert client.get("/groups/bad").status_code == 422
    assert client.put("/groups/abcdefghij/members/" + SECRET_A, json={"name": "x", "state": state()}).status_code == 404
    group_id = client.post("/groups").json()["id"]
    member = f"/groups/{group_id}/members/{SECRET_A}"
    assert client.put(f"/groups/{group_id}/members/short", json={"name": "x", "state": state()}).status_code == 422
    assert client.put(member, json={"name": "", "state": state()}).status_code == 422
    assert client.put(member, json={"name": "x" * 25, "state": state()}).status_code == 422


def test_full_group(store):
    group_id = client.post("/groups").json()["id"]
    for i in range(MAX_MEMBERS):
        client.put(f"/groups/{group_id}/members/{'s' * 20}{i:04d}", json={"name": f"p{i}", "state": state()})
    r = client.put(f"/groups/{group_id}/members/{SECRET_A}", json={"name": "late", "state": state()})
    assert r.status_code == 409


def test_member_keeps_only_the_reading():
    m = to_member(
        "abcdefghij",
        SECRET_A,
        MemberIn(
            name="Jo\u0007 \n Lee",
            state=CometState(personality={"x": 3}, interests={f"d{i}": i / 10 for i in range(8)}),
        ),
    )
    assert m.name == "Jo Lee"
    assert m.personality.x == 1
    assert list(m.interests) == ["d7", "d6", "d5", "d4", "d3"]
    # Same device, different groups: unlinkable public ids.
    assert public_id("abcdefghij", SECRET_A) != public_id("bcdefghijk", SECRET_A)


class FakeRedis:
    """Just enough of Upstash's REST pipeline API for UpstashStore."""

    def __init__(self) -> None:
        self.data: dict[str, dict[str, str]] = {}
        self.ttl: dict[str, int] = {}

    def handle(self, request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/pipeline"
        assert request.headers["Authorization"] == "Bearer token"
        return httpx.Response(200, json=[{"result": self.run(*c)} for c in json.loads(request.content)])

    def run(self, cmd, key, *args):
        h = self.data.get(key)
        match cmd:
            case "HSETNX":
                self.data.setdefault(key, {})
                if args[0] in self.data[key]:
                    return 0
                self.data[key][args[0]] = args[1]
                return 1
            case "HSET":
                self.data.setdefault(key, {})[args[0]] = args[1]
                return 1
            case "HGETALL":
                return [x for kv in (h or {}).items() for x in kv]
            case "HEXISTS":
                return int(bool(h and args[0] in h))
            case "HLEN":
                return len(h or {})
            case "HDEL":
                return int(bool(h and h.pop(args[0], None)))
            case "EXISTS":
                return int(h is not None)
            case "EXPIRE":
                self.ttl[key] = args[0]
                return 1
        raise AssertionError(cmd)


def test_upstash_store_round_trip():
    redis = FakeRedis()
    store = UpstashStore("https://redis.example", "token", httpx.Client(transport=httpx.MockTransport(redis.handle)))
    assert store.create("abcdefghij")
    assert not store.create("abcdefghij")
    assert store.exists("abcdefghij") and not store.exists("zzzzzzzzzz")
    assert store.members("abcdefghij") == []

    member = to_member("abcdefghij", SECRET_A, MemberIn(name="Ahmed", state=CometState()))
    store.upsert("abcdefghij", member)
    assert [m.name for m in store.members("abcdefghij")] == ["Ahmed"]
    assert isinstance(store.members("abcdefghij")[0], Member)
    assert redis.ttl["group:abcdefghij"] > 0

    store.remove("abcdefghij", member.id)
    assert store.members("abcdefghij") == []
    # The group outlives its last member, so the link keeps working.
    assert store.exists("abcdefghij")


def test_redis_credentials_with_a_custom_prefix():
    from app.config import prefixed_kv_rest

    env = {
        "STORAGE_KV_REST_API_URL": "https://x.upstash.io",
        "STORAGE_KV_REST_API_READ_ONLY_TOKEN": "read-only",
        "STORAGE_KV_REST_API_TOKEN": "read-write",
        "OTHER": "1",
    }
    assert prefixed_kv_rest(env) == ("https://x.upstash.io", "read-write")
    assert prefixed_kv_rest({"STORAGE_KV_REST_API_URL": "https://x.upstash.io"}) is None
    assert prefixed_kv_rest({}) is None
