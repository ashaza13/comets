import * as THREE from 'three'
import { emotionRgb } from './color'
import { INITIAL_STATE, type CometState } from './schema'
import { SPACE_SCALE } from './spec'

export function toWorld(p: CometState['personality'], target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(p.x * SPACE_SCALE, p.y * SPACE_SCALE, p.z * SPACE_SCALE)
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
 * The map's framing: a sphere centred on where the journey ended, just large
 * enough to hold the origin, every observation, the route's detours and any
 * friends shown. The camera orbits the final position, so the comet stays the
 * focus while the whole path fits in view.
 */
export function journeyBounds(
  history: CometState[],
  friends: CometState['personality'][] = [],
  route: THREE.Vector3[] = [],
): THREE.Sphere {
  const points = [new THREE.Vector3(), ...history.map((s) => toWorld(s.personality))]
  const center = points[points.length - 1].clone()
  points.push(...friends.map((p) => toWorld(p)), ...route)
  const radius = Math.max(...points.map((p) => p.distanceTo(center)))
  return new THREE.Sphere(center, radius)
}
