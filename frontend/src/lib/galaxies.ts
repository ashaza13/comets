import * as THREE from 'three'
import { mulberry32 } from './sky'

/**
 * Distant galaxies scattered over the sky: landmarks that make each jump
 * arrive somewhere recognisably different. Drawn once onto canvases.
 */
export interface GalaxySpec {
  /** Unit direction on the sky. */
  direction: THREE.Vector3
  /** Angular size, radians. */
  size: number
  /** Tilt towards us (1 = face-on, ~0.2 = nearly edge-on) and spin in the sky. */
  tilt: number
  spin: number
  kind: 'spiral' | 'elliptical'
  arms: number
  /** Core and arm tints. */
  core: THREE.Color
  arm: THREE.Color
  seed: number
}

export function galaxySpecs(count: number, seed: number): GalaxySpec[] {
  const rand = mulberry32(seed)
  return Array.from({ length: count }, () => {
    const z = rand() * 2 - 1
    const phi = rand() * Math.PI * 2
    const r = Math.sqrt(1 - z * z)
    const spiral = rand() < 0.75
    // Mostly small and far, with the odd grand one up close.
    const size = THREE.MathUtils.degToRad(rand() < 0.2 ? 13 + rand() * 7 : 5 + rand() * 7)
    return {
      direction: new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), z),
      size,
      tilt: 0.25 + rand() * 0.75,
      spin: rand() * Math.PI * 2,
      kind: spiral ? 'spiral' : 'elliptical',
      arms: rand() < 0.6 ? 2 : 3,
      core: new THREE.Color().setHSL(0.08 + rand() * 0.06, 0.55, 0.78),
      arm: new THREE.Color().setHSL(spiral ? 0.58 + rand() * 0.12 : 0.1, spiral ? 0.55 : 0.3, 0.7),
      seed: Math.floor(rand() * 1e9),
    }
  })
}

const css = (c: THREE.Color, a: number) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`

/** Paint one galaxy, face-on, on a square canvas (tilt is applied by the mesh). */
export function paintGalaxy(spec: GalaxySpec, size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  ctx.globalCompositeOperation = 'lighter'
  const rand = mulberry32(spec.seed)

  // Diffuse halo and bright core.
  const halo = ctx.createRadialGradient(c, c, 0, c, c, c)
  // Kept faint beyond the core so a large galaxy shows structure, not a haze.
  halo.addColorStop(0, css(spec.core, spec.kind === 'elliptical' ? 0.85 : 0.75))
  halo.addColorStop(spec.kind === 'elliptical' ? 0.3 : 0.1, css(spec.core, 0.22))
  halo.addColorStop(spec.kind === 'elliptical' ? 0.7 : 0.45, css(spec.arm, 0.025))
  halo.addColorStop(1, css(spec.arm, 0))
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)
  if (spec.kind === 'elliptical') return canvas

  // Logarithmic spiral arms of star clusters, thinning and fading outwards.
  const turns = 0.9 + rand() * 0.7
  for (let arm = 0; arm < spec.arms; arm++) {
    const offset = (arm / spec.arms) * Math.PI * 2
    for (let i = 0; i < 1800; i++) {
      const f = Math.pow(rand(), 0.7)
      const angle = offset + f * turns * Math.PI * 2
      const radius = c * (0.08 + 0.86 * f)
      const scatter = c * (0.04 + 0.16 * f) * (rand() - 0.5) * 2
      const x = c + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * scatter
      const y = c + Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * scatter
      const dot = (size / 256) * (0.5 + rand() * 1.5 * (1 - f))
      // Young blue stars out in the arms, the odd pink star-forming knot.
      ctx.fillStyle = rand() < 0.05 ? 'rgba(255,160,200,0.4)' : css(spec.arm, 0.3 * (1 - 0.6 * f))
      ctx.beginPath()
      ctx.arc(x, y, dot, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return canvas
}
