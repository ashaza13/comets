from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.llm.provider import LLMConfig, load_config
from app.signals.extractor import extract_signals
from app.signals.models import CreateSessionResponse, MessageRequest, MessageResponse
from app.session.state import (
    create_session,
    get_session,
    get_prompt_suggestion,
    update_session,
)

load_dotenv()

_llm_config: LLMConfig | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _llm_config
    _llm_config = load_config()
    print(f"LLM provider: {_llm_config.model}")
    yield


app = FastAPI(title="Personality Vectorscope API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this when the frontend URL is known
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": _llm_config.model if _llm_config else None}


# ── Sessions ───────────────────────────────────────────────────────────────────

@app.post("/session", response_model=CreateSessionResponse, status_code=201)
def new_session():
    state = create_session()
    return CreateSessionResponse(session_id=state.session_id)


@app.get("/session/{session_id}")
def get_session_state(session_id: str):
    state = get_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return state


# ── Message processing ─────────────────────────────────────────────────────────

@app.post("/session/{session_id}/message", response_model=MessageResponse)
def process_message(session_id: str, body: MessageRequest):
    if get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Text must not be empty")

    deltas = extract_signals(body.text, _llm_config)
    state = update_session(session_id, body.text, deltas)
    suggestion = get_prompt_suggestion(session_id)

    return MessageResponse(deltas=deltas, state=state, prompt_suggestion=suggestion)
