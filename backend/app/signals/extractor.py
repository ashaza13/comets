import json
import re
from app.llm.provider import LLMConfig, complete
from app.signals.models import (
    SignalDeltas,
    PersonalityDelta,
    EmotionTarget,
    InterestDelta,
)

_SYSTEM_PROMPT = """\
You are a signal extractor for a personality visualization system.
Your only job is to analyze text and return a JSON object describing personality, emotion, and interest signals detected in it.

Output ONLY raw JSON — no markdown fences, no explanation, no extra text.

JSON schema (use exactly these keys):
{
  "personality": {
    "x": <float -1.0 to 1.0>,
    "y": <float -1.0 to 1.0>,
    "z": <float -1.0 to 1.0>
  },
  "emotion": {
    "hue": <float 0-360 or null>,
    "saturation": <float 0.0-1.0 or null>,
    "lightness": <float 0.0-1.0 or null>
  },
  "interests": [
    {"domain": "<string>", "depth_delta": <float -1.0 to 1.0>}
  ],
  "confidence": <float 0.0-1.0>,
  "reasoning": "<one sentence>"
}

Field definitions:

personality.x — social orientation
  -1.0 = strongly introverted (prefers solitude, drained by social interaction)
   0.0 = no clear signal
  +1.0 = strongly extroverted (energised by people, seeks social stimulation)

personality.y — cognitive style
  -1.0 = concrete / pragmatic (facts, procedures, what works)
   0.0 = no clear signal
  +1.0 = abstract / philosophical (ideas, systems, why things are)

personality.z — engagement mode
  -1.0 = analytical / systematic (logic, structure, precision)
   0.0 = no clear signal
  +1.0 = creative / expressive (imagination, aesthetics, novelty)

emotion.hue — type of emotion (null if no emotional content detected)
    0 = red: angry, frustrated
   60 = yellow: joyful, excited, enthusiastic
  120 = green: calm, content, at ease
  200 = blue: reflective, melancholic, withdrawn
  270 = violet: anxious, introspective, uneasy

emotion.saturation — intensity of emotion (null if no signal)
  0.0 = neutral, flat, numb
  1.0 = strong, vivid emotional state

emotion.lightness — energy level (null if no signal)
  0.0 = depleted, exhausted
  1.0 = highly energised

interests — domains where the person showed depth or expertise
  Only include a domain if the text contained technical vocabulary, detailed elaboration, or genuine enthusiasm — not casual mention.
  depth_delta: how much to increase (+) or decrease (-) depth for that domain.
  Common domains: science, mathematics, technology, software, art, music, literature, philosophy, history, psychology, athletics, cooking, nature, politics, economics, film, gaming, spirituality

confidence — how much total signal was present
  0.0 = very short / generic text with no real signal
  1.0 = rich, detailed text with strong, clear signals

reasoning — one short sentence explaining your primary reading of the text.

Rules:
- Use 0.0 for personality axes where there is no signal — do not guess.
- Keep delta magnitudes proportional to signal strength. A passing mention = 0.1–0.2. A dominant theme = 0.6–0.9.
- Be conservative. Under-estimating is better than over-estimating.
- Return an empty interests array if no domain depth was demonstrated.
"""


def _zero_deltas() -> SignalDeltas:
    return SignalDeltas(
        personality=PersonalityDelta(),
        emotion=EmotionTarget(),
        interests=[],
        confidence=0.0,
        reasoning="Could not parse model output.",
    )


def _parse_response(raw: str) -> SignalDeltas:
    # Strip markdown fences if the model included them despite instructions
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()

    # Find the outermost JSON object
    start = cleaned.find("{")
    end = cleaned.rfind("}") + 1
    if start == -1 or end == 0:
        return _zero_deltas()

    try:
        data = json.loads(cleaned[start:end])
    except json.JSONDecodeError:
        return _zero_deltas()

    try:
        p = data.get("personality", {})
        e = data.get("emotion", {})
        interests = [
            InterestDelta(domain=i["domain"], depth_delta=float(i["depth_delta"]))
            for i in data.get("interests", [])
            if "domain" in i and "depth_delta" in i
        ]
        return SignalDeltas(
            personality=PersonalityDelta(
                x=float(p.get("x", 0.0)),
                y=float(p.get("y", 0.0)),
                z=float(p.get("z", 0.0)),
            ),
            emotion=EmotionTarget(
                hue=e.get("hue"),
                saturation=e.get("saturation"),
                lightness=e.get("lightness"),
            ),
            interests=interests,
            confidence=float(data.get("confidence", 0.0)),
            reasoning=str(data.get("reasoning", "")),
        )
    except Exception:
        return _zero_deltas()


def extract_signals(text: str, config: LLMConfig) -> SignalDeltas:
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": f'Analyze this text:\n\n"""\n{text}\n"""'},
    ]
    raw = complete(messages, config)
    return _parse_response(raw)
