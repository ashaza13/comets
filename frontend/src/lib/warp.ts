import * as THREE from 'three'

/**
 * Hyperspace jumps. Each answer that sends the comet somewhere new kicks the
 * warp: stars stretch into a tunnel of streaks, the view lurches wider, and the
 * sky swings round while it is hidden, so you come out somewhere else.
 * Written by <WarpDrive>, read by the sky, the tunnel, the dust and the camera.
 */
export interface Warp {
  /** How hard we're jumping right now, 0 (cruising) to 1 (full hyperspace). */
  level: number
  /** When the latest jump began (clock seconds). */
  jumpAt: number
  /** Brightness of the entry flash, 0–1. */
  flash: number
  /** Orientation of the sky; turned to a new region on every jump. */
  sky: THREE.Quaternion
  skyFrom: THREE.Quaternion
  skyTo: THREE.Quaternion
}

export const createWarp = (): Warp => ({
  level: 0,
  jumpAt: -Infinity,
  flash: 0,
  sky: new THREE.Quaternion(),
  skyFrom: new THREE.Quaternion(),
  skyTo: new THREE.Quaternion(),
})

// Jump timing (seconds): punch in, hold at full warp, then drop out.
const ATTACK = 0.3
const HOLD = 1.1
const RELEASE = 1.3
// The sky turns while the streaks are at their thickest.
const SKY_TURN_START = 0.15
const SKY_TURN_SECONDS = 1.2

const smooth = (x: number) => THREE.MathUtils.smoothstep(x, 0, 1)

/** Warp level from a jump alone, `since` seconds after it began. */
export function jumpEnvelope(since: number): number {
  if (since < 0 || !Number.isFinite(since)) return 0
  if (since < ATTACK) return smooth(since / ATTACK)
  if (since < ATTACK + HOLD) return 1
  return 1 - smooth((since - ATTACK - HOLD) / RELEASE)
}

/** Entry flash, `since` seconds after a jump began: a quick bloom that fades. */
export function flashEnvelope(since: number): number {
  if (since < 0 || !Number.isFinite(since)) return 0
  return since < 0.08 ? since / 0.08 : Math.exp(-(since - 0.08) * 5)
}

/** How far through turning to the new region the sky is, 0–1. */
export function skyTurn(since: number): number {
  return smooth(THREE.MathUtils.clamp((since - SKY_TURN_START) / SKY_TURN_SECONDS, 0, 1))
}

/** A new region of sky: the current orientation turned 50–120° about a random axis. */
export function nextRegion(from: THREE.Quaternion, rand: () => number, target = new THREE.Quaternion()): THREE.Quaternion {
  const z = rand() * 2 - 1
  const phi = rand() * Math.PI * 2
  const r = Math.sqrt(1 - z * z)
  const axis = new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), z)
  const angle = THREE.MathUtils.degToRad(50 + 70 * rand())
  return target.setFromAxisAngle(axis, angle).multiply(from)
}

/** Start a jump now: the warp kicks in and the sky sets off towards a new region. */
export function triggerJump(warp: Warp, now: number, rand: () => number = Math.random): void {
  warp.jumpAt = now
  warp.skyFrom.copy(warp.sky)
  nextRegion(warp.skyFrom, rand, warp.skyTo)
}

/**
 * Advance the warp by one frame. `cruising` is extra warp from the comet still
 * flying fast after the jump (0–1). Snaps into warp, eases out of it.
 */
export function updateWarp(warp: Warp, now: number, delta: number, cruising: number, reducedMotion: boolean): void {
  const since = now - warp.jumpAt
  const target = reducedMotion ? 0 : Math.max(jumpEnvelope(since), cruising)
  const smoothTime = target > warp.level ? 0.05 : 0.35
  warp.level = target + (warp.level - target) * Math.exp(-delta / smoothTime)
  warp.flash = reducedMotion ? 0 : flashEnvelope(since)
  // Reduced motion still arrives somewhere new, just without the swing.
  warp.sky.slerpQuaternions(warp.skyFrom, warp.skyTo, reducedMotion ? 1 : skyTurn(since))
}
