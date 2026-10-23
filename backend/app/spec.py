"""Shared vocabulary: axes, interest domains and the conversation prompts.

The canonical definitions live in spec.json so the frontend renders exactly
the same axes and domains the extractor is allowed to emit.
"""

import json
from pathlib import Path

_SPEC = json.loads((Path(__file__).parent / "spec.json").read_text())

AXES: list[dict] = _SPEC["axes"]
DOMAIN_IDS: tuple[str, ...] = tuple(d["id"] for d in _SPEC["domains"])
PROMPTS: list[str] = [p for stage in _SPEC["stages"] for p in stage["prompts"]]
# The research statements in the order the daily check-in draws from (matches
# frontend/src/lib/statements.ts), and the star type ids (lib/stars.ts).
STATEMENT_IDS: tuple[str, ...] = tuple(_SPEC["statements"])
STAR_TYPE_IDS: tuple[str, ...] = tuple(_SPEC["star_types"])


def next_prompt(message_count: int) -> str | None:
    """Prompt to show after `message_count` answers, or None once the sequence is done."""
    return PROMPTS[message_count] if message_count < len(PROMPTS) else None
