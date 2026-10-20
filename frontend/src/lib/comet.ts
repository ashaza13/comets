import * as THREE from 'three'
import { INITIAL_STATE, type CometState } from './schema'
import { toWorld } from './tail'

/**
 * Per-frame appearance of the comet, written by <Comet> and read by the parts
 * that render it (coma, jets, tails). Mutable on purpose: it changes every frame.
 */
export interface CometLook {
  color: THREE.Color
  /** Glow multiplier from energy, roughly 0.45–1.55. */
  energy: number
  /** Mean estimate uncertainty, 0 (certain) to 1 (knows nothing). */
  spread: number
  /** World-space velocity of the nucleus. */
  velocity: THREE.Vector3
  /** Unit direction the comet is travelling; tails stream the opposite way. */
  heading: THREE.Vector3
  /** Brightness pulse while a message is being read, 1 otherwise. */
  pulse: number
}

export function createLook(): CometLook {
  return {
    color: new THREE.Color().setHSL(0.55, 0.6, 0.6),
    energy: 1,
    spread: 1,
    velocity: new THREE.Vector3(),
    heading: new THREE.Vector3(0, 1, 0),
    pulse: 1,
  }
}

const EPSILON = 1e-4

/**
 * Direction of the most recent move between observations (starting from the
 * origin before the first one). Falls back to "away from the centre" when the
 * last move was too small to have a direction, and null when there is nothing.
 */
export function headingFrom(history: CometState[], target = new THREE.Vector3()): THREE.Vector3 | null {
  if (history.length === 0) return null
  const states = [INITIAL_STATE, ...history]
  const to = toWorld(states[states.length - 1].personality)
  for (let i = states.length - 2; i >= 0; i--) {
    target.subVectors(to, toWorld(states[i].personality))
    if (target.lengthSq() > EPSILON) return target.normalize()
  }
  return to.lengthSq() > EPSILON ? target.copy(to).normalize() : null
}

/** Pack curve points into RGBA float texels (w = 1) for sampling in a vertex shader. */
export function packCurve(points: THREE.Vector3[], out: Float32Array): number {
  const n = Math.min(points.length, out.length / 4)
  for (let i = 0; i < n; i++) out.set([points[i].x, points[i].y, points[i].z, 1], i * 4)
  return n
}
