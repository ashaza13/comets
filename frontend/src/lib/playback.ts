import * as THREE from 'three'
import { INITIAL_STATE, type CometState } from './schema'
import { mulberry32 } from './sky'
import { toWorld } from './tail'

/**
 * The journey can be replayed: a playhead runs from 0 (before the first
 * answer) to N (after the last). Fractional values interpolate between answers.
 */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpHue(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180
  return (a + diff * t + 360) % 360
}

export function lerpState(a: CometState, b: CometState, t: number): CometState {
  const domains = new Set([...Object.keys(a.interests), ...Object.keys(b.interests)])
  return {
    personality: {
      x: lerp(a.personality.x, b.personality.x, t),
      y: lerp(a.personality.y, b.personality.y, t),
      z: lerp(a.personality.z, b.personality.z, t),
    },
    uncertainty: {
      x: lerp(a.uncertainty.x, b.uncertainty.x, t),
      y: lerp(a.uncertainty.y, b.uncertainty.y, t),
      z: lerp(a.uncertainty.z, b.uncertainty.z, t),
    },
    emotion: {
      hue: lerpHue(a.emotion.hue, b.emotion.hue, t),
      saturation: lerp(a.emotion.saturation, b.emotion.saturation, t),
      lightness: lerp(a.emotion.lightness, b.emotion.lightness, t),
    },
    interests: Object.fromEntries([...domains].map((d) => [d, lerp(a.interests[d] ?? 0, b.interests[d] ?? 0, t)])),
    message_count: t < 1 ? a.message_count : b.message_count,
  }
}

/**
 * The history as it stood at the playhead: every answer already passed, plus an
 * interpolated state between the last one passed and the next. A null playhead
 * means "live" and returns the full history.
 */
export function historyAt(history: CometState[], playhead: number | null): CometState[] {
  if (playhead === null || playhead >= history.length) return history
  const p = Math.max(0, playhead)
  const passed = Math.floor(p)
  const t = p - passed
  if (t === 0) return history.slice(0, passed)
  const from = passed === 0 ? INITIAL_STATE : history[passed - 1]
  return [...history.slice(0, passed), lerpState(from, history[passed], t)]
}

// Points closer than this are treated as the same place on the curve.
const SAME_PLACE = 1e-3
// Even a small move wanders at least this far (world units) off the straight line.
const DETOUR_MIN = 2.5
// Moves longer than this take two detours rather than one.
const LONG_MOVE = 8

/** A stable 32-bit seed from an answer's id, so its detours replay identically. */
export function seedFrom(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return h >>> 0
}

// The route may turn at most this sharply (cosine of ~100°) where one move hands
// over to the next, so it sweeps on rather than doubling back on itself.
const MIN_TURN_COS = -0.17
const DETOUR_TRIES = 8

/**
 * Waypoints for one move, so the comet wanders rather than sliding along an
 * axis: each sits part-way along the move, pushed off in a random direction
 * that is mostly sideways to it, by a random share of the move's length.
 * Given the direction the comet arrives from, the first waypoint is picked so
 * the route carries on rather than doubling back.
 */
export function detourPoints(
  from: THREE.Vector3,
  to: THREE.Vector3,
  rand: () => number,
  arriving: THREE.Vector3 | null = null,
): THREE.Vector3[] {
  const distance = from.distanceTo(to)
  const count = distance > LONG_MOVE ? 2 : 1
  const candidates = (k: number) =>
    Array.from({ length: k === 0 && arriving ? DETOUR_TRIES : 1 }, () => detour(from, to, k, count, distance, rand))
  return Array.from({ length: count }, (_, k) => {
    const options = candidates(k)
    if (!arriving || k > 0) return options[0]
    const turn = (p: THREE.Vector3) => p.clone().sub(from).normalize().dot(arriving)
    return options.find((p) => turn(p) > MIN_TURN_COS) ?? options.reduce((a, b) => (turn(b) > turn(a) ? b : a))
  })
}

/** One waypoint: part-way along the move, pushed off mostly sideways to it. */
function detour(from: THREE.Vector3, to: THREE.Vector3, k: number, count: number, distance: number, rand: () => number) {
  const along = to.clone().sub(from).normalize()
  const z = rand() * 2 - 1
  const phi = rand() * Math.PI * 2
  const r = Math.sqrt(1 - z * z)
  const offset = new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), z)
  offset.addScaledVector(along, -0.8 * offset.dot(along))
  if (offset.lengthSq() < 1e-6) offset.set(-along.y, along.x, along.z)
  offset.normalize().multiplyScalar((0.35 + 0.45 * rand()) * Math.max(distance, DETOUR_MIN))
  const at = (k + 0.5 + (rand() - 0.5) * 0.5) / count
  return from.clone().lerp(to, at).add(offset)
}

/**
 * The journey as one smooth curve from the origin through every place the
 * comet went, with random detours between answers (seeded by each answer's id,
 * so a replay retraces the same route). Answers that didn't move the comet
 * (mood, topics, skipped statements) share their predecessor's place.
 * `knots[i]` is the curve parameter t of answer i's place (0 = origin), so the
 * playhead can be mapped both ways.
 */
export interface JourneyPath {
  curve: THREE.CatmullRomCurve3
  knots: number[]
  /** Every control point, origin first: answers' places and the detours between them. */
  points: THREE.Vector3[]
  /** State for each control point after the origin (the answer it leads to), for tail colours. */
  states: CometState[]
}

export function journeyPath(history: CometState[], ids: string[] = []): JourneyPath | null {
  const points = [new THREE.Vector3()]
  const states: CometState[] = []
  const places = [0]
  history.forEach((state, i) => {
    const target = toWorld(state.personality)
    const from = points[points.length - 1]
    if (from.distanceTo(target) > SAME_PLACE) {
      const arriving = points.length > 1 ? from.clone().sub(points[points.length - 2]).normalize() : null
      for (const waypoint of detourPoints(from, target, mulberry32(seedFrom(ids[i] ?? `answer-${i}`)), arriving)) {
        points.push(waypoint)
        states.push(state)
      }
      points.push(target)
      states.push(state)
    } else if (states.length > 0) {
      // The last answer at a place sets its colour.
      states[states.length - 1] = state
    }
    places.push(points.length - 1)
  })
  // Nowhere to travel: every answer so far left the comet where it started.
  if (points.length < 2) return null
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  curve.arcLengthDivisions = 6000
  return { curve, knots: places.map((i) => i / (points.length - 1)), points, states }
}

/** Curve parameter for a playhead (clamped to the journey). */
export function playheadToT(path: JourneyPath, playhead: number): number {
  const { knots } = path
  const p = Math.min(Math.max(playhead, 0), knots.length - 1)
  const i = Math.min(Math.floor(p), knots.length - 2)
  return knots[i] + (knots[i + 1] - knots[i]) * (p - i)
}

/**
 * Playhead for a curve parameter. Answers that share a place count as passed
 * together, so their memory stars appear as the comet arrives there.
 */
export function tToPlayhead(path: JourneyPath, t: number): number {
  const { knots } = path
  let i = 0
  while (i < knots.length - 1 && knots[i + 1] <= t) i++
  if (i >= knots.length - 1) return knots.length - 1
  const span = knots[i + 1] - knots[i]
  return span > 0 ? i + (t - knots[i]) / span : i
}

/** Smooth start and finish for the replay, constant speed in between. */
export function easeReplay(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}
