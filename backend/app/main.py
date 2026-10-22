from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Path, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.comet import apply_observation
from app.config import get_settings
from app.groups import (
    Group,
    GroupFull,
    GroupStore,
    Member,
    MemberIn,
    MemoryStore,
    UpstashStore,
    client_key,
    creation_retry_after,
    new_group_id,
    public_id,
    sort_members,
    to_member,
)
from app.signals.extractor import ClaudeExtractor, ExtractionError, Extractor
from app.signals.models import CometState, ObserveRequest, ObserveResponse
from app.spec import next_prompt

settings = get_settings()

app = FastAPI(title="Personality Vectorscope API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

_extractor: Extractor | None = None


def get_extractor() -> Extractor:
    # Created lazily so importing the app (e.g. in tests) needs no API key.
    global _extractor
    if _extractor is None:
        _extractor = ClaudeExtractor(settings)
    return _extractor


@app.get("/health")
def health():
    return {"status": "ok", "model": settings.llm_model}


# The backend is stateless: the client owns the comet and sends it with each
# message, so nothing personal is stored server-side and any instance can serve.
@app.post("/observe", response_model=ObserveResponse)
def observe(body: ObserveRequest, extract: Annotated[Extractor, Depends(get_extractor)]):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Text must not be empty")

    try:
        observation = extract(text, body.prompt)
    except ExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    state = apply_observation(body.state or CometState(), observation)
    return ObserveResponse(observation=observation, state=state, next_prompt=next_prompt(state.message_count))


# ── Constellations: compare with friends through a shared link ─────────────────

_store: GroupStore | None = None


def get_store() -> GroupStore | None:
    # None when no Redis is configured: sharing is then switched off rather than
    # silently kept in memory, which serverless instances would lose.
    global _store
    if _store is None:
        if settings.redis_rest:
            _store = UpstashStore(*settings.redis_rest)
        elif settings.groups_in_memory:
            _store = MemoryStore()
    return _store


Store = Annotated[GroupStore | None, Depends(get_store)]
GroupId = Annotated[str, Path(pattern=r"^[A-Za-z0-9]{10}$")]
MemberSecret = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{16,64}$")]


def _require(store: GroupStore | None) -> GroupStore:
    if store is None:
        raise HTTPException(status_code=503, detail="Sharing isn't set up on this server.")
    return store


def _require_group(store: GroupStore, group_id: str) -> None:
    if not store.exists(group_id):
        raise HTTPException(status_code=404, detail="This constellation doesn't exist or has expired.")


@app.get("/sharing")
def sharing(store: Store):
    return {"enabled": store is not None}


def client_ip(request: Request) -> str:
    # Vercel's edge sets x-real-ip to the caller's address (and overwrites any
    # client-supplied value); x-forwarded-for and the socket are fallbacks for elsewhere.
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return request.headers.get("x-real-ip") or forwarded or (request.client.host if request.client else "unknown")


@app.post("/groups", status_code=201)
def create_group(request: Request, store: Store):
    s = _require(store)
    retry_after = creation_retry_after(s, client_key(client_ip(request)))
    if retry_after is not None:
        minutes = max(1, round(retry_after / 60))
        wait = f"{minutes} minute{'s' if minutes != 1 else ''}" if minutes < 90 else f"{round(minutes / 60)} hours"
        raise HTTPException(
            status_code=429,
            detail=f"You've made a lot of constellations recently. Try again in {wait}.",
            headers={"Retry-After": str(retry_after)},
        )
    for _ in range(5):
        group_id = new_group_id()
        if s.create(group_id):
            return {"id": group_id}
    raise HTTPException(status_code=503, detail="Couldn't create a constellation, try again.")


@app.get("/groups/{group_id}", response_model=Group)
def get_group(group_id: GroupId, store: Store):
    s = _require(store)
    _require_group(s, group_id)
    return Group(id=group_id, members=sort_members(s.members(group_id)))


@app.put("/groups/{group_id}/members/{secret}", response_model=Member)
def join_group(group_id: GroupId, secret: MemberSecret, body: MemberIn, store: Store):
    s = _require(store)
    _require_group(s, group_id)
    member = to_member(group_id, secret, body)
    try:
        s.upsert(group_id, member)
    except GroupFull as e:
        raise HTTPException(status_code=409, detail="This constellation is full.") from e
    return member


@app.delete("/groups/{group_id}/members/{secret}", status_code=204)
def leave_group(group_id: GroupId, secret: MemberSecret, store: Store):
    s = _require(store)
    s.remove(group_id, public_id(group_id, secret))
    return Response(status_code=204)
