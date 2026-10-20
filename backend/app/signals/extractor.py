from typing import Protocol

import anthropic

from app.config import Settings
from app.signals.models import Observation
from app.spec import AXES, DOMAIN_IDS

_axis_lines = "\n".join(f"  {a['key']} — {a['name']}: -1 = {a['negative']}, +1 = {a['positive']}" for a in AXES)

SYSTEM_PROMPT = f"""\
You read short pieces of personal writing and estimate the signals a personality
visualisation needs. You are describing the writing, not diagnosing the person.

Personality axes (give the position this text suggests, or null when the text
carries no signal for that axis — do not guess):
{_axis_lines}

Emotion, following Russell's circumplex (null for any part with no signal):
  hue — 0 red: angry/frustrated · 60 yellow: joyful/enthusiastic · 120 green: calm/content
        · 200 blue: reflective/melancholic · 270 violet: anxious/uneasy
  saturation — intensity, 0 flat/numb to 1 vivid
  lightness — energy, 0 depleted to 1 highly energised

Interests: list only domains where the text shows real depth — technical
vocabulary, detailed elaboration or genuine enthusiasm — never a passing mention.
Use the closest domain from: {", ".join(DOMAIN_IDS)}.
depth: 0.1–0.2 for light engagement, 0.6–0.9 when it is the dominant, expert theme.

confidence: how much usable signal the text holds overall (short or generic text → low).

The question the person was answering is given for context. Signals the question
itself invites (e.g. depth when asked to explain an expertise) need clear support
in the answer before you report them. Be conservative: under-estimating is better
than over-estimating.
"""


class Extractor(Protocol):
    def __call__(self, text: str, prompt: str | None) -> Observation: ...


class ExtractionError(RuntimeError):
    pass


def build_user_message(text: str, prompt: str | None) -> str:
    asked = f"Question asked: {prompt}\n\n" if prompt else "No question — free writing.\n\n"
    return f'{asked}Their writing:\n"""\n{text}\n"""'


class ClaudeExtractor:
    def __init__(self, settings: Settings, client: anthropic.Anthropic | None = None):
        self._settings = settings
        self._client = client or anthropic.Anthropic()

    def __call__(self, text: str, prompt: str | None) -> Observation:
        s = self._settings
        try:
            response = self._client.beta.messages.parse(
                model=s.llm_model,
                max_tokens=s.llm_max_tokens,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": build_user_message(text, prompt)}],
                output_format=Observation,
                output_config={"effort": s.llm_effort},
                # Re-run a policy-declined request on Anthropic's recommended fallback model.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
        except anthropic.RateLimitError as e:
            raise ExtractionError("The model is busy right now — try again in a moment.") from e
        except anthropic.APIStatusError as e:
            raise ExtractionError(f"Model request failed ({e.status_code}).") from e
        except anthropic.APIConnectionError as e:
            raise ExtractionError("Could not reach the model provider.") from e

        if response.stop_reason == "refusal":
            raise ExtractionError("The model declined to read this message.")
        if response.parsed_output is None:
            raise ExtractionError("The model returned no usable reading.")
        return response.parsed_output
