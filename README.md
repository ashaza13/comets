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

- **X-axis** — Extraversion (introvert ↔ extrovert)
- **Y-axis** — Intellect (concrete ↔ abstract: drawn to ideas and complex problems)
- **Z-axis** — Imagination (practical ↔ imaginative: images, art and daydreams)

These follow established personality research: x is Big Five Extraversion, and y and z are the two
sides of Openness/Intellect that DeYoung, Quilty and Peterson (2007) separate into the Intellect and
Openness aspects. They correlate, but someone can love abstract problems without caring for art, or
the reverse, and that combination places them in a distinct region of the space.

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

The intro moves on when you're ready: tap, swipe left or press →/Space to continue, swipe right
or ← to go back.

About a minute of taps, no typing required:

1. **Mood wheel**: tap a colour; the angle is the kind of feeling, the distance from the centre how
   strongly you feel it. A slider sets energy.
2. **Statements** (12): rate how well each describes you, from *very inaccurate* to *very accurate*.
   They are validated, public-domain items from the [International Personality Item Pool](https://ipip.ori.org),
   four per axis with two keyed each way, so agreeing with everything doesn't move the comet
   (`frontend/src/lib/statements.ts`). A rating of 1–5 reads as −1…1 on the item's axis (reversed for
   negatively keyed items), and the Kalman update averages them into the estimate.
3. **Topics**: tap what lights you up; tap again to go deeper (curious, into it, obsessed).

Taps are scored in the browser with a TypeScript port of the backend's update math
(`frontend/src/lib/estimate.ts`), so they apply instantly. A shared fixture
(`backend/tests/fixtures/apply_observation.json`) keeps both implementations identical. Any step can
take an optional **say more**, typed or dictated, which Claude reads on the backend.

While you answer, the camera travels with the comet and the axes stay hidden; each answer fires a
flare and the comet sets off for its new position. It doesn't go in a
straight line: each move takes a winding route through one or two random detours (seeded by the
answer, so replays retrace it exactly), flown at a random cruising speed with a slow drift, and an
answer mid-flight carries straight on into the next leg. Each move is also a hyperspace jump:
stars stretch into a tunnel of streaks radiating from the comet, a blue-white flash fires, the view
lurches wider, and the whole sky swings round to a new region while it's hidden, so every answer
arrives somewhere new (reduced motion keeps the new sky, without the tunnel or flash). Distant
galaxies scattered over the sky turn with it, so each arrival shows different landmarks. While you
answer, the comet trails only a wake for the leg it's flying, which dissolves behind it on arrival:
the route so far, and the stars marking past answers, stay hidden until the map. After the last step
the journey replays from the start with the camera riding along, then it pulls back slowly (about
seven seconds) to the comet's final place and the axes fade in around it; the result card waits
until the pull-back has settled. Dashed lines drop from the comet to each axis, and a
"where you landed" card reads out each dimension on a scale, with a band for how sure the estimate
is, plus the feeling and interests. Hover a memory star to read that answer back, and use the
timeline to scrub or replay the journey. Readings are shown in plain
language ("leaning introvert"); chart mode shows the exact numbers.

Personality is estimated with a per-axis Kalman filter, so repeated readings converge on
where the person sits instead of drifting to the edge of the space.

### Daily orbit

The first visit is the full journey. After that, each day (by your local date, numbered from
Day 1 on 1 October 2026, like Wordle) asks for about twenty seconds:

1. **Today's mood** on the mood wheel.
2. **Today's statement**, the same for everyone that day. Statements are dealt from a shuffled deck
   of the twelve, one per 12-day run, so none repeats until all have come round
   (`frontend/src/lib/daily.ts`, mirrored in `backend/app/daily.py` and pinned by tests on both sides).

The answers go through the same Kalman update, so traits move gently while the mood recolours the
comet. Each check-in is a hyperspace jump to a new point on your orbit; the camera rides with the
comet as it lands, then pulls back to the map. Days in a row build a 🔥 streak, and the countdown to
tomorrow's check-in shows on the **Today** tab.

The Today tab shows:

- **Your star type**, from the octant your comet sits in (Supernova, Blue Giant, Red Giant, Yellow
  Sun, Pulsar, White Dwarf, Nebula, Red Dwarf, or Binary Star when you're near the centre on
  every axis), with how many of today's comets share it.
- **A reading** written by Claude from the last two weeks of numbers only (positions, moods and
  ratings; never names or text): two or three playful, horoscope-flavoured sentences about real
  trends, with no predictions or clinical claims. It is cached per day, rate limited to 20 per
  client per day, and replaced by a plain mood line if it fails.
- **What everyone said** to today's statement, as five bars with yours highlighted.
- **Share**, which copies (or opens the share sheet with) a spoiler-free summary: day, star type,
  streak, your last seven moods as coloured squares, and the share who answered as you did.

Tallies are anonymous counters in Redis: `POST /api/daily/{day}/answer` adds one to the rating and
the star type, counted once per client per day (by a hash of the IP), for the current day ±1 only,
and only for that day's statement. They expire after 40 days. `GET /api/daily/{day}` reads them.
Without storage the community figures are hidden and the rest still works.

### Comparing with friends (constellations)

From the result card's **Friends** tab, enter a first name or nickname and **Create link** to start a
constellation, then share the link (`/?c=<id>`). A friend who opens it sees an invitation, takes
the journey, and joins with their own name. Everyone in the constellation then appears on each
other's map as a named star, and the Friends tab lists them by how alike you are, with the
interests you share. Joining a different link moves you to that constellation.

Only a name and the final reading (position, certainty, mood and top five interests) are stored,
never the answers. Each device writes its entry with a private secret; others see only a hash of
it, salted per constellation. Constellations hold up to 50 people and expire 180 days after
their last change. Creating constellations is rate limited per client (5 per 10 minutes and 20
per day, counted in Redis against a hash of the caller's IP); the server answers `429` with a
`Retry-After` header past that.

Storage is [Upstash Redis](https://vercel.com/marketplace/upstash) over its REST API. In the Vercel
project, add it under **Storage → Create Database → Upstash for Redis** and connect it to the
project; that sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`, with any custom prefix chosen
when connecting (e.g. `STORAGE_KV_REST_API_URL`). The `UPSTASH_REDIS_REST_*` names work too. Without them, sharing is switched off and the Friends tab is hidden. For local
development, `GROUPS_IN_MEMORY=true` keeps constellations in memory instead.

---

## Running Locally

```bash
# Backend (Python 3.12+)
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # add ANTHROPIC_API_KEY (and GROUPS_IN_MEMORY=true to try sharing)
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api to :8000
```

Open `http://localhost:5173/?debug` for slider controls over every visual channel. The **Chart view** button
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
