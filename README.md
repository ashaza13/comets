# Personality Vectorscope

> *Where do you currently exist in the landscape of human experience, and how are you moving through it?*

---

## Overview

Personality Vectorscope is an interactive 3D visualization that maps a person's personality, emotional state, and depth of interests into a navigable point in space — a living shape that morphs, shifts color, and moves as they do.

Rather than reducing human complexity to one of sixteen discrete types, Personality Vectorscope treats personality as **continuous and infinite**. Every person occupies a unique position in a three-dimensional manifold, with no two shapes exactly alike. Similar people cluster near each other; a specialist and a generalist who share the same values and emotional register look nearly identical — except one has a long crystalline spike extending far into space, and the other is a smooth, textured sphere.

The name is drawn from the **vectorscope** — an oscilloscope-style instrument that plots signals in two-dimensional polar space to reveal their full chromatic or phase signature. Here, the instrument is three-dimensional, and the signal is a person.

---

## The Concept

Traditional personality frameworks (MBTI, Big Five, Enneagram) force a tradeoff: either you get interpretability (discrete types) or you get accuracy (continuous scores). They also tend to treat personality as static — a label, not a trajectory.

Personality Vectorscope rejects both constraints. It models personality as:

- **A position** in 3D space (where you are)
- **A color** (how you feel)
- **A shape** (how deep you go)
- **A trajectory** (where you're moving)

The result is a single visual object that encodes far more information than any questionnaire output — and one that changes with you over time.

---

## How It Works

### 1. Natural Language Input

The user describes themselves in natural language — answering open-ended prompts, free-writing, or submitting existing text like journal entries or messages. The system is designed around **indirect and projective prompts** that surface personality rather than ask about it directly:

- *"Who do you deeply admire, and what exactly do you admire about them?"* — reveals values through projection
- *"Explain something you know deeply to a curious but non-expert friend."* — reveals interest depth through vocabulary richness
- *"What's been on your mind lately?"* — calibrates the emotional color space
- *"What would you do with a completely unexpected free week?"* — reveals social and behavioral preferences through description rather than self-categorization

Behavioral description outperforms self-categorization at every layer. The system is also designed to accept unprompted free text, which often yields the cleanest signal precisely because the person wasn't trying to describe themselves.

### 2. Signal Extraction (NLP Layer)

Each input is processed through the **Anthropic Claude API**, which extracts three structured signal types and returns delta values — incremental updates to the current vector rather than a full reset:

| Signal Type | What It Captures | How It's Detected |
|---|---|---|
| **Personality signals** | Traits, values, cognitive style, risk orientation | Language patterns, how others are described, assertion vs. qualification |
| **Emotion signals** | Affect, arousal, valence, energy level | Affect vocabulary, temporal orientation, rumination patterns |
| **Interest signals** | Domain focus, depth vs. breadth, active vs. dormant areas | Vocabulary richness, elaboration density, spontaneous topic tangents |

The accumulated signal history anchors the representation. New inputs refine it — analogous to a retrieve-then-update loop, or a Kalman filter updating an estimate with each new observation.

### 3. Dimension Mapping

Each signal type maps to a distinct visual channel, keeping them perceptually separable while unified into a single coherent object.

#### 3D Position (Personality → Space)

The three spatial axes correspond to the personality dimensions that capture the most variance while remaining close to orthogonal:

- **X-axis** — Social orientation (introvert ↔ extrovert)
- **Y-axis** — Cognitive style (concrete/pragmatic ↔ abstract/philosophical)
- **Z-axis** — Engagement mode (analytical ↔ creative/expressive)

Someone can be both deeply analytical and deeply creative — that combination places them in a specific, valid region of the space rather than forcing a choice.

#### Color Space (Emotion → HSL)

Emotional state is encoded in the HSL color of the mesh, loosely following **Russell's Circumplex Model** of emotion:

- **Hue** — Emotion type (orange-red = excited/enthusiastic; green = calm/content; blue = reflective/withdrawn; violet = anxious/introspective)
- **Saturation** — Emotional intensity (muted gray = neutral or numb; fully saturated = strong affect)
- **Lightness** — Energy level (dark = depleted; bright = energized)

The same person occupies the same position in space during a creative peak and a period of burnout — but their color signature is completely different.

#### Mesh Geometry (Interests → Shape)

The mesh starts as a sphere and deforms based on interest depth:

- Each **domain of human experience** (science, art, philosophy, athletics, social dynamics, technology, etc.) corresponds to a direction in space
- When the NLP layer detects depth in a domain — through vocabulary richness, technical specificity, and elaboration length — it **extends a spike** in that direction proportional to the depth detected
- A **generalist** appears as a smooth, slightly textured sphere
- A **deep specialist** becomes almost crystalline, with one long spike extending far from center and a flatter profile everywhere else
- Two people who are "similar but differ in depth" occupy nearly the same position with nearly the same color — but one spike is longer

### 4. Trajectory

The system saves a history of the shape's state over time and renders it as a **ribbon through 3D space**. The ribbon shows not just where you are, but how you've been moving — the direction of growth, the shifts in emotional color, the domains where spikes have lengthened or contracted. This is the temporal layer that makes the question *"how are you moving through it?"* answerable and visible.

---

## Conversation Sequence

The prompt flow is ordered to build trust and extract progressively richer signal:

1. **Calibrate** — Open with emotional/state questions (low stakes, establishes the color space, gets the person comfortable elaborating)
2. **Surface** — Move to interest questions (people produce their richest, most vocabulary-dense language when talking about what they love)
3. **Anchor** — Personality and values questions, which require more self-exposure, come once the conversation has momentum
4. **Direct** — Close with a trajectory prompt ("where are you headed?") to capture the movement vector, not just current position

---

## Tech Stack

| Layer | Technology |
|---|---|
| 3D rendering | [Three.js](https://threejs.org/) via React Three Fiber + drei |
| Sky | Procedural nebula (simplex-noise fbm baked once into a cube map), twinkling starfield with a galactic band, drifting dust; custom GLSL via `vite-plugin-glsl` |
| Post-processing | `@react-three/postprocessing` (bloom, vignette, grain, AgX tone mapping) |
| Comet tail | `meshline` ribbon through every observation, coloured per message |
| Motion & colour | `maath` damping; `culori` OKLCH so emotion hues share one perceived brightness |
| UI shell | React 19, Vite |
| Client state | `zustand` persisted to `localStorage`, validated with `zod` |
| NLP extraction | Anthropic Claude API, structured output parsed into Pydantic models |
| API | FastAPI, stateless: the client sends its comet with each message |
| Shared vocabulary | `backend/app/spec.json` defines axes, domains and prompts for both sides |

### How the comet encodes a person

| Comet part | Signal |
|---|---|
| Nucleus position | Personality (x/y/z) |
| Coma colour | Emotion hue and intensity |
| Coma and nucleus brightness, coma size | Energy |
| Coma churn and spread | Uncertainty: turbulent at first, calming as evidence builds |
| Particle jets | Depth per interest domain, streaming along that domain's direction |
| Dust tail | The path through every observation so far, in the colour of each moment, scattering as it ages |
| Ion tail | The current heading: a straight plasma streak pointing back along the latest move |

### The journey

While you answer, the camera travels with the comet and the axes stay hidden; each answer fires a
flare and the comet glides to its new position, leaving a memory star behind. After the last
question the journey replays from the start, then the axes fade in around it. Hover a memory star to
read that answer back, and use the timeline to scrub or replay the journey.

Personality is estimated with a per-axis Kalman filter, so repeated readings converge on
where the person sits instead of drifting to the edge of the space.

---

## Running Locally

```bash
# Backend (Python 3.12+)
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # add ANTHROPIC_API_KEY
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api to :8000
```

Open `http://localhost:5173/?debug` for slider controls over every visual channel. The **◎ chart** button
switches from the constellation view to crisp axes and rings for reading exact positions.

### Checks

```bash
cd backend  && .venv/bin/pytest && .venv/bin/ruff check . && .venv/bin/ruff format --check .
cd frontend && npm run lint && npm test && npm run build
```

---

## Development Phases

### Phase 1 — Visual Prototype
Build the Three.js visualization with manual controls. Sliders for each signal dimension let you push personality, emotion, and interest values by hand and watch the sphere morph and recolor in real time. No NLP yet — this phase proves the visual concept and calibrates what different people "should" look like.

### Phase 2 — NLP Integration
Replace the sliders with a text input. The Claude API extracts signals from each message and drives the dimension sliders automatically. The shape now responds to language. A conversation history panel shows each input alongside the delta values it produced.

### Phase 3 — Trajectory
Save the state history and render it as a ribbon through 3D space. Add comparison mode: place two shapes in the same viewport to see similarity in position, color divergence in emotional state, and spike overlap in shared interests. Add a timeline scrubber to replay the trajectory.

---

## Philosophical Note

The vectorscope metaphor is deliberate. A vectorscope doesn't tell you what a signal *is* — it shows you its signature, its movement, its relationship to other signals. It makes the invisible visible without reducing it to a label.

This project takes the same stance toward people. The goal is not to categorize — it's to represent. The shape on screen is not a verdict. It's a portrait of where you currently are, rendered in a space that has room for everyone, with infinite positions still unoccupied.

---

## License

MIT
