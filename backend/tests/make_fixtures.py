"""Regenerate tests/fixtures/apply_observation.json.

The frontend scores tap answers with a TypeScript port of app.comet; this
fixture pins both implementations to the same results. Run after changing the
update math:  .venv/bin/python -m tests.make_fixtures
"""

import json
import random
from pathlib import Path

from app.comet import apply_observation
from app.signals.models import CometState, Observation
from app.spec import DOMAIN_IDS

OUT = Path(__file__).parent / "fixtures" / "apply_observation.json"


def random_observation(rng: random.Random) -> dict:
    def maybe(lo, hi):
        return None if rng.random() < 0.3 else round(rng.uniform(lo, hi), 3)

    return {
        "personality": {"x": maybe(-1, 1), "y": maybe(-1, 1), "z": maybe(-1, 1)},
        "emotion": {"hue": maybe(0, 359), "saturation": maybe(0, 1), "lightness": maybe(0, 1)},
        "interests": [
            {"domain": d, "depth": round(rng.uniform(0, 1), 3)} for d in rng.sample(DOMAIN_IDS, rng.randint(0, 3))
        ],
        "confidence": round(rng.uniform(0, 1), 3),
        "reasoning": "fixture",
    }


def main() -> None:
    rng = random.Random(7)
    cases = []
    state = CometState()
    for _ in range(12):
        obs = random_observation(rng)
        after = apply_observation(state, Observation.model_validate(obs))
        cases.append({"state": state.model_dump(), "observation": obs, "expected": after.model_dump()})
        state = after
    OUT.write_text(json.dumps(cases, indent=1) + "\n")


if __name__ == "__main__":
    main()
