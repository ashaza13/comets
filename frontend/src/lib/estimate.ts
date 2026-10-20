import type { CometState, Observation } from './schema'

// TypeScript port of backend/app/comet.py, used to score tap answers in the
// browser. Keep the two in step: backend/tests/fixtures/apply_observation.json
// is checked against both implementations.

const MEASUREMENT_NOISE = 0.5
const PROCESS_NOISE = 0.01
const MIN_CONFIDENCE = 0.05

const EMOTION_RATE = 0.45
const INTEREST_RATE = 0.5
const INTEREST_DECAY = 0.97
const INTEREST_FLOOR = 0.01

const AXES = ['x', 'y', 'z'] as const

// Python's % always returns a non-negative result for a positive modulus.
const mod = (a: number, n: number) => ((a % n) + n) % n

function kalman(estimate: number, variance: number, reading: number | null, confidence: number): [number, number] {
  variance += PROCESS_NOISE
  if (reading === null || confidence <= 0) return [estimate, Math.min(variance, 1)]
  const noise = MEASUREMENT_NOISE / Math.max(confidence, MIN_CONFIDENCE)
  const gain = variance / (variance + noise)
  return [estimate + gain * (reading - estimate), (1 - gain) * variance]
}

const lerp = (current: number, target: number | null, t: number) => (target === null ? current : current + (target - current) * t)

function lerpHue(current: number, target: number | null, t: number): number {
  if (target === null) return current
  const diff = mod(target - current + 180, 360) - 180
  return mod(current + diff * t, 360)
}

export function applyObservation(state: CometState, obs: Observation): CometState {
  const c = obs.confidence
  const personality = { ...state.personality }
  const uncertainty = { ...state.uncertainty }
  for (const axis of AXES) {
    ;[personality[axis], uncertainty[axis]] = kalman(state.personality[axis], state.uncertainty[axis], obs.personality[axis], c)
  }

  const rate = EMOTION_RATE * c
  const emotion = {
    hue: lerpHue(state.emotion.hue, obs.emotion.hue, rate),
    saturation: lerp(state.emotion.saturation, obs.emotion.saturation, rate),
    lightness: lerp(state.emotion.lightness, obs.emotion.lightness, rate),
  }

  const interests: Record<string, number> = {}
  for (const [d, v] of Object.entries(state.interests)) interests[d] = v * INTEREST_DECAY
  for (const { domain, depth } of obs.interests) {
    const current = interests[domain] ?? 0
    interests[domain] = current + (1 - current) * depth * c * INTEREST_RATE
  }
  for (const d of Object.keys(interests)) if (interests[d] < INTEREST_FLOOR) delete interests[d]

  return { personality, uncertainty, emotion, interests, message_count: state.message_count + 1 }
}
