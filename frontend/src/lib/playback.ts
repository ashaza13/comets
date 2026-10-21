import * as THREE from 'three'
import { INITIAL_STATE, type CometState } from './schema'
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

/**
 * The journey as one smooth curve through the origin and every distinct
 * position. Answers that didn't move the comet (mood, topics, skipped statements)
 * share their predecessor's place: repeating a point would make the curve
 * stall and jerk there. `knots[i]` is the curve parameter t of control point i
 * (0 = origin, i = after answer i), so the playhead can be mapped both ways.
 */
export interface JourneyPath {
  curve: THREE.CatmullRomCurve3
  knots: number[]
  /** The distinct places, origin first. */
  points: THREE.Vector3[]
  /** State at each distinct place after the origin (the last answer there), for tail colours. */
  states: CometState[]
}

export function journeyPath(history: CometState[]): JourneyPath | null {
  const all = [new THREE.Vector3(), ...history.map((s) => toWorld(s.personality))]
  const distinct: THREE.Vector3[] = []
  const states: CometState[] = []
  const index = all.map((p, i) => {
    if (distinct.length === 0 || distinct[distinct.length - 1].distanceTo(p) > SAME_PLACE) distinct.push(p)
    const j = distinct.length - 1
    if (i > 0 && j > 0) states[j - 1] = history[i - 1]
    return j
  })
  // Nowhere to travel: every answer so far left the comet where it started.
  if (distinct.length < 2) return null
  const curve = new THREE.CatmullRomCurve3(distinct, false, 'centripetal')
  curve.arcLengthDivisions = 600
  return { curve, knots: index.map((i) => i / (distinct.length - 1)), points: distinct, states }
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

// Past points closer than this to the head are merged into it.
const MERGE_DISTANCE = 0.05

/**
 * Control points for the live tail: every distinct place except the one the
 * comet is heading for, then the comet itself. Right after an answer lands the
 * comet is still sitting on the previous place; a near-duplicate control point
 * there would kink the tail's end, so it is merged into the head.
 */
export function liveControlPoints(path: JourneyPath, head: THREE.Vector3): THREE.Vector3[] {
  const past = path.points.slice(0, -1).map((p) => p.clone())
  while (past.length > 1 && past[past.length - 1].distanceTo(head) < MERGE_DISTANCE) past.pop()
  return [...past, head.clone()]
}
