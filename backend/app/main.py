from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.comet import apply_observation
from app.config import get_settings
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
