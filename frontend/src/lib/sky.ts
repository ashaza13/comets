import * as THREE from 'three'

// Orientation of the galactic band, shared by the nebula and the starfield.
export const BAND_NORMAL = new THREE.Vector3(0.35, 1, 0.25).normalize()

// Deterministic PRNG so the sky is the same on every visit. It lives in seed.ts
// (free of three.js) and is re-exported for the scene's callers.
import { mulberry32 } from './seed'
export { mulberry32 }

// Approximate star colours by temperature, hottest (blue) to coolest (orange),
// with weights skewed towards the white and blue-white stars we mostly see.
const PALETTE: [string, number][] = [
  ['#9bb0ff', 0.08],
  ['#aabfff', 0.14],
  ['#cad7ff', 0.22],
  ['#f8f7ff', 0.26],
  ['#fff4ea', 0.16],
  ['#ffd2a1', 0.09],
  ['#ffb56c', 0.05],
]

export interface StarField {
  positions: Float32Array
  colors: Float32Array
  sizes: Float32Array
  phases: Float32Array
}

export interface StarOptions {
  count: number
  seed?: number
  /** Fraction of stars concentrated in the galactic band. */
  bandFraction?: number
  minRadius?: number
  maxRadius?: number
}

export function generateStars({
  count,
  seed = 7,
  bandFraction = 0.45,
  minRadius = 28,
  maxRadius = 90,
}: StarOptions): StarField {
  const rand = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const phases = new Float32Array(count)
  const dir = new THREE.Vector3()
  const color = new THREE.Color()
  const cumulative = PALETTE.reduce<number[]>((acc, [, w]) => [...acc, (acc.at(-1) ?? 0) + w], [])

  for (let i = 0; i < count; i++) {
    // Uniform direction on the sphere.
    const z = rand() * 2 - 1
    const phi = rand() * Math.PI * 2
    const r = Math.sqrt(1 - z * z)
    dir.set(r * Math.cos(phi), z, r * Math.sin(phi))

    if (rand() < bandFraction) {
      // Pull the star towards the band plane with a gaussian falloff.
      const h = dir.dot(BAND_NORMAL)
      const g = gaussian(rand) * 0.09
      dir.addScaledVector(BAND_NORMAL, g - h).normalize()
    }

    const radius = minRadius + (maxRadius - minRadius) * Math.pow(rand(), 0.6)
    positions.set([dir.x * radius, dir.y * radius, dir.z * radius], i * 3)

    const pick = rand()
    const hex = PALETTE[cumulative.findIndex((c) => pick <= c)]?.[0] ?? PALETTE[3][0]
    color.set(hex)
    colors.set([color.r, color.g, color.b], i * 3)

    // Power-law brightness: many faint stars, a few bright ones that catch the bloom.
    sizes[i] = 1.2 + 4.5 * Math.pow(rand(), 7)
    phases[i] = rand()
  }
  return { positions, colors, sizes, phases }
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

/**
 * How visible an axis label should be from the current camera direction.
 * Labels fade out when their axis points at (or away from) the viewer, which
 * is when the two pole labels would pile up on top of each other.
 */
export function axisLabelVisibility(axis: THREE.Vector3, viewDir: THREE.Vector3): number {
  const facing = Math.abs(axis.dot(viewDir))
  return 1 - THREE.MathUtils.smoothstep(facing, 0.7, 0.95)
}
