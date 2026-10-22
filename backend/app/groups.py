"""Constellations: shareable groups where friends compare where they landed.

A group is a set of members, each a name plus the final comet reading (never the
answers themselves). Members are written with a per-device secret that only the
writer knows; the public id shown to others is a hash of it, salted with the
group id, so the same device can't be linked across groups.
"""

import hashlib
import re
import secrets
import time
from typing import Annotated, Protocol

import httpx
from pydantic import BaseModel, Field, StringConstraints

from app.signals.models import CometState, EmotionState, Vec3

GROUP_ID = re.compile(r"^[A-Za-z0-9]{10}$")
MEMBER_SECRET = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

MAX_MEMBERS = 50
# Groups are kept while in use: every write pushes expiry this far out.
TTL_SECONDS = 180 * 24 * 3600
TOP_INTERESTS = 5

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]


class MemberIn(BaseModel):
    name: Name
    state: CometState


class Member(BaseModel):
    id: str
    name: str
    personality: Vec3
    uncertainty: Vec3
    emotion: EmotionState
    interests: dict[str, float] = Field(default_factory=dict)
    updated_at: float


class Group(BaseModel):
    id: str
    members: list[Member]


class GroupFull(Exception):
    pass


def new_group_id() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(10))


def public_id(group_id: str, secret: str) -> str:
    return hashlib.sha256(f"{group_id}:{secret}".encode()).hexdigest()[:12]


def _clean_name(name: str) -> str:
    # Names are shown to others; drop control characters and collapse spaces.
    return " ".join("".join(c for c in name if c.isprintable()).split())


def to_member(group_id: str, secret: str, body: MemberIn) -> Member:
    s = body.state
    clamp = lambda v, lo, hi: max(lo, min(hi, v))  # noqa: E731
    top = sorted(s.interests.items(), key=lambda kv: kv[1], reverse=True)[:TOP_INTERESTS]
    return Member(
        id=public_id(group_id, secret),
        name=_clean_name(body.name) or "friend",
        personality=Vec3(**{k: clamp(getattr(s.personality, k), -1, 1) for k in "xyz"}),
        uncertainty=Vec3(**{k: clamp(getattr(s.uncertainty, k), 0, 1) for k in "xyz"}),
        emotion=EmotionState(
            hue=s.emotion.hue % 360,
            saturation=clamp(s.emotion.saturation, 0, 1),
            lightness=clamp(s.emotion.lightness, 0, 1),
        ),
        interests={d: round(clamp(v, 0, 1), 3) for d, v in top},
        updated_at=time.time(),
    )


class GroupStore(Protocol):
    def create(self, group_id: str) -> bool: ...
    def exists(self, group_id: str) -> bool: ...
    def members(self, group_id: str) -> list[Member]: ...
    def upsert(self, group_id: str, member: Member) -> None: ...
    def remove(self, group_id: str, member_id: str) -> None: ...
    def hit(self, key: str, window_seconds: int) -> int:
        """Count one event against `key` in the current fixed window; returns the count so far."""
        ...


# Group creation is limited per client, over a short burst window and a whole day.
# (limit, window in seconds)
CREATE_LIMITS = ((5, 10 * 60), (20, 24 * 3600))


def client_key(ip: str) -> str:
    # Hashed so raw IP addresses never reach storage.
    return hashlib.sha256(f"comets:{ip}".encode()).hexdigest()[:16]


def creation_retry_after(store: "GroupStore", client: str, now: float | None = None) -> int | None:
    """Records a group creation for `client`. Returns None if it's allowed, otherwise
    the seconds until the limit that was hit resets."""
    now = time.time() if now is None else now
    for limit, window in CREATE_LIMITS:
        count = store.hit(f"ratelimit:create:{window}:{client}:{int(now // window)}", window)
        if count > limit:
            return int(window - now % window) + 1
    return None


# The group's hash also holds this marker field, so an empty group still exists.
_MARKER = "_created"


class MemoryStore:
    """For local development and tests only: lost whenever the process restarts."""

    def __init__(self) -> None:
        self._groups: dict[str, dict[str, Member]] = {}
        self._counts: dict[str, int] = {}

    def create(self, group_id: str) -> bool:
        if group_id in self._groups:
            return False
        self._groups[group_id] = {}
        return True

    def exists(self, group_id: str) -> bool:
        return group_id in self._groups

    def members(self, group_id: str) -> list[Member]:
        return list(self._groups.get(group_id, {}).values())

    def upsert(self, group_id: str, member: Member) -> None:
        group = self._groups[group_id]
        if member.id not in group and len(group) >= MAX_MEMBERS:
            raise GroupFull
        group[member.id] = member

    def remove(self, group_id: str, member_id: str) -> None:
        self._groups.get(group_id, {}).pop(member_id, None)

    def hit(self, key: str, window_seconds: int) -> int:
        # Window keys embed the window index, so old ones are simply never read again.
        self._counts[key] = self._counts.get(key, 0) + 1
        return self._counts[key]


class UpstashStore:
    """Redis over Upstash's REST API: one hash per group, field per member."""

    def __init__(self, url: str, token: str, client: httpx.Client | None = None) -> None:
        self._url = url.rstrip("/")
        self._client = client or httpx.Client(timeout=5.0)
        self._headers = {"Authorization": f"Bearer {token}"}

    def _pipeline(self, *commands: list[str | int]) -> list:
        r = self._client.post(f"{self._url}/pipeline", headers=self._headers, json=list(commands))
        r.raise_for_status()
        results = r.json()
        for item in results:
            if "error" in item:
                raise RuntimeError(f"Redis error: {item['error']}")
        return [item.get("result") for item in results]

    @staticmethod
    def _key(group_id: str) -> str:
        return f"group:{group_id}"

    def create(self, group_id: str) -> bool:
        key = self._key(group_id)
        created, _ = self._pipeline(["HSETNX", key, _MARKER, str(int(time.time()))], ["EXPIRE", key, TTL_SECONDS])
        return created == 1

    def exists(self, group_id: str) -> bool:
        (n,) = self._pipeline(["EXISTS", self._key(group_id)])
        return n == 1

    def members(self, group_id: str) -> list[Member]:
        (flat,) = self._pipeline(["HGETALL", self._key(group_id)])
        pairs = zip(flat[::2], flat[1::2], strict=True) if flat else []
        return [Member.model_validate_json(v) for k, v in pairs if k != _MARKER]

    def upsert(self, group_id: str, member: Member) -> None:
        key = self._key(group_id)
        exists, count = self._pipeline(["HEXISTS", key, member.id], ["HLEN", key])
        if not exists and count - 1 >= MAX_MEMBERS:
            raise GroupFull
        self._pipeline(["HSET", key, member.id, member.model_dump_json()], ["EXPIRE", key, TTL_SECONDS])

    def remove(self, group_id: str, member_id: str) -> None:
        self._pipeline(["HDEL", self._key(group_id), member_id])

    def hit(self, key: str, window_seconds: int) -> int:
        count, _ = self._pipeline(["INCR", key], ["EXPIRE", key, window_seconds])
        return int(count)


def sort_members(members: list[Member]) -> list[Member]:
    return sorted(members, key=lambda m: m.updated_at)
