import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { INITIAL_STATE, type CometState } from '../schema'
import { SPACE_SCALE } from '../spec'
import { tailControlPoints, tailTexture } from '../tail'

const at = (x: number, hue = 200): CometState => ({
  ...INITIAL_STATE,
  personality: { x, y: 0, z: 0 },
  emotion: { hue, saturation: 0.8, lightness: 0.5 },
})

describe('tailControlPoints', () => {
  it('starts at the origin, passes through past observations and ends at the head', () => {
    const head = new THREE.Vector3(9, 9, 9)
    const pts = tailControlPoints([at(0.5), at(-0.5), at(1)], head)
    expect(pts).toHaveLength(4)
    expect(pts[0].toArray()).toEqual([0, 0, 0])
    expect(pts[1].x).toBeCloseTo(0.5 * SPACE_SCALE)
    expect(pts[2].x).toBeCloseTo(-0.5 * SPACE_SCALE)
    expect(pts[3].equals(head)).toBe(true)
    expect(pts[3]).not.toBe(head)
  })

  it('has two points after the first observation', () => {
    expect(tailControlPoints([at(1)], new THREE.Vector3())).toHaveLength(2)
  })
})

describe('tailTexture', () => {
  it('has one RGBA texel per control point, fading towards the oldest', () => {
    const data = tailTexture([at(0, 60), at(0, 270)])
    expect(data).toHaveLength(3 * 4)
    expect(data[3]).toBeLessThan(data[7])
    expect(data[11]).toBe(255)
  })
})
