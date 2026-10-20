import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { INITIAL_STATE, type CometState } from '../schema'
import { SPACE_SCALE } from '../spec'
import { journeyBounds, tailTexture } from '../tail'

const at = (x: number, hue = 200): CometState => ({
  ...INITIAL_STATE,
  personality: { x, y: 0, z: 0 },
  emotion: { hue, saturation: 0.8, lightness: 0.5 },
})

describe('tailTexture', () => {
  it('has one RGBA texel per control point, fading towards the oldest', () => {
    const data = tailTexture([at(0, 60), at(0, 270)])
    expect(data).toHaveLength(3 * 4)
    expect(data[3]).toBeLessThan(data[7])
    expect(data[11]).toBe(255)
  })
})

describe('journeyBounds', () => {
  it('encloses the origin and every observation', () => {
    const sphere = journeyBounds([at(1), at(-0.5)])
    for (const x of [0, SPACE_SCALE, -0.5 * SPACE_SCALE]) {
      expect(sphere.distanceToPoint(new THREE.Vector3(x, 0, 0))).toBeLessThanOrEqual(1e-6)
    }
  })
})

