import * as THREE from 'three'

/**
 * The live comet's flight along the journey curve. Progress is kept in
 * control-point index space (0 … points − 1), which stays valid as answers
 * append points to the curve; THREE's CatmullRomCurve3.getPoint is uniform in
 * that space. Each new answer starts a leg from wherever the comet is to the
 * curve's end, flown at a random cruising speed so arrivals can't be timed.
 */
export interface Voyage {
  /** Where the comet is along the curve, in control-point index space. */
  u: number
  from: number
  to: number
  startedAt: number
  duration: number
  /** A leg that began mid-flight eases out only, so the comet doesn't stall. */
  cruising: boolean
  active: boolean
  /** Progress through the current leg, 0–1. */
  k: number
  /** Random phases for the drifting wobble, per leg. */
  phase: THREE.Vector3
}

export const createVoyage = (): Voyage => ({
  u: 0,
  from: 0,
  to: 0,
  startedAt: 0,
  duration: 1,
  cruising: false,
  active: false,
  k: 1,
  phase: new THREE.Vector3(),
})

// Cruising speeds in world units per second, and how long a leg may take.
const SPEED_MIN = 4
const SPEED_MAX = 10
const DURATION_MIN = 1.8
const DURATION_MAX = 7
// Peak sideways drift (world units) in the middle of a leg.
const WOBBLE = 0.7

const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2
const easeOutSine = (x: number) => Math.sin((x * Math.PI) / 2)

/** Length of the curve between two index-space positions, by sampling. */
export function legLength(curve: THREE.Curve<THREE.Vector3>, points: number, from: number, to: number, samples = 24): number {
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  let length = 0
  curve.getPoint(from / (points - 1), a)
  for (let i = 1; i <= samples; i++) {
    curve.getPoint((from + ((to - from) * i) / samples) / (points - 1), b)
    length += a.distanceTo(b)
    a.copy(b)
  }
  return length
}

/** Start a leg to `to` if the curve has grown past the current destination. */
export function steer(v: Voyage, curve: THREE.Curve<THREE.Vector3>, points: number, now: number, rand = Math.random): void {
  const to = points - 1
  if (to <= v.to + 1e-6) return
  const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * rand()
  const length = legLength(curve, points, v.u, to)
  v.cruising = v.active && v.k < 0.95
  v.from = v.u
  v.to = to
  v.startedAt = now
  v.duration = THREE.MathUtils.clamp(length / speed, DURATION_MIN, DURATION_MAX)
  v.active = true
  v.k = 0
  v.phase.set(rand(), rand(), rand()).multiplyScalar(Math.PI * 2)
}

/** Advance the flight; writes the point to aim for (on the curve, plus drift) into `target`. */
export function fly(v: Voyage, curve: THREE.Curve<THREE.Vector3>, points: number, now: number, target: THREE.Vector3): void {
  if (v.active) {
    v.k = THREE.MathUtils.clamp((now - v.startedAt) / v.duration, 0, 1)
    const eased = v.cruising ? easeOutSine(v.k) : easeInOutSine(v.k)
    v.u = v.from + (v.to - v.from) * eased
    if (v.k >= 1) v.active = false
  }
  curve.getPoint(Math.min(v.u / (points - 1), 1), target)
  if (!v.active) return
  // A slow, uneven drift that fades out at departure and arrival.
  const amp = WOBBLE * Math.sin(Math.PI * v.k)
  target.x += amp * Math.sin(now * 0.9 + v.phase.x)
  target.y += amp * Math.sin(now * 1.3 + v.phase.y)
  target.z += amp * Math.sin(now * 0.7 + v.phase.z)
}

/** Jump straight to `u` (replays, and journeys restored on load). */
export function settle(v: Voyage, u: number): void {
  v.u = u
  v.from = u
  v.to = u
  v.active = false
  v.k = 1
}
