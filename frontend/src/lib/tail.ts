import * as THREE from 'three'
import { emotionRgb } from './color'
import { INITIAL_STATE, type CometState } from './schema'
import { SPACE_SCALE } from './spec'

export function toWorld(p: CometState['personality'], target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(p.x * SPACE_SCALE, p.y * SPACE_SCALE, p.z * SPACE_SCALE)
}

/**
 * Control points for the tail: it starts at the origin (before anything was
 * known), passes through every past observation and ends at the live head.
 * The latest observation is replaced by the head, which is easing towards it.
 */
export function tailControlPoints(history: CometState[], head: THREE.Vector3): THREE.Vector3[] {
  const past = [INITIAL_STATE, ...history].slice(0, -1).map((s) => toWorld(s.personality))
  return [...past, head.clone()]
}

/**
 * One RGBA texel per control point: the emotion colour the person had at that
 * moment, fading towards the oldest end. Sampled along the ribbon's length.
 */
export function tailTexture(history: CometState[], minAlpha = 0.12): Uint8Array {
  const states = [INITIAL_STATE, ...history]
  const data = new Uint8Array(states.length * 4)
  states.forEach((s, i) => {
    const [r, g, b] = emotionRgb(s.emotion)
    const t = states.length === 1 ? 1 : i / (states.length - 1)
    data.set([r * 255, g * 255, b * 255, (minAlpha + (1 - minAlpha) * t) * 255], i * 4)
  })
  return data
}

export function meanUncertainty(u: CometState['uncertainty']): number {
  return (u.x + u.y + u.z) / 3
}

/**
 * Bounding sphere of the journey (origin plus every observation), used to frame
 * the map so the path fills the view however far or near it travelled.
 */
export function journeyBounds(history: CometState[]): THREE.Sphere {
  const points = [new THREE.Vector3(), ...history.map((s) => toWorld(s.personality))]
  return new THREE.Box3().setFromPoints(points).getBoundingSphere(new THREE.Sphere())
}
